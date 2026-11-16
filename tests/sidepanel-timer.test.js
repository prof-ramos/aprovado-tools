import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as analytics from '../shared/analytics.js';
import * as ui from '../shared/ui.js';
import * as format from '../shared/format.js';
import * as timer from '../shared/timer.js';

function createSidepanelContext(api = {}, storage = {}) {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) {
      const classes = new Set(['hidden']);
      const listeners = new Map();
      elements.set(id, {
        id,
        style: {},
        textContent: '',
        innerHTML: '',
        children: [],
        attrs: {},
        value: '',
        disabled: false,
        classList: {
          add: c => classes.add(c),
          remove: c => classes.delete(c),
          contains: c => classes.has(c)
        },
        addEventListener: (type, fn) => listeners.set(type, fn),
        setAttribute(key, value) { this.attrs[key] = value; },
        getAttribute(key) { return this.attrs[key]; },
        dispatch: type => listeners.get(type)?.(),
        appendChild(child) { this.children.push(child); }
      });
    }
    return elements.get(id);
  };

  const mockChrome = {
    storage: {
      local: {
        get: async (keys) => {
          if (!keys) return { ...storage };
          const res = {};
          for (const k of keys) res[k] = structuredClone(storage[k]);
          return res;
        },
        set: async (obj) => {
          Object.assign(storage, structuredClone(obj));
        }
      }
    },
    tabs: { create: async () => {} },
    runtime: { getURL: p => p }
  };

  const context = vm.createContext({
    ...analytics,
    ...ui,
    ...format,
    ...timer,
    setTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    console: { error() {}, log() {}, warn() {} },
    chrome: mockChrome,
    AprovadoApi: {
      checkAuth: async () => ({ isAuthenticated: true }),
      createActivity: async (act) => ({ Id: 9999, ...act }),
      fetchCompleteSnapshot: async () => ({ user: { Id: 1 }, materias: [], atividades: [] }),
      loadSnapshotProgressive: async ({ onCached }) => {
        onCached({ user: { Id: 1 }, materias: [{ Id: 1, Nome: 'Matematica', Conteudos: [] }], atividades: [] });
        return { user: { Id: 1 }, materias: [{ Id: 1, Nome: 'Matematica', Conteudos: [] }], atividades: [] };
      },
      ...api
    },
    AprovadoExport: {
      exportActivitiesCSV() {},
      exportSubjectsSummaryCSV() {},
      exportFullBackupJSON() {},
      copyReportToClipboard: async () => {}
    },
    document: {
      readyState: 'loading',
      getElementById: get,
      querySelectorAll: () => [],
      createElement: (tag) => {
        const el = get(Symbol(tag));
        el.tagName = tag.toUpperCase();
        return el;
      },
      addEventListener() {}
    }
  });

  const source = readFileSync(new URL('../sidepanel/sidepanel.js', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '');
  vm.runInContext(source, context);

  return { get, run: code => vm.runInContext(code, context), context, getStorage: () => storage };
}

describe('Sidepanel Timer integration', () => {
  it('inicializa com o cronômetro parado', () => {
    const sp = createSidepanelContext();
    assert.equal(sp.get('timer-display').textContent, '00:00:00');
    assert.equal(sp.get('timer-status-badge').textContent, 'Parado');
    assert.equal(sp.get('btn-timer-start').classList.contains('hidden'), false);
    assert.equal(sp.get('btn-timer-pause').classList.contains('hidden'), true);
  });

  it('exibe erro se tentar iniciar sem selecionar matéria', async () => {
    const sp = createSidepanelContext();
    await renderAccount(sp, account(1));
    sp.get('timer-select-materia').value = '';
    sp.get('btn-timer-start').dispatch('click');
    assert.equal(sp.get('timer-feedback').textContent, 'Selecione uma matéria antes de iniciar.');
    assert.equal(sp.get('timer-feedback').classList.contains('error'), true);
  });

  it('inicia o cronômetro com matéria selecionada e atualiza status para Em andamento', async () => {
    const sp = createSidepanelContext();
    await renderAccount(sp, account(1));
    sp.get('timer-select-materia').value = '10';
    sp.get('btn-timer-start').dispatch('click');

    assert.equal(sp.get('timer-status-badge').textContent, 'Em andamento');
    assert.equal(sp.get('btn-timer-start').classList.contains('hidden'), true);
    assert.equal(sp.get('btn-timer-pause').classList.contains('hidden'), false);
    assert.equal(sp.get('timer-select-materia').disabled, true);

    const st = sp.getStorage()['aprovado_active_timer:1'];
    assert.equal(st.ownerId, '1');
    assert.equal(st.status, 'running');
    assert.equal(st.materia.Id, 10);
  });

  it('pausa e retoma o cronômetro atualizando botões', async () => {
    const sp = createSidepanelContext();
    await renderAccount(sp, account(1));
    sp.get('timer-select-materia').value = '10';
    sp.get('btn-timer-start').dispatch('click');
    sp.get('btn-timer-pause').dispatch('click');

    assert.equal(sp.get('timer-status-badge').textContent, 'Pausado');
    assert.equal(sp.get('btn-timer-resume').classList.contains('hidden'), false);
    assert.equal(sp.get('btn-timer-save').classList.contains('hidden'), false);

    sp.get('btn-timer-resume').dispatch('click');
    assert.equal(sp.get('timer-status-badge').textContent, 'Em andamento');
    assert.equal(sp.get('btn-timer-resume').classList.contains('hidden'), true);
  });

  it('salva atividade, envia para API e reseta o cronômetro', async () => {
    let savedActivity = null;
    const sp = createSidepanelContext({
      createActivity: async (act) => {
        savedActivity = act;
        return { Id: 888 };
      }
    });

    await renderAccount(sp, account(1));
    sp.get('timer-select-materia').value = '10';
    sp.get('btn-timer-start').dispatch('click');
    sp.get('btn-timer-pause').dispatch('click');

    // Simula tempo decorrido
    sp.run(`activeTimerState.accumulatedMs = 3600000; updateTimerDisplay();`);
    assert.equal(sp.get('timer-display').textContent, '01:00:00');

    await sp.get('btn-timer-save').dispatch('click');

    assert.ok(savedActivity);
    assert.equal(savedActivity.Materia.Id, 10);
    assert.equal(savedActivity.Duracao, 3600000);
    assert.equal(sp.get('timer-status-badge').textContent, 'Parado');
    assert.equal(sp.get('timer-display').textContent, '00:00:00');
  });
});

const subject = { Id: 10, Nome: 'Direito', Conteudos: [{ Id: 21, Nome: 'Direitos fundamentais' }] };
const account = (id, materias = [subject]) => ({ user: { Id: id }, materias, atividades: [] });
const click = (sp, button) => sp.get('btn-timer-' + button).dispatch('click');

function select(sp, content = '') {
  sp.get('timer-select-materia').value = '10';
  sp.get('timer-select-materia').dispatch('change');
  sp.get('timer-select-conteudo').value = content;
  sp.get('timer-select-conteudo').dispatch('change');
}

function pauseAfterAStudySession(sp) {
  click(sp, 'start');
  click(sp, 'pause');
  sp.run('activeTimerState.accumulatedMs = 62000; updateTimerDisplay(); persistTimerState()');
}

async function renderAccount(sp, data) {
  sp.context.testSnapshot = data;
  await sp.run('currentSnapshot = testSnapshot; renderPanel(currentSnapshot)');
  await new Promise(resolve => setImmediate(resolve));
}

describe('regressões do cronômetro da PR #27', () => {
  it('não restaura na conta B a sessão da conta A e preserva a sessão para A', async () => {
    const storage = {};
    const original = createSidepanelContext({}, storage);
    await renderAccount(original, account(1));
    select(original, '21');
    pauseAfterAStudySession(original);

    const panel = createSidepanelContext({}, storage);
    await renderAccount(panel, account(2, [{ Id: 10, Nome: 'Matéria da conta B' }]));
    assert.equal(panel.get('timer-status-badge').textContent, 'Parado');
    assert.equal(panel.get('timer-display').textContent, '00:00:00');
    assert.equal(panel.get('timer-select-materia').value, '');
    select(panel);
    click(panel, 'start');

    const reopened = createSidepanelContext({}, storage);
    await renderAccount(reopened, account('1'));
    assert.equal(reopened.get('timer-status-badge').textContent, 'Pausado');
    assert.equal(reopened.get('timer-display').textContent, '00:01:02');
    assert.equal(reopened.get('timer-select-conteudo').value, '21');
  });

  it('descarta uma restauração atrasada após duas trocas de conta', async () => {
    const panel = createSidepanelContext();
    const reads = [];
    panel.context.chrome.storage.local.get = keys => new Promise(resolve => {
      reads.push(state => resolve({ [keys[0]]: state }));
    });
    const firstAccount = renderAccount(panel, account(1));
    const secondAccount = renderAccount(panel, account(2));
    const returnToFirstAccount = renderAccount(panel, account(1));

    reads[0]({ ownerId: '1', status: 'paused', materia: subject, accumulatedMs: 62000 });
    await firstAccount;
    assert.equal(panel.get('btn-timer-start').disabled, true);
    assert.equal(panel.get('timer-display').textContent, '00:00:00');

    reads[2]({ ownerId: '1', status: 'paused', materia: subject, accumulatedMs: 97000 });
    reads[1]({ ownerId: '2', status: 'paused', materia: subject, accumulatedMs: 59000 });
    await Promise.all([secondAccount, returnToFirstAccount]);
    assert.equal(panel.get('timer-status-badge').textContent, 'Pausado');
    assert.equal(panel.get('timer-display').textContent, '00:01:37');
  });

  it('atualiza o painel ao detectar outra conta no envio e preserva a sessão anterior', async () => {
    const storage = {};
    let senderOwner;
    const panel = createSidepanelContext({
      fetchCompleteSnapshot: async () => account(2),
      createActivity: async (activity, ownerId) => {
        senderOwner = ownerId;
        throw Object.assign(new Error('A conta mudou'), { status: 401, code: 'ACCOUNT_CHANGED' });
      }
    }, storage);
    await renderAccount(panel, account(1));
    select(panel, '21');
    pauseAfterAStudySession(panel);
    await click(panel, 'save');

    assert.equal(senderOwner, '1');
    assert.equal(panel.get('timer-status-badge').textContent, 'Parado');
    assert.equal(panel.get('timer-display').textContent, '00:00:00');

    const reopened = createSidepanelContext({}, storage);
    await renderAccount(reopened, account(1));
    assert.equal(reopened.get('timer-display').textContent, '00:01:02');
  });

  it('ignora o cronômetro legado sem proprietário confirmado', async () => {
    const legacy = { status: 'paused', accumulatedMs: 62000, materia: subject };
    const panel = createSidepanelContext({}, { aprovado_active_timer: legacy });
    await renderAccount(panel, account(1));
    assert.equal(panel.get('timer-status-badge').textContent, 'Parado');
    assert.equal(panel.get('timer-display').textContent, '00:00:00');
  });

  it('limpa a seleção e os campos ao descartar e salva o conteúdo escolhido na próxima sessão', async () => {
    let saved;
    const panel = createSidepanelContext({
      createActivity: async activity => { saved = activity; }
    });
    await renderAccount(panel, account(1));
    select(panel, '21');
    pauseAfterAStudySession(panel);
    panel.get('timer-input-anotacoes').value = 'Anotação da sessão descartada';
    click(panel, 'discard');

    assert.equal(panel.get('timer-select-materia').value, '');
    assert.equal(panel.get('timer-select-conteudo').value, '');
    assert.equal(panel.get('timer-input-anotacoes').value, '');
    select(panel, '21');
    pauseAfterAStudySession(panel);
    await click(panel, 'save');
    assert.equal(saved.Conteudo.Id, 21);
    assert.equal(saved.Anotacoes, '');
  });

  it('bloqueia transições, campos e envio duplicado enquanto o salvamento está pendente', async () => {
    let finish;
    const submissions = [];
    const panel = createSidepanelContext({
      createActivity(activity) {
        submissions.push(activity);
        return new Promise(resolve => { finish = resolve; });
      }
    });
    await renderAccount(panel, account(1));
    select(panel, '21');
    pauseAfterAStudySession(panel);

    const saving = click(panel, 'save');
    for (const id of ['btn-timer-resume', 'btn-timer-discard', 'btn-timer-save', 'timer-input-anotacoes']) {
      assert.equal(panel.get(id).disabled, true, id);
    }
    click(panel, 'resume');
    click(panel, 'discard');
    click(panel, 'start');
    await click(panel, 'save');
    assert.equal(submissions.length, 1);
    assert.equal(panel.get('timer-status-badge').textContent, 'Pausado');
    assert.equal(panel.get('timer-display').textContent, '00:01:02');

    finish();
    await saving;
    assert.equal(panel.get('timer-status-badge').textContent, 'Parado');
    assert.equal(panel.get('btn-timer-start').disabled, false);
    assert.equal(submissions[0].Duracao, 62000);
  });

  it('preserva a sessão e libera os controles quando o salvamento falha', async () => {
    const panel = createSidepanelContext({
      createActivity: async () => { throw new Error('Falha de conexão'); }
    });
    await renderAccount(panel, account(1));
    select(panel, '21');
    pauseAfterAStudySession(panel);
    panel.get('timer-input-anotacoes').value = 'Rascunho';

    await click(panel, 'save');
    assert.equal(panel.get('timer-status-badge').textContent, 'Pausado');
    assert.equal(panel.get('timer-display').textContent, '00:01:02');
    assert.equal(panel.get('timer-input-anotacoes').value, 'Rascunho');
    assert.equal(panel.get('btn-timer-resume').disabled, false);
    assert.equal(panel.get('btn-timer-discard').disabled, false);
  });
});

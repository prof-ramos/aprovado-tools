import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as analytics from '../shared/analytics.js';
import * as ui from '../shared/ui.js';
import * as format from '../shared/format.js';
import * as timer from '../shared/timer.js';

function createSidepanelContext(api = {}) {
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

  let storage = {};
  const mockChrome = {
    storage: {
      local: {
        get: async (keys) => {
          if (!keys) return { ...storage };
          const res = {};
          for (const k of keys) res[k] = storage[k];
          return res;
        },
        set: async (obj) => {
          Object.assign(storage, obj);
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

  it('exibe erro se tentar iniciar sem selecionar matéria', () => {
    const sp = createSidepanelContext();
    sp.get('timer-select-materia').value = '';
    sp.get('btn-timer-start').dispatch('click');
    assert.equal(sp.get('timer-feedback').textContent, 'Selecione uma matéria antes de iniciar.');
    assert.equal(sp.get('timer-feedback').classList.contains('error'), true);
  });

  it('inicia o cronômetro com matéria selecionada e atualiza status para Em andamento', () => {
    const sp = createSidepanelContext();
    sp.run(`currentSnapshot = { user: { Id: 1 }, materias: [{ Id: 10, Nome: 'Direito', Conteudos: [] }], atividades: [] }`);
    sp.get('timer-select-materia').value = '10';
    sp.get('btn-timer-start').dispatch('click');

    assert.equal(sp.get('timer-status-badge').textContent, 'Em andamento');
    assert.equal(sp.get('btn-timer-start').classList.contains('hidden'), true);
    assert.equal(sp.get('btn-timer-pause').classList.contains('hidden'), false);
    assert.equal(sp.get('timer-select-materia').disabled, true);

    const st = sp.getStorage();
    assert.equal(st.aprovado_active_timer.status, 'running');
    assert.equal(st.aprovado_active_timer.materia.Id, 10);
  });

  it('pausa e retoma o cronômetro atualizando botões', () => {
    const sp = createSidepanelContext();
    sp.run(`currentSnapshot = { user: { Id: 1 }, materias: [{ Id: 10, Nome: 'Direito', Conteudos: [] }], atividades: [] }`);
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

    sp.run(`currentSnapshot = { user: { Id: 1 }, materias: [{ Id: 10, Nome: 'Direito', Conteudos: [] }], atividades: [] }`);
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

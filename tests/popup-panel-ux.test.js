import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as analytics from '../shared/analytics.js';
import * as ui from '../shared/ui.js';
import * as format from '../shared/format.js';
import { AprovadoApi } from '../shared/api.js';

// Real popup/sidepanel scripts with analytics and format; only DOM and API are simulated.
function surface(name, api = {}) {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) {
      const classes = new Set(['hidden']);
      const listeners = new Map();
      elements.set(id, { style: {}, textContent: '', innerHTML: '', children: [], attrs: {},
        classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) },
        addEventListener: (type, fn) => listeners.set(type, fn),
        setAttribute(key, value) { this.attrs[key] = value; },
        dispatch: type => listeners.get(type)?.(),
        appendChild(child) { this.children.push(child); } });
    }
    return elements.get(id);
  };
  const context = vm.createContext({ ...analytics, ...ui, ...format, setTimeout: () => {}, console: { error() {} },
    AprovadoApi: { checkAuth: async () => ({ isAuthenticated: true }), ...api },
    AprovadoExport: { exportActivitiesCSV() {}, exportFullBackupJSON() {}, copyReportToClipboard: async () => {} },
    document: { readyState: 'loading', getElementById: get, querySelectorAll: () => [],
      createElement: () => get(Symbol()), addEventListener() {} } });
  const source = readFileSync(new URL(`../${name}/${name}.js`, import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '');
  vm.runInContext(source, context);
  return { get, run: code => vm.runInContext(code, context), context };
}

const render = name => (name === 'popup' ? 'renderConnected' : 'renderPanel');
const minutesAgo = minutes => new Date(Date.now() - minutes * 60 * 1000).toISOString();
const today = () => { const d = new Date(); d.setHours(8, 0, 0, 0); return d.toISOString(); };
const snapshot = (overrides = {}) => ({ user: { Nome: 'Synthetic' }, materias: [], revisoesPendentes: [], ciclo: null,
  atividades: [{ Inicio: '2026-01-01T12:00:00', Duracao: 3600000 }], syncedAt: minutesAgo(3), ...overrides });
const show = (page, name, value) => page.run(`currentSnapshot = ${JSON.stringify(value)}; ${render(name)}(currentSnapshot)`);

for (const name of ['popup', 'sidepanel']) {
  describe(`${name} status and empty states`, () => {
    it('shows when the data was last updated', () => {
      const page = surface(name);
      show(page, name, snapshot());
      assert.equal(page.get('sync-status').textContent, 'Atualizado há 3 min');
    });

    it('says plainly that no question was recorded', () => {
      const page = surface(name);
      show(page, name, snapshot());
      assert.equal(page.get('kpi-questions').textContent, '—');
      assert.equal(page.get('kpi-accuracy').textContent, 'Nenhuma questão registrada ainda');
      show(page, name, snapshot({ atividades: [{ Inicio: '2026-01-01T12:00:00', Duracao: 3600000, ExercicioQuantidade: 10, ExercicioAcerto: 8 }] }));
      assert.equal(page.get('kpi-questions').textContent, '10 questões');
      assert.equal(page.get('kpi-accuracy').textContent, '80,0% de acertos');
    });

    it('explains a cycle at 0% only when nothing was studied in it', () => {
      const page = surface(name);
      const noteId = name === 'popup' ? 'cycle-empty-note' : 'ciclo-empty-note';
      const cycle = materias => ({ TotalHoras: 100, TotalHorasExecutadas: 0, TotalPorcentagem: 0, Materias: materias });
      show(page, name, snapshot({ ciclo: cycle([{ Nome: 'Português', HorasExecutadas: 0 }]) }));
      assert.equal(page.get(noteId).classList.contains('hidden'), false);
      show(page, name, snapshot({ ciclo: cycle([{ Nome: 'Português', HorasExecutadas: 7200 }]) }));
      assert.equal(page.get(noteId).classList.contains('hidden'), true);
    });
  });
}

describe('sidepanel day-to-day sections', () => {
  it('shows today, the week and an empty reviews message', () => {
    const page = surface('sidepanel');
    show(page, 'sidepanel', snapshot({ atividades: [{ Inicio: today(), Duracao: 5400000, ExercicioQuantidade: 20, ExercicioAcerto: 15 }] }));
    assert.equal(page.get('today-time').textContent, '1h 30m');
    assert.equal(page.get('today-sessions').textContent, '1');
    assert.equal(page.get('today-questions').textContent, '20');
    assert.equal(page.get('today-empty').classList.contains('hidden'), true);
    assert.equal(page.get('week-sessions').textContent, '1');
    assert.equal(page.get('week-days').textContent, '1');
    assert.equal(page.get('reviews-empty').classList.contains('hidden'), false);
    assert.equal(page.get('section-reviews').classList.contains('hidden'), false);
  });

  it('says nothing was studied today and lists pending reviews when there are some', () => {
    const page = surface('sidepanel');
    show(page, 'sidepanel', snapshot({ revisoesPendentes: [{ Materia: { Nome: 'Português' }, Conteudo: { Nome: 'Crase' } }] }));
    assert.equal(page.get('today-empty').classList.contains('hidden'), false);
    assert.equal(page.get('today-questions').textContent, '—');
    assert.equal(page.get('reviews-empty').classList.contains('hidden'), true);
    assert.equal(page.get('reviews-count-badge').textContent, 1);
  });
});

for (const [name, start] of [['popup', 'init'], ['sidepanel', 'loadData']]) {
  describe(`${name} progressive load`, () => {
    it('shows the saved data of the confirmed account while the refresh runs, then settles', async () => {
      let finish;
      const fresh = snapshot({ atividades: [{ Inicio: '2026-01-01T12:00:00', Duracao: 3600000 }, { Inicio: '2026-01-02T12:00:00', Duracao: 3600000 }], syncedAt: minutesAgo(0) });
      const page = surface(name, {
        loadSnapshotProgressive: ({ onCached }) => {
          onCached(snapshot({ syncedAt: minutesAgo(12) }));
          return new Promise(resolve => { finish = () => resolve(fresh); });
        }
      });
      const running = page.run(`${start}()`);
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(page.get('kpi-sessions').textContent, '1');
      assert.equal(page.get('sync-status').textContent, 'Atualizado há 12 min · atualizando…');
      finish();
      await running;
      assert.equal(page.get('kpi-sessions').textContent, '2');
      assert.equal(page.get('sync-status').textContent, 'Atualizado agora há pouco');
    });

    it('clears saved data when a refresh fails after an earlier identity confirmation', async () => {
      const page = surface(name, {
        loadSnapshotProgressive: ({ onCached }) => {
          onCached(snapshot({ syncedAt: minutesAgo(40) }));
          return Promise.reject(new Error('Falha de conexão'));
        }
      });
      await page.run(`${start}()`);
      assert.equal(page.get('kpi-sessions').textContent, '');
      assert.equal(page.get('sync-status').textContent, '');
      assert.equal(page.run('currentSnapshot'), null);
    });

    it('drops everything when the session expired, even after showing the cache', async () => {
      const page = surface(name, {
        loadSnapshotProgressive: ({ onCached }) => {
          onCached(snapshot());
          return Promise.reject(Object.assign(new Error('Sessão expirada'), { status: 401 }));
        }
      });
      await page.run(`${start}()`);
      assert.equal(page.get('kpi-sessions').textContent, '');
      assert.equal(page.get('sync-status').textContent, '');
    });

    it('shows the disconnected state without a cache when the identity cannot be confirmed', async () => {
      const page = surface(name, { loadSnapshotProgressive: () => Promise.reject(Object.assign(new Error('x'), { status: 401 })) });
      await page.run(`${start}()`);
      assert.equal(page.get(name === 'popup' ? 'disconnected-state' : 'panel-disconnected').classList.contains('hidden'), false);
    });
  });
}

describe('export names match the dashboard menu', () => {
  const labels = ['Atividades (CSV)', 'Resumo por matéria (CSV)', 'Backup completo (JSON)', 'Copiar relatório (Markdown)'];
  for (const [name, file] of [['popup', 'popup/popup.html'], ['sidepanel', 'sidepanel/sidepanel.html']]) {
    it(`${name} uses the same four export labels`, () => {
      const html = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      const dashboard = readFileSync(new URL('../dashboard/dashboard.html', import.meta.url), 'utf8');
      for (const label of labels) {
        assert.ok(html.includes(label), `${name}: ${label}`);
        assert.match(dashboard, new RegExp(`<strong[^>]*>${label.replace(/[()]/g, '\\$&')}</strong>`), `dashboard: ${label}`);
      }
    });
  }
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const accountSnapshot = id => snapshot({ user: { Id: id, Nome: `Account ${id}`, Email: `account${id}@example.invalid` } });
const refreshButton = name => name === 'popup' ? 'btn-refresh' : 'btn-sync';
const loadingElement = name => name === 'popup' ? 'loading-state' : 'panel-loading';
const exportButtons = name => name === 'popup'
  ? ['btn-export-activities-csv', 'btn-export-subjects-csv', 'btn-export-backup-json', 'btn-copy-markdown']
  : ['btn-export-csv', 'btn-export-subjects-csv', 'btn-export-json', 'btn-copy-md'];

function recordExports(page) {
  const exported = [];
  for (const method of ['exportActivitiesCSV', 'exportSubjectsSummaryCSV', 'exportFullBackupJSON', 'copyReportToClipboard']) {
    page.context.AprovadoExport[method] = (...args) => { exported.push({ method, args }); };
  }
  return exported;
}
function restoreNetworkAfter(t) {
  const fetch = globalThis.fetch, chrome = globalThis.chrome;
  t.after(() => {
    globalThis.fetch = fetch;
    if (chrome === undefined) delete globalThis.chrome; else globalThis.chrome = chrome;
  });
}

const identityScenarios = [
  ['account changes during list loading', [7, 7, 8]],
  ['identity disappears after cache rendering', [7, null]],
  ['identity disappears during list loading', [7, 7, null]],
  ['identity request fails after cache rendering', [7, 'network-error']],
  ['identity request fails after list loading', [7, 7, 'network-error']],
  ['another account fails to load activities', [7, 8], true],
  ['essential data fails with the same account', [7, 7], true]
];
for (const [name, start] of [['popup', 'init'], ['sidepanel', 'loadData']]) {
  describe(`${name} account isolation with the real API`, () => {
    for (const [scenario, identities, failActivities = false] of identityScenarios) {
      it(`clears data and blocks all exports when ${scenario}, then recovers`, async t => {
        restoreNetworkAfter(t);
        const cached = accountSnapshot(7);
        let storage = { aprovado_data_snapshot: cached, aprovado_last_sync: 1 };
        const writes = [], refreshGate = deferred(), showingCache = deferred();
        let identityReads = 0, recovered = false;
        globalThis.chrome = { storage: { local: {
          get: async () => ({ ...storage }),
          set: async value => { writes.push(value); storage = { ...storage, ...value }; }
        } } };
        globalThis.fetch = async url => {
          let body = [], status = 200;
          if (url.endsWith('/Usuario/Obter')) {
            identityReads++;
            if (identityReads === 2) { showingCache.resolve(); await refreshGate.promise; }
            const id = recovered ? 8 : identities[identityReads - 1];
            if (id === 'network-error') throw new Error('Synthetic network failure');
            body = id ? accountSnapshot(id).user : null;
          } else if (url.endsWith('/Atividade/Listar')) {
            status = !recovered && failActivities ? 500 : 200;
            body = [{ Inicio: '2026-01-02T12:00:00', Duracao: 7200000 }];
          } else if (url.endsWith('/Acompanhamento/CicloEstudos')) body = null;
          return { status, ok: status === 200, redirected: false, text: async () => JSON.stringify(body) };
        };
        const page = surface(name, AprovadoApi), exported = recordExports(page);
        const running = page.run(`${start}()`);
        await showingCache.promise;
        assert.equal(page.get('user-name').textContent, 'Account 7');
        assert.equal(page.get('kpi-sessions').textContent, '1');
        refreshGate.resolve();
        await running;
        assert.equal(page.run('currentSnapshot'), null);
        for (const id of ['user-name', 'user-avatar', 'kpi-sessions', 'sync-status']) {
          assert.equal(page.get(id).textContent, '', `${scenario}: ${id}`);
        }
        if (name === 'popup') assert.equal(page.get('user-email').textContent, '');
        assert.equal(page.get(name === 'popup' ? 'connected-content' : 'panel-main').classList.contains('hidden'), true);
        assert.equal(page.get(name === 'popup' ? 'disconnected-state' : 'panel-disconnected').classList.contains('hidden'), false);
        for (const id of exportButtons(name)) await page.get(id).dispatch('click');
        assert.deepEqual(exported, []);
        page.run(name === 'popup' ? 'updateMetricsDisplay()' : 'updateView()');
        assert.equal(page.get('kpi-sessions').textContent, '');
        assert.equal(writes.length, 0);
        assert.equal(storage.aprovado_data_snapshot, cached);
        recovered = true;
        await page.run(`${start}()`);
        assert.equal(page.get('user-name').textContent, 'Account 8');
        assert.equal(page.run('currentSnapshot.user.Id'), 8);
        assert.equal(writes.length, 1);
        for (const id of exportButtons(name)) await page.get(id).dispatch('click');
        assert.equal(exported.length, 4);
        assert.equal(exported.find(e => e.method === 'exportFullBackupJSON').args[0].user.Id, 8);
      });
    }
  });

  describe(`${name} overlapping loads`, () => {
    for (const outcome of ['success', 'failure']) {
      for (const oldFinishesFirst of [true, false]) {
        it(`ignores old progressive ${outcome} ${oldFinishesFirst ? 'while refresh is pending' : 'after refresh succeeds'}`, async () => {
          const oldLoad = deferred(), freshLoad = deferred();
          let cachedCallback;
          const page = surface(name, {
            loadSnapshotProgressive: ({ onCached }) => {
              cachedCallback = onCached; onCached(accountSnapshot(7)); return oldLoad.promise;
            },
            fetchCompleteSnapshot: () => freshLoad.promise
          });
          const older = page.run(`${start}()`);
          const newer = page.get(refreshButton(name)).dispatch('click');
          await tick();
          const finishOlder = async () => {
            cachedCallback(accountSnapshot(7));
            assert.equal(page.get(loadingElement(name)).classList.contains('hidden'), !oldFinishesFirst);
            if (outcome === 'success') oldLoad.resolve(accountSnapshot(7));
            else oldLoad.reject(new Error('Old refresh failed'));
            await older;
          };
          if (oldFinishesFirst) {
            await finishOlder();
            assert.equal(page.get(loadingElement(name)).classList.contains('hidden'), false);
            if (name === 'popup') assert.equal(page.get(refreshButton(name)).disabled, true);
          }
          freshLoad.resolve(accountSnapshot(8));
          await newer;
          if (!oldFinishesFirst) await finishOlder();
          assert.equal(page.get('user-name').textContent, 'Account 8');
          assert.equal(page.run('currentSnapshot.user.Id'), 8);
          assert.equal(page.get(loadingElement(name)).classList.contains('hidden'), true);
          if (name === 'popup') assert.equal(page.get(refreshButton(name)).disabled, false);
          const exported = recordExports(page);
          await page.get(exportButtons(name)[2]).dispatch('click');
          assert.equal(exported[0].args[0].user.Id, 8);
        });
      }
    }
    it('does not restore old cache or success after the newer refresh failed', async () => {
      const oldLoad = deferred();
      let cachedCallback;
      const page = surface(name, {
        loadSnapshotProgressive: ({ onCached }) => {
          cachedCallback = onCached; onCached(accountSnapshot(7)); return oldLoad.promise;
        },
        fetchCompleteSnapshot: async () => { throw new Error('Current refresh failed'); }
      });
      const older = page.run(`${start}()`);
      await page.get(refreshButton(name)).dispatch('click');
      assert.equal(page.run('currentSnapshot'), null);
      cachedCallback(accountSnapshot(7));
      assert.equal(page.run('currentSnapshot'), null);
      oldLoad.resolve(accountSnapshot(7));
      await older;
      assert.equal(page.run('currentSnapshot'), null);
      assert.equal(page.get('user-name').textContent, '');
    });
    for (const outcome of ['success', 'failure']) {
      it(`ignores old manual ${outcome} after a newer progressive load succeeds`, async () => {
        const oldLoad = deferred();
        const page = surface(name, {
          loadSnapshotProgressive: async () => accountSnapshot(8),
          fetchCompleteSnapshot: () => oldLoad.promise
        });
        const older = page.get(refreshButton(name)).dispatch('click');
        await tick();
        await page.run(`${start}()`);
        if (outcome === 'success') oldLoad.resolve(accountSnapshot(7));
        else oldLoad.reject(new Error('Old refresh failed'));
        await older;
        assert.equal(page.get('user-name').textContent, 'Account 8');
        assert.equal(page.run('currentSnapshot.user.Id'), 8);
        assert.equal(page.get(loadingElement(name)).classList.contains('hidden'), true);
        if (name === 'popup') assert.equal(page.get(refreshButton(name)).disabled, false);
      });
    }
  });

  it(`${name} ignores an old API success after its storage write settles late`, async t => {
    restoreNetworkAfter(t);
    const storage = { aprovado_data_snapshot: accountSnapshot(7), aprovado_last_sync: 1 };
    const writingOld = deferred(), finishOldWrite = deferred();
    let activeAccount = 7;
    globalThis.chrome = { storage: { local: {
      get: async () => ({ ...storage }),
      set: async value => {
        if (value.aprovado_data_snapshot.user.Id === 7) { writingOld.resolve(); await finishOldWrite.promise; }
        Object.assign(storage, value);
      }
    } } };
    globalThis.fetch = async url => {
      let body = [];
      if (url.endsWith('/Usuario/Obter')) body = accountSnapshot(activeAccount).user;
      else if (url.endsWith('/Atividade/Listar')) body = [{ Id: activeAccount, Inicio: '2026-01-02T12:00:00', Duracao: 3600000 }];
      else if (url.endsWith('/Acompanhamento/CicloEstudos')) body = null;
      return { status: 200, ok: true, redirected: false, text: async () => JSON.stringify(body) };
    };
    const page = surface(name, AprovadoApi), exported = recordExports(page);
    const older = page.run(`${start}()`);
    await writingOld.promise;
    activeAccount = 8;
    await page.get(refreshButton(name)).dispatch('click');
    assert.equal(page.get('user-name').textContent, 'Account 8');
    assert.equal(storage.aprovado_data_snapshot.user.Id, 8);
    finishOldWrite.resolve();
    await older;
    assert.equal(page.get('user-name').textContent, 'Account 8');
    assert.equal(page.run('currentSnapshot.user.Id'), 8);
    await page.get(exportButtons(name)[2]).dispatch('click');
    assert.equal(exported[0].args[0].user.Id, 8);
    // Ownership checks, not write order, authorize cache reuse on subsequent loads.
    assert.equal(storage.aprovado_data_snapshot.user.Id, 7);
    const next = await AprovadoApi.fetchCompleteSnapshot();
    assert.equal(next.user.Id, 8);
    assert.equal(next.atividades[0].Id, 8);
    assert.equal(storage.aprovado_data_snapshot.user.Id, 8);
  });
}

for (const authenticated of [true, false]) {
  it(`sidepanel ignores obsolete authentication result ${authenticated}`, async () => {
    const auth = deferred();
    let dataRequests = 0;
    const page = surface('sidepanel', {
      checkAuth: () => auth.promise,
      fetchCompleteSnapshot: async () => { dataRequests++; return accountSnapshot(7); },
      loadSnapshotProgressive: async () => accountSnapshot(8)
    });
    const older = page.get('btn-sync').dispatch('click');
    await page.run('loadData()');
    auth.resolve({ isAuthenticated: authenticated });
    await older;
    assert.equal(page.get('user-name').textContent, 'Account 8');
    assert.equal(page.run('currentSnapshot.user.Id'), 8);
    assert.equal(dataRequests, 0);
  });
}

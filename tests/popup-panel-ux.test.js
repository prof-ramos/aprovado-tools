import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as analytics from '../shared/analytics.js';
import * as ui from '../shared/ui.js';
import * as format from '../shared/format.js';

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

    it('keeps the saved data and says the refresh failed when the account was already confirmed', async () => {
      const page = surface(name, {
        loadSnapshotProgressive: ({ onCached }) => {
          onCached(snapshot({ syncedAt: minutesAgo(40) }));
          return Promise.reject(new Error('Falha de conexão'));
        }
      });
      await page.run(`${start}()`);
      assert.equal(page.get('kpi-sessions').textContent, '1');
      assert.equal(page.get('sync-status').textContent, 'Atualizado há 40 min · não foi possível atualizar');
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

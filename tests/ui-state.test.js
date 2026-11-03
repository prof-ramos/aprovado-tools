import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as analytics from '../shared/analytics.js';
import * as ui from '../shared/ui.js';
import * as format from '../shared/format.js';

// Real UI scripts and analytics with DOM, API and clipboard/download boundaries.
function surface(name) {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) {
      const classes = new Set();
      const listeners = new Map();
      const e = { style: {}, textContent: '', innerHTML: '', children: [],
        classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) },
        addEventListener: (type, fn) => listeners.set(type, fn),
        dispatch: type => listeners.get(type)?.(),
        appendChild(child) { this.children.push(child); }
      };
      elements.set(id, e);
    }
    return elements.get(id);
  };
  const downloads = [];
  const context = vm.createContext({ ...analytics, ...ui, ...format, setTimeout: () => {},
    console: { error() {} },
    AprovadoApi: { checkAuth: async () => ({ isAuthenticated: true }), fetchCompleteSnapshot: async () => {
      throw new Error('Authentication failed');
    } },
    AprovadoExport: { exportActivitiesCSV: data => downloads.push(data), exportFullBackupJSON: data => downloads.push(data),
      copyReportToClipboard: async () => { throw new Error('Clipboard denied'); } },
    document: { readyState: 'loading', getElementById: get, querySelectorAll: () => [],
      createElement: () => get(Symbol()), addEventListener() {} }
  });
  const source = readFileSync(new URL(`../${name}/${name}.js`, import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '');
  vm.runInContext(source, context);
  const run = code => vm.runInContext(code, context);
  run(`currentSnapshot = { user: { Nome: 'Synthetic', Email: 'synthetic@example.invalid' },
    atividades: [{ Inicio: '2026-01-01T12:00:00', Duracao: 3600000 }], materias: [], revisoesPendentes: [] };
    ${name === 'popup' ? 'renderConnected' : 'renderPanel'}(currentSnapshot)`);
  return { get, run, downloads, context };
}

describe('Popup and sidepanel state regressions', () => {
  for (const name of ['popup', 'sidepanel']) {
    it(`${name} clears a loaded snapshot after failed refresh and blocks stale export`, async () => {
      const page = surface(name);
      assert.equal(Number(page.get('kpi-sessions').textContent), 1);
      await page.get(name === 'popup' ? 'btn-refresh' : 'btn-sync').dispatch('click');
      assert.equal(page.get('user-name').textContent, '');
      assert.equal(page.get('kpi-sessions').textContent, '');
      page.run(name === 'popup' ? 'updateMetricsDisplay()' : 'updateView()');
      assert.equal(page.get('kpi-sessions').textContent, '');
      await page.get(name === 'popup' ? 'btn-export-backup-json' : 'btn-export-json').dispatch('click');
      await page.get(name === 'popup' ? 'btn-export-activities-csv' : 'btn-export-csv').dispatch('click');
      assert.equal(page.downloads.length, 0);
      page.context.AprovadoApi.fetchCompleteSnapshot = async () => ({
        user: { Nome: 'Recovered' }, atividades: [{ Inicio: '2026-01-01T12:00:00', Duracao: 7200000 }], materias: []
      });
      await page.get(name === 'popup' ? 'btn-refresh' : 'btn-sync').dispatch('click');
      assert.equal(page.get('user-name').textContent, 'Recovered');
      assert.equal(Number(page.get('kpi-sessions').textContent), 1);
      await page.get(name === 'popup' ? 'btn-export-backup-json' : 'btn-export-json').dispatch('click');
      assert.equal(page.downloads.length, 1);
    });

    it(`${name} shows a clipboard failure without an unhandled rejection`, async () => {
      const page = surface(name);
      await assert.doesNotReject(page.get(name === 'popup' ? 'btn-copy-markdown' : 'btn-copy-md').dispatch('click'));
      assert.match(page.get(name === 'popup' ? 'copy-btn-text' : 'copy-text').textContent, /Falha/);
    });
  }
});

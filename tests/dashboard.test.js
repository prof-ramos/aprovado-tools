import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as analytics from '../shared/analytics.js';
import * as ui from '../shared/ui.js';
import * as format from '../shared/format.js';

// Keep the actual renderers and analytics; replace only the browser boundary.
function element() {
  const listeners = new Map();
  const attributes = new Map();
  const classes = new Set();
  let html = '';
  return {
    children: [], style: {}, dataset: {}, value: '', textContent: '',
    classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x),
      toggle: (x, on) => on ? classes.add(x) : classes.delete(x) },
    addEventListener(name, callback) {
      const handlers = listeners.get(name) || [];
      handlers.push(callback); listeners.set(name, handlers);
    },
    dispatch(name, event = {}) {
      const results = [this[`on${name}`]?.(event), ...(listeners.get(name) || []).map(fn => fn(event))];
      return Promise.all(results);
    },
    setAttribute: (key, value) => attributes.set(key, String(value)),
    getAttribute: key => attributes.get(key),
    querySelectorAll: () => [],
    appendChild(child) { this.children.push(child); },
    set innerHTML(value) { html = value; this.children = []; },
    get innerHTML() { return html; }
  };
}

function dashboard(now, boundary = {}, options = {}) {
  const Clock = now ? class extends Date {
    constructor(...args) { super(...(args.length ? args : [typeof now === 'object' ? now.value : now])); }
    static now() { return new Clock(typeof now === 'object' ? now.value : now).getTime(); }
  } : Date;
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  };
  const periods = Object.fromEntries(['all', 'this_year', '90d', '30d', '7d', 'custom'].map(period => {
    const button = element();
    button.dataset.period = period;
    return [period, button];
  }));
  const tabs = Object.fromEntries(['overview', 'historical', 'activities'].map(view => {
    const tab = element();
    tab.dataset.view = view;
    return [view, tab];
  }));
  const historical = tabs.historical;
  const periodButtons = Object.values(periods);
  const granularity = Object.fromEntries(['semester', 'year'].map(value => {
    const button = element();
    button.dataset.granularity = value;
    return [value, button];
  }));
  const overviewFilters = [element(), element()];
  const filterBar = element();
  filterBar.querySelectorAll = selector => selector === '[data-filter-scope]' ? overviewFilters : [];
  const hashListeners = [];
  const location = { search: '', hash: options.hash || '' };
  get('period-ranking-toggle').querySelectorAll = selector => selector === '.seg-btn' ? Object.values(granularity) : [];
  const context = vm.createContext({ ...analytics, ...ui, ...format, console, setTimeout, Date: Clock,
    ...boundary,
    document: { readyState: 'loading', getElementById: get,
      querySelectorAll: selector => selector === '.filter-bar .seg-btn' ? periodButtons
        : selector === '.view-tab' ? Object.values(tabs)
        : selector === '.seg-btn' ? [...periodButtons, ...Object.values(granularity)] : [],
      querySelector: selector => selector === '.filter-bar' ? filterBar : null,
      createElement: element, addEventListener() {} },
    window: { innerWidth: 1200, location, addEventListener: (name, callback) => { if (name === 'hashchange') hashListeners.push(callback); } }
  });
  const source = readFileSync(new URL('../dashboard/dashboard.js', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '');
  vm.runInContext(source, context);
  return { get, context, periods, historical, tabs, location, granularity, overviewFilters,
    setHash: hash => { location.hash = hash; hashListeners.forEach(callback => callback()); },
    run: source => vm.runInContext(source, context) };
}

const activity = (hours = 1) => ({ Inicio: '2026-06-01T12:00:00', Duracao: hours * 3600000,
  Materia: { Id: 1, Nome: 'Matemática', Cor: '#3b82f6' },
  ExercicioQuantidade: 10, ExercicioAcerto: 8, TipoEstudo: 'Questões' });

function subject(overrides = {}) {
  return { id: 1, name: 'Matemática', color: '#3b82f6', totalHours: 2,
    accuracy: 80, questions: 10, correct: 8, ...overrides };
}

function quadrants(s) {
  return { medianHours: 2, accuracyCutoff: 75, summary: { totalSubjects: 1, strongCount: 1, bottlenecksCount: 0 },
    quadrants: { pontosFortes: [s], gargalosCriticos: [], baseSolida: [], zonaRisco: [], semExercicios: [] } };
}

describe('Dashboard rendering regressions', () => {
  it('clears loaded data after failed sync and prevents filters and exports from restoring it', async () => {
    const downloads = [];
    const page = dashboard(null, { console: { error() {} }, AprovadoExport: { exportActivitiesCSV: value => downloads.push(value),
      exportFullBackupJSON: value => downloads.push(value) },
      AprovadoApi: { fetchCompleteSnapshot: async () => { throw new Error('Session expired'); } } });
    page.context.window.chrome = { storage: { local: {} } };
    page.context.data = { user: { Nome: 'Synthetic User' }, atividades: [activity()], materias: [activity().Materia] };
    page.run('fullSnapshot = data; renderUserHeader(data.user); updateDashboard(); renderHistoricalPatternsTab(data.atividades, data.materias)');
    assert.equal(Number(page.get('dash-total-sessions').textContent), 1);
    await page.get('btn-sync-now').dispatch('click');
    assert.equal(page.get('user-display-name').textContent, '');
    assert.equal(Number(page.get('dash-total-sessions').textContent), 0);
    assert.equal(page.get('hist-total-hours-decimal').textContent, '0,0 horas líquidas');
    await page.periods.all.dispatch('click');
    await page.historical.dispatch('click');
    assert.equal(page.get('tab-overview').classList.contains('hidden'), true);
    assert.equal(page.get('tab-historical-patterns').classList.contains('hidden'), true);
    await page.get('export-csv-activities').dispatch('click');
    await page.get('export-json-backup').dispatch('click');
    assert.equal(downloads.length, 0);
    assert.equal(page.get('btn-export-dropdown').disabled, true);
    page.context.AprovadoApi.fetchCompleteSnapshot = async () => page.context.data;
    await page.get('btn-sync-now').dispatch('click');
    assert.equal(page.get('user-display-name').textContent, 'Synthetic User');
    assert.equal(Number(page.get('dash-total-sessions').textContent), 1);
    assert.equal(page.get('btn-export-dropdown').disabled, false);
    await page.get('export-json-backup').dispatch('click');
    assert.equal(downloads.length, 1);
  });

  it('preserves valid filter selections on refresh and resets selections missing in the new snapshot', () => {
    const page = dashboard();
    page.run(`fullSnapshot = { atividades: [
      { Inicio: '2026-06-01T12:00:00', Duracao: 3600000, Materia: { Id: 1 }, TipoEstudo: 'Leitura' },
      { Inicio: '2026-06-02T12:00:00', Duracao: 3600000, Materia: { Id: 2 }, TipoEstudo: 'Questões' }
    ], materias: [{ Id: 1, Nome: 'A' }, { Id: 2, Nome: 'B' }] }`);
    const subject = page.get('select-subject');
    subject.value = '2'; subject.dispatch('change', { target: subject });
    const type = page.get('select-type');
    type.value = 'Questões'; type.dispatch('change', { target: type });
    // Assigning select.innerHTML in a browser resets its selected option.
    subject.value = 'all'; type.value = 'all';
    page.run('populateFilterSelects(fullSnapshot); updateDashboard()');
    assert.equal(subject.value, '2');
    assert.equal(type.value, 'Questões');
    assert.equal(Number(page.get('dash-total-sessions').textContent), 1);
    page.run(`fullSnapshot = { atividades: [{ Inicio: '2026-06-01T12:00:00', Duracao: 3600000,
      Materia: { Id: 1 }, TipoEstudo: 'Leitura' }], materias: [{ Id: 1, Nome: 'A' }] };
      populateFilterSelects(fullSnapshot); updateDashboard()`);
    assert.equal(subject.value, 'all');
    assert.equal(type.value, 'all');
    assert.equal(Number(page.get('dash-total-sessions').textContent), 1);
  });

  it('shows a retryable clipboard failure without rejecting the click handler', async () => {
    const page = dashboard(null, { console: { error() {} }, setTimeout: () => {}, AprovadoExport: { copyReportToClipboard: async () => { throw new Error('Denied'); } } });
    page.run('fullSnapshot = { atividades: [], materias: [] }');
    await assert.doesNotReject(page.get('export-copy-md').dispatch('click'));
    assert.match(page.get('copy-report-title').textContent, /Falha/);
  });

  it('keeps the activity search local to the table across tab clicks and history navigation', async () => {
    const page = dashboard('2026-06-02T12:00:00');
    page.context.data = { atividades: [activity(), { ...activity(2),
      Materia: { Id: 2, Nome: 'História', Cor: '#abcdef' } }], materias: [] };
    page.run('fullSnapshot = data; setupViewSwitch(); updateDashboard()');
    await page.tabs.activities.dispatch('click');
    const search = page.get('input-search-activities');
    search.value = 'matemática';
    await search.dispatch('input', { target: search });
    assert.equal(page.get('tbody-activities-list').children.length, 1);
    assert.match(page.get('activities-count-caption').textContent, /^1 atividades/);
    assert.equal(Number(page.get('dash-total-sessions').textContent), 2);
    assert.equal(page.get('tbody-subjects-summary').children.length, 2);

    await page.tabs.overview.dispatch('click');
    assert.equal(page.get('tab-activities').classList.contains('hidden'), true);
    assert.equal(Number(page.get('dash-total-sessions').textContent), 2);
    for (const hash of ['#historico', '#atividades', '#visao-geral']) {
      page.setHash(hash);
      assert.equal(Number(page.get('dash-total-sessions').textContent), 2);
    }
    page.setHash('#atividades');
    assert.equal(search.value, 'matemática', 'returning to the table preserves its visible search');
    assert.equal(page.get('tbody-activities-list').children.length, 1);
    search.value = 'no matching activity';
    await search.dispatch('input', { target: search });
    assert.match(page.get('tbody-activities-list').innerHTML, /Nenhuma atividade/);
    await page.tabs.overview.dispatch('click');
    assert.equal(Number(page.get('dash-total-sessions').textContent), 2);
  });

  it('exports the search only while its field is visible, preserving global filters and full backups', async () => {
    const exported = {};
    const page = dashboard('2026-06-02T12:00:00', { setTimeout: () => {}, AprovadoExport: {
      exportActivitiesCSV: value => { exported.activities = value; },
      exportSubjectsSummaryCSV: value => { exported.subjects = value; },
      exportFullBackupJSON: value => { exported.backup = value; },
      copyReportToClipboard: async value => { exported.report = value; }
    } });
    page.context.data = { atividades: [
      { ...activity(), Anotacoes: 'primeira' },
      { ...activity(2), Anotacoes: 'segunda' },
      { ...activity(3), Materia: { Id: 2, Nome: 'História' } }
    ], materias: [activity().Materia, { Id: 2, Nome: 'História' }] };
    page.run('fullSnapshot = data; setupViewSwitch(); populateFilterSelects(data); updateDashboard()');
    const subject = page.get('select-subject');
    subject.value = '1';
    await subject.dispatch('change', { target: subject });
    await page.tabs.activities.dispatch('click');
    const search = page.get('input-search-activities');
    search.value = 'primeira';
    await search.dispatch('input', { target: search });

    const checkExports = async (sessions, hours) => {
      for (const id of ['export-csv-activities', 'export-csv-subjects', 'export-copy-md', 'export-json-backup']) {
        await page.get(id).dispatch('click');
      }
      assert.equal(exported.activities.length, sessions);
      assert.equal(exported.subjects.length, 1);
      assert.equal(exported.subjects[0].durationMs, hours * 3600000);
      assert.equal(exported.report.totalSessions, sessions);
      assert.equal(exported.backup.atividades.length, 3);
    };
    await checkExports(1, 1);
    await page.tabs.overview.dispatch('click');
    await checkExports(2, 3);
    page.setHash('#historico');
    await checkExports(2, 3);
    page.setHash('#atividades');
    await checkExports(1, 1);
  });

  it('keeps searched pagination and combines the table search with the visible filters', async () => {
    const page = dashboard('2026-06-02T12:00:00');
    page.context.data = { atividades: [
      ...Array.from({ length: 51 }, () => ({ ...activity(), Anotacoes: 'matching' })),
      { ...activity(), Anotacoes: 'excluded' },
      { ...activity(), Anotacoes: 'matching', TipoEstudo: 'Leitura' },
      { ...activity(), Anotacoes: 'matching', Materia: { Id: 2, Nome: 'História' } },
      { ...activity(), Anotacoes: 'matching', Inicio: '2026-01-01T12:00:00' }
    ], materias: [activity().Materia, { Id: 2, Nome: 'História' }] };
    page.run('fullSnapshot = data; setupViewSwitch(); populateFilterSelects(data); updateDashboard()');
    await page.tabs.activities.dispatch('click');
    await page.periods.custom.dispatch('click');
    page.get('input-date-start').value = '2026-06-01';
    page.get('input-date-end').value = '2026-06-02';
    await page.get('btn-apply-custom-dates').dispatch('click');
    for (const [id, value] of [['select-subject', '1'], ['select-type', 'Questões']]) {
      const field = page.get(id); field.value = value;
      await field.dispatch('change', { target: field });
    }
    const search = page.get('input-search-activities');
    search.value = 'matching';
    await search.dispatch('input', { target: search });
    assert.equal(Number(page.get('dash-total-sessions').textContent), 52);
    assert.equal(page.get('pagination-info').textContent, 'Mostrando 1 a 50 de 51');
    await page.get('btn-page-next').dispatch('click');
    assert.equal(page.get('pagination-info').textContent, 'Mostrando 51 a 51 de 51');
    assert.equal(page.get('tbody-activities-list').children.length, 1);
    await page.get('btn-page-prev').dispatch('click');
    assert.equal(page.get('pagination-info').textContent, 'Mostrando 1 a 50 de 51');
    search.value = '';
    await search.dispatch('input', { target: search });
    assert.equal(page.get('pagination-info').textContent, 'Mostrando 1 a 50 de 52');
  });

  it('tabs switch sections, disable filters in the history and keep the address in sync', () => {
    const page = dashboard();
    const recentDate = new Date().toISOString();
    page.context.navigationActivities = [
      { Inicio: recentDate, Duracao: 3600000 },
      { Inicio: '2020-12-01T12:00:00', DataInicio: '01/12/2020', Duracao: 3600000 }
    ];
    page.run('fullSnapshot = { atividades: navigationActivities, materias: [] }');
    page.context.setupViewSwitch();
    const paneHidden = id => page.get(id).classList.contains('hidden');
    const controls = () => [page.get('select-subject'), page.get('select-type'), page.get('input-date-start'),
      page.get('input-date-end'), page.get('btn-apply-custom-dates'), ...Object.values(page.periods)];

    // Starts on the overview with the filters enabled.
    assert.equal(paneHidden('tab-overview'), false);
    assert.equal(page.tabs.overview.getAttribute('aria-selected'), 'true');
    assert.equal(page.get('filter-note').classList.contains('hidden'), true);

    page.tabs.historical.dispatch('click');
    assert.equal(paneHidden('tab-historical-patterns'), false);
    assert.equal(paneHidden('tab-overview'), true);
    assert.equal(paneHidden('tab-activities'), true);
    assert.equal(page.location.hash, '#historico');
    assert.equal(page.tabs.historical.getAttribute('aria-selected'), 'true');
    assert.equal(page.tabs.historical.getAttribute('aria-current'), 'page');
    assert.equal(page.tabs.overview.getAttribute('aria-selected'), 'false');
    assert.equal(page.tabs.overview.getAttribute('aria-current'), 'false');
    assert.ok(page.overviewFilters.every(e => e.classList.contains('is-disabled')), 'filter groups are dimmed, not hidden');
    assert.ok(controls().every(c => c.disabled === true), 'filter controls are disabled');
    assert.equal(page.get('filter-note').classList.contains('hidden'), false);

    page.tabs.activities.dispatch('click');
    assert.equal(paneHidden('tab-activities'), false);
    assert.equal(paneHidden('tab-historical-patterns'), true);
    assert.equal(page.location.hash, '#atividades');
    assert.ok(page.overviewFilters.every(e => !e.classList.contains('is-disabled')));
    assert.ok(controls().every(c => c.disabled === false));
    assert.equal(page.get('filter-note').classList.contains('hidden'), true);

    page.tabs.overview.dispatch('click');
    assert.equal(paneHidden('tab-overview'), false);
    assert.equal(page.location.hash, '#visao-geral');
    page.periods['30d'].dispatch('click');
    assert.equal(Number(page.get('dash-total-sessions').textContent), 1);
    assert.equal(page.periods['30d'].classList.contains('active'), true);

    // Back/Forward and shared links change only the address.
    page.setHash('#historico');
    assert.equal(paneHidden('tab-historical-patterns'), false);
    assert.equal(page.tabs.historical.getAttribute('aria-selected'), 'true');
    page.setHash('#atividades');
    assert.equal(paneHidden('tab-activities'), false);
    page.setHash('#qualquer-coisa');
    assert.equal(paneHidden('tab-overview'), false);
    page.setHash('');
    assert.equal(paneHidden('tab-overview'), false);

    page.periods.custom.dispatch('click');
    assert.equal(page.get('custom-date-container').classList.contains('hidden'), false);
    page.get('input-date-start').value = '2020-12-01';
    page.get('input-date-end').value = '2020-12-31';
    page.get('btn-apply-custom-dates').dispatch('click');
    assert.equal(Number(page.get('dash-total-sessions').textContent), 1);
    assert.equal(page.get('tbody-activities-list').children.length, 1);
    assert.match(page.get('tbody-activities-list').children[0].innerHTML, /01\/12\/2020/);
    page.tabs.historical.dispatch('click');
    assert.equal(page.get('custom-date-container').classList.contains('hidden'), false, 'custom dates stay visible, disabled');
  });

  it('opens directly on the section named in the address', () => {
    const page = dashboard(null, {}, { hash: '#atividades' });
    page.run('fullSnapshot = { atividades: [], materias: [] }');
    page.context.setupViewSwitch();
    assert.equal(page.get('tab-activities').classList.contains('hidden'), false);
    assert.equal(page.get('tab-overview').classList.contains('hidden'), true);
    assert.equal(page.tabs.activities.getAttribute('aria-selected'), 'true');
  });

  it('arrow keys move between tabs and update the address', () => {
    const page = dashboard();
    page.run('fullSnapshot = { atividades: [], materias: [] }');
    page.context.setupViewSwitch();
    page.tabs.overview.dispatch('keydown', { key: 'ArrowRight' });
    assert.equal(page.location.hash, '#historico');
    page.tabs.historical.dispatch('keydown', { key: 'End' });
    assert.equal(page.location.hash, '#atividades');
    page.tabs.activities.dispatch('keydown', { key: 'ArrowRight' });
    assert.equal(page.location.hash, '#visao-geral');
  });

  it('sample data mode shows the banner and hides the account name and sync status', () => {
    const page = dashboard();
    page.run("usingMockData = true; renderUserHeader({ Nome: 'Ana', Sobrenome: 'Silva' })");
    assert.equal(page.get('mock-banner').classList.contains('hidden'), false);
    assert.equal(page.get('user-badge').classList.contains('hidden'), true);
    assert.equal(page.get('user-display-name').textContent, '');
    assert.doesNotMatch(page.get('user-status-text').textContent, /Sincronizado via AprovadoApp/);
    assert.match(page.get('footer-source').textContent, /exemplo/);
    page.run(`usingMockData = false; fullSnapshot = { syncedAt: '${new Date(Date.now() - 180000).toISOString()}' }; renderUserHeader({ Nome: 'Ana', Sobrenome: 'Silva' })`);
    assert.equal(page.get('mock-banner').classList.contains('hidden'), true);
    assert.equal(page.get('user-badge').classList.contains('hidden'), false);
    assert.equal(page.get('user-display-name').textContent, 'Ana Silva');
    assert.equal(page.get('user-status-text').textContent, 'Atualizado há 3 min');
  });

  it('draws the evolution chart for the selected period with empty days kept at zero', () => {
    const page = dashboard('2026-10-28T12:00:00');
    page.run("currentPeriod = '7d'");
    const day = (date, ms, count) => ({ date, ms, hours: (ms / 3600000).toFixed(2), count, questions: 0 });
    page.context.history = [day('2026-10-22', 7200000, 2), day('2026-10-27', 3600000, 1)];
    page.run('renderDailyTimelineChart(history)');
    const cols = page.get('daily-timeline-chart').children;
    assert.equal(cols.length, 8, '7d covers eight calendar days, including the ones without study');
    const bars = cols.map(col => col.children[0]);
    assert.equal(bars.filter(b => /is-empty/.test(b.className)).length, 6);
    assert.match(bars[1].title, /^22\/10\/2026: 2h · 2 sessões$/);
    assert.match(bars[2].title, /sem estudo$/);
    assert.match(page.get('timeline-caption').textContent, /por dia · maior barra: 2h/);
  });

  it('groups a long period by month and keeps every month, with pt-BR decimals', () => {
    const page = dashboard('2026-10-28T12:00:00');
    page.run("currentPeriod = 'all'");
    page.context.history = [
      { date: '2024-01-10', ms: 5400000, hours: '1.50', count: 1, questions: 0 },
      { date: '2026-10-05', ms: 3600000, hours: '1.00', count: 1, questions: 4 }
    ];
    page.run('renderDailyTimelineChart(history)');
    const cols = page.get('daily-timeline-chart').children;
    assert.equal(cols.length, 34);
    assert.match(cols[0].children[0].title, /^janeiro de 2024: 1,5h · 1 sessão · 1 dia com estudo$/);
    assert.match(page.get('timeline-caption').textContent, /por mês · maior barra: 1,5h/);
    assert.equal(cols[0].children[1].textContent, '01/24');
  });

  it('shows the overall ranking as 1º, 2º and lets tied periods share the position', () => {
    const page = dashboard('2026-09-15T12:00:00');
    const period = (label, averageRank) => ({ label, averageRank, totalHours: 1, sessions: 1, activeDays: 1, consistency: 1,
      longestStreak: 1, accuracy: null, totalQuestions: 0, isCurrent: false });
    const list = [period('2024.1', 1), period('2024.2', 1), period('2025.1', 2.5), period('2025.2', 3)];
    page.context.renderPeriodRanking({ semesters: list, years: [], minQuestions: 50,
      semesterHighlights: { overallBest: null, bestByHours: null, bestByConsistency: null, bestByAccuracy: null },
      yearHighlights: {} });
    const cells = [...page.get('tbody-period-ranking').innerHTML.matchAll(/>(\d+)º<\/td>/g)].map(m => m[1]);
    assert.deepEqual(cells.reverse(), ['1', '1', '3', '4']);
    assert.match(page.get('tbody-period-ranking').innerHTML, /2025 · 1º sem\./);
    assert.ok(!page.get('tbody-period-ranking').innerHTML.includes('2025.1'));
  });

  it('summarizes the history in three plain-language conclusions', () => {
    const page = dashboard();
    const history = { years: [{ year: 2019, activeDaysCount: 264, accuracy: 74.9 }], peakYear: { year: 2019, hours: 719 } };
    const efficiency = { minQuestions: 50, mostEfficientHour: { hour: 21, label: '21h', accuracy: 78.8, questions: 1484 },
      volumePeakHour: { hour: 6, label: '06h', accuracy: 75 } };
    const q = quadrants(subject());
    q.quadrants.gargalosCriticos = [subject({ name: 'Direito Administrativo', totalHours: 1163.1, accuracy: 56.2 }),
      subject({ name: 'Outra', totalHours: 900, accuracy: 60 })];
    page.context.renderHistoricalConclusions({ history, efficiency, quadrants: q });
    const html = page.get('hist-conclusions-list').innerHTML;
    assert.equal((html.match(/hist-conclusion"/g) || []).length, 3);
    assert.match(html, /2019/);
    assert.match(html, /719,0h líquidas em 264 dias com estudo, com 74,9% de assertividade/);
    assert.match(html, /78,8% de assertividade em 1\.484 questões\. Você estuda mais às 06h/);
    assert.match(html, /Direito Administrativo/);
    assert.match(html, /56,2% de assertividade, abaixo do corte de 75%/);
  });

  it('keeps the conclusions useful with no data and falls back when there is no bottleneck', () => {
    const page = dashboard();
    page.context.renderHistoricalConclusions({ history: { years: [], peakYear: null }, efficiency: null, quadrants: null });
    const html = page.get('hist-conclusions-list').innerHTML;
    assert.match(html, /Sem registros/);
    assert.match(html, /soma 50 questões ou mais/);
    assert.match(html, /Nenhuma por enquanto/);
  });

  it('draws the matrix on the card with uniform quadrant labels, readable point names and one-line advice', () => {
    const page = dashboard();
    const close = ['Direito Constitucional e Administrativo Avançado', 'Língua Portuguesa'].map((name, i) =>
      subject({ name, totalHours: 10 + i * 0.1, accuracy: 80 }));
    const q = quadrants(close[0]);
    q.quadrants.pontosFortes = close;
    q.summary.strongCount = 2;
    page.context.renderQuadrants(q);
    const svg = page.get('quadrants-svg-container').innerHTML;
    for (const label of ['Base sólida', 'Pontos fortes', 'Zona de risco', 'Gargalos críticos'])
      assert.match(svg, new RegExp(`matrix-quadrant-label[^>]*>${label}<`));
    assert.ok(!/BASE S|PONTOS FORTES|ZONA DE RISCO/.test(svg), 'quadrant labels share one casing');
    assert.match(svg, /Direito Constituc…/);
    assert.match(svg, /<title>Direito Constitucional e Administrativo Avançado<\/title>/);
    const ys = [...svg.matchAll(/matrix-dot-label"><title>[^<]*<\/title>[^<]*/g)].length;
    assert.equal(ys, 2);
    const labelY = [...svg.matchAll(/<text x="[\d.]+" y="([\d.]+)"[^>]*class="matrix-dot-label"/g)].map(m => Number(m[1]));
    assert.ok(Math.abs(labelY[0] - labelY[1]) >= 11, 'close points do not overprint their names');
    const panels = page.get('quadrants-breakdown-container').innerHTML;
    assert.equal((panels.match(/class="quadrant-reco"/g) || []).length, 4);
    assert.ok(!panels.includes('engenharia reversa') && !panels.includes('method-alert-box'));
  });

  it('lists the most recent activities first, even when the snapshot arrives oldest first', () => {
    const page = dashboard('2026-09-15T12:00:00');
    const row = (date, time) => ({ ...activity(), DataInicio: date, HoraInicio: time });
    page.run(`fullSnapshot = { atividades: ${JSON.stringify([
      row('03/01/2016', '08:00'), row('15/09/2026', '07:30'), row('15/09/2026', '21:10'), row('02/05/2024', '10:00')
    ])}, materias: [] }; renderActivitiesTable(fullSnapshot.atividades)`);
    const dates = page.get('tbody-activities-list').children.map(tr => tr.innerHTML.match(/<td>([\d/]+)<\/td>\s*<td[^>]*>([\d:]+)/).slice(1).join(' '));
    assert.deepEqual(dates, ['15/09/2026 21:10', '15/09/2026 07:30', '02/05/2024 10:00', '03/01/2016 08:00']);
  });

  it('shows the cached snapshot immediately and refreshes it in the background', async () => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const snapshot = count => ({ user: { Nome: 'Ana', Sobrenome: 'Silva' }, materias: [activity().Materia],
      atividades: Array.from({ length: count }, () => activity()), syncedAt: new Date(Date.now() - 180000).toISOString() });
    const page = dashboard(undefined, { AprovadoApi: {
      checkAuth: async () => ({ isAuthenticated: true }),
      loadSnapshotProgressive: async ({ onCached }) => {
        onCached(snapshot(1));
        await gate;
        return snapshot(2);
      } } });
    page.context.window.chrome = { storage: { local: {} } };
    const started = page.run('init()');
    for (let i = 0; i < 5; i++) await Promise.resolve();
    assert.equal(Number(page.get('dash-total-sessions').textContent), 1);
    assert.equal(page.get('dashboard-loading').classList.contains('hidden'), true);
    assert.match(page.get('user-status-text').textContent, /Atualizado há 3 min · atualizando…/);
    release();
    await started;
    assert.equal(Number(page.get('dash-total-sessions').textContent), 2);
    assert.doesNotMatch(page.get('user-status-text').textContent, /atualizando/);
  });

  it('ranking toggle clicks regroup data without changing the selected view or period', () => {
    const page = dashboard('2026-09-15T12:00:00');
    page.run(`fullSnapshot = { atividades: [
      { Inicio: '2025-03-04T12:00:00', Duracao: 3600000 },
      { Inicio: '2026-08-04T12:00:00', Duracao: 3600000 }
    ], materias: [] }`);
    page.context.setupViewSwitch();
    page.context.setupPeriodRankingToggle();
    page.historical.dispatch('click');
    assert.match(page.get('tbody-period-ranking').innerHTML, /2026 · 2º sem\./);
    page.granularity.year.dispatch('click');
    assert.match(page.get('tbody-period-ranking').innerHTML, /<strong>2026<\/strong>/);
    assert.equal(page.get('tab-overview').classList.contains('hidden'), true);
    assert.equal(page.run('currentPeriod'), 'all');
    assert.equal(page.granularity.year.getAttribute('aria-pressed'), 'true');
    page.granularity.semester.dispatch('click');
    assert.match(page.get('tbody-period-ranking').innerHTML, /2026 · 2º sem\./);
    assert.equal(page.granularity.year.getAttribute('aria-pressed'), 'false');
  });

  it('shows the same four modalities, and the same Teoria, as the methodological mix', () => {
    const page = dashboard();
    page.run(`fullSnapshot = { atividades: [
      { Inicio: '2026-06-01T12:00:00', Duracao: 3600000, TipoEstudo: 'Teoria' },
      { Inicio: '2026-06-02T12:00:00', Duracao: 3600000, TipoEstudo: 'Leitura de lei seca' },
      { Inicio: '2026-06-03T12:00:00', Duracao: 7200000, TipoEstudo: 'Questões' }
    ], materias: [] }; updateDashboard()`);
    const list = page.get('study-types-list');
    const names = list.children.map(row => row.innerHTML.match(/<strong>([^<]+)<\/strong>/)[1]);
    assert.deepEqual(names, ['Teoria', 'Questões', 'Revisão', 'Outros']);
    assert.match(list.children[0].innerHTML, /50,0%/);
    page.run('renderMixAndInsights(computeMethodologicalMix(fullSnapshot.atividades), null)');
    assert.match(page.get('mix-legend').innerHTML, /Teoria: <strong>50,0%<\/strong>/);
  });

  it('subject and modality change events update the overview metrics', () => {
    const page = dashboard();
    page.run(`fullSnapshot = { atividades: [
      { Inicio: '2026-06-01T12:00:00', Duracao: 3600000, Materia: { Id: 1 }, TipoEstudo: 'Leitura' },
      { Inicio: '2026-06-02T12:00:00', Duracao: 3600000, Materia: { Id: 2 }, TipoEstudo: 'Doutrina' }
    ], materias: [] }`);
    const selectSubject = page.get('select-subject');
    selectSubject.value = '2';
    selectSubject.dispatch('change', { target: selectSubject });
    assert.equal(Number(page.get('dash-total-sessions').textContent), 1);
    const selectType = page.get('select-type');
    selectType.value = 'Leitura';
    selectType.dispatch('change', { target: selectType });
    assert.equal(Number(page.get('dash-total-sessions').textContent), 0);
    selectSubject.value = 'all';
    selectSubject.dispatch('change', { target: selectSubject });
    assert.equal(Number(page.get('dash-total-sessions').textContent), 1);
  });

  it('keeps decoded subject markup inert when a matrix tooltip opens', () => {
    const page = dashboard();
    const payload = '<img src=x onerror="globalThis.xss=1"> & "Nome"';
    const dot = element();
    dot.setAttribute('data-name', payload);
    for (const [key, value] of Object.entries({hours: 2, acc: 80, questions: 10, correct: 8}))
      dot.setAttribute(`data-${key}`, value);
    page.get('quadrants-svg-container').querySelectorAll = () => [dot];
    page.context.renderQuadrants(quadrants(subject({ name: payload })));
    dot.dispatch('mouseenter', { clientX: 100, clientY: 100 });
    const tooltip = page.get('heatmap-tooltip').innerHTML;
    assert.ok(!tooltip.includes('<img'), 'Subject markup must not become an HTML element');
    assert.ok(tooltip.includes('&lt;img'));
    assert.ok(tooltip.includes('&amp;'));
  });

  it('rejects attribute and CSS injection in subject colors but preserves valid hex colors', () => {
    const page = dashboard();
    for (const color of ['red" onmouseover="alert(1)', 'red; background-image:url(https://example.invalid/pixel)', 'url(https://example.invalid/pixel)']) {
      const s = subject({ color });
      page.context.renderQuadrants(quadrants(s));
      assert.ok(page.get('quadrants-svg-container').innerHTML.includes('fill="#3b82f6"'));
      assert.ok(!page.context.renderSubjectPills([s]).includes(color));
    }
    assert.ok(page.context.renderSubjectPills([subject({ color: '#ABCDEF' })]).includes('#ABCDEF'));
  });

  it('uses the existing high, medium and low accuracy badge styles', () => {
    const page = dashboard();
    for (const [accuracy, expected] of [[90, 'accuracy-high'], [70, 'accuracy-mid'], [60, 'accuracy-low']]) {
      const html = page.context.renderSubjectPills([subject({ accuracy })]);
      assert.ok(html.includes(`accuracy-badge ${expected}`), html);
    }
  });

  it('reuses historical results for unchanged inputs and refreshes after synchronization', () => {
    const page = dashboard();
    const activities = [activity()];
    const materias = [activity().Materia];
    page.context.renderHistoricalPatternsTab(activities, materias);
    const first = page.run('cachedHistoricalPatterns');
    page.context.renderHistoricalPatternsTab(activities, materias);
    assert.equal(page.run('cachedHistoricalPatterns'), first, 'Switching tabs should reuse computed results');
    page.context.renderHistoricalPatternsTab([activity(2)], materias);
    assert.notEqual(page.run('cachedHistoricalPatterns'), first);
    assert.equal(page.get('hist-total-hours-decimal').textContent, '2,0 horas líquidas');
  });

  it('uses newly synchronized activities when the heatmap year changes', () => {
    const page = dashboard();
    const materias = [activity().Materia];
    page.context.renderHistoricalPatternsTab([activity()], materias);
    page.context.renderHistoricalPatternsTab([activity(2)], materias);
    const select = page.get('heatmap-year-select');
    select.value = '2026';
    select.dispatch('change');
    assert.ok(page.get('heatmap-kpi-hours').textContent.startsWith('2,0h'));
  });

  it('shows the current year and 366 days when opened in leap year 2028', () => {
    const page = dashboard('2028-06-01T12:00:00');
    page.context.renderHistoricalPatternsTab([activity()], [activity().Materia]);
    assert.equal(page.get('heatmap-year-select').value, '2028');
    assert.equal(page.get('historical-section-title').textContent, 'Histórico multianual e fases de estudo (2016 – 2028)');
    assert.ok(page.get('heatmap-kpi-days').textContent.endsWith('366 dias'));
  });

  it('refreshes current-year phase classification after local midnight', () => {
    const clock = { value: '2028-03-10T12:00:00' };
    const page = dashboard(clock);
    const RealDate = globalThis.Date;
    const activities = Array.from({ length: 20 }, (_, i) => ({
      ...activity(3.36), Inicio: `2028-01-${String(i + 1).padStart(2, '0')}T12:00:00`
    }));
    const materias = [activity().Materia];
    try {
      globalThis.Date = page.context.Date;
      page.context.renderHistoricalPatternsTab(activities, materias);
      assert.equal(page.run('cachedHistoricalPatterns.history.years.at(-1).phase'), 'ALTA_INTENSIDADE');
      clock.value = '2028-03-11T12:00:00';
      page.context.renderHistoricalPatternsTab(activities, materias);
      assert.equal(page.run('cachedHistoricalPatterns.history.years.at(-1).phase'), 'MANUTENCAO');
    } finally {
      globalThis.Date = RealDate;
    }
  });

  it('keeps the selected heatmap year when revisiting the tab or syncing', () => {
    const page = dashboard();
    const activities = [activity()];
    const materias = [activity().Materia];
    page.context.renderHistoricalPatternsTab(activities, materias);
    const select = page.get('heatmap-year-select');
    select.value = '2024'; select.dispatch('change');
    page.context.renderHistoricalPatternsTab(activities, materias);
    assert.equal(select.value, '2024');
    page.context.renderHistoricalPatternsTab([activity(2)], materias);
    assert.equal(select.value, '2024');
    assert.ok(page.get('heatmap-kpi-days').textContent.endsWith('366 dias'));
  });

  it('switches between the overview and the historical analysis view', () => {
    const page = dashboard();
    page.run(`fullSnapshot = { atividades: [], materias: [] }`);
    page.context.setView('historical');
    assert.equal(page.get('tab-overview').classList.contains('hidden'), true);
    assert.equal(page.get('tab-historical-patterns').classList.contains('hidden'), false);
    assert.equal(page.get('custom-date-container').classList.contains('hidden'), true);
    assert.ok(page.run('cachedHistoricalPatterns'), 'Opening the view should compute the analysis');
    page.context.setView('overview');
    assert.equal(page.get('tab-overview').classList.contains('hidden'), false);
    assert.equal(page.get('tab-historical-patterns').classList.contains('hidden'), true);
  });

  it('renders the new historical sections and toggles semester/year ranking', () => {
    const page = dashboard('2026-09-15T12:00:00');
    const activities = [
      { ...activity(1), Inicio: '2025-03-04T20:00:00', ExercicioQuantidade: 60, ExercicioAcerto: 48 },
      { ...activity(2), Inicio: '2026-08-04T09:00:00', ExercicioQuantidade: 60, ExercicioAcerto: 54 }
    ];
    page.context.renderHistoricalPatternsTab(activities, [activity().Materia]);
    assert.match(page.get('tbody-period-ranking').innerHTML, /2026 · 2º sem\./);
    assert.match(page.get('tbody-period-ranking').innerHTML, /em andamento/);
    assert.match(page.get('hour-weekday-container').innerHTML, /hw-cell level-4/);
    assert.match(page.get('session-buckets-container').innerHTML, /1–1,5h/);
    assert.match(page.get('circadian-efficiency-note').innerHTML, /09h/);
    page.run(`currentPeriodGranularity = 'year'`);
    page.context.renderPeriodRanking(page.run('cachedHistoricalPatterns.semesters'));
    assert.match(page.get('tbody-period-ranking').innerHTML, /<strong>2025<\/strong>/);
  });

  it('shows a reliable shift even when individual hours lack enough questions', () => {
    const page = dashboard();
    const activities = [6, 7, 8, 9, 10].map(hour => ({
      ...activity(), Inicio: `2026-06-01T${String(hour).padStart(2, '0')}:00:00`,
      ExercicioQuantidade: 10, ExercicioAcerto: 9
    }));
    page.context.renderHistoricalPatternsTab(activities, [activity().Materia]);
    const note = page.get('circadian-efficiency-note');
    const text = note.innerHTML || note.textContent;
    assert.match(text, /pelo menos 50 questões/);
    assert.match(text, /Turno mais eficiente: <strong>Manhã<\/strong> \(90,0%\)/);
    assert.doesNotMatch(text, /Melhor assertividade às|Maior volume às|p\.p\./);
  });

  it('escapes subject text and colors in the overview as well as the matrix', () => {
    const page = dashboard();
    const payload = '<img src=x onerror="globalThis.xss=1">';
    page.context.renderSubjectsSummary([{ ...subject({ name: payload, color: 'red" onclick="bad()' }),
      formattedHours: '2,0h', percentage: 100, sessionsCount: 1 }]);
    const html = page.get('tbody-subjects-summary').children[0].innerHTML;
    assert.ok(!html.includes('<img'));
    assert.ok(!html.includes('onclick='));
    assert.ok(html.includes('&lt;img'));
  });

  it('clears previous historical results when synchronization returns an empty history', () => {
    const page = dashboard();
    page.context.renderHistoricalPatternsTab([activity()], [activity().Materia]);
    page.context.renderHistoricalPatternsTab([], []);
    assert.equal(page.get('hist-total-hours-decimal').textContent, '0,0 horas líquidas');
    assert.equal(page.get('heatmap-kpi-days').textContent.startsWith('0 de '), true);
  });
});

function deferredLoad() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const settleLoads = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const accountSnapshot = id => ({ user: { Id: id, Nome: `Account ${id}` }, materias: [activity().Materia],
  atividades: [activity(id)], syncedAt: '2026-11-03T12:00:00Z' });
function requestOrderPage(api, boundary = {}) {
  const downloads = [];
  const page = dashboard(null, { console: { error() {} }, AprovadoApi: api,
    AprovadoExport: { exportFullBackupJSON: value => downloads.push(value) }, ...boundary });
  page.context.window.chrome = { storage: { local: {} } };
  return { ...page, downloads };
}
async function assertAccount(page, id) {
  assert.equal(page.run('fullSnapshot.user.Id'), id);
  assert.equal(page.get('user-display-name').textContent, `Account ${id}`);
  assert.equal(page.get('hist-total-hours-decimal').textContent, `${id},0 horas líquidas`);
  assert.equal(page.run('backgroundRefresh'), false);
  assert.doesNotMatch(page.get('user-status-text').textContent, /atualizando/);
  await page.get('export-json-backup').dispatch('click');
  assert.equal(page.downloads.at(-1).user.Id, id);
}

describe('Dashboard request ordering', () => {
  for (const fail of [false, true]) for (const early of [false, true]) {
    it(`ignores obsolete progressive ${fail ? 'failure' : 'success'} ${early ? 'before' : 'after'} manual completion`, async () => {
      const old = deferredLoad(), fresh = deferredLoad();
      let cached;
      const page = requestOrderPage({ checkAuth: async () => ({ isAuthenticated: true }),
        loadSnapshotProgressive: ({ onCached }) => { cached = onCached; onCached(accountSnapshot(1)); return old.promise; },
        fetchCompleteSnapshot: () => fresh.promise });
      const initial = page.run('init()');
      await settleLoads();
      const manual = page.get('btn-sync-now').dispatch('click');
      const completeOld = async () => {
        cached(accountSnapshot(1));
        if (fail) old.reject(new Error('Old request failed')); else old.resolve(accountSnapshot(1));
        await initial;
      };
      if (early) {
        await completeOld();
        assert.equal(page.get('btn-sync-now').disabled, true);
        assert.equal(page.get('dashboard-loading').classList.contains('hidden'), false);
        assert.equal(page.get('alert-disconnected').classList.contains('hidden'), true);
      }
      fresh.resolve(accountSnapshot(2)); await manual;
      if (!early) await completeOld();
      await assertAccount(page, 2);
      assert.equal(page.get('btn-sync-now').disabled, false);
    });
  }

  it('does not restore old cache or success after a newer failure and recovers with new data', async () => {
    const old = deferredLoad(); let cached;
    const page = requestOrderPage({ checkAuth: async () => ({ isAuthenticated: true }),
      loadSnapshotProgressive: ({ onCached }) => { cached = onCached; onCached(accountSnapshot(1)); return old.promise; },
      fetchCompleteSnapshot: async () => { throw new Error('New request failed'); } });
    const initial = page.run('init()'); await settleLoads();
    await page.get('btn-sync-now').dispatch('click');
    cached(accountSnapshot(1)); old.resolve(accountSnapshot(1)); await initial;
    assert.equal(page.run('fullSnapshot'), null);
    assert.equal(page.run('backgroundRefresh'), false);
    assert.equal(page.get('btn-export-dropdown').disabled, true);
    await page.get('export-json-backup').dispatch('click'); assert.equal(page.downloads.length, 0);
    page.context.AprovadoApi.fetchCompleteSnapshot = async () => accountSnapshot(2);
    await page.get('btn-sync-now').dispatch('click'); await assertAccount(page, 2);
  });

  for (const fail of [false, true]) {
    it(`ignores old manual ${fail ? 'failure' : 'success'} after a newer init`, async () => {
      const old = deferredLoad();
      const page = requestOrderPage({ checkAuth: async () => ({ isAuthenticated: true }),
        loadSnapshotProgressive: async () => accountSnapshot(2), fetchCompleteSnapshot: () => old.promise });
      const manual = page.get('btn-sync-now').dispatch('click');
      await page.run('init()');
      assert.equal(page.get('btn-sync-now').disabled, false, 'new init owns the button state');
      if (fail) old.reject(new Error('Old manual failed')); else old.resolve(accountSnapshot(1));
      await manual; await assertAccount(page, 2);
    });
  }

  for (const authenticated of [false, true]) {
    it(`ignores obsolete authentication result ${authenticated}`, async () => {
      const auth = deferredLoad(); let progressiveCalls = 0;
      const page = requestOrderPage({ checkAuth: () => auth.promise,
        loadSnapshotProgressive: async () => { progressiveCalls++; return accountSnapshot(1); },
        fetchCompleteSnapshot: async () => accountSnapshot(2) });
      const initial = page.run('init()');
      await page.get('btn-sync-now').dispatch('click');
      auth.resolve({ isAuthenticated: authenticated }); await initial;
      assert.equal(progressiveCalls, 0); await assertAccount(page, 2);
    });
  }

  for (const fail of [false, true]) for (const manualMock of [false, true]) {
    it(`ignores obsolete mock ${manualMock ? 'manual' : 'initial'} ${fail ? 'failure' : 'success'} after real data`, async () => {
      const mock = deferredLoad();
      const page = requestOrderPage({ checkAuth: async () => ({ isAuthenticated: true }),
        loadSnapshotProgressive: async () => accountSnapshot(2), fetchCompleteSnapshot: async () => accountSnapshot(2) },
      { fetch: () => mock.promise });
      page.location.search = '?mock=true';
      const initial = manualMock ? page.get('btn-sync-now').dispatch('click') : page.run('init()');
      page.location.search = '';
      if (manualMock) await page.run('init()'); else await page.get('btn-sync-now').dispatch('click');
      if (fail) mock.reject(new Error('Mock failed'));
      else mock.resolve({ ok: true, json: async () => accountSnapshot(1) });
      await initial; await assertAccount(page, 2);
      assert.equal(page.run('usingMockData'), false);
      assert.equal(page.get('mock-banner').classList.contains('hidden'), true);
    });
  }

  it('keeps newer account UI and exports when an actual API storage write completes late', async () => {
    const pendingWrite = deferredLoad(), writeStarted = deferredLoad();
    let owner = 1, storage = {};
    const chrome = { storage: { local: {
      get: async () => storage,
      set: async values => {
        if (values.aprovado_data_snapshot.user.Id === 1) { writeStarted.resolve(); await pendingWrite.promise; }
        storage = values;
      }
    } } };
    const page = requestOrderPage({}, { chrome, fetch: async url => {
      const payload = url.endsWith('Usuario/Obter') ? accountSnapshot(owner).user
        : url.endsWith('Atividade/Listar') ? accountSnapshot(owner).atividades
        : url.endsWith('Materia/Listar') ? accountSnapshot(owner).materias : [];
      return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
    } });
    page.context.window.chrome = chrome;
    const apiSource = readFileSync(new URL('../shared/api.js', import.meta.url), 'utf8')
      .replace(/^import[^\n]+\n/gm, '').replace('export const AprovadoApi', 'globalThis.AprovadoApi');
    page.run(apiSource);
    const initial = page.run('init()'); await writeStarted.promise;
    owner = 2; await page.get('btn-sync-now').dispatch('click');
    pendingWrite.resolve(); await initial;
    await assertAccount(page, 2);
    assert.equal(storage.aprovado_data_snapshot.user.Id, 1, 'the simulated old write actually completed last');
    assert.equal(await page.context.AprovadoApi.getCachedSnapshotForUser(accountSnapshot(2).user), null);
    const next = await page.context.AprovadoApi.fetchCompleteSnapshot();
    assert.equal(next.user.Id, 2);
    assert.equal(next.atividades[0].Duracao, 7200000);
  });
});

describe('Integrated search and account isolation', () => {
  it('revokes searched cache after failure, ignores its late completion and restores all exports with only the new account', async () => {
    const oldLoad = deferredLoad();
    let cachedCallback, failCurrent = true;
    const snapshotFor = id => ({ user: { Id: id, Nome: `Synthetic ${id}` },
      materias: [activity().Materia, { Id: 2, Nome: 'História' }],
      atividades: [
        { ...activity(1), Id: id * 10 + 1 },
        { ...activity(2), Id: id * 10 + 2, Materia: { Id: 2, Nome: 'História' } }
      ], syncedAt: '2026-06-02T12:00:00Z' });
    const exports = [];
    const page = dashboard('2026-06-02T12:00:00', { console: { error() {} }, setTimeout: () => {},
      AprovadoApi: {
        checkAuth: async () => ({ isAuthenticated: true }),
        loadSnapshotProgressive: ({ onCached }) => {
          cachedCallback = onCached; onCached(snapshotFor(7)); return oldLoad.promise;
        },
        fetchCompleteSnapshot: async () => {
          if (failCurrent) throw new Error('Synthetic current failure');
          return snapshotFor(8);
        }
      },
      AprovadoExport: Object.fromEntries(['exportActivitiesCSV', 'exportSubjectsSummaryCSV', 'exportFullBackupJSON', 'copyReportToClipboard']
        .map(method => [method, (...args) => { exports.push({ method, args }); }]))
    });
    page.context.window.chrome = { storage: { local: {} } };
    const initial = page.run('init()');
    await settleLoads();
    await page.tabs.activities.dispatch('click');
    const search = page.get('input-search-activities');
    search.value = 'Matemática'; await search.dispatch('input', { target: search });
    assert.equal(page.get('tbody-activities-list').children.length, 1);
    assert.equal(Number(page.get('dash-total-sessions').textContent), 2);
    await page.get('export-csv-activities').dispatch('click');
    assert.deepEqual(Array.from(exports.at(-1).args[0], a => a.Id), [71]);
    await page.tabs.overview.dispatch('click');
    await page.get('export-csv-activities').dispatch('click');
    assert.deepEqual(Array.from(exports.at(-1).args[0], a => a.Id), [71, 72]);
    exports.length = 0;

    await page.get('btn-sync-now').dispatch('click');
    cachedCallback(snapshotFor(7)); oldLoad.resolve(snapshotFor(7)); await initial;
    assert.equal(page.run('fullSnapshot'), null);
    assert.equal(page.run('activitiesSearchQuery'), '');
    assert.equal(search.value, '');
    assert.equal(page.get('btn-export-dropdown').disabled, true);
    for (const id of ['export-csv-activities', 'export-csv-subjects', 'export-json-backup', 'export-copy-md']) {
      await page.get(id).dispatch('click');
    }
    assert.equal(exports.length, 0);

    failCurrent = false;
    await page.get('btn-sync-now').dispatch('click');
    for (const id of ['export-csv-activities', 'export-csv-subjects', 'export-json-backup', 'export-copy-md']) {
      await page.get(id).dispatch('click');
    }
    assert.equal(exports.length, 4);
    assert.deepEqual(Array.from(exports.find(e => e.method === 'exportActivitiesCSV').args[0], a => a.Id), [81, 82]);
    assert.equal(exports.find(e => e.method === 'exportSubjectsSummaryCSV').args[0].length, 2);
    assert.equal(exports.find(e => e.method === 'exportFullBackupJSON').args[0].user.Id, 8);
    const report = exports.find(e => e.method === 'copyReportToClipboard');
    assert.equal(report.args[0].totalSessions, 2);
    assert.equal(report.args[1].Id, 8);
    await page.tabs.activities.dispatch('click');
    search.value = 'História'; await search.dispatch('input', { target: search });
    await page.get('export-csv-activities').dispatch('click');
    assert.deepEqual(Array.from(exports.at(-1).args[0], a => a.Id), [82]);
    await page.tabs.overview.dispatch('click');
    assert.equal(Number(page.get('dash-total-sessions').textContent), 2);
    await page.get('export-csv-activities').dispatch('click');
    assert.deepEqual(Array.from(exports.at(-1).args[0], a => a.Id), [81, 82]);
  });
});

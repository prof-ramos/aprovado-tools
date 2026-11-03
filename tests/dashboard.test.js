import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as analytics from '../shared/analytics.js';
import * as ui from '../shared/ui.js';

// Keep the actual renderers and analytics; replace only the browser boundary.
function element() {
  const listeners = new Map();
  const attributes = new Map();
  const classes = new Set();
  let html = '';
  return {
    children: [], style: {}, value: '', textContent: '',
    classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x),
      toggle: (x, on) => on ? classes.add(x) : classes.delete(x) },
    addEventListener(name, callback) {
      const handlers = listeners.get(name) || [];
      handlers.push(callback); listeners.set(name, handlers);
    },
    dispatch(name, event = {}) { this[`on${name}`]?.(event); for (const fn of listeners.get(name) || []) fn(event); },
    setAttribute: (key, value) => attributes.set(key, String(value)),
    getAttribute: key => attributes.get(key),
    querySelectorAll: () => [],
    appendChild(child) { this.children.push(child); },
    set innerHTML(value) { html = value; this.children = []; },
    get innerHTML() { return html; }
  };
}

function dashboard(now) {
  const Clock = now ? class extends Date {
    constructor(...args) { super(...(args.length ? args : [typeof now === 'object' ? now.value : now])); }
    static now() { return new Clock(typeof now === 'object' ? now.value : now).getTime(); }
  } : Date;
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  };
  const context = vm.createContext({ ...analytics, ...ui, console, setTimeout, Date: Clock,
    document: { readyState: 'loading', getElementById: get, querySelectorAll: () => [],
      querySelector: () => null, createElement: element, addEventListener() {} },
    window: { innerWidth: 1200, location: { search: '' } }
  });
  const source = readFileSync(new URL('../dashboard/dashboard.js', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '');
  vm.runInContext(source, context);
  return { get, context, run: source => vm.runInContext(source, context) };
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
    assert.equal(page.get('hist-total-hours-decimal').textContent, '2.0 horas líquidas');
  });

  it('uses newly synchronized activities when the heatmap year changes', () => {
    const page = dashboard();
    const materias = [activity().Materia];
    page.context.renderHistoricalPatternsTab([activity()], materias);
    page.context.renderHistoricalPatternsTab([activity(2)], materias);
    const select = page.get('heatmap-year-select');
    select.value = '2026';
    select.dispatch('change');
    assert.ok(page.get('heatmap-kpi-hours').textContent.startsWith('2.0h'));
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
    assert.match(page.get('tbody-period-ranking').innerHTML, /2026\.2/);
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
    assert.match(text, /Turno mais eficiente: <strong>Manhã<\/strong> \(90\.0%\)/);
    assert.doesNotMatch(text, /Melhor assertividade às|Maior volume às|p\.p\./);
  });

  it('escapes subject text and colors in the overview as well as the matrix', () => {
    const page = dashboard();
    const payload = '<img src=x onerror="globalThis.xss=1">';
    page.context.renderSubjectsSummary([{ ...subject({ name: payload, color: 'red" onclick="bad()' }),
      formattedHours: '2.0h', percentage: 100, sessionsCount: 1 }]);
    const html = page.get('tbody-subjects-summary').children[0].innerHTML;
    assert.ok(!html.includes('<img'));
    assert.ok(!html.includes('onclick='));
    assert.ok(html.includes('&lt;img'));
  });

  it('clears previous historical results when synchronization returns an empty history', () => {
    const page = dashboard();
    page.context.renderHistoricalPatternsTab([activity()], [activity().Materia]);
    page.context.renderHistoricalPatternsTab([], []);
    assert.equal(page.get('hist-total-hours-decimal').textContent, '0.0 horas líquidas');
    assert.equal(page.get('heatmap-kpi-days').textContent.startsWith('0 de '), true);
  });
});

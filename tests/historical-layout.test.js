import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { formatPeriodLabel } from '../shared/analytics.js';

const html = fs.readFileSync(new URL('../dashboard/dashboard.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../dashboard/dashboard.css', import.meta.url), 'utf8');
const historical = html.slice(html.indexOf('id="tab-historical-patterns"'));

const sections = [...historical.matchAll(/<details class="chart-card[^"]*hist-collapsible"( open)?>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/g)]
  .map(m => ({ title: m[2], open: Boolean(m[1]) }));

test('analysis sections are collapsible with the main ones open and the rest closed', () => {
  assert.equal(sections.length, 11);
  const open = sections.filter(s => s.open).map(s => s.title.replace(/\s+/g, ' '));
  assert.deepEqual(open, ['Melhor ano e semestre', 'Histórico multianual e fases de estudo',
    'Matriz de rendimento: tempo investido × assertividade', 'Mix metodológico de estudo']);
  const closed = sections.filter(s => !s.open).map(s => s.title);
  assert.ok(closed.includes('Síntese analítica de padrões'));
  assert.equal(closed.length, 7);
  assert.equal((historical.match(/<summary class="card-title-bar">/g) || []).length, 11);
  assert.equal((historical.match(/<\/summary>/g) || []).length, 11);
  assert.equal((historical.match(/<details\b/g) || []).length, (historical.match(/<\/details>/g) || []).length);
});

test('the shared tooltip lives outside the collapsible blocks and the conclusions come first', () => {
  const tooltip = historical.indexOf('id="heatmap-tooltip"');
  const lastDetailsEnd = historical.lastIndexOf('</details>');
  assert.ok(tooltip > lastDetailsEnd, 'a closed block must not hide the tooltip');
  assert.ok(historical.indexOf('id="hist-conclusions"') < historical.indexOf('hist-kpi-banner'));
  assert.ok(!historical.includes('class="analytics-grid">\n          <details class="chart-card hist-collapsible" open>'),
    'mix and synthesis are stacked, not beside an empty column');
});

test('the ranking column and phase legend are explained in plain words', () => {
  assert.ok(!html.includes('Posição geral'));
  assert.match(html, /Ranking do semestre/);
  assert.match(html, /id="phase-legend"[\s\S]*Alta intensidade[\s\S]*Manutenção[\s\S]*Hiato/);
});

test('semester keys read as "2019 · 1º sem." while years and other labels pass through', () => {
  assert.equal(formatPeriodLabel('2019.1'), '2019 · 1º sem.');
  assert.equal(formatPeriodLabel('2026.2'), '2026 · 2º sem.');
  assert.equal(formatPeriodLabel('2019'), '2019');
  assert.equal(formatPeriodLabel(null), '');
  assert.equal(formatPeriodLabel('2019.3'), '2019.3');
});

// WCAG relative luminance and contrast ratio.
const channel = c => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const luminance = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b); };
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const token = name => css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))[1];

test('secondary text tokens reach 4.5:1 on every surface used by the dashboard', () => {
  const surfaces = ['bg-color', 'surface-bg', 'surface-hover', 'surface-raised'].map(token);
  for (const name of ['text-main', 'text-muted', 'text-faint']) {
    for (const surface of surfaces) {
      const ratio = contrast(token(name), surface);
      assert.ok(ratio >= 4.5, `--${name} on ${surface} is ${ratio.toFixed(2)}:1`);
    }
  }
});

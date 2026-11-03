import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatNumber, formatPercent, formatHours } from '../shared/format.js';
import { severityLabel } from '../shared/analytics.js';

test('numbers use pt-BR decimal comma and thousands dot', () => {
  assert.equal(formatNumber(1234.56, 1), '1.234,6');
  assert.equal(formatNumber(3008, 0), '3.008');
  assert.equal(formatNumber(0.05, 1), '0,1');
  assert.equal(formatNumber(74.25, 1), '74,3');
  assert.equal(formatNumber(5, 1), '5,0');
});

test('percent and hours append their unit after the pt-BR number', () => {
  assert.equal(formatPercent(74.3), '74,3%');
  assert.equal(formatPercent(100, 0), '100%');
  assert.equal(formatHours(4460.14), '4.460,1h');
});

test('missing or non-finite values render as an em dash', () => {
  for (const value of [null, undefined, NaN, Infinity, 'abc']) {
    assert.equal(formatNumber(value), '—');
    assert.equal(formatPercent(value), '—');
    assert.equal(formatHours(value), '—');
  }
});

test('severity labels are Portuguese and unknown values fall back to information', () => {
  assert.equal(severityLabel('success'), 'Ponto forte');
  assert.equal(severityLabel('critical'), 'Prioridade');
  assert.equal(severityLabel('warning'), 'Atenção');
  assert.equal(severityLabel('whatever'), 'Informação');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCycleNotStarted, computeStudyMetrics } from '../shared/analytics.js';

const cycle = overrides => computeStudyMetrics([], [], {
  TotalHoras: 100, TotalHorasExecutadas: 0, TotalHorasRestantes: 100, TotalPorcentagem: 0,
  Materias: [{ Nome: 'Português', HorasExecutadas: 0 }, { Nome: 'Informática', HorasExecutadas: 0 }], ...overrides
}).ciclo;

test('a cycle with every subject at 0h is a new round', () => {
  assert.equal(isCycleNotStarted(cycle()), true);
});

test('any executed hour, percentage or subject time means the cycle already started', () => {
  assert.equal(isCycleNotStarted(cycle({ TotalHorasExecutadas: 2 })), false);
  assert.equal(isCycleNotStarted(cycle({ TotalPorcentagem: 12.5 })), false);
  assert.equal(isCycleNotStarted(cycle({ Materias: [{ Nome: 'Português', HorasExecutadas: 3600 }] })), false);
});

test('without a cycle there is nothing to explain', () => {
  assert.equal(isCycleNotStarted(null), false);
  assert.equal(isCycleNotStarted(undefined), false);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterActivitiesByPeriod } from '../shared/analytics.js';

const at = (daysAgo, hour) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const start = d => d.toISOString();

test('today keeps only sessions that started on the current calendar day', () => {
  const activities = [
    { Id: 1, Inicio: start(at(0, 0)) },
    { Id: 2, Inicio: start(at(1, 23)) },
    { Id: 3, Inicio: start(at(3, 10)) }
  ];
  const ids = filterActivitiesByPeriod(activities, 'today').map(a => a.Id);
  assert.deepEqual(ids, [1]);
  assert.deepEqual(filterActivitiesByPeriod(activities, '7d').map(a => a.Id), [1, 2, 3]);
});

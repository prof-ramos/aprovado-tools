import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRelativeTime, formatSyncLabel } from '../shared/format.js';

// Local-time dates keep these cases stable in any TZ.
const local = (y, m, d, h = 0, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s).getTime();

test('relative time reads naturally in pt-BR', () => {
  const now = local(2026, 11, 3, 15, 0, 0);
  assert.equal(formatRelativeTime(now - 20 * 1000, now), 'agora há pouco');
  assert.equal(formatRelativeTime(now - 59 * 1000, now), 'agora há pouco');
  assert.equal(formatRelativeTime(now - 60 * 1000, now), 'há 1 min');
  assert.equal(formatRelativeTime(now - 3 * 60 * 1000 - 20000, now), 'há 3 min');
  assert.equal(formatRelativeTime(now - 59 * 60 * 1000, now), 'há 59 min');
  assert.equal(formatRelativeTime(now - 60 * 60 * 1000, now), 'há 1 h');
  assert.equal(formatRelativeTime(now - 2.5 * 60 * 60 * 1000, now), 'há 2 h');
  assert.equal(formatRelativeTime(now - 14 * 60 * 60 * 1000, now), 'há 14 h');
});

test('relative time switches to yesterday and then to a date', () => {
  const now = local(2026, 11, 3, 15, 0);
  assert.equal(formatRelativeTime(local(2026, 11, 2, 14, 0), now), 'ontem');
  assert.equal(formatRelativeTime(local(2026, 11, 2, 1, 0), now), 'ontem');
  assert.equal(formatRelativeTime(local(2026, 11, 1, 23, 0), now), '01/11/2026');
  assert.equal(formatRelativeTime(local(2025, 3, 9, 8, 0), now), '09/03/2025');
});

test('relative time accepts ISO strings, tolerates clock skew and rejects invalid input', () => {
  const now = local(2026, 11, 3, 15, 0);
  assert.equal(formatRelativeTime(new Date(now - 5 * 60 * 1000).toISOString(), now), 'há 5 min');
  assert.equal(formatRelativeTime(now + 5 * 60 * 1000, now), 'agora há pouco');
  for (const value of [null, undefined, NaN, 'x']) assert.equal(formatRelativeTime(value, now), '—');
});

test('sync label says when the data was last updated', () => {
  const now = local(2026, 11, 3, 15, 0);
  assert.equal(formatSyncLabel(now - 3 * 60 * 1000, now), 'Atualizado há 3 min');
  assert.equal(formatSyncLabel(now - 5 * 1000, now), 'Atualizado agora há pouco');
  assert.equal(formatSyncLabel(local(2026, 11, 2, 9, 0), now), 'Atualizado ontem');
  assert.equal(formatSyncLabel(local(2026, 10, 20, 9, 0), now), 'Atualizado em 20/10/2026');
  assert.equal(formatSyncLabel(null, now), 'Ainda não sincronizado');
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildTimelineSeries, timelineRange } from '../shared/analytics.js';

const day = (date, hours, count = 1, questions = 0) => ({ date, ms: hours * 3600000, hours: hours.toFixed(2), count, questions });

describe('buildTimelineSeries', () => {
  it('groups by day up to 45 days and fills days without study with zero', () => {
    const history = [day('2026-10-21', 1), day('2026-10-26', 2, 2, 5)];
    const { granularity, buckets } = buildTimelineSeries(history, { start: '2026-10-20', end: '2026-10-27' });
    assert.equal(granularity, 'day');
    assert.deepEqual(buckets.map(b => b.key), ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']);
    assert.deepEqual(buckets.map(b => b.hours), [0, 1, 0, 0, 0, 0, 2, 0]);
    assert.equal(buckets[6].sessions, 2);
    assert.equal(buckets[6].questions, 5);
    assert.equal(buckets[0].studyDays, 0);
  });

  it('uses exactly 45 days as the last day-by-day span and 46 as the first weekly one', () => {
    assert.equal(buildTimelineSeries([], { start: '2026-01-01', end: '2026-02-14' }).granularity, 'day');
    assert.equal(buildTimelineSeries([], { start: '2026-01-01', end: '2026-02-14' }).buckets.length, 45);
    assert.equal(buildTimelineSeries([], { start: '2026-01-01', end: '2026-02-15' }).granularity, 'week');
  });

  it('groups by Monday-to-Sunday weeks and sums sessions, hours and study days', () => {
    // 2026-03-02 is a Monday.
    const history = [day('2026-03-02', 1), day('2026-03-08', 2, 3), day('2026-03-09', 4), day('2026-04-20', 0.5)];
    const { granularity, buckets } = buildTimelineSeries(history, { start: '2026-03-02', end: '2026-04-26' });
    assert.equal(granularity, 'week');
    assert.equal(buckets.length, 8);
    assert.deepEqual(buckets[0], { key: '2026-03-02', start: '2026-03-02', end: '2026-03-08', ms: 3 * 3600000, sessions: 4, questions: 0, studyDays: 2, hours: 3 });
    assert.equal(buckets[1].hours, 4);
    assert.equal(buckets[2].hours, 0);
    assert.equal(buckets[7].hours, 0.5);
  });

  it('starts a week on the Monday before a range that begins mid-week', () => {
    const { buckets } = buildTimelineSeries([day('2026-03-04', 1)], { start: '2026-03-04', end: '2026-05-31' });
    assert.equal(buckets[0].start, '2026-03-02');
    assert.equal(buckets[0].end, '2026-03-08');
    assert.equal(buckets[0].hours, 1);
  });

  it('groups by month beyond a year, keeping empty months and the real month bounds', () => {
    const history = [day('2024-01-31', 1), day('2024-03-01', 2), day('2026-10-05', 3)];
    const { granularity, buckets } = buildTimelineSeries(history);
    assert.equal(granularity, 'month');
    assert.equal(buckets.length, 34);
    assert.equal(buckets[0].key, '2024-01');
    assert.equal(buckets[0].end, '2024-01-31');
    assert.equal(buckets[1].end, '2024-02-29');
    assert.equal(buckets[1].hours, 0);
    assert.equal(buckets[2].hours, 2);
    assert.equal(buckets[33].key, '2026-10');
  });

  it('keeps a year on weeks (366 days) and moves to months at 367', () => {
    assert.equal(buildTimelineSeries([], { start: '2025-01-01', end: '2026-01-01' }).granularity, 'week');
    assert.equal(buildTimelineSeries([], { start: '2025-01-01', end: '2026-01-02' }).granularity, 'month');
  });

  it('does not change its input and handles empty or inverted ranges', () => {
    const history = [day('2026-10-21', 1)];
    const copy = JSON.parse(JSON.stringify(history));
    buildTimelineSeries(history, { start: '2026-10-01', end: '2026-10-31' });
    assert.deepEqual(history, copy);
    assert.deepEqual(buildTimelineSeries([], {}), { granularity: 'day', buckets: [] });
    assert.deepEqual(buildTimelineSeries(history, { start: '2026-10-31', end: '2026-10-01' }).buckets, []);
  });
});

describe('timelineRange', () => {
  const today = new Date(2026, 9, 28, 15, 0, 0);
  const history = [day('2025-02-10', 1), day('2026-10-20', 1)];

  it('matches the period filters: N days back through today', () => {
    assert.deepEqual(timelineRange('7d', history, null, null, today), { start: '2026-10-21', end: '2026-10-28' });
    assert.deepEqual(timelineRange('30d', history, null, null, today), { start: '2026-09-28', end: '2026-10-28' });
    assert.deepEqual(timelineRange('90d', history, null, null, today), { start: '2026-07-30', end: '2026-10-28' });
    assert.deepEqual(timelineRange('this_year', history, null, null, today), { start: '2026-01-01', end: '2026-10-28' });
  });

  it('uses the first and last day with data for "all"', () => {
    assert.deepEqual(timelineRange('all', history, null, null, today), { start: '2025-02-10', end: '2026-10-20' });
    assert.deepEqual(timelineRange('all', [], null, null, today), { start: null, end: null });
  });

  it('uses the custom dates, falling back to the data and to today', () => {
    assert.deepEqual(timelineRange('custom', history, '2026-10-01', '2026-10-15', today), { start: '2026-10-01', end: '2026-10-15' });
    assert.deepEqual(timelineRange('custom', history, '2026-10-01', '', today), { start: '2026-10-01', end: '2026-10-28' });
    assert.deepEqual(timelineRange('custom', history, '', '', today), { start: '2025-02-10', end: '2026-10-20' });
  });
});

/**
 * tests/heatmap.test.js
 *
 * Test suite for GitHub-Style Annual Activity Heatmap Engine.
 * Verifies Tier 1 (Happy Path, 5-level scale, 53/54 weeks) & Tier 2 (Leap years, 365 vs 366 days, edge padding).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeActivityHeatmap } from '../shared/analytics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'multiannual_mock_2016_2026.json');
const mockSnapshot = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
const activities = mockSnapshot.atividades;

describe('Activity Heatmap Engine Test Suite', () => {
  describe('Tier 1: Heatmap Grid & Intensity Scale (F4/F5)', () => {
    it('generates a complete calendar grid with 53 or 54 week columns', () => {
      const heatmap2023 = computeActivityHeatmap(activities, 2023);

      assert.equal(heatmap2023.year, 2023);
      assert.ok(heatmap2023.weeks.length === 53 || heatmap2023.weeks.length === 54);

      // Each week must contain strictly 7 days (Sunday to Saturday)
      for (const week of heatmap2023.weeks) {
        assert.equal(week.days.length, 7);
        for (let d = 0; d < 7; d++) {
          assert.equal(week.days[d].dayOfWeek, d);
        }
      }
    });

    it('identifies total active days, total year hours, and max daily study session', () => {
      const heatmap2024 = computeActivityHeatmap(activities, 2024);

      assert.ok(heatmap2024.activeDaysCount > 200, '2024 should have over 200 active study days');
      assert.ok(heatmap2024.totalYearHours > 600, '2024 should have over 600 total hours');
      assert.ok(heatmap2024.maxDailyHours > 4.0, 'Max daily study should be > 4h');
      assert.ok(heatmap2024.maxDailyDate !== null);
      assert.match(heatmap2024.maxDailyDate, /^2024-\d{2}-\d{2}$/);
      assert.match(heatmap2024.formattedTotalHours, /\d+h/);
    });

    it('assigns correct intensity levels (0..4) based on daily duration thresholds', () => {
      // Create synthetic day activities to verify exact cutoffs:
      // Level 0: 0h
      // Level 1: 0 < hours <= 1.5h (5,400,000 ms)
      // Level 2: 1.5 < hours <= 3.5h (12,600,000 ms)
      // Level 3: 3.5 < hours <= 6.0h (21,600,000 ms)
      // Level 4: hours > 6.0h (>21,600,000 ms)
      const synthetic = [
        {
          Id: 1,
          Inicio: '2025-01-10T10:00:00',
          Duracao: 1.5 * 3600000 // 1.5h -> Level 1
        },
        {
          Id: 2,
          Inicio: '2025-01-11T10:00:00',
          Duracao: 1.6 * 3600000 // 1.6h -> Level 2
        },
        {
          Id: 3,
          Inicio: '2025-01-12T10:00:00',
          Duracao: 3.5 * 3600000 // 3.5h -> Level 2
        },
        {
          Id: 4,
          Inicio: '2025-01-13T10:00:00',
          Duracao: 3.6 * 3600000 // 3.6h -> Level 3
        },
        {
          Id: 5,
          Inicio: '2025-01-14T10:00:00',
          Duracao: 6.0 * 3600000 // 6.0h -> Level 3
        },
        {
          Id: 6,
          Inicio: '2025-01-15T10:00:00',
          Duracao: 6.1 * 3600000 // 6.1h -> Level 4
        }
      ];

      const res = computeActivityHeatmap(synthetic, 2025);
      const dayMap = {};
      for (const w of res.weeks) {
        for (const d of w.days) {
          if (d.inTargetYear) dayMap[d.date] = d;
        }
      }

      assert.equal(dayMap['2025-01-09'].level, 0); // No study
      assert.equal(dayMap['2025-01-10'].level, 1); // 1.5h
      assert.equal(dayMap['2025-01-11'].level, 2); // 1.6h
      assert.equal(dayMap['2025-01-12'].level, 2); // 3.5h
      assert.equal(dayMap['2025-01-13'].level, 3); // 3.6h
      assert.equal(dayMap['2025-01-14'].level, 3); // 6.0h
      assert.equal(dayMap['2025-01-15'].level, 4); // 6.1h
    });

    it('aggregates multiple sessions on the same calendar date', () => {
      const multiSession = [
        {
          Id: 10,
          Inicio: '2025-04-10T09:00:00',
          Duracao: 2 * 3600000,
          ExercicioQuantidade: 20,
          ExercicioAcerto: 18
        },
        {
          Id: 11,
          Inicio: '2025-04-10T15:00:00',
          Duracao: 2.5 * 3600000,
          ExercicioQuantidade: 30,
          ExercicioAcerto: 25
        }
      ];

      const res = computeActivityHeatmap(multiSession, 2025);
      const targetDay = res.weeks.flatMap(w => w.days).find(d => d.date === '2025-04-10');

      assert.ok(targetDay);
      assert.equal(targetDay.sessionsCount, 2);
      assert.equal(targetDay.hours, 4.5);
      assert.equal(targetDay.level, 3); // 4.5h is level 3
      assert.equal(targetDay.questions, 50);
      assert.equal(targetDay.correct, 43);
    });

    it('contains all 5 intensity levels (0..4) in multiannual mock dataset', () => {
      const heatmap2024 = computeActivityHeatmap(activities, 2024);
      const allTargetDays = heatmap2024.weeks.flatMap(w => w.days).filter(d => d.inTargetYear);

      const foundLevels = new Set(allTargetDays.map(d => d.level));
      for (let lvl = 0; lvl <= 4; lvl++) {
        assert.ok(foundLevels.has(lvl), `Heatmap 2024 should contain level ${lvl}`);
      }
    });
  });

  describe('Tier 2: Boundary & Leap Year Tests', () => {
    it('does not let invalid durations cancel valid study time on the same date', () => {
      const invalidDurations = [-3600000, 0, null, undefined, NaN, Infinity, -Infinity, '3600000', 'invalid'];
      for (const duration of invalidDurations) {
        const result = computeActivityHeatmap([
          { Inicio: '2024-01-01T12:00:00', Duracao: 3600000, ExercicioQuantidade: 10, ExercicioAcerto: 8 },
          { Inicio: '2024-01-01T13:00:00', Duracao: duration, ExercicioQuantidade: 5, ExercicioAcerto: 4 },
          { Inicio: '2024-01-02T12:00:00', Duracao: duration }
        ], 2024);
        const day = result.weeks.flatMap(w => w.days).find(d => d.date === '2024-01-01');

        assert.equal(result.activeDaysCount, 1, String(duration));
        assert.equal(result.totalYearHours, 1, String(duration));
        assert.equal(day.hours, 1, String(duration));
        assert.equal(day.sessionsCount, 2);
        assert.equal(day.questions, 15);
        assert.equal(day.correct, 12);
      }
    });

    it('buckets timestamps by their local calendar date when an explicit offset crosses midnight', () => {
      // Encode a local Jan 1 session as a real UTC instant, preserving its local date
      // in every runner timezone instead of assuming Z means local time.
      const localMidnight = new Date(2024, 0, 1, 0, 30);
      const result = computeActivityHeatmap([
        { Inicio: localMidnight.toISOString(), Duracao: 3600000 }
      ], 2024);
      const firstDay = result.weeks.flatMap(w => w.days).find(d => d.date === '2024-01-01');
      assert.equal(firstDay.hours, 1);
      assert.equal(result.activeDaysCount, 1);
      assert.equal(result.totalYearHours, 1);
    });

    it('correctly maps 366 days for leap years (2016, 2020, 2024, 2028)', () => {
      for (const leapYear of [2016, 2020, 2024, 2028]) {
        const res = computeActivityHeatmap(activities, leapYear);
        assert.equal(res.totalDays, 366, `Year ${leapYear} must report 366 total days`);

        const inYearDays = res.weeks.flatMap(w => w.days).filter(d => d.inTargetYear);
        assert.equal(inYearDays.length, 366, `Year ${leapYear} must contain exactly 366 inTargetYear days`);

        // Feb 29 must exist and have inTargetYear === true
        const feb29 = inYearDays.find(d => d.date === `${leapYear}-02-29`);
        assert.ok(feb29, `Year ${leapYear} must contain Feb 29`);
        assert.equal(feb29.inTargetYear, true);
      }
    });

    it('correctly maps 365 days for standard non-leap years (2021, 2022, 2023, 2025)', () => {
      for (const nonLeapYear of [2021, 2022, 2023, 2025]) {
        const res = computeActivityHeatmap(activities, nonLeapYear);
        assert.equal(res.totalDays, 365, `Year ${nonLeapYear} must report 365 total days`);

        const inYearDays = res.weeks.flatMap(w => w.days).filter(d => d.inTargetYear);
        assert.equal(inYearDays.length, 365, `Year ${nonLeapYear} must contain exactly 365 inTargetYear days`);

        // Feb 29 must not exist in target year days
        const feb29 = inYearDays.find(d => d.date === `${nonLeapYear}-02-29`);
        assert.equal(feb29, undefined, `Year ${nonLeapYear} must not contain Feb 29`);
      }
    });

    it('handles padding days before Jan 1 and after Dec 31 properly', () => {
      // 2024-01-01 was a Monday (dayOfWeek = 1)
      // Week 0 should have Sunday (2023-12-31) as padding with inTargetYear === false
      const res2024 = computeActivityHeatmap(activities, 2024);
      const week0 = res2024.weeks[0];

      assert.equal(week0.days[0].dayOfWeek, 0); // Sunday
      assert.equal(week0.days[0].inTargetYear, false);
      assert.equal(week0.days[1].dayOfWeek, 1); // Monday
      assert.equal(week0.days[1].date, '2024-01-01');
      assert.equal(week0.days[1].inTargetYear, true);

      // Dec 31, 2024 was a Tuesday (dayOfWeek = 2)
      // The last week should have Wednesday through Saturday as padding with inTargetYear === false
      const lastWeek = res2024.weeks[res2024.weeks.length - 1];
      const dec31 = lastWeek.days.find(d => d.date === '2024-12-31');
      assert.ok(dec31);
      assert.equal(dec31.inTargetYear, true);
      assert.equal(dec31.dayOfWeek, 2);

      // Days after Dec 31 in the same week
      for (let i = 3; i < 7; i++) {
        assert.equal(lastWeek.days[i].inTargetYear, false);
      }
    });

    it('returns empty level 0 grid when no activities exist for target year', () => {
      const emptyRes = computeActivityHeatmap([], 2025);

      assert.equal(emptyRes.year, 2025);
      assert.equal(emptyRes.totalDays, 365);
      assert.equal(emptyRes.activeDaysCount, 0);
      assert.equal(emptyRes.totalYearHours, 0);
      assert.equal(emptyRes.maxDailyHours, 0);
      assert.equal(emptyRes.maxDailyDate, null);

      const inYearDays = emptyRes.weeks.flatMap(w => w.days).filter(d => d.inTargetYear);
      assert.equal(inYearDays.length, 365);
      for (const d of inYearDays) {
        assert.equal(d.level, 0);
        assert.equal(d.hours, 0);
        assert.equal(d.sessionsCount, 0);
      }
    });

    it('parses both ISO Inicio strings and Brazilian DataInicio dates', () => {
      const mixedDateActivities = [
        {
          Id: 101,
          Inicio: '2023-08-15T14:00:00',
          Duracao: 3600000
        },
        {
          Id: 102,
          DataInicio: '16/08/2023',
          HoraInicio: '15:00',
          Duracao: 7200000
        }
      ];

      const res = computeActivityHeatmap(mixedDateActivities, 2023);
      const day15 = res.weeks.flatMap(w => w.days).find(d => d.date === '2023-08-15');
      const day16 = res.weeks.flatMap(w => w.days).find(d => d.date === '2023-08-16');

      assert.ok(day15);
      assert.equal(day15.hours, 1.0);
      assert.ok(day16);
      assert.equal(day16.hours, 2.0);
    });
  });
});

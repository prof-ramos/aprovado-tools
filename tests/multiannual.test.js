/**
 * tests/multiannual.test.js
 *
 * Test suite for Multiannual Comparative Engine & Deterministic Phase Classification.
 * Verifies Tier 1 (Happy Path) & Tier 2 (Boundary, Leap Years, Edge Cases).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import {
  computeMultiannualHistory,
  classifyStudyPhase
} from '../shared/analytics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'multiannual_mock_2016_2026.json');
const mockSnapshot = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
const activities = mockSnapshot.atividades;

// Keep clock-dependent tests deterministic without relying on Node 20+ timer mocks.
function withFixedDate(isoDate, run) {
  const NativeDate = Date;
  const timestamp = new NativeDate(isoDate).getTime();
  globalThis.Date = class extends NativeDate {
    constructor(...args) {
      super(...(args.length ? args : [timestamp]));
    }
    static now() { return timestamp; }
  };
  try {
    return run();
  } finally {
    globalThis.Date = NativeDate;
  }
}

describe('Multiannual History & Phase Classification Test Suite', () => {
  describe('Tier 1: Multiannual Comparative Engine (F2)', () => {
    it('aggregates activities across an explicit 11-year range (2016–2026)', () => {
      const result = computeMultiannualHistory(activities, 2016, 2026);

      assert.equal(result.startYear, 2016);
      assert.equal(result.endYear, 2026);
      assert.equal(result.totalYearsCount, 11);
      assert.equal(result.years.length, 11);

      // Verify chronological year order
      for (let i = 0; i < 11; i++) {
        assert.equal(result.years[i].year, 2016 + i);
      }
    });

    it('calculates cumulative metrics accurately across all years', () => {
      const result = computeMultiannualHistory(activities, 2016, 2026);

      assert.ok(result.totalCumulativeHours > 4000, 'Cumulative hours should be substantial (>4000h)');
      assert.equal(result.totalCumulativeSessions, activities.length);

      const expectedQuestions = activities.reduce((acc, a) => acc + (a.ExercicioQuantidade || 0), 0);
      const expectedCorrect = activities.reduce((acc, a) => acc + (a.ExercicioAcerto || 0), 0);

      assert.equal(result.totalCumulativeQuestions, expectedQuestions);
      assert.equal(result.totalCumulativeCorrect, expectedCorrect);
      assert.ok(result.overallHistoricalAccuracy !== null);
      assert.ok(result.overallHistoricalAccuracy >= 70 && result.overallHistoricalAccuracy <= 80);
    });

    it('identifies peak study year correctly', () => {
      const result = computeMultiannualHistory(activities, 2016, 2026);

      assert.ok(result.peakYear !== null);
      assert.ok([2018, 2019, 2024, 2025].includes(result.peakYear.year), 'Peak year should be an intensive year');
      assert.ok(result.peakYear.hours > 600, 'Peak year hours should exceed 600h');

      // Peak year hours must equal maximum hours among all years
      const maxYearHours = Math.max(...result.years.map(y => y.totalHours));
      assert.equal(result.peakYear.hours, maxYearHours);
    });

    it('formats duration strings correctly for each year', () => {
      const result = computeMultiannualHistory(activities, 2016, 2026);

      for (const yr of result.years) {
        assert.ok(typeof yr.formattedDuration === 'string');
        assert.match(yr.formattedDuration, /\d+h \d+m/);
        assert.ok(yr.totalHours >= 0);
        assert.ok(yr.activeDaysCount >= 0);
        assert.ok(yr.sessionsCount >= 0);
      }
    });

    it('computes daily averages (active days vs total year days)', () => {
      const result = computeMultiannualHistory(activities, 2016, 2026);

      for (const yr of result.years) {
        if (yr.activeDaysCount > 0) {
          assert.ok(yr.avgDailyHoursActive > 0);
          assert.ok(yr.avgDailyHoursActive >= yr.avgDailyHoursYear);
        } else {
          assert.equal(yr.avgDailyHoursActive, 0);
          assert.equal(yr.avgDailyHoursYear, 0);
        }
      }
    });
  });

  describe('Tier 1: Phase Classification (F3)', () => {
    it('classifies intensive years (>=350h) as ALTA_INTENSIDADE', () => {
      const phase1 = classifyStudyPhase(350.0, 100);
      assert.equal(phase1.phase, 'ALTA_INTENSIDADE');
      assert.equal(phase1.phaseLabel, 'Alta Intensidade');

      const phase2 = classifyStudyPhase(800.0, 240);
      assert.equal(phase2.phase, 'ALTA_INTENSIDADE');
    });

    it('classifies high frequency (>=150 active days and >=250h) as ALTA_INTENSIDADE', () => {
      const phase = classifyStudyPhase(280.0, 160);
      assert.equal(phase.phase, 'ALTA_INTENSIDADE');
    });

    it('classifies maintenance years (50h-350h, >=20 active days) as MANUTENCAO', () => {
      const phase = classifyStudyPhase(200.0, 90);
      assert.equal(phase.phase, 'MANUTENCAO');
      assert.equal(phase.phaseLabel, 'Manutenção');
    });

    it('classifies hiatus years (<50h or <20 active days) as HIATO', () => {
      const phaseByHours = classifyStudyPhase(35.0, 25);
      assert.equal(phaseByHours.phase, 'HIATO');
      assert.equal(phaseByHours.phaseLabel, 'Hiato / Inatividade');

      const phaseByDays = classifyStudyPhase(120.0, 15);
      assert.equal(phaseByDays.phase, 'HIATO');
    });

    it('correctly classifies fixture historical years according to planned phases', () => {
      const result = computeMultiannualHistory(activities, 2016, 2026);
      const yearMap = Object.fromEntries(result.years.map(y => [y.year, y]));

      // 2020 was explicitly planned as Hiatus (<50h and <20 active days)
      assert.equal(yearMap[2020].phase, 'HIATO');
      assert.ok(yearMap[2020].totalHours < 50.0);
      assert.ok(yearMap[2020].activeDaysCount < 20);

      // 2018 and 2019 are peak intensive years
      assert.equal(yearMap[2018].phase, 'ALTA_INTENSIDADE');
      assert.equal(yearMap[2019].phase, 'ALTA_INTENSIDADE');

      // 2016 and 2017 are maintenance years
      assert.equal(yearMap[2016].phase, 'MANUTENCAO');
      assert.equal(yearMap[2017].phase, 'MANUTENCAO');
    });
  });

  describe('Tier 2: Boundary & Corner Cases', () => {
    it('includes the current year by default after 2026 while preserving the 2016 start', () => {
      const result = withFixedDate('2028-03-01T12:00:00', () => computeMultiannualHistory([
        { Inicio: '2028-02-29T12:00:00', Duracao: 3600000 }
      ]));

      assert.equal(result.startYear, 2016);
      assert.equal(result.endYear, 2028);
      assert.equal(result.totalYearsCount, 13);
      assert.equal(result.totalCumulativeSessions, 1);
      assert.equal(result.years.at(-1).totalHours, 1);
      assert.equal(result.years.at(-1).isCurrentYear, true);
    });

    it('uses calendar days rather than elapsed 24-hour intervals for current-year projection across DST', () => {
      const analyticsUrl = new URL('../shared/analytics.js', import.meta.url).href;
      const script = `
        import { computeMultiannualHistory } from ${JSON.stringify(analyticsUrl)};
        // São Paulo left summer time in February. At 23:30 on March 10,
        // 70 calendar days have begun, but elapsed milliseconds round up to 71.
        ${withFixedDate.toString()}
        const activities = Array.from({ length: 20 }, (_, i) => ({
          Inicio: '2016-01-' + String(i + 1).padStart(2, '0') + 'T12:00:00',
          Duracao: 3.36 * 3600000
        }));
        const year = withFixedDate('2016-03-10T23:30:00', () => computeMultiannualHistory(activities, 2016, 2016).years[0]);
        process.stdout.write(JSON.stringify({ phase: year.phase, hours: year.totalHours }));
      `;
      for (const timezone of ['UTC', 'America/Sao_Paulo']) {
        const result = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], {
          env: { ...process.env, TZ: timezone }, encoding: 'utf8'
        }));
        assert.equal(result.hours, 67.2);
        // 67.2 / 70 * 365 = 350.4 projected hours, above the 350-hour threshold.
        assert.equal(result.phase, 'ALTA_INTENSIDADE', timezone);
      }
    });

    for (const [label, duration] of [
      ['zero', 0], ['negative', -3600000], ['missing', undefined], ['null', null],
      ['NaN', NaN], ['infinite', Infinity], ['negative infinity', -Infinity],
      ['numeric string', '3600000'], ['nonnumeric string', 'invalid']
    ]) {
      it(`does not count ${label} duration as study time, an active day, or a streak day`, () => {
        const result = computeMultiannualHistory([
          { Inicio: '2024-01-01T12:00:00', Duracao: 3600000, ExercicioQuantidade: 10, ExercicioAcerto: 8 },
          { Inicio: '2024-01-02T12:00:00', Duracao: duration, ExercicioQuantidade: 5, ExercicioAcerto: 4 }
        ], 2024, 2024);
        const year = result.years[0];

        assert.equal(year.totalDurationMs, 3600000);
        assert.equal(year.totalHours, 1);
        assert.equal(result.totalCumulativeHours, 1);
        assert.equal(year.activeDaysCount, 1);
        assert.equal(year.longestStreak, 1);
        assert.equal(year.avgDailyHoursActive, 1);
        // Recorded sessions and question results remain useful even without a duration.
        assert.equal(year.sessionsCount, 2);
        assert.equal(year.totalQuestions, 15);
        assert.equal(year.totalCorrect, 12);
      });
    }

    it('handles empty activities array gracefully', () => {
      const result = computeMultiannualHistory([], 2016, 2026);

      assert.equal(result.totalYearsCount, 11);
      assert.equal(result.totalCumulativeHours, 0);
      assert.equal(result.totalCumulativeSessions, 0);
      assert.equal(result.totalCumulativeQuestions, 0);
      assert.equal(result.totalCumulativeCorrect, 0);
      assert.equal(result.overallHistoricalAccuracy, null);
      assert.equal(result.peakYear, null);

      for (const yr of result.years) {
        assert.equal(yr.totalHours, 0);
        assert.equal(yr.sessionsCount, 0);
        assert.equal(yr.activeDaysCount, 0);
        assert.equal(yr.accuracy, null);
        assert.equal(yr.phase, 'HIATO');
      }
    });

    it('respects exact mathematical boundary conditions for phase classification', () => {
      // Just below maintenance (49.9h, 20d) -> HIATO
      assert.equal(classifyStudyPhase(49.9, 20).phase, 'HIATO');

      // Just below maintenance days (50.0h, 19d) -> HIATO
      assert.equal(classifyStudyPhase(50.0, 19).phase, 'HIATO');

      // Exactly at maintenance lower bound (50.0h, 20d) -> MANUTENCAO
      assert.equal(classifyStudyPhase(50.0, 20).phase, 'MANUTENCAO');

      // Just below high intensity (349.9h, 149d) -> MANUTENCAO
      assert.equal(classifyStudyPhase(349.9, 149).phase, 'MANUTENCAO');

      // Exactly at high intensity threshold (350.0h, 30d) -> ALTA_INTENSIDADE
      assert.equal(classifyStudyPhase(350.0, 30).phase, 'ALTA_INTENSIDADE');

      // Frequency threshold dual check (250.0h, 150d) -> ALTA_INTENSIDADE
      assert.equal(classifyStudyPhase(250.0, 150).phase, 'ALTA_INTENSIDADE');

      // Frequency threshold just below hours (249.9h, 150d) -> MANUTENCAO
      assert.equal(classifyStudyPhase(249.9, 150).phase, 'MANUTENCAO');

      // Frequency threshold just below days (250.0h, 149d) -> MANUTENCAO
      assert.equal(classifyStudyPhase(250.0, 149).phase, 'MANUTENCAO');
    });

    it('accounts for leap years in annual daily average denominator (366 days)', () => {
      // 2016, 2020, 2024 are leap years (366 days)
      // 2017, 2018, 2019, 2021, 2022, 2023, 2025 are normal years (365 days)
      const leapActivities = [
        {
          Id: 991,
          Inicio: '2020-02-29T10:00:00.000Z',
          DataInicio: '29/02/2020',
          HoraInicio: '10:00',
          Duracao: 366 * 3600 * 1000, // 366 hours
          TipoEstudo: 'Teoria'
        }
      ];

      const resLeap = computeMultiannualHistory(leapActivities, 2020, 2020);
      assert.equal(resLeap.years[0].year, 2020);
      assert.equal(resLeap.years[0].totalHours, 366);
      // avgDailyHoursYear in leap year 2020: 366h / 366 days = 1.0
      assert.equal(Math.round(resLeap.years[0].avgDailyHoursYear * 10) / 10, 1.0);

      const nonLeapActivities = [
        {
          Id: 992,
          Inicio: '2023-05-10T10:00:00.000Z',
          DataInicio: '10/05/2023',
          HoraInicio: '10:00',
          Duracao: 365 * 3600 * 1000, // 365 hours
          TipoEstudo: 'Teoria'
        }
      ];

      const resNonLeap = computeMultiannualHistory(nonLeapActivities, 2023, 2023);
      assert.equal(resNonLeap.years[0].year, 2023);
      assert.equal(resNonLeap.years[0].totalHours, 365);
      // avgDailyHoursYear in non-leap year 2023: 365h / 365 days = 1.0
      assert.equal(Math.round(resNonLeap.years[0].avgDailyHoursYear * 10) / 10, 1.0);
    });

    it('supports custom startYear and endYear boundaries', () => {
      const sliceResult = computeMultiannualHistory(activities, 2018, 2020);

      assert.equal(sliceResult.startYear, 2018);
      assert.equal(sliceResult.endYear, 2020);
      assert.equal(sliceResult.totalYearsCount, 3);
      assert.equal(sliceResult.years.length, 3);
      assert.deepEqual(sliceResult.years.map(y => y.year), [2018, 2019, 2020]);
    });

    it('preserves custom start years and normalizes reversed ranges', () => {
      const result = computeMultiannualHistory([
        { Inicio: '2028-02-29T12:00:00', Duracao: 3600000 }
      ], 2028, 2027);
      assert.equal(result.startYear, 2027);
      assert.equal(result.endYear, 2028);
      assert.deepEqual(result.years.map(y => y.year), [2027, 2028]);
      assert.equal(result.totalCumulativeHours, 1);
    });

    it('supports single year query (startYear === endYear)', () => {
      const singleYearResult = computeMultiannualHistory(activities, 2022, 2022);

      assert.equal(singleYearResult.totalYearsCount, 1);
      assert.equal(singleYearResult.years.length, 1);
      assert.equal(singleYearResult.years[0].year, 2022);
    });

    it('applies annualized projection for ongoing current year', () => {
      // If 150 hours achieved by day 100 of the year:
      // Projected = (150 / 100) * 365 = 547.5h -> ALTA_INTENSIDADE
      const currentYearPace = classifyStudyPhase(150.0, 70, true, 100);
      assert.equal(currentYearPace.phase, 'ALTA_INTENSIDADE');

      // If early in the year (day <= 30), do not extrapolate wildly
      const earlyYearPace = classifyStudyPhase(10.0, 5, true, 15);
      assert.equal(earlyYearPace.phase, 'HIATO');
    });

    it('handles zero questions without producing NaN accuracy', () => {
      const zeroQActivities = [
        {
          Id: 993,
          Inicio: '2021-03-01T10:00:00.000Z',
          DataInicio: '01/03/2021',
          HoraInicio: '10:00',
          Duracao: 7200000,
          TipoEstudo: 'Teoria',
          ExercicioQuantidade: 0,
          ExercicioAcerto: 0
        }
      ];

      const res = computeMultiannualHistory(zeroQActivities, 2021, 2021);
      assert.equal(res.years[0].totalQuestions, 0);
      assert.equal(res.years[0].totalCorrect, 0);
      assert.equal(res.years[0].accuracy, null);
      assert.equal(res.overallHistoricalAccuracy, null);
    });
  });
});

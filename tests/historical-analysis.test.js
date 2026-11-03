/**
 * tests/historical-analysis.test.js
 *
 * Session length profile, hour × weekday matrix, hourly efficiency and
 * semester/year ranking used by the "Análise histórica" view.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  computeSessionLengthProfile,
  computeHourWeekdayMatrix,
  computeHourlyEfficiency,
  computeCircadianDistribution,
  computeSemesterRanking,
  computeHistoricalPatterns,
  MIN_QUESTIONS_FOR_ACCURACY
} from '../shared/analytics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'multiannual_mock_2016_2026.json'), 'utf-8'));

const MIN = 60000;
const atv = (inicio, minutes, questions = 0, correct = 0) => ({
  Inicio: inicio, Duracao: minutes * MIN, ExercicioQuantidade: questions, ExercicioAcerto: correct
});

describe('computeSessionLengthProfile', () => {
  it('puts 14:59 in <15m and 15:00 in 15–30m', () => {
    const result = computeSessionLengthProfile([
      { ...atv('2026-01-05T10:00:00', 0), Duracao: 15 * MIN - 1000 },
      atv('2026-01-05T11:00:00', 15)
    ]);
    const byKey = Object.fromEntries(result.buckets.map(b => [b.key, b]));
    assert.equal(byKey.lt15.sessions, 1);
    assert.equal(byKey['15_30'].sessions, 1);
    assert.equal(result.totalSessions, 2);
  });

  it('places sessions of 2h or more in the last bucket', () => {
    const result = computeSessionLengthProfile([atv('2026-01-05T10:00:00', 120), atv('2026-01-05T14:00:00', 600)]);
    assert.equal(result.buckets.at(-1).sessions, 2);
    assert.equal(result.longest.ms, 600 * MIN);
  });

  it('computes median, mean and P90', () => {
    const list = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((m, i) => atv(`2026-01-${String(i + 1).padStart(2, '0')}T10:00:00`, m));
    const result = computeSessionLengthProfile(list);
    assert.equal(result.medianMinutes, 55);
    assert.equal(result.meanMinutes, 55);
    assert.equal(result.p90Minutes, 90);
  });

  it('only picks an ideal bucket with enough questions', () => {
    const few = computeSessionLengthProfile([atv('2026-01-05T10:00:00', 45, 10, 10), atv('2026-01-06T10:00:00', 70, 49, 49)]);
    assert.equal(few.idealBucket, null);

    const enough = computeSessionLengthProfile([
      atv('2026-01-05T10:00:00', 45, MIN_QUESTIONS_FOR_ACCURACY, 30),
      atv('2026-01-06T10:00:00', 70, MIN_QUESTIONS_FOR_ACCURACY, 45),
      atv('2026-01-07T10:00:00', 20, 5, 5)
    ]);
    assert.equal(enough.idealBucket.key, '60_90');
    assert.equal(enough.idealBucket.accuracy, 90);
  });

  it('tracks the median per year and its trend', () => {
    const result = computeSessionLengthProfile([
      atv('2020-03-01T10:00:00', 30), atv('2020-04-01T10:00:00', 40),
      atv('2024-03-01T10:00:00', 90)
    ]);
    assert.deepEqual(result.medianByYear.map(y => [y.year, y.medianMinutes]), [[2020, 35], [2024, 90]]);
    assert.equal(result.trend.direction, 'mais_longas');
    assert.equal(result.trend.deltaMinutes, 55);
  });

  it('handles empty history and ignores zero or invalid durations', () => {
    const empty = computeSessionLengthProfile([]);
    assert.equal(empty.totalSessions, 0);
    assert.equal(empty.medianMinutes, 0);
    assert.equal(empty.longest, null);
    assert.equal(empty.trend, null);
    const invalid = computeSessionLengthProfile([atv('2026-01-05T10:00:00', 0), { Inicio: '2026-01-05T10:00:00', Duracao: NaN }]);
    assert.equal(invalid.totalSessions, 0);
  });
});

describe('computeHourWeekdayMatrix', () => {
  it('builds a 7 × 24 grid bucketed by local weekday and start hour', () => {
    // 2026-11-03 is a Tuesday.
    const result = computeHourWeekdayMatrix([atv('2026-11-03T20:15:00', 90), atv('2026-11-10T20:00:00', 30), atv('2026-11-08T06:00:00', 60)]);
    assert.equal(result.cells.length, 7);
    assert.ok(result.cells.every(row => row.length === 24));
    assert.equal(result.cells[2][20].hours, 2);
    assert.equal(result.cells[2][20].sessions, 2);
    assert.equal(result.cells[0][6].hours, 1);
    assert.equal(result.maxHours, 2);
    assert.equal(result.topSlots[0].label, 'Terça-feira, 20h');
    assert.equal(result.topSlots.length, 2);
  });

  it('is empty without activities', () => {
    const result = computeHourWeekdayMatrix([]);
    assert.equal(result.maxHours, 0);
    assert.deepEqual(result.topSlots, []);
  });
});

describe('computeHourlyEfficiency', () => {
  it('separates the most efficient hour from the volume peak', () => {
    const circadian = computeCircadianDistribution([
      atv('2026-01-05T20:00:00', 180, 100, 60),
      atv('2026-01-06T09:00:00', 60, 60, 54),
      atv('2026-01-07T14:00:00', 30, 10, 10)
    ]);
    const result = computeHourlyEfficiency(circadian);
    assert.equal(result.mostEfficientHour.hour, 9);
    assert.equal(result.mostEfficientHour.accuracy, 90);
    assert.equal(result.volumePeakHour.hour, 20);
    assert.equal(result.gapPoints, 30);
    assert.equal(result.mostEfficientShift.key, 'manha');
    assert.equal(result.hours[14].reliable, false, '10 questions is below the minimum sample');
  });

  it('includes a reliable shift in the synthesis when individual hours lack enough questions', () => {
    const activities = [6, 7, 8, 9, 10].map(hour =>
      atv(`2026-01-05T${String(hour).padStart(2, '0')}:00:00`, 60, 10, 9));
    const patterns = computeHistoricalPatterns(activities, [], { endYear: 2026 });
    assert.equal(patterns.efficiency.mostEfficientHour, null);
    assert.equal(patterns.efficiency.mostEfficientShift.questions, 50);
    assert.match(patterns.insights.efficiencyInsights, /Questões insuficientes para comparar assertividade por horário/);
    assert.match(patterns.insights.efficiencyInsights, /Por turno, a Manhã lidera com 90%/);
    assert.doesNotMatch(patterns.insights.efficiencyInsights, /Sua melhor assertividade acontece às|Você estuda mais às|p\.p\./);
    assert.match(patterns.insights.fullFormattedText, /Por turno, a Manhã lidera com 90%/);
  });

  it('returns nulls when no hour has enough questions', () => {
    const result = computeHourlyEfficiency(computeCircadianDistribution([atv('2026-01-05T20:00:00', 60, 5, 5)]));
    assert.equal(result.mostEfficientHour, null);
    assert.equal(result.mostEfficientShift, null);
    assert.equal(result.gapPoints, null);
  });
});

describe('computeSemesterRanking', () => {
  it('splits semesters at local midnight between 30/06 and 01/07', () => {
    const result = computeSemesterRanking([atv('2025-06-30T23:59:00', 30), atv('2025-07-01T00:00:00', 30)], { now: '2026-01-15T12:00:00' });
    assert.deepEqual(result.semesters.map(s => s.label), ['2025.1', '2025.2']);
  });

  it('measures consistency over elapsed days for the current semester', () => {
    const list = Array.from({ length: 10 }, (_, i) => atv(`2026-07-${String(i + 1).padStart(2, '0')}T10:00:00`, 60));
    const result = computeSemesterRanking(list, { now: '2026-07-20T12:00:00' });
    const current = result.semesters[0];
    assert.equal(current.isCurrent, true);
    assert.equal(current.elapsedDays, 20);
    assert.equal(current.consistency, 50);
    assert.equal(current.longestStreak, 10);
  });

  it('ranks by volume, consistency and accuracy and combines them', () => {
    const list = [
      // 2024.1: most hours, low accuracy
      ...Array.from({ length: 5 }, (_, i) => atv(`2024-02-0${i + 1}T10:00:00`, 300, 20, 10)),
      // 2024.2: fewer hours, many active days, high accuracy
      ...Array.from({ length: 20 }, (_, i) => atv(`2024-08-${String(i + 1).padStart(2, '0')}T10:00:00`, 60, 10, 9)),
      // 2025.1: little study, few questions (accuracy not ranked)
      atv('2025-02-01T10:00:00', 30, 5, 5)
    ];
    const { semesterHighlights: h, yearHighlights } = computeSemesterRanking(list, { now: '2026-01-15T12:00:00' });
    assert.equal(h.bestByHours.label, '2024.1');
    assert.equal(h.bestByConsistency.label, '2024.2');
    assert.equal(h.bestByAccuracy.label, '2024.2', '2025.1 has 100% but only 5 questions');
    assert.equal(h.overallBest.label, '2024.2');
    assert.equal(yearHighlights.bestByHours.label, '2024');
  });

  for (const [periodsKey, highlightsKey, expectedWinner] of [
    ['semesters', 'semesterHighlights', '2025.1'],
    ['years', 'yearHighlights', '2025']
  ]) {
    it(`gives tied hours and consistency equal ranks in ${periodsKey}`, () => {
      const result = computeSemesterRanking([
        atv('2023-02-01T10:00:00', 600, 100, 50),
        atv('2025-02-01T10:00:00', 600, 100, 90)
      ], { now: '2026-01-15T12:00:00' });

      assert.equal(result[highlightsKey].overallBest.label, expectedWinner);
      assert.deepEqual(result[periodsKey].map(p => p.ranks), [
        { hours: 1, consistency: 1, accuracy: 2 },
        { hours: 1, consistency: 1, accuracy: 1 }
      ]);
      assert.deepEqual(result[periodsKey].map(p => p.averageRank), [1.33, 1]);
    });
  }

  it('shares tied ranks without accuracy and preserves chronological highlight ties', () => {
    const result = computeSemesterRanking([
      atv('2023-02-01T10:00:00', 600),
      atv('2025-02-01T10:00:00', 600),
      atv('2026-02-01T10:00:00', 60)
    ], { now: '2027-01-15T12:00:00' });

    for (const periods of [result.semesters, result.years]) {
      assert.deepEqual(periods.map(p => p.ranks), [
        { hours: 1, consistency: 1, accuracy: null },
        { hours: 1, consistency: 1, accuracy: null },
        { hours: 3, consistency: 1, accuracy: null }
      ]);
      assert.deepEqual(periods.map(p => p.averageRank), [1, 1, 2]);
    }
    assert.equal(result.semesterHighlights.overallBest.label, '2023.1');
    assert.equal(result.yearHighlights.overallBest.label, '2023');
    assert.equal(result.semesterHighlights.bestByAccuracy, null);
    assert.equal(result.yearHighlights.bestByAccuracy, null);
  });

  it('handles empty history', () => {
    const result = computeSemesterRanking([]);
    assert.deepEqual(result.semesters, []);
    assert.equal(result.semesterHighlights.overallBest, null);
  });
});

describe('computeHistoricalPatterns with the multiannual fixture', () => {
  const patterns = computeHistoricalPatterns(fixture.atividades, fixture.materias, { endYear: 2026 });

  it('exposes the four new analyses', () => {
    assert.equal(patterns.sessions.totalSessions, fixture.atividades.filter(a => a.Duracao > 0).length);
    assert.equal(patterns.hourWeekday.cells.flat().reduce((s, c) => s + c.sessions, 0), patterns.sessions.totalSessions);
    assert.ok(patterns.efficiency.mostEfficientHour);
    assert.ok(patterns.semesters.semesters.length >= 10);
    assert.ok(patterns.semesters.semesterHighlights.overallBest);
  });

  it('keeps semester hours consistent with yearly totals', () => {
    for (const year of patterns.semesters.years) {
      const sum = patterns.semesters.semesters.filter(s => s.year === year.year).reduce((acc, s) => acc + s.totalMs, 0);
      assert.equal(sum, year.totalMs);
    }
  });

  it('adds the new sections to the synthesis text', () => {
    assert.match(patterns.insights.fullFormattedText, /### 6\. Tamanho de Sessão/);
    assert.match(patterns.insights.fullFormattedText, /### 7\. Horário Mais Eficiente/);
    assert.match(patterns.insights.fullFormattedText, /### 8\. Melhor Semestre e Ano/);
    assert.match(patterns.insights.periodInsights, /Seu melhor semestre no conjunto foi \d{4}\.[12]/);
  });
});

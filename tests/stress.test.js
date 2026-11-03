/**
 * tests/stress.test.js
 *
 * Adversarial Stress & Empirical Challenge Test Suite for "Padrões Históricos de Estudo".
 * Tests pathological date inputs, extreme values, question/accuracy boundaries,
 * methodological mix extremes, and defensive resilience.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeHistoricalPatterns,
  computeMultiannualHistory,
  classifyStudyPhase,
  computeActivityHeatmap,
  computeCircadianDistribution,
  computeYieldQuadrants,
  computeMethodologicalMix,
  generateStudyInsights,
  formatDurationMs,
  formatDurationHours,
  parseDateString
} from '../shared/analytics.js';

describe('Adversarial Stress Test Suite: Historical Study Patterns Engine', () => {

  // =========================================================================
  // 1. Pathological Date Inputs
  // =========================================================================
  describe('1. Pathological Date Inputs', () => {

    it('handles standard leap years (2016, 2020, 2024) with exact 366 days in heatmap', () => {
      for (const year of [2016, 2020, 2024]) {
        const heatmap = computeActivityHeatmap([], year);
        assert.equal(heatmap.totalDays, 366, `Year ${year} must have totalDays = 366`);

        const inTargetYearDays = heatmap.weeks.reduce(
          (acc, w) => acc + w.days.filter(d => d.inTargetYear).length,
          0
        );
        assert.equal(
          inTargetYearDays,
          366,
          `Year ${year} calendar grid must contain exactly 366 inTargetYear cells`
        );

        // Verify leap day Feb 29 exists in grid
        const hasFeb29 = heatmap.weeks.some(w =>
          w.days.some(d => d.date === `${year}-02-29` && d.inTargetYear)
        );
        assert.ok(hasFeb29, `Leap day ${year}-02-29 must be present and marked inTargetYear`);
      }
    });

    it('correctly distinguishes century leap year 2000 (366 days) vs 2100 (365 days)', () => {
      // Century year 2000 is divisible by 400 -> LEAP YEAR (366 days)
      const hm2000 = computeActivityHeatmap([], 2000);
      assert.equal(hm2000.totalDays, 366, 'Year 2000 must be recognized as leap year (366 days)');
      const days2000 = hm2000.weeks.reduce(
        (acc, w) => acc + w.days.filter(d => d.inTargetYear).length,
        0
      );
      assert.equal(days2000, 366, 'Year 2000 must map exactly 366 inTargetYear days');

      // Century year 2100 is divisible by 100 but NOT 400 -> COMMON YEAR (365 days)
      const hm2100 = computeActivityHeatmap([], 2100);
      assert.equal(hm2100.totalDays, 365, 'Year 2100 must be recognized as non-leap year (365 days)');
      const days2100 = hm2100.weeks.reduce(
        (acc, w) => acc + w.days.filter(d => d.inTargetYear).length,
        0
      );
      assert.equal(days2100, 365, 'Year 2100 must map exactly 365 inTargetYear days');

      // Check multiannual denominator for 2000 vs 2100
      const hist2000 = computeMultiannualHistory([], 2000, 2000);
      assert.equal(hist2000.years[0].year, 2000);
      const hist2100 = computeMultiannualHistory([], 2100, 2100);
      assert.equal(hist2100.years[0].year, 2100);
    });

    it('properly classifies activities at midnight boundary (00:00:00) vs end of day (23:59:59)', () => {
      const atvMidnight = {
        Id: 1,
        Inicio: '2024-05-10T00:00:00',
        HoraInicio: '00:00:00',
        Duracao: 3600000, // 1h
        TipoEstudo: 'Teoria'
      };
      const atvEndDay = {
        Id: 2,
        Inicio: '2024-05-10T23:59:59',
        HoraInicio: '23:59:59',
        Duracao: 3600000, // 1h
        TipoEstudo: 'Questões'
      };

      const circ = computeCircadianDistribution([atvMidnight, atvEndDay]);

      // Midnight must map to hour 0, shift madrugada
      assert.equal(circ.hourly[0].ms, 3600000, 'Hour 00h must have 1h duration');
      assert.equal(circ.hourly[0].sessions, 1, 'Hour 00h must have 1 session');
      assert.equal(circ.shifts.madrugada.hours, 1.0, 'Madrugada shift must have 1.0h');
      assert.equal(circ.shifts.madrugada.sessions, 1, 'Madrugada shift must have 1 session');

      // 23:59:59 must map to hour 23, shift noite
      assert.equal(circ.hourly[23].ms, 3600000, 'Hour 23h must have 1h duration');
      assert.equal(circ.hourly[23].sessions, 1, 'Hour 23h must have 1 session');
      assert.equal(circ.shifts.noite.hours, 1.0, 'Noite shift must have 1.0h');
      assert.equal(circ.shifts.noite.sessions, 1, 'Noite shift must have 1 session');

      // Shifts sum strictly to 100.0%
      const sumPct = Number(
        (
          circ.shifts.madrugada.percentage +
          circ.shifts.manha.percentage +
          circ.shifts.tarde.percentage +
          circ.shifts.noite.percentage
        ).toFixed(1)
      );
      assert.equal(sumPct, 100.0, 'Shifts percentage must strictly total 100.0%');
    });

    it('survives Daylight Saving Time (DST) transitions without skipping days or dropping sessions', () => {
      // In Brazil, DST 2016 started Oct 16, 2016 and ended Feb 21, 2016.
      const dstActivities = [
        { Id: 10, Inicio: '2016-02-21T00:00:00', Duracao: 3600000, TipoEstudo: 'Teoria' },
        { Id: 11, Inicio: '2016-02-21T02:00:00', Duracao: 1800000, TipoEstudo: 'Questões' },
        { Id: 12, Inicio: '2016-10-16T00:00:00', Duracao: 3600000, TipoEstudo: 'Revisão' },
        { Id: 13, Inicio: '2016-10-16T03:00:00', Duracao: 1800000, TipoEstudo: 'Teoria' },
        { Id: 14, Inicio: '2016-12-31T23:59:59', Duracao: 7200000, TipoEstudo: 'Revisão' }
      ];

      const heatmap = computeActivityHeatmap(dstActivities, 2016);
      assert.equal(heatmap.totalDays, 366, 'Leap year 2016 must have 366 days');

      // Count inTargetYear days
      const totalInYear = heatmap.weeks.reduce(
        (acc, w) => acc + w.days.filter(d => d.inTargetYear).length,
        0
      );
      assert.equal(totalInYear, 366, 'Heatmap must include all 366 days without DST truncation');

      // Verify Dec 31 is present and populated
      const dec31 = heatmap.weeks.flatMap(w => w.days).find(d => d.date === '2016-12-31');
      assert.ok(dec31, 'December 31 must be present');
      assert.equal(dec31.inTargetYear, true, 'December 31 must be in target year');
      assert.equal(dec31.hours, 2.0, 'December 31 must have 2.0 hours mapped');
      assert.equal(dec31.level, 2, 'December 31 must have level 2');
    });

    it('safely handles negative and zero-duration activities without NaN or math crashes', () => {
      const edgeActivities = [
        { Id: 20, Inicio: '2024-01-01T10:00:00', Duracao: 0, TipoEstudo: 'Teoria' },
        { Id: 21, Inicio: '2024-01-02T10:00:00', Duracao: -3600000, TipoEstudo: 'Questões' },
        { Id: 22, Inicio: '2024-01-03T10:00:00', Duracao: null, TipoEstudo: 'Revisão' },
        { Id: 23, Inicio: '2024-01-04T10:00:00', Duracao: undefined, TipoEstudo: 'Teoria' }
      ];

      // formatDurationMs and formatDurationHours
      assert.equal(formatDurationMs(0), '0h 0m');
      assert.equal(formatDurationMs(-5000), '0h 0m');
      assert.equal(formatDurationMs(null), '0h 0m');
      assert.equal(formatDurationHours(0), '0.0h');
      assert.equal(formatDurationHours(-3600000), '0.0h');
      assert.equal(formatDurationHours(null), '0.0h');

      // Multiannual history with zero/negative duration
      const hist = computeMultiannualHistory(edgeActivities, 2024, 2024);
      assert.ok(!isNaN(hist.totalCumulativeHours), 'Total hours must not be NaN');
      assert.equal(hist.years[0].phase, 'HIATO', 'Negative/zero study hours must be classified as HIATO');

      // Heatmap with zero/negative duration: must not count as active days
      const hm = computeActivityHeatmap(edgeActivities, 2024);
      assert.equal(hm.activeDaysCount, 0, 'Zero or negative duration must have 0 active days');
      assert.equal(hm.totalYearHours, 0, 'Total year hours must be 0');

      // Methodological mix with pure zero duration
      const zeroActivities = [
        { Id: 20, Inicio: '2024-01-01T10:00:00', Duracao: 0, TipoEstudo: 'Teoria' },
        { Id: 22, Inicio: '2024-01-03T10:00:00', Duracao: null, TipoEstudo: 'Revisão' },
        { Id: 23, Inicio: '2024-01-04T10:00:00', Duracao: undefined, TipoEstudo: 'Teoria' }
      ];
      const mixZero = computeMethodologicalMix(zeroActivities);
      assert.equal(mixZero.proportions.teoria.percentage, 0);
      assert.equal(mixZero.recommendations[0].title, 'Sem Atividades Registradas');
    });

    it('gracefully tolerates malformed date strings and missing timestamps', () => {
      const corruptActivities = [
        { Id: 30, Inicio: 'not-a-valid-date', Duracao: 3600000, TipoEstudo: 'Teoria' },
        { Id: 31, DataInicio: 'invalid/format/string', Duracao: 3600000, TipoEstudo: 'Questões' },
        { Id: 32, Inicio: '', DataInicio: '', Duracao: 3600000, TipoEstudo: 'Revisão' },
        { Id: 33, Inicio: null, DataInicio: null, Duracao: 3600000, TipoEstudo: 'Teoria' }
      ];

      // parseDateString
      assert.equal(parseDateString(null), null);
      assert.equal(parseDateString(''), null);
      const badDate = parseDateString('not-a-date');
      assert.ok(isNaN(badDate.getTime()), 'Bad date string yields NaN date');

      // Multiannual skips unparseable dates without throwing
      const hist = computeMultiannualHistory(corruptActivities, 2024, 2024);
      assert.equal(hist.years[0].sessionsCount, 0, 'Unparseable dates must not populate year sessions');
      assert.equal(hist.years[0].activeDaysCount, 0, 'Unparseable dates must have 0 active days');

      // Heatmap skips unparseable dates
      const hm = computeActivityHeatmap(corruptActivities, 2024);
      assert.equal(hm.activeDaysCount, 0, 'Heatmap must have 0 active days for corrupt dates');
    });
  });

  // =========================================================================
  // 2. Extreme Values
  // =========================================================================
  describe('2. Extreme Values', () => {

    it('handles 0 sessions cleanly across all analytics modules', () => {
      const patterns = computeHistoricalPatterns([]);

      assert.equal(patterns.history.totalCumulativeHours, 0);
      assert.equal(patterns.history.totalCumulativeSessions, 0);
      assert.equal(patterns.history.totalCumulativeQuestions, 0);
      assert.equal(patterns.history.overallHistoricalAccuracy, null);
      assert.equal(patterns.history.peakYear, null);

      assert.equal(patterns.heatmap.activeDaysCount, 0);
      assert.equal(patterns.heatmap.totalYearHours, 0);
      assert.equal(patterns.heatmap.maxDailyHours, 0);
      assert.equal(patterns.heatmap.maxDailyDate, null);

      assert.equal(patterns.circadian.peakHour.hours, 0);
      assert.equal(patterns.circadian.peakHour.label, '00h');
      assert.equal(patterns.circadian.dominantShift, 'manha');
      assert.equal(patterns.circadian.weekdayRanking.length, 7);

      assert.equal(patterns.quadrants.summary.totalSubjects, 0);
      assert.equal(patterns.quadrants.summary.bottlenecksCount, 0);
      assert.equal(patterns.quadrants.summary.strongCount, 0);

      assert.equal(patterns.mix.recommendations[0].severity, 'info');
      assert.equal(patterns.mix.recommendations[0].title, 'Sem Atividades Registradas');

      assert.ok(patterns.insights.executiveSummary.includes('Nenhum histórico significativo'));
      assert.ok(patterns.insights.fullFormattedText.length > 50);
    });

    it('handles 1 single session accurately with 100% shift and valid peak year', () => {
      const singleActivity = [{
        Id: 101,
        Inicio: '2024-08-20T14:30:00',
        HoraInicio: '14:30:00',
        Duracao: 5400000, // 1.5h
        ExercicioQuantidade: 20,
        ExercicioAcerto: 18,
        TipoEstudo: 'Questões',
        Materia: { Id: 42, Nome: 'Direito Penal', Cor: '#ef4444' }
      }];

      const patterns = computeHistoricalPatterns(singleActivity);

      assert.equal(patterns.history.totalCumulativeHours, 1.5);
      assert.equal(patterns.history.totalCumulativeSessions, 1);
      assert.equal(patterns.history.totalCumulativeQuestions, 20);
      assert.equal(patterns.history.overallHistoricalAccuracy, 90.0);
      assert.deepEqual(patterns.history.peakYear, { year: 2024, hours: 1.5 });

      // Circadian: 14h belongs to afternoon (tarde)
      assert.equal(patterns.circadian.dominantShift, 'tarde');
      assert.equal(patterns.circadian.shifts.tarde.hours, 1.5);
      assert.equal(patterns.circadian.shifts.tarde.percentage, 100.0);
      assert.equal(patterns.circadian.shifts.manha.percentage, 0.0);
      assert.equal(patterns.circadian.shifts.noite.percentage, 0.0);
      assert.equal(patterns.circadian.shifts.madrugada.percentage, 0.0);

      // Quadrants: single subject with 90% accuracy and > 0h -> Pontos Fortes
      assert.equal(patterns.quadrants.summary.totalSubjects, 1);
      assert.equal(patterns.quadrants.quadrants.pontosFortes.length, 1);
      assert.equal(patterns.quadrants.quadrants.pontosFortes[0].name, 'Direito Penal');
      assert.equal(patterns.quadrants.quadrants.pontosFortes[0].accuracy, 90.0);
    });

    it('processes 10,000 sessions within strict performance SLA (<500ms) with full integrity', () => {
      const startMs = new Date(2016, 0, 1).getTime();
      const endMs = new Date(2026, 11, 31).getTime();
      const range = endMs - startMs;
      const subjects = [
        { Id: 1, Nome: 'Constitucional', Cor: '#3b82f6' },
        { Id: 2, Nome: 'Administrativo', Cor: '#10b981' },
        { Id: 3, Nome: 'Civil', Cor: '#f59e0b' },
        { Id: 4, Nome: 'Penal', Cor: '#ef4444' },
        { Id: 5, Nome: 'Processo Penal', Cor: '#8b5cf6' }
      ];
      const types = ['Teoria', 'Questões', 'Revisão', 'Simulado'];

      const massiveActivities = [];
      for (let i = 0; i < 10000; i++) {
        const timeMs = startMs + Math.floor((i / 10000) * range);
        const d = new Date(timeMs);
        const dur = 1800000 + ((i * 73) % 7200000); // 30m to 2.5h
        const q = (i % 4 === 0) ? 0 : 10;
        const c = (q > 0) ? 8 : 0;

        massiveActivities.push({
          Id: i + 1,
          Inicio: d.toISOString(),
          HoraInicio: String(d.getHours()).padStart(2, '0') + ':00',
          Duracao: dur,
          ExercicioQuantidade: q,
          ExercicioAcerto: c,
          TipoEstudo: types[i % types.length],
          Materia: subjects[i % subjects.length]
        });
      }

      const t0 = performance.now();
      const patterns = computeHistoricalPatterns(massiveActivities, subjects, { heatmapYear: 2024 });
      const durationMs = performance.now() - t0;

      // Performance assertion: must complete under 500ms (typically ~60ms)
      assert.ok(durationMs < 500, `Execution took ${durationMs.toFixed(1)}ms (SLA: <500ms)`);

      // Integrity assertions
      assert.equal(patterns.history.totalCumulativeSessions, 10000);
      assert.ok(patterns.history.totalCumulativeHours > 5000);
      assert.equal(patterns.history.years.length, 11);
      assert.ok(patterns.history.overallHistoricalAccuracy > 0);

      // Circadian shifts sum strictly to 100%
      const shiftSum = Number(
        (
          patterns.circadian.shifts.madrugada.percentage +
          patterns.circadian.shifts.manha.percentage +
          patterns.circadian.shifts.tarde.percentage +
          patterns.circadian.shifts.noite.percentage
        ).toFixed(1)
      );
      assert.equal(shiftSum, 100.0);

      // Heatmap 2024 leap year
      assert.equal(patterns.heatmap.totalDays, 366);
      assert.equal(patterns.heatmap.activeDaysCount, 366);
    });

    it('formats huge duration (100,000 hours) cleanly without numerical overflow or NaN', () => {
      const hugeMs = 100000 * 3600000; // 100,000 hours in ms = 3.6e11 ms
      const formatted = formatDurationMs(hugeMs);
      const formattedHours = formatDurationHours(hugeMs);

      // 100,000 hours / 24 = 4166 days, 16 hours, 0 minutes
      assert.equal(formatted, '4166d 16h 0m');
      assert.equal(formattedHours, '100000.0h');

      // Test phase classification: 1 active day (<20 days) strictly yields HIATO
      assert.equal(classifyStudyPhase(100000, 1).phase, 'HIATO');
      // While >= 20 active days yields ALTA_INTENSIDADE
      assert.equal(classifyStudyPhase(100000, 20).phase, 'ALTA_INTENSIDADE');
      assert.equal(classifyStudyPhase(100000, 150).phase, 'ALTA_INTENSIDADE');
    });

    it('partitions subjects correctly whether N=1 or N=100 in Yield Quadrants', () => {
      // N = 1 subject
      const single = [{ id: 1, name: 'S1', totalHours: 15.0, questions: 10, correct: 9 }];
      const qSingle = computeYieldQuadrants(single);
      assert.equal(qSingle.medianHours, 15.0);
      assert.equal(qSingle.summary.totalSubjects, 1);
      assert.equal(qSingle.summary.strongCount, 1);

      // N = 100 subjects with varying hours and accuracies
      const subjects100 = [];
      for (let i = 1; i <= 100; i++) {
        subjects100.push({
          id: i,
          name: `Matéria ${i}`,
          totalHours: i * 2, // 2h to 200h
          questions: (i % 5 === 0) ? 0 : 50,
          correct: (i % 5 === 0) ? 0 : (i % 2 === 0 ? 45 : 20) // 90% or 40%
        });
      }

      const q100 = computeYieldQuadrants(subjects100);
      assert.equal(q100.summary.totalSubjects, 100);

      const totalClassified = (
        q100.quadrants.pontosFortes.length +
        q100.quadrants.gargalosCriticos.length +
        q100.quadrants.baseSolida.length +
        q100.quadrants.zonaRisco.length +
        q100.quadrants.semExercicios.length
      );
      assert.equal(totalClassified, 100, 'All 100 subjects must be partitioned into exactly one quadrant');
      assert.equal(q100.quadrants.semExercicios.length, 20, '20 subjects with 0 questions must be in semExercicios');
      assert.ok(q100.medianHours > 0, 'Median hours must be positive');
    });
  });

  // =========================================================================
  // 3. Accuracy and Question Edge Cases
  // =========================================================================
  describe('3. Accuracy and Question Edge Cases', () => {

    it('returns null accuracy for 0 questions and classifies into semExercicios', () => {
      const atv0q = [{
        Id: 1,
        Inicio: '2024-03-01T10:00:00',
        Duracao: 3600000,
        ExercicioQuantidade: 0,
        ExercicioAcerto: 0,
        TipoEstudo: 'Teoria',
        Materia: { Id: 1, Nome: 'Direito Penal' }
      }];

      const patterns = computeHistoricalPatterns(atv0q);
      const y2024 = patterns.history.years.find(y => y.year === 2024);
      assert.equal(y2024.accuracy, null, '0 questions must produce null accuracy (not 0 or NaN)');
      assert.equal(patterns.history.overallHistoricalAccuracy, null, 'Overall accuracy must be null');

      // Quadrants must place it in semExercicios
      assert.equal(patterns.quadrants.quadrants.semExercicios.length, 1);
      assert.equal(patterns.quadrants.quadrants.semExercicios[0].accuracy, null);
    });

    it('handles 1,000,000 questions with precision and no floating point corruption', () => {
      const atv1m = [{
        Id: 1,
        Inicio: '2024-03-01T10:00:00',
        Duracao: 36000000,
        ExercicioQuantidade: 1000000,
        ExercicioAcerto: 843210, // 84.321% -> 84.3%
        TipoEstudo: 'Questões'
      }];

      const hist = computeMultiannualHistory(atv1m, 2024, 2024);
      assert.equal(hist.totalCumulativeQuestions, 1000000);
      assert.equal(hist.totalCumulativeCorrect, 843210);
      assert.equal(hist.overallHistoricalAccuracy, 84.3);
      assert.equal(hist.years[0].accuracy, 84.3);
    });

    it('distinguishes 0 correct (0.0% accuracy) from null accuracy', () => {
      const atv0c = [{
        Id: 1,
        Inicio: '2024-03-01T10:00:00',
        Duracao: 3600000,
        ExercicioQuantidade: 50,
        ExercicioAcerto: 0, // 0 correct out of 50
        TipoEstudo: 'Questões',
        Materia: { Id: 1, Nome: 'Matemática' }
      }];

      const patterns = computeHistoricalPatterns(atv0c);
      const y2024 = patterns.history.years.find(y => y.year === 2024);
      assert.equal(y2024.accuracy, 0.0, '0 correct out of 50 must be 0.0% (not null)');
      assert.equal(patterns.history.overallHistoricalAccuracy, 0.0);

      // Must be classified as zonaRisco (or gargalosCriticos if hours >= median)
      const q = patterns.quadrants.quadrants;
      const isClassified = q.zonaRisco.length > 0 || q.gargalosCriticos.length > 0;
      assert.ok(isClassified, '0% accuracy must be placed in low accuracy quadrant');
      assert.equal(q.semExercicios.length, 0, 'Must NOT be in semExercicios because 50 questions were done');
    });

    it('handles 100% correct (100.0% accuracy) accurately in all aggregates', () => {
      const atv100c = [{
        Id: 1,
        Inicio: '2024-03-01T10:00:00',
        Duracao: 3600000,
        ExercicioQuantidade: 40,
        ExercicioAcerto: 40,
        TipoEstudo: 'Questões',
        Materia: { Id: 1, Nome: 'Português' }
      }];

      const patterns = computeHistoricalPatterns(atv100c);
      const y2024 = patterns.history.years.find(y => y.year === 2024);
      assert.equal(y2024.accuracy, 100.0);
      assert.equal(patterns.history.overallHistoricalAccuracy, 100.0);

      const q = patterns.quadrants.quadrants;
      const isStrongOrBase = q.pontosFortes.length > 0 || q.baseSolida.length > 0;
      assert.ok(isStrongOrBase, '100% accuracy must be placed in high accuracy quadrant');
    });

    it('handles decimal acertos and null/undefined acertos gracefully', () => {
      const atvDec = [
        {
          Id: 1,
          Inicio: '2024-03-01T10:00:00',
          Duracao: 3600000,
          ExercicioQuantidade: 25,
          ExercicioAcerto: 12.5, // Cespe-style penalty score
          TipoEstudo: 'Questões'
        },
        {
          Id: 2,
          Inicio: '2024-03-02T10:00:00',
          Duracao: 3600000,
          ExercicioQuantidade: 20,
          ExercicioAcerto: null, // missing acerto
          TipoEstudo: 'Questões'
        },
        {
          Id: 3,
          Inicio: '2024-03-03T10:00:00',
          Duracao: 3600000,
          ExercicioQuantidade: 15,
          ExercicioAcerto: undefined, // undefined acerto
          TipoEstudo: 'Questões'
        }
      ];

      const hist = computeMultiannualHistory(atvDec, 2024, 2024);
      assert.equal(hist.totalCumulativeQuestions, 60);
      assert.equal(hist.totalCumulativeCorrect, 12.5);
      // 12.5 / 60 = 20.833% -> 20.8%
      assert.equal(hist.overallHistoricalAccuracy, 20.8);
      assert.ok(!isNaN(hist.years[0].accuracy), 'Accuracy must not be NaN');
    });
  });

  // =========================================================================
  // 4. Methodological Mix Extreme Proportions
  // =========================================================================
  describe('4. Methodological Mix Extreme Proportions', () => {

    it('diagnoses 100% Teoria monopoly (Rules 1, 2, 3 triggered)', () => {
      const atvs = [{ Duracao: 36000000, TipoEstudo: 'Teoria e Doutrina' }];
      const mix = computeMethodologicalMix(atvs);

      assert.equal(mix.proportions.teoria.percentage, 100.0);
      assert.equal(mix.proportions.questoes.percentage, 0.0);
      assert.equal(mix.proportions.revisao.percentage, 0.0);
      assert.equal(mix.proportions.outros.percentage, 0.0);

      const titles = mix.recommendations.map(r => r.title);
      assert.ok(titles.includes('Baixa Resolução de Questões'), 'Rule 1 must trigger');
      assert.ok(titles.includes('Excesso de Teoria Passiva'), 'Rule 2 must trigger');
      assert.ok(titles.includes('Déficit de Revisão Espaçada'), 'Rule 3 must trigger');
    });

    it('diagnoses 100% Questões monopoly (Rules 3, 4 triggered)', () => {
      const atvs = [{ Duracao: 36000000, TipoEstudo: 'Questões de Concurso' }];
      const mix = computeMethodologicalMix(atvs);

      assert.equal(mix.proportions.questoes.percentage, 100.0);
      assert.equal(mix.proportions.teoria.percentage, 0.0);
      assert.equal(mix.proportions.revisao.percentage, 0.0);

      const titles = mix.recommendations.map(r => r.title);
      assert.ok(titles.includes('Déficit de Revisão Espaçada'), 'Rule 3 must trigger');
      assert.ok(titles.includes('Risco de Platô por Falta de Base'), 'Rule 4 must trigger');
    });

    it('diagnoses 100% Revisão monopoly (Rule 1 triggered)', () => {
      const atvs = [{ Duracao: 36000000, TipoEstudo: 'Revisão Espaçada / Flashcards' }];
      const mix = computeMethodologicalMix(atvs);

      assert.equal(mix.proportions.revisao.percentage, 100.0);
      assert.equal(mix.proportions.teoria.percentage, 0.0);
      assert.equal(mix.proportions.questoes.percentage, 0.0);

      const titles = mix.recommendations.map(r => r.title);
      assert.ok(titles.includes('Baixa Resolução de Questões'), 'Rule 1 must trigger');
    });

    it('diagnoses 100% Unknown/Unclassified modalities into Outros', () => {
      const atvs = [
        { Duracao: 3600000, TipoEstudo: 'Natação' },
        { Duracao: 1800000, TipoEstudo: 'Organização da Mesa' },
        { Duracao: 1800000, TipoEstudo: '' },
        { Duracao: 1800000, TipoEstudo: null }
      ];
      const mix = computeMethodologicalMix(atvs);

      assert.equal(mix.proportions.outros.percentage, 100.0);
      assert.equal(mix.proportions.teoria.percentage, 0.0);
      assert.equal(mix.proportions.questoes.percentage, 0.0);
      assert.equal(mix.proportions.revisao.percentage, 0.0);

      const titles = mix.recommendations.map(r => r.title);
      assert.ok(titles.includes('Baixa Resolução de Questões'));
      assert.ok(titles.includes('Déficit de Revisão Espaçada'));
    });
  });

  // =========================================================================
  // 5. Defensive Resilience & Fault Tolerance
  // =========================================================================
  describe('5. Defensive Resilience & Fault Tolerance', () => {

    it('safely handles null and undefined arguments in top-level functions', () => {
      // Functions with default arguments must not crash when called with no arguments or undefined
      assert.doesNotThrow(() => computeMultiannualHistory());
      assert.doesNotThrow(() => computeMultiannualHistory(undefined));
      assert.doesNotThrow(() => computeActivityHeatmap());
      assert.doesNotThrow(() => computeActivityHeatmap(undefined));
      assert.doesNotThrow(() => computeCircadianDistribution());
      assert.doesNotThrow(() => computeCircadianDistribution(undefined));
      assert.doesNotThrow(() => computeYieldQuadrants());
      assert.doesNotThrow(() => computeYieldQuadrants(undefined));
      assert.doesNotThrow(() => computeMethodologicalMix());
      assert.doesNotThrow(() => computeMethodologicalMix(undefined));
      assert.doesNotThrow(() => generateStudyInsights());
      assert.doesNotThrow(() => generateStudyInsights(undefined, undefined));
      assert.doesNotThrow(() => computeHistoricalPatterns());
      assert.doesNotThrow(() => computeHistoricalPatterns(undefined, undefined));
    });

    it('safely handles non-string inputs in parseDateString', () => {
      assert.equal(parseDateString(null), null);
      assert.equal(parseDateString(undefined), null);
      assert.equal(parseDateString(''), null);
    });
  });
});

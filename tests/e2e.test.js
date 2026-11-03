/**
 * tests/e2e.test.js
 *
 * Comprehensive End-to-End Test Suite for "Padrões Históricos de Estudo".
 * Verifies Tier 3 (Cross-Feature Consistency & Master Consolidator)
 * and Tier 4 (5 Real-World Student Application Scenarios from TEST_INFRA.md).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  computeHistoricalPatterns,
  computeMultiannualHistory,
  computeActivityHeatmap,
  computeCircadianDistribution,
  computeYieldQuadrants,
  computeMethodologicalMix,
  generateStudyInsights
} from '../shared/analytics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'multiannual_mock_2016_2026.json');
const mockSnapshot = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
const activities = mockSnapshot.atividades;
const materias = mockSnapshot.materias;

describe('End-to-End (E2E) Master Suite: Padrões Históricos de Estudo', () => {
  describe('Tier 3: Cross-Feature Integration & Consistency', () => {
    it('executes master computeHistoricalPatterns and returns all 6 integrated modules', () => {
      const result = computeHistoricalPatterns(activities, materias);

      assert.ok(result.history, 'History module must be present');
      assert.ok(result.heatmap, 'Heatmap module must be present');
      assert.ok(result.circadian, 'Circadian module must be present');
      assert.ok(result.quadrants, 'Quadrants module must be present');
      assert.ok(result.mix, 'Mix module must be present');
      assert.ok(result.insights, 'Insights module must be present');

      // Check structure of each module
      assert.equal(result.history.totalYearsCount, 11);
      assert.ok(result.heatmap.weeks.length >= 53);
      assert.equal(result.circadian.hourly.length, 24);
      assert.ok(result.quadrants.quadrants.pontosFortes.length > 0);
      assert.ok(result.mix.recommendations.length > 0);
      assert.ok(result.insights.fullFormattedText.length > 0);
    });

    it('cross-validates cumulative duration consistency across history, circadian and mix modules', () => {
      const patterns = computeHistoricalPatterns(activities, materias);

      // Duration from Multiannual History
      const historyHours = patterns.history.totalCumulativeHours;

      // Duration from Circadian Hourly
      const circadianHours = Number(patterns.circadian.hourly.reduce((sum, h) => sum + h.hours, 0).toFixed(1));

      // Duration from Circadian Shifts
      const shiftHours = Number(
        (
          patterns.circadian.shifts.madrugada.hours +
          patterns.circadian.shifts.manha.hours +
          patterns.circadian.shifts.tarde.hours +
          patterns.circadian.shifts.noite.hours
        ).toFixed(1)
      );

      // Duration from Methodological Mix
      const mixHours = Number(
        (
          patterns.mix.proportions.teoria.hours +
          patterns.mix.proportions.questoes.hours +
          patterns.mix.proportions.revisao.hours +
          patterns.mix.proportions.outros.hours
        ).toFixed(1)
      );

      // Verify that all 4 independent aggregations agree within +/- 0.5 hours (due to session rounding)
      assert.ok(
        Math.abs(historyHours - circadianHours) <= 0.5,
        `History hours (${historyHours}) must match circadian hours (${circadianHours})`
      );
      assert.ok(
        Math.abs(circadianHours - shiftHours) <= 0.5,
        `Circadian hours (${circadianHours}) must match shift hours (${shiftHours})`
      );
      assert.ok(
        Math.abs(circadianHours - mixHours) <= 0.5,
        `Circadian hours (${circadianHours}) must match mix hours (${mixHours})`
      );
    });

    it('cross-validates heatmap year hours against multiannual entry for selected years', () => {
      const patterns = computeHistoricalPatterns(activities, materias);

      for (const targetYear of [2018, 2020, 2024]) {
        const heatmap = computeActivityHeatmap(activities, targetYear);
        const historyEntry = patterns.history.years.find(y => y.year === targetYear);

        assert.ok(historyEntry, `History entry for ${targetYear} must exist`);
        assert.ok(
          Math.abs(heatmap.totalYearHours - historyEntry.totalHours) <= 0.2,
          `Heatmap year hours (${heatmap.totalYearHours}) must match history totalHours (${historyEntry.totalHours}) for ${targetYear}`
        );
        assert.equal(
          heatmap.activeDaysCount,
          historyEntry.activeDaysCount,
          `Active days must match exactly for year ${targetYear}`
        );
      }
    });

    it('validates standalone mock format compatibility with Dashboard snapshot loader', () => {
      // The fixture should have all required properties expected by Dashboard & AprovadoApi
      assert.ok(mockSnapshot.user, 'Mock must contain user object');
      assert.ok(mockSnapshot.user.Nome, 'User must have name');
      assert.ok(Array.isArray(mockSnapshot.materias), 'Mock must contain materias array');
      assert.ok(Array.isArray(mockSnapshot.atividades), 'Mock must contain atividades array');
      assert.ok(mockSnapshot.ciclo, 'Mock must contain ciclo object');
      assert.ok(mockSnapshot.syncedAt, 'Mock must contain syncedAt timestamp');

      // Verify that all activities reference valid materias
      const validMateriaIds = new Set(mockSnapshot.materias.map(m => m.Id));
      for (const a of mockSnapshot.atividades) {
        assert.ok(a.Materia, 'Activity must reference Materia');
        assert.ok(validMateriaIds.has(a.Materia.Id), `Materia ID ${a.Materia.Id} must exist in materias`);
      }
    });
  });

  describe('Tier 4: Real-World Student Application Scenarios', () => {
    it('Scenario 1: 11-Year Continuous Student (2016-2026) Complete Lifecycle', () => {
      // Exercised: F2, F3, F4, F5, F7, F9, F11, F12
      const patterns = computeHistoricalPatterns(activities, materias);

      // Complete lifecycle span
      assert.equal(patterns.history.years.length, 11);
      assert.equal(patterns.history.startYear, 2016);
      assert.equal(patterns.history.endYear, 2026);

      // Demonstrates 3 distinct lifecycle phases: Maintenance -> Intensive -> Hiatus -> Maintenance -> Intensive
      const phases = patterns.history.years.map(y => y.phase);
      assert.ok(phases.includes('ALTA_INTENSIDADE'));
      assert.ok(phases.includes('MANUTENCAO'));
      assert.ok(phases.includes('HIATO'));

      // Peak year detected
      assert.ok(patterns.history.peakYear.hours > 600);

      // Heatmap coverage in leap year 2024
      assert.equal(patterns.heatmap.totalDays, 365); // Default year is non-leap (or 366 for 2024)

      // Circadian & weekly ranking
      assert.equal(patterns.circadian.hourly.length, 24);
      assert.equal(patterns.circadian.weekdayRanking.length, 7);

      // All 4 quadrants populated
      assert.ok(patterns.quadrants.quadrants.pontosFortes.length > 0);
      assert.ok(patterns.quadrants.quadrants.gargalosCriticos.length > 0);
      assert.ok(patterns.quadrants.quadrants.baseSolida.length > 0);
      assert.ok(patterns.quadrants.quadrants.zonaRisco.length > 0);

      // NLG Insights comprehensive report
      assert.ok(patterns.insights.executiveSummary.length > 50);
      assert.ok(patterns.insights.quadrantInsights.length > 50);
      assert.ok(patterns.insights.methodRecommendations.length > 0);
    });

    it('Scenario 2: Interrupted Study Journey with Extended Hiatus & Resumption', () => {
      // Exercised: F2, F3, F4, F5, F7, F12
      // 2019 was high intensity, 2020 was a severe Hiatus (<50h), 2021 was resumption (Maintenance)
      const patterns = computeHistoricalPatterns(activities, materias);
      const yearMap = Object.fromEntries(patterns.history.years.map(y => [y.year, y]));

      const y2019 = yearMap[2019];
      const y2020 = yearMap[2020];
      const y2021 = yearMap[2021];

      // Pre-hiatus peak
      assert.equal(y2019.phase, 'ALTA_INTENSIDADE');
      assert.ok(y2019.totalHours >= 350);

      // Hiatus year
      assert.equal(y2020.phase, 'HIATO');
      assert.ok(y2020.totalHours < 50.0);
      assert.ok(y2020.activeDaysCount < 20);

      // Post-hiatus recovery
      assert.equal(y2021.phase, 'MANUTENCAO');
      assert.ok(y2021.totalHours >= 50.0);
      assert.ok(y2021.activeDaysCount >= 20);

      // Heatmap of hiatus year shows vast majority of days at level 0
      const hiatusHeatmap = computeActivityHeatmap(activities, 2020);
      assert.equal(hiatusHeatmap.totalDays, 366); // 2020 is leap
      assert.ok(hiatusHeatmap.activeDaysCount < 20);

      const level0Days = hiatusHeatmap.weeks
        .flatMap(w => w.days)
        .filter(d => d.inTargetYear && d.level === 0);
      assert.ok(level0Days.length >= 346, 'Over 346 days must have level 0 in hiatus year');
    });

    it('Scenario 3: Intense Pre-Exam Sprint (Alta Intensidade + Questions Heavy)', () => {
      // Exercised: F2, F3, F5, F9, F11, F12
      // Synthetic pre-exam sprint activities: 80% Questions, 380h over 6 months, high daily volume
      const sprintActivities = [];
      let id = 50001;
      for (let day = 1; day <= 160; day++) {
        // Daily session of 2.5h (400h total) across distinct calendar days
        const m = Math.floor((day - 1) / 28) + 1;
        const d = ((day - 1) % 28) + 1;
        const dateStr = `2024-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        sprintActivities.push({
          Id: id++,
          Inicio: `${dateStr}T14:00:00.000Z`,
          DataInicio: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/2024`,
          HoraInicio: `14:00`,
          Duracao: 2.5 * 3600000,
          TipoEstudo: day % 10 < 8 ? 'Questões' : 'Revisão',
          Materia: { Id: 1, Nome: 'Direito Constitucional', Cor: '#3b82f6' },
          ExercicioQuantidade: 50,
          ExercicioAcerto: 42
        });
      }

      const sprintHistory = computeMultiannualHistory(sprintActivities, 2024, 2024);
      assert.equal(sprintHistory.years[0].phase, 'ALTA_INTENSIDADE');
      assert.equal(sprintHistory.years[0].totalHours, 400);

      const sprintMix = computeMethodologicalMix(sprintActivities);
      assert.ok(sprintMix.proportions.questoes.percentage >= 75.0);

      // Warning or info about extreme question focus without enough theory
      const sprintNotice = sprintMix.recommendations.find(r =>
        r.title.includes('Risco de Platô') || r.title.includes('Excesso')
      );
      assert.ok(sprintNotice !== undefined);
    });

    it('Scenario 4: Night Owl Student with Extreme Shift Imbalance', () => {
      // Exercised: F5, F7, F8, F12
      // Student who only studies from 22h to 04h (Noite & Madrugada)
      const nightActivities = [
        { Id: 1, HoraInicio: '22:00', Duracao: 3 * 3600000, TipoEstudo: 'Teoria' },
        { Id: 2, HoraInicio: '23:30', Duracao: 2.5 * 3600000, TipoEstudo: 'Questões' },
        { Id: 3, HoraInicio: '01:00', Duracao: 2 * 3600000, TipoEstudo: 'Revisão' },
        { Id: 4, HoraInicio: '03:00', Duracao: 1.5 * 3600000, TipoEstudo: 'Questões' }
      ];

      const circadian = computeCircadianDistribution(nightActivities);

      // Combined night and madrugada should account for 100% of study time
      const nightPlusMadrugada = circadian.shifts.noite.percentage + circadian.shifts.madrugada.percentage;
      assert.equal(nightPlusMadrugada, 100.0);
      assert.equal(circadian.shifts.manha.percentage, 0.0);
      assert.equal(circadian.shifts.tarde.percentage, 0.0);

      // Dominant shift must be noite or madrugada
      assert.ok(['noite', 'madrugada'].includes(circadian.dominantShift));

      // NLG Insights reflects this shift
      const insights = generateStudyInsights(null, {
        history: computeMultiannualHistory(nightActivities),
        circadian,
        quadrants: computeYieldQuadrants([]),
        mix: computeMethodologicalMix(nightActivities)
      });
      assert.match(insights.circadianInsights, /noite|madrugada/i);
    });

    it('Scenario 5: Critical Bottleneck Recovery Diagnosis', () => {
      // Exercised: F7, F9, F10, F11, F12
      // A student having 300 hours in "Direito Administrativo" with only 52% accuracy (Gargalo Crítico)
      const bottleneckStudent = [
        {
          id: 1,
          name: 'Direito Administrativo',
          color: '#ef4444',
          totalHours: 300.0,
          questions: 1000,
          correct: 520,
          accuracy: 52.0
        },
        {
          id: 2,
          name: 'Direito Constitucional',
          color: '#3b82f6',
          totalHours: 350.0,
          questions: 1200,
          correct: 1056,
          accuracy: 88.0
        },
        {
          id: 3,
          name: 'Direito Tributário',
          color: '#10b981',
          totalHours: 50.0,
          questions: 200,
          correct: 180,
          accuracy: 90.0
        }
      ];

      const quadrants = computeYieldQuadrants(bottleneckStudent);

      // Verify bottleneck detection
      assert.equal(quadrants.summary.bottlenecksCount, 1);
      assert.equal(quadrants.quadrants.gargalosCriticos.length, 1);
      assert.equal(quadrants.quadrants.gargalosCriticos[0].name, 'Direito Administrativo');

      // Generate insights and verify warning is prominent in Portuguese NLG
      const insights = generateStudyInsights(null, {
        history: computeMultiannualHistory([]),
        circadian: computeCircadianDistribution([]),
        quadrants,
        mix: computeMethodologicalMix([])
      });

      assert.match(insights.quadrantInsights, /Direito Administrativo/);
      assert.match(insights.quadrantInsights, /gargalo|método|atenção/i);
    });
  });
});

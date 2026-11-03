/**
 * tests/mix_nlg.test.js
 *
 * Test suite for Methodological Mix & Rule-Based NLG Text Insights Synthesizer.
 * Verifies Tier 1 (Modality regex parsing, 5 diagnostic rules, Portuguese NLG synthesis)
 * and Tier 2 (Free-text variations, edge cases, graceful empty degradation).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  computeMethodologicalMix,
  generateStudyInsights,
  computeMultiannualHistory,
  computeCircadianDistribution,
  computeYieldQuadrants
} from '../shared/analytics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'multiannual_mock_2016_2026.json');
const mockSnapshot = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
const activities = mockSnapshot.atividades;

describe('Methodological Mix & Rule-Based NLG Insights Test Suite', () => {
  describe('Tier 1: Methodological Mix Engine (F8/F11)', () => {
    it('classifies study modalities into Teoria, Questões, Revisão and Outros', () => {
      const result = computeMethodologicalMix(activities);
      const { proportions } = result;

      assert.ok(proportions.teoria.hours > 0);
      assert.ok(proportions.questoes.hours > 0);
      assert.ok(proportions.revisao.hours > 0);
      assert.ok(proportions.outros.hours >= 0);

      const totalPercentage =
        proportions.teoria.percentage +
        proportions.questoes.percentage +
        proportions.revisao.percentage +
        proportions.outros.percentage;

      assert.ok(
        Math.abs(totalPercentage - 100.0) < 0.2,
        `Proportions must sum to 100% (got ${totalPercentage}%)`
      );
    });

    it('triggers Rule 1 (critical) when questions are below 25%', () => {
      // 80% Teoria, 10% Questões, 10% Revisão
      const lowQuestionsActivities = [
        { Id: 1, TipoEstudo: 'Teoria', Duracao: 80 * 3600000 },
        { Id: 2, TipoEstudo: 'Questões', Duracao: 10 * 3600000 },
        { Id: 3, TipoEstudo: 'Revisão', Duracao: 10 * 3600000 }
      ];

      const res = computeMethodologicalMix(lowQuestionsActivities);
      const rule1 = res.recommendations.find(r => r.title.includes('Baixa Resolução de Questões'));

      assert.ok(rule1, 'Must trigger Baixa Resolução de Questões');
      assert.equal(rule1.severity, 'critical');
      assert.match(rule1.text, /10,0%/);
    });

    it('triggers Rule 2 (warning) when theory exceeds 60%', () => {
      const highTheoryActivities = [
        { Id: 1, TipoEstudo: 'Teoria', Duracao: 70 * 3600000 },
        { Id: 2, TipoEstudo: 'Questões', Duracao: 25 * 3600000 },
        { Id: 3, TipoEstudo: 'Revisão', Duracao: 5 * 3600000 }
      ];

      const res = computeMethodologicalMix(highTheoryActivities);
      const rule2 = res.recommendations.find(r => r.title.includes('Excesso de Teoria Passiva'));

      assert.ok(rule2, 'Must trigger Excesso de Teoria Passiva');
      assert.equal(rule2.severity, 'warning');
      assert.match(rule2.text, /70,0%/);
    });

    it('triggers Rule 3 (critical) when revision is below 10%', () => {
      const lowReviewActivities = [
        { Id: 1, TipoEstudo: 'Teoria', Duracao: 55 * 3600000 },
        { Id: 2, TipoEstudo: 'Questões', Duracao: 40 * 3600000 },
        { Id: 3, TipoEstudo: 'Revisão', Duracao: 5 * 3600000 } // 5% review
      ];

      const res = computeMethodologicalMix(lowReviewActivities);
      const rule3 = res.recommendations.find(r => r.title.includes('Déficit de Revisão Espaçada'));

      assert.ok(rule3, 'Must trigger Déficit de Revisão Espaçada');
      assert.equal(rule3.severity, 'critical');
      assert.match(rule3.text, /5,0%/);
    });

    it('triggers Rule 4 (info) when questions > 70% and theory < 15%', () => {
      const questionsHeavyActivities = [
        { Id: 1, TipoEstudo: 'Questões', Duracao: 75 * 3600000 }, // 75%
        { Id: 2, TipoEstudo: 'Teoria', Duracao: 10 * 3600000 },   // 10%
        { Id: 3, TipoEstudo: 'Revisão', Duracao: 15 * 3600000 }  // 15%
      ];

      const res = computeMethodologicalMix(questionsHeavyActivities);
      const rule4 = res.recommendations.find(r => r.title.includes('Risco de Platô por Falta de Base'));

      assert.ok(rule4, 'Must trigger Risco de Platô por Falta de Base');
      assert.equal(rule4.severity, 'info');
    });

    it('triggers Rule 5 (success) when mix is well balanced', () => {
      // 45% Teoria, 40% Questões, 15% Revisão -> all healthy
      const balancedActivities = [
        { Id: 1, TipoEstudo: 'Teoria', Duracao: 45 * 3600000 },
        { Id: 2, TipoEstudo: 'Questões', Duracao: 40 * 3600000 },
        { Id: 3, TipoEstudo: 'Revisão', Duracao: 15 * 3600000 }
      ];

      const res = computeMethodologicalMix(balancedActivities);
      assert.equal(res.recommendations.length, 1);
      assert.equal(res.recommendations[0].severity, 'success');
      assert.equal(res.recommendations[0].title, 'Mix de Estudo Equilibrado');
    });
  });

  describe('Tier 1: Rule-Based NLG Text Insights Synthesizer (F9/F12)', () => {
    // Generate integrated pattern objects
    const history = computeMultiannualHistory(activities, 2016, 2026);
    const circadian = computeCircadianDistribution(activities);
    const mix = computeMethodologicalMix(activities);

    // Build subject summary
    const map = new Map();
    mockSnapshot.materias.forEach(m => {
      map.set(m.Id, {
        id: m.Id,
        name: m.Nome,
        color: m.Cor,
        durationMs: 0,
        totalHours: 0,
        questions: 0,
        correct: 0,
        accuracy: null
      });
    });
    for (const a of activities) {
      if (!a.Materia) continue;
      const s = map.get(a.Materia.Id);
      if (!s) continue;
      s.durationMs += a.Duracao || 0;
      s.questions += a.ExercicioQuantidade || 0;
      s.correct += a.ExercicioAcerto || 0;
    }
    for (const s of map.values()) {
      s.totalHours = Number((s.durationMs / 3600000).toFixed(1));
      s.accuracy = s.questions > 0 ? Number(((s.correct / s.questions) * 100).toFixed(1)) : null;
    }
    const quadrants = computeYieldQuadrants(Array.from(map.values()));

    it('generates executive summary with multiannual volume and current phase', () => {
      const insights = generateStudyInsights(null, { history, circadian, quadrants, mix });

      assert.ok(typeof insights.executiveSummary === 'string');
      assert.match(insights.executiveSummary, /2016/);
      assert.match(insights.executiveSummary, /2026/);
      assert.match(insights.executiveSummary, /horas/i);
      assert.match(insights.executiveSummary, /sessões/i);
      assert.match(insights.executiveSummary, /questões/i);
    });

    it('generates circadian insights mentioning dominant shift and peak hour', () => {
      const insights = generateStudyInsights(null, { history, circadian, quadrants, mix });

      assert.ok(typeof insights.circadianInsights === 'string');
      assert.match(insights.circadianInsights, /cronotipo|turno/i);
      assert.match(insights.circadianInsights, /\d{1,2}h/); // Peak hour format
    });

    it('generates weekly cadence insights identifying best day of the week', () => {
      const insights = generateStudyInsights(null, { history, circadian, quadrants, mix });

      assert.ok(typeof insights.weeklyCadenceInsights === 'string');
      assert.match(insights.weeklyCadenceInsights, /volume|semanal|lidera/i);
    });

    it('generates quadrant diagnostic text highlighting strong points and bottlenecks', () => {
      const insights = generateStudyInsights(null, { history, circadian, quadrants, mix });

      assert.ok(typeof insights.quadrantInsights === 'string');
      // Should mention Direito Constitucional (strong point) and Direito Administrativo (bottleneck)
      assert.match(insights.quadrantInsights, /Direito Constitucional/);
      assert.match(insights.quadrantInsights, /Direito Administrativo/);
      assert.match(insights.quadrantInsights, /gargalo|método|atenção/i);
    });

    it('produces fullFormattedText combining all 5 structured sections', () => {
      const insights = generateStudyInsights(null, { history, circadian, quadrants, mix });

      assert.ok(typeof insights.fullFormattedText === 'string');
      assert.ok(insights.fullFormattedText.length > 300, 'Full text should be comprehensive');
      assert.ok(Array.isArray(insights.methodRecommendations));
      assert.ok(insights.methodRecommendations.length > 0);
    });
  });

  describe('Tier 2: Boundary & Corner Cases', () => {
    it('handles regex variations in modality names (accents, cases, synonyms)', () => {
      const variations = [
        { Id: 1, TipoEstudo: 'questões', Duracao: 3600000 },
        { Id: 2, TipoEstudo: 'EXERCICIOS', Duracao: 3600000 },
        { Id: 3, TipoEstudo: 'Simulado Gabaritado', Duracao: 3600000 },
        { Id: 4, TipoEstudo: 'Doutrina e Videoaula', Duracao: 3600000 },
        { Id: 5, TipoEstudo: 'revisão espaçada', Duracao: 3600000 },
        { Id: 6, TipoEstudo: 'Flashcards Anki', Duracao: 3600000 },
        { Id: 7, TipoEstudo: 'Outra Atividade Qualquer', Duracao: 3600000 }
      ];

      const res = computeMethodologicalMix(variations);

      // Questões: items 1, 2, 3 -> 3h
      assert.equal(res.proportions.questoes.hours, 3.0);

      // Teoria: item 4 -> 1h
      assert.equal(res.proportions.teoria.hours, 1.0);

      // Revisão: items 5, 6 -> 2h
      assert.equal(res.proportions.revisao.hours, 2.0);

      // Outros: item 7 -> 1h
      assert.equal(res.proportions.outros.hours, 1.0);
    });

    it('handles empty activities in computeMethodologicalMix without division by zero', () => {
      const res = computeMethodologicalMix([]);

      assert.equal(res.proportions.teoria.hours, 0);
      assert.equal(res.proportions.teoria.percentage, 0);
      assert.equal(res.proportions.questoes.percentage, 0);
      assert.equal(res.proportions.revisao.percentage, 0);
      assert.equal(res.proportions.outros.percentage, 0);
    });

    it('generates study insights gracefully when patterns are empty or minimal', () => {
      const emptyHistory = computeMultiannualHistory([]);
      const emptyCircadian = computeCircadianDistribution([]);
      const emptyQuadrants = computeYieldQuadrants([]);
      const emptyMix = computeMethodologicalMix([]);

      const insights = generateStudyInsights(null, {
        history: emptyHistory,
        circadian: emptyCircadian,
        quadrants: emptyQuadrants,
        mix: emptyMix
      });

      assert.ok(typeof insights.executiveSummary === 'string');
      assert.ok(typeof insights.circadianInsights === 'string');
      assert.ok(typeof insights.weeklyCadenceInsights === 'string');
      assert.ok(typeof insights.quadrantInsights === 'string');
      assert.ok(typeof insights.fullFormattedText === 'string');
    });
  });
});

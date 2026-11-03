/**
 * tests/quadrants.test.js
 *
 * Test suite for Yield Quadrant Matrix Engine (Matriz de Quadrantes de Rendimento).
 * Verifies Tier 1 (4 Quadrants, median cutoff, 75% accuracy cutoff)
 * and Tier 2 (0 questions, 100% accuracy, 0% accuracy, single subject, custom cutoffs).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeYieldQuadrants } from '../shared/analytics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'multiannual_mock_2016_2026.json');
const mockSnapshot = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));

// Helper to build subjectsSummary from mock activities
function buildSubjectsSummary(activities, materias) {
  const map = new Map();
  materias.forEach(m => {
    map.set(m.Id, {
      id: m.Id,
      name: m.Nome,
      color: m.Cor || '#3b82f6',
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

  return Array.from(map.values());
}

describe('Yield Quadrant Matrix Test Suite', () => {
  const subjectsSummary = buildSubjectsSummary(mockSnapshot.atividades, mockSnapshot.materias);

  describe('Tier 1: 4-Quadrant Partitioning & Summary (F7/F9)', () => {
    it('calculates median study hours and uses 75.0% accuracy cutoff by default', () => {
      const result = computeYieldQuadrants(subjectsSummary);

      assert.ok(result.medianHours > 0);
      assert.equal(result.accuracyCutoff, 75.0);
      assert.equal(result.summary.totalSubjects, subjectsSummary.length);
    });

    it('populates all 4 quadrants plus the semExercicios bucket from fixture data', () => {
      const result = computeYieldQuadrants(subjectsSummary);
      const { quadrants } = result;

      // Q1: Pontos Fortes (Hours >= median && Acc >= 75%)
      assert.ok(quadrants.pontosFortes.length > 0, 'Pontos Fortes must have subjects');
      for (const s of quadrants.pontosFortes) {
        assert.ok(s.totalHours >= result.medianHours);
        assert.ok(s.accuracy >= 75.0);
      }

      // Q2: Gargalos Críticos (Hours >= median && Acc < 75%)
      assert.ok(quadrants.gargalosCriticos.length > 0, 'Gargalos Críticos must have subjects');
      for (const s of quadrants.gargalosCriticos) {
        assert.ok(s.totalHours >= result.medianHours);
        assert.ok(s.accuracy < 75.0);
      }

      // Q3: Base Sólida (Hours < median && Acc >= 75%)
      assert.ok(quadrants.baseSolida.length > 0, 'Base Sólida must have subjects');
      for (const s of quadrants.baseSolida) {
        assert.ok(s.totalHours < result.medianHours);
        assert.ok(s.accuracy >= 75.0);
      }

      // Q4: Zona de Risco / Negligência (Hours < median && Acc < 75%)
      assert.ok(quadrants.zonaRisco.length > 0, 'Zona de Risco must have subjects');
      for (const s of quadrants.zonaRisco) {
        assert.ok(s.totalHours < result.medianHours);
        assert.ok(s.accuracy < 75.0);
      }

      // Special: Sem Exercícios (questions === 0)
      assert.ok(quadrants.semExercicios.length > 0, 'Sem Exercícios bucket must have subjects');
      for (const s of quadrants.semExercicios) {
        assert.equal(s.questions, 0);
      }
    });

    it('identifies exact expected subjects in their planned quadrants', () => {
      const result = computeYieldQuadrants(subjectsSummary);

      const findIn = (arr, name) => arr.find(s => s.name === name);

      // Direito Constitucional -> Pontos Fortes
      assert.ok(findIn(result.quadrants.pontosFortes, 'Direito Constitucional'));

      // Direito Administrativo -> Gargalos Críticos
      assert.ok(findIn(result.quadrants.gargalosCriticos, 'Direito Administrativo'));

      // Direito Tributário -> Base Sólida
      assert.ok(findIn(result.quadrants.baseSolida, 'Direito Tributário'));

      // Contabilidade Geral -> Zona de Risco
      assert.ok(findIn(result.quadrants.zonaRisco, 'Contabilidade Geral'));

      // Direito Penal -> Sem Exercícios
      assert.ok(findIn(result.quadrants.semExercicios, 'Direito Penal'));
    });

    it('counts total bottlenecks and strong subjects in summary', () => {
      const result = computeYieldQuadrants(subjectsSummary);

      assert.equal(result.summary.bottlenecksCount, result.quadrants.gargalosCriticos.length);
      assert.equal(result.summary.strongCount, result.quadrants.pontosFortes.length);
    });
  });

  describe('Tier 2: Boundary & Corner Cases', () => {
    it('handles empty subjects list gracefully', () => {
      const result = computeYieldQuadrants([]);

      assert.equal(result.medianHours, 20.0);
      assert.equal(result.accuracyCutoff, 75.0);
      assert.equal(result.summary.totalSubjects, 0);
      assert.equal(result.summary.bottlenecksCount, 0);
      assert.equal(result.summary.strongCount, 0);
      assert.deepEqual(result.quadrants.pontosFortes, []);
      assert.deepEqual(result.quadrants.gargalosCriticos, []);
      assert.deepEqual(result.quadrants.baseSolida, []);
      assert.deepEqual(result.quadrants.zonaRisco, []);
      assert.deepEqual(result.quadrants.semExercicios, []);
    });

    it('classifies exact boundary values for median hours and accuracy', () => {
      const boundarySubjects = [
        // Exact median (50h) & exact accuracy (75.0%) -> Q1 Pontos Fortes
        { id: 1, name: 'Exact Median & Cutoff', totalHours: 50.0, questions: 100, correct: 75, accuracy: 75.0 },
        // Exact median (50h) & just below accuracy (74.9%) -> Q2 Gargalos Críticos
        { id: 2, name: 'Exact Median & Below Cutoff', totalHours: 50.0, questions: 100, correct: 74, accuracy: 74.0 },
        // Just below median (49.9h) & exact accuracy (75.0%) -> Q3 Base Sólida
        { id: 3, name: 'Below Median & Cutoff', totalHours: 49.9, questions: 100, correct: 75, accuracy: 75.0 },
        // Just below median (49.9h) & below accuracy (74.0%) -> Q4 Zona Risco
        { id: 4, name: 'Below Median & Below Cutoff', totalHours: 49.9, questions: 100, correct: 74, accuracy: 74.0 }
      ];

      // Custom median fixed at 50.0h for exact boundary test
      const result = computeYieldQuadrants(boundarySubjects, { customMedianHours: 50.0 });

      assert.equal(result.quadrants.pontosFortes.length, 1);
      assert.equal(result.quadrants.pontosFortes[0].name, 'Exact Median & Cutoff');

      assert.equal(result.quadrants.gargalosCriticos.length, 1);
      assert.equal(result.quadrants.gargalosCriticos[0].name, 'Exact Median & Below Cutoff');

      assert.equal(result.quadrants.baseSolida.length, 1);
      assert.equal(result.quadrants.baseSolida[0].name, 'Below Median & Cutoff');

      assert.equal(result.quadrants.zonaRisco.length, 1);
      assert.equal(result.quadrants.zonaRisco[0].name, 'Below Median & Below Cutoff');
    });

    it('handles single subject without collapsing into division errors', () => {
      const single = [
        { id: 1, name: 'Única Disciplina', totalHours: 35.0, questions: 50, correct: 40, accuracy: 80.0 }
      ];

      const result = computeYieldQuadrants(single);
      assert.ok(result.medianHours > 0);
      assert.equal(result.summary.totalSubjects, 1);
    });

    it('handles subject with 100% accuracy and 0% accuracy correctly', () => {
      const testCases = [
        // 100% accuracy
        { id: 1, name: 'Perfeito', totalHours: 100.0, questions: 50, correct: 50, accuracy: 100.0 },
        // 0% accuracy with exercises
        { id: 2, name: 'Zero Acertos', totalHours: 100.0, questions: 50, correct: 0, accuracy: 0.0 }
      ];

      const result = computeYieldQuadrants(testCases);

      const perfect = result.quadrants.pontosFortes.find(s => s.name === 'Perfeito');
      assert.ok(perfect);
      assert.equal(perfect.accuracy, 100.0);

      // Zero acertos with 50 questions answered must be in Gargalos Críticos, NOT in semExercicios
      const zero = result.quadrants.gargalosCriticos.find(s => s.name === 'Zero Acertos');
      assert.ok(zero);
      assert.equal(zero.accuracy, 0.0);
      assert.equal(result.quadrants.semExercicios.length, 0);
    });

    it('allows custom accuracy cutoff parameter', () => {
      const sub = [
        { id: 1, name: 'Sub80', totalHours: 100.0, questions: 100, correct: 78, accuracy: 78.0 }
      ];

      // At default 75%, 78% is Pontos Fortes
      const resDefault = computeYieldQuadrants(sub, { customMedianHours: 50.0 });
      assert.equal(resDefault.quadrants.pontosFortes.length, 1);

      // At custom 85%, 78% becomes Gargalo Crítico!
      const resCustom = computeYieldQuadrants(sub, { accuracyCutoff: 85.0, customMedianHours: 50.0 });
      assert.equal(resCustom.accuracyCutoff, 85.0);
      assert.equal(resCustom.quadrants.gargalosCriticos.length, 1);
      assert.equal(resCustom.quadrants.pontosFortes.length, 0);
    });
  });
});

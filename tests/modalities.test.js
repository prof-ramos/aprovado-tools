import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  classifyModality, groupByModality, computeStudyMetrics, computeMethodologicalMix
} from '../shared/analytics.js';

const hour = 3600000;
const atv = (TipoEstudo, hours = 1, extra = {}) => ({ Inicio: '2026-05-04T10:00:00', Duracao: hours * hour, TipoEstudo, ...extra });

describe('classifyModality', () => {
  it('groups study types into Teoria, Questões, Revisão and Outros', () => {
    const expected = {
      'Teoria': 'teoria', 'Leitura de lei seca': 'teoria', 'Videoaula': 'teoria', 'PDF': 'teoria',
      'Questões': 'questoes', 'Simulado': 'questoes', 'Exercícios': 'questoes',
      'Revisão': 'revisao', 'Flashcards': 'revisao', 'Resumo': 'revisao',
      'Palestra': 'outros', 'Planejamento': 'outros'
    };
    for (const [type, group] of Object.entries(expected)) assert.equal(classifyModality(atv(type)), group, type);
  });

  it('treats a generic or empty type with questions as Questões, and without as Outros', () => {
    assert.equal(classifyModality(atv('Geral', 1, { ExercicioQuantidade: 10 })), 'questoes');
    assert.equal(classifyModality(atv('', 1, { ExercicioQuantidade: 5 })), 'questoes');
    assert.equal(classifyModality(atv('Geral')), 'outros');
    assert.equal(classifyModality({}), 'outros');
    assert.equal(classifyModality(null), 'outros');
  });
});

describe('modalities are the same in "Modalidades e hábitos" and in the methodological mix', () => {
  const sample = [
    atv('Teoria', 2), atv('Leitura de lei seca', 1.5), atv('Videoaula', 0.5),
    atv('Questões', 3, { ExercicioQuantidade: 20, ExercicioAcerto: 15 }), atv('Revisão', 1), atv('Palestra', 0.25),
    atv('Geral', 0.75, { ExercicioQuantidade: 4, ExercicioAcerto: 2 })
  ];

  it('gives identical hours and percentages for every category', () => {
    const modalities = Object.fromEntries(computeStudyMetrics(sample).modalities.map(m => [m.key, m]));
    const mix = computeMethodologicalMix(sample).proportions;
    for (const key of ['teoria', 'questoes', 'revisao', 'outros']) {
      assert.equal(modalities[key].percentage, mix[key].percentage, `${key} percentage`);
      assert.equal(modalities[key].hours, mix[key].hours, `${key} hours`);
    }
    assert.equal(modalities.teoria.hours, 4);
  });

  it('keeps Teoria equal on the synthetic multiannual fixture', () => {
    const { atividades, materias } = JSON.parse(readFileSync(new URL('./fixtures/multiannual_mock_2016_2026.json', import.meta.url), 'utf8'));
    const teoria = computeStudyMetrics(atividades, materias).modalities.find(m => m.key === 'teoria');
    const mix = computeMethodologicalMix(atividades).proportions;
    assert.equal(teoria.percentage, mix.teoria.percentage);
    assert.ok(teoria.percentage > 0);
  });

  it('adds up to every recorded millisecond and keeps zero-valued categories', () => {
    const groups = groupByModality([atv('Teoria', 1), atv('Teoria', 1)]);
    assert.deepEqual(groups.map(g => g.key), ['teoria', 'questoes', 'revisao', 'outros']);
    assert.equal(groups.reduce((sum, g) => sum + g.durationMs, 0), 2 * hour);
    assert.equal(groups.find(g => g.key === 'teoria').percentage, 100);
    assert.equal(groups.find(g => g.key === 'outros').percentage, 0);
    assert.equal(groupByModality([]).every(g => g.durationMs === 0 && g.percentage === 0), true);
  });
});

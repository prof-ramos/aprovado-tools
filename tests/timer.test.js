import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTimerState,
  startTimer,
  pauseTimer,
  resumeTimer,
  getElapsedMs,
  formatElapsedTimer,
  buildActivityPayload
} from '../shared/timer.js';

test('createTimerState inicializa timer com status stopped e duração 0', () => {
  const materia = { Id: 10, Nome: 'Direito Constitucional', Cor: '#3b82f6' };
  const conteudo = { Id: 101, Nome: 'Direitos Fundamentais' };
  const state = createTimerState(materia, conteudo);

  assert.strictEqual(state.status, 'stopped');
  assert.strictEqual(state.accumulatedMs, 0);
  assert.strictEqual(state.startTime, null);
  assert.strictEqual(state.initialStartTime, null);
  assert.deepStrictEqual(state.materia, materia);
  assert.deepStrictEqual(state.conteudo, conteudo);
});

test('startTimer inicia contagem a partir de um timestamp', () => {
  const state = createTimerState({ Id: 1, Nome: 'Direito' });
  const t0 = 1000000;
  const started = startTimer(state, t0);

  assert.strictEqual(started.status, 'running');
  assert.strictEqual(started.startTime, t0);
  assert.strictEqual(started.initialStartTime, t0);
  assert.strictEqual(started.accumulatedMs, 0);
  assert.strictEqual(getElapsedMs(started, t0 + 5000), 5000);
});

test('pauseTimer congela o tempo decorrido e atualiza accumulatedMs', () => {
  const state = createTimerState({ Id: 1, Nome: 'Direito' });
  const t0 = 1000000;
  const started = startTimer(state, t0);
  const paused = pauseTimer(started, t0 + 15000);

  assert.strictEqual(paused.status, 'paused');
  assert.strictEqual(paused.accumulatedMs, 15000);
  assert.strictEqual(paused.startTime, null);
  assert.strictEqual(paused.initialStartTime, t0);
  // Mesmo avançando o tempo atual, o tempo decorrido permanece congelado em 15s
  assert.strictEqual(getElapsedMs(paused, t0 + 99999), 15000);
});

test('resumeTimer retoma contagem preservando accumulatedMs e initialStartTime', () => {
  const state = createTimerState({ Id: 1, Nome: 'Direito' });
  const t0 = 1000000;
  const started = startTimer(state, t0);
  const paused = pauseTimer(started, t0 + 10000); // 10s acumulados

  const tResume = t0 + 50000; // pausa durou 40s
  const resumed = resumeTimer(paused, tResume);

  assert.strictEqual(resumed.status, 'running');
  assert.strictEqual(resumed.startTime, tResume);
  assert.strictEqual(resumed.initialStartTime, t0);
  assert.strictEqual(resumed.accumulatedMs, 10000);

  // 10s acumulados + 5s adicionais = 15s
  assert.strictEqual(getElapsedMs(resumed, tResume + 5000), 15000);
});

test('formatElapsedTimer formata milissegundos em HH:MM:SS e texto amigável', () => {
  const f1 = formatElapsedTimer(0);
  assert.deepStrictEqual(f1, {
    hours: '00',
    minutes: '00',
    seconds: '00',
    text: '00:00:00'
  });

  // 1h 23m 45s = (1*3600 + 23*60 + 45) * 1000 = 5025000 ms
  const f2 = formatElapsedTimer(5025000);
  assert.deepStrictEqual(f2, {
    hours: '01',
    minutes: '23',
    seconds: '45',
    text: '01:23:45'
  });
});

test('buildActivityPayload gera payload no formato esperado pelo endpoint Atividade/Novo', () => {
  const materia = { Id: 2, Nome: 'Administrativo', Cor: '#ff0000' };
  const conteudo = { Id: 202, Nome: 'Licitações' };
  const state = createTimerState(materia, conteudo);

  // Data fixada: 2026-11-16 09:15:30 local
  const initialDate = new Date(2026, 10, 16, 9, 15, 30);
  const t0 = initialDate.getTime();
  const started = startTimer(state, t0);
  const paused = pauseTimer(started, t0 + 3600000); // 1 hora de estudo

  const payload = buildActivityPayload(paused, {
    tipoEstudo: 'Teoria',
    exercicioQuantidade: 20,
    exercicioAcerto: 18,
    anotacoes: 'Estudo concluído sobre Licitações.'
  });

  assert.strictEqual(payload.Id, 0);
  assert.strictEqual(payload.Tipo, 'cronometro');
  assert.strictEqual(payload.Duracao, 3600000);
  assert.strictEqual(payload.DataInicio, '16/11/2026');
  assert.strictEqual(payload.HoraInicio, '09:15');
  assert.strictEqual(payload.SegundoInicio, '30');
  assert.deepStrictEqual(payload.Materia, { Id: 2, Nome: 'Administrativo', Cor: '#ff0000' });
  assert.deepStrictEqual(payload.Conteudo, { Id: 202, Nome: 'Licitações', Cor: '' });
  assert.strictEqual(payload.TipoEstudo, 'Teoria');
  assert.strictEqual(payload.ExercicioQuantidade, 20);
  assert.strictEqual(payload.ExercicioAcerto, 18);
  assert.strictEqual(payload.Anotacoes, 'Estudo concluído sobre Licitações.');
});

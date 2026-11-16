/**
 * Gerenciamento desacoplado de cronômetro de estudos.
 * Opera com timestamps para persistência em storage sem depender de timers em background.
 */

/**
 * Cria um estado inicial de cronômetro
 * @param {Object} materia - { Id, Nome, Cor }
 * @param {Object|null} conteudo - { Id, Nome, Cor }
 */
export function createTimerState(materia = null, conteudo = null) {
  return {
    status: 'stopped', // 'stopped' | 'running' | 'paused'
    startTime: null,
    initialStartTime: null,
    accumulatedMs: 0,
    materia: materia ? { Id: materia.Id, Nome: materia.Nome || '', Cor: materia.Cor || '' } : null,
    conteudo: conteudo ? { Id: conteudo.Id, Nome: conteudo.Nome || '' } : null
  };
}

/**
 * Inicia a contagem do cronômetro
 * @param {Object} state - Estado atual
 * @param {number} [nowMs=Date.now()] - Instante atual
 */
export function startTimer(state, nowMs = Date.now()) {
  return {
    ...state,
    status: 'running',
    startTime: nowMs,
    initialStartTime: state.initialStartTime || nowMs,
    accumulatedMs: state.accumulatedMs || 0
  };
}

/**
 * Pausa o cronômetro congelando o tempo decorrido
 * @param {Object} state - Estado atual
 * @param {number} [nowMs=Date.now()] - Instante atual
 */
export function pauseTimer(state, nowMs = Date.now()) {
  if (state.status !== 'running') return state;
  const elapsedSinceStart = state.startTime ? Math.max(0, nowMs - state.startTime) : 0;
  return {
    ...state,
    status: 'paused',
    startTime: null,
    accumulatedMs: (state.accumulatedMs || 0) + elapsedSinceStart
  };
}

/**
 * Retoma o cronômetro após uma pausa
 * @param {Object} state - Estado atual
 * @param {number} [nowMs=Date.now()] - Instante atual
 */
export function resumeTimer(state, nowMs = Date.now()) {
  if (state.status === 'running') return state;
  return {
    ...state,
    status: 'running',
    startTime: nowMs
  };
}

/**
 * Calcula o tempo decorrido total em milissegundos
 * @param {Object} state - Estado atual
 * @param {number} [nowMs=Date.now()] - Instante atual
 */
export function getElapsedMs(state, nowMs = Date.now()) {
  if (!state) return 0;
  const currentRunning = state.status === 'running' && state.startTime
    ? Math.max(0, nowMs - state.startTime)
    : 0;
  return (state.accumulatedMs || 0) + currentRunning;
}

/**
 * Formata milissegundos em HH:MM:SS
 * @param {number} ms - Duração em ms
 */
export function formatElapsedTimer(ms = 0) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = n => String(n).padStart(2, '0');
  const hStr = pad(hours);
  const mStr = pad(minutes);
  const sStr = pad(seconds);

  return {
    hours: hStr,
    minutes: mStr,
    seconds: sStr,
    text: `${hStr}:${mStr}:${sStr}`
  };
}

/**
 * Monta o objeto de payload pronto para envio em /service/Atividade/Novo
 * @param {Object} state - Estado do timer
 * @param {Object} options - Campos extras (tipoEstudo, exercicioQuantidade, etc.)
 * @param {number} [nowMs=Date.now()] - Instante de referência
 */
export function buildActivityPayload(state, options = {}, nowMs = Date.now()) {
  const duracao = getElapsedMs(state, nowMs);
  const startDate = state.initialStartTime ? new Date(state.initialStartTime) : new Date(nowMs - duracao);

  const pad = n => String(n).padStart(2, '0');
  const dataInicio = `${pad(startDate.getDate())}/${pad(startDate.getMonth() + 1)}/${startDate.getFullYear()}`;
  const horaInicio = `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`;
  const segundoInicio = pad(startDate.getSeconds());

  return {
    Id: 0,
    Materia: {
      Id: state.materia?.Id || 0,
      Nome: state.materia?.Nome || '',
      Cor: state.materia?.Cor || ''
    },
    Tipo: 'cronometro',
    Conteudo: {
      Id: state.conteudo?.Id || 0,
      Nome: state.conteudo?.Nome || '',
      Cor: state.conteudo?.Cor || ''
    },
    DataInicio: dataInicio,
    HoraInicio: horaInicio,
    SegundoInicio: segundoInicio,
    Duracao: duracao,
    DataNumero: 0,
    AgendamentoId: 0,
    AnotacoesRevisao: '',
    IsRevisando: false,
    TipoEstudo: options.tipoEstudo || null,
    ExercicioQuantidade: options.exercicioQuantidade !== undefined && options.exercicioQuantidade !== null ? Number(options.exercicioQuantidade) : null,
    ExercicioAcerto: options.exercicioAcerto !== undefined && options.exercicioAcerto !== null ? Number(options.exercicioAcerto) : null,
    Anotacoes: options.anotacoes || ''
  };
}

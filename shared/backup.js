/** Converte backup exportado ou snapshot em dados para visualização somente leitura. */
export function snapshotFromBackup(payload) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload) || !Array.isArray(payload.atividades)) {
    throw new Error('Arquivo de backup inválido: lista de atividades ausente.');
  }
  if (!['gerado_em', 'revisoes_pendentes', 'usuario', 'user', 'revisoesPendentes'].some(key => Object.hasOwn(payload, key))) {
    throw new Error('Arquivo de backup inválido: formato não reconhecido.');
  }
  const arr = value => Array.isArray(value) ? value : [];
  return {
    user: payload.usuario ?? payload.user ?? null,
    materias: arr(payload.materias),
    atividades: payload.atividades.filter(value => value !== null && typeof value === 'object' && !Array.isArray(value)),
    ciclo: payload.ciclo ?? null,
    revisoesPendentes: arr(payload.revisoes_pendentes ?? payload.revisoesPendentes),
    revisoesConcluidas: arr(payload.revisoes_concluidas ?? payload.revisoesConcluidas),
    syncedAt: payload.gerado_em ?? payload.syncedAt ?? null,
    source: 'backup'
  };
}

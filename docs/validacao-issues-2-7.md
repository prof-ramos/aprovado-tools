# Validação das issues 2–7 — 03/11/2026

- Suíte: 156/156 em UTC e America/Sao_Paulo, sem falhas.
- Extensão existente recarregada no Ego; dashboard `?mock=true` com 3.008 atividades e página sidepanel com dados reais renderizados e inspecionados visualmente. Não foi testado o encaixe nativo do sidepanel.
- Cache real: 4.814 atividades com Inicio ISO local sem offset. Inspecionado somente o padrão agregado, sem exportar dados pessoais. Teste adicionado para `2025-03-10T22:30:00`.
- CLI prof-ramos/aprovado commit 5623f1841af1f98e2c7a3e2a7807fbbf71a0ff43: exportar_backup_completo mantém chaves centrais compatíveis, acrescenta metricas_tempo/metricas_ciclo. Exportação real pelo CLI não executada.
- Spike: conversor permanece sem UI e fora do ZIP distribuído. Fixture possui 3.008 atividades, conforme teste e resultados corrigidos.

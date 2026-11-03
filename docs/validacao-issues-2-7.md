# Validação das issues 2–7 — 03/11/2026

- Suíte: 156/156 em UTC e America/Sao_Paulo, sem falhas.
- Extensão existente recarregada no Ego; dashboard `?mock=true` com 3.008 atividades e página sidepanel com dados reais renderizados e inspecionados visualmente.
- Painel lateral nativo validado no Chrome com a extensão local carregada: menu da barra de ferramentas → “Abrir Painel Lateral de Estudos”. A árvore de acessibilidade confirmou o conteúdo de `sidepanel/sidepanel.html` dentro do painel e sua alça de redimensionamento.
- Após entrar com os campos já preenchidos pelo navegador e acionar “Sincronizar”, o painel nativo confirmou o estado “Sincronizado” e exibiu 4.814 sessões, 2.019,7 horas, 1.471 dias e recorde de sequência de 36 dias. Isso substitui a limitação anterior de encaixe nativo não verificado; não foram testados todos os filtros e comandos de exportação do painel.
- Cache real: 4.814 atividades com Inicio ISO local sem offset. Inspecionado somente o padrão agregado, sem exportar dados pessoais. Teste adicionado para `2025-03-10T22:30:00`.
- CLI prof-ramos/aprovado commit 5623f1841af1f98e2c7a3e2a7807fbbf71a0ff43: exportar_backup_completo mantém chaves centrais compatíveis, acrescenta metricas_tempo/metricas_ciclo. Exportação real pelo CLI não executada.
- Spike: conversor permanece sem UI e fora do ZIP distribuído. Fixture possui 3.008 atividades, conforme teste e resultados corrigidos.

## Correção da duplicação

Mutações e reinjeções antes do próximo animation frame reproduziram 3 e 2 botões de topo. A checagem também dentro do callback impede a corrida. Dois testes executam o content.js real. Validação no Chrome após recarregar extensão e página: um botão “Exportar e métricas” no topo e um atalho flutuante distinto. Suíte integrada: 158/158 em UTC e São Paulo antes do teste adicional de compatibilidade CLI.

# Planos de Implementação

Gerados pela skill `improve` em 2026-11-03, contra o commit `bcf0ec0` (branch `feat/study-history-patterns`). Execute na ordem abaixo, salvo quando as dependências indicarem outra coisa. Cada executor deve ler o plano inteiro antes de começar, respeitar as Condições de PARADA e atualizar a própria linha ao terminar.

## Ordem de execução e status

| Plano | Título | Prioridade | Esforço | Depende de | Status |
|---|---|---|---|---|---|
| [001](001-fix-csv-semicolon-escaping.md) | CSV coloca entre aspas campos com `;` | P1 | S | — | TODO |
| [002](002-fail-loud-on-partial-sync.md) | Falha de sync não gera cache nem backup vazio | P1 | S | — | TODO |
| [003](003-escape-api-data-in-html.md) | Escapar dados da API antes de `innerHTML` | P1 | S–M | — | TODO |
| [004](004-local-time-day-bucketing.md) | Dia local na Visão Geral, sequência e filtro personalizado | P1 | M | (recomendado após 001 e 002) | TODO |
| [005](005-single-source-version.md) | Versão com fonte única no `manifest.json` | P3 | S | 001 | TODO |
| [006](006-spike-open-json-backup.md) | Spike: abrir backup JSON no dashboard | P3 | S | 003 (para a funcionalidade final) | TODO |

Valores de status: TODO | IN PROGRESS | DONE | BLOCKED (com motivo em uma linha) | REJECTED (com justificativa em uma linha)

## Notas de dependência

- **005 depois de 001**: os dois editam `shared/export.js`. Aplicar o 001 antes evita conflito.
- **004 depois de 001 e 002** (recomendação, não obrigação técnica): o 004 muda números que o usuário vê (dias ativos e sequência). As correções de baixo risco devem sair antes.
- **006 depende de 003** para a funcionalidade final, porque um backup aberto de arquivo é dado não confiável e precisa de render escapado. O spike em si (conversor e testes) pode rodar a qualquer momento.
- 001, 002 e 003 são independentes entre si e podem rodar em paralelo, em branches separadas.

## Verificação comum

Não há linter, typechecker, CI nem dependências. A única verificação automatizada é `npm test` (runner nativo do Node, hoje com 89 testes passando, todos da aba "Padrões Históricos"). Cada plano acrescenta os próprios testes, o que cobre, de passagem, os módulos antes sem teste: `shared/export.js`, `shared/api.js`, `computeStudyMetrics` e `filterActivitiesByPeriod`.

## Achados registrados mas não planejados (não selecionados nesta rodada)

- **Permissões provavelmente desnecessárias**: `tabs` (nada lê URL/título de abas, e a permissão gera o aviso "ler histórico de navegação") e `cookies` (usada só pelo handler `CHECK_LOGIN_STATUS`, `background.js:50-56`, que nada chama). Ver `manifest.json:30-35` e `CHROMEWEBSTORE.md:79,82`. Ao planejar, incluir teste manual de login depois da remoção.
- **Cache não é ligado ao usuário** (`shared/api.js:173-180`): ao trocar de conta, os dados da anterior aparecem por até 5 minutos. A checagem de auth em rede (`popup/popup.js:50`) acontece antes de consultar o cache, então o cache não economiza essa requisição.
- **Ideia: badge de revisões pendentes no ícone da extensão.** `pendingReviewsCount` é calculado (`shared/analytics.js:267`) e não é usado em lugar nenhum; o README promete alertas de atraso.
- **Métodos de API sem uso**: `getTimeReport`, `getStudyTypeReport`, `listSubjectsWithDuration` e `getHomeActivities` (`shared/api.js`). Remover, ou usar para "horas previstas vs cumpridas".

## Achados considerados e rejeitados

- **`MutationObserver` em `document.body` com `subtree`** (`content.js:68-74`): o callback só faz um `getElementById`; o custo é desprezível.
- **Permissão `unlimitedStorage`**: decisão documentada em `ARCHITECTURE.md §5.4` (históricos de 10+ anos).
- **Modo mock carregando fixture**: já restrito a `?mock=true` no commit `bcf0ec0`, e o fixture não entra no ZIP (`build:zip` não inclui `tests/`).
- **`...options` sobrescrevendo `headers` mesclados** em `request()` (`shared/api.js:16-21`): nenhum chamador passa `headers`, então não há efeito hoje.

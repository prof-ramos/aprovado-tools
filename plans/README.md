# Planos de Implementação

Gerados pela skill `improve` em 2026-11-03, contra o commit `bcf0ec0` (reconciliados com `c8b055e`) (branch `feat/study-history-patterns`). Execute na ordem abaixo, salvo quando as dependências indicarem outra coisa. Cada executor deve ler o plano inteiro antes de começar, respeitar as Condições de PARADA e atualizar a própria linha ao terminar.

## Ordem de execução e status

| Plano | Título | Prioridade | Esforço | Depende de | Issue | Status |
|---|---|---|---|---|---|---|
| [001](001-fix-csv-semicolon-escaping.md) | CSV coloca entre aspas campos com `;` | P1 | S | — | #2 | DONE |
| [002](002-fail-loud-on-partial-sync.md) | Falha de sync não gera cache nem backup vazio | P1 | S | — | #3 | DONE |
| [003](003-escape-api-data-in-html.md) | Escapar dados da API antes de `innerHTML` | P1 | S–M | — | #7 | DONE |
| [004](004-local-time-day-bucketing.md) | Dia local na Visão Geral, sequência e filtro personalizado | P1 | M | (recomendado após 001 e 002) | #4 | DONE |
| [005](005-single-source-version.md) | Versão com fonte única no `manifest.json` | P3 | S | 001 | #5 | DONE |
| [006](006-spike-open-json-backup.md) | Spike: abrir backup JSON no dashboard | P3 | S | 003 (para a funcionalidade final) | #6 | DONE |

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

## Notas de execução (2026-11-03)

- Todos os planos DONE, em commits separados na branch `feat/study-history-patterns`; revisão independente aprovou todos. Foram acrescentados na revisão um teste de sequência com `Date` fixado (004) e a checagem da chave `user` no teste de ida e volta (006).
- 003 foi adaptado ao código vivo: usa `escapeHtml`/`sanitizeColor` de `shared/ui.js` (sem `shared/html.js`). Verificação manual do render (Passo 7) não foi feita.
- Correção fora dos planos: `scripts/generate_multiannual_mock.js` agora compara `realpath` ao detectar execução direta (o teste de CLI do gerador falhava no macOS, onde `tmpdir()` é symlink). Commit separado.
- 004: a hipótese sobre o formato real de `Inicio` na API continua NÃO verificada (fixture só usa ISO com `Z`); conferir com backup real antes do lançamento.
- 006: `shared/backup.js` é código ainda não ligado à UI (vai no ZIP, sem efeito).
- Contagem real do fixture: 3.008 atividades (o plano citava 3.030).

## Resultados do spike (plano 006)

1. UI: "Abrir backup…" no menu `#export-menu`, com banner persistente (data do backup e ação "Voltar aos dados ao vivo").
2. Leitura: `<input type="file" accept="application/json,.json">`, `file.text()` e `JSON.parse`, sem nova permissão (não verificado manualmente no Chrome desktop).
3. Persistência: não gravar em `chrome.storage.local`; snapshot importado só em memória, somente leitura.
4. Tamanho: fixture real com 3.008 atividades, 1.693.392 bytes, leitura + parse de 7 a 17 ms. Limite inicial sugerido de 50 MB.
5. Sincronizar: desabilitado enquanto se visualiza um backup.
6. CLI `prof-ramos/aprovado`: formato não verificado; conferir exportador e amostra sanitizada.
7. Próximo plano: tocar `dashboard/dashboard.html/.js/.css` reutilizando `shared/backup.js`; esforço M (1–2 dias com QA).

Detalhes completos em `006-spike-open-json-backup.md`.

## Achado não planejado (resumo)

Permissões `tabs` e `cookies` provavelmente desnecessárias, cache sem vínculo com o usuário e badge de revisões pendentes: ver seção "Achados registrados mas não planejados" acima.

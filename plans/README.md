# Planos de Implementação

Gerados pela skill `improve` em 2026-11-03, contra o commit `bcf0ec0` (reconciliados com `c8b055e`) (branch `feat/study-history-patterns`). Execute na ordem abaixo, salvo quando as dependências indicarem outra coisa. Cada executor deve ler o plano inteiro antes de começar, respeitar as Condições de PARADA e atualizar a própria linha ao terminar.

## Antes de delegar ou retomar um plano

O coordenador reconcilia o plano uma vez antes de distribuir a execução:

1. Confira `git status --short` e identifique o commit-base do plano e o `HEAD` atual. Compare o diff dos arquivos do escopo e os trechos de “Estado atual” com o código vivo. Resultado: mudanças pertinentes e alterações preexistentes identificadas; um diff fora do escopo, sozinho, não bloqueia a tarefa.
2. Registre no próprio plano uma nota de reconciliação com os dois commits, o que já foi resolvido e os passos, arquivos e critérios ainda necessários. Preserve a referência original e os resultados históricos. Resultado: o executor recebe um plano aplicável ao código atual; divergências que mudem o objetivo ou invalidem um critério ficam explicitadas para resolução antes da execução dependente.
3. Distribua escopos de escrita sem sobreposição; quando dois planos tocarem o mesmo arquivo, ordene-os ou atribua a integração a um único responsável. Resultado: cada executor conhece arquivos, dependências, verificações e responsável pelo índice.
4. Ao receber o trabalho, confira o diff e execute as verificações pertinentes sobre o estado integrado antes de atualizar o status. Resultado: `DONE` aponta para evidências atuais, com limitações registradas no plano.

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

Na baseline `bcf0ec0`, a suíte tinha 89 testes de padrões históricos. O comando atual e a geração prévia do fixture estão em `package.json`; a matriz de CI está em [test.yml](../.github/workflows/test.yml) e executa a suíte em Node 18/22/24/26 e UTC/São Paulo. Não há dependências npm, linter ou typechecker configurados. A rodada concluída na PR #9 chegou a 159 testes, incluindo exportação, API, datas locais, backup e reinjeção dos controles.

## Achados registrados mas não planejados (não selecionados nesta rodada)

- **Permissões provavelmente desnecessárias**: `tabs` (nada lê URL/título de abas, e a permissão gera o aviso "ler histórico de navegação") e `cookies` (usada só pelo handler `CHECK_LOGIN_STATUS`, `background.js:50-56`, que nada chama). Ver `manifest.json:30-35` e `CHROMEWEBSTORE.md:79,82`. Ao planejar, incluir teste manual de login depois da remoção.
- **Cache por usuário — corrigido nesta rodada:** `fetchCompleteSnapshot` confirma a identidade antes de reutilizar o cache e compara IDs; uma segunda leitura de identidade antes da gravação rejeita trocas detectadas durante a sincronização. Regressões em `tests/api.test.js` cobrem troca de conta, sessão encerrada, falha de identidade e cache legado sem dono.
- **Ideia: badge de revisões pendentes no ícone da extensão.** `pendingReviewsCount` é calculado (`shared/analytics.js:267`) e não é usado em lugar nenhum; o README promete alertas de atraso.
- **Métodos de API sem uso**: `getTimeReport`, `getStudyTypeReport`, `listSubjectsWithDuration` e `getHomeActivities` (`shared/api.js`). Remover, ou usar para "horas previstas vs cumpridas".

## Achados considerados e rejeitados

- **`MutationObserver` em `document.body` com `subtree`** (`content.js:68-74`): o callback só faz um `getElementById`; o custo é desprezível.
- **Permissão `unlimitedStorage`**: decisão documentada em `ARCHITECTURE.md §5.4` (históricos de 10+ anos).
- **Modo mock carregando fixture**: já restrito a `?mock=true` no commit `bcf0ec0`, e o fixture não entra no ZIP (`build:zip` não inclui `tests/`).
- **`...options` sobrescrevendo `headers` mesclados** em `request()` (`shared/api.js:16-21`): nenhum chamador passa `headers`, então não há efeito hoje.

## Notas de execução (2026-11-03)

- Todos os planos DONE, em commits separados na branch `feat/study-history-patterns`; revisão independente aprovou todos. Foram acrescentados na revisão um teste de sequência com `Date` fixado (004) e a checagem da chave `user` no teste de ida e volta (006).
- 003 foi adaptado ao código vivo: usa `escapeHtml`/`sanitizeColor` de `shared/ui.js` (sem `shared/html.js`). A validação posterior cobriu dashboard mock, página lateral e painel nativo autenticado no Chrome; detalhes e limites em [validação das issues](../docs/validacao-issues-2-7.md).
- Correção fora dos planos: `scripts/generate_multiannual_mock.js` agora compara `realpath` ao detectar execução direta (o teste de CLI do gerador falhava no macOS, onde `tmpdir()` é symlink). Commit separado.
- 004: validação posterior em 4.814 atividades reais confirmou `Inicio` ISO local sem offset; o formato foi acrescentado aos testes. Ver [validação real do CLI](../docs/validacao-cli.md).
- 006: `shared/backup.js` permanece sem integração à UI e é excluído do ZIP por `build:zip`.
- Contagem real do fixture: 3.008 atividades (o plano citava 3.030).

## Resultados do spike (plano 006)

1. UI: "Abrir backup…" no menu `#export-menu`, com banner persistente (data do backup e ação "Voltar aos dados ao vivo").
2. Leitura: `<input type="file" accept="application/json,.json">`, `file.text()` e `JSON.parse`, sem nova permissão (não verificado manualmente no Chrome desktop).
3. Persistência: não gravar em `chrome.storage.local`; snapshot importado só em memória, somente leitura.
4. Tamanho: fixture real com 3.008 atividades, 1.693.392 bytes, leitura + parse de 7 a 17 ms. Limite inicial sugerido de 50 MB.
5. Sincronizar: desabilitado enquanto se visualiza um backup.
6. CLI `prof-ramos/aprovado`: o método real `exportar_backup_completo()` foi executado contra a API e o resultado convertido sem perda de listas, usuário, ciclo ou data. Foram preservadas 4.814 atividades, 84 matérias e 71 revisões concluídas; relatórios extras são ignorados pelo snapshot. O parser de argumentos do CLI não foi exercitado. Ver [evidências e limites](../docs/validacao-cli.md).
7. Próximo plano: tocar `dashboard/dashboard.html/.js/.css` reutilizando `shared/backup.js`; esforço M (1–2 dias com QA).

Detalhes completos em `006-spike-open-json-backup.md`.

## Achado não planejado (resumo)

Permissões `tabs` e `cookies` provavelmente desnecessárias e badge de revisões pendentes: ver seção "Achados registrados mas não planejados" acima. O vínculo do cache à conta foi implementado e testado.

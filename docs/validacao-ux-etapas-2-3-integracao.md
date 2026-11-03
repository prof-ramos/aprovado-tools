# Validação da integração das etapas 2 e 3 da auditoria de UX

- Fonte: branch `fix/ux-etapa-2-3`, criada de `fix/ux-etapa-1` com a união de três frentes feitas em
  paralelo (navegação, Análise histórica, popup e painel). Base do último commit antes das correções
  de integração: `fd7f7e4`. Data: 03/11/2026, America/Sao_Paulo.
- Recibos por frente: [navegação](validacao-ux-etapa-2.md), [Análise histórica](validacao-ux-etapa-3-historico.md)
  e [popup e painel](validacao-ux-etapa-3-popup-painel.md). Este documento cobre o que só existe depois de juntar.
- Conflitos resolvidos: `docs/README.md`, `docs/glossario.md` e `shared/analytics.js` (duas funções adicionadas
  em paralelo) e os imports de `dashboard/dashboard.js`. Todos eram acréscimos independentes, mantidos juntos.
- Correções feitas na integração:
  - Dashboard carrega primeiro o cache da conta e atualiza em segundo plano (`loadSnapshotProgressive`),
    com "Atualizado há X · atualizando…" no cabeçalho. Antes esperava a sincronização completa (cerca de 16 s
    com o cache vencido).
  - `color-scheme: dark` no dashboard, no popup e no painel: barras de rolagem e a faixa sob o gráfico
    ficavam claras.
  - Rótulo "Corte" da matriz movido para a esquerda, sem cobrir os nomes das matérias.
  - Teste da ordem do histórico, que se perdeu na união dos testes, restaurado.
- Automatizado: `TZ=UTC npm test` e `TZ=America/Sao_Paulo npm test`: 293 de 293, 0 falhas.
  `node --check` em todos os arquivos JS. `npm run check:docs` e `git diff --check`: código 0.
  Regressões novas com RED confirmado: carga com cache imediato.
- Pacote: `npm run build:zip` e `unzip -tq` sem erros; `shared/format.js` incluído; nenhuma entrada de
  `docs/`, `tests/` ou `shared/backup.js`.
- Navegador: ego-browser no Chrome do mantenedor; extensão carregada deste checkout, recarregada pela página de
  detalhes antes de cada rodada.
- Cenários no navegador:
  - Dashboard com `?mock=true`: abas Visão geral, Histórico e Atividades com `aria-selected` e hash
    (`#visao-geral`, `#historico`, `#atividades`); Voltar e Avançar trocam de aba; link direto com
    `#historico` abre a aba certa; faixa "Dados de exemplo"; sem nome de conta nem "alta precisão" no rodapé;
    filtros de matéria e modalidade desabilitados no Histórico, com aviso; sem rolagem horizontal.
  - Gráfico de evolução por período: 7 dias com 8 barras por dia, 30 dias com 31 barras por dia, este ano com
    45 barras por semana; "Tudo" por mês.
  - Análise histórica: 11 blocos recolhíveis (4 abertos: melhor ano, histórico multianual, matriz e mix; os
    demais fechados), três conclusões no topo, semestres como "2019 · 1º sem." e ranking "1º, 2º…", síntese
    abre ao clicar, matriz com fundo próprio, nomes das matérias e uma recomendação por quadrante.
  - Dashboard real (sem mock, conta conectada): com o cache aquecido, dados em cerca de 2 s e
    "Atualizado há 2 min · atualizando…" até terminar; aba Atividades em ordem decrescente de data.
  - Popup (aba): dados do cache em cerca de 3 s com "Atualizado há 13 min · atualizando…" e depois
    "Atualizado agora há pouco"; sem a tela "Conectando…" longa; estados vazios em texto; exportações com os
    quatro nomes do dashboard.
  - Painel lateral (aba): seções Hoje, Ciclo, Revisões pendentes e Últimos 7 dias; botões do topo com texto.
- Visual: capturas do dashboard real e mock, da matriz, do popup e do painel inspecionadas.
- Não executado: popup e painel abertos pela barra do Chrome (nativos); console do navegador; arquivos
  baixados pelas exportações (formatos cobertos por testes); CI até o push deste PR; teste com usuários reais.
- Limpeza: espaços de tarefa do ego-browser encerrados sem abas mantidas; worktrees e branches locais das
  frentes removidos.

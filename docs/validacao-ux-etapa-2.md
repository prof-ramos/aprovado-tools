# Validação da etapa 2 da auditoria de UX (frente A: navegação do dashboard)

- Fonte: branch `feat/ux-etapa-2-navegacao`, criada de `fix/ux-etapa-1` (base `942a631`), em
  03/11/2026, America/Sao_Paulo. Itens: abas com endereço próprio, filtros desabilitados fora de
  Visão geral/Atividades, gráfico por período, modalidade única, faixa de dados de exemplo e rodapé.
- Automatizado: `TZ=UTC npm test` e `TZ=America/Sao_Paulo npm test`: 246 de 246, 0 falhas.
  `npm run check:docs` (36 arquivos, 95 links, 0 erros) e `git diff --check`: código 0.
- Regressões (RED depois GREEN):
  - `tests/dashboard.test.js`: abas, hash, back/forward por `hashchange`, abertura direta por
    endereço, setas do teclado, filtros desabilitados, faixa de exemplo, gráfico por período e
    modalidades iguais ao mix. Com `metrics.types` no lugar de `metrics.modalities` o teste das
    modalidades falhou; com o intervalo do período removido o teste do gráfico falhou. Os dois voltam
    a passar com a correção.
  - `tests/modalities.test.js` (novo): `classifyModality`, `groupByModality` e igualdade de Teoria
    entre as duas visões, inclusive na fixture multianual sintética.
  - `tests/timeline.test.js` (novo): limites de 45 e 366 dias, semanas de segunda a domingo,
    meses com fim real, preenchimento com zero, entrada imutável e `timelineRange`.
- Pacote: nenhum arquivo de runtime novo; a lista de entradas do ZIP não muda.
- Navegador: **feito pelo integrador** (o Chrome carrega a extensão do checkout principal, não deste
  worktree). Não executado aqui: dashboard real e `?mock=true`, Voltar/Avançar reais, teclado,
  captura visual das abas e da faixa, console.
- Decisões:
  - O Histórico desabilita também o seletor de período, porque ele usa todos os registros.
  - As datas personalizadas continuam visíveis, desabilitadas, no Histórico.
  - O filtro Modalidade segue listando os tipos originais do AprovadoApp; o cartão "Modalidades e
    hábitos" mostra Teoria, Questões, Revisão e Outros.
  - Faixa de dados de exemplo e ocultação da conta valem para `?mock=true` e para o carregamento
    de fixture fora da extensão.
- Fora do escopo desta frente: popup, painel lateral, `shared/api.js`, `shared/format.js` e o conteúdo
  das seções do Histórico.
- Limpeza: nenhum navegador, aba ou servidor aberto; o fixture gerado por `npm run generate:mock` não
  entra no Git.

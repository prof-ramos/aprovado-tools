# Validação da etapa 1 da auditoria de UX

- Fonte: branch `fix/ux-etapa-1`, criada de `feat/icones-a-grifado` (base `233d617`), em 03/11/2026,
  America/Sao_Paulo. Itens: formatação pt-BR, termos, jargão, ordem do histórico e atalho único no site.
- Automatizado: `TZ=UTC npm test` e `TZ=America/Sao_Paulo npm test`: 226 de 226, 0 falhas.
  `npm run check:docs` e `git diff --check`: código 0.
- Regressões: `tests/format.test.js` (formatação, ausentes e severidade) e o teste da ordem do histórico
  em `tests/dashboard.test.js`, que falhou com a ordenação desativada e passa com ela. Dois testes
  novos em `tests/content.test.js` cobrem o botão flutuante único e sua remoção quando o botão do topo entra.
  As asserções de formato antigo (`2.0h`, `10.0%`) foram atualizadas para o formato brasileiro.
- Pacote: `npm run build:zip` e `unzip -tq` sem erros. `shared/format.js` está no ZIP; nenhuma entrada de
  `docs/`, `tests/` ou `shared/backup.js`.
- Navegador: ego-browser no Chrome do mantenedor; extensão carregada deste checkout e recarregada pelo botão
  da página de detalhes.
- Cenários: dashboard com `?mock=true` e sem mock (conta real), na visão geral e na Análise histórica:
  varredura do texto sem nenhum valor com ponto decimal (`\d+.\d+h|%`), sem "qst", "success", "disciplina",
  "aproveitamento", "cronotipo" ou "circadiano". Agregados: mock 4.460,1h, 3.008 sessões e 74,3%;
  real 2.019,7h e 4.814 sessões. Primeiras linhas do histórico real em ordem decrescente de data.
  Popup e painel lateral abertos como abas: horas e sessões com separador de milhar e sem "qst".
  aprovadoapp.com: botão **Exportar e métricas** presente e nenhum atalho flutuante.
- Visual: captura do topo do dashboard inspecionada.
- Não executado: popup e painel nativos; console do navegador; ramo flutuante em site real (sem barra de
  navegação, coberto só por teste); exportações e arquivos baixados (CSV e JSON mantêm ponto decimal);
  CI (sem push desta etapa até o PR).
- Fora desta etapa: abas de navegação, gráfico que respeita o período, classificação única de modalidade,
  estados vazios, última sincronização, faixa de dados de exemplo, matriz de rendimento.
- Limpeza: espaço de tarefa do ego-browser encerrado sem abas mantidas.

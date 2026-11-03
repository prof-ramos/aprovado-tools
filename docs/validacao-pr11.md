# Validação do PR #11 — 03/11/2026

Produto validado: `feat/historical-analysis-view`, SHA
`4718184c88c8611455ed3368685532e86af40279`. Fuso: America/Sao_Paulo.
Os arquivos acrescentados depois desse SHA são instruções e este recibo.

## Testes e pacote

- `TZ=UTC npm test`: exit 0, 183 testes, 32 suítes, nenhuma falha.
- `TZ=America/Sao_Paulo npm test`: exit 0, 183 testes, 32 suítes, nenhuma falha.
- As cinco regressões acrescentadas na correção tiveram RED/GREEN: três para
  empates de ranking, uma para turno na síntese e uma no renderizador real do
  dashboard (DOM simulado na fronteira do navegador).
- `npm run build:zip`: exit 0. `unzip -t` confirmou integridade do ZIP 1.0.0;
  a listagem contém somente os arquivos de execução, sem documentação, testes,
  fixtures nem `shared/backup.js`.
- Os oito checks da CI passaram para `4718184`.

## Ambiente e sessão real

O inventário do navegador integrado retornou `browser access host is unavailable`.
Foi usado Ego Lite, com extensão existente no perfil da sessão, sem alterar
credenciais ou permissões. A página de detalhes confirmou a origem
`~/Developer/personal/aprovado-tools`; a extensão foi recarregada antes da execução.
Os bytes de `dashboard/dashboard.js` e `shared/analytics.js` carregados pelo
navegador foram comparados por SHA-256 com os do checkout: ambos coincidiram.

Superfície: dashboard em aba da extensão, sem `?mock=true`. **Sincronizar** concluiu
com **Sincronizado via AprovadoApp**, 4.814 registros e 2.019,7 horas.

| Cenário real | Resultado observado |
|---|---|
| Abrir Análise histórica | Visão geral oculta; filtros de matéria/modalidade e datas personalizadas ocultos. Botão histórico ativo; Tudo inativo. |
| Semestres → Anos → Semestres | 21 linhas de semestres; 12 de anos; estado `aria-pressed` atualizado. Destaques e tabela renderizados. |
| Heatmap anual | Selecionar 2023 exibiu 275,5 horas. A escolha foi preservada ao sair e reabrir a análise. |
| Novas seções | 168 células na grade dia × hora, seis faixas de sessão e oito seções na síntese. |
| Voltar por 30 dias / 7 dias | Visão geral e filtros reapareceram; ambos exibiram zero registros no intervalo. |
| Personalizado | 01/01/2023–31/12/2023 exibiu 680 registros. Seleções de matéria e modalidade alteraram o resultado para zero; filtros restaurados ao terminar. |
| Tudo → Análise histórica | Histórico reabriu sem aplicar os filtros da visão geral. |
| Sincronizar na análise | Concluiu mantendo o histórico visível e os agregados. Nenhuma exceção `Runtime.exceptionThrown` observada durante essa sincronização. |

O indicador multianual soma 4.813 registros em 2016–2026. Uma consulta agregada ao
cache confirmou um registro anterior a 2016 e nenhuma data `Inicio` inválida.
Essa faixa preexistente explica a diferença em relação à visão geral; o ranking
novo inclui também o ano anterior. O cache real soma zero questões, portanto a
ausência de ranking de assertividade é esperada e não comprova seu caso positivo.

## Mock e inspeção visual

Superfície: dashboard da mesma extensão, com `?mock=true`, 3.008 registros.

- Tabela alternou entre 21 semestres e 11 anos.
- Grade exibiu 168 células com volume; passar o mouse por uma célula mostrou o
  tooltip com dia, hora, horas e sessões.
- Eficiência exibiu 21h (78,8%), pico de volume às 06h (75,0%) e turno Noite
  (75,4%). O caso de turno elegível sem hora elegível foi verificado nas regressões
  automatizadas, sem modificar dados reais para reproduzi-lo.
- Perfil exibiu seis faixas, mediana de 1h23min, média de 1h29min, P90 de 2h03min,
  maior sessão de 3h15min e faixa ideal de 1–1,5h (74,6%).
- Capturas do ranking real e da grade/perfil sintéticos foram abertas e
  inspecionadas: cores, barras, rótulos e tabela legíveis no desktop; nenhum
  transbordamento horizontal do documento no mock.

## Limites e limpeza

- Não foram revalidados popup, painel nativo, controles injetados ou downloads de
  exportações: essas superfícies não foram alteradas neste PR. A CI e o teste do
  exportador não são apresentados como execução desses fluxos nativos.
- Console completo e responsividade móvel não foram inspecionados. A observação
  de exceções acima se limita à sincronização real instrumentada.
- As capturas ficaram temporariamente fora do repositório. Abas da tarefa e
  capturas temporárias foram encerradas/removidas ao concluir; abas pessoais e
  histórico de estudos foram preservados.

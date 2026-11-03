# Validação dos ajustes visuais — 03/11/2026

Produto: `b2d63de`, branch `feat/historical-analysis-view`, PR #11.
Baseline: [análise visual de `ef3c2f2`](analise-visual-20261103.md).
Fuso da execução: America/Sao_Paulo.

## Implementação

Dois agentes implementaram frentes sem sobreposição de arquivos: popup/painel
lateral e dashboard. Uma terceira revisão estática não encontrou defeitos
acionáveis. O coordenador revisou o diff e executou a validação integrada.

Foram alterados somente HTML/CSS: fluxos internos, tamanho dos controles, foco,
quebras responsivas, contenção de tabelas/gráficos, alinhamento numérico do ranking
e composição da grade de horários com o resumo existente. Sem alterações no motor
analítico, APIs, permissões, paleta, fontes ou dependências.

## Medições de regressão no navegador

| Cenário | Antes | Depois |
|---|---|---|
| Intervalos entre blocos do popup | 0 px | 12 px em todos os cinco intervalos visíveis |
| Intervalos entre blocos do painel | 0 px | 14 px em todos os cinco intervalos visíveis |
| Caixas dos controles de ícone | 21 × 21 / 22 × 22 px | 32 × 32 px |
| Documento em viewport 390 px | 595 px, ações cortadas | 375 px de conteúdo útil, sem excesso horizontal; 15 px reservados à barra de rolagem |
| Intervalos entre seções históricas | 20 e 34 px | 20 px entre todas as nove transições |
| Ranking numérico | Esquerda | Direita, preservando Período à esquerda |
| Grade de horários em desktop | Resumo acima e área lateral vazia | SVG de 566 px à esquerda e resumo existente à direita, separados por 24 px |

Dashboard com mock de 3.008 registros, visão geral e análise histórica:

| Viewport | Largura útil | Largura do documento | Exportar inteiramente visível |
|---|---|---|---|
| 320 px | 305 px | 305 px | Sim |
| 390 px | 375 px | 375 px | Sim |
| 768 px | 753 px | 753 px | Sim |
| 1280 px | 1265 px | 1265 px | Sim |

Capturas do popup em 340 px, painel em 360 px, dashboard em 390/1280 px e grade de
horários foram abertas e inspecionadas. As quebras ocorrem entre botões; as ações
ficam legíveis e os gráficos largos usam rolagem localizada, sem esconder o
transbordamento global por CSS. As capturas permaneceram fora do Git.

## Extensão e dados reais

Navegador integrado indisponível (`browser access host is unavailable`). Ego Lite
foi usado para medições de página e Chrome nativo para as superfícies da extensão.
Em ambos, a tela de detalhes confirmou a origem
`~/Developer/personal/aprovado-tools`. Os cinco arquivos de produto alterados,
carregados pelo navegador, coincidiram por SHA-256 com os do checkout validado.

- **Popup nativo:** extensão recarregada, abertura pelo ícone da barra, estado
  Conectado, 4.814 registros e 2.019,7 horas. Inspeção visual confirmou marca e CTA
  em uma linha, grupos separados e largura intrínseca de 340 px.
- Durante a integração, `max-width: 100vw` deixou o popup nativo estreito apesar
  da prévia correta em aba. A regra foi removida antes do commit e o popup foi
  reaberto e inspecionado novamente. A armadilha foi registrada no workflow.
- **Painel lateral nativo:** aberto por Abrir painel lateral no popup; árvore de
  acessibilidade confirmou a página da extensão e a alça de redimensionamento.
  Sincronizar concluiu em Sincronizado, mantendo 4.814 registros. Captura do painel
  encaixado confirmou intervalos e controles.
- **Dashboard real:** Sincronizar concluiu com 4.814 registros. Em 390 px, intervalo
  personalizado de 2023 exibiu 680 registros; análise histórica ocultou datas e
  filtros, alternou para 12 anos e retornou à visão geral. O menu Exportar abriu
  dentro da largura disponível, com limite direito em 359 px e documento de
  375 px. Nenhum download foi acionado.
- **Teclado:** Tab a partir de Atualizar no popup e de Sincronizar no painel
  moveu o foco para o controle seguinte; ambos apresentaram contorno sólido
  visível nos estilos computados.

## Testes, pacote e limites

- `TZ=UTC npm test`: exit 0, 183 testes, 32 suítes, nenhuma falha.
- `TZ=America/Sao_Paulo npm test`: exit 0, 183 testes, 32 suítes, nenhuma falha.
- `npm run build:zip`: exit 0; `unzip -t`: exit 0, sem erros de integridade.
  Listagem conferida: apenas arquivos de execução, sem docs/testes/fixtures ou
  `shared/backup.js`.
- `git diff --check` e links locais conferidos. Regressões visuais verificadas por
  medições antes/depois e capturas reais; não foram criados testes de texto CSS.
- Exportações, CLI, conteúdo injetado e console completo não foram revalidados.
  Essas áreas não foram alteradas nesta correção. A inspeção estática confirmou
  que os fluxos JavaScript permaneceram intactos.
- As abas e o painel abertos no Chrome foram encerrados, preservando sua aba
  original. Espaço Ego e capturas temporárias encerrados/removidos ao concluir.

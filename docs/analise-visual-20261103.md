# Ícones, espaçamentos e alinhamentos — 03/11/2026

Skill aplicada: `frontend-design`. Fonte: `ef3c2f2`, árvore inicialmente limpa.
Escopo: análise; nenhum HTML, CSS ou JavaScript do produto foi modificado.

Situação posterior: os seis achados foram tratados em `b2d63de`.
Veja o [recibo de validação das correções](validacao-ajustes-visuais.md).

## Diagnóstico

A linguagem de ícones é coerente: SVGs de contorno, `currentColor` e traço 1,5.
Os problemas mais perceptíveis vêm do espaçamento entre contêineres, da área dos
controles e da adaptação a larguras pequenas. Recomenda-se corrigir essa estrutura
preservando a identidade existente.

| Prioridade | Achado e evidência | Ajuste recomendado |
|---|---|---|
| Alta | **Blocos encostados no popup e painel lateral.** `#connected-content` e `#panel-main` têm `display: block`, sem espaçamento vertical interno. As medições entre perfil, filtros, KPIs, ciclo, ações e exportações retornaram **0 px**. O `gap` de `.popup-container` e `.panel-layout` só atua nos filhos diretos externos. | Aplicar o fluxo vertical no conteúdo principal, com intervalo de 12 px no popup e 14–16 px no painel. Preservar intervalos menores dentro de um mesmo bloco. Referências: `popup/popup.html:49`, `popup/popup.css:31`, `sidepanel/sidepanel.html:54`, `sidepanel/sidepanel.css:32`. |
| Alta | **Cabeçalho e filtros perdem composição em largura estreita.** Na análise histórica, viewport de **390 px** produziu documento de **595 px**. A marca e o estado da sessão quebram em várias linhas; Exportar fica parcialmente fora da área visível. O seletor de período também quebra seus próprios textos. | Criar composição de cabeçalho para janela estreita: marca em uma linha, ações em linha própria, estado compacto e controle de períodos com quebra por botão ou rolagem localizada. Conter tabelas e gráficos em seus próprios wrappers. Referências: `dashboard/dashboard.css:42`, `:85`, `:228`, `:250`. |
| Média | **Espaçamento vertical duplicado no histórico.** `.dash-tab-pane` fornece `gap: 20px`; filhos com `.mt-4` acrescentam 14 px. O intervalo observado muda de **20 para 34 px** entre seções equivalentes. Dentro do ranking, `gap: 14px` mais margem de 12 px de `.period-highlights` resulta em **26 px** acima e abaixo dos destaques. | Usar uma única fonte para o intervalo de cada nível: contêiner para seções e card para seus elementos internos. Remover margens adicionais desses filhos quando o pai já oferece o intervalo desejado. Referências: `dashboard/dashboard.css:134`, `:309`, `:638`, `:875`. |
| Média | **Área de clique dos ícones pequena.** Atualizar no popup mede **21 × 21 px**, com SVG de 13 px; Sincronizar/Abrir dashboard no painel medem **22 × 22 px**, com SVG de 14 px. O traço é legível, mas o controle exige precisão e fica miúdo diante da marca e dos cards. | Preservar o glifo compacto e aumentar sua caixa para cerca de 32 × 32 px no desktop, com alinhamento ao centro. Padronizar ícones de ação em 14 ou 16 px e reservar 12 px para indicadores de abertura. A seta do popup deve receber as mesmas terminações arredondadas dos outros SVGs. Referências: `popup/popup.css:195`, `sidepanel/sidepanel.css:83`, `popup/popup.html:110`. |
| Média | **Colunas numéricas não ajudam a comparação.** A tabela de ranking herda `text-align: left` para horas, sessões, dias, percentuais e posição. Embora use algarismos tabulares, valores de comprimentos diferentes terminam em posições distintas. | Manter Período à esquerda e alinhar cabeçalhos e valores numéricos à direita, com apresentação decimal consistente por coluna. Evitar aplicar a regra indiscriminadamente a tabelas que misturam texto e números. Referências: `dashboard/dashboard.css:773`, `dashboard/dashboard.html:365`. |
| Baixa / escolha de composição | **Grade de horários fica solta em cards muito largos.** O SVG usa largura própria de aproximadamente 566 px. Em desktop, o card ocupa quase toda a janela, deixando uma grande área vazia à direita. Não há perda funcional. | Conter esse bloco numa coluna de leitura ou usar o espaço lateral para legenda/resumo já existente. Evitar simplesmente esticar o SVG e aumentar rótulos e células desproporcionalmente. Referências: `dashboard/dashboard.js`, função `renderHourWeekdayHeatmap`; `dashboard/dashboard.css:1106`. |

## Direção recomendada

Preservar a paleta atual: fundo `#0d0d0f`, superfície `#141417`, superfície elevada
`#222228`, texto `#f0f0f2`, texto secundário `#9fa0a6` e verde de ação `#10b981`.
Manter a fonte do sistema e algarismos tabulares nos dados. A identidade vem da
clareza dos registros de estudo e das visualizações, sem acrescentar decoração.

Trabalhar com uma escala curta de espaços: 4/8 px entre detalhes relacionados,
12/16 px dentro de blocos e 20/24 px entre seções. Usar caixas de ícone estáveis,
alinhamento central nos controles e alinhamento pelo final dos números nas tabelas.

```text
Popup/painel                   Dashboard estreito
marca                 ações    marca                 ações
───────────────────────────    estado da sincronização
perfil                         períodos com fluxo próprio
       12–16 px                ───────────────────────────
períodos                       indicadores
       12–16 px                        20 px
indicadores                    análise / tabela rolável
       12–16 px
ciclo / ações / exportação
```

A proposta é de acabamento do produto existente. O tema escuro com verde é
preservado por continuidade; não há justificativa, neste pedido, para trocar
paleta, fontes ou introduzir uma biblioteca de ícones.

## Verificação e limites

- Navegador integrado indisponível: inventário retornou `browser access host is
  unavailable`. Usado Ego Lite, espaço da tarefa separado das abas pessoais.
- Origem da extensão conferida em sua página de detalhes:
  `~/Developer/personal/aprovado-tools`.
- Dashboard com fixture de 3.008 registros; capturas e medições em 1280 × 900 e
  390 × 844. Estados de visão geral e análise histórica observados.
- Popup observado como **página** em viewport 340 × 900 e painel lateral como
  **página** em 360 × 900, com dados da sessão real. Isso comprova o layout HTML/CSS,
  sem representar uma nova validação do popup aberto pela barra ou do painel
  encaixado nativamente. Seus botões de abertura não foram acionados.
- Inspeção visual das quatro capturas e medições de caixas, estilos computados,
  intervalos e transbordamento. Capturas privadas temporárias fora do Git.
- Não houve alteração de comportamento, suíte automatizada ou novo build nesta
  análise. Nenhum resultado de teste anterior é apresentado como teste deste
  relatório. Links locais e `git diff --check` conferidos ao concluir.
- Abas da tarefa encerradas e capturas temporárias removidas; dados do usuário
  preservados.

# Validação da etapa 3 da auditoria de UX: Análise histórica

- Fonte: branch `feat/ux-etapa-3-historico`, criada de `fix/ux-etapa-1` (`942a631`), em 03/11/2026,
  America/Sao_Paulo. Escopo: Análise histórica, matriz de rendimento e contraste do dashboard.
- Entregas:
  1. Três conclusões no topo (melhor ano, horário em que mais acerta, matéria que pede atenção), calculadas
     dos mesmos dados da análise e formatadas em pt-BR.
  2. 11 blocos `<details>`: abertos Melhor ano e semestre, Histórico multianual, Matriz de rendimento e
     Mix metodológico; fechados os outros 7, incluindo a Síntese analítica. O estado fica no DOM e
     sobrevive à troca de aba. Mix e Síntese ficam empilhados, sem coluna vazia. O tooltip compartilhado
     saiu do bloco do mapa anual, para não ficar oculto com o bloco fechado.
  3. "Posição geral" virou **Ranking do semestre**, exibido como 1º, 2º…, com empates dividindo a posição
     (1º, 1º, 3º). A média usada fica no `title` da célula. As regras de `rankPeriods` não mudaram.
  4. Matriz: quadrantes com cor própria sobre o fundo do card (o preto vinha de `<rect>` sem `fill`),
     rótulos no mesmo estilo e caixa, eixo e título do eixo Y separados dos valores, nome de cada matéria
     ao lado do ponto (até 18 caracteres, com o nome completo no `title`, deslocado quando sobrepõe) e uma
     recomendação de uma linha por quadrante no lugar do alerta longo.
  5. Fases com legenda de critério (350h, 50h, 20 dias, ano em andamento projetado) e rótulos
     "Alta intensidade", "Manutenção" e "Hiato". Semestres aparecem como "2019 · 1º sem." em tabela,
     cards e textos gerados (`formatPeriodLabel` em `shared/analytics.js`).
  6. Contraste (abaixo).
- Contraste WCAG (razão sobre os fundos `--bg-color` #0d0d0f, `--surface-bg` #141417, `--surface-hover`
  #1c1c21, `--surface-raised` #222228):

  | Token | Antes | Depois |
  |---|---|---|
  | `--text-muted` #9fa0a6 | 7,45 / 7,05 / 6,51 / 6,07 | sem mudança |
  | `--text-faint` #6e6f76 → #8a8b92 | 3,88 / 3,68 / 3,39 / 3,16 (reprova) | 5,72 / 5,42 / 5,00 / 4,66 |
  | rótulos de eixo do SVG #64748b → #8b9bb0 | 4,08 / 3,86 / 3,57 / 3,32 | 6,85 / 6,49 / 5,99 / 5,58 |

  O selo "Hiato" passou de `--text-faint` para `--text-muted` e os selos de fase de 9px para 11px.
- Automatizado: `TZ=UTC npm test` e `TZ=America/Sao_Paulo npm test`: 235 de 235, 0 falhas
  (eram 226; 9 testes novos). `npm run check:docs` e `git diff --check`: código 0.
- Regressões: ranking com empates, conclusões (com e sem dados), matriz (rótulos, truncamento,
  sem sobreposição, recomendações), estrutura dos blocos, rótulo de semestre e contraste. O teste de
  contraste falhou com o token antigo (`--text-faint on #0d0d0f is 3.88:1`) e passa com o novo. Asserções
  de `2026.2` e de "melhor semestre … 2025.2" foram atualizadas para o novo rótulo.
- Navegador: não executado nesta frente (a extensão carregada é a do checkout principal e esta frente não
  usou o navegador). Pendente a validação visual real: aparência dos blocos recolhíveis, da matriz e do
  alinhamento do rótulo do eixo Y no Chrome.
- Limites: a sobreposição de nomes na matriz é tratada por deslocamento vertical simples; com muitas
  matérias no mesmo ponto os nomes se empilham e podem ultrapassar a área do gráfico.
- Fora do escopo (outras frentes): abas e navegação do topo, gráfico de evolução, classificação de
  modalidade e faixa de dados de exemplo.

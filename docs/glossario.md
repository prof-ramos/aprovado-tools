# Glossário e convenções de texto

Termos e formatos usados nas telas, nos textos gerados e nas exportações.
Use sempre a forma da coluna "Use" ao criar ou alterar um texto.

## Termos

| Conceito | Use | Evite |
|---|---|---|
| Disciplina estudada | **matéria** | disciplina |
| Taxa de respostas certas | **assertividade** (rótulo) e **acertos** (contagem) | aproveitamento |
| Quantidade de exercícios | **questões** | qst |
| Tempo de estudo sem pausas | **horas líquidas** | horas efetivas |
| Um registro de estudo | **sessão** (na tela) e **atividade** (na lista e nos arquivos) | — |
| Agrupamento de tipos de estudo | **modalidade**: Teoria, Questões, Revisão ou Outros | tipo de estudo, quando se fala do grupo |
| Seções do dashboard | **Visão geral**, **Histórico**, **Atividades** | Análise histórica (como botão de período) |
| Horário em que se estuda | **horário de estudo**, **estudo por hora do dia** | cronotipo, distribuição circadiana |
| Gravidade de uma recomendação | **Ponto forte**, **Informação**, **Atenção**, **Prioridade** | success, warning, critical |

## Formatos de exibição

Telas e textos gerados seguem pt-BR, pela função `formatNumber` em
`shared/format.js`:

| Tipo | Exemplo | Regra |
|---|---|---|
| Inteiro | `3.008` | ponto como separador de milhar |
| Decimal | `74,3` | vírgula e uma casa, salvo indicação |
| Percentual | `74,3%` | sem espaço antes do `%` |
| Horas decimais | `4.460,1h` | sem espaço antes do `h` |
| Duração | `1h 23m`, `185d 20h 4m` | horas e minutos inteiros |

Valores ausentes aparecem como `—`. CSV e JSON continuam com ponto decimal e
sem separador de milhar, para abrir em ferramentas e scripts sem conversão.
Larguras CSS e coordenadas SVG nunca passam por `formatNumber`.

## Ordem das listas

O histórico de atividades mostra as sessões mais recentes primeiro.

## Regra das modalidades

Uma única função, `classifyModality` (`shared/analytics.js`), decide a modalidade
de cada atividade. Quem calcula percentuais por modalidade usa essa função, de
modo que "Modalidades e hábitos" e o mix metodológico mostram os mesmos números.

| Modalidade | Entra quando o tipo de estudo contém |
|---|---|
| Questões | questões, exercício, simulado, bateria, teste, prova (tem prioridade) |
| Revisão | revisão, revisar, flashcard, anki, resumo, mapa |
| Teoria | teoria, doutrina, leitura, videoaula, vídeo, aula, pdf, livro, capítulo |
| Questões | tipo vazio ou "Geral" com exercícios registrados |
| Outros | todo o resto |

A ordem da tabela é a ordem de avaliação. O filtro **Modalidade** do dashboard
continua usando os tipos de estudo originais do AprovadoApp.

## Gráfico de evolução

Período de até 45 dias: uma barra por dia. Até 366 dias: uma barra por semana,
de segunda a domingo. Acima disso: uma barra por mês. Dias, semanas e meses sem
estudo ficam no gráfico como barras vazias.

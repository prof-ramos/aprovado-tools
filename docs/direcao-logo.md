# Direção para a identidade visual

Registro de 3 de novembro de 2026. Status: direção escolhida, ainda não
aplicada à extensão. O registro original abaixo era uma proposta sem protótipos;
a seção [Resultado da exploração](#resultado-da-exploração) descreve o que foi
desenhado e escolhido depois. Os ícones de produção não foram substituídos.

## Produto e intenção

Aprovado Tools é uma extensão não oficial para analisar e exportar o histórico
do AprovadoApp. A identidade deve apoiar a ideia de compreender os próprios
padrões de estudo: horários, duração das sessões, constância e desempenho.

O ícone atual, em `icons/`, apresenta três barras brancas sobre fundo verde.
É simples e contrastante, mas sua representação de estatísticas pode ser
confundida com outras ferramentas. Essa avaliação é uma hipótese de design;
não houve teste de reconhecimento com usuários.

A personalidade proposta é clara, confiável e tranquila. O relato de origem
do produto favorece descoberta e compreensão do histórico, sem sugerir que o
desempenho precisa crescer continuamente ou que a extensão garante aprovação.

## Três direções para prototipar

| Direção | Construção proposta | Benefício esperado | Risco a avaliar |
|---|---|---|---|
| A com barras | Monograma geométrico que una a inicial do nome e formas de dados | Conectar nome e análise | Excesso de elementos ou leitura difícil em tamanho pequeno |
| Barras próprias | Evolução das três barras atuais, com proporções e silhueta características | Continuidade visual e leitura rápida | Continuar parecendo um aplicativo genérico de estatísticas |
| Foco ou janela | Símbolo geométrico de enquadramento com um ponto destacado | Expressar descoberta e clareza | Associação pouco evidente com estudos e análise |

O A com barras é a primeira hipótese a explorar, não o vencedor definido.
As três propostas devem receber tratamento comparável antes da escolha.

## Conselho de marketing simulado

As perspectivas abaixo aplicam referenciais publicados dos especialistas.
São interpretações para este projeto, não opiniões, citações ou endossos reais
deles. Nenhum conselho avaliou desenhos, pois ainda não existem protótipos.

- **April Dunford — posicionamento:** partir do valor de compreender o histórico
  de estudo. A conexão entre inicial e dados pode ajudar, desde que permaneça
  simples. Referência: *Obviously Awesome*.
- **Byron Sharp — reconhecimento, como contraponto:** explicar a função não
  basta para criar uma marca reconhecível. Comparar o monograma com uma evolução
  das barras e observar identificação sem o nome. Referência: *How Brands Grow*.
- **Rory Sutherland — percepção:** explorar também a sensação de descobrir
  padrões antes despercebidos. Foco ou janela representa essa hipótese, mas
  depende de verificar a interpretação das pessoas. Referência: *Alchemy*.

O conflito entre Dunford e Sharp é clareza da proposta versus reconhecimento.
A alternativa inspirada em Sutherland acrescenta a tensão entre representar
dados e expressar a experiência de descoberta. Nenhuma dessas abordagens
dispensa observar os desenhos e testar suas interpretações.

O método e os dossiês consultados pertencem à skill
[marketing-council](https://github.com/coreyhaines31/marketingskills/tree/c0e35b78ad294c4ea8dbe7801c79bfeb6f67f3e9/skills/marketing-council),
na versão fixada usada nesta conversa.

## Critérios para a próxima etapa

1. Produzir três símbolos vetoriais editáveis, com complexidade comparável.
2. Começar pela família verde-petróleo e branco já utilizada; comparar também
   versões monocromáticas. A paleta final permanece aberta.
3. Exibir os símbolos em 16, 32, 48 e 128 px, em fundos claros e escuros,
   incluindo uma simulação da barra de extensões do navegador.
4. Comparar símbolo isolado e assinatura com o nome Aprovado Tools. O ícone
   pequeno deve funcionar sem texto, detalhes finos ou explicação verbal.
5. Verificar contraste, espaços internos, equilíbrio óptico e reconhecimento
   após uma exposição breve, sem apresentar o conceito antes da resposta.
6. Perguntar o que cada símbolo sugere e se parece pertencer a um complemento
   independente. A identidade deve evitar confusão com o produto oficial.
7. Submeter os desenhos ao conselho simulado, distinguindo observações visuais
   de hipóteses. Escolher a direção após comparar as evidências disponíveis.

Uma pequena rodada qualitativa pode revelar ambiguidades, mas não comprova
estatisticamente preferência de mercado ou aumento de instalações.

## Resultado da exploração

Ainda em 3 de novembro de 2026, as três direções acima foram desenhadas e
comparadas em 16, 32, 48 e 128 px e numa simulação da barra do navegador. O
mantenedor as considerou corretas, mas sem personalidade: serviriam para
qualquer ferramenta de dados. Em vez delas, foi escolhido o território
**cultura de concurseiro**, com objetos do dia a dia de quem estuda para
concurso.

Nesse território foram desenhados três conceitos: o grifo de marca-texto, o
gabarito com bolhas e o **A grifado**, um A cuja barra é uma passada de
marca-texto. O A grifado foi escolhido. Ele mantém a ideia original de unir a
inicial ao produto e troca as barras de dados pelo gesto de grifar a lei seca.

O resultado está no [Guia da marca](marca/README.md): construção, cores,
tipografia, assinaturas, regras de uso e as artes em SVG e PNG.

Testes feitos nos desenhos: leitura em 16 px ampliada pixel a pixel, versões de
uma cor e invertidas, contraste das cores e comparação com marcas de educação da
biblioteca da skill de logo. Não houve teste de reconhecimento com usuários nem
pesquisa de marca registrada.

## Limites e retomada

Não substituir os arquivos de produção durante a exploração. Em uma tarefa
futura autorizada, criar uma branch própria a partir da `main` atualizada e
manter propostas, comparações e análise separadas dos ícones publicados.

A implementação da identidade escolhida deve seguir o
[workflow de validação](workflow-validacao.md), incluindo inspeção dos ícones
nas superfícies afetadas. Este documento registra direção e critérios;
não constitui validação visual ou aprovação para publicação.

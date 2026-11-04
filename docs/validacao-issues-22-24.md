# Validação das issues #22–24 — 03/11/2026

## Fonte e escopo

Base: `main` em `2931762`; ajuste em `fix/validacao-publicacao-22-24`.
Data: 03/11/2026, America/Sao_Paulo. Nenhum dado pessoal foi incluído no recibo.

O mantenedor pediu a execução das três issues e, durante o teste visual, solicitou
substituir o ícone de atualização por um ícone open source. Popup, painel e
dashboard agora usam o `refresh-cw` oficial do Lucide, SVG local de 16 px, com
licença ISC preservada em cada HTML distribuído. Não há dependência npm nova.
Versão candidata: 1.0.1, para distinguir o novo pacote da 1.0.0 já em análise.

## Automatizado e pacote

- `TZ=UTC npm test`: exit 0, 293 testes, 43 suítes, zero falhas.
- `TZ=America/Sao_Paulo npm test`: exit 0, 293 testes, 43 suítes, zero falhas.
- `npm run check:docs`: antes do ajuste, 41 Markdown e 103 links, zero erros.
- `npm run check:docs -- docs/teste-concurseiros.md`: novo roteiro, zero erros.
- `git diff --check`: exit 0 após remover espaços finais dos comentários.
- `npm run build:zip`: exit 0, `dist/aprovado-tools-v1.0.1.zip`.
- `unzip -t`: exit 0; lista conferida com `unzip -Z1`, 22 arquivos de execução.
  Sem `docs/`, `tests/`, fixtures nem `shared/backup.js`. Licença do ícone incluída
  nos HTML do pacote. A versão anterior foi preservada.

A alteração do ícone é visual e não modifica handlers ou cálculos. A reprodução
anterior foi a inspeção visual do popup nativo; não foi criado teste que apenas
repete os paths do SVG.

## Navegador e superfícies

O inventário do navegador integrado retornou “browser access host is
unavailable”. Usados Ego Lite em espaço isolado 20 para a loja e inspeção das
páginas, e Google Chrome via Computer Use para as superfícies nativas.

Em `chrome://extensions`, o ID local observado foi
`bcpgfjnikndcpobmncfdfhlekmpjfkbg`, origem `~/Developer/personal/aprovado-tools`.
Extensão recarregada; a tela de detalhes ainda indicava 1.0.0 na abertura dos
cenários nativos, antes de recarregar o manifesto candidato. A alteração visual
do Lucide foi observada nos arquivos carregados. O ID local difere do ID da loja.

### Popup nativo

Clique no ícone fixado da barra → popup autenticado, marca legível, estado
Conectado, “Atualizado agora há pouco” e botão Atualizar com Lucide visível.
Largura visual de aproximadamente 340 px; não ficou preso a viewport estreito.
Rolagem vertical levou à seção Exportar e ao rodapé. Os quatro rótulos couberam;
os longos quebraram em duas linhas sem corte horizontal.

Na página de inspeção separada, `body.clientWidth` foi 340; os quatro botões
mostraram `clientWidth === scrollWidth === 141`, altura 36 px. Essa medição
complementa a observação nativa; não mede o viewport do popup nativo.

### Painel nativo e barra

Clique em Abrir painel lateral no popup → popup fechou e painel apareceu encaixado
à direita no Chrome. Cabeçalho, Sincronizar com Lucide, Dashboard, métricas, ciclo
e revisões carregaram. A árvore nativa expôs “Alça de redimensionamento do painel
lateral (arrastável)”. Increment e tentativa de arrasto não produziram mudança
visual de largura; não se afirma sucesso do redimensionamento.

Ícone A grifado visível na barra. Menu de contexto expôs Abrir Dashboard de
Métricas e Abrir Painel Lateral de Estudos. Clique no segundo foi enviado, mas
não foi usado como prova independente de nova abertura porque o painel já estava
aberto. A conferência do ícone dentro do menu geral de extensões segue pendente.

### Console e controles injetados

Páginas de popup e painel inspecionadas separadamente via Runtime: não houve
`exceptionThrown` nos eventos observados após recarga. Isso não equivale a uma
inspeção completa dos consoles nativos. Console do dashboard, página real sem
barra de navegação e botão flutuante não foram verificados nesta rodada ainda.
As regressões automatizadas do content script passaram na suíte.

## Loja e teste com participantes

Conta de publicação e editor existentes confirmados no painel. Item
`milphjggjejjomdcmlmlhhckjjabenjk`: versão 1.0.0, Revisão pendente; seção Publicada
informa “Este item ainda não foi publicado”. Ficha exibe quatro capturas, ícone
128 px, idioma português (Brasil), categoria Workflow e planejamento, URLs do
repositório e suporte. Esses fatos não comprovam que o pacote é o da main atual.

Upload e edição bloqueados durante análise; menu oferece Cancelar avaliação.
A tentativa de abrir esse comando terminou em timeout de Input.dispatchMouseEvent;
nenhuma confirmação de cancelamento foi observada. A consulta seguinte ao mesmo
espaço retornou `task space not found: 20`. O guia do Ego proíbe criar outro espaço
para contornar essa perda; a atualização da loja precisa ser retomada após
restabelecer o controle. Conferir o estado antes de repetir. Pacote 1.0.1 ainda não enviado na elaboração inicial deste recibo.

A #24 tem roteiro em [teste-concurseiros.md](teste-concurseiros.md). O mantenedor
informou não ter participantes. Zero convites enviados e zero sessões realizadas.
Manter a issue aberta até a realização efetiva de 3 a 5 sessões.

## Pendências

A #22 depende de atualizar e confirmar a submissão, após revisão de segurança do
SHA final. A #23 permanece aberta pelos cenários explicitamente não exercitados.
A #24 depende de recrutamento real. Não confundir preparação com execução.

## Retomada autorizada — conclusão da validação #23

O mantenedor autorizou abrir outro espaço após a perda do anterior. Espaço Ego 3
criado; origem da extensão reconferida no checkout, versão 1.0.1, base `d886ccf`.
A PR #25 teve nove checks verdes e Code/Security Review concluídos para
`c229a1f`, sem achados publicados. A CI da main `d886ccf` também passou.
ZIP reconstruído na main: SHA-256
`52d252410efeddc7c7c765ff5d2144951cf87f7a112133c5e3477e43d1492ded`,
22 entradas conferidas byte a byte contra o checkout. Capturas locais: quatro
PNG 1280×800; ícone 128×128.

No Chrome nativo, menu Extensões aberto: o A grifado aparece na linha Aprovado
Tools e na barra. Menu fechado após inspeção. Isso conclui a pendência do ícone
no menu geral indicada acima.

Console das três telas inspecionado por CDP Runtime e Log após recarga, até o
conteúdo autenticado renderizar: zero `Runtime.exceptionThrown`, zero
`console.error` e zero entradas Log de nível error em dashboard, popup e painel.
São páginas reais da extensão, sem `mock=true`; essa observação complementa a
inspeção visual nativa anterior, sem alegar que as abas são popup/painel nativos.

`https://aprovadoapp.com/robots.txt` abriu uma página real sem barra de navegação.
O content script injetou exatamente um botão `BUTTON` Exportar e métricas com
`position: fixed`, visível no canto inferior direito, sem sobreposição ao texto.
Captura visual inspecionada. O clique foi enviado, mas uma nova aba não apareceu
no inventário do espaço; não se afirma sucesso de abertura por esse clique.
O critério da issue é verificar o botão flutuante; a aparência foi confirmada.

Não se observou mudança de largura ao tentar arrastar a alça nativa. Sua presença
e o encaixe do painel foram confirmados; não se atribui o resultado do arrasto a
um defeito da extensão. Os critérios de observação da #23 foram exercitados.

### Retomada da loja

A versão 1.0.0 continuava em revisão. Cancelamento confirmado pelo painel, que
voltou a Rascunho, e ZIP 1.0.1 enviado. A seção Pacote confirmou 1.0.1.
Descrição atualizada para 1.0.1 e salva. Corrigida justificativa de storage,
retirando promessa de uso offline. Categorias de identificação pessoal e conteúdo
do site declaradas para o processamento local; demais categorias preservadas
desmarcadas, e as três certificações existentes mantidas. Essa declaração segue
o FAQ oficial do Google, que exige divulgar tratamento exclusivamente local.

As quatro capturas e o ícone no painel ainda eram antigos. A confirmação de
remoção informa que a ação não pode ser desfeita. Nenhuma dessas cinco imagens
foi removida; a substituição aguarda confirmação específica do mantenedor.
A submissão final ainda não ocorreu neste ponto.

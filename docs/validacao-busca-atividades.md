# Validação da busca local de Atividades

## Fonte e escopo

- Reconstrução: 4 de novembro de 2026, UTC.
- Base verificada: `main` em `f8162ed47b1e209a1f2831bf4fe423117c268d92`.
  Os três arquivos alterados não tiveram mudanças upstream desde `2931762`.
- Referência: [achado P2 do PR #20](https://github.com/prof-ramos/aprovado-tools/pull/20#issuecomment-6614924020).
- Produto: `dashboard/dashboard.js`; guia: `docs/uso.md`;
  regressões: `tests/dashboard.test.js`.
- A busca restringe a tabela e as exportações CSV/Markdown apenas enquanto
  Atividades está aberta. A Visão geral usa somente os filtros globais. O texto
  da busca permanece ao retornar a Atividades. O backup JSON continua completo.
- API, popup e painel lateral não foram alterados nesta frente.

## Automatizado

Ambiente: Node.js `v24.22.1`, sem instalação de dependências.

- RED, antes da correção: três regressões novas falharam por valores `1` em vez
  de `2` nas métricas e na exportação com busca oculta, e `51` em vez de `52`
  no indicador com busca e paginação. Os outros 31 testes passaram.
- GREEN, `node --test tests/dashboard.test.js`: saída 0, 34 testes aprovados.
- `TZ=UTC npm test`: saída 0, 296 testes aprovados em 43 suítes.
- `TZ=America/Sao_Paulo npm test`: saída 0, 296 testes aprovados em 43 suítes.
- `npm run check:docs`: saída 0, sem erros de links locais.
- `git diff --check`: saída 0.
- Cenários com script real e fronteiras DOM/download simuladas: busca com e
  sem resultado, clique/hash/retorno entre abas, exportação CSV de atividades
  e matérias, Markdown e backup, combinação com período personalizado, matéria
  e modalidade, e navegação entre duas páginas.

## Pacote e preservação

- `npm run build:zip`: saída 0, ZIP versão 1.0.1.
- `unzip -t dist/aprovado-tools-v1.0.1.zip`: saída 0, sem erros.
- `unzip -Z1`: 22 arquivos de execução, sem testes, fixtures, documentação
  ou `shared/backup.js`.
- Os três arquivos de produto/testes/guia reconstruídos têm hashes SHA-256
  idênticos aos registrados antes da substituição do ambiente. O patch e os
  logs desta nova execução são preservados separadamente como artefatos.

## Navegador e limites

- Esta reconstrução confirma o código e os testes automatizados, não uma nova
  validação visual ou autenticada. A validação de navegador deve ser feita
  sobre a árvore final integrada.
- Na tentativa anterior desta correção, em 3 de novembro, a abertura de
  `chrome://extensions` foi recusada pela política de protocolos da ferramenta.
  A prévia sintética HTTP local retornou `net::ERR_CONNECTION_REFUSED` em duas
  portas, e uma consulta HTTP independente também não alcançou o servidor.
  Não houve tentativa de contornar a recusa de acesso à extensão.
- Portanto, esta frente não comprovou captura visual, console do dashboard,
  downloads pela UI ou comportamento autenticado. Os testes DOM não substituem
  essas etapas; recibos de outras versões não comprovam este diff.
- Para concluir essas etapas é necessário um navegador autorizado que alcance
  o checkout integrado. Para modo real, também deve permitir carregar a extensão
  e usar a sessão autenticada no mesmo perfil.

## CI e entrega

- Sem push, PR, merge ou publicação nesta frente; não há checks de novo SHA.
- Matriz declarada: Node 18, 22, 24 e 26 em UTC e São Paulo, mais documentação.
  Localmente foi executado somente Node 24.
- Nenhum dado real, credencial ou backup pessoal foi usado.

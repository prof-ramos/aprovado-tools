# Validação do guia da marca

- Fonte: branch `docs/guia-marca`, criada de `chore/cws-publicacao-e-otimizacao-memoria`
  na base `6967ebba53c44b5a66e93e009d23459442d709e7`, em 03/11/2026, America/Sao_Paulo; alterações ainda sem commit.
  A base é essa branch porque `docs/direcao-logo.md` ainda não está na `main`.
- Escopo: `docs/marca/` (README, `guia.html`, SVGs e PNGs), status e resultado em
  `docs/direcao-logo.md` e entradas em `docs/README.md`.
- Automatizado: `npm run check:docs` e `git diff --check`, códigos de saída 0, com
  os arquivos novos incluídos por `git add -N`.
- Pacote: `npm run build:zip` gerou `dist/aprovado-tools-v1.0.0.zip`; `unzip -Z1`
  não lista nenhuma entrada de `docs/`. A lista de entradas do pacote não mudou.
- Navegador: ego-browser abriu `docs/marca/guia.html` por `file://` a 1280 px.
  Título “Marca Aprovado Tools”, 9 de 9 imagens carregadas, 16 SVGs embutidos, fonte
  Bricolage Grotesque disponível, largura do documento menor que a janela e
  caminhos da seção de arquivos apontando para `docs/marca/`.
- Visual: captura do topo inspecionada no tema escuro do sistema; assinatura,
  título e grifo legíveis. Console não observado.
- Testes de comportamento: não aplicáveis; nenhum arquivo de produção mudou e os
  ícones em `icons/` continuam os publicados.
- CI: sem commit ou push nesta tarefa.
- Limpeza: espaço de tarefa do ego-browser encerrado sem abas mantidas.
- Pendências: pesquisa de marca registrada, aplicação dos ícones numa branch
  própria e novas capturas da Chrome Web Store.

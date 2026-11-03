# Validação da troca de ícones (A grifado)

- Fonte: branch `feat/icones-a-grifado`, criada de `docs/guia-marca` (base `d345448`), em 03/11/2026, America/Sao_Paulo.
- Escopo: `icons/icon-{16,32,48,128}.png` iguais a `docs/marca/png/`; cabeçalhos do popup, do
  painel lateral e do dashboard passam a usar `icons/icon-48.png` no lugar do glifo de barras;
  `scripts/generate_icons.py` removido.
- Automatizado: `TZ=UTC npm test` e `TZ=America/Sao_Paulo npm test`: 219 de 219, 0 falhas.
  `npm run check:docs` e `git diff --check`: código 0. Não foi escrita regressão nova: a troca
  é de recurso visual, sem lógica.
- Pacote: `npm run build:zip` e `unzip -tq` sem erros. Nenhuma entrada de `docs/`, `tests/`
  ou `generate_icons`.
- Navegador: ego-browser no Chrome do mantenedor, extensão descompactada carregada de
  `~/Developer/personal/aprovado-tools` (conferido em `chrome://extensions`), recarregada pelo
  botão da página de detalhes.
- Cenários: popup, painel lateral e dashboard (`?mock=true`) abertos como abas, com o ícone novo
  carregado nas três (`naturalWidth > 0`, 24, 24 e 28 px). `icon-128.png` servido pela extensão
  com 128×128. Capturas do cabeçalho inspecionadas.
- Não executado: ícone na barra de ferramentas e no menu de extensões do Chrome (não observados
  na captura da página); abertura nativa do popup e do painel encaixado; dashboard sem
  `?mock=true`; console do navegador; CI (sem push nesta etapa).
- Pendências: capturas da Chrome Web Store ainda mostram o ícone anterior.
- Limpeza: espaço de tarefa do ego-browser encerrado, sem abas mantidas.

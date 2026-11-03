# Validação da documentação — 03/11/2026

## Escopo

Base do produto: `090ced610225f17d13b5f5578adfca01df8561d0` (v1.0.0), branch `docs/guias-release-e-privacidade`. Alterações somente em Markdown: README, guias de uso/desenvolvimento, índice, arquitetura, privacidade e preparação para a loja. Recibos anteriores e planos foram preservados como evidência histórica.

## Conferência factual

- Release v1.0.0 consultada pelo GitHub CLI: pública, publicada em 03/11/2026 às 17:38:56 UTC, com ZIP da extensão e `SHA256SUMS`; sem publicação na Chrome Web Store.
- Instalação e recarga confrontadas com o guia oficial do Chrome via Context7.
- Side Panel e armazenamento confrontados com a referência oficial via Context7: `sidePanel.open` disponível desde Chrome 116 e dependente de gesto; cota local de 10 MB, ou 5 MB até Chrome 113, ampliável por `unlimitedStorage`.
- API, cache e permissões conferidos em `shared/api.js`, `manifest.json` e `background.js`.
- Alcance dos filtros e exports conferido nos handlers de dashboard, popup e painel e em `shared/export.js`; JSON completo independe dos filtros, conversor de backup sem integração à UI e excluído do pacote.
- Fórmulas CSV, retenção após logout e estado já aberto descritos como comportamento atual, sem promessas de correção ou proteção adicional.

## Verificação

Links relativos e âncoras: 8 arquivos Markdown e 48 destinos locais verificados, sem erros. A primeira execução de `git diff --check` apontou dois espaços de quebra de linha no texto da loja; foram removidos e a nova execução passou. As dez URLs externas dos guias responderam HTTP 200 em requisições HEAD. Referências técnicas consultadas via Context7, sem instalar dependências no projeto.

Revisões independentes do diff `090ced6...f0d5709`: Spec e Standards sem achados. A checagem do diff também passou após a atualização deste recibo. Os checks de CI serão acompanhados no PR após o push; este recibo não antecipa seu resultado.

A suíte local, o pacote e o navegador não foram reexecutados nesta mudança documental, conforme a exceção do [workflow](workflow-validacao.md#5-recibo-e-conclusão). Não houve alteração no comportamento do produto. O scan estático de segurança da base foi concluído separadamente, com 65 arquivos de texto revisados, quatro ícones PNG excluídos e nenhum achado reportável; não equivale a teste de execução.

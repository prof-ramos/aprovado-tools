# Validação das pendências — 03/11/2026

## Fonte e escopo

Base `c59097c`; produto validado em `379854e`, branch `fix/pendencias-validacao-e-runtime`. Três subagentes implementaram guardrail documental, redução de permissões e correções de estado; duas revisões independentes conferiram runtime e automação/pacote. Uma referência documental obsoleta à consulta de cookie foi encontrada na revisão e corrigida.

## Regressões e execução

- Worker/permissões: RED com duas falhas esperadas; GREEN com sete testes. Removidos `cookies`, `tabs` e `CHECK_LOGIN_STATUS`, sem consumidores de runtime.
- Dashboard: três regressões RED para estado após falha, filtros incoerentes após atualizar e rejeição de clipboard. Popup/painel: quatro regressões RED para falha/recuperação e clipboard. GREEN integrado dessas superfícies: 23 testes; revisão adicional com worker: 30 testes.
- Documentação: RED por ausência do checker; GREEN final com oito testes de links, arquivos, âncoras, exemplos de código e limites de caminhos.
- Pacote: RED porque o script apagava um ZIP alheio de `dist/`; outro RED mostrou inclusão de arquivo privado dentro de `shared/`. GREEN preserva ZIP alheio e pacote anterior após falha, exclui canários privados e confere os imports dos módulos incluídos.
- `TZ=UTC npm test`: 219 testes, 219 aprovados, zero falhas, exit 0.
- `TZ=America/Sao_Paulo npm test`: 219 testes, 219 aprovados, zero falhas, exit 0.
- `npm run check:docs` e `git diff --check`: exit 0. O checker passa a ser versionado e executado no job Documentation, separado dos oito jobs de testes.

## Pacote

`npm run build:zip` e `unzip -t dist/aprovado-tools-v1.0.0.zip`: exit 0. `unzip -Z1` confirmou 21 arquivos de produção, sem testes, documentação, fixtures, conversor experimental ou canários privados. O builder inclui arquivos explicitamente e substitui somente o ZIP da versão atual após sucesso.

SHA256 do pacote validado: `8b623aba53ba271b3639a50aa3463a244422fbdaadc454f9b970d1b28ec1c4c2`. O pacote publicado anteriormente foi preservado separadamente em `dist/releases/v1.0.0/`, com seu hash original `128cb2b822b9dff699bafbe037e96b7b91aa6bbe4fb3d211aaa1e2434c88b18f`. Esta validação não publicou nem substituiu assets da release GitHub.

## Navegador e dados reais

O host de navegador integrado informou indisponibilidade. Após detecção de uso concorrente no Chrome, o usuário orientou usar Ego. O restante foi executado no espaço próprio 62 do ego-browser, sem disputar mouse/teclado.

- Gerenciador de extensões: origem sem compactação confirmada no checkout deste projeto; extensão recarregada. `getManifest()` da página carregada confirmou somente `storage`, `unlimitedStorage`, `sidePanel` e `contextMenus`.
- Dashboard autenticado, sem mock: 4.814 atividades e status sincronizado. Matéria/modalidade continuaram selecionadas e o total do recorte permaneceu igual após sincronizar.
- Falha de rede induzida somente no target do dashboard via `Network.setBlockedURLs`: identidade removida, visões geral/histórica ocultas e exportação desabilitada. Bloqueio removido em `finally`; sincronização seguinte recuperou 4.814 atividades e exportação.
- Popup aberto como página para teste do conteúdo: login, 4.814 atividades, limpeza após falha de rede e recuperação confirmados. O botão real do popup abriu o painel lateral nativo; o evento `chrome.sidePanel.onOpened` foi observado e o target da página lateral nativa apareceu.
- Conteúdo do painel testado também como página: 4.814 atividades, identidade/conteúdo removidos após falha e recuperação após sincronizar.
- Análise histórica reaberta e captura visual inspecionada: cards, ranking e tabela legíveis, sem transbordamento observado. A análise exibiu 2.019,7 horas líquidas; não se exigiu igualdade de contagem entre registros totais e registros com datas válidas.
- Backup JSON real baixado após a recuperação: 4.814 atividades, 84 matérias, perfil e versão presentes. Arquivo mantido somente em diretório privado e removido na mesma execução; nenhum dado individual foi publicado.

## Limites e limpeza

A tentativa de abrir o popup nativo por `chrome.action.openPopup` na janela isolada retornou “Cannot show popup for an inactive window”. Não foi forçado foco sobre a janela do usuário. O teste de popup em página não comprova a geometria do popup da barra; o encaixe/alça do painel nativo não foram inspecionados nesta rodada. A abertura nativa do painel foi confirmada pelo evento e target, enquanto seu conteúdo foi exercitado em página.

Não foi feito logout da conta, modificação do histórico ou limpeza do cache persistente. As falhas foram induzidas por bloqueio de rede limitado às páginas de teste e os bloqueios foram removidos. Não houve teste real de CSV ou clipboard nesta rodada, pois seus formatos não mudaram; as rejeições/guards foram cobertos pelos testes de regressão. Console não foi auditado; mensagens de falha de rede eram esperadas durante a indução.

O espaço Ego é encerrado ao concluir os testes. A aba do gerenciador de extensões aberta antes no Chrome pessoal foi preservada após a indicação de uso concorrente. CI do SHA enviado será acompanhada no PR; este recibo não antecipa seu resultado.

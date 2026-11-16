# Validação do cronômetro da PR #27

A revisão foi feita em 16/11/2026 no fuso de Brasília, na branch local `fix/pr-27-timer`, a partir do SHA `be02447d68d8defdecf28416bc2fd850a8834b39` da [PR #27](https://github.com/prof-ramos/aprovado-tools/pull/27). As superfícies alteradas são o painel lateral, o banner do popup e a verificação de identidade do cliente da API.

## Cenários verificados

| Cenário | Resultado observado nos testes |
| --- | --- |
| Reabrir com outra conta, incluindo matérias com o mesmo ID | O painel inicia zerado, o popup oculta a matéria e a duração e a conta original recupera os 62 segundos pausados ao voltar. |
| Trocar de conta durante a restauração ou antes de salvar | Uma leitura antiga não substitui a restauração atual. A consulta de perfil sem cache precede o POST e a divergência de conta cancela o envio. O painel atualiza a identidade e preserva a sessão anterior. |
| Abrir com cronômetro legado sem proprietário | A sessão legada não é restaurada. O armazenamento antigo não permite identificar a conta que a iniciou. |
| Descartar e iniciar nova sessão | Matéria, conteúdo e campos extras são limpos. A nova gravação conserva o conteúdo selecionado, de ID 21. |
| Aguardar salvamento com resposta pendente | Os controles e campos ficam bloqueados no painel, o tempo permanece pausado e apenas uma requisição é iniciada. Em caso de erro, o tempo e os campos são preservados para nova tentativa. |

Os cenários de troca de conta, descarte e controles concorrentes falharam na base original e passaram com a correção. O teste de preservação após falha de rede também passou na base e cobre o comportamento mantido pela alteração.

## Verificações automatizadas

| Comando | Código de saída | Resultado |
| --- | ---: | --- |
| `TZ=UTC npm test` | 0 | 317 aprovados, 0 falhas |
| `TZ=America/Sao_Paulo npm test` | 0 | 317 aprovados, 0 falhas |
| `npm run check:docs` | 0 | 0 erros |
| `git diff --check` e `git diff --cached --check` | 0 | Nenhum problema de whitespace |
| `npm run build:zip` | 0 | Gerou `dist/aprovado-tools-v1.0.1.zip` |
| `unzip -t dist/aprovado-tools-v1.0.1.zip` | 0 | Arquivo íntegro |
| `unzip -Z1 dist/aprovado-tools-v1.0.1.zip` | 0 | 23 entradas de execução, sem testes, documentação, fixtures ou `shared/backup.js` |

A execução local usou Node 24. A matriz remota inclui Node 18, 22, 24 e 26, nos dois fusos. Os checks do commit local dependem de um push autorizado.

## Navegador e limites

O Chromium 156 local saiu antes de carregar o perfil isolado com `socket() failed: Operation not permitted`. O Chrome conectado bloqueou a navegação para `chrome://extensions/`. O painel e o popup nativos, a captura visual, o console do navegador e a integração com o servidor ficaram sem validação. As evidências são dos scripts de produção executados com DOM simulado e respostas fictícias. Nenhuma atividade foi enviada ao AprovadoApp.

A confirmação de identidade e o envio são duas requisições. A extensão barra divergências detectadas antes do envio. Uma garantia atômica contra uma troca de cookie entre as requisições depende de suporte do servidor. O bloqueio dos controles vale para o painel que iniciou o salvamento.

A aba de inspeção foi fechada e as cópias temporárias de reprodução foram removidas. O checkout com as correções e o ZIP local foram preservados para revisão.

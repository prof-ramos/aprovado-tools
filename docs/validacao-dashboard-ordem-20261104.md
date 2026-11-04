# Validação: ordem das cargas do dashboard

## Fonte e escopo

- Base e HEAD local: `f8162ed47b1e209a1f2831bf4fe423117c268d92`, branch `integration/recovered-fixes-20261104`, com delta local não commitado.
- Data: 2026-11-04, UTC; Node v24.22.1. Sem push, PR, merge ou publicação.
- Escopo: dashboard, regressões sintéticas e este recibo. Sem mudanças no cliente API, nas regras de busca/filtro ou dependências.
- Comparação com `2931762`: os três commits seguintes alteraram apenas documentação, HTML, manifesto e versão do pacote; JavaScript do dashboard permaneceu igual.
- SHA-256 do produto `dashboard/dashboard.js`: `92ee58941d55eda77f15000fb3b497ee88c291108fde6199fe4e43a2ec02a7b8`.
- SHA-256 de `tests/dashboard.test.js`: `e246db645f968fd1a811adc36879dd8c87ba507c194759007839ba0702c0cce4`.

## Automatizado

- RED, `TZ=UTC node --test tests/dashboard.test.js`, antes da correção: saída 1, 45 testes, 31 aprovados e 14 regressões novas falhando pelo defeito de ordenação.
- GREEN, mesmo comando: saída 0, 45/45 aprovados.
- `TZ=UTC npm test`: saída 0, 307/307 testes, 44 suítes, sem ignorados.
- `TZ=America/Sao_Paulo npm test`: saída 0, 307/307 testes, 44 suítes, sem ignorados.
- `npm run check:docs`, `git diff --check`, `node --check dashboard/dashboard.js` e `node --check tests/dashboard.test.js`: saída 0.
- Matriz CI consultada: Node 18, 22, 24 e 26 × UTC/America/Sao_Paulo. Apenas Node 24 foi executado localmente; sem nova execução remota porque não houve push.

## Cenários

As regressões executam o script real do dashboard e os renderizadores/analytics reais, substituindo somente fronteiras do navegador.

- Sucesso ou erro de carga progressiva antiga, antes/depois de sincronização manual nova: somente a carga nova pode publicar dados, desconexão, indicador e conclusão do carregamento.
- Callback de cache obsoleto ignorado. Sucesso antigo não restaura dados após falha nova; exportação fica bloqueada até recuperação.
- Sucesso/erro de sincronização manual antiga após novo init: estado novo preservado, botão não fica desabilitado.
- Autenticação antiga positiva/negativa: não inicia leitura obsoleta nem desconecta a tela nova.
- Carga mock inicial/manual antiga, sucesso/erro: não substitui os dados reais nem o modo de exibição da carga atual.
- Cliente `shared/api.js` real com gravação sintética A atrasada: B sincroniza, A termina por último, mas UI e snapshot entregue à exportação JSON permanecem B. Cache em disco pode terminar como A; a leitura seguinte para B rejeita A pelo identificador do dono e busca dados de B. Não se alega cancelamento de gravações em armazenamento.
- Falhas atuais limpam os dados; carga posterior recupera os dados da nova conta. As exportações foram verificadas na fronteira de download, não por download nativo.

## Pacote

`npm run build:zip` e `unzip -t dist/aprovado-tools-v1.0.1.zip`: saída 0.
`unzip -Z1` inspecionado: 22 arquivos de execução; sem testes, documentação, segredos, fixtures ou `shared/backup.js`.

## Navegador e limites

Não executado: extensão nativa, autenticação real, troca de contas reais, download nativo, inspeção visual e console do navegador. A tentativa de abrir `chrome://extensions/` já foi negada nesta tarefa por política de URL (somente HTTP/HTTPS); a negativa foi transmitida pelo coordenador e não foi repetida nem contornada. Nenhuma conta real foi manipulada. Os testes sintéticos não substituem QA nativo ou validação visual.

## Limpeza

Nenhuma aba criada por esta etapa. Fixture e ZIP permanecem apenas nos diretórios locais ignorados pelo Git. Logs contêm somente testes sintéticos. O delta deve ser revalidado após integração com a alteração de busca/filtros.

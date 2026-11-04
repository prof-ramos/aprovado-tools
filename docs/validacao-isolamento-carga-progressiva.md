# Validação: isolamento da carga progressiva

Fonte: base `f8162ed47b1e209a1f2831bf4fe423117c268d92`, branch
`fix/progressive-account-isolation`, 4 de novembro de 2026 (UTC).
Ambiente: Linux, Node.js `v24.22.1`.

## Reconciliação e escopo

O código JavaScript das duas superfícies e da API permaneceu igual entre a base
anterior `2931762` e a base atual. As alterações recentes de HTML, ícones, versão
`1.0.1`, política de privacidade e recibos foram preservadas. Este patch altera
somente popup, painel lateral, seus testes e este recibo. Não altera a API.

Após exibir o cache, as duas telas conservavam os dados quando a atualização
falhava sem `status: 401`, inclusive erros de troca de conta, identidade ausente
e rede. Agora, falhas da carga atual limpam memória e apresentação e bloqueiam
os quatro formatos de exportação. O cache continua aparecendo enquanto a carga
está pendente; a gravação local existente é preservada quando essa carga falha.

Uma geração compartilhada entre carga inicial e sincronização manual permite
que somente a solicitação mais recente altere a interface. Cache, sucesso,
erro, autenticação e finalização obsoletos são ignorados. Uma nova carga inicial
do popup também recupera o botão de atualização de uma tentativa anterior.

## Evidências

- RED no código da base atual: `node --test tests/popup-panel-ux.test.js`, saída 1;
  50 testes, 16 passaram e 34 falharam, nenhum cancelado. São 32 cenários novos
  e dois contratos de fallback ajustados para não conservar dados após falha.
- GREEN com a correção: mesmo comando, saída 0; 50/50 passaram.
- `TZ=UTC npm test`, saída 0; 325/325 passaram.
- `TZ=America/Sao_Paulo npm test`, saída 0; 325/325 passaram.
- `node --check popup/popup.js`, `node --check sidepanel/sidepanel.js`,
  `npm run check:docs` e `git diff --check`: saída 0.
- `npm run build:zip` e `unzip -t dist/aprovado-tools-v1.0.1.zip`: saída 0.
  A listagem do ZIP contém somente 22 arquivos de execução, sem documentação,
  testes, fixtures ou `shared/backup.js`.

Os testes executam os scripts e a API reais, simulando apenas rede,
armazenamento, DOM e fronteiras de exportação. Dados são exclusivamente
sintéticos. Cobrem troca de conta, identidade ausente e falha de rede antes e
depois das listas; falha essencial; limpeza de nome, email, métricas e snapshot;
CSV de atividades, CSV de matérias, JSON e Markdown bloqueados após falha;
e recuperação com a conta atual.

Também cobrem callbacks, sucesso, erro e finalização de uma carga antiga antes
e depois da carga nova, nas ordens inicial → manual e manual → inicial.
O indicador de carregamento e o botão permanecem sob controle da carga atual.
O teste de API real retarda a gravação de A até B já estar exibida e confirma
que interface e JSON permanecem em B.

## Limites e verificações pendentes

Não há cancelamento de requisições nem ordenação global de gravações entre
superfícies. Uma escrita tardia pode deixar o cache persistido de A depois de B;
o teste confirma que uma leitura seguinte autenticada como B rejeita esse cache
pelo ID do dono, busca as listas de B e não retorna os dados de A.

Na tentativa de navegador desta tarefa em 3 de novembro, a abertura de
`chrome://extensions/` foi negada pela política de protocolos (somente HTTP e
HTTPS). A negativa não foi contornada nem repetida. Portanto, este novo patch
não foi carregado em popup/painel nativo, nem inspecionado visualmente ou pelo
console. Recibos anteriores de validação nativa do projeto não validam estas
alterações novas. Nenhuma conta real foi acessada e não houve troca de login real.

A validação final do conjunto integrado, revisão independente e CI do SHA que
vier a ser publicado devem ser registradas pelo integrador. Este recibo comprova
somente o patch local descrito; não comprova push, merge ou publicação na loja.

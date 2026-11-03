# Conclusão de tarefas

Use este roteiro antes de encerrar uma implementação, correção ou publicação. Reutilize o recibo da tarefa ou a descrição da PR; um documento novo só é necessário quando a evidência precisa ser preservada.

1. **Escopo atendido.** Compare o resultado com o pedido vigente e os critérios do plano, incluindo correções recebidas durante a execução. Para cada requisito, identifique o arquivo, comportamento ou entrega que o atende. Termine esta etapa com todos os requisitos contabilizados.
2. **Verificação efetiva.** Execute os checks apropriados sobre a versão final e registre comando, código de saída e resultado. Para um bug, inclua a reprodução anterior e a regressão que passou. Confira os resultados dos subagentes no diff e na integração. Termine com evidência para cada comportamento alterado; teste não executado permanece explícito.
3. **Uso real.** Quando a entrega muda uma interação, valide a superfície usada pelo usuário e o resultado após a ação. Para esta extensão, siga [DEVELOPER.md §1.6](../DEVELOPER.md#16-verificação-do-popup-e-do-painel-nativo). Diferencie mock, dados reais e inspeção de código. Termine com observação correspondente à alegação de funcionamento.
4. **Entrega autorizada.** Conclua push, PR, merge, pacote ou publicação quando fizerem parte do pedido e da autorização vigente. Confira o estado remoto e o artefato produzido. Reutilize a autorização existente; solicite informação ou aprovação somente se uma exigência concreta ainda faltar. Termine com destino e versão comprovados, ou com o limite exato do escopo entregue.
5. **Pendências reconciliadas.** Resolva o que ainda for necessário, autorizado e acessível antes de encerrar. Para cada bloqueio restante, registre o que foi tentado, a evidência da limitação e a ação ou informação indispensável para continuar. Termine sem pendências necessárias ocultas sob “concluído”.

A resposta final informa o resultado, a verificação executada, o destino da entrega e apenas as limitações materiais. Uma etapa pendente exige um estado parcial preciso; não transforma o restante em trabalho concluído. Não publique segredos, backups pessoais ou saídas sensíveis como evidência.

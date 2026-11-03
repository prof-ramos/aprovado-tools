# Documentação do Aprovado Tools

Escolha o guia conforme a tarefa. O [README principal](../README.md) apresenta a extensão e a instalação pela release do GitHub.

## Guias atuais

| Preciso de… | Documento |
|---|---|
| Instalação, atualização, filtros, exportações e métricas | [Guia de uso](uso.md) |
| Ambiente local, prévia sintética, testes e pacote | [Guia do desenvolvedor](../DEVELOPER.md) |
| Componentes, sincronização, cache e limites | [Arquitetura](../ARCHITECTURE.md) |
| Dados acessados, retenção, exclusão e permissões | [Política de privacidade](../PRIVACY.md) |
| Texto da loja e preparação de uma futura submissão | [Chrome Web Store](../CHROMEWEBSTORE.md) |
| Propostas de logo e critérios para a identidade visual | [Direção da logo](direcao-logo.md) |
| Verificações e evidências de uma alteração | [Workflow de validação](workflow-validacao.md) |
| Concluir uma tarefa ou diagnosticar acesso bloqueado | [Conclusão de tarefas](conclusao-tarefas.md) · [Diagnóstico de acesso](diagnostico-acesso.md) |
| Retomar planos e consultar decisões anteriores | [Índice de planos](../plans/README.md) |

## Evidências históricas

Os recibos abaixo descrevem o commit, a data e o ambiente da execução registrada. Eles não substituem uma nova validação de alterações posteriores.

- [Issues 2–7](validacao-issues-2-7.md): testes, navegador e limites da rodada inicial de correções.
- [Backup do CLI](validacao-cli.md): execução do método real e conversão do resultado; não comprova importação pela UI.
- [PR #11](validacao-pr11.md): análise histórica, regressões e verificações de interface.
- [Cache por conta](validacao-cache-por-conta.md): autenticação, troca de usuário e preservação em falhas.
- [Ajustes visuais](validacao-ajustes-visuais.md) e [análise visual](analise-visual-20261103.md): ícones, espaçamentos, alinhamentos e responsividade.
- [Pendências de runtime e validação](validacao-pendencias-20261103.md): recuperação após falhas, filtros, permissões, guardrail e pacote.
- [Revisão da documentação](validacao-documentacao.md): links e conferência factual dos guias.
- [Otimização de memória e delegação](validacao-memoria-delegacao.md): redução de listeners e teste de estresse de heap.
- [Retrospectiva de 03/11/2026](retro-20261103.md): decisões e aprendizados da rodada.

Planos concluídos e propostas de spikes são registros de decisão. Confirme o estado atual no código antes de executar um plano antigo; uma proposta descrita nesses arquivos não significa que a funcionalidade esteja disponível.

# Validação real do backup CLI — 03/11/2026

Foi executado o método `AprovadoClient.exportar_backup_completo()` do CLI `prof-ramos/aprovado`, commit `5623f1841af1f98e2c7a3e2a7807fbbf71a0ff43`, contra a API real. A autenticação reutilizou o item existente do 1Password, entregue somente à memória do subprocesso; nenhum segredo foi incluído em argumentos, documentos ou logs.

O exportador concluiu com as nove chaves esperadas: `gerado_em`, `usuario`, `materias`, `atividades`, `ciclo`, `revisoes_concluidas`, `revisoes_pendentes`, `metricas_tempo` e `metricas_ciclo`.

O JSON real foi convertido por `snapshotFromBackup` e verificado com `node:assert/strict`:

- 4.814 atividades e 84 matérias preservadas integralmente;
- zero revisões pendentes e 71 concluídas preservadas;
- usuário, ciclo e data de geração preservados;
- entrada não modificada; `source === 'backup'`;
- as 4.814 datas `Inicio` possuem formato ISO local sem offset;
- relatórios adicionais são ignorados intencionalmente pelo snapshot interno.

O backup ficou temporariamente fora do repositório, em diretório 0700 e arquivo 0600, e foi removido após a validação. O teste automatizado usa apenas dados sintéticos para cobrir a estrutura do CLI e a presença dos relatórios extras. Não foi acionado o parser de argumentos da interface de linha de comando: a validação executou diretamente o método real que o comando `backup` chama, sem substituição de rede ou mocks.

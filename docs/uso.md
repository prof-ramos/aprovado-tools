# Guia de uso

[Voltar à documentação](README.md) · [Instalação rápida](../README.md#instalar)

## Instalar e atualizar

Baixe o ZIP da extensão na [release publicada](https://github.com/prof-ramos/aprovado-tools/releases/tag/v1.0.0), extraia para uma pasta permanente e carregue essa pasta em `chrome://extensions` → **Modo do desenvolvedor** → **Carregar sem compactação**. Selecione o diretório que contém `manifest.json`, não o arquivo ZIP nem uma pasta acima dele. O procedimento segue o [guia oficial de instalação local do Chrome](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).

A release também oferece `SHA256SUMS`. Opcionalmente, baixe os dois arquivos para o mesmo diretório e confira o ZIP no macOS:

```sh
shasum -a 256 -c SHA256SUMS
```

No Linux com GNU coreutils, use `sha256sum -c SHA256SUMS`. O resultado esperado identifica o ZIP como `OK`; divergência exige baixar novamente e conferir a origem antes da instalação.

Atualizações manuais não são automáticas: substitua o conteúdo da mesma pasta por uma nova release, clique em **Recarregar** no card da extensão e recarregue as abas do AprovadoApp. Feche e reabra popup, painel lateral e dashboard para iniciar com o código novo. Evite instalar várias cópias, que podem duplicar atalhos e manter caches separados.

## Conectar e sincronizar

Faça login em [aprovadoapp.com](https://aprovadoapp.com) no mesmo perfil do Chrome usado pela extensão. Não há campo de senha na extensão. Em seguida, abra o popup e use a atualização dos dados; no dashboard, clique em **Sincronizar**.

O cliente consulta `https://aprovadoapp.com/service`. Embora os atalhos também sejam injetados em páginas `.com.br` e subdomínios permitidos pelo manifesto, isso não comprova que uma sessão exclusiva desses outros domínios autentique a API `.com`.

Cada carga normal confirma a identidade online antes de reutilizar listas em cache de até cinco minutos. **Sincronizar** ignora a validade temporal e busca novamente as listas. Falhas de matérias ou atividades interrompem a carga sem substituir o cache anterior; ciclo e revisões podem faltar sem impedir as métricas principais. Não há atualização em tempo real nem leitura normal do cache sem confirmação de sessão.

Uma aba já carregada pode continuar mostrando seu snapshot após logout ou falha de sincronização. Feche as superfícies da extensão ao encerrar uma sessão em computador compartilhado. O logout não exclui o armazenamento local; veja [retenção e exclusão](../PRIVACY.md#3-retenção-e-exclusão).

## Filtrar e analisar

Na visão geral do dashboard, selecione **Tudo**, **30 dias**, **7 dias** ou **Personalizado**, e combine matéria, modalidade e busca. Os indicadores e exportações do recorte usam essa seleção; a paginação limita as linhas exibidas, não o conjunto exportado.

Ao entrar em **Análise histórica**, os filtros da visão geral ficam ocultos e os gráficos usam todo o histórico carregado. Para voltar ao recorte, selecione um período da visão geral. O seletor Semestres/Anos altera o ranking; o seletor do mapa anual altera o ano exibido nesse mapa.

| Indicador | Interpretação |
|---|---|
| Tempo e sessões | Soma das durações e quantidade de registros do conjunto analisado. Não são metas ou horas previstas. |
| Média diária da visão geral | Tempo dividido por dias com atividades, em vez de todos os dias corridos. |
| Assertividade | Acertos divididos pelo total de questões; ausência de questões não representa desempenho zero. |
| Consistência do ranking | Percentual de dias ativos com duração positiva no período; o período corrente considera os dias decorridos. |
| Ranking geral | Média das posições em volume, consistência e, quando há amostra elegível, assertividade. Valores iguais compartilham posição, como 1, 1, 3. |
| Eficiência por hora/turno | Comparação de assertividade com pelo menos 50 questões no grupo. Cada hora e cada turno são avaliados independentemente. |
| Síntese histórica | Textos produzidos por regras locais sobre os registros; descrevem padrões observados, sem estabelecer causalidade ou previsão. |

Os indicadores multianuais abrangem 2016 até o ano corrente; o ranking de períodos inclui os anos presentes nos registros. Datas e horários são interpretados conforme os formatos do AprovadoApp e o calendário local do navegador. Os resultados dependem da qualidade e completude do histórico cadastrado.

## Exportar dados

| Ação | Alcance |
|---|---|
| CSV atividades | Todas as atividades do recorte, incluindo a busca no dashboard, sem limitar à página da tabela. |
| CSV matérias | Agregação por disciplina sobre o mesmo recorte; disponível no popup e no dashboard. |
| Backup JSON | Snapshot completo, incluindo perfil, listas, ciclo e revisões; ignora os filtros. |
| Copiar Markdown | Métricas do recorte e nome do usuário na área de transferência. |

O CSV usa `;`, UTF-8 com BOM e quebras de linha CRLF. Se a planilha não separar as colunas, importe o arquivo selecionando o separador e a codificação. O exportador preserva o texto das células, inclusive prefixos interpretáveis como fórmulas por planilhas.

O JSON da extensão inclui `gerado_em`, `versao_extensao`, `origem`, `usuario`, `materias`, `atividades`, `ciclo`, `revisoes_pendentes` e `revisoes_concluidas`. Ele compartilha as listas principais com o projeto `prof-ramos/aprovado`, mas não inclui os relatórios adicionais `metricas_tempo` e `metricas_ciclo` do CLI. A [validação do método de backup do CLI](validacao-cli.md) descreve exatamente o que foi exercitado.

Não há botão para abrir ou restaurar JSON na extensão. O conversor experimental `shared/backup.js` está restrito ao código de desenvolvimento e não faz parte do ZIP publicado.

## Resolver problemas

| Sintoma | Ação |
|---|---|
| Sessão desconectada | Abra `.com` no mesmo perfil, confirme o login e tente sincronizar novamente. |
| Extensão não carrega | Confira a extração do ZIP e a presença de `manifest.json` na pasta selecionada. |
| Dados desatualizados | Clique em **Sincronizar**; após atualizar a extensão, recarregue também a página do site. |
| Atalhos duplicados | Confira se há mais de uma cópia instalada e recarregue o AprovadoApp após desativar a cópia extra. |
| Painel lateral não abre | Use um clique no popup ou menu de contexto do ícone e confira o suporte do navegador. A API exige interação do usuário. |
| Sem ciclo ou revisões | Confira esses dados no AprovadoApp; essas consultas são opcionais e podem falhar sem impedir o restante. |

Para relatar um problema, informe versão da extensão, versão do navegador, superfície e passos. Oculte perfil, anotações e atividades pessoais nas capturas e mantenha backups reais fora das issues.

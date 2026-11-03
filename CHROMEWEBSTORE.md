# Preparação para a Chrome Web Store

Atualizado em 3 de novembro de 2026. A v1.0.0 está [publicada no GitHub](https://github.com/prof-ramos/aprovado-tools/releases/tag/v1.0.0); este documento prepara uma futura submissão e não indica publicação ou aprovação pela Chrome Web Store.

## Texto proposto para a ficha

**Nome:** Aprovado Tools — Métricas & Exportação

**Descrição curta:** Exporte e analise métricas de estudo, histórico, ciclo e revisões do AprovadoApp em CSV, JSON e Markdown.

**Descrição detalhada:**

Aprovado Tools é uma extensão não oficial para estudantes que usam o AprovadoApp e querem consultar e exportar seu histórico.

- Consulte horas de estudo, sessões, dias ativos, sequência e assertividade em questões.
- Use filtros de período, matéria e modalidade no dashboard.
- Explore o histórico completo: semestres e anos, mapa anual, horários, turnos, duração das sessões e síntese por regras locais.
- Acompanhe ciclo, revisões pendentes e distribuição por matéria no painel lateral.
- Exporte atividades e resumo por matéria em CSV, baixe um snapshot completo em JSON ou copie um relatório em Markdown.

Faça login em aprovadoapp.com no mesmo perfil do navegador e abra a extensão. Use Sincronizar para atualizar as listas. O cache pode reduzir consultas de histórico por até cinco minutos, mas a identidade é sempre confirmada online. Não há atualização em tempo real ou importação de backups pela interface.

Os cálculos são locais, sem telemetria, serviços de IA ou servidor próprio. Requisições autenticadas vão diretamente ao AprovadoApp. Arquivos exportados podem conter perfil e anotações; o armazenamento local permanece após logout até ser substituído ou removido.

Para suporte, consulte o repositório e as issues do projeto.

**Categoria proposta:** Productivity

**Idioma:** Português (Brasil)

**Finalidade única:** Analisar e exportar os dados de estudo da conta do usuário no AprovadoApp.

## Materiais e pendências

| Item | Situação no repositório |
|---|---|
| Ícone 128 × 128 | Disponível em `icons/icon-128.png`. |
| Capturas destinadas à loja | Ainda não preparadas como assets de publicação. Recibos de QA não substituem esses arquivos. |
| Imagens promocionais | Ainda não preparadas. |
| Política de privacidade | [PRIVACY.md](PRIVACY.md), em português e inglês; conferir a URL pública na submissão. |
| Pacote | Gerado por `npm run build:zip`; conferir conteúdo e versão pelo workflow. |
| Revisão de permissões | `tabs`, `cookies` e o handler sem uso removidos no código; conferir o pacote efetivamente enviado e a validação de login. |
| Submissão e aprovação | Não realizadas por este documento. |

Prepare capturas com dados sintéticos: visão geral, análise histórica, exportações e painel lateral nativo. Consulte os [requisitos oficiais de imagens da loja](https://developer.chrome.com/docs/webstore/images) antes de produzir os arquivos e confira os campos exigidos no console no momento da submissão.

## Permissões: conferir implementação antes de justificar

A descrição de uso não prova que uma permissão seja necessária. O manifesto atual é a fonte da lista; [PRIVACY.md](PRIVACY.md#4-permissões-declaradas) descreve o uso de cada permissão no código.

- `storage` e `unlimitedStorage`: snapshot completo e marcadores locais; não há filtros recentes persistentes ou seletor de tema implementado.
- `sidePanel` e `contextMenus`: painel lateral e atalhos de abertura.
- A abertura de abas e a autenticação não usam as permissões `tabs` ou `cookies`. O handler de presença de cookie foi removido.
- Hosts: `https://aprovadoapp.com/*`, `https://*.aprovadoapp.com/*`, `https://aprovadoapp.com.br/*` e `https://*.aprovadoapp.com.br/*`. Os atalhos usam os padrões do manifesto; a API usa `.com`. Não alegar autenticação independente em `.com.br` sem evidência.

## Checklist de submissão

1. Confirme a versão do manifesto, o pacote e os cenários aplicáveis no [workflow de validação](docs/workflow-validacao.md).
2. Revise as permissões no código, teste qualquer alteração e alinhe ficha e política ao pacote efetivamente enviado.
3. Produza os assets da loja, confira dimensões e remova informações pessoais.
4. Preencha as declarações de dados conforme o comportamento real; processamento local ainda envolve acesso a dados pessoais. Confira a [política de dados do usuário](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq).
5. Revise os campos e instruções de avaliação no console e registre separadamente envio, aprovação e publicação.

## Distribuição existente

A release GitHub v1.0.0 foi publicada em **3 de novembro de 2026**, com ZIP e `SHA256SUMS`. Para instalar ou atualizar manualmente, siga o [guia de uso](docs/uso.md). Não existe atualização automática da instalação sem compactação.

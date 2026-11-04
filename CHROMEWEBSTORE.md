# Chrome Web Store Listing — Aprovado Tools — Métricas & Exportação

> Última atualização: 2026-11-03
> Estado confirmado no painel: versão 1.0.1 enviada para análise, revisão pendente e publicação automática após aprovação. Ainda não publicada.

## Ficha da Loja (Store Listing)

**Nome da Extensão (Extension Name)** [OBRIGATÓRIO]
Aprovado Tools — Métricas & Exportação

<!-- Corresponde exatamente ao campo "name" do manifest.json. 37 caracteres (máx. 75). -->

**Descrição Curta (Short Description)** [OBRIGATÓRIO]
Exporte e analise métricas completas de estudo, histórico de atividades, ciclo e revisões do AprovadoApp.

<!-- Exatamente 105 caracteres (máx. 132 caracteres). Sem jargões técnicos. -->

**Descrição Detalhada (Detailed Description)** [OBRIGATÓRIO]
Aprovado Tools é uma extensão não oficial para estudantes que usam o AprovadoApp e desejam acompanhar métricas aprofundadas e exportar seu histórico de estudos.

RECURSOS
• Painel analítico completo — visualize horas líquidas, contagem de sessões, dias ativos, sequência (streak) e assertividade em questões
• Filtros dinâmicos — analise seu desempenho por período pré-definido, intervalo personalizado, matéria e modalidade de estudo
• Histórico plurianual — acompanhe a evolução por semestres e anos, mapa de calor anual (heatmap), distribuição dia × hora, turnos e duração das sessões
• Diagnóstico de rotina — síntese automática de padrões de estudo, identificação de turnos mais produtivos e balanço entre teoria, questões e revisão
• Matriz de rendimento — quadrantes cruzando carga horária e taxa de acertos para identificar matérias fortes e pontos de atenção
• Painel lateral integrado — acompanhe o progresso do ciclo de estudos e revisões pendentes sem sair da sua página de estudos
• Exportações flexíveis — baixe atividades e resumos por matéria em CSV, exporte snapshot completo em JSON ou copie relatório formatado em Markdown

COMO USAR
1. Faça login na sua conta em aprovadoapp.com no mesmo perfil do navegador
2. Clique no ícone do Aprovado Tools na barra de ferramentas ou abra o painel lateral
3. Clique em "Sincronizar" para carregar seus dados e explorar as análises no dashboard

PRIVACIDADE
Todos os cálculos e gráficos são gerados localmente no seu navegador. A extensão acessa a API do AprovadoApp com a sessão ativa do navegador e salva no dispositivo o perfil retornado pelo serviço e os dados de estudo. Não possui servidores próprios, não utiliza telemetria nem serviços externos de inteligência artificial e não envia o histórico a terceiros por iniciativa própria. Exportações são geradas localmente a pedido do usuário: o backup JSON inclui o perfil, e o relatório Markdown inclui o nome. O compartilhamento posterior desses arquivos ou textos fica sob o controle do usuário.

PERMISSÕES
• Armazenamento ("storage" e "unlimitedStorage") — necessários para salvar o histórico de atividades e métricas no seu dispositivo, garantindo consulta rápida e suporte a históricos com vários anos de registros
• Painel lateral ("sidePanel") — necessário para exibir o painel lateral com ciclo e revisões ao lado da navegação
• Menus de contexto ("contextMenus") — adiciona atalhos práticos no botão direito para abrir o painel lateral e o dashboard
• Acesso a "aprovadoapp.com" e "aprovadoapp.com.br" — necessário para obter os dados de estudo diretamente da sua conta autenticada e exibir atalhos convenientes na interface do serviço

SUPORTE
Encontrou algum problema ou tem sugestões? Visite o repositório do projeto no GitHub:
https://github.com/prof-ramos/aprovado-tools/issues

Versão 1.0.1 — Lançamento estável inicial com dashboard analítico, histórico plurianual, matriz de rendimento, painel lateral e exportações completas.

<!-- CWS remove markdown na renderização pública da loja; o formato usa quebras de linha e marcadores •. -->

**Categoria (Category)** [OBRIGATÓRIO]
Workflow e planejamento (Workflow and planning)
<!-- A CWS descontinuou a antiga categoria "Produtividade" para novas submissões, substituindo-a por "Workflow e planejamento". -->

**ID da Extensão (Extension ID)**
`milphjggjejjomdcmlmlhhckjjabenjk`

**Finalidade Única (Single Purpose)** [OBRIGATÓRIO]
Analisar e exportar o histórico de estudos e métricas da conta do usuário no AprovadoApp.

**Idioma Principal (Primary Language)** [OBRIGATÓRIO]
Português (Brasil)

## Materiais Gráficos (Graphics & Assets)

| Item | Dimensões | Status | Arquivo / Destino |
|---|---|---|---|
| Ícone da Loja [OBRIGATÓRIO] | 128×128 PNG | ✅ Pronto | `icons/icon-128.png` |
| Captura 1 [OBRIGATÓRIO] | 1280×800 | ✅ Pronto | `store-assets/screenshot-1-dashboard.png` (Dashboard: visão geral com abas, cards de métricas, gráfico por período e filtros) |
| Captura 2 [RECOMENDADO] | 1280×800 | ✅ Pronto | `store-assets/screenshot-2-historico.png` (Análise histórica: conclusões, melhor ano e semestre e ranking) |
| Captura 3 [RECOMENDADO] | 1280×800 | ✅ Pronto | `store-assets/screenshot-3-matriz-rendimento.png` (Matriz de rendimento por matéria e mix metodológico) |
| Captura 4 [RECOMENDADO] | 1280×800 | ✅ Pronto | `store-assets/screenshot-4-exportacao.png` (Exportação de dados: CSV, JSON e Markdown) |
| Banner Promocional Pequeno [RECOMENDADO] | 440×280 PNG/JPEG | ⬜ Opcional | `store-assets/promo-small.png` |
| Banner Promocional Principal (Marquee) | 1400×560 PNG/JPEG | ⬜ Opcional | `store-assets/promo-marquee.png` |

### Orientações para as capturas de tela
- Utilize dados sintéticos/mock (por exemplo, via `?mock=true` no dashboard) para proteger a privacidade dos dados reais.
- Siga as especificações oficiais da Chrome Web Store: 1280×800 ou 640×400 pixels, sem bordas ou distorções.
- Demonstre o produto em funcionamento real, com boa legibilidade e contraste.
- As capturas atuais foram refeitas em 03/11/2026 a partir de `?mock=true`, com o ícone do A grifado, e mostram a faixa "Dados de exemplo".

## Justificativa de Permissões (Permissions Justification)

Todas as permissões declaradas no `manifest.json` foram estritamente minimizadas e possuem finalidade direta para as funcionalidades da extensão:

| Permissão | Tipo | Justificativa para a equipe de revisão da CWS |
|---|---|---|
| `storage` | permissions | Salvar o snapshot local do histórico de estudos, a data da sincronização e o perfil retornado pelo serviço, incluindo ID, nome, sobrenome e email quando disponíveis, para acesso rápido após confirmação online da identidade da conta. |
| `unlimitedStorage` | permissions | Armazenar localmente históricos plurianuais volumosos (milhares de sessões e atividades) sem interrupção por limite de cota do navegador. |
| `sidePanel` | permissions | Exibir a interface lateral nativa do navegador com o progresso do ciclo de estudos e lista de revisões pendentes ao lado da navegação. |
| `contextMenus` | permissions | Fornecer atalhos de clique com o botão direito para abrir o painel lateral e o dashboard analítico. |
| `https://aprovadoapp.com/*`, `https://*.aprovadoapp.com/*` | host_permissions | Consultar a API oficial do serviço de estudos autenticado do usuário e injetar atalhos rápidos de navegação na página. |
| `https://aprovadoapp.com.br/*`, `https://*.aprovadoapp.com.br/*` | host_permissions | Injetar atalhos de navegação na versão com domínio nacional `.com.br` do serviço de estudos. |

> Nota de revisão: Permissões sensíveis como `tabs` e `cookies` foram auditadas e não constam no manifesto.

## Privacidade e Uso de Dados (Privacy & Data Use)

### Coleta de dados (Data Collection)
A extensão coleta ou processa dados do usuário? **Sim**. O perfil e os dados de estudo são obtidos da API do AprovadoApp; o armazenamento, os cálculos e as exportações são locais. As consultas de identidade e a sincronização exigem requisições online autenticadas ao AprovadoApp, mesmo quando as listas podem ser reutilizadas do cache.

| Tipo de Dado | Coletado? | Transmitido para fora do dispositivo? | Finalidade | Compartilhado com terceiros? |
|---|---|---|---|---|
| Informações de identificação pessoal | Sim, localmente | Não há upload do perfil pela extensão | Perfil retornado pelo AprovadoApp, incluindo nome, sobrenome, email e ID quando disponíveis, para exibição, identificação do cache local e exportações solicitadas pelo usuário | Não por iniciativa da extensão |
| Informações de saúde | Não | Não | N/A | Não |
| Informações financeiras | Não | Não | N/A | Não |
| Informações de autenticação | Não lê nem armazena diretamente credenciais | O navegador envia cookies da sessão ao AprovadoApp nas requisições autenticadas | Utiliza a sessão ativa com `credentials: include`; não solicita senha nem usa a API de leitura de cookies | Somente a comunicação autenticada com o AprovadoApp |
| Comunicações pessoais | Não | Não | N/A | Não |
| Localização | Não | Não | N/A | Não |
| Histórico de navegação | Não | Não | N/A | Não |
| Atividade do usuário (telemetria de uso) | Não | Não | Não monitora cliques, teclas ou navegação; o histórico de estudos é declarado como conteúdo do site | Não |
| Conteúdo do site | Sim, localmente | Não | Histórico de estudos, matérias, anotações, ciclo e revisões obtidos da API para métricas e exportação | Não |

O painel da loja declara os dados tratados mesmo quando permanecem apenas no dispositivo: informações de identificação pessoal e conteúdo do site. Consulte o [FAQ oficial de dados](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq).

O perfil retornado pela API é salvo integralmente em `aprovado_data_snapshot.user` e `aprovado_user`, em `chrome.storage.local`; não se limita ao ID. O backup JSON inclui esse perfil, e o relatório Markdown inclui nome e sobrenome quando disponíveis. Downloads e cópias são ações locais, não uploads. Consulte [PRIVACY.md](PRIVACY.md) para retenção, exclusão e limites das interfaces já abertas.

### Declaração de Conformidade (Data Use Certification)
- [x] Os dados NÃO são vendidos a terceiros.
- [x] Os dados NÃO são usados para finalidades não relacionadas à funcionalidade principal da extensão.
- [x] Os dados NÃO são usados para avaliação de solvência ou concessão de crédito.

## Política de Privacidade (Privacy Policy)

**URL da Política de Privacidade** [OBRIGATÓRIO]
https://github.com/prof-ramos/aprovado-tools/blob/main/PRIVACY.md

<!-- Texto completo bilíngue disponível em PRIVACY.md no repositório. -->

## Distribuição (Distribution)

- **Visibilidade:** Pública (Public)
- **Regiões:** Todas as regiões (All regions)

## Informações do Desenvolvedor (Developer Info)

- **Nome do Publicador:** profgabrielramos
- **Email de Contato:** [Preencher com o endereço de email de desenvolvedor cadastrado no Chrome Web Store Developer Dashboard]
- **URL de Suporte:** https://github.com/prof-ramos/aprovado-tools/issues
- **URL da Página Inicial / Repositório:** https://github.com/prof-ramos/aprovado-tools

## Histórico de Versões (Version History)

| Versão | Data | Alterações | Status |
|---|---|---|---|
| 1.0.0 | 2026-11-03 | Lançamento inicial: dashboard com métricas e filtros, histórico plurianual, matriz de rendimento, painel lateral nativo e exportações CSV, JSON e Markdown. Permissões estritamente restritas a storage, sidePanel, contextMenus e hosts aprovadoapp. ID na CWS: `milphjggjejjomdcmlmlhhckjjabenjk`. | Avaliação cancelada e pacote substituído pela 1.0.1 antes da publicação. |
| 1.0.1 | 2026-11-03 | Pacote da main com ícones de sincronização Lucide, nova identidade, quatro capturas atuais e declarações de dados corrigidas. | Submetido; revisão pendente, publicação automática após aprovação. |

## Notas de Revisão (Review Notes)

### Limitações e Funcionamento
- A extensão opera no modelo cliente-servidor direto com o AprovadoApp: o usuário faz login diretamente no site oficial e a extensão realiza requisições para a API do serviço com a sessão do navegador (`credentials: include`).
- A extensão não opera servidores próprios nem envia os dados a provedores de análise ou IA. A comunicação de rede necessária é direta com o AprovadoApp; downloads e cópias são ações locais do usuário.
- Cada carga normal confirma online a identidade antes de disponibilizar o cache da mesma conta. Os cálculos sobre dados já carregados são locais; isso não representa um modo de abertura offline dos dados da conta.
- Histórico de rejeições: Nenhuma (primeira submissão).

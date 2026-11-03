# Política de Privacidade / Privacy Policy

**Última atualização / Last updated:** 02 de Novembro de 2026 / November 2, 2026

## Português

### 1. Visão Geral
O **Aprovado Tools** é uma extensão de navegador de código aberto desenvolvida para permitir que usuários da plataforma AprovadoApp visualizem análises avançadas, padrões históricos de estudo e exportem seus dados (CSV, JSON, Markdown).

### 2. Coleta e Uso de Dados
- **Privacidade por Design (Client-Side Only)**: O Aprovado Tools opera exclusivamente no ambiente local do seu navegador.
- **Nenhum Servidor Externo**: A extensão não possui servidores próprios, não utiliza serviços analíticos terceirizados (telemetria) e não monitora sua navegação.
- **Dados Acessados**: A extensão acessa unicamente as informações da sua própria conta do AprovadoApp (histórico de atividades, matérias cadastradas, ciclo de estudos e revisões) mediante a sua sessão já autenticada no site oficial (`aprovadoapp.com` e `aprovadoapp.com.br`).
- **Armazenamento Local**: Seus dados de estudo e preferências de interface (ex.: tema claro/escuro) são armazenados localmente no seu dispositivo utilizando a API `chrome.storage.local`.

### 3. Permissões Solicitadas e Justificativas
- `storage` & `unlimitedStorage`: Armazenamento em cache local dos relatórios e preferências para abertura instantânea do painel sem requisições repetidas à API.
- `cookies`: Leitura do cookie de autenticação de sessão gerado pelo AprovadoApp no navegador do usuário, dispensando a inserção manual de login e senha na extensão.
- `sidePanel`: Exibição do painel lateral integrado de estudos enquanto o estudante navega em suas fontes de pesquisa e leitura.
- `contextMenus`: Atalho no menu de clique direito para acesso rápido às métricas.
- `tabs`: Abertura da aba dedicada do dashboard completo de métricas.
- `host_permissions` (`*://*.aprovadoapp.com/*` e `*://*.aprovadoapp.com.br/*`): Comunicação direta via HTTPS entre o navegador e o backend do AprovadoApp para resgate dos registros do usuário.

### 4. Compartilhamento e Venda de Dados
O Aprovado Tools **nunca vende, aluga ou compartilha** dados pessoais ou métricas de estudo de seus usuários com terceiros, corretores de dados ou redes de publicidade.

### 5. Contato e Código Aberto
O código-fonte completo é aberto e auditável em:
https://github.com/prof-ramos/aprovado-tools

---

## English

### 1. Overview
**Aprovado Tools** is an open-source browser extension designed to allow users of the AprovadoApp study platform to inspect advanced metrics, historical study patterns, and export their study sessions into CSV, JSON, and Markdown formats.

### 2. Data Collection and Usage
- **Client-Side Only**: Aprovado Tools operates strictly inside your local browser instance.
- **No External Servers**: The extension has no external servers, collects no telemetry, and does not track your general browsing activity.
- **Accessed Data**: The extension only accesses study data belonging to your own AprovadoApp account (session history, subjects, cycles, reviews) through your existing active login session on `aprovadoapp.com` and `aprovadoapp.com.br`.
- **Local Storage**: Data snapshots and UI preferences are stored locally on your device via `chrome.storage.local`.

### 3. Permissions Justification
- `storage` & `unlimitedStorage`: Caches metrics and multi-year historical logs locally for instant dashboard loading without repeated network round-trips.
- `cookies`: Reads active session cookies on the AprovadoApp domain to authenticate API requests without asking for passwords.
- `sidePanel`: Renders the companion study side panel alongside active reading tabs.
- `contextMenus`: Adds browser context menu shortcuts to launch dashboards.
- `tabs`: Opens the full analytics dashboard tab.
- `host_permissions` (`aprovadoapp.com` / `aprovadoapp.com.br`): Performs HTTPS requests to fetch your study data directly from the official service.

### 4. Data Sharing & Monetization
Aprovado Tools **does not sell, transfer, or disclose** any user information to third parties, data brokers, or advertising networks.

### 5. Contact & Open Source
The complete source code is publicly accessible and auditable at:
https://github.com/prof-ramos/aprovado-tools

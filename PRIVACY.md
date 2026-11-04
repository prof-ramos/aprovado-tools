# Política de Privacidade / Privacy Policy

**Última atualização / Last updated:** 3 de novembro de 2026 / November 3, 2026

## Português

### 1. Dados acessados e finalidade

O Aprovado Tools é uma extensão não oficial para visualizar e exportar dados da conta do usuário no AprovadoApp: perfil retornado pelo serviço, matérias, atividades e anotações, ciclo de estudos e revisões. O perfil inclui nome, email e ID de conta, usados na exibição e na identificação do cache local. Os cálculos e gráficos são executados no navegador. A extensão não mantém servidor próprio, telemetria, publicidade ou processamento por serviços de IA.

### 2. Comunicação e autenticação

A sincronização envia requisições diretamente para `https://aprovadoapp.com/service`, com a sessão do navegador (`credentials: include`). A extensão não solicita nem armazena a senha. Cada leitura de snapshot confirma a identidade online, mesmo quando as listas podem ser reutilizadas do cache; o dono do snapshot precisa corresponder à conta autenticada.

O manifesto permite acesso HTTPS aos domínios `.com`, `.com.br` e seus subdomínios, e injeta atalhos nessas páginas. O cliente de dados usa o domínio `.com`; a permissão de outro domínio não significa que a API use esse destino ou compartilhe sua sessão.

### 3. Retenção e exclusão

O snapshot completo e os marcadores de sincronização ficam em `chrome.storage.local`, no perfil do navegador. A instalação também grava uma data e um marcador de tema; a interface atual não oferece preferências de tema ou filtros persistentes. A extensão não sincroniza esse armazenamento pelo Chrome Sync.

Cinco minutos é o prazo de reutilização das listas, não um prazo de exclusão. O cache permanece até ser substituído ou removido. Falhas de sincronização preservam o cache; sair do AprovadoApp não o apaga nem revoga automaticamente dados já carregados nas interfaces. Uma falha de carga ou sincronização limpa os dados em memória e os dados renderizados, bloqueando exportações até uma nova carga bem-sucedida. Não há detecção contínua de logout. Feche as superfícies abertas ao encerrar o uso em perfil compartilhado.

Remover a extensão pelo gerenciador de extensões apaga seu armazenamento local. Arquivos CSV/JSON já baixados e conteúdo copiado para a área de transferência são independentes: apague-os ou substitua-os separadamente quando necessário. Exportações podem conter perfil e anotações pessoais.

### 4. Permissões declaradas

| Permissão | Uso no código atual |
|---|---|
| `storage` | Snapshot, instante da sincronização, usuário e marcadores locais de instalação. |
| `unlimitedStorage` | Amplia a capacidade para históricos extensos. |
| `sidePanel` | Exibe o painel lateral. |
| `contextMenus` | Adiciona atalhos de abertura ao menu de contexto. |
| Hosts HTTPS `.com`, `.com.br` e subdomínios | Permitem os atalhos nas páginas correspondentes e o acesso ao serviço; o destino efetivo da API é `.com`. |

### 5. Compartilhamento e contato

A extensão não vende dados nem transmite histórico a terceiros por iniciativa própria. Downloads e cópias são ações do usuário; o destino e o compartilhamento posteriores ficam sob seu controle. As requisições autenticadas ao AprovadoApp continuam sujeitas ao serviço e ao navegador.

Código e canal de contato: [repositório](https://github.com/prof-ramos/aprovado-tools) e [issues](https://github.com/prof-ramos/aprovado-tools/issues). Evite publicar backups, cookies, credenciais ou informações pessoais ao relatar um problema.

## English

### 1. Accessed data and purpose

Aprovado Tools is an unofficial extension for viewing and exporting the user's AprovadoApp account data: the profile returned by the service, subjects, activities and notes, study cycle, and reviews. The profile includes name, email, and account ID, used for display and local cache ownership checks. Calculations and charts run in the browser. The extension operates no server, telemetry, advertising, or external AI processing.

### 2. Communication and authentication

Synchronization sends requests directly to `https://aprovadoapp.com/service` using the browser session (`credentials: include`). The extension does not request or store a password. Every snapshot read confirms the account identity online, including reads that can reuse cached lists; the snapshot owner must match the authenticated account.

The manifest grants HTTPS access to `.com`, `.com.br`, and their subdomains and injects shortcuts on matching pages. The data client uses `.com`; permission for another domain does not establish an API destination or shared session there.

### 3. Retention and deletion

The full snapshot and synchronization markers are stored in `chrome.storage.local` in the browser profile. Installation also writes a date and theme marker; the current UI does not offer persistent theme or filter preferences. The extension does not synchronize this storage through Chrome Sync.

Five minutes is the list reuse window, not a deletion deadline. Cached data remains until replaced or removed. Synchronization failures preserve the cache. Logging out of AprovadoApp neither deletes it nor automatically revokes data already loaded in extension views. A failed load or synchronization clears in-memory and rendered data and blocks exports until a successful load. There is no continuous logout detection. Close open extension views when ending use of a shared profile.

Removing the extension through the extension manager clears its local storage. Downloaded CSV/JSON files and clipboard contents are independent; delete or replace them separately as needed. Exports may include profile information and personal notes.

### 4. Declared permissions

| Permission | Current implementation |
|---|---|
| `storage` | Snapshot, synchronization time, user, and local installation markers. |
| `unlimitedStorage` | Additional capacity for extensive study histories. |
| `sidePanel` | Displays the side panel. |
| `contextMenus` | Provides context-menu navigation shortcuts. |
| HTTPS `.com`, `.com.br`, and subdomains | Enable matching-page shortcuts and service access; the actual API destination is `.com`. |

### 5. Sharing and contact

The extension does not sell data or independently transmit study history to third parties. Downloads and clipboard exports are user actions; subsequent destinations and sharing remain under the user's control. Authenticated requests to AprovadoApp remain subject to that service and browser behavior.

Source and contact: [repository](https://github.com/prof-ramos/aprovado-tools) and [issues](https://github.com/prof-ramos/aprovado-tools/issues). Keep backups, cookies, credentials, and personal information out of public reports.

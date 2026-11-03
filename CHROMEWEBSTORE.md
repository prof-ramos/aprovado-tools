# Chrome Web Store Listing — Aprovado Tools — Métricas & Exportação

> Last Updated: 2026-11-02

## Store Listing

**Extension Name** [REQUIRED]
Aprovado Tools — Métricas & Exportação

**Short Description** [REQUIRED]
Exporte e analise métricas completas de estudo, histórico de atividades, ciclo e revisões do seu AprovadoApp em CSV e JSON.

**Detailed Description** [REQUIRED]
Aprovado Tools é a ferramenta definitiva para quem estuda pelo AprovadoApp e busca máxima clareza sobre seu rendimento, horas líquidas e taxa de acertos em exercícios.

Acompanhe seu progresso de estudo em tempo real, visualize gráficos de evolução diária, entenda a distribuição de tempo por disciplina e exporte todo o seu histórico para planilhas ou notas com um único clique.

Principais Recursos:

- Painel Completo de Métricas: Veja horas líquidas totais, sessões registradas, média diária e taxa geral de assertividade em simulados e questões.
- Exportação Completa para Planilhas: Baixe todas as suas sessões de estudo em formato CSV (compatível com Excel, Google Planilhas e Apple Numbers com acentuação perfeita) e resumo consolidado por disciplina.
- Backup Integral da Conta: Gere backups estruturados em JSON de todo o seu histórico, disciplinas cadastradas, ciclo de estudos e revisões.
- Copiar Relatório em Markdown: Exporte relatórios executivos formatados diretamente para o Notion, Obsidian ou aplicativos de anotações.
- Ciclo de Estudos e Revisões: Acompanhe a porcentagem de conclusão da rodada atual do seu ciclo de estudos e verifique revisões pendentes ou agendadas.
- Painel Lateral Integrado: Mantenha suas metas e cronograma visíveis na barra lateral do navegador enquanto lê materiais, PDFs ou assiste a videoaulas.
- Atalho Direto no Aprovado: Botão integrado na própria barra do AprovadoApp para abrir o painel sem sair da página.

Como Usar:

1. Acesse sua conta no AprovadoApp (aprovadoapp.com ou aprovadoapp.com.br) normalmente no navegador.
2. Clique no ícone do Aprovado Tools na barra de extensões ou no botão integrado no próprio site.
3. Visualize instantaneamente suas métricas consolidadas ou clique em 'Abrir Dashboard Completo' para uma análise aprofundada.
4. Escolha o formato desejado (CSV, JSON ou Markdown) para baixar ou copiar seus dados de estudo.

Privacidade e Segurança:

Seus dados de estudo pertencem exclusivamente a você. O Aprovado Tools opera localmente no seu navegador e não possui servidores externos, rastreadores ou telemetria. As requisições são feitas diretamente entre o seu navegador e a sua conta no AprovadoApp.

Suporte e Feedback:

Extensão não oficial criada por e para estudantes. Para sugestões, dúvidas ou suporte, consulte o repositório oficial no GitHub.

**Category** [REQUIRED]
Productivity

**Single Purpose** [REQUIRED]
Exportar e analisar métricas de estudo, ciclo e revisões da conta do usuário no AprovadoApp.

**Primary Language** [REQUIRED]
Portuguese (Brazil)

---

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|---|---|---|---|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `icons/icon-128.png` |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 3 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | |
| Marquee Promo Tile | 1400×560 | ⬜ Not created | |

### Screenshot Notes
- Screenshot 1: Visão executiva do Dashboard com banner de KPIs (Horas totais, sessões, assertividade de questões, sequência).
- Screenshot 2: Gráfico de evolução cronológica diária e painel de ciclo de estudos.
- Screenshot 3: Tabela detalhada de matérias e menu suspenso de exportação (CSV, JSON, Markdown).
- Screenshot 4: Painel lateral aberto em aba de leitura de estudo.

---

## Permissions Justification

| Permission | Type | Justification |
|---|---|---|
| `storage` | permissions | Armazena preferências locais (tema, filtros recentes) e cache local de métricas para inicialização rápida. |
| `unlimitedStorage` | permissions | Permite persistir snapshots completos do histórico multianual de estudos (10+ anos e milhares de atividades) localmente no navegador sem atingir a cota padrão de 5MB. |
| `cookies` | permissions | Detecta a sessão ativa de login do usuário no AprovadoApp para permitir sincronização de dados sem solicitar senhas. |
| `sidePanel` | permissions | Permite abrir o painel lateral com métricas e revisões enquanto o estudante navega e estuda em outras abas. |
| `contextMenus` | permissions | Adiciona opções no menu de contexto do navegador para abrir rapidamente o painel de métricas. |
| `tabs` | permissions | Abre o painel completo de métricas em uma nova aba e detecta a janela atual para exibir o painel lateral. |
| `https://aprovadoapp.com/*` | host_permissions | Comunica-se com os serviços do AprovadoApp para carregar o histórico de estudos, ciclo e revisões para exportação e análise. |
| `https://*.aprovadoapp.com/*` | host_permissions | Garante compatibilidade caso o serviço use subdomínios oficiais da plataforma. |
| `https://aprovadoapp.com.br/*` | host_permissions | Permite detectar login e injetar atalhos de exportação no domínio brasileiro do AprovadoApp. |
| `https://*.aprovadoapp.com.br/*` | host_permissions | Garante compatibilidade em eventuais subdomínios no domínio .br. |

---

## Privacy & Data Use

### Data Collection
- **User Activity Data (Estudos)**: Dados de matérias, sessões e exercícios lidos da conta do usuário.
- **Armazenamento**: Estritamente local (`chrome.storage.local`).
- **Transmissão Externa**: NENHUM dado é enviado a servidores de terceiros ou serviços externos. Toda a comunicação ocorre estritamente entre a extensão e o domínio oficial do AprovadoApp autenticado pelo próprio usuário.

---

## Version History

- **v1.0.0** (2026-11-02): Versão inicial com Dashboard completo de métricas, Painel Lateral, popup de exportação rápida (CSV, JSON, Markdown), integração com ciclo de estudos e revisões espaçadas.

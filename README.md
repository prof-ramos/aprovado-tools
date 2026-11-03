# Aprovado Tools — Extensão Chrome para Métricas & Exportação

> Extensão para Google Chrome (Manifest V3) que permite aos usuários do **AprovadoApp** (`aprovadoapp.com` e `aprovadoapp.com.br`) exportar todo o seu histórico de estudos e analisar métricas profundas de rendimento, ciclo de estudos e revisões espaçadas.

---

## 🎯 Funcionalidades

- **Dashboard Executivo de Estudos**:
  - Horas líquidas totais e decimais.
  - Total de sessões e dias ativos com estudo.
  - Taxa geral de assertividade em exercícios e questões resolvidas.
  - Sequência de dias consecutivos (*streak*) e recorde histórico.
  - Média diária de estudos e duração média por sessão.
  - Gráfico interativo de evolução cronológica diária.
- **Distribuição & Rendimento por Matéria**:
  - Horas dedicadas por disciplina com as cores originais cadastradas no AprovadoApp.
  - Taxa de acerto segmentada por disciplina e alertas de rendimento.
  - Detalhamento por tópicos (*Conteúdos*).
- **Ciclo de Estudos & Revisões**:
  - Percentual de conclusão da rodada atual do ciclo.
  - Horas previstas vs cumpridas por matéria.
  - Lista de revisões pendentes e agendadas com alertas de atraso.
- **Opções de Exportação Avançadas**:
  - **CSV Atividades**: Arquivo `.csv` completo com todas as sessões registradas, pronto para abrir no Excel, Google Planilhas ou Apple Numbers (com codificação UTF-8 BOM para acentuação perfeita).
  - **CSV Matérias**: Resumo consolidado de horas, sessões e questões por matéria.
  - **Backup JSON**: Snapshot completo da conta compatível com a biblioteca e CLI [`prof-ramos/aprovado`](https://github.com/prof-ramos/aprovado).
  - **Copiar Relatório em Markdown**: Gera um resumo formatado para colar direto no Notion, Obsidian ou notas pessoais.
- **Painel Lateral (*Side Panel*)**:
  - Visualize metas, ciclo e matérias enquanto navega na internet ou estuda em outras abas.
- **Atalho Integrado no AprovadoApp**:
  - Adiciona automaticamente um botão discreto de acesso rápido na barra do AprovadoApp.

---

## 🚀 Como Instalar e Testar no Navegador

Como a extensão está em desenvolvimento, você pode carregá-la no Google Chrome, Brave ou Microsoft Edge em segundos:

1. Abra o navegador e acesse a página de extensões:
   ```
   chrome://extensions
   ```
2. No canto superior direito, ative a chave **Modo do desenvolvedor** (*Developer mode*).
3. Clique no botão **Carregar sem compactação** (*Load unpacked*).
4. Selecione a pasta raiz do repositório clonado, que contém `manifest.json`.
5. A extensão **Aprovado Tools** aparecerá na sua lista de extensões ativas!
6. Fixe o ícone na barra de ferramentas do navegador para acesso rápido.

---

## 📖 Como Usar

1. Faça login na sua conta no [AprovadoApp](https://aprovadoapp.com) pelo navegador normalmente.
2. Clique no ícone do **Aprovado Tools** na barra de ferramentas ou no botão **📊 Exportar & Métricas** injetado no topo do site.
3. No popup rápido, você verá os números principais e poderá clicar em:
   - **📊 Abrir Dashboard Completo**: Abre a central de análise visual em uma nova aba.
   - **📑 Abrir Painel Lateral**: Abre o acompanhamento lateral integrado no Chrome.
   - **Botões de Exportação**: Baixe o CSV ou JSON imediatamente.

---

## 🛠️ Arquitetura, Documentação & Tecnologias

- **Manifest V3**: Construída segundo as diretrizes mais rigorosas do Google Chrome para extensões seguras e eficientes.
- **Zero Dependências de Produção**: Código limpo em Vanilla JavaScript (ES Modules), CSS moderno e componentes nativos de renderização SVG.
- **100% Determinístico**: Cálculos, partições e diagnósticos executados localmente sem envio de dados para servidores ou modelos de IA.
- **Documentação Técnica Completa**:
  - 📘 [Guia do Desenvolvedor (`DEVELOPER.md`)](DEVELOPER.md) — Configuração, fluxo de trabalho, testes e troubleshooting.
  - 🏛️ [Arquitetura do Sistema (`ARCHITECTURE.md`)](ARCHITECTURE.md) — Diagramas Mermaid, fluxo de dados e decisões de design.
  - 🔒 [Política de Privacidade (`PRIVACY.md`)](PRIVACY.md) — Política de privacidade pública e uso exclusivo no cliente.
  - 🏪 [Guia da Chrome Web Store (`CHROMEWEBSTORE.md`)](CHROMEWEBSTORE.md) — Ficha da loja, justificativas de permissões e assets.

---

## 🧪 Testes e Empacotamento

```bash
# Gera os dados sintéticos e executa os testes (Node.js 18.20.0 ou superior)
npm test

# Gera somente os dados para a prévia offline do dashboard com ?mock=true
npm run generate:mock

# Cria o arquivo ZIP limpo pronto para publicação na Chrome Web Store
npm run build:zip
```

---

## 🔒 Privacidade

- **100% Local**: Nenhum dado pessoal, histórico de estudo ou credencial é enviado para servidores de terceiros.
- Todas as requisições ocorrem diretamente entre o navegador do usuário e o domínio oficial do `aprovadoapp.com`.

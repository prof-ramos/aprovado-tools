# Guia do Desenvolvedor — Aprovado Tools

Este documento orienta desenvolvedores e contribuidores na configuração do ambiente, fluxo de desenvolvimento, testes e resolução de problemas da extensão **Aprovado Tools**.

---

## 1. Instruções de Configuração

### 1.1. Pré-requisitos
- **Node.js**: Versão 18.x ou superior (utilizamos o test runner nativo `node --test`).
- **Navegador baseado em Chromium**: Google Chrome, Brave ou Microsoft Edge (com suporte a Manifest V3).
- **Git**: Para controle de versão.

### 1.2. Clonando o Repositório
```bash
git clone https://github.com/prof-ramos/aprovado-tools.git
cd aprovado-tools
```

### 1.3. Instalação de Dependências
O projeto adota uma arquitetura com **zero dependências externas de produção**. Todos os utilitários rodam diretamente sobre os padrões da Web (ES Modules, SVG, DOM APIs) e o ambiente de testes usa os módulos nativos do Node.js:
```bash
npm install # Inicialização rápida
```

### 1.4. Carregando a Extensão no Navegador (Modo Desenvolvedor)
1. Abra o navegador e acesse a URL: `chrome://extensions`
2. No canto superior direito, ative a chave **"Modo do desenvolvedor"** (Developer mode).
3. Clique no botão **"Carregar sem compactação"** (Load unpacked).
4. Selecione a pasta raiz do projeto: `/Users/gabrielramos/Developer/personal/aprovado-tools`.
5. A extensão **Aprovado Tools** aparecerá na sua lista de extensões ativas.

### 1.5. Modos de Operação (Real vs. Mock)
- **Modo Real (Online)**: Faça login normalmente na sua conta em [aprovadoapp.com](https://aprovadoapp.com). A extensão utilizará automaticamente o cookie de sessão ativo.
- **Modo Mock (Offline / Testes)**: É possível testar todas as funcionalidades do Dashboard sem login ativo. Basta abrir a página do dashboard com o parâmetro de mock:
  ```text
  chrome-extension://<EXTENSION_ID>/dashboard/dashboard.html?mock=true
  ```

---

## 2. Visão Geral da Estrutura do Projeto

```
aprovado-tools/
├── manifest.json            # Manifesto da extensão (Manifest V3)
├── background.js            # Service Worker em background (menus de contexto e roteamento)
├── content.js               # Content Script injetado no AprovadoApp
├── content.css              # Estilos dos botões injetados na interface web
├── shared/                  # Módulos compartilhados entre popup, sidepanel e dashboard
│   ├── api.js               # Cliente HTTP e gerenciamento de cache de dados
│   ├── analytics.js         # Motor analítico determinístico (métricas, circadiano, quadrantes)
│   └── export.js            # Utilitários de exportação (CSV com BOM, JSON e Markdown)
├── popup/                   # Interface compacta da barra de extensões
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── sidepanel/               # Painel lateral companion (Chrome Side Panel)
│   ├── sidepanel.html
│   ├── sidepanel.css
│   └── sidepanel.js
├── dashboard/               # Painel analítico completo (Full Page)
│   ├── dashboard.html
│   ├── dashboard.css
│   └── dashboard.js
├── icons/                   # Ícones da extensão (16x16, 32x32, 48x48, 128x128 PNG)
├── tests/                   # Suítes de testes unitários, integração e estresse
│   ├── fixtures/            # Mock multianual sintético (2016–2026)
│   ├── circadian.test.js
│   ├── heatmap.test.js
│   ├── multiannual.test.js
│   ├── quadrants.test.js
│   ├── mix_nlg.test.js
│   ├── stress.test.js
│   └── e2e.test.js
├── scripts/                 # Scripts auxiliares de geração de ícones e fixtures
├── CHROMEWEBSTORE.md        # Especificações completas para publicação na Web Store
├── PRIVACY.md               # Política de privacidade oficial pública
└── package.json             # Scripts de teste e empacotamento
```

---

## 3. Fluxo de Trabalho de Desenvolvimento

### 3.1. Ciclo de Alteração e Recarga
Ao editar arquivos JavaScript, HTML ou CSS:
1. Edite o código localmente no seu editor preferido.
2. Para aplicar alterações no `background.js` ou `manifest.json`: acesse `chrome://extensions` e clique no ícone de recarga (↻) do card da extensão.
3. Para alterações no `dashboard.html` ou `popup.html`: basta recarregar a aba ou fechar e reabrir o popup.
4. Para recarregar via console do DevTools na aba da extensão:
   ```javascript
   chrome.runtime.reload();
   ```

### 3.2. Gerando o Pacote de Produção (ZIP)
Para gerar o pacote limpo para publicação na Chrome Web Store:
```bash
npm run build:zip
```
O arquivo final será salvo em `dist/aprovado-tools-v1.0.0.zip` excluindo arquivos de teste, git e documentação de desenvolvimento.

---

## 4. Abordagem de Testes

Utilizamos o test runner nativo do Node.js (`node --test`), garantindo execução ultrarrápida (sub-200ms) sem necessidade de bibliotecas externas pesadas como Jest ou Mocha.

### 4.1. Executando os Testes
```bash
npm test
```

### 4.2. Estratégia de Cobertura por Tiers
1. **Tier 1 — Unidades e Algoritmos Puros**:
   - `circadian.test.js`: Distribuição por 24 horas, identificação de hora de pico e soma exata de 100% dos turnos.
   - `heatmap.test.js`: Geração de 53/54 semanas do calendário e níveis de intensidade quartil.
   - `multiannual.test.js`: Agregações anuais e limites exatos das fases (`ALTA_INTENSIDADE`, `MANUTENCAO`, `HIATO`).
   - `quadrants.test.js`: Cálculo de medianas e particionamento nos 4 quadrantes.
   - `mix_nlg.test.js`: Decomposição metodológica e motor de regras de diagnóstico.
2. **Tier 2 — Casos de Borda (Corner Cases)**:
   - Arrays de atividades vazios, anos bissextos (366 dias), zero questões respondidas e divisões por zero.
3. **Tier 3 — Integração Ponta a Ponta**:
   - `e2e.test.js`: Execução completa de `computeHistoricalPatterns` e checagem cruzada de consistência entre os módulos.
4. **Tier 4 — Cenários do Mundo Real**:
   - Ciclo contínuo de 11 anos, longos períodos de inatividade e sprint pré-edital.
5. **Tier 5 — Testes Adversariais de Estresse**:
   - `stress.test.js`: Processamento de 10.000 sessões em menos de 500ms, transições de horário de verão (DST), datas corrompidas e tempos de estudo gigantescos (100.000h).

---

## 5. Etapas Comuns de Solução de Problemas

| Sintoma / Erro | Causa Mais Provável | Procedimento de Resolução |
|---|---|---|
| **"Usuário não autenticado no AprovadoApp" (Erro 401)** | Sessão web expirada ou ausência do cookie `aprovado`. | Abra [aprovadoapp.com](https://aprovadoapp.com) em uma aba e efetue o login. Em seguida, clique em "Sincronizar" na extensão. |
| **"Side Panel não abre ao clicar no botão"** | A API `chrome.sidePanel.open()` exige gesto do usuário (*user gesture*). | Certifique-se de disparar a abertura a partir de um clique direto (`click` event) no popup ou botão injetado. |
| **Acentos desformatados no Excel ao abrir CSV** | O Excel requer marcador de ordem de bytes (BOM) UTF-8. | O módulo `export.js` já inclui `\uFEFF` no início do arquivo e separador `;`. Evite remover esse caractere ao alterar a exportação. |
| **Erro de violação de CSP (Content Security Policy)** | Tentativa de usar scripts inline (`<script>code</script>`), `eval()` ou atributos inline (`onclick=""`). | O Manifest V3 proíbe estritamente código inline. Utilize arquivos `.js` externos e registre eventos com `addEventListener`. |
| **"QUOTA_BYTES_PER_ITEM exceeded" no storage** | Volume de atividades ultrapassando a cota padrão de 5 MB do storage. | A permissão `"unlimitedStorage"` no `manifest.json` resolve essa limitação. Confirme se ela consta nas permissões do manifesto. |

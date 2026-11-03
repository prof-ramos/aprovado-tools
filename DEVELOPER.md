# Guia do Desenvolvedor — Aprovado Tools

Este documento orienta desenvolvedores e contribuidores na configuração do ambiente, fluxo de desenvolvimento, testes e resolução de problemas da extensão **Aprovado Tools**.

Para instalação de usuário e formatos de exportação, consulte o [guia de uso](docs/uso.md). O [índice de documentação](docs/README.md) separa os guias atuais dos recibos históricos.

Para executar e registrar a validação de uma alteração, siga o
[workflow de validação para agentes](docs/workflow-validacao.md).

---

## 1. Instruções de Configuração

### 1.1. Pré-requisitos
- **Node.js**: Versão 18.20.0 ou superior para os scripts e o test runner nativo `node --test`. Prefira uma versão LTS com suporte ativo; Node 18 está fora de suporte e é mantido na CI apenas para verificar compatibilidade.
- **Google Chrome atualizado**: o painel usa `chrome.sidePanel.open()`, disponível a partir do Chrome 116. Outros navegadores Chromium precisam de validação própria; suporte a Manifest V3 sozinho não comprova suporte ao painel.
- **Git**: Para controle de versão.

### 1.2. Clonando o Repositório
```bash
git clone https://github.com/prof-ramos/aprovado-tools.git
cd aprovado-tools
```

### 1.3. Preparação do Ambiente
O projeto não possui dependências npm de produção nem de desenvolvimento: não é necessário executar `npm install`. Os utilitários usam ES Modules, SVG e DOM APIs; os testes usam módulos nativos do Node.js. Após clonar o repositório, valide o ambiente com:
```bash
npm test
```

### 1.4. Carregando a Extensão no Navegador (Modo Desenvolvedor)
1. Abra o navegador e acesse a URL: `chrome://extensions`
2. No canto superior direito, ative a chave **"Modo do desenvolvedor"** (Developer mode).
3. Clique no botão **"Carregar sem compactação"** (Load unpacked).
4. Selecione a pasta raiz do repositório clonado, que contém o arquivo `manifest.json`.
5. A extensão **Aprovado Tools** aparecerá na sua lista de extensões ativas.

### 1.5. Modos de Operação (Real vs. Mock)
- **Modo Real (Online)**: Faça login normalmente na sua conta em [aprovadoapp.com](https://aprovadoapp.com). A extensão utilizará automaticamente o cookie de sessão ativo.
- **Modo Mock (Offline / Testes)**: Para visualizar o Dashboard sem login ativo, gere primeiro os dados sintéticos na raiz do repositório:
  ```bash
  npm run generate:mock
  ```
  O comando cria `tests/fixtures/multiannual_mock_2016_2026.json`. Esse arquivo é gerado localmente, ignorado pelo Git e também recriado automaticamente por `npm test`. Depois, carregue a extensão sem compactação e abra:
  ```text
  chrome-extension://<EXTENSION_ID>/dashboard/dashboard.html?mock=true
  ```
  Para prévia fora da extensão, sirva a raiz do repositório por um servidor HTTP local (por exemplo, `python3 -m http.server 8000 --bind 127.0.0.1`) e acesse `http://127.0.0.1:8000/dashboard/dashboard.html?mock=true`. Não abra o HTML diretamente por `file://`, pois o navegador precisa carregar módulos e buscar o JSON. O mock não exige conexão com o AprovadoApp. O ZIP de produção não inclui fixtures; use o checkout local para esta prévia.


### 1.6. Verificação do popup e do painel nativo

1. Identifique o navegador, perfil, checkout e commit de teste. Confirme que a extensão local carregada em `chrome://extensions` aponta para esse checkout e que o login no AprovadoApp pertence ao mesmo perfil.
2. Clique em **Recarregar** na extensão e, depois, recarregue completamente a página do AprovadoApp. Observe o novo documento carregado antes de contar os controles: nós da versão anterior podem permanecer até essa segunda recarga. O esperado é um botão **Exportar e métricas** no topo e um atalho flutuante distinto.
3. Abra o popup pelo ícone **Aprovado Tools** da barra do navegador. `popup/popup.html` aberto em uma aba serve apenas para inspecionar conteúdo: os botões chamam `window.close()`, podendo fechar a aba e seu espaço de automação.
4. Abra **Abrir painel lateral** no popup autenticado ou menu de contexto do ícone → **Abrir Painel Lateral de Estudos**. Confirme o painel encaixado junto à página e sua alça de redimensionamento. `sidepanel/sidepanel.html` em uma aba verifica somente a página.
5. Sem login, confirme **Sessão desconectada**. Para o teste autenticado, use preenchimento seguro do gerenciador ou entrada direta pelo usuário; acione **Sincronizar** e observe a transição até **Sincronizado** com métricas. Confirme também que **Abrir dashboard completo** carrega o dashboard com os mesmos totais.
6. Após cada ação de automação, observe o estado atual antes de escolher a próxima ação; separe “clique enviado” de “resultado confirmado”. Se o Ego não expuser o popup/painel ou houver incompatibilidade concreta, use Computer Use na interface nativa do Chrome e repita o fluxo a partir do estado observado.
7. Registre navegador/perfil, commit, modo real/mock, superfície (aba/popup/painel nativo), ação e resultado. Liste filtros e exportações sem exercício; publique apenas agregados e mantenha backups reais fora do Git. Encerre somente as abas abertas para o teste, preservando as pessoais.

Ao encerrar uma entrega, use [Conclusão de tarefas](docs/conclusao-tarefas.md). Se uma tentativa de acesso falhar, siga [Diagnóstico de acesso](docs/diagnostico-acesso.md) antes de declarar bloqueio. Antes de delegar planos existentes, consulte [plans/README.md](plans/README.md).

Para correções de controles injetados, valide a quantidade de botões depois de várias mutações da página e de reinjetar o script antes de os callbacks agendados terminarem. O teste deve executar o `content.js` real.

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
│   ├── export.js            # Utilitários de exportação (CSV com BOM, JSON e Markdown)
│   └── ui.js                # Utilitários de escape e validação de cores na interface
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
│   ├── fixtures/            # Testes do gerador e JSON sintético gerado localmente
│   ├── circadian.test.js
│   ├── dashboard.test.js
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
3. Para alterações nas páginas HTML, CSS ou módulos usados por elas: recarregue a aba ou feche e reabra o popup/painel. Para `content.js` e `content.css`, recarregue a extensão e depois a página do AprovadoApp. Veja a [tabela oficial de recarga](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#reload).
4. Para recarregar via console do DevTools na aba da extensão:
   ```javascript
   chrome.runtime.reload();
   ```

### 3.2. Gerando o Pacote de Produção (ZIP)
Para gerar o pacote limpo para publicação na Chrome Web Store:
```bash
npm run build:zip
```
O nome é derivado de `manifest.json`: `dist/aprovado-tools-v<versão>.zip`. O comando inclui somente os arquivos e diretórios de execução enumerados em `scripts/build_zip.js` e exclui `shared/backup.js`; testes, fixtures e documentação ficam fora do pacote. O script cria o ZIP em um diretório temporário e substitui somente o arquivo da versão atual depois do sucesso. Outros ZIPs ficam intactos e uma falha preserva o pacote anterior. `zip` e `unzip` devem estar disponíveis no ambiente.

A geração do ZIP não publica a extensão. As releases do GitHub e uma futura submissão à loja são etapas separadas; veja [CHROMEWEBSTORE.md](CHROMEWEBSTORE.md).

---

## 4. Abordagem de Testes

Utilizamos o test runner nativo do Node.js (`node --test`) e `node:assert/strict`, sem bibliotecas externas. O runner descobre os arquivos `*.test.js` recursivamente, sem depender da expansão de globs pelo shell. Os arquivos são executados em sequência (`--test-concurrency=1`) para que a medição de desempenho não concorra com outros testes da suíte. A duração varia conforme o ambiente e a suíte; consulte a saída de cada execução e a CI, em vez de um relatório estático de resultados.

### 4.1. Executando os Testes
```bash
npm test
```

O hook `pretest` gera a fixture antes da descoberta dos testes, inclusive em um clone limpo. Para executar apenas um arquivo, gere a fixture primeiro:

```bash
npm run generate:mock
node --test tests/heatmap.test.js
```

A CI executa `npm test` em Node 18, 22, 24 e 26, nos fusos `UTC` e `America/Sao_Paulo`. Para reproduzir a combinação de fuso no Linux/macOS:

```bash
TZ=UTC npm test
TZ=America/Sao_Paulo npm test
```

No PowerShell, use `$env:TZ = 'America/Sao_Paulo'; npm test`. A matriz ajuda a detectar regressões em dias bissextos, viradas de data e transições históricas do horário de verão.

### 4.2. Dados Sintéticos Reproduzíveis

`scripts/generate_multiannual_mock.js` produz o histórico de 2016 até 2 de novembro de 2026. A semente é fixa, reiniciada em cada chamada; o embaralhamento usa Fisher–Yates e o calendário usa UTC para gerar os mesmos bytes independentemente do fuso da máquina. A fixture cobre anos de alta intensidade, manutenção e hiato, as 24 horas, os quatro turnos, matérias com e sem exercícios e diferentes métodos de estudo.

`tests/fixtures/generator.test.js` verifica chamadas repetidas, independência de objetos retornados, igualdade entre fusos e geração pela CLI em uma pasta inicialmente vazia. Altere o gerador quando precisar mudar os cenários, nunca o JSON gerado. Os testes analíticos devem continuar usando expectativas derivadas dos requisitos e casos pequenos explícitos, não apenas repetir a lógica do motor.

### 4.3. Estratégia de Cobertura por Tiers
1. **Tier 1 — Unidades e Algoritmos Puros**:
   - `circadian.test.js`: Distribuição por 24 horas, identificação de hora de pico e soma exata de 100% dos turnos.
   - `heatmap.test.js`: Geração de 53/54 semanas do calendário e níveis de intensidade por duração diária.
   - `multiannual.test.js`: Agregações anuais e limites exatos das fases (`ALTA_INTENSIDADE`, `MANUTENCAO`, `HIATO`).
   - `quadrants.test.js`: Cálculo de medianas e particionamento nos 4 quadrantes.
   - `mix_nlg.test.js`: Decomposição metodológica e motor de regras de diagnóstico.
2. **Tier 2 — Casos de Borda (Corner Cases)**:
   - Arrays de atividades vazios, anos bissextos (366 dias), zero questões respondidas e divisões por zero.
3. **Tier 3 — Integração Ponta a Ponta**:
   - `e2e.test.js`: Execução completa de `computeHistoricalPatterns` e checagem cruzada de consistência entre os módulos.
   - `dashboard.test.js`: Regressões dos renderizadores, atualização após sincronização e tratamento seguro de conteúdo. Esses testes não substituem uma verificação visual em navegador.
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
| **Falha ao persistir o snapshot** | Limite de armazenamento ou indisponibilidade da API local. | Confira a mensagem real e o manifesto. `storage.local` tem cota de 10 MB no Chrome atual (5 MB até o Chrome 113), ampliável por `unlimitedStorage`; `QUOTA_BYTES_PER_ITEM` não é a cota de `storage.local`. |

## 6. Limites e referências

A prévia HTTP testa conteúdo e layout, sem autenticação, permissões ou superfícies nativas. O modo normal exige identidade online antes de ler cache, e o conversor de backups não tem integração à UI. Consulte [ARCHITECTURE.md](ARCHITECTURE.md) antes de alterar esses limites.

Referências oficiais: [Side Panel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel), [armazenamento local](https://developer.chrome.com/docs/extensions/reference/api/storage) e [cookies](https://developer.chrome.com/docs/extensions/reference/api/cookies).

## 7. Checagem documental reproduzível

Execute `npm run check:docs` para conferir arquivos e âncoras de todos os Markdown rastreados, inclusive históricos, sem rede ou dependências. Adicione arquivos novos ao Git antes da execução padrão; para testar arquivos ainda não rastreados, passe seus caminhos após `--`. Links de máquina ficam como caminhos em código. O parser cobre os padrões usados no repositório, sem implementar toda a especificação Markdown nem validar URLs externas.

A CI executa essa checagem uma vez no job **Documentation**, além de `git diff --check HEAD^ HEAD`. Oito jobs continuam cobrindo a suíte nas combinações de Node e fuso. Erros de arquivo/âncora e whitespace são verificações mecânicas; a revisão humana ou por agente continua responsável por conferir se as promessas dos guias correspondem ao comportamento.

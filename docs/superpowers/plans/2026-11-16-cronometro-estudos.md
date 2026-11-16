# Cronômetro de Estudos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar funcionalidade de cronômetro de estudos integrada à extensão Aprovado Tools (Side Panel e Popup) persistida em `chrome.storage.local` e com envio para a API oficial do AprovadoApp (`/service/Atividade/Novo`).

**Architecture:** Módulo puro `shared/timer.js` gerencia estado de tempo baseado em timestamps (`startTime`, `accumulatedMs`, `status`) para sobreviver à suspensão do Service Worker no Manifest V3. `shared/api.js` ganha método `createActivity()` compatível com o endpoint reverso-engenheirado `/service/Atividade/Novo`. A UI do Side Panel e Popup consome o estado reativo do timer e sincroniza automaticamente a sessão após salvar.

**Tech Stack:** JavaScript ES Modules (Vanilla JS nativo sem dependências de bundle), Node.js built-in test runner (`node:test`), Manifest V3 Chrome Storage API.

**Spec:** Baseado na API nativa do AprovadoApp reverso-engenheirada em `https://aprovadoapp.com/service/Atividade/Novo` e nos limites arquiteturais definidos em `ARCHITECTURE.md`.

## Global Constraints

- 100% Client-Side sem dependências externas ou pacotes npm em runtime.
- Compatibilidade estrita com Manifest V3 (Service Worker efêmero e permissões mínimas).
- Formatação em pt-BR e persistência limpa de cache por usuário.
- Não perder contagem de tempo durante suspensão de abas ou reinicialização da extensão.

## Review Focus

1. Interrupção/reabertura do Side Panel enquanto o cronômetro está rodando: tempo decorrido deve continuar calculando corretamente a partir do timestamp original.
2. Troca de conta ou sessão desconectada com timer ativo: descartar ou avisar sem enviar atividade para a conta incorreta.
3. Tentativa de salvar atividade com duração zero ou negativa: bloqueio antes da chamada da API (evitar erro 400 do servidor).
4. Matéria obrigatória (`Materia.Id > 0`): validação na UI e no cliente de API.
5. Sincronização pós-salvamento: disparar atualização imediata do snapshot analítico local para refletir a nova sessão nos gráficos.

---

### Task 1: API Endpoint `createActivity` em `shared/api.js`

**Files:**
- Modify: `shared/api.js`
- Test: `tests/api.test.js`

**Interfaces:**
- Consumes: `request(endpoint, options)` interno de `shared/api.js`
- Produces: `AprovadoApi.createActivity(activityData: Object) -> Promise<Object>`

- [ ] **Step 1: Write the failing test**

Adicionar teste em `tests/api.test.js`:
```javascript
test('createActivity envia payload correto para Atividade/Novo e retorna resultado', async () => {
  const originalFetch = globalThis.fetch;
  try {
    let capturedUrl = null;
    let capturedBody = null;
    globalThis.fetch = async (url, opts) => {
      capturedUrl = url;
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ Id: 99999, FacebookStatus: null })
      };
    };

    const payload = {
      Materia: { Id: 123 },
      DataInicio: '16/11/2026',
      HoraInicio: '09:00',
      SegundoInicio: '00',
      Tipo: 'cronometro',
      Duracao: 3600000
    };

    const result = await AprovadoApi.createActivity(payload);
    assert.strictEqual(result.Id, 99999);
    assert.ok(capturedUrl.includes('Atividade/Novo'));
    assert.strictEqual(capturedBody.Tipo, 'cronometro');
    assert.strictEqual(capturedBody.Duracao, 3600000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/api.test.js`
Expected: FAIL com "AprovadoApi.createActivity is not a function"

- [ ] **Step 3: Implement `createActivity` in `shared/api.js`**

Implementar:
```javascript
async createActivity(activity) {
  if (!activity?.Materia?.Id) {
    throw new Error('Matéria é obrigatória para salvar a atividade.');
  }
  if (!activity?.Duracao || activity.Duracao <= 0) {
    throw new Error('A duração precisa ser maior que zero.');
  }
  return await request('Atividade/Novo', {
    method: 'POST',
    body: activity
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/api.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/api.js tests/api.test.js
git commit -m "feat(api): adicionar método createActivity para o endpoint Atividade/Novo"
```

---

### Task 2: Core Timer Module `shared/timer.js`

**Files:**
- Create: `shared/timer.js`
- Test: `tests/timer.test.js`

**Interfaces:**
- Produces:
  - `createTimerState(materia, conteudo): TimerState`
  - `startTimer(state, nowMs): TimerState`
  - `pauseTimer(state, nowMs): TimerState`
  - `resumeTimer(state, nowMs): TimerState`
  - `getElapsedMs(state, nowMs): number`
  - `formatElapsedTimer(ms): { hours: string, minutes: string, seconds: string, text: string }`
  - `buildActivityPayload(state, options, nowMs): Object`

- [ ] **Step 1: Write the failing tests**

Criar `tests/timer.test.js` testando criação de estado, ciclo de vida (start, pause, resume), cálculo determinístico de tempo decorrido e construção do payload com formato de data/hora oficial do AprovadoApp.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/timer.test.js`
Expected: FAIL com módulo inexistente.

- [ ] **Step 3: Implement `shared/timer.js`**

Implementar funções puras de manipulação do estado e formatação `HH:MM:SS`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/timer.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/timer.js tests/timer.test.js
git commit -m "feat(timer): adicionar módulo de cálculo e estado do cronômetro"
```

---

### Task 3: Timer UI no Side Panel (`sidepanel/`)

**Files:**
- Modify: `sidepanel/sidepanel.html`
- Modify: `sidepanel/sidepanel.css`
- Modify: `sidepanel/sidepanel.js`
- Test: `tests/sidepanel-timer.test.js`

**Interfaces:**
- Consumes: `AprovadoApi`, `shared/timer.js`, `chrome.storage.local`

- [ ] **Step 1: Write integration/dom tests for Side Panel Timer**

Criar `tests/sidepanel-timer.test.js` testando renderização do cronômetro, seleção de matéria, botões Iniciar/Pausar/Salvar e atualização reativa do storage.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/sidepanel-timer.test.js`
Expected: FAIL

- [ ] **Step 3: Update `sidepanel/sidepanel.html` and `sidepanel/sidepanel.css`**

Adicionar container `#section-timer` com display de horas, minutos, segundos, seletores de matéria e conteúdo, controles de ação e modal/campos de conclusão (tipo de estudo, questões resolvidas, acertos).

- [ ] **Step 4: Update `sidepanel/sidepanel.js`**

Integrar carregamento de matérias no seletor, escuta de eventos dos botões, persistência em `chrome.storage.local` (`aprovado_active_timer`), animação via `setInterval` ou `requestAnimationFrame` e chamada a `AprovadoApi.createActivity` seguida de refresh do snapshot.

- [ ] **Step 5: Run tests and verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add sidepanel/ tests/sidepanel-timer.test.js
git commit -m "feat(sidepanel): integrar widget interativo de cronômetro de estudos"
```

---

### Task 4: Sincronização e Mini-widget no Popup (`popup/`)

**Files:**
- Modify: `popup/popup.html`
- Modify: `popup/popup.css`
- Modify: `popup/popup.js`

**Interfaces:**
- Consumes: `chrome.storage.local.get(['aprovado_active_timer'])`

- [ ] **Step 1: Write tests for Popup timer presence and link to Side Panel**

Adicionar asserções em `tests/popup-panel-ux.test.js`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/popup-panel-ux.test.js`
Expected: FAIL

- [ ] **Step 3: Implement Popup timer mirror / quick action**

Exibir barra de status se houver um cronômetro rodando (matéria e tempo decorrido) com botão para abrir o Side Panel ou pausar rapidamente.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add popup/ tests/popup-panel-ux.test.js
git commit -m "feat(popup): exibir status do cronômetro ativo no popup"
```

---

### Task 5: Documentação e Auditoria do Workflow de Validação

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify: `README.md`
- Modify: `docs/workflow-validacao.md`

- [ ] **Step 1: Atualizar documentação arquitetural**

Registrar novo módulo `shared/timer.js`, endpoint `Atividade/Novo` e o ciclo de vida do cronômetro em `ARCHITECTURE.md`.

- [ ] **Step 2: Executar testes de documentação e empacotamento**

Run: `npm run check:docs && npm run build:zip && npm test`
Expected: PASS (todos os 293+ testes passando).

- [ ] **Step 3: Commit**

```bash
git add ARCHITECTURE.md README.md docs/
git commit -m "docs: documentar arquitetura do cronômetro e atualizar workflow"
```

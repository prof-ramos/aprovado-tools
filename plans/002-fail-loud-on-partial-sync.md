# Plano 002: Falha na sincronização de atividades/matérias não gera mais um snapshot vazio em cache nem um backup vazio

> **Instruções para o executor**: siga este plano passo a passo. Rode cada
> comando de verificação e confirme o resultado esperado antes de passar ao
> próximo passo. Se qualquer item da seção "Condições de PARADA" ocorrer,
> pare e reporte, sem improvisar. Ao terminar, atualize a linha deste plano
> em `plans/README.md`, a menos que um revisor tenha te despachado e dito que
> ele mantém o índice.
>
> **Checagem de drift (rode primeiro)**: `git diff --stat c8b055e..HEAD -- shared/api.js tests/api.test.js`
> Se algum arquivo do escopo mudou desde que este plano foi escrito, compare
> os trechos de "Estado atual" com o código vivo antes de prosseguir. Uma
> divergência é condição de PARADA.

## Status

- **Prioridade**: P1
- **Esforço**: S
- **Risco**: BAIXO
- **Depende de**: nenhum
- **Categoria**: bug
- **Planejado em**: commit `bcf0ec0` (reconciliado com `c8b055e`), 2026-11-03

## Por que isso importa

Este repositório é uma extensão Chrome (Manifest V3, JavaScript puro com ES modules, sem build) que baixa o histórico de estudos do usuário da API do AprovadoApp, guarda um snapshot em `chrome.storage.local` por 5 minutos e oferece um "Backup JSON completo".

Hoje, se a requisição de atividades (`Atividade/Listar`) ou de matérias (`Materia/Listar`) falhar, seja por erro 500, timeout ou queda de rede, o erro é engolido e trocado por `[]`. O snapshot vazio é gravado no cache como se fosse válido. Por 5 minutos, popup, painel lateral e dashboard mostram "0 h, 0 sessões", e o botão de backup baixa um arquivo com `"atividades": []` sem nenhum aviso.

Para quem usa o backup como cópia de segurança de anos de estudo, isso é perda de dados silenciosa. Depois deste plano, falhas nesses dois endpoints essenciais propagam o erro e não sobrescrevem o cache; os endpoints opcionais (ciclo e revisões) continuam tolerantes.

## Estado atual

- `shared/api.js`: cliente HTTP da API do AprovadoApp e cache do snapshot. Não tem testes.
- Chamadores: `popup/popup.js:56` e `:158`, `sidepanel/sidepanel.js:57`, `dashboard/dashboard.js:108` e `:481`. Todos já envolvem `fetchCompleteSnapshot` em `try/catch` e, no `catch`, mostram o estado "Desconectado". Não precisam mudar.

`shared/api.js:173-213` (o bug está nas linhas 189-190):
```js
  async fetchCompleteSnapshot(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = await chrome.storage.local.get(['aprovado_data_snapshot', 'aprovado_last_sync']);
      const isFresh = cached.aprovado_last_sync && (Date.now() - cached.aprovado_last_sync < 1000 * 60 * 5); // 5 min
      if (isFresh && cached.aprovado_data_snapshot) {
        return cached.aprovado_data_snapshot;
      }
    }

    const user = await this.getUser();
    if (!user || !user.Id) {
      throw new Error('Sessão expirada ou não autenticado.');
    }

    // Parallel fetch for speed
    const [materias, atividades, ciclo, revisoesPendentes, revisoesConcluidas] = await Promise.all([
      this.listSubjects().catch(() => []),
      this.listActivities().catch(() => []),
      this.getCycleProgress().catch(() => null),
      this.listPendingReviews().catch(() => []),
      this.listCompletedReviews().catch(() => [])
    ]);

    const snapshot = { user, materias, atividades, ciclo, revisoesPendentes, revisoesConcluidas, syncedAt: new Date().toISOString() };

    await chrome.storage.local.set({
      aprovado_data_snapshot: snapshot,
      aprovado_last_sync: Date.now(),
      aprovado_user: user
    });

    return snapshot;
  }
```

`getCycleProgress`, `listPendingReviews` e `listCompletedReviews` (`shared/api.js:115-146`) já fazem `try/catch` internamente e retornam `null`/`[]`. É intencional: são recursos opcionais, porque o usuário pode não ter ciclo configurado. `listSubjects` e `listActivities` (`:87-103`) **não** têm `try/catch`.

`request()` (`shared/api.js:14-62`) usa os globais `fetch` e `chrome` só no momento da chamada. Lê `response.status`, `response.redirected`, `response.ok` e `await response.text()`. Status 401/403 ou `redirected` → `Error` com `status = 401`. `!ok` → `Error` com `status`. Isso permite testar no Node com stubs em `globalThis.fetch` e `globalThis.chrome`.

**Convenções:** ES modules, 2 espaços, aspas simples, ponto e vírgula. Mensagens de erro e comentários em português. Testes com `node:test` + `node:assert/strict`, como em `tests/heatmap.test.js`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
```

## Comandos que você vai precisar

| Propósito | Comando | Esperado em caso de sucesso |
|---|---|---|
| Testes (todos) | `npm test` | `ℹ fail 0` |
| Testes (este arquivo) | `node --test tests/api.test.js` | `ℹ fail 0` |
| Sintaxe | `node --check shared/api.js` | exit 0 |

Node instalado: v24 (tem `fetch` global, que os testes vão sobrescrever).

## Escopo

**Dentro do escopo:**
- `shared/api.js` (só o método `fetchCompleteSnapshot`)
- `tests/api.test.js` (criar)

**Fora do escopo** (NÃO mexa):
- `popup/`, `sidepanel/`, `dashboard/`: o tratamento de erro deles já existe. Melhorar a mensagem de "Desconectado" para "Falha ao sincronizar" fica para depois; veja as Notas.
- `getCycleProgress`, `listPendingReviews` e `listCompletedReviews`: devem continuar tolerantes a falha.
- A lógica de cache por usuário (o cache não é ligado ao `user.Id`). É um achado separado, não selecionado.
- `request()`: não altere a classificação de erros.

## Fluxo git

- Branch: `advisor/002-fail-loud-on-partial-sync`.
- Conventional commits. Sugestão: `fix(api): do not cache empty snapshot when activities or subjects fail`.
- NÃO faça push nem abra PR sem instrução.

## Passos

### Passo 1: escreva os testes (devem falhar)

Crie `tests/api.test.js` com os casos do Plano de testes. Use o helper abaixo (adapte livremente, mas mantenha a ideia de rotear pelo final da URL):

```js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { AprovadoApi } from '../shared/api.js';

function makeResponse(status, bodyObj) {
  return {
    status,
    ok: status >= 200 && status < 300,
    redirected: false,
    text: async () => (bodyObj === undefined ? '' : JSON.stringify(bodyObj))
  };
}

let storage, setCalls, originalFetch;

function installStubs(routes) {
  // routes: { 'Usuario/Obter': [200, {...}], 'Atividade/Listar': [500, 'x'], ... }
  globalThis.fetch = async (url) => {
    const key = Object.keys(routes).find(k => url.endsWith(`/service/${k}`));
    if (!key) throw new Error(`rota não mapeada: ${url}`);
    const [status, body] = routes[key];
    return makeResponse(status, body);
  };
  globalThis.chrome = {
    storage: {
      local: {
        get: async () => ({ ...storage }),
        set: async (obj) => { setCalls.push(obj); Object.assign(storage, obj); }
      }
    }
  };
}

beforeEach(() => { storage = {}; setCalls = []; originalFetch = globalThis.fetch; });
afterEach(() => { globalThis.fetch = originalFetch; delete globalThis.chrome; });
```

Rotas "felizes" para reaproveitar:
```js
const OK_ROUTES = {
  'Usuario/Obter': [200, { Id: 7, Nome: 'Ana' }],
  'Materia/Listar': [200, [{ Id: 1, Nome: 'Penal' }]],
  'Atividade/Listar': [200, [{ Id: 10, Duracao: 60000 }, { Id: 11, Duracao: 60000 }]],
  'Acompanhamento/CicloEstudos': [200, { TotalPorcentagem: 50 }],
  'Revisao/ListarPendentes': [200, []],
  'Revisao/ListarConcluidas': [200, []]
};
```

**Verificar**: `node --test tests/api.test.js` → os casos 2 e 3 do Plano de testes falham (hoje a promise resolve com `atividades: []`); os outros passam.

### Passo 2: deixe falhas dos endpoints essenciais propagarem

Em `fetchCompleteSnapshot`, remova o `.catch(() => [])` de `this.listSubjects()` e de `this.listActivities()`. Deixe os outros três como estão. Acima do `Promise.all`, acrescente um comentário em português explicando o porquê, por exemplo:

```js
    // Matérias e atividades são essenciais: se falharem, propagamos o erro
    // para não gravar no cache (nem exportar) um snapshot vazio como se fosse válido.
    // Ciclo e revisões são opcionais e já tratam falhas internamente.
```

Como o `Promise.all` rejeita antes do `chrome.storage.local.set`, o cache anterior fica intacto. Não é preciso mais nada.

**Verificar**: `node --check shared/api.js` → exit 0; `node --test tests/api.test.js` → `ℹ fail 0`.

### Passo 3: rode a suíte completa

**Verificar**: `npm test` → `ℹ fail 0`; total = 89 + o número de testes novos.

## Plano de testes

Em `tests/api.test.js`, dentro de `describe('fetchCompleteSnapshot', ...)`:

1. **Caminho feliz**: com `OK_ROUTES`, `await AprovadoApi.fetchCompleteSnapshot(true)` retorna `atividades.length === 2` e `materias.length === 1`; `setCalls.length === 1`; `setCalls[0].aprovado_data_snapshot.atividades.length === 2`.
2. **Atividades com 500** (regressão): rotas iguais, exceto `'Atividade/Listar': [500, 'erro']`. `await assert.rejects(() => AprovadoApi.fetchCompleteSnapshot(true))` e depois `setCalls.length === 0`.
3. **Matérias com 500**: idem para `'Materia/Listar'`; rejeita e `setCalls.length === 0`.
4. **Cache anterior preservado**: comece com `storage = { aprovado_data_snapshot: { atividades: [{ Id: 1 }] }, aprovado_last_sync: 0 }` (expirado), com atividades falhando. Rejeita, e `storage.aprovado_data_snapshot.atividades.length === 1`.
5. **Revisões pendentes com 500**: resolve normalmente, com `revisoesPendentes` igual a `[]` e `setCalls.length === 1`.
6. **Ciclo com 500**: resolve, com `ciclo === null`.
7. **Cache fresco sem forceRefresh**: `storage = { aprovado_data_snapshot: { marcador: true }, aprovado_last_sync: Date.now() }` e `globalThis.fetch` lançando erro se for chamado. `fetchCompleteSnapshot(false)` retorna `{ marcador: true }`.

Os casos 5 e 6 vão imprimir `console.warn` (comportamento existente). Não suprima.

## Critérios de conclusão

- [ ] `npm test` sai com 0, `ℹ fail 0`, e pelo menos 7 testes novos em `tests/api.test.js`.
- [ ] `grep -n "listActivities().catch\|listSubjects().catch" shared/api.js` → nenhum resultado.
- [ ] `grep -c "getCycleProgress().catch\|listPendingReviews().catch\|listCompletedReviews().catch" shared/api.js` → `3` (os opcionais continuam tolerantes).
- [ ] `git status --porcelain` lista só `shared/api.js`, `tests/api.test.js` e `plans/README.md`.
- [ ] Linha do plano 002 atualizada em `plans/README.md`.

## Condições de PARADA

- O trecho do `Promise.all` não bate com o de "Estado atual".
- Importar `shared/api.js` no Node lança erro por causa de `chrome` no topo do módulo. Hoje não lança; se lançar, o código mudou.
- Algum teste existente (os 89) quebra.
- Você sente necessidade de alterar popup, painel lateral ou dashboard para "mostrar o erro". Isso é fora do escopo; reporte como sugestão.

## Notas de manutenção

- Efeito visível: se a API cair durante uma sincronização forçada, o usuário passa a ver "Desconectado" em vez de zeros. A mensagem é imprecisa, mas não perde dados. Uma melhoria futura seria diferenciar `err.status === 401` (sessão) de outros erros, mostrar "Falha ao sincronizar, tente novamente" e, se houver snapshot antigo em cache, exibi-lo marcado como desatualizado.
- Se um novo endpoint entrar no `Promise.all`, decida explicitamente se ele é essencial (sem `.catch`) ou opcional (com `try/catch` interno), e acrescente um teste.
- O revisor deve conferir que nenhuma escrita em `chrome.storage.local` acontece em caminhos de erro.

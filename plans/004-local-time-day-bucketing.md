# Plano 004: Métricas da Visão Geral, sequência (streak) e filtro de período usam o dia local, como o heatmap

> **Instruções para o executor**: siga este plano passo a passo. Rode cada
> comando de verificação e confirme o resultado esperado antes de passar ao
> próximo passo. Se qualquer item da seção "Condições de PARADA" ocorrer,
> pare e reporte, sem improvisar. Ao terminar, atualize a linha deste plano
> em `plans/README.md`, a menos que um revisor tenha te despachado e dito que
> ele mantém o índice.
>
> **Checagem de drift (rode primeiro)**: `git diff --stat bcf0ec0..HEAD -- shared/analytics.js tests/timezone.test.js`
> Se algum arquivo do escopo mudou desde que este plano foi escrito, compare
> os trechos de "Estado atual" com o código vivo antes de prosseguir. Uma
> divergência é condição de PARADA.

## Status

- **Prioridade**: P1
- **Esforço**: M
- **Risco**: MÉDIO (muda números que o usuário já vê: dias ativos, sequência e gráfico diário)
- **Depende de**: nenhum tecnicamente. Recomenda-se aplicar depois de 001 e 002, para que as correções de baixo risco saiam antes da que muda números visíveis.
- **Categoria**: bug
- **Planejado em**: commit `bcf0ec0`, 2026-11-03

## Por que isso importa

Esta extensão Chrome (Manifest V3, JavaScript puro) é usada por estudantes brasileiros (fuso UTC−3). O motor de métricas em `shared/analytics.js` agrupa sessões por dia de duas formas incompatíveis:

- A **Visão Geral** e a **sequência de dias** (`computeStudyMetrics` e `calculateStreak`) usam `toISOString().slice(0, 10)`, ou seja, o dia em **UTC**.
- O **heatmap**, o histórico multianual e a distribuição circadiana usam `formatLocalDate`, ou seja, o dia **local**.

Consequência, verificada com `TZ=America/Sao_Paulo`: uma sessão às 22:30 de 10/03 aparece em 11/03 na Visão Geral e em 10/03 no heatmap. Toda sessão depois das 21:00 cai no dia errado. Isso infla "dias ativos", pode quebrar ou estender a sequência indevidamente, e faz as duas abas discordarem.

O filtro de período personalizado tem o mesmo problema: `new Date('2025-03-15')` é meia-noite UTC, que no Brasil é 14/03 às 21:00. Na prática, o intervalo 10/03–15/03 **inclui** sessões de 09/03 e **exclui** as de 15/03 (também verificado).

Depois deste plano, tudo usa o dia local, de forma consistente com o resto do motor.

## Estado atual

`shared/analytics.js` é um módulo puro (sem DOM e sem `chrome`), importado por popup, painel lateral, dashboard e testes.

**1. Chave de dia em UTC, `shared/analytics.js:106-108`:**
```js
    const d = atv.Inicio ? new Date(atv.Inicio) : parseDateString(atv.DataInicio);
    if (d && !isNaN(d.getTime())) {
      const dateKey = d.toISOString().slice(0, 10);
```
Logo abaixo, nas linhas 120 e 123, o mesmo código usa `d.getDay()` e `d.getHours()`, que são **locais**. A inconsistência está dentro da própria função.

**2. Sequência em UTC, `shared/analytics.js:271-325` (`calculateStreak`):**
```js
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  today.setDate(today.getDate() - 1);
  const yesterdayKey = today.toISOString().slice(0, 10);
  ...
      const key = checkDate.toISOString().slice(0, 10);
  ...
      const prev = new Date(sortedDateKeys[i - 1]);
      const curr = new Date(sortedDateKeys[i]);
      const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
```

**3. O helper local já existe, `shared/analytics.js:340-345`.** É uma declaração de função, então pode ser usada em qualquer ponto do módulo graças ao hoisting:
```js
function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
```
O padrão já usado para converter uma chave de volta em data local está em `calculateConsecutiveStreak` (`:378`): `new Date(sortedDateKeys[i - 1] + 'T00:00:00')`.

**4. `parseDateString`, `shared/analytics.js:26-34`.** O formato `YYYY-MM-DD` cai em `new Date(str)`, que o interpreta como UTC:
```js
export function parseDateString(str) {
  if (!str) return null;
  // Handle formats: "DD/MM/YYYY" or "YYYY-MM-DD" or ISO string
  if (str.includes('/')) {
    const [d, m, y] = str.split('/');
    return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  }
  return new Date(str);
}
```
Contrato existente que os testes em `tests/stress.test.js:197-201` e `:610-614` cobram e que deve ser mantido: `parseDateString(null)`, `(undefined)` e `('')` retornam `null`; `parseDateString('not-a-date')` retorna uma `Date` inválida (`isNaN(getTime())`), **não** `null`.

**5. Filtro personalizado, `shared/analytics.js:53-60`:**
```js
  } else if (period === 'custom' && customStart) {
    minDate = new Date(customStart);
  }

  const maxDate = (period === 'custom' && customEnd) ? new Date(customEnd) : now;
  // End of day for maxDate
  maxDate.setHours(23, 59, 59, 999);
  minDate.setHours(0, 0, 0, 0);
```
`customStart` e `customEnd` vêm de `<input type="date">` (`dashboard/dashboard.js:177-182`) e sempre têm o formato `YYYY-MM-DD`.

**Convenções:** ES modules, 2 espaços, aspas simples. Testes com `node:test` + `node:assert/strict`; o runner roda **cada arquivo em um processo separado**, então definir `process.env.TZ` no topo de um arquivo de teste não afeta os outros. Exemplo de estrutura: `tests/heatmap.test.js`.

Formato de um dia do heatmap, útil para o teste de concordância (saída real de `computeActivityHeatmap(...).weeks[i].days[j]`):
```json
{"date":"2025-03-10","dayOfWeek":1,"inTargetYear":true,"ms":3600000,"hours":1,"level":1,"sessionsCount":1,"questions":0,"correct":0}
```

## Comandos que você vai precisar

| Propósito | Comando | Esperado em caso de sucesso |
|---|---|---|
| Testes (todos) | `npm test` | `ℹ fail 0` |
| Testes (este arquivo) | `node --test tests/timezone.test.js` | `ℹ fail 0` |
| Suíte inteira em UTC | `TZ=UTC npm test` | `ℹ fail 0` |
| Suíte inteira em São Paulo | `TZ=America/Sao_Paulo npm test` | `ℹ fail 0` |
| Sintaxe | `node --check shared/analytics.js` | exit 0 |

## Escopo

**Dentro do escopo:**
- `shared/analytics.js`: só `parseDateString`, `filterActivitiesByPeriod` (o ramo `custom`), a linha da chave de dia em `computeStudyMetrics` e `calculateStreak`.
- `tests/timezone.test.js` (criar)

**Fora do escopo:**
- As funções de padrões históricos (`computeMultiannualHistory`, `computeActivityHeatmap`, `computeCircadianDistribution` etc.). Já usam o dia local e são a referência.
- `shared/api.js`: as funções `getTimeReport`/`getStudyTypeReport` usam `toISOString` para "hoje", mas nada as chama.
- `tests/fixtures/multiannual_mock_2016_2026.json` e `scripts/generate_multiannual_mock.js`. O fixture tem `HoraInicio` igual à hora UTC de `Inicio`; não "corrija" isso.
- Arquivos de UI. Os valores mudam, mas a forma dos dados não.

## Fluxo git

- Branch: `advisor/004-local-time-day-bucketing`.
- Conventional commits. Sugestão: `fix(analytics): bucket overview metrics, streak and custom range by local day`.
- NÃO faça push nem abra PR sem instrução.

## Passos

### Passo 1: escreva os testes (devem falhar)

Crie `tests/timezone.test.js`. **A primeira linha executável deve ser** `process.env.TZ = 'America/Sao_Paulo';`, antes de qualquer uso de `Date`. Logo em seguida, um teste de sanidade:
```js
it('roda no fuso de São Paulo', () => {
  assert.equal(new Date(2025, 2, 10, 22, 30).getTimezoneOffset(), 180);
});
```
Depois, os casos do Plano de testes. Monte as datas sempre com o construtor local, `new Date(2025, 2, 10, 22, 30).toISOString()`, nunca com strings `Z` escritas à mão.

**Verificar**: `node --test tests/timezone.test.js` → o teste de sanidade passa; os casos 1, 2, 3, 5 e 6 falham.

### Passo 2: `parseDateString` trata `YYYY-MM-DD` como data local

Acrescente, depois do ramo com `/`:
```js
  const isoDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (isoDateOnly) {
    const [, y, m, d] = isoDateOnly;
    return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  }
```
Mantenha `return new Date(str);` no final, para que strings ISO completas e `'not-a-date'` se comportem como antes.

**Verificar**: `node --test tests/stress.test.js` → `ℹ fail 0`.

### Passo 3: filtro personalizado usa `parseDateString`

Em `filterActivitiesByPeriod`, troque `new Date(customStart)` por `parseDateString(customStart)` e `new Date(customEnd)` por `parseDateString(customEnd)`. Se `parseDateString` devolver uma data inválida (string malformada), mantenha o comportamento de hoje. Basta deixar o fluxo seguir: o `filter` já trata `isNaN`. Não acrescente validação nova.

**Verificar**: `node --check shared/analytics.js` → exit 0.

### Passo 4: chave de dia local em `computeStudyMetrics`

Na linha 108, troque `d.toISOString().slice(0, 10)` por `formatLocalDate(d)`.

### Passo 5: `calculateStreak` com dias locais

- `todayKey = formatLocalDate(today)`, `yesterdayKey = formatLocalDate(today)` (depois do `setDate(-1)`, como hoje), e `key = formatLocalDate(checkDate)` no laço.
- No cálculo do recorde, `new Date(sortedDateKeys[i - 1] + 'T00:00:00')` e `new Date(sortedDateKeys[i] + 'T00:00:00')`. Mantenha o `Math.round`, que absorve a hora a mais ou a menos de horário de verão.

**Verificar**: `grep -n "toISOString().slice(0, 10)" shared/analytics.js` → nenhum resultado.

### Passo 6: suíte completa em dois fusos

**Verificar**:
- `node --test tests/timezone.test.js` → `ℹ fail 0`
- `TZ=UTC npm test` → `ℹ fail 0`
- `TZ=America/Sao_Paulo npm test` → `ℹ fail 0`

## Plano de testes

Em `tests/timezone.test.js`, com `process.env.TZ = 'America/Sao_Paulo'` no topo. Use `const L = (...a) => new Date(...a).toISOString();` e atividades no formato `{ Id, Inicio: L(2025, 2, 10, 22, 30), Duracao: 3600000, Materia: { Id: 1, Nome: 'X' } }`.

1. **Chave diária local** (regressão): uma atividade em `L(2025,2,10,22,30)` → `computeStudyMetrics([...]).dailyHistory[0].date === '2025-03-10'`.
2. **Dias ativos**: duas atividades no mesmo dia local, `L(2025,2,10,10,0)` e `L(2025,2,10,22,30)` → `distinctDaysCount === 1` (antes da correção dá 2).
3. **Concordância com o heatmap**: com a atividade do caso 1, o dia `'2025-03-10'` de `computeActivityHeatmap(acts, 2025)` (procure em `weeks[].days[]` por `date`) tem `sessionsCount === 1`, e esse mesmo dia aparece em `dailyHistory`.
4. **Sequência atual** (vale depois da correção, a qualquer hora em que o teste rode): com `hoje = new Date()`, uma atividade em `L(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 8, 0)` e outra no dia anterior às 22:00 → `streak.current === 2`.
5. **`parseDateString` local**: `parseDateString('2025-03-10')` tem `getFullYear() === 2025`, `getMonth() === 2` e `getDate() === 10`. Continua valendo: `isNaN(parseDateString('not-a-date').getTime())` e `parseDateString('10/03/2025').getDate() === 10`.
6. **Intervalo personalizado**: atividades em `L(2025,2,9,10,0)` e `L(2025,2,15,10,0)`; `filterActivitiesByPeriod(acts, 'custom', '2025-03-10', '2025-03-15')` retorna só a de 15/03.
7. **Recorde**: atividades às 22:30 locais em 10, 11 e 12/03, mais uma em 20/03 → `streak.longest === 3`.

## Critérios de conclusão

- [ ] `TZ=UTC npm test` e `TZ=America/Sao_Paulo npm test` saem com 0, ambos com `ℹ fail 0`.
- [ ] `tests/timezone.test.js` existe, com pelo menos 8 testes (sanidade + 7).
- [ ] `grep -n "toISOString().slice(0, 10)" shared/analytics.js` → nenhum resultado.
- [ ] `git status --porcelain` lista só `shared/analytics.js`, `tests/timezone.test.js` e `plans/README.md`.
- [ ] Linha do plano 004 atualizada em `plans/README.md`.

## Condições de PARADA

- Algum dos 89 testes existentes passa a falhar em `TZ=UTC` ou `TZ=America/Sao_Paulo`. Não ajuste testes existentes; reporte qual falhou e por quê.
- O teste de sanidade falha (o offset não é 180). Isso significa que o Node não aplicou o `TZ` em tempo de execução. Reporte e sugira rodar o arquivo com `TZ=America/Sao_Paulo node --test ...` no script de teste. Não mude `package.json` por conta própria.
- `formatLocalDate` não existe mais ou tem outra assinatura.
- Você descobre outro uso de dia UTC fora das funções do escopo. Reporte; não corrija.

## Notas de manutenção

- Regra: todo agrupamento por dia no motor usa `formatLocalDate`. O revisor deve rejeitar novos `toISOString().slice(0, 10)` em `shared/analytics.js`.
- Os usuários vão notar mudanças: "dias ativos" pode diminuir e a sequência atual pode mudar. Vale uma linha no changelog ou nas notas da versão.
- Hipótese não verificada: o formato real de `Inicio` na API do AprovadoApp. O fixture usa ISO com `Z`. Se a API devolver hora local sem `Z`, ou `/Date(…)/` no formato ASP.NET, `new Date(atv.Inicio)` se comporta de outro jeito. Vale conferir com um snapshot real (o "Backup JSON" do próprio usuário) antes de lançar.

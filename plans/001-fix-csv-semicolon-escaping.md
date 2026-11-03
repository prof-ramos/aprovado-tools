# Plano 001: Exportações CSV passam a colocar entre aspas os campos que contêm o delimitador `;`

> **Instruções para o executor**: siga este plano passo a passo. Rode cada
> comando de verificação e confirme o resultado esperado antes de passar ao
> próximo passo. Se qualquer item da seção "Condições de PARADA" ocorrer,
> pare e reporte, sem improvisar. Ao terminar, atualize a linha deste plano
> em `plans/README.md`, a menos que um revisor tenha te despachado e dito que
> ele mantém o índice.
>
> **Checagem de drift (rode primeiro)**: `git diff --stat bcf0ec0..HEAD -- shared/export.js tests/export.test.js`
> Se algum arquivo do escopo mudou desde que este plano foi escrito, compare
> os trechos de "Estado atual" com o código vivo antes de prosseguir. Uma
> divergência é condição de PARADA.

## Status

- **Prioridade**: P1
- **Esforço**: S
- **Risco**: BAIXO
- **Depende de**: nenhum
- **Categoria**: bug
- **Planejado em**: commit `bcf0ec0`, 2026-11-03

## Por que isso importa

Este repositório é uma extensão Chrome (Manifest V3, JavaScript puro com ES modules, sem etapa de build) que exporta o histórico de estudos do AprovadoApp para CSV. O CSV usa `;` como separador de colunas, que é o padrão do Excel brasileiro. Só que a função de escape coloca o campo entre aspas apenas quando ele contém `,`, `"`, `\n` ou `\r`.

Qualquer texto livre com `;` sai sem aspas. Isso é muito comum na coluna "Anotações", por exemplo `Lei 8.112; art. 5º`. O Excel divide o campo em colunas extras e desloca todas as colunas seguintes da linha. A exportação é a funcionalidade principal do produto, então isso corrompe dados do usuário em silêncio. Depois deste plano, campos com `;` saem entre aspas, e os geradores de CSV passam a ter testes unitários pela primeira vez.

## Estado atual

- `shared/export.js`: utilitários de exportação usados pelo popup, painel lateral e dashboard. Hoje não há nenhum teste para ele.

`shared/export.js:19-26` (o bug: `;` não é verificado):
```js
function escapeCsvField(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
```

`shared/export.js:48-74` (CSV de atividades: junta com `;` e baixa via DOM):
```js
    const rows = activities.map(atv => {
      ...
      return [
        atv.Id || '',
        ...
        atv.Anotacoes || ''
      ].map(escapeCsvField).join(';');
    });

    const csvContent = '﻿' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    triggerBrowserDownload(blob, filename);
  },
```

`shared/export.js:80-107`: `exportSubjectsSummaryCSV(subjects, filename)` tem a mesma estrutura. Monta `headers` e `rows` (passando por `escapeCsvField` e `.join(';')`), faz `csvContent = '﻿' + ...join('\r\n')` e chama `triggerBrowserDownload`.

`triggerBrowserDownload` (`shared/export.js:6-17`) usa `document` e `URL.createObjectURL`, então os exportadores não rodam no Node. É preciso separar a montagem da string para conseguir testá-la.

**Convenções do repositório:**
- ES modules, indentação de 2 espaços, aspas simples, ponto e vírgula. Comentários e textos de UI em português; identificadores em inglês.
- Testes usam o runner nativo do Node (`node:test` + `node:assert/strict`), um arquivo por área em `tests/`. Exemplo de estrutura, `tests/heatmap.test.js`:
  ```js
  import { describe, it } from 'node:test';
  import assert from 'node:assert/strict';
  import { computeActivityHeatmap } from '../shared/analytics.js';

  describe('Activity Heatmap Engine Test Suite', () => {
    describe('Tier 1: ...', () => {
      it('generates ...', () => { ... });
  ```

## Comandos que você vai precisar

| Propósito | Comando | Esperado em caso de sucesso |
|---|---|---|
| Testes (todos) | `npm test` | `ℹ fail 0`; hoje `ℹ tests 89` |
| Testes (só este arquivo) | `node --test tests/export.test.js` | `ℹ fail 0` |
| Checagem de sintaxe | `node --check shared/export.js` | exit 0, sem saída |

Não há linter, typechecker nem passo de instalação. `npm test` roda `node --test tests/**/*.test.js`.

## Escopo

**Dentro do escopo** (os únicos arquivos que você deve modificar):
- `shared/export.js`
- `tests/export.test.js` (criar)

**Fora do escopo** (NÃO mexa):
- `popup/popup.js`, `sidepanel/sidepanel.js` e `dashboard/dashboard.js`. Eles chamam `AprovadoExport.exportActivitiesCSV(...)` e `exportSubjectsSummaryCSV(...)`, e essas assinaturas devem continuar iguais.
- A linha `versao_extensao: '1.0.0'` em `exportFullBackupJSON`. O plano 005 cuida dela.
- A formatação numérica (`toFixed` gera `1.50` com ponto, e o Excel pt-BR espera vírgula). É um problema separado e conhecido; veja as Notas de manutenção.

## Fluxo git

- Branch: `advisor/001-csv-semicolon-escaping` a partir do HEAD atual.
- Conventional commits, como no `git log` (ex.: `fix(dashboard): restrict synthetic mock fixture strictly to explicit mock mode`). Sugestão: `fix(export): quote CSV fields containing the ; delimiter`.
- NÃO faça push nem abra PR, a menos que o operador tenha pedido.

## Passos

### Passo 1: escreva primeiro o teste que falha

Crie `tests/export.test.js` importando `{ escapeCsvField, buildActivitiesCSV, buildSubjectsSummaryCSV }` de `../shared/export.js`. Essas exportações ainda não existem, então o import falha. É o esperado.

**Verificar**: `node --test tests/export.test.js` → falha (SyntaxError / "does not provide an export named").

### Passo 2: corrija e exporte `escapeCsvField`

Em `shared/export.js`, faça a condição também colocar aspas quando houver `;`, e adicione `export` antes de `function escapeCsvField`.

Forma alvo:
```js
export function escapeCsvField(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/[;,"\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
```

**Verificar**: `node --check shared/export.js` → exit 0.

### Passo 3: extraia geradores puros de CSV

Crie duas funções exportadas que retornam a string CSV completa, já com o BOM `﻿` no início, e faça os métodos atuais chamá-las. Mova o código existente de `headers`/`rows` para dentro dos geradores sem alterá-lo; só a parte de download fica nos métodos antigos:

```js
export function buildActivitiesCSV(activities) {
  const headers = [ /* lista inalterada */ ];
  const rows = activities.map(atv => { /* corpo inalterado */ });
  return '﻿' + [headers.join(';'), ...rows].join('\r\n');
}

export function buildSubjectsSummaryCSV(subjects) { /* mesma ideia */ }
```
e dentro de `AprovadoExport`:
```js
  exportActivitiesCSV(activities, filename = 'aprovado_atividades.csv') {
    const blob = new Blob([buildActivitiesCSV(activities)], { type: 'text/csv;charset=utf-8;' });
    triggerBrowserDownload(blob, filename);
  },
```
Faça o mesmo em `exportSubjectsSummaryCSV`. O texto dos cabeçalhos, a ordem das colunas e a formatação dos valores devem ficar idênticos aos de hoje, byte a byte.

**Verificar**: `node --check shared/export.js` → exit 0; `npm test` → `ℹ fail 0`, ainda 89 testes (o arquivo novo ainda não foi preenchido).

### Passo 4: escreva os testes

Preencha `tests/export.test.js` com os casos do Plano de testes.

**Verificar**: `node --test tests/export.test.js` → `ℹ fail 0`, com pelo menos 7 testes.

### Passo 5: prove que o teste pega o bug

Tire temporariamente o `;` da regex em `escapeCsvField`, rode `node --test tests/export.test.js` e confirme que pelo menos um teste falha. Depois restaure a regex.

**Verificar**: após restaurar, `node --test tests/export.test.js` → `ℹ fail 0`; `git diff shared/export.js | grep -c '\[;,"'` → `1`.

## Plano de testes

Em `tests/export.test.js`, com a estrutura de `tests/heatmap.test.js`:

1. `escapeCsvField('a;b')` → `'"a;b"'` (a regressão).
2. `escapeCsvField('diz "oi"')` → `'"diz ""oi"""'`.
3. `escapeCsvField('linha1\nlinha2')` sai entre aspas.
4. `escapeCsvField(null)` e `escapeCsvField(undefined)` → `''`; `escapeCsvField(0)` → `'0'`.
5. `buildActivitiesCSV([...])` com uma atividade cujo `Anotacoes` é `'Lei 8.112; art. 5º'`: a saída começa com `'﻿'`. Divida em `'\r\n'` e confira que há 2 linhas. Analise a linha 2 com um pequeno separador que respeite aspas, escrito no próprio teste (divide em `;` fora de aspas duplas), e confira que dá exatamente 12 campos (o mesmo número do cabeçalho) e que o último é `Lei 8.112; art. 5º`.
6. `buildActivitiesCSV([])` → BOM mais a linha de cabeçalho, sem `\r\n` no final.
7. `buildSubjectsSummaryCSV([{ name: 'Penal; Geral', formattedDuration: '1h 0m', durationMs: 3600000, sessionsCount: 1, percentage: 100, questions: 10, correct: 8, accuracy: 80, contents: [] }])`: a linha 2 tem 9 campos, e o primeiro é `Penal; Geral`.

Objeto mínimo de atividade para o caso 5:
```js
{ Id: 1, DataInicio: '10/03/2025', HoraInicio: '22:30', Duracao: 3600000,
  Materia: { Id: 1, Nome: 'Direito Penal' }, Conteudo: { Id: 2, Nome: 'Crimes' },
  TipoEstudo: 'Teoria', ExercicioQuantidade: 0, ExercicioAcerto: 0,
  Anotacoes: 'Lei 8.112; art. 5º' }
```

## Critérios de conclusão

- [ ] `npm test` sai com 0, `ℹ fail 0` e pelo menos 96 testes (89 + 7 ou mais).
- [ ] `grep -n "export function escapeCsvField\|export function buildActivitiesCSV\|export function buildSubjectsSummaryCSV" shared/export.js` → 3 resultados.
- [ ] `git status --porcelain` lista apenas `shared/export.js` e `tests/export.test.js` (mais `plans/README.md`).
- [ ] Linha do plano 001 atualizada em `plans/README.md`.

## Condições de PARADA

- O corpo de `escapeCsvField` ou as chamadas `.join(';')` não batem com os trechos acima.
- Manter os chamadores funcionando exigiria mudar a assinatura de `AprovadoExport.exportActivitiesCSV` ou `exportSubjectsSummaryCSV`.
- Importar `shared/export.js` no Node lança erro por causa de APIs de navegador no topo do módulo. Não deveria, porque `document` só é usado dentro de funções. Se acontecer, reporte em vez de criar globais falsos.

## Notas de manutenção

- Toda coluna nova de CSV tem que passar por `escapeCsvField`. O revisor deve rejeitar novos `.join(';')` com valores sem escape.
- Ficaram para depois: (a) vírgula decimal pt-BR para o Excel; (b) injeção de fórmula em planilha (valores começando com `=`, `+`, `-`, `@`). Os dados são as próprias anotações do usuário, então o risco é baixo. Se as exportações passarem a ser compartilhadas, prefixe esses valores com `'`.
- O plano 005 edita o mesmo arquivo (a linha `versao_extensao`). Aplique este plano antes.

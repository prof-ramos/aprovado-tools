# Plano 003: Todo dado vindo da API é escapado antes de entrar em `innerHTML` (dashboard e painel lateral)

> **Instruções para o executor**: siga este plano passo a passo. Rode cada
> comando de verificação e confirme o resultado esperado antes de passar ao
> próximo passo. Se qualquer item da seção "Condições de PARADA" ocorrer,
> pare e reporte, sem improvisar. Ao terminar, atualize a linha deste plano
> em `plans/README.md`, a menos que um revisor tenha te despachado e dito que
> ele mantém o índice.
>
> **Checagem de drift (rode primeiro)**: `git diff --stat bcf0ec0..HEAD -- shared/html.js dashboard/dashboard.js sidepanel/sidepanel.js tests/html.test.js`
> Se algum arquivo do escopo mudou desde que este plano foi escrito, compare
> os trechos de "Estado atual" com o código vivo antes de prosseguir. Uma
> divergência é condição de PARADA.

## Status

- **Prioridade**: P1
- **Esforço**: S–M
- **Risco**: BAIXO
- **Depende de**: nenhum
- **Categoria**: security / bug
- **Planejado em**: commit `bcf0ec0`, 2026-11-03

## Por que isso importa

Este repositório é uma extensão Chrome (Manifest V3, JavaScript puro, sem build) que renderiza dados da API do AprovadoApp: nomes de matérias, conteúdos, cores e anotações livres do usuário. A aba "Padrões Históricos" do dashboard já escapa tudo com `escapeHtml`. A aba "Visão Geral" do dashboard e o painel lateral, não: interpolam os valores crus em template strings atribuídas a `innerHTML`.

Uma anotação comum como `a < b` ou `art. "5º"` já quebra a tabela de atividades (o atributo `title="..."` é fechado antes da hora), e qualquer marcação HTML/CSS no texto é renderizada. A CSP padrão do MV3 bloqueia execução de script inline, então o impacto é renderização corrompida e injeção de marcação, não execução de código. Mesmo assim, é a mesma classe de bug que o próprio código já resolve na outra aba.

Depois deste plano, existe um único módulo `shared/html.js` com `escapeHtml` e `safeColor`, usado em todos os pontos listados. Isso também é pré-requisito do plano 006 (abrir um backup JSON vindo de arquivo, que é dado ainda menos confiável).

## Estado atual

Arquivos:
- `dashboard/dashboard.js`: dashboard de página inteira. Define um `escapeHtml` local nas linhas 1324-1332 e já o usa em 16 lugares da aba de padrões.
- `sidepanel/sidepanel.js`: painel lateral. Não escapa nada.
- `popup/popup.js`: usa só `textContent`. **Está correto; não mexa.**

O `escapeHtml` existente (`dashboard/dashboard.js:1324-1332`), que deve ser movido sem mudar o comportamento:
```js
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

**Pontos sem escape que este plano corrige** (confira cada um antes de editar):

| # | Local | Valores crus da API |
|---|---|---|
| A | `dashboard/dashboard.js:304-310` (`renderCicloCard`) | `name` (`m.Nome` / `m.Materia?.Nome`), `hrs` (`m.HorasExecutadasTexto`) |
| B | `dashboard/dashboard.js:332-344` (`renderSubjectsSummary`) | `s.color` em `style`, `s.name` |
| C | `dashboard/dashboard.js:355-358` (`renderModalitiesAndShifts`) | `t.name` (vem de `TipoEstudo`) |
| D | `dashboard/dashboard.js:396-409` (`renderActivitiesTable`) | `a.DataInicio`, `a.HoraInicio`, `a.Materia?.Cor` em `style`, `a.Materia?.Nome`, `a.Conteudo?.Nome`, `a.TipoEstudo`, `durText` (pode vir de `a.DuracaoTexto`), `a.Anotacoes` (no atributo `title` **e** no corpo) |
| E | `dashboard/dashboard.js:1097` + `:1103-1104` (tooltip do quadrante) | `name = dot.getAttribute('data-name')`. `getAttribute` decodifica as entidades, então o valor volta cru para `tooltip.innerHTML` |
| F | `dashboard/dashboard.js:1074` (círculo SVG) e `:1199` (`renderSubjectPills`) | `s.color` em `fill="..."` / `style` |
| G | `sidepanel/sidepanel.js:132-134` | `mName`, `mHrs` |
| H | `sidepanel/sidepanel.js:151-158` | `subName`, `contName`, `dateText` (`r.DataAgendamento`) |
| I | `sidepanel/sidepanel.js:174-185` | `s.color` (duas vezes, em `style`), `s.name` |

Trecho representativo, D (`dashboard/dashboard.js:396-409`):
```js
      tr.innerHTML = `
        <td>${a.DataInicio || '—'}</td>
        <td style="color: var(--text-muted);">${a.HoraInicio || '—'}</td>
        <td>
          <div class="subject-cell">
            <span class="subject-dot" style="background-color: ${a.Materia?.Cor || '#3b82f6'};"></span>
            <span>${a.Materia?.Nome || '—'}</span>
          </div>
        </td>
        <td>${a.Conteudo?.Nome || '<span style="color: var(--text-faint);">Geral</span>'}</td>
        <td><span class="badge-tag">${a.TipoEstudo || 'Manual'}</span></td>
        <td><strong>${durText}</strong></td>
        <td>${questionsText}</td>
        <td style="max-width: 220px; ...; color: var(--text-muted);" title="${a.Anotacoes || ''}">${a.Anotacoes || '—'}</td>
      `;
```
Atenção à linha de `a.Conteudo?.Nome`: o fallback é **HTML intencional**. Escape só o valor, por exemplo `${a.Conteudo?.Nome ? escapeHtml(a.Conteudo.Nome) : '<span style="color: var(--text-faint);">Geral</span>'}`.

Valores calculados localmente, como `percentage.toFixed(...)`, `formattedHours`, `formattedDuration`, `questionsText` e `accBadge`, são números ou strings montadas pelo próprio código. Não precisam de escape, mas escapar também não faz mal.

**Convenções:** ES modules importados com caminho relativo e extensão, como em `dashboard/dashboard.js:1-10`:
```js
import { AprovadoApi } from '../shared/api.js';
import { AprovadoExport } from '../shared/export.js';
```
Os scripts são carregados com `<script type="module">` (`dashboard/dashboard.html:507`, `sidepanel/sidepanel.html:144`), então `import` funciona sem build. Testes: `node:test` + `node:assert/strict`, como em `tests/heatmap.test.js`.

## Comandos que você vai precisar

| Propósito | Comando | Esperado em caso de sucesso |
|---|---|---|
| Testes (todos) | `npm test` | `ℹ fail 0` |
| Testes (este arquivo) | `node --test tests/html.test.js` | `ℹ fail 0` |
| Sintaxe | `node --check shared/html.js && node --check dashboard/dashboard.js && node --check sidepanel/sidepanel.js` | exit 0 |

## Escopo

**Dentro do escopo:**
- `shared/html.js` (criar)
- `tests/html.test.js` (criar)
- `dashboard/dashboard.js` (só os pontos A–F, mais trocar o `escapeHtml` local pelo import)
- `sidepanel/sidepanel.js` (só os pontos G–I)

**Fora do escopo:**
- `popup/popup.js`: já usa `textContent`.
- `content.js`: o `innerHTML` dele é SVG estático, sem dados.
- Refatorar o render para `createElement`/`textContent`. É uma opção válida, mas muda muito código; aqui só escapamos.
- Adicionar `content_security_policy` ao `manifest.json`. A padrão do MV3 já basta.
- Qualquer mudança visual, de classe CSS ou de estrutura do HTML.

## Fluxo git

- Branch: `advisor/003-escape-api-data-in-html`.
- Conventional commits. Sugestão: `fix(ui): escape API data before innerHTML in dashboard and sidepanel`.
- NÃO faça push nem abra PR sem instrução.

## Passos

### Passo 1: crie `shared/html.js`

```js
/**
 * Utilitários para inserir dados externos em HTML com segurança.
 */

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Aceita só cores hexadecimais (#rgb, #rgba, #rrggbb, #rrggbbaa); qualquer outra coisa vira o fallback.
 * Evita injeção de CSS em atributos style/fill.
 */
export function safeColor(value, fallback = '#3b82f6') {
  return typeof value === 'string' && /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value.trim())
    ? value.trim()
    : fallback;
}
```

**Verificar**: `node --check shared/html.js` → exit 0.

### Passo 2: testes do módulo

Crie `tests/html.test.js` com os casos do Plano de testes.

**Verificar**: `node --test tests/html.test.js` → `ℹ fail 0`.

### Passo 3: dashboard, troque o `escapeHtml` local pelo import

Em `dashboard/dashboard.js`, acrescente `import { escapeHtml, safeColor } from '../shared/html.js';` junto aos outros imports do topo, e apague a função local `escapeHtml` (linhas 1324-1332). As 16 chamadas existentes continuam funcionando.

**Verificar**: `grep -c "^function escapeHtml" dashboard/dashboard.js` → `0`; `node --check dashboard/dashboard.js` → exit 0.

### Passo 4: dashboard, pontos A–F

Envolva cada valor da tabela acima com `escapeHtml(...)`, e cada cor com `safeColor(...)`. Em `safeColor`, passe o valor bruto: `safeColor(a.Materia?.Cor)`, e não `a.Materia?.Cor || '#3b82f6'`, porque o fallback já é o padrão. No ponto E, troque `${name}` por `${escapeHtml(name)}` dentro do `tooltip.innerHTML`.

**Verificar**: `node --check dashboard/dashboard.js` → exit 0. Depois rode:
`grep -nE '\$\{(a\.Anotacoes|a\.Materia\?\.Nome|a\.TipoEstudo|s\.name|t\.name|name|mName|subName|contName|s\.color|a\.Materia\?\.Cor)' dashboard/dashboard.js` → nenhum resultado. Todos devem estar dentro de `escapeHtml(` ou `safeColor(`.

### Passo 5: painel lateral, pontos G–I

Em `sidepanel/sidepanel.js`, acrescente `import { escapeHtml, safeColor } from '../shared/html.js';` e aplique o mesmo tratamento.

**Verificar**: `node --check sidepanel/sidepanel.js` → exit 0; `grep -nE '\$\{(mName|mHrs|subName|contName|dateText|s\.name|s\.color)\}' sidepanel/sidepanel.js` → nenhum resultado.

### Passo 6: suíte completa

**Verificar**: `npm test` → `ℹ fail 0`.

### Passo 7 (manual, se houver navegador disponível; senão, registre "não verificado manualmente" no relatório)

Carregue a extensão sem compactação em `chrome://extensions` e abra `dashboard/dashboard.html?mock=true`. A aba Visão Geral deve renderizar igual a antes: tabela de matérias, modalidades, tabela de atividades com anotações e bolinhas coloridas. Ver também `DEVELOPER.md §1.5`.

## Plano de testes

Em `tests/html.test.js`:
1. `escapeHtml('<b>"x" & \'y\'</b>')` → `'&lt;b&gt;&quot;x&quot; &amp; &#039;y&#039;&lt;/b&gt;'`.
2. `escapeHtml(null)` → `''`; `escapeHtml(undefined)` → `''`; `escapeHtml(42)` → `'42'`.
3. `safeColor('#3b82f6')` → `'#3b82f6'`; `safeColor('#FFF')` → `'#FFF'`; `safeColor(' #abcdef ')` → `'#abcdef'`.
4. `safeColor('red; background:url(x)')` → `'#3b82f6'`; `safeColor('#12345')` → `'#3b82f6'`; `safeColor(undefined)` → `'#3b82f6'`; `safeColor('', '#000')` → `'#000'`.

Não há testes de DOM no repositório (nem jsdom). A cobertura do render fica com os greps dos Critérios de conclusão e com a checagem manual do Passo 7.

## Critérios de conclusão

- [ ] `npm test` sai com 0, `ℹ fail 0`, com os testes novos de `tests/html.test.js`.
- [ ] `grep -c "^function escapeHtml" dashboard/dashboard.js` → `0`.
- [ ] `grep -l "from '../shared/html.js'" dashboard/dashboard.js sidepanel/sidepanel.js` → os dois arquivos.
- [ ] Os greps dos Passos 4 e 5 não retornam nada.
- [ ] `git status --porcelain` lista só `shared/html.js`, `tests/html.test.js`, `dashboard/dashboard.js`, `sidepanel/sidepanel.js` e `plans/README.md`.
- [ ] Linha do plano 003 atualizada em `plans/README.md`.

## Condições de PARADA

- Os números de linha ou trechos da tabela de pontos A–I não batem com o código (drift).
- Você encontra outro ponto de `innerHTML` com dado da API que não está na tabela. Corrija-o do mesmo jeito **só** se estiver em `dashboard.js` ou `sidepanel.js`, e liste-o no relatório. Se estiver em outro arquivo, pare e reporte.
- `escapeHtml` deixa um texto visivelmente duplo-escapado (`&amp;lt;`) em algum lugar. Isso indica que o valor já vinha escapado; pare e reporte o ponto.

## Notas de manutenção

- Regra para o futuro: qualquer `${...}` com dado da API dentro de `innerHTML` passa por `escapeHtml`, e qualquer cor por `safeColor`. O revisor deve procurar template strings novas com `innerHTML`.
- `getAttribute` decodifica entidades (caso do ponto E). Ler de `data-*` e reinserir em `innerHTML` sempre exige escapar de novo.
- O plano 006 (abrir backup JSON) depende deste plano, porque dados de arquivo são ainda menos confiáveis.

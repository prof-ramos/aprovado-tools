# Plano 005: A versão da extensão vem de uma única fonte (`manifest.json`)

> **Instruções para o executor**: siga este plano passo a passo. Rode cada
> comando de verificação e confirme o resultado esperado antes de passar ao
> próximo passo. Se qualquer item da seção "Condições de PARADA" ocorrer,
> pare e reporte, sem improvisar. Ao terminar, atualize a linha deste plano
> em `plans/README.md`, a menos que um revisor tenha te despachado e dito que
> ele mantém o índice.
>
> **Checagem de drift (rode primeiro)**: `git diff --stat bcf0ec0..HEAD -- manifest.json package.json shared/export.js tests/version.test.js`
> Se algum arquivo do escopo mudou desde que este plano foi escrito, compare
> os trechos de "Estado atual" com o código vivo antes de prosseguir. Uma
> divergência é condição de PARADA. Exceção: se o plano 001 já foi aplicado,
> `shared/export.js` terá mudado nas funções de CSV, o que é esperado. Só a
> linha `versao_extensao` precisa bater.

## Status

- **Prioridade**: P3
- **Esforço**: S
- **Risco**: BAIXO
- **Depende de**: `plans/001-fix-csv-semicolon-escaping.md` (edita o mesmo arquivo; aplicar depois evita conflito)
- **Categoria**: dx
- **Planejado em**: commit `bcf0ec0`, 2026-11-03

## Por que isso importa

Esta extensão Chrome (Manifest V3, sem build) tem o número de versão `1.0.0` escrito à mão em quatro lugares. Na próxima versão, quem atualizar o `manifest.json` vai esquecer algum deles. O resultado: o ZIP enviado à Chrome Web Store com o nome errado, ou backups JSON gravando uma versão que não é a real, o que atrapalha diagnosticar problemas de compatibilidade de backup no futuro. Depois deste plano, `manifest.json` é a fonte da verdade e um teste falha se `package.json` divergir.

## Estado atual

- `manifest.json:4`: `"version": "1.0.0",`. É a **fonte da verdade**, porque é o que o Chrome lê.
- `package.json:3`: `"version": "1.0.0",`
- `package.json:8`, script `build:zip`, com a versão no nome do arquivo:
  ```json
  "build:zip": "mkdir -p dist && rm -f dist/*.zip && zip -r -FS dist/aprovado-tools-v1.0.0.zip manifest.json background.js content.js content.css icons popup sidepanel dashboard shared"
  ```
- `shared/export.js:118`, dentro de `exportFullBackupJSON`:
  ```js
      versao_extensao: '1.0.0',
  ```
  Esse código roda em páginas da extensão (popup, painel lateral, dashboard), onde `chrome.runtime.getManifest()` está disponível. O dashboard também roda em modo mock (`?mock=true`), às vezes fora da extensão, onde `chrome` pode não existir; veja `dashboard/dashboard.js:99-100`, que testa `window.chrome?.storage?.local`.

`package.json` tem `"type": "module"`. Mesmo assim, `node -p "..."` avalia o código como CommonJS, então `require('./manifest.json')` funciona dentro de `node -p`.

**Convenções:** testes com `node:test` + `node:assert/strict`, lendo arquivos com `fs` e `path` como em `tests/heatmap.test.js`:
```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
```

## Comandos que você vai precisar

| Propósito | Comando | Esperado em caso de sucesso |
|---|---|---|
| Testes | `npm test` | `ℹ fail 0` |
| Build do ZIP | `npm run build:zip` | cria `dist/aprovado-tools-v1.0.0.zip` (`dist/` está no `.gitignore`) |
| Conferir ZIP | `ls dist/*.zip` | `dist/aprovado-tools-v1.0.0.zip` |

O `build:zip` precisa do binário `zip` (presente no macOS). Se não existir no seu ambiente, veja as Condições de PARADA.

## Escopo

**Dentro do escopo:**
- `package.json` (só o script `build:zip`)
- `shared/export.js` (só a linha `versao_extensao`)
- `tests/version.test.js` (criar)

**Fora do escopo:**
- `manifest.json`: não mude a versão.
- O campo `"version"` do `package.json`: fica, porque o npm exige. O teste novo garante que ele bate com o manifest.
- Os `README.md`/`DEVELOPER.md` que citam `v1.0.0` em texto. É documentação; deixe.
- Introduzir uma ferramenta de build ou script `.js` novo em `scripts/`.

## Fluxo git

- Branch: `advisor/005-single-source-version`.
- Conventional commits. Sugestão: `chore(build): derive version from manifest.json`.
- NÃO faça push nem abra PR sem instrução.

## Passos

### Passo 1: teste de consistência

Crie `tests/version.test.js`, que lê `manifest.json` e `package.json` da raiz (`path.join(__dirname, '..', 'manifest.json')`) e verifica:
1. `pkg.version === manifest.version`;
2. `pkg.scripts['build:zip']` **não** contém `manifest.version` escrito literalmente. Por exemplo, `assert.ok(!pkg.scripts['build:zip'].includes('v' + manifest.version))`.

**Verificar**: `node --test tests/version.test.js` → o caso 1 passa e o caso 2 falha.

### Passo 2: nome do ZIP derivado do manifest

No `package.json`, troque `dist/aprovado-tools-v1.0.0.zip` por `dist/aprovado-tools-v$(node -p \"require('./manifest.json').version\").zip`. Dentro do JSON, as aspas internas são escapadas com `\"`. Não mude mais nada no script.

**Verificar**: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"` → exit 0; `npm run build:zip` → exit 0; `ls dist/*.zip` → `dist/aprovado-tools-v1.0.0.zip`; `node --test tests/version.test.js` → `ℹ fail 0`.

### Passo 3: versão do backup lida em tempo de execução

Em `shared/export.js`, troque `versao_extensao: '1.0.0',` por:
```js
      versao_extensao: globalThis.chrome?.runtime?.getManifest?.()?.version ?? 'desconhecida',
```

**Verificar**: `node --check shared/export.js` → exit 0; `grep -n "'1.0.0'" shared/export.js` → nenhum resultado.

### Passo 4: suíte completa

**Verificar**: `npm test` → `ℹ fail 0`.

## Plano de testes

- `tests/version.test.js`: os 2 casos do Passo 1.
- Não há teste automatizado para `exportFullBackupJSON`, porque ele depende de DOM para o download. A cobertura fica com o grep do Passo 3. Se o plano 001 já tiver extraído geradores puros de CSV, **não** extraia um para o JSON aqui; isso é escopo do plano 006.

## Critérios de conclusão

- [ ] `npm test` sai com 0, `ℹ fail 0`, e `tests/version.test.js` tem 2 testes passando.
- [ ] `grep -n "1\.0\.0" package.json` → só a linha `"version": "1.0.0",`.
- [ ] `grep -n "'1.0.0'" shared/export.js` → nenhum resultado.
- [ ] `npm run build:zip` gera `dist/aprovado-tools-v1.0.0.zip`.
- [ ] `git status --porcelain` lista só `package.json`, `shared/export.js`, `tests/version.test.js` e `plans/README.md` (`dist/` é ignorado).
- [ ] Linha do plano 005 atualizada em `plans/README.md`.

## Condições de PARADA

- O binário `zip` não existe no ambiente. Faça os Passos 1, 3 e 4, aplique a edição do Passo 2 sem rodar o build, e reporte "build:zip não verificado".
- A linha `versao_extensao` não existe ou já foi alterada.
- `manifest.json` e `package.json` já divergem na versão. Não escolha uma; reporte.

## Notas de manutenção

- Para lançar uma versão: altere `manifest.json` **e** `package.json`; o teste avisa se esquecer o segundo.
- Backups gerados em modo mock fora da extensão gravam `versao_extensao: "desconhecida"`. É intencional.
- Se o projeto adotar um script de release no futuro, ele pode atualizar os dois campos de uma vez.

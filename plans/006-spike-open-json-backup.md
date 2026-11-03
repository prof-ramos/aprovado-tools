# Plano 006 (spike): Desenhar "abrir um backup JSON no dashboard" e entregar o conversor puro, com testes

> **Instruções para o executor**: este é um plano de **investigação + base
> técnica**, não de funcionalidade completa. Você vai (1) criar um módulo puro
> que converte um backup em snapshot, com testes, e (2) responder por escrito
> às perguntas da seção "Perguntas do spike", preenchendo a seção
> "Resultados do spike" no fim deste arquivo. **Não** ligue nada à interface.
> Rode cada verificação; se uma "Condição de PARADA" ocorrer, pare e reporte.
> Ao terminar, atualize a linha deste plano em `plans/README.md`, a menos que
> um revisor tenha te despachado e dito que ele mantém o índice.
>
> **Checagem de drift (rode primeiro)**: `git diff --stat c8b055e..HEAD -- shared/export.js dashboard/dashboard.js shared/backup.js tests/backup.test.js`
> Mudanças em `shared/export.js` e `dashboard/dashboard.js` vindas dos planos
> 001, 003 e 005 são esperadas. Confira só se `exportFullBackupJSON` ainda
> grava as chaves listadas em "Estado atual" e se `loadMockSnapshot` ainda
> existe. Se não, é condição de PARADA.

## Status

- **Prioridade**: P3
- **Esforço**: S (spike); a funcionalidade completa, depois, é M
- **Risco**: BAIXO (nenhuma mudança de comportamento visível)
- **Depende de**: `plans/003-escape-api-data-in-html.md`. Um backup aberto de arquivo é dado não confiável; a funcionalidade final só é segura depois que o render escapar tudo. O spike em si pode rodar antes, mas a funcionalidade não.
- **Categoria**: direction
- **Planejado em**: commit `bcf0ec0` (reconciliado com `c8b055e`), 2026-11-03

## Por que isso importa

Esta extensão Chrome (Manifest V3, JavaScript puro, sem build) exporta um "Backup JSON completo" do histórico de estudos do AprovadoApp, mas não tem nenhum jeito de **abrir** esse backup de volta. A exportação só funciona num sentido.

Abrir um backup no dashboard permitiria ver métricas offline ou com a sessão expirada, comparar um backup antigo com o estado atual, e confirmar que o backup está íntegro (o que ganha peso depois do bug de backups vazios corrigido no plano 002). A base já existe quase toda: o dashboard tem um carregador de snapshot a partir de JSON, usado no modo mock, e o formato do backup difere do snapshot interno só nos nomes de algumas chaves. O spike transforma essa diferença num conversor testado e responde às perguntas de desenho antes que alguém construa a interface.

## Estado atual

**Formato do backup**, gravado por `exportFullBackupJSON` (`shared/export.js:112-131`):
```js
    const payload = {
      gerado_em: new Date().toISOString(),
      versao_extensao: '1.0.0',          // o plano 005 troca por leitura do manifest
      origem: 'Aprovado Tools Chrome Extension',
      usuario: snapshot.user || null,
      materias: snapshot.materias || [],
      atividades: snapshot.atividades || [],
      ciclo: snapshot.ciclo || null,
      revisoes_pendentes: snapshot.revisoesPendentes || [],
      revisoes_concluidas: snapshot.revisoesConcluidas || []
    };
```

**Formato do snapshot interno**, consumido por toda a UI, montado em `shared/api.js:196-204`:
```js
    const snapshot = { user, materias, atividades, ciclo, revisoesPendentes, revisoesConcluidas, syncedAt: new Date().toISOString() };
```
O fixture `tests/fixtures/multiannual_mock_2016_2026.json` (1,7 MB, 3.008 atividades) já está **no formato de snapshot**, com as chaves `user`, `materias`, `atividades`, `ciclo`, `revisoesPendentes`, `revisoesConcluidas` e `syncedAt`.

**Carregador existente**, `dashboard/dashboard.js:84-93`, usado quando a URL tem `?mock=true`:
```js
async function loadMockSnapshot() {
  const mockUrl = window.chrome?.runtime?.getURL
    ? chrome.runtime.getURL('tests/fixtures/multiannual_mock_2016_2026.json')
    : '../tests/fixtures/multiannual_mock_2016_2026.json';
  const res = await fetch(mockUrl);
  ...
  return await res.json();
}
```
Depois de carregar, o `init` (`dashboard/dashboard.js:95-122`) chama `renderUserHeader(fullSnapshot.user)`, `populateFilterSelects(fullSnapshot)`, `updateDashboard()` e `renderHistoricalPatternsTab(fullSnapshot.atividades, fullSnapshot.materias)`. Qualquer snapshot válido alimenta a UI inteira.

**Menu de exportação**, onde um item "Abrir backup…" naturalmente entraria: `dashboard/dashboard.html:51` (`#export-menu`), com o item `#export-json-backup` na linha 64.

**Convenções:** módulos puros em `shared/` exportam funções nomeadas (ex.: `export function computeActivityHeatmap(...)` em `shared/analytics.js`). Mensagens de erro e comentários em português. Testes com `node:test` + `node:assert/strict`, lendo o fixture como em `tests/heatmap.test.js:16-20`:
```js
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'multiannual_mock_2016_2026.json');
const mockSnapshot = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
```

## Comandos que você vai precisar

| Propósito | Comando | Esperado em caso de sucesso |
|---|---|---|
| Testes (todos) | `npm test` | `ℹ fail 0` |
| Testes (este arquivo) | `node --test tests/backup.test.js` | `ℹ fail 0` |
| Sintaxe | `node --check shared/backup.js` | exit 0 |

## Escopo

**Dentro do escopo:**
- `shared/backup.js` (criar)
- `tests/backup.test.js` (criar)
- Este arquivo de plano: só a seção "Resultados do spike", no fim.

**Fora do escopo** (NÃO faça neste plano):
- Qualquer mudança em `dashboard/`, `popup/`, `sidepanel/`, `shared/export.js` ou `shared/api.js`.
- Gravar o backup importado em `chrome.storage.local`.
- Novas permissões no `manifest.json`.

## Fluxo git

- Branch: `advisor/006-spike-open-json-backup`.
- Conventional commits. Sugestão: `feat(backup): add pure backup-to-snapshot converter (spike)`.
- NÃO faça push nem abra PR sem instrução.

## Passos

### Passo 1: crie `shared/backup.js`

Exporte `snapshotFromBackup(payload)` com este contrato:

- Aceita **dois formatos**:
  - **backup**: tem `atividades` (array) e pelo menos uma das chaves `gerado_em`, `revisoes_pendentes` ou `usuario`;
  - **snapshot**: tem `atividades` (array) e `user` ou `revisoesPendentes` (o formato do fixture).
- Retorna sempre o formato de snapshot:
  ```js
  {
    user: payload.usuario ?? payload.user ?? null,
    materias: arr(payload.materias),
    atividades: arr(payload.atividades).filter(isPlainObject),
    ciclo: payload.ciclo ?? null,
    revisoesPendentes: arr(payload.revisoes_pendentes ?? payload.revisoesPendentes),
    revisoesConcluidas: arr(payload.revisoes_concluidas ?? payload.revisoesConcluidas),
    syncedAt: payload.gerado_em ?? payload.syncedAt ?? null,
    source: 'backup'
  }
  ```
  Aqui `arr(x)` devolve `x` se for array e `[]` caso contrário, e `isPlainObject(x)` é `x !== null && typeof x === 'object' && !Array.isArray(x)`.
- Lança `Error` com mensagem em português quando `payload` não é um objeto, ou quando `atividades` não existe ou não é array. Exemplo: `'Arquivo de backup inválido: lista de atividades ausente.'`
- Não muta o `payload` de entrada.

**Verificar**: `node --check shared/backup.js` → exit 0.

### Passo 2: testes

Crie `tests/backup.test.js` com os casos do Plano de testes.

**Verificar**: `node --test tests/backup.test.js` → `ℹ fail 0`; `npm test` → `ℹ fail 0`.

### Passo 3: meça

Rode e anote no relatório e na seção de resultados:
```bash
node -e "const fs=require('fs');const t0=performance.now();const j=JSON.parse(fs.readFileSync('tests/fixtures/multiannual_mock_2016_2026.json','utf8'));console.log('parse ms',(performance.now()-t0).toFixed(1),'atividades',j.atividades.length,'bytes',fs.statSync('tests/fixtures/multiannual_mock_2016_2026.json').size)"
```

**Verificar**: o comando imprime as três medidas.

### Passo 4: responda às perguntas do spike

Preencha a seção "Resultados do spike" abaixo, com uma resposta curta e justificada por pergunta. Onde não for possível responder sem dados reais, escreva "não verificado" e o que seria preciso.

## Perguntas do spike

1. **Onde fica na UI?** Recomendação inicial: um item "Abrir backup…" no `#export-menu` do dashboard, mais um banner fixo "Visualizando backup de <data> — Voltar aos dados ao vivo". Confirme ou proponha outra opção, olhando `dashboard/dashboard.html:40-80`.
2. **Ler o arquivo**: `<input type="file" accept="application/json,.json">` + `await file.text()` + `JSON.parse` funciona numa página de extensão sem permissão nova? (Resposta esperada: sim; confirme pela documentação do Chrome.)
3. **Persistência**: o backup importado deve ser gravado em `chrome.storage.local`? Recomendação: **não**. A visualização é somente leitura e não pode sobrescrever o cache ao vivo. Diga se encontrou motivo contrário.
4. **Tamanho**: com a medida do Passo 3, qual limite de tamanho de arquivo faz sentido (ex.: recusar acima de 50 MB)?
5. **Botão "Sincronizar agora"** em modo backup: deve voltar aos dados ao vivo, ou ficar desabilitado?
6. **Compatibilidade** com o formato do CLI `prof-ramos/aprovado` (citado no `README.md`): o formato dele é o mesmo? Provavelmente "não verificado" sem acesso ao repositório; diga o que precisaria ser checado.
7. **Lista de tarefas da funcionalidade completa**: arquivos a tocar, estimativa e testes, para virar o próximo plano.

## Plano de testes

Em `tests/backup.test.js`:
1. **Formato backup**: um payload como o de `exportFullBackupJSON`, com `revisoes_pendentes: [{ Id: 1 }]` e `gerado_em: '2026-01-01T00:00:00.000Z'` → `revisoesPendentes.length === 1`, `syncedAt === '2026-01-01T00:00:00.000Z'` e `source === 'backup'`.
2. **Formato snapshot**: o fixture `tests/fixtures/multiannual_mock_2016_2026.json` → `atividades.length === 3030` e `user.Id === 101`.
3. **Ida e volta**: monte um payload de backup a partir do fixture com o mesmo mapeamento de `exportFullBackupJSON` (escreva o objeto no teste) e converta. `atividades`, `materias` e `revisoesPendentes` devem ser `deepEqual` aos do fixture.
4. **Inválidos**: `snapshotFromBackup(null)`, `(42)`, `({})` e `({ atividades: 'x' })` → `assert.throws`, com mensagem contendo `'backup inválido'`.
5. **Itens não-objeto** em `atividades` (`[{ Id: 1 }, null, 'x', 3]`) → sobra só `[{ Id: 1 }]`.
6. **Não muta a entrada**: compare `JSON.stringify(payload)` antes e depois.

## Critérios de conclusão

- [ ] `npm test` sai com 0, `ℹ fail 0`, com pelo menos 6 testes novos em `tests/backup.test.js`.
- [ ] `grep -n "export function snapshotFromBackup" shared/backup.js` → 1 resultado.
- [ ] A seção "Resultados do spike" tem resposta para as 7 perguntas.
- [ ] `git status --porcelain` lista só `shared/backup.js`, `tests/backup.test.js`, este arquivo e `plans/README.md`.
- [ ] Linha do plano 006 atualizada em `plans/README.md`.

## Condições de PARADA

- `exportFullBackupJSON` não grava mais as chaves listadas em "Estado atual".
- Você sente vontade de ligar o conversor à UI "porque é rápido". Não ligue; descreva na pergunta 7.
- O fixture não tem 3.030 atividades ou não tem `user.Id === 101`. Ajuste os números do teste 2 aos valores reais **e** registre a diferença no relatório.

## Notas de manutenção

- Se o formato de `exportFullBackupJSON` mudar (chave nova ou renomeada), `snapshotFromBackup` e o teste de ida e volta precisam mudar junto.
- A funcionalidade completa só deve ser liberada depois do plano 003, porque o conteúdo do arquivo é renderizado.
- O campo `source: 'backup'` existe para a UI conseguir mostrar o banner e bloquear gravações no cache.

## Resultados do spike

1. **UI:** manter “Abrir backup…” no menu `#export-menu`, com banner persistente indicando a data e ação “Voltar aos dados ao vivo”. O menu existente agrupa exportações e cabe neste fluxo; o banner evita confundir a fonte.
2. **Leitura:** usar `<input type="file" accept="application/json,.json">`, `file.text()` e `JSON.parse`, sem nova permissão. Context7 consultado em 03/11/2026: a documentação oficial do Chrome declara que file handling não exige permissões (https://developer.chrome.com/docs/extensions/how-to/web-platform/file-handling-chromeos). O fluxo específico no Chrome desktop ainda não foi verificado manualmente.
3. **Persistência:** não gravar em `chrome.storage.local`: conservar o cache ao vivo e manter o snapshot importado apenas em memória, somente leitura.
4. **Tamanho:** fixture real medido: **3.008 atividades**, **1.693.392 bytes**, leitura + parse **17,4 ms** em execução local. O plano citava 3.030; o teste foi corrigido para o arquivo real, cujo usuário segue `Id === 101`. Recomendo limite inicial de 50 MB antes de ler; desempenho perto desse limite e memória não verificados.
5. **Sincronizar:** desabilitar enquanto estiver visualizando backup, com orientação para voltar aos dados ao vivo pelo banner; evitar troca silenciosa de fonte.
6. **CLI:** exportador `exportar_backup_completo` conferido no commit `5623f1841af1f98e2c7a3e2a7807fbbf71a0ff43` de `prof-ramos/aprovado`: mesmas chaves centrais, mais `metricas_tempo` e `metricas_ciclo`, ignoradas pelo conversor. Exportação real pelo método `exportar_backup_completo()` executada em 03/11/2026: 4.814 atividades, 84 matérias, 71 revisões concluídas. Conversão preservou as listas, usuário, ciclo e data, sem mutar a entrada. Evidência em `docs/validacao-cli.md`. O módulo experimental é excluído do ZIP até existir integração à UI.
7. **Próximo plano:** tocar `dashboard/dashboard.html`, `.js` e `.css`, reutilizando `shared/backup.js`. Adicionar seleção de arquivo, limite/tratamento de erros, banner e retorno ao snapshot ao vivo, bloquear sync e escritas durante importação, repopular filtros e renderizar as abas. Esforço M, aproximadamente 1–2 dias com QA. Testar arquivo inválido, formatos aceitos, limite, HTML malicioso, retorno ao vivo e prova de que storage não foi alterado.

Verificação atualizada: conversor com 8 testes e API com 7 testes passando; `npm test` com 159/159 testes e zero falhas em 03/11/2026. O ENOENT histórico do gerador temporário foi corrigido. Nenhuma integração à UI, alteração de permissão ou escrita de backup no cache foi feita.

Validação final: 156/156 testes passam em UTC e America/Sao_Paulo. Falha do gerador temporário corrigida com resolução de links simbólicos.

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { AprovadoApi } from '../shared/api.js';
let storage, writes, oldFetch, oldChrome;
const routes = {
  'Usuario/Obter': { Id: 7 }, 'Materia/Listar': [{ Id: 1 }],
  'Atividade/Listar': [{ Id: 10 }, { Id: 11 }],
  'Acompanhamento/CicloEstudos': { TotalPorcentagem: 50 },
  'Revisao/ListarPendentes': [], 'Revisao/ListarConcluidas': []
};
function install(failed) {
  globalThis.fetch = async url => {
    const key = Object.keys(routes).find(k => url.endsWith(`/service/${k}`));
    assert.ok(key, `rota não mapeada: ${url}`);
    const status = key === failed ? 500 : 200;
    return { status, ok: status === 200, redirected: false, text: async () => JSON.stringify(routes[key]) };
  };
  globalThis.chrome = { storage: { local: {
    get: async () => ({ ...storage }),
    set: async obj => { writes.push(obj); Object.assign(storage, obj); }
  } } };
}
beforeEach(() => { storage = {}; writes = []; oldFetch = globalThis.fetch; oldChrome = globalThis.chrome; });
afterEach(() => { globalThis.fetch = oldFetch; if (oldChrome === undefined) delete globalThis.chrome; else globalThis.chrome = oldChrome; });
test('sincroniza e grava dados completos', async () => { install(); const s = await AprovadoApi.fetchCompleteSnapshot(true); assert.equal(s.atividades.length, 2); assert.equal(s.materias.length, 1); assert.equal(writes.length, 1); assert.equal(writes[0].aprovado_data_snapshot.atividades.length, 2); });
for (const endpoint of ['Atividade/Listar', 'Materia/Listar']) test(`falha essencial em ${endpoint} não grava cache`, async () => { install(endpoint); await assert.rejects(() => AprovadoApi.fetchCompleteSnapshot(true)); assert.equal(writes.length, 0); });
test('falha preserva snapshot anterior expirado', async () => { storage = { aprovado_data_snapshot: { atividades: [{ Id: 1 }] }, aprovado_last_sync: 0 }; install('Atividade/Listar'); await assert.rejects(() => AprovadoApi.fetchCompleteSnapshot(true)); assert.deepEqual(storage.aprovado_data_snapshot.atividades, [{ Id: 1 }]); assert.equal(writes.length, 0); });
test('revisões são opcionais', async () => { install('Revisao/ListarPendentes'); const s = await AprovadoApi.fetchCompleteSnapshot(true); assert.deepEqual(s.revisoesPendentes, []); assert.equal(writes.length, 1); });
test('ciclo é opcional', async () => { install('Acompanhamento/CicloEstudos'); assert.equal((await AprovadoApi.fetchCompleteSnapshot(true)).ciclo, null); });
test('cache fresco evita rede', async () => { install(); storage = { aprovado_data_snapshot: { marcador: true }, aprovado_last_sync: Date.now() }; globalThis.fetch = () => { throw Error('rede inesperada'); }; assert.deepEqual(await AprovadoApi.fetchCompleteSnapshot(), { marcador: true }); });

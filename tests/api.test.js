import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { AprovadoApi } from '../shared/api.js';
let storage, writes, requests, oldFetch, oldChrome;
const routes = {
  'Usuario/Obter': { Id: 7 }, 'Materia/Listar': [{ Id: 1 }],
  'Atividade/Listar': [{ Id: 10 }, { Id: 11 }],
  'Acompanhamento/CicloEstudos': { TotalPorcentagem: 50 },
  'Revisao/ListarPendentes': [], 'Revisao/ListarConcluidas': []
};
function install(failed, overrides = {}) {
  const responses = { ...routes, ...overrides };
  globalThis.fetch = async url => {
    const key = Object.keys(routes).find(k => url.endsWith(`/service/${k}`));
    assert.ok(key, `rota não mapeada: ${url}`);
    requests.push(key);
    const status = key === failed ? 500 : 200;
    const body = typeof responses[key] === 'function' ? responses[key]() : responses[key];
    return { status, ok: status === 200, redirected: false, text: async () => JSON.stringify(body) };
  };
  globalThis.chrome = { storage: { local: {
    get: async () => ({ ...storage }),
    set: async obj => { writes.push(obj); Object.assign(storage, obj); }
  } } };
}
beforeEach(() => { storage = {}; writes = []; requests = []; oldFetch = globalThis.fetch; oldChrome = globalThis.chrome; });
afterEach(() => { globalThis.fetch = oldFetch; if (oldChrome === undefined) delete globalThis.chrome; else globalThis.chrome = oldChrome; });
test('sincroniza e grava dados completos', async () => { install(); const s = await AprovadoApi.fetchCompleteSnapshot(true); assert.equal(s.atividades.length, 2); assert.equal(s.materias.length, 1); assert.equal(writes.length, 1); assert.equal(writes[0].aprovado_data_snapshot.atividades.length, 2); });
for (const endpoint of ['Atividade/Listar', 'Materia/Listar']) test(`falha essencial em ${endpoint} não grava cache`, async () => { install(endpoint); await assert.rejects(() => AprovadoApi.fetchCompleteSnapshot(true)); assert.equal(writes.length, 0); });
test('falha preserva snapshot anterior expirado', async () => { storage = { aprovado_data_snapshot: { atividades: [{ Id: 1 }] }, aprovado_last_sync: 0 }; install('Atividade/Listar'); await assert.rejects(() => AprovadoApi.fetchCompleteSnapshot(true)); assert.deepEqual(storage.aprovado_data_snapshot.atividades, [{ Id: 1 }]); assert.equal(writes.length, 0); });
test('revisões são opcionais', async () => { install('Revisao/ListarPendentes'); const s = await AprovadoApi.fetchCompleteSnapshot(true); assert.deepEqual(s.revisoesPendentes, []); assert.equal(writes.length, 1); });
test('ciclo é opcional', async () => { install('Acompanhamento/CicloEstudos'); assert.equal((await AprovadoApi.fetchCompleteSnapshot(true)).ciclo, null); });
test('cache fresco da mesma conta consulta identidade mas evita recarregar listas', async () => {
  install();
  storage = { aprovado_data_snapshot: { user: { Id: 7 }, atividades: [{ Id: 99 }] }, aprovado_last_sync: Date.now() };
  const snapshot = await AprovadoApi.fetchCompleteSnapshot();
  assert.deepEqual(snapshot.atividades, [{ Id: 99 }]);
  assert.deepEqual(requests, ['Usuario/Obter']);
  assert.equal(writes.length, 0);
});

test('troca de conta não reutiliza snapshot fresco do usuário anterior', async () => {
  install();
  storage = { aprovado_data_snapshot: { user: { Id: 8 }, atividades: [{ Id: 99 }] }, aprovado_last_sync: Date.now() };
  const snapshot = await AprovadoApi.fetchCompleteSnapshot();
  assert.equal(snapshot.user.Id, 7);
  assert.deepEqual(snapshot.atividades, [{ Id: 10 }, { Id: 11 }]);
  assert.equal(storage.aprovado_data_snapshot.user.Id, 7);
  assert.equal(writes.length, 1);
});

test('cache legado sem dono é recarregado antes de retornar dados', async () => {
  install();
  storage = { aprovado_data_snapshot: { atividades: [{ Id: 99 }] }, aprovado_last_sync: Date.now() };
  assert.deepEqual((await AprovadoApi.fetchCompleteSnapshot()).atividades, [{ Id: 10 }, { Id: 11 }]);
  assert.equal(writes.length, 1);
});

test('identidade numérica ou textual da mesma conta preserva cache', async () => {
  install();
  storage = { aprovado_data_snapshot: { user: { Id: '7' }, atividades: [{ Id: 99 }] }, aprovado_last_sync: Date.now() };
  assert.deepEqual((await AprovadoApi.fetchCompleteSnapshot()).atividades, [{ Id: 99 }]);
  assert.deepEqual(requests, ['Usuario/Obter']);
  assert.equal(writes.length, 0);
});

test('sessão encerrada não retorna snapshot fresco', async () => {
  install(null, { 'Usuario/Obter': null });
  storage = { aprovado_data_snapshot: { user: { Id: 7 }, atividades: [{ Id: 99 }] }, aprovado_last_sync: Date.now() };
  await assert.rejects(() => AprovadoApi.fetchCompleteSnapshot(), /não autenticado/);
  assert.equal(writes.length, 0);
});

test('falha na verificação de identidade não retorna cache como fallback', async () => {
  install('Usuario/Obter');
  storage = { aprovado_data_snapshot: { user: { Id: 7 }, atividades: [{ Id: 99 }] }, aprovado_last_sync: Date.now() };
  await assert.rejects(() => AprovadoApi.fetchCompleteSnapshot(), /Erro na API/);
  assert.equal(writes.length, 0);
});

test('resposta 401 impede leitura de cache mesmo ainda fresco', async () => {
  install();
  storage = { aprovado_data_snapshot: { user: { Id: 7 }, atividades: [{ Id: 99 }] }, aprovado_last_sync: Date.now() };
  globalThis.fetch = async () => ({ status: 401, ok: false, redirected: false });
  await assert.rejects(() => AprovadoApi.fetchCompleteSnapshot(), { status: 401 });
  assert.equal(writes.length, 0);
});

test('perfil confirmado substitui metadados antigos sem modificar cache da mesma conta', async () => {
  install(null, { 'Usuario/Obter': { Id: 7, Nome: 'Perfil atualizado' } });
  storage = { aprovado_data_snapshot: { user: { Id: 7, Nome: 'Perfil anterior' }, atividades: [{ Id: 99 }] }, aprovado_last_sync: Date.now() };
  const snapshot = await AprovadoApi.fetchCompleteSnapshot();
  assert.equal(snapshot.user.Nome, 'Perfil atualizado');
  assert.equal(storage.aprovado_data_snapshot.user.Nome, 'Perfil anterior');
  assert.equal(writes.length, 0);
});

test('mudança de conta durante sincronização impede gravação de dados misturados', async () => {
  let authCalls = 0;
  install(null, { 'Usuario/Obter': () => ({ Id: ++authCalls === 1 ? 7 : 8 }) });
  storage = { aprovado_data_snapshot: { user: { Id: 7 }, atividades: [{ Id: 99 }] }, aprovado_last_sync: 0 };
  await assert.rejects(() => AprovadoApi.fetchCompleteSnapshot(true), /conta mudou/);
  assert.equal(writes.length, 0);
  assert.deepEqual(storage.aprovado_data_snapshot.atividades, [{ Id: 99 }]);
});

test('falha essencial ao trocar de conta rejeita sem servir dados da conta anterior', async () => {
  install('Atividade/Listar');
  storage = { aprovado_data_snapshot: { user: { Id: 8 }, atividades: [{ Id: 99 }] }, aprovado_last_sync: Date.now() };
  await assert.rejects(() => AprovadoApi.fetchCompleteSnapshot(), /Erro na API/);
  assert.equal(writes.length, 0);
});

test('sincronização forçada recarrega também o cache da própria conta', async () => {
  install();
  storage = { aprovado_data_snapshot: { user: { Id: 7 }, atividades: [{ Id: 99 }] }, aprovado_last_sync: Date.now() };
  assert.deepEqual((await AprovadoApi.fetchCompleteSnapshot(true)).atividades, [{ Id: 10 }, { Id: 11 }]);
  assert.equal(writes.length, 1);
});

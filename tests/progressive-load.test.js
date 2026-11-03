import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { AprovadoApi } from '../shared/api.js';

let storage, writes, requests, oldFetch, oldChrome, session;
const lists = {
  'Materia/Listar': [{ Id: 1 }], 'Atividade/Listar': [{ Id: 10 }, { Id: 11 }],
  'Acompanhamento/CicloEstudos': { TotalPorcentagem: 50 }, 'Revisao/ListarPendentes': [], 'Revisao/ListarConcluidas': []
};

function install() {
  globalThis.fetch = async url => {
    const key = Object.keys({ 'Usuario/Obter': 1, ...lists }).find(k => url.endsWith(`/service/${k}`));
    assert.ok(key, `rota não mapeada: ${url}`);
    requests.push(key);
    if (key === 'Usuario/Obter' && session.status) {
      return { status: session.status, ok: false, redirected: false, text: async () => '' };
    }
    const body = key === 'Usuario/Obter' ? { Id: session.id } : lists[key];
    return { status: 200, ok: true, redirected: false, text: async () => JSON.stringify(body) };
  };
  globalThis.chrome = { storage: { local: {
    get: async () => ({ ...storage }),
    set: async obj => { writes.push(obj); Object.assign(storage, obj); }
  } } };
}

beforeEach(() => {
  storage = {}; writes = []; requests = []; session = { id: 7 };
  oldFetch = globalThis.fetch; oldChrome = globalThis.chrome; install();
});
afterEach(() => {
  globalThis.fetch = oldFetch;
  if (oldChrome === undefined) delete globalThis.chrome; else globalThis.chrome = oldChrome;
});

test('getSyncedAt reads the snapshot instant in ms and ignores missing or invalid values', () => {
  assert.equal(AprovadoApi.getSyncedAt({ syncedAt: '2026-11-03T12:00:00.000Z' }), Date.parse('2026-11-03T12:00:00.000Z'));
  for (const snapshot of [null, undefined, {}, { syncedAt: 'nunca' }]) assert.equal(AprovadoApi.getSyncedAt(snapshot), null);
});

test('cached snapshot is returned only for the same account, even when stale', async () => {
  storage = { aprovado_data_snapshot: { user: { Id: 7 }, atividades: [{ Id: 99 }], syncedAt: '2026-11-01T10:00:00.000Z' }, aprovado_last_sync: 1 };
  const cached = await AprovadoApi.getCachedSnapshotForUser({ Id: '7', Nome: 'Atual' });
  assert.deepEqual(cached.atividades, [{ Id: 99 }]);
  assert.equal(cached.user.Nome, 'Atual');
  assert.equal(await AprovadoApi.getCachedSnapshotForUser({ Id: 8 }), null);
  assert.equal(await AprovadoApi.getCachedSnapshotForUser(null), null);
});

test('legacy cache without syncedAt takes its instant from the last-sync marker', async () => {
  storage = { aprovado_data_snapshot: { user: { Id: 7 }, atividades: [] }, aprovado_last_sync: 1_700_000_000_000 };
  const cached = await AprovadoApi.getCachedSnapshotForUser({ Id: 7 });
  assert.equal(AprovadoApi.getSyncedAt(cached), 1_700_000_000_000);
});

test('progressive load shows the stale cache of the confirmed account before the refresh finishes', async () => {
  storage = { aprovado_data_snapshot: { user: { Id: 7 }, atividades: [{ Id: 99 }], syncedAt: '2026-11-01T10:00:00.000Z' }, aprovado_last_sync: 1 };
  const order = [];
  const result = await AprovadoApi.loadSnapshotProgressive({ onCached: snapshot => order.push(['cache', snapshot.atividades.length, requests.length]) });
  order.push(['final', result.atividades.length]);
  assert.deepEqual(order, [['cache', 1, 1], ['final', 2]]);
  assert.equal(storage.aprovado_data_snapshot.user.Id, 7);
  assert.ok(AprovadoApi.getSyncedAt(result) > Date.parse('2026-11-02T00:00:00Z'));
});

test('progressive load never shows another account\'s cache', async () => {
  storage = { aprovado_data_snapshot: { user: { Id: 8 }, atividades: [{ Id: 99 }], syncedAt: '2026-11-01T10:00:00.000Z' }, aprovado_last_sync: Date.now() };
  let shown = 0;
  const result = await AprovadoApi.loadSnapshotProgressive({ onCached: () => { shown++; } });
  assert.equal(shown, 0);
  assert.equal(result.user.Id, 7);
});

test('progressive load skips the cache callback on a forced refresh and rejects an expired session', async () => {
  storage = { aprovado_data_snapshot: { user: { Id: 7 }, atividades: [{ Id: 99 }] }, aprovado_last_sync: 1 };
  let shown = 0;
  await AprovadoApi.loadSnapshotProgressive({ forceRefresh: true, onCached: () => { shown++; } });
  assert.equal(shown, 0);
  session = { status: 401 };
  await assert.rejects(() => AprovadoApi.loadSnapshotProgressive({ onCached: () => { shown++; } }), error => error.status === 401);
  assert.equal(shown, 0);
});

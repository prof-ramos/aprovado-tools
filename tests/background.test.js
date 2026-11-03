import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../background.js', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const plain = value => JSON.parse(JSON.stringify(value));

// Run the actual worker, exposing only the APIs needed for navigation. Cookie
// access is instrumented to catch an obsolete command trying to inspect a session.
function workerHarness({ panelError } = {}) {
  const listeners = {};
  const calls = { menus: [], tabs: [], panels: [], storage: [], cookies: [], errors: [], windows: 0 };
  const event = name => ({ addListener: listener => { listeners[name] = listener; } });
  const chrome = {
    runtime: {
      onInstalled: event('installed'), onMessage: event('message'),
      getURL: path => `chrome-extension://test-extension/${path}`
    },
    contextMenus: { create: options => calls.menus.push(plain(options)), onClicked: event('menu') },
    storage: { local: { set: async values => calls.storage.push(plain(values)) } },
    tabs: { create: async options => { calls.tabs.push(plain(options)); return { id: 73 }; } },
    sidePanel: { open: async options => {
      calls.panels.push(plain(options));
      if (panelError) throw new Error(panelError);
    } },
    windows: { getLastFocused: async () => { calls.windows++; return { id: 29 }; } },
    cookies: { get: async options => { calls.cookies.push(plain(options)); return null; } }
  };
  vm.runInNewContext(source, { chrome, console: { error: (...args) => calls.errors.push(args) } });
  return {
    calls,
    install: reason => listeners.installed({ reason }),
    menu: (menuItemId, tab) => listeners.menu({ menuItemId }, tab),
    message: (type, sender = {}) => new Promise(resolve => {
      const keptOpen = listeners.message({ type }, sender, response => resolve(plain(response)));
      assert.equal(keptOpen, true, 'async response channel remains open');
    })
  };
}

test('manifest grants navigation and storage APIs without tabs or cookie inspection permissions', () => {
  assert.deepEqual(manifest.permissions, ['storage', 'unlimitedStorage', 'sidePanel', 'contextMenus']);
});

test('installation registers both menus and initializes defaults only on first install', async () => {
  const worker = workerHarness();
  await worker.install('install');
  assert.deepEqual(worker.calls.menus.map(({ id, contexts }) => ({ id, contexts })), [
    { id: 'aprovado_open_dashboard', contexts: ['action', 'page'] },
    { id: 'aprovado_open_sidepanel', contexts: ['action', 'page'] }
  ]);
  assert.equal(worker.calls.storage.length, 1);
  assert.equal(worker.calls.storage[0].theme, 'dark');
  assert.equal(typeof worker.calls.storage[0].installDate, 'number');
  const update = workerHarness();
  await update.install('update');
  assert.equal(update.calls.storage.length, 0, 'updates preserve user settings');
});

test('dashboard message creates the extension dashboard and returns its tab ID', async () => {
  const worker = workerHarness();
  assert.deepEqual(await worker.message('OPEN_DASHBOARD'), { success: true, tabId: 73 });
  assert.deepEqual(worker.calls.tabs, [{ url: 'chrome-extension://test-extension/dashboard/dashboard.html' }]);
});

test('side panel messages target the sender window or the last focused window', async () => {
  const worker = workerHarness();
  assert.deepEqual(await worker.message('OPEN_SIDEPANEL', { tab: { windowId: 12 } }), { success: true });
  assert.equal(worker.calls.windows, 0);
  assert.deepEqual(await worker.message('OPEN_SIDEPANEL'), { success: true });
  assert.deepEqual(worker.calls.panels, [{ windowId: 12 }, { windowId: 29 }]);
  assert.equal(worker.calls.windows, 1);
});

test('context menu routes dashboard and native panel actions and ignores unrelated entries', async () => {
  const worker = workerHarness();
  await worker.menu('aprovado_open_dashboard');
  await worker.menu('aprovado_open_sidepanel', { windowId: 41 });
  await worker.menu('aprovado_open_sidepanel');
  await worker.menu('unrelated', { windowId: 51 });
  assert.deepEqual(worker.calls.tabs, [{ url: 'chrome-extension://test-extension/dashboard/dashboard.html' }]);
  assert.deepEqual(worker.calls.panels, [{ windowId: 41 }]);
});

test('unknown and removed login-status commands return errors without inspecting cookies', async () => {
  const worker = workerHarness();
  assert.deepEqual(await worker.message('UNKNOWN'), { error: 'Comando desconhecido' });
  assert.deepEqual(await worker.message('CHECK_LOGIN_STATUS'), { error: 'Comando desconhecido' });
  assert.deepEqual(worker.calls.cookies, []);
  assert.deepEqual(worker.calls.tabs, []);
  assert.deepEqual(worker.calls.panels, []);
});

test('panel API failures produce an error response instead of a success acknowledgement', async () => {
  const worker = workerHarness({ panelError: 'gesture required' });
  assert.deepEqual(await worker.message('OPEN_SIDEPANEL', { tab: { windowId: 12 } }), { error: 'gesture required' });
  assert.equal(worker.calls.errors.length, 1);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../content.js', import.meta.url), 'utf8');

// Exercise the real content script with a queued animation frame, as in a SPA
// whose DOM observer fires again before the browser paints.
function pageHarness() {
  const nodes = [];
  const frames = [];
  const observers = [];
  const messages = [];
  const container = {
    querySelector: selector => nodes.find(node => '#' + node.id === selector),
    appendChild: node => nodes.push(node)
  };
  const document = {
    readyState: 'complete', body: container,
    getElementById: id => nodes.find(node => node.id === id),
    querySelector: () => container,
    createElement: () => ({ addEventListener(type, listener) { this[type] = listener; } })
  };
  const window = { location: { pathname: '/' }, requestAnimationFrame: callback => frames.push(callback) };
  function MutationObserver(callback) { observers.push(callback); this.observe = () => {}; }
  const context = vm.createContext({ document, window, MutationObserver, chrome: { runtime: { sendMessage: message => messages.push(message) } } });
  return {
    nodes, messages,
    inject: () => vm.runInContext(source, context),
    mutate: () => observers.forEach(callback => callback()),
    paint: () => { while (frames.length) frames.shift()(); }
  };
}

test('SPA mutations before paint insert only one header shortcut and floating badge', () => {
  const page = pageHarness();
  page.inject();
  page.mutate();
  page.mutate();
  page.paint();
  assert.equal(page.nodes.filter(node => node.id === 'aprovado-tools-injected-btn').length, 1);
  assert.equal(page.nodes.filter(node => node.id === 'aprovado-tools-floating-btn').length, 1);
  page.nodes[0].click({ preventDefault() {} });
  assert.equal(page.messages.length, 1);
  assert.equal(page.messages[0].type, 'OPEN_DASHBOARD');
});

test('reinjection before a pending animation frame remains idempotent', () => {
  const page = pageHarness();
  page.inject();
  page.inject();
  page.paint();
  assert.equal(page.nodes.filter(node => node.id === 'aprovado-tools-injected-btn').length, 1);
  assert.equal(page.nodes.filter(node => node.id === 'aprovado-tools-floating-btn').length, 1);
});

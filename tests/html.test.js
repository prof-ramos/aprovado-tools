import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, sanitizeColor } from '../shared/ui.js';

test('escapa texto e atributos externos', () => {
  assert.equal(escapeHtml('<b>"x" & \'y\'</b>'), '&lt;b&gt;&quot;x&quot; &amp; &#039;y&#039;&lt;/b&gt;');
});
test('aceita valores ausentes e números', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(42), '42');
});
test('aceita cores hexadecimais com espaços externos', () => {
  for (const color of ['#FFF', '#ffff', '#abcdef', '#abcdef12']) assert.equal(sanitizeColor(` ${color} `), color);
});
test('rejeita CSS e cores inválidas', () => {
  for (const color of ['red; background:url(x)', '#12345', undefined, '']) assert.equal(sanitizeColor(color), '#3b82f6');
});

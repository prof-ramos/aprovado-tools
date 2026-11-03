import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const checker = resolve('scripts/check_docs.js');
function fixture(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'aprovado-docs-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(root, name, '..'), { recursive: true });
    writeFileSync(join(root, name), content);
  }
  return root;
}
function run(root, ...files) {
  return spawnSync(process.execPath, [checker, '--root', root, ...files], { encoding: 'utf8' });
}

test('reports missing files with the source line and exits nonzero', t => {
  const root = fixture(t, { 'README.md': '# Guide\n\n[Missing](lost.md)\n' });
  const result = run(root, 'README.md');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /README\.md:3.*lost\.md.*arquivo inexistente/);
});

test('rejects a missing heading in a file that exists', t => {
  const root = fixture(t, { 'README.md': '[Bad](guide.md#absent)', 'guide.md': '# Present' });
  const result = run(root, 'README.md');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /âncora inexistente.*absent/);
});

test('accepts Unicode, encoded paths/fragments, duplicate headings, directories and root links', t => {
  const root = fixture(t, {
    'README.md': '[First](docs/guia%20pt.md#reten%C3%A7%C3%A3o-e-exclus%C3%A3o)\n'
      + '[Second](docs/guia%20pt.md#retenção-e-exclusão-1)\n'
      + '[Third](docs/guia%20pt.md#retenção-e-exclusão-2)\n'
      + '[Directory](/docs/#visão-geral)\n[Code](scripts/run.js#L7)\n'
      + '[Own](#guide)\n# Guide',
    'docs/guia pt.md': '# Retenção e exclusão\n# Retenção e exclusão\n# Retenção e exclusão',
    'docs/README.md': 'Visão geral\n===========',
    'scripts/run.js': '// no line seven needed',
  });
  const result = run(root, 'README.md');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /6 links locais/);
});

test('ignores examples inside fences, inline code, comments and external links', t => {
  const root = fixture(t, { 'README.md': '```md\n[bad](missing.md)\n```\n'
    + '~~~markdown\n[bad](another.md)\n~~~\n`[bad](inline.md)`\n'
    + '``[bad](inline-too.md)``\n<!-- [bad](comment.md) -->\n'
    + '[web](https://example.com/missing) [mail](mailto:a@example.com) [remote](//example.com/x)' });
  const result = run(root, 'README.md');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /0 links locais/);
});

test('checks reference links, images, angle destinations and balanced parentheses', t => {
  const root = fixture(t, {
    'README.md': '[ref][guide]\n[guide]: <guide (pt).md#ação> "title"\n'
      + '![image](image.svg)\n[inline](guide\(pt\).md#ação)\n[guide][]',
    'guide (pt).md': '# Ação',
    'guide(pt).md': '# Ação',
    'image.svg': '<svg/>',
  });
  const result = run(root, 'README.md');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /4 links locais/);
  writeFileSync(join(root, 'README.md'), '[missing][ref]\n[ref]: missing.md');
  assert.equal(run(root, 'README.md').status, 1);
});

test('prevents traversal and symlinks outside the repository', t => {
  const root = fixture(t, { 'README.md': '[escape](../outside.md)\n[symlink](outside.md)' });
  symlinkSync(join(root, '..'), join(root, 'outside.md'));
  const result = run(root, 'README.md');
  assert.equal(result.status, 1);
  assert.equal((result.stderr.match(/fora do repositório/g) || []).length, 2);
  assert.equal(run(root, '../outside.md').status, 1);
});

test('default discovery uses tracked Markdown only, including historical plans', t => {
  const root = fixture(t, { 'README.md': '# Guide', 'plans/old.md': '[bad](gone.md)', 'untracked.md': '[bad](other.md)' });
  assert.equal(spawnSync('git', ['init', '-q', root]).status, 0);
  assert.equal(spawnSync('git', ['-C', root, 'add', 'README.md', 'plans/old.md']).status, 0);
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /plans\/old.md/);
  assert.doesNotMatch(result.stderr, /untracked.md/);
});


test('heading fragments follow formatting, punctuation and duplicate slug collisions', t => {
  const root = fixture(t, {
    'README.md': '[formatted](guide.md#16-verificação-do-popup)\n'
      + '[collision](guide.md#item-2)\n[explicit](guide.md#manual)',
    'guide.md': '# 1.6. **Verificação** do `popup`\n# Item\n# Item-1\n# Item\n<a id="manual"></a>',
  });
  const result = run(root, 'README.md');
  assert.equal(result.status, 0, result.stderr);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
test('release ZIP contains runtime modules and excludes experimental and private files', () => {
  const work = mkdtempSync(path.join(tmpdir(), 'aprovado-package-'));
  try {
    for (const entry of ['package.json', 'manifest.json', 'background.js', 'content.js', 'content.css', 'icons', 'popup', 'sidepanel', 'dashboard', 'shared']) {
      cpSync(path.join(root, entry), path.join(work, entry), { recursive: true });
    }
    mkdirSync(path.join(work, 'dist'));
    writeFileSync(path.join(work, 'dist', 'keep-me.zip'), 'UNRELATED_ARCHIVE');
    mkdirSync(path.join(work, 'scripts'));
    cpSync(path.join(root, 'scripts/build_zip.js'), path.join(work, 'scripts/build_zip.js'));
    writeFileSync(path.join(work, '.env'), 'SYNTHETIC_TEST_ONLY=not-a-secret');
    writeFileSync(path.join(work, 'shared', '.env'), 'SYNTHETIC_TEST_ONLY=not-a-secret');
    writeFileSync(path.join(work, 'dashboard', 'private.key'), 'SYNTHETIC_TEST_ONLY=not-a-secret');
    const pkg = JSON.parse(readFileSync(path.join(work, 'package.json')));
    execFileSync('sh', ['-c', pkg.scripts['build:zip']], { cwd: work, stdio: 'pipe' });
    assert.equal(readFileSync(path.join(work, 'dist', 'keep-me.zip'), 'utf8'), 'UNRELATED_ARCHIVE');
    const manifest = JSON.parse(readFileSync(path.join(work, 'manifest.json')));
    const archive = path.join(work, 'dist', `aprovado-tools-v${manifest.version}.zip`);
    const entries = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).trim().split('\n');
    assert.ok(entries.includes('manifest.json'));
    assert.ok(!entries.includes('shared/backup.js'));
    assert.ok(!entries.some(name => name.startsWith('tests/') || name === '.env'));
    assert.ok(!entries.includes('shared/.env'), 'nested private files must not be packaged');
    assert.ok(!entries.includes('dashboard/private.key'), 'nested keys must not be packaged');
    const previousArchive = readFileSync(archive);
    renameSync(path.join(work, 'shared'), path.join(work, 'shared-absent'));
    assert.throws(() => execFileSync('sh', ['-c', pkg.scripts['build:zip']], { cwd: work, stdio: 'pipe' }));
    assert.deepEqual(readFileSync(archive), previousArchive, 'a failed build must retain the previous archive');
    for (const name of entries.filter(name => name.endsWith('.js'))) {
      const source = execFileSync('unzip', ['-p', archive, name], { encoding: 'utf8' });
      for (const match of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(name), match[1]));
        assert.ok(entries.includes(target), `${name} imports missing ${target}`);
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

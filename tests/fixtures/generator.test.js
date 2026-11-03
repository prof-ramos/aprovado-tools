import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateMultiannualMock } from '../../scripts/generate_multiannual_mock.js';

const generatorUrl = new URL('../../scripts/generate_multiannual_mock.js', import.meta.url);
const fingerprint = value => createHash('sha256').update(value).digest('hex');

test('each generator call starts with the same seed and independent snapshot data', () => {
  const first = generateMultiannualMock();
  const expected = fingerprint(JSON.stringify(first));
  first.atividades[0].Materia.Nome = 'Modified by a consumer';
  first.materias[0].Nome = 'Modified by a consumer';

  assert.equal(fingerprint(JSON.stringify(generateMultiannualMock())), expected);
  assert.equal(fingerprint(JSON.stringify(generateMultiannualMock())), expected);
});

test('fixture bytes are independent of the host timezone', () => {
  const script = `
    import { createHash } from 'node:crypto';
    import { generateMultiannualMock } from ${JSON.stringify(generatorUrl.href)};
    process.stdout.write(createHash('sha256')
      .update(JSON.stringify(generateMultiannualMock(), null, 2)).digest('hex'));
  `;
  const hashes = ['UTC', 'America/Sao_Paulo', 'Pacific/Kiritimati'].map(TZ =>
    execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      env: { ...process.env, TZ },
      encoding: 'utf8'
    })
  );

  assert.equal(hashes[0], hashes[1]);
  assert.equal(hashes[0], hashes[2]);
});

test('CLI creates a missing fixture directory and regenerates identical fixture bytes', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'aprovado-fixture-'));
  try {
    const scripts = path.join(root, 'scripts');
    mkdirSync(scripts);
    const script = path.join(scripts, 'generate_multiannual_mock.mjs');
    copyFileSync(fileURLToPath(generatorUrl), script);
    const fixture = path.join(root, 'tests', 'fixtures', 'multiannual_mock_2016_2026.json');

    execFileSync(process.execPath, [script], { cwd: tmpdir(), stdio: 'pipe' });
    const first = readFileSync(fixture);
    assert.equal(JSON.parse(first).materias.length, 6);
    assert.ok(JSON.parse(first).atividades.length > 2000);

    execFileSync(process.execPath, [script], { cwd: tmpdir(), stdio: 'pipe' });
    assert.equal(fingerprint(readFileSync(fixture)), fingerprint(first));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

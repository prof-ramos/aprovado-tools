import { it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
it('keeps npm version consistent with manifest', () => assert.equal(pkg.version, manifest.version));
it('derives archive version instead of hardcoding it', () => assert.ok(!pkg.scripts['build:zip'].includes('v' + manifest.version)));

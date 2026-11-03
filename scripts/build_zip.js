#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const version = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')).version;
if (!/^\d+(?:\.\d+){0,3}$/.test(version)) throw new Error('Versão inválida no manifesto');
const inputs = [
  'manifest.json', 'background.js', 'content.js', 'content.css',
  ...[16, 32, 48, 128].map(size => `icons/icon-${size}.png`),
  ...['popup', 'sidepanel', 'dashboard'].flatMap(view => ['html', 'css', 'js'].map(ext => `${view}/${view}.${ext}`)),
  ...['api', 'analytics', 'export', 'format', 'ui'].map(name => `shared/${name}.js`)
];
for (const input of inputs) {
  if (!existsSync(join(root, input))) throw new Error(`Arquivo de produção ausente: ${input}`);
}
const dist = join(root, 'dist');
mkdirSync(dist, { recursive: true });
const temporary = mkdtempSync(join(dist, '.build-'));
const filename = `aprovado-tools-v${version}.zip`;
try {
  const archive = join(temporary, filename);
  execFileSync('zip', ['-q', '-r', archive, ...inputs], { cwd: root, stdio: 'inherit' });
  renameSync(archive, join(dist, filename));
  console.log(`dist/${filename}`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

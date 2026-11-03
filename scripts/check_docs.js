#!/usr/bin/env node
// Offline check of tracked Markdown; deliberately no network or npm dependencies.
import { readFileSync, realpathSync, statSync, existsSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const blank = value => value.replace(/[^\n]/g, ' ');
function prose(markdown, inline = true) {
  let fence;
  const lines = markdown.replace(/<!--[^]*?-->/g, blank).split('\n').map(line => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length
          && /^ {0,3}(?:`+|~+)\s*$/.test(line)) fence = undefined;
      return blank(line);
    }
    if (marker) { fence = marker[1]; return blank(line); }
    return line;
  }).join('\n');
  return inline ? lines.replace(/(`+)([^]*?)\1(?!`)/g, blank) : lines;
}

function anchors(markdown) {
  const text = prose(markdown, false);
  const result = new Set();
  // Explicit HTML anchors are occasionally useful when headings change.
  for (const match of text.matchAll(/<(?:a|[a-z][\w-]*)\b[^>]*\b(?:id|name)=["']([^"']+)["'][^>]*>/gi)) result.add(match[1]);
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const atx = lines[i].match(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    const heading = atx?.[1] ?? (i + 1 < lines.length && /^ {0,3}(?:=+|-+)\s*$/.test(lines[i + 1]) ? lines[i].trim() : undefined);
    if (!heading) continue;
    const slug = heading.toLowerCase()
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/<[^>]*>/g, '')
      .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '')
      .replace(/\s/g, '-');
    let unique = slug;
    let duplicate = 0;
    while (result.has(unique)) unique = `${slug}-${++duplicate}`;
    result.add(unique);
  }
  return result;
}

// Read a Markdown destination, keeping nested/escaped parentheses in filenames.
function destination(text, start, inline) {
  let i = start;
  while (/\s/.test(text[i] || '') && i < text.length) i++;
  if (text[i] === '<') {
    const end = text.indexOf('>', i + 1);
    return end < 0 ? null : { value: text.slice(i + 1, end), end: end + 1 };
  }
  const begin = i;
  let depth = 0;
  for (; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (/\s/.test(text[i])) break;
    if (text[i] === '(') depth++;
    if (text[i] === ')') {
      if (!depth && inline) break;
      depth--;
    }
  }
  return i === begin ? null : { value: text.slice(begin, i), end: i };
}

function links(markdown) {
  const text = prose(markdown);
  const references = new Map();
  const normalize = label => label.trim().replace(/\s+/g, ' ').toLowerCase();
  for (const match of text.matchAll(/^ {0,3}\[([^\]]+)\]:\s*/gm)) {
    const target = destination(text, match.index + match[0].length, false);
    if (target) references.set(normalize(match[1]), target.value);
  }
  const result = [];
  const labels = /!?\[([^\]\n]*)\]/g;
  for (let match; (match = labels.exec(text));) {
    const next = match.index + match[0].length;
    let value;
    if (text[next] === ':') continue; // Definition, checked through its uses.
    if (text[next] === '(') {
      const target = destination(text, next + 1, true);
      if (target) { value = target.value; labels.lastIndex = target.end; }
    } else if (text[next] === '[') {
      const end = text.indexOf(']', next + 1);
      if (end >= 0) {
        value = references.get(normalize(text.slice(next + 1, end) || match[1]));
        labels.lastIndex = end + 1;
      }
    } else value = references.get(normalize(match[1]));
    if (value !== undefined) result.push({ value, line: text.slice(0, match.index).split('\n').length });
  }
  return result;
}

function inside(root, path) {
  const pathRelative = relative(root, path);
  return pathRelative !== '..' && !pathRelative.startsWith(`..${sep}`) && !isAbsolute(pathRelative);
}
function safePath(root, path) {
  if (!inside(root, path)) throw new Error('destino fora do repositório');
  // Validate symlinked parents as well as the target before reading anything.
  let existing = path;
  while (!existsSync(existing) && existing !== dirname(existing)) existing = dirname(existing);
  if (!inside(root, realpathSync(existing))) throw new Error('destino fora do repositório');
  return path;
}

export function checkDocs(root, files) {
  root = realpathSync(root);
  const errors = [];
  let checked = 0;
  const headings = new Map();
  for (const file of files) {
    let source;
    try { source = readFileSync(safePath(root, resolve(root, file)), 'utf8'); }
    catch (error) { errors.push(`${file}: ${error.message}`); continue; }
    for (const { value, line } of links(source)) {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) continue;
      checked++;
      try {
        const raw = value.replace(/\\([\\()[\] <>])/g, '$1');
        const hash = raw.indexOf('#');
        const fragment = hash < 0 ? '' : decodeURIComponent(raw.slice(hash + 1));
        const pathname = decodeURIComponent((hash < 0 ? raw : raw.slice(0, hash)).split('?')[0]);
        let target = safePath(root, pathname ? resolve(pathname.startsWith('/') ? root : dirname(resolve(root, file)), pathname.replace(/^\/+/, '')) : resolve(root, file));
        if (!existsSync(target)) throw new Error('arquivo inexistente');
        if (statSync(target).isDirectory()) {
          const readme = ['README.md', 'readme.md'].map(name => resolve(target, name)).find(existsSync);
          if (!readme) {
            if (fragment) throw new Error('diretório sem README.md para conferir âncora');
            continue;
          }
          target = safePath(root, readme);
        }
        if (fragment && extname(target).toLowerCase() === '.md') {
          if (!headings.has(target)) headings.set(target, anchors(readFileSync(target, 'utf8')));
          if (!headings.get(target).has(fragment)) throw new Error(`âncora inexistente: #${fragment}`);
        }
      } catch (error) { errors.push(`${file}:${line}: ${value}: ${error.message}`); }
    }
  }
  return { files: files.length, checked, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    let root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    if (args[0] === '--root') {
      if (!args[1]) throw new Error('uso: node scripts/check_docs.js [--root diretório] [arquivos.md ...]');
      root = resolve(args[1]);
      args.splice(0, 2);
    }
    const files = args.length ? args : execFileSync('git', ['ls-files', '-z', '--', '*.md'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
    const result = checkDocs(root, files);
    for (const error of result.errors) console.error(error);
    console.log(`${result.files} arquivos Markdown; ${result.checked} links locais; ${result.errors.length} erros.`);
    process.exitCode = result.errors.length ? 1 : 0;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

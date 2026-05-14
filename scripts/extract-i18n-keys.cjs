#!/usr/bin/env node
// scripts/extract-i18n-keys.js — Phase 7.40
//
// Scanne src/ pour extraire les paires (key, fallback FR) depuis les
// appels t / tFormat / tPlural. Produit un JSON groupé par namespace
// (préfixe avant le premier '.').
//
// Usage : node scripts/extract-i18n-keys.js > /tmp/keys.json

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../src');
const exts = new Set(['.js', '.jsx']);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (exts.has(path.extname(name)) && !name.endsWith('.test.js') && !name.endsWith('.test.jsx')) out.push(p);
  }
  return out;
}

const files = walk(SRC);

// Patterns :
// t('key', 'fallback')
// t('key', "fallback")
// tFormat('key', params, 'fallback')
// tPlural('key', n, params, { one: '...', other: '...' })
// Le fallback peut contenir des apostrophes échappées '\''
//
// Regex naïve mais suffisante pour notre code : on capture une string
// SIMPLE quote ou DOUBLE quote, en respectant les échappements.
const SINGLE = /'((?:\\.|[^'\\])*)'/;
const DOUBLE = /"((?:\\.|[^"\\])*)"/;
const BOTH = /(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)")/;

const tCallRe = /\bt\(\s*(['"])([a-z][a-z0-9.-]+)\1\s*,\s*(['"])((?:\\.|[^\\])*?)\3\s*\)/g;
const tFormatCallRe = /\btFormat\(\s*(['"])([a-z][a-z0-9.-]+)\1\s*,\s*\{[^}]*\}\s*,\s*(['"])((?:\\.|[^\\])*?)\3\s*\)/g;
const tPluralCallRe = /\btPlural\(\s*(['"])([a-z][a-z0-9.-]+)\1\s*,\s*[^,]+,\s*\{[^}]*\}\s*,\s*\{\s*one\s*:\s*(['"])((?:\\.|[^\\])*?)\3\s*,\s*other\s*:\s*(['"])((?:\\.|[^\\])*?)\5\s*\}\s*\)/g;

const keys = {};

function addKey(key, value) {
  if (keys[key] && keys[key] !== value && JSON.stringify(keys[key]) !== JSON.stringify(value)) {
    process.stderr.write(`[warn] duplicate key with diff value: ${key}\n  existing: ${JSON.stringify(keys[key])}\n  new:      ${JSON.stringify(value)}\n`);
  }
  keys[key] = value;
}

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  let m;
  // t(key, fallback)
  tCallRe.lastIndex = 0;
  while ((m = tCallRe.exec(src)) !== null) {
    const key = m[2];
    const val = m[4].replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
    addKey(key, val);
  }
  // tFormat(key, params, fallback)
  tFormatCallRe.lastIndex = 0;
  while ((m = tFormatCallRe.exec(src)) !== null) {
    const key = m[2];
    const val = m[4].replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
    addKey(key, val);
  }
  // tPlural(key, n, params, { one, other })
  tPluralCallRe.lastIndex = 0;
  while ((m = tPluralCallRe.exec(src)) !== null) {
    const key = m[2];
    const one = m[4].replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    const other = m[6].replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    addKey(key, { one, other });
  }
}

// Group by namespace
const byNs = {};
for (const k of Object.keys(keys).sort()) {
  const ns = k.split('.')[0];
  if (!byNs[ns]) byNs[ns] = {};
  byNs[ns][k] = keys[k];
}

process.stdout.write(JSON.stringify(byNs, null, 2));
process.stderr.write(`\n[info] extracted ${Object.keys(keys).length} keys across ${Object.keys(byNs).length} namespaces from ${files.length} files\n`);

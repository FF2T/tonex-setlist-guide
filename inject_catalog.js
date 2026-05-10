#!/usr/bin/env node
// OBSOLETE depuis Phase 1 — Vite gère l'import via ES modules.
// Conservé pour mémoire / éventuel rollback. À supprimer après stabilisation.
// Injecte PRESET_CATALOG_FULL dans ToneX_Setlist_Guide.html
const fs = require('fs');
const path = require('path');

const HTML_FILE = path.join(__dirname, 'ToneX_Setlist_Guide.html');
const CAT_FILE  = path.join(__dirname, 'preset_catalog_full.js');

let html = fs.readFileSync(HTML_FILE, 'utf8');
let catalog = fs.readFileSync(CAT_FILE, 'utf8');

// Remove count comment at end and final newline
catalog = catalog.replace(/\/\/ \d+ presets total\s*$/, '').trimEnd();

// 1. Remove existing PRESET_CATALOG_FULL block if present
html = html.replace(/\n\/\/ ─── Catalogue complet.*?^const PRESET_CATALOG_FULL = \{[\s\S]*?^};/m, '');

// 2. Find insertion point: just before "// ─── Contexte musical"
const insertMarker = '// ─── Contexte musical par ampli';
if (!html.includes(insertMarker)) {
  console.error('Marker not found!'); process.exit(1);
}

const insertion = `\n// ─── Catalogue complet (auto-généré depuis les packs TSR/ML) ─────────────────\n${catalog}\n\n`;
html = html.replace(insertMarker, insertion + insertMarker);

// 3. In PresetBrowser, replace Object.entries(PRESET_CATALOG) with PRESET_CATALOG_FULL
// Only in the PresetBrowser function
html = html.replace(
  /function PresetBrowser\(\{banksAnn,banksPlug\}\)([\s\S]*?)^function /m,
  (match) => match.replace(/Object\.entries\(PRESET_CATALOG\)/g, 'Object.entries(PRESET_CATALOG_FULL)')
);

// Also update the random button count reference
html = html.replace(
  /Object\.keys\(PRESET_CATALOG\)\.length/g,
  (match, offset) => {
    // Only replace inside PresetBrowser context (after PRESET_CATALOG_FULL definition)
    return 'Object.keys(PRESET_CATALOG_FULL).length';
  }
);

// 4. Update SRC_OPTS to add new sources
html = html.replace(
  'const SRC_OPTS={all:"Toutes sources",TSR:"TSR Pack",ML:"ML Sound Lab",AA:"Factory Anniversary",TJ:"Factory ToneJunkie",custom:"Custom"};',
  'const SRC_OPTS={all:"Toutes sources",TSR:"TSR Pack",ML:"ML Sound Lab",AA:"Factory Anniversary",TJ:"Factory ToneJunkie",custom:"Custom"};'
);

fs.writeFileSync(HTML_FILE, html, 'utf8');
const presetCount = (catalog.match(/^\s*"/mg) || []).length;
console.log(`✅ ${presetCount} presets injectés dans ToneX_Setlist_Guide.html`);
console.log(`   Taille finale : ${(fs.statSync(HTML_FILE).size / 1024).toFixed(0)}KB`);

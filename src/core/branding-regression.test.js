// Tests Phase 5.2 — régression sur le rebrand. Vérifie qu'il ne reste
// AUCUNE occurrence "ToneX Poweruser" ou "ToneX Setlist Guide" hors
// du commentaire historique de branding.js.
//
// Note : ce test ne charge PAS le bundle dist/ (qui peut être absent
// si on lance les tests sur CI sans build préalable). Il scanne les
// sources, qui sont la source de vérité avant build.

import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.resolve(__dirname, '..');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // skip dist, node_modules, build artefacts
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walk(full, files);
    } else if (/\.(jsx?|tsx?|html|css|md)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

describe('Phase 5.2 rebrand — régression', () => {
  const files = walk(SRC_ROOT);

  test('aucun "ToneX Poweruser" dans les sources (sauf branding.js commentaire historique)', () => {
    const offenders = [];
    for (const f of files) {
      const content = fs.readFileSync(f, 'utf8');
      if (!content.includes('ToneX Poweruser')) continue;
      // branding.js a une mention historique acceptée.
      if (f.endsWith('branding.js') || f.endsWith('branding.test.js')) continue;
      // Ce fichier (test régression) lui-même mentionne le terme.
      if (f.endsWith('branding-regression.test.js')) continue;
      offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });

  test('aucun "ToneX Setlist Guide" hors mention historique branding', () => {
    const offenders = [];
    for (const f of files) {
      const content = fs.readFileSync(f, 'utf8');
      if (!content.includes('ToneX Setlist Guide')) continue;
      if (f.endsWith('branding.js') || f.endsWith('branding-regression.test.js')) continue;
      offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });

  test('aucun "ToneX Superuser" (variant orthographe) en source', () => {
    const offenders = [];
    for (const f of files) {
      const content = fs.readFileSync(f, 'utf8');
      if (!content.includes('ToneX Superuser')) continue;
      if (f.endsWith('branding-regression.test.js')) continue;
      offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });
});

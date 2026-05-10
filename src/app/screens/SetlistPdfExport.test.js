// Tests Phase 5 (Item K) — exportSetlistPdf.
// Le rendu PDF lui-même est dur à tester unitairement (binaire opaque).
// On vérifie que :
// - aucune erreur n'est levée pour les cas courants ;
// - les helpers (findPresetLocation, summarizeTMPChain, truncate)
//   se comportent comme prévu ;
// - une setlist vide produit un PDF (pas de crash).

import { describe, test, expect } from 'vitest';
import {
  exportSetlistPdf,
  findPresetLocation,
  summarizeTMPChain,
  truncate,
} from './SetlistPdfExport.js';
import { ROCK_PRESET } from '../../devices/tonemaster-pro/catalog.js';

describe('truncate', () => {
  test('chaîne courte → inchangée', () => {
    expect(truncate('foo', 10)).toBe('foo');
  });
  test('chaîne longue → tronquée + ellipse', () => {
    expect(truncate('abcdefghij', 5)).toBe('abcd…');
  });
  test('vide → ""', () => {
    expect(truncate(null, 10)).toBe('');
    expect(truncate(undefined, 10)).toBe('');
  });
});

describe('findPresetLocation', () => {
  const banks = {
    3: { A: 'Clean A', B: 'Drive B', C: 'Lead C' },
  };
  test('exact match', () => {
    expect(findPresetLocation('Drive B', banks)).toEqual({ bank: 3, slot: 'B' });
  });
  test('introuvable → null', () => {
    expect(findPresetLocation('Inexistant', banks)).toBe(null);
  });
  test('vide → null', () => {
    expect(findPresetLocation('', banks)).toBe(null);
    expect(findPresetLocation(null, banks)).toBe(null);
  });
});

describe('summarizeTMPChain', () => {
  test('rock_preset → mention Plexi + Greenback + Drive', () => {
    const s = summarizeTMPChain(ROCK_PRESET);
    expect(s).toContain('Plexi');
    expect(s).toContain('Greenback');
    expect(s).toContain('+Drive');
  });
  test('patch null → ""', () => {
    expect(summarizeTMPChain(null)).toBe('');
  });
});

describe('exportSetlistPdf — Phase 5 Item K', () => {
  const ctx = {
    profile: { enabledDevices: ['tonex-pedal', 'tonemaster-pro'] },
    banksAnn: { 3: { A: 'Clean', B: 'Drive', C: 'Lead' } },
    banksPlug: {},
  };

  test('setlist vide → PDF généré sans crash', () => {
    expect(() => exportSetlistPdf({ name: 'Empty', songIds: [] }, [], ctx)).not.toThrow();
    const doc = exportSetlistPdf({ name: 'Empty', songIds: [] }, [], ctx);
    expect(doc).toBeDefined();
    expect(typeof doc.save).toBe('function');
    expect(typeof doc.output).toBe('function');
  });

  test('setlist avec 1 morceau sans aiCache → PDF généré sans crash', () => {
    const songs = [{ id: 'x', title: 'Test Song', artist: 'Test Artist', bpm: 120, key: 'A' }];
    expect(() => exportSetlistPdf({ name: 'Test', songIds: ['x'] }, songs, ctx)).not.toThrow();
  });

  test('setlist avec morceau seed (avec ig + bpm) → render avec bonnes infos', () => {
    const songs = [{
      id: 'acdc_hth',
      title: 'Highway to Hell',
      artist: 'AC/DC',
      bpm: 116,
      key: 'A',
      aiCache: {
        result: {
          ideal_guitar: 'Gibson SG Custom (ébène)',
          cot_step2_guitars: [{ name: 'SG', score: 92 }],
          preset_ann: { label: 'Drive', score: 92 },
        },
      },
    }];
    expect(() => exportSetlistPdf({ name: 'AC/DC' }, songs, ctx)).not.toThrow();
  });

  test('setlist avec 5 morceaux → produit un PDF avec ≥5 pages (1 garde + 5 morceaux)', () => {
    const songs = Array.from({ length: 5 }, (_, i) => ({
      id: `s${i}`, title: `Song ${i}`, artist: `Artist ${i}`,
    }));
    const doc = exportSetlistPdf({ name: 'Big' }, songs, ctx);
    // jsPDF : doc.internal.pages est un array (index 0 = filler).
    const numPages = doc.internal.pages.length - 1;
    expect(numPages).toBeGreaterThanOrEqual(6); // garde + 5 morceaux
  });

  test('songs/ctx non-array → defensive (no throw)', () => {
    expect(() => exportSetlistPdf({ name: 'X' }, null, ctx)).not.toThrow();
    expect(() => exportSetlistPdf({ name: 'X' }, undefined, ctx)).not.toThrow();
  });

  test('output() retourne un type valide', () => {
    const doc = exportSetlistPdf({ name: 'X' }, [], ctx);
    const out = doc.output('blob');
    // En env Node (sans vraie API DOM Blob), jsPDF utilise un polyfill.
    expect(out).toBeDefined();
  });
});

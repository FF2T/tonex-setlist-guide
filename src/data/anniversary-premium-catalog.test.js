// src/data/anniversary-premium-catalog.test.js — Phase 7.52.
//
// Vérifie la structure du catalog Anniversary Premium (150 captures
// signées par 5 créateurs externes) + régression sur le merge dans
// PRESET_CATALOG_MERGED (override des entrées legacy d'ANNIVERSARY_CATALOG
// dans data_catalogs.js).

import { describe, it, expect } from 'vitest';
import { ANNIVERSARY_PREMIUM_CATALOG } from './anniversary-premium-catalog.js';
import { PRESET_CATALOG_MERGED, findCatalogEntry } from '../core/catalog.js';
import { FACTORY_CATALOG } from './data_catalogs.js';

const PACK_NAMES = [
  'Amalgam Audio',
  'Jason Sadites',
  'Tone Junkie TV',
  'The Studio Rats Anniversary',
  'Worship Tutorials',
];

const VALID_CHARACTERS = ['Clean', 'Drive', 'Hi-Gain'];
const VALID_GAINS = ['low', 'mid', 'high'];
const VALID_STYLES = ['blues', 'rock', 'hard_rock', 'jazz', 'metal', 'pop'];

describe('ANNIVERSARY_PREMIUM_CATALOG — structure globale', () => {
  it('contient exactement 150 entrées', () => {
    expect(Object.keys(ANNIVERSARY_PREMIUM_CATALOG).length).toBe(150);
  });

  it('répartit 30 entrées par pack créateur (5 packs)', () => {
    const counts = {};
    for (const v of Object.values(ANNIVERSARY_PREMIUM_CATALOG)) {
      counts[v.packName] = (counts[v.packName] || 0) + 1;
    }
    for (const pack of PACK_NAMES) {
      expect(counts[pack]).toBe(30);
    }
    expect(Object.keys(counts).length).toBe(5);
  });
});

describe('ANNIVERSARY_PREMIUM_CATALOG — validation par entrée', () => {
  for (const [key, entry] of Object.entries(ANNIVERSARY_PREMIUM_CATALOG)) {
    it(`"${key}" a une structure valide`, () => {
      expect(entry.name).toBe(key);
      expect(typeof entry.toneModelName).toBe('string');
      expect(entry.toneModelName.length).toBeGreaterThan(0);
      expect(PACK_NAMES).toContain(entry.packName);
      expect(VALID_CHARACTERS).toContain(entry.character);
      expect(typeof entry.stomp).toBe('string');
      expect(typeof entry.amp).toBe('string');
      expect(entry.amp.length).toBeGreaterThan(0);
      expect(typeof entry.cab).toBe('string');
      expect(VALID_GAINS).toContain(entry.gain);
      expect(VALID_STYLES).toContain(entry.style);
      expect(entry.src).toBe('Anniversary');
      // scores dans [0, 100]
      for (const pickup of ['HB', 'SC', 'P90']) {
        expect(typeof entry.scores[pickup]).toBe('number');
        expect(entry.scores[pickup]).toBeGreaterThanOrEqual(0);
        expect(entry.scores[pickup]).toBeLessThanOrEqual(100);
      }
      // usages optionnel mais si présent → Array de {artist, songs?}
      if (entry.usages !== undefined) {
        expect(Array.isArray(entry.usages)).toBe(true);
        for (const u of entry.usages) {
          expect(typeof u.artist).toBe('string');
          if (u.songs !== undefined) {
            expect(Array.isArray(u.songs)).toBe(true);
          }
        }
      }
    });
  }
});

describe('Phase 7.52 — merge dans PRESET_CATALOG_MERGED', () => {
  it("findCatalogEntry retourne l'entrée curée (pas le legacy data_catalogs)", () => {
    // L'entrée legacy avait scores HB:82/SC:74/P90:82. La curée Phase 7.52
    // a HB:96/SC:78/P90:86 (Schaffer + JTM-50 = AC/DC). Le spread du catalog
    // doit override.
    const entry = findCatalogEntry('AA MRSH JT50 I Drive BAL SCH CAB');
    expect(entry).toBeTruthy();
    expect(entry.scores.HB).toBe(96);
    expect(entry.scores.SC).toBe(78);
    expect(entry.scores.P90).toBe(86);
    expect(entry.src).toBe('Anniversary');
    expect(entry.packName).toBe('Amalgam Audio');
    expect(entry.usages?.[0]?.artist).toBe('AC/DC');
  });

  it('toutes les 150 clés sont accessibles via PRESET_CATALOG_MERGED', () => {
    for (const key of Object.keys(ANNIVERSARY_PREMIUM_CATALOG)) {
      const merged = PRESET_CATALOG_MERGED[key];
      expect(merged, `Missing key in merged: ${key}`).toBeTruthy();
      // Le packName est la marque distinctive du curé Phase 7.52
      // (absent du legacy ANNIVERSARY_CATALOG dans data_catalogs.js).
      expect(merged.packName).toBeTruthy();
    }
  });
});

describe('Phase 7.52 — pas de collision avec FACTORY_CATALOG', () => {
  it("aucune clé du catalog Anniversary Premium ne collisionne avec FACTORY_CATALOG", () => {
    const annKeys = new Set(Object.keys(ANNIVERSARY_PREMIUM_CATALOG));
    const factoryKeys = Object.keys(FACTORY_CATALOG);
    const collisions = factoryKeys.filter((k) => annKeys.has(k));
    expect(collisions).toEqual([]);
  });
});

describe('Phase 7.52 — distribution gain/style cohérente', () => {
  it("au moins 20 entrées par gain", () => {
    const counts = { low: 0, mid: 0, high: 0 };
    for (const v of Object.values(ANNIVERSARY_PREMIUM_CATALOG)) {
      counts[v.gain]++;
    }
    expect(counts.low).toBeGreaterThanOrEqual(20);
    expect(counts.mid).toBeGreaterThanOrEqual(20);
    expect(counts.high).toBeGreaterThanOrEqual(20);
  });

  it("au moins 1 entrée pour chaque style supporté", () => {
    const counts = {};
    for (const v of Object.values(ANNIVERSARY_PREMIUM_CATALOG)) {
      counts[v.style] = (counts[v.style] || 0) + 1;
    }
    // blues, rock, hard_rock, metal, pop, jazz devraient tous avoir au moins 1.
    for (const style of VALID_STYLES) {
      expect(counts[style] ?? 0, `style manquant: ${style}`).toBeGreaterThan(0);
    }
  });
});

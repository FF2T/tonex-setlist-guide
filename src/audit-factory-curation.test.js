// Audit Phase 7.77 — Test de régression sur la cohérence du catalog factory.
//
// Tous les presets pré-installés via firmware (Pedal v2, Anniversary, Plug)
// doivent avoir une entry dans le catalog Backline (status='known' ou
// 'curated-admin'). Un status='unknown' indique un mismatch entre le nom
// du preset dans les FACTORY_BANKS et le nom de la key dans le
// FACTORY_CATALOG correspondant.
//
// Pedal v1 reste vide intentionnellement (liste à fournir, cf
// CLAUDE.md Phase 7.47). Skippé.

import { describe, test, expect } from 'vitest';
import { FACTORY_BANKS_PEDALE_V2 } from './devices/tonex-pedal/catalog.js';
import { FACTORY_BANKS_ANNIVERSARY } from './devices/tonex-anniversary/catalog.js';
import { FACTORY_BANKS_PLUG } from './devices/tonex-plug/catalog.js';
import { getPresetCurationStatus } from './core/catalog.js';

function collectPresets(banks) {
  const names = new Set();
  Object.values(banks || {}).forEach((b) => ['A', 'B', 'C'].forEach((s) => {
    if (b?.[s]) names.add(b[s]);
  }));
  return Array.from(names);
}

const buckets = [
  { device: 'Pedal v2', banks: FACTORY_BANKS_PEDALE_V2 },
  { device: 'Anniversary', banks: FACTORY_BANKS_ANNIVERSARY },
  { device: 'Plug', banks: FACTORY_BANKS_PLUG },
];

describe('Phase 7.77 — Cohérence catalog factory (aucun preset 🔴 unknown)', () => {
  buckets.forEach(({ device, banks }) => {
    test(`${device} : tous les presets factory ont une entry catalog (≥ 🟠 known)`, () => {
      const names = collectPresets(banks);
      const unknowns = names.filter((n) => getPresetCurationStatus(n) === 'unknown');
      if (unknowns.length > 0) {
        console.log(`\n🔴 ${device} UNKNOWNS (${unknowns.length}):`);
        unknowns.forEach((n) => console.log(`   - "${n}"`));
      }
      expect(unknowns).toEqual([]);
    });
  });
});

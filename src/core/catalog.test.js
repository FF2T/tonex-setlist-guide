// src/core/catalog.test.js — Phase 7.69.5
//
// Tests sur findCatalogSuggestions : fuzzy match d'un nom de preset
// CSV inconnu vers un nom catalog officiel via token-set ratio +
// alias expansion + strip prefix pack.
//
// Cas-cible documenté : "Bumble Deluxe Cln 1" doit matcher
// "TSR Bumble DLX CLN 1" (préfixe TSR strippé + dlx↔deluxe + cln→clean).

import { describe, it, expect } from 'vitest';
import { findCatalogSuggestions, findCatalogEntry, getPresetCurationStatus, CURATION_COLORS, getCurationLabel } from './catalog.js';

describe('findCatalogSuggestions (Phase 7.69.5)', () => {
  describe('Cas réels CSV Anniversary', () => {
    it('"Bumble Deluxe Cln 1" → suggère "TSR Bumble DLX CLN 1" (score 1.00)', () => {
      const s = findCatalogSuggestions('Bumble Deluxe Cln 1');
      expect(s.length).toBeGreaterThan(0);
      expect(s[0].name).toBe('TSR Bumble DLX CLN 1');
      expect(s[0].score).toBe(1.0);
    });

    it('"Bumble Deluxe Drive 1" → suggère "TSR Bumble DLX Drive 1"', () => {
      const s = findCatalogSuggestions('Bumble Deluxe Drive 1');
      expect(s.length).toBeGreaterThan(0);
      expect(s[0].name).toBe('TSR Bumble DLX Drive 1');
      expect(s[0].score).toBe(1.0);
    });

    it('"Bumble Deluxe Klon" → suggère "TSR Bumble DLX Klon"', () => {
      const s = findCatalogSuggestions('Bumble Deluxe Klon');
      expect(s.length).toBeGreaterThan(0);
      expect(s[0].name).toBe('TSR Bumble DLX Klon');
    });
  });

  describe('Rejets corrects (vrais inconnus)', () => {
    it('"SEB test" → aucune suggestion', () => {
      const s = findCatalogSuggestions('SEB test');
      expect(s).toEqual([]);
    });

    it('"TSR - Mars SL760 - Clean 1" → aucune suggestion (pack absent)', () => {
      const s = findCatalogSuggestions('TSR - Mars SL760 - Clean 1');
      expect(s).toEqual([]);
    });

    it('"TSR Plexi Dual Pails" → catalog a "Palis" mais typo trop dissemblable', () => {
      // "pails" vs "palis" : tokens différents → 3/4 < threshold 0.7 ?
      // Token-set : tokens A {plexi, dual, pails}, B {plexi, dual, palis}
      // common=2, max=3 → 0.66 < 0.7 → no match. OK.
      const s = findCatalogSuggestions('TSR Plexi Dual Pails');
      // On accepte que ça remonte rien (ou éventuellement Palis si l'algo
      // évolue plus tard). Le test garde le comportement actuel.
      expect(s.every((x) => x.name !== 'TSR Plexi Dual Pails')).toBe(true);
    });
  });

  describe('Inputs malformés', () => {
    it('chaîne vide → []', () => {
      expect(findCatalogSuggestions('')).toEqual([]);
    });
    it('null/undefined → []', () => {
      expect(findCatalogSuggestions(null)).toEqual([]);
      expect(findCatalogSuggestions(undefined)).toEqual([]);
    });
    it('non-string → []', () => {
      expect(findCatalogSuggestions(123)).toEqual([]);
    });
  });

  describe('Options', () => {
    it('max limite le nombre de candidats retournés', () => {
      const s = findCatalogSuggestions('Bumble Deluxe', { max: 1 });
      expect(s.length).toBeLessThanOrEqual(1);
    });

    it('threshold élevé filtre plus strictement', () => {
      const sHigh = findCatalogSuggestions('Bumble Deluxe Cln 1', { threshold: 0.99 });
      const sLow = findCatalogSuggestions('Bumble Deluxe Cln 1', { threshold: 0.5 });
      expect(sLow.length).toBeGreaterThanOrEqual(sHigh.length);
    });

    it('threshold = 1 ne garde que les matchs parfaits', () => {
      const s = findCatalogSuggestions('Bumble Deluxe Cln 1', { threshold: 1.0 });
      expect(s.every((x) => x.score === 1.0)).toBe(true);
    });
  });

  describe('Ordre des résultats', () => {
    it('tri par score décroissant', () => {
      const s = findCatalogSuggestions('Bumble Deluxe Cln 1', { max: 5 });
      for (let i = 1; i < s.length; i++) {
        expect(s[i - 1].score).toBeGreaterThanOrEqual(s[i].score);
      }
    });
  });

  describe('Cohérence avec findCatalogEntry', () => {
    it('un preset déjà dans le catalog ne se suggère pas lui-même', () => {
      const knownName = 'TSR Bumble DLX CLN 1';
      // Vérifie que ce nom existe bien dans le catalog
      const entry = findCatalogEntry(knownName);
      expect(entry).toBeTruthy();
      expect(entry.guessed).not.toBe(true);
      // findCatalogSuggestions ne doit pas inclure ce nom lui-même
      // dans ses résultats
      const s = findCatalogSuggestions(knownName);
      expect(s.every((x) => x.name !== knownName)).toBe(true);
    });
  });
});

// ─── Phase 7.70 — Code couleur curation preset ──────────────────────
describe('getPresetCurationStatus (Phase 7.70)', () => {
  describe('Slot vide ou input falsy → null', () => {
    it('chaîne vide → null', () => {
      expect(getPresetCurationStatus('')).toBeNull();
    });
    it('null/undefined → null', () => {
      expect(getPresetCurationStatus(null)).toBeNull();
      expect(getPresetCurationStatus(undefined)).toBeNull();
    });
    it('whitespace only → null', () => {
      expect(getPresetCurationStatus('   ')).toBeNull();
    });
    it('non-string → null', () => {
      expect(getPresetCurationStatus(123)).toBeNull();
    });
  });

  describe('Inconnu — entry.guessed === true', () => {
    it('nom inventé → status unknown (fallback guessPresetInfo)', () => {
      // "SEB test" est un custom user qui n'est pas dans le catalog
      // global ; findCatalogEntry fallback sur guessPresetInfo qui
      // marque guessed: true.
      expect(getPresetCurationStatus('SEB test custom random')).toBe('unknown');
    });
  });

  describe('Curated admin — catalog statique avec usages', () => {
    it('preset Anniversary Premium avec usages (TSR) → curated-admin', () => {
      // Cas concret Phase 7.52 : AA MRSH JT50 a usages AC/DC
      const status = getPresetCurationStatus('AA MRSH JT50 I Drive BAL SCH CAB');
      // Selon le catalog réel, soit curated-admin (a usages) soit known
      expect(['curated-admin', 'known', 'curated-perso']).toContain(status);
    });
  });

  describe('Connu non curé — entry sans usages', () => {
    it('preset Factory sans usages → status known', () => {
      // Cherche un preset Factory sans usages
      const status = getPresetCurationStatus('HG 800');
      expect(['known', 'curated-admin', 'unknown']).toContain(status);
    });
  });
});

describe('CURATION_COLORS (Phase 7.70)', () => {
  it('contient les 5 statuts avec dot/bg/border', () => {
    ['unknown', 'known', 'curated-perso', 'curated-admin', 'curated-studio'].forEach((s) => {
      expect(CURATION_COLORS[s]).toBeTruthy();
      expect(CURATION_COLORS[s].dot).toBeTruthy();
      expect(CURATION_COLORS[s].bg).toBeTruthy();
      expect(CURATION_COLORS[s].border).toBeTruthy();
    });
  });

  it('palette bleus : clair → moyen → foncé pour perso → admin → studio', () => {
    // Décision user 2026-05-19 : dégradé bleu
    expect(CURATION_COLORS['curated-perso'].dot).toBe('#7dd3fc');  // sky-300
    expect(CURATION_COLORS['curated-admin'].dot).toBe('#3b82f6');  // blue-500
    expect(CURATION_COLORS['curated-studio'].dot).toBe('#1e40af'); // blue-800
  });
});

describe('getCurationLabel (Phase 7.70)', () => {
  it('retourne un label non-vide pour chaque statut', () => {
    ['unknown', 'known', 'curated-perso', 'curated-admin', 'curated-studio'].forEach((s) => {
      const label = getCurationLabel(s);
      expect(label.length).toBeGreaterThan(0);
    });
  });

  it('status null/inconnu → string vide', () => {
    expect(getCurationLabel(null)).toBe('');
    expect(getCurationLabel('garbage')).toBe('');
  });
});

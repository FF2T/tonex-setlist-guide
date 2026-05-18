// src/app/utils/display-guitar.test.js — Phase 7.65
//
// Couvre `resolveDisplayGuitar` :
//   - ideal_guitar matche le rig (Étape 1)
//   - ideal_guitar hors rig → bascule sur cot_step2 dans le rig (Étape 2)
//   - aiCache vide / cot_step2 hors rig → fallback rig[0] (Étape 3)
//   - rig vide
//   - option fallbackToFirst:false (Phase 7.32 comportement)
//   - scénario bug Bruno : "Strat AM Vintage II 61" dans aiC sur rig HB-only

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolveDisplayGuitar, filterCotGuitarsToRig } from './display-guitar.js';

const LP60 = { id: 'lp60', name: 'Les Paul Standard 60', short: 'LP 60', type: 'HB', brand: 'Gibson' };
const SG61 = { id: 'sg61', name: 'SG Standard 61', short: 'SG 61', type: 'HB', brand: 'Gibson' };
const STRAT61 = { id: 'strat61', name: 'Strat AM Vintage II 61', short: 'Strat 61', type: 'SC', brand: 'Fender' };
// Guitares custom (hors catalog GUITARS) : besoin de stub window.__allGuitars
// car `findGuitar` (core/guitars.js) y cherche les customs au scoring.
const SCHECTER = { id: 'schecter_c1', name: 'Schecter C-1 Platinum', short: 'Schecter C1', type: 'HB', brand: 'Schecter' };
const IBANEZ = { id: 'ibanez_gio', name: 'Ibanez Gio miKro GRGM21', short: 'Ibanez Gio', type: 'HB', brand: 'Ibanez' };

beforeAll(() => {
  if (typeof globalThis.window === 'undefined') {
    globalThis.window = { __allGuitars: [SCHECTER, IBANEZ] };
  } else {
    globalThis.window.__allGuitars = [SCHECTER, IBANEZ];
  }
});

afterAll(() => {
  if (globalThis.window && '__allGuitars' in globalThis.window) {
    delete globalThis.window.__allGuitars;
  }
});

describe('resolveDisplayGuitar', () => {
  describe('Étape 1 — ideal_guitar matche le rig', () => {
    it('retourne la guitare ideal_guitar quand elle est dans le rig', () => {
      const aiC = {
        ideal_guitar: 'Les Paul Standard 60',
        cot_step2_guitars: [
          { name: 'Les Paul Standard 60', score: 95, reason: 'HB power' },
          { name: 'SG Standard 61', score: 88 },
        ],
      };
      const result = resolveDisplayGuitar(aiC, [LP60, SG61]);
      expect(result.guitar).toEqual(LP60);
      expect(result.score).toBe(95);
      expect(result.source).toBe('ideal');
    });

    it('match short name aussi (matchGuitarName flexible)', () => {
      const aiC = {
        ideal_guitar: 'SG 61',
        cot_step2_guitars: [{ name: 'SG Standard 61', score: 91 }],
      };
      const result = resolveDisplayGuitar(aiC, [LP60, SG61]);
      expect(result.guitar).toEqual(SG61);
      expect(result.source).toBe('ideal');
      expect(result.score).toBe(91);
    });

    it('fallback localGuitarSongScore si pas de cot entry pour la ideal_guitar', () => {
      const aiC = {
        ideal_guitar: 'Les Paul Standard 60',
        // cot_step2 ne contient pas LP60.
        cot_step2_guitars: [{ name: 'SG Standard 61', score: 88 }],
        pickup_preference: 'HB',
        target_gain: 6,
        song_style: 'rock',
      };
      const result = resolveDisplayGuitar(aiC, [LP60, SG61]);
      expect(result.guitar).toEqual(LP60);
      expect(result.source).toBe('ideal');
      // localGuitarSongScore renvoie un nombre entre 30 et 99.
      expect(typeof result.score).toBe('number');
      expect(result.score).toBeGreaterThanOrEqual(30);
      expect(result.score).toBeLessThanOrEqual(99);
    });
  });

  describe('Étape 2 — ideal_guitar hors rig → cot_step2', () => {
    it('scénario bug Bruno : ideal_guitar Strat sur rig HB-only → cot_step2 match', () => {
      // Bug observé : pour "The Final Countdown" sur le profil Bruno
      // (rig = Schecter HB + Ibanez HB), l'aiCache (issu de l'union all-rigs
      // Phase 3.6) propose Strat AM Vintage II 61 (SC). Avant Phase 7.65,
      // la vue repliée affichait cette guitare hors rig. Maintenant on
      // bascule sur le premier cot_step2 dans le rig.
      const aiC = {
        ideal_guitar: 'Strat AM Vintage II 61',
        cot_step2_guitars: [
          { name: 'Strat AM Vintage II 61', score: 92 },
          { name: 'Schecter C-1 Platinum', score: 85, reason: 'HB compense' },
          { name: 'Ibanez Gio miKro GRGM21', score: 72 },
        ],
      };
      const result = resolveDisplayGuitar(aiC, [SCHECTER, IBANEZ]);
      expect(result.guitar).toEqual(SCHECTER);
      expect(result.score).toBe(85);
      expect(result.source).toBe('cot');
    });

    it('retourne la première cot_step2 entry dans le rig (ordre préférence IA)', () => {
      const aiC = {
        cot_step2_guitars: [
          { name: 'Les Paul Standard 60', score: 95 }, // hors rig
          { name: 'SG Standard 61', score: 88 },       // dans rig
          { name: 'Strat AM Vintage II 61', score: 80 }, // hors rig
        ],
      };
      const result = resolveDisplayGuitar(aiC, [SG61]);
      expect(result.guitar).toEqual(SG61);
      expect(result.score).toBe(88);
      expect(result.source).toBe('cot');
    });
  });

  describe('Étape 3 — fallback rig[0]', () => {
    it('aiCache vide → première guitare du rig (fallbackToFirst default true)', () => {
      const result = resolveDisplayGuitar(null, [SCHECTER, IBANEZ]);
      expect(result.guitar).toEqual(SCHECTER);
      expect(result.source).toBe('fallback');
      // localGuitarSongScore renvoie null quand aiC est null/undefined.
      // Acceptable : la vue affiche le badge sans score.
      expect(result.score).toBeNull();
    });

    it('cot_step2 toutes hors rig → fallback rig[0]', () => {
      const aiC = {
        ideal_guitar: 'Les Paul Standard 60',
        cot_step2_guitars: [
          { name: 'Les Paul Standard 60', score: 95 },
          { name: 'Strat AM Vintage II 61', score: 90 },
        ],
      };
      const result = resolveDisplayGuitar(aiC, [SCHECTER, IBANEZ]);
      expect(result.guitar).toEqual(SCHECTER);
      expect(result.source).toBe('fallback');
    });

    it('aiC.cot_step2_guitars absent → fallback rig[0]', () => {
      const result = resolveDisplayGuitar({ song_style: 'rock' }, [SCHECTER, IBANEZ]);
      expect(result.guitar).toEqual(SCHECTER);
      expect(result.source).toBe('fallback');
    });
  });

  describe('option fallbackToFirst:false (comportement SongDetailCard Phase 7.32)', () => {
    it('rien matche le rig → retourne null au lieu de fallback', () => {
      const aiC = {
        ideal_guitar: 'Les Paul Standard 60',
        cot_step2_guitars: [
          { name: 'Les Paul Standard 60', score: 95 },
          { name: 'Strat AM Vintage II 61', score: 90 },
        ],
      };
      const result = resolveDisplayGuitar(aiC, [SCHECTER, IBANEZ], { fallbackToFirst: false });
      expect(result.guitar).toBeNull();
      expect(result.score).toBeNull();
      expect(result.source).toBeNull();
    });

    it('aiCache vide → null (au lieu de rig[0])', () => {
      const result = resolveDisplayGuitar(null, [SCHECTER, IBANEZ], { fallbackToFirst: false });
      expect(result.guitar).toBeNull();
    });

    it('match Étape 1 fonctionne quand même', () => {
      const aiC = {
        ideal_guitar: 'Schecter C-1 Platinum',
        cot_step2_guitars: [{ name: 'Schecter C-1 Platinum', score: 90 }],
      };
      const result = resolveDisplayGuitar(aiC, [SCHECTER, IBANEZ], { fallbackToFirst: false });
      expect(result.guitar).toEqual(SCHECTER);
      expect(result.source).toBe('ideal');
      expect(result.score).toBe(90);
    });
  });

  describe('Edge cases', () => {
    it('rig vide → null partout', () => {
      const aiC = { ideal_guitar: 'Les Paul', cot_step2_guitars: [{ name: 'Les Paul', score: 90 }] };
      expect(resolveDisplayGuitar(aiC, [])).toEqual({ guitar: null, score: null, source: null });
      expect(resolveDisplayGuitar(aiC, [], { fallbackToFirst: false })).toEqual({ guitar: null, score: null, source: null });
    });

    it('rigGuitars null/undefined → null', () => {
      expect(resolveDisplayGuitar({ ideal_guitar: 'X' }, null).guitar).toBeNull();
      expect(resolveDisplayGuitar({ ideal_guitar: 'X' }, undefined).guitar).toBeNull();
    });

    it('cot_step2 entries malformées (sans name) sont ignorées', () => {
      const aiC = {
        cot_step2_guitars: [
          { score: 95 },               // pas de name
          null,                         // null entry
          { name: '', score: 90 },     // name vide
          { name: 'Schecter C-1 Platinum', score: 85 },
        ],
      };
      const result = resolveDisplayGuitar(aiC, [SCHECTER]);
      expect(result.guitar).toEqual(SCHECTER);
      expect(result.source).toBe('cot');
      expect(result.score).toBe(85);
    });

    it('cot entry score 0 conservé (pas évacué par fallback)', () => {
      const aiC = {
        cot_step2_guitars: [{ name: 'Schecter C-1 Platinum', score: 0 }],
      };
      const result = resolveDisplayGuitar(aiC, [SCHECTER]);
      expect(result.guitar).toEqual(SCHECTER);
      expect(result.score).toBe(0);
      expect(result.source).toBe('cot');
    });
  });
});

describe('filterCotGuitarsToRig', () => {
  it('scénario bug Bruno : filtre les guitares hors rig', () => {
    // Cas réel observé sur SongDetailCard onglet Raisonnement IA :
    // Bruno (rig HB-only Schecter + Ibanez) voyait Strat AM Vintage II 61
    // 92% + Les Paul Standard 60 85% + Schecter 78%. Après Phase 7.65.1,
    // ne reste que Schecter.
    const cotList = [
      { name: 'Strat AM Vintage II 61', score: 92, reason: 'Hendrix' },
      { name: 'Les Paul Standard 60', score: 85, reason: 'HB power' },
      { name: 'Schecter C-1 Platinum', score: 78, reason: 'Confort solo' },
    ];
    const result = filterCotGuitarsToRig(cotList, [SCHECTER, IBANEZ]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Schecter C-1 Platinum');
    expect(result[0].score).toBe(78);
    expect(result[0].reason).toBe('Confort solo');
  });

  it('préserve l\'ordre IA quand plusieurs entrées matchent le rig', () => {
    const cotList = [
      { name: 'Les Paul Standard 60', score: 95 },
      { name: 'Strat AM Vintage II 61', score: 88 }, // hors rig
      { name: 'SG Standard 61', score: 82 },
    ];
    const result = filterCotGuitarsToRig(cotList, [LP60, SG61]);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Les Paul Standard 60');
    expect(result[1].name).toBe('SG Standard 61');
  });

  it('toutes hors rig → retourne []', () => {
    const cotList = [
      { name: 'Les Paul Standard 60', score: 95 },
      { name: 'Strat AM Vintage II 61', score: 88 },
    ];
    expect(filterCotGuitarsToRig(cotList, [SCHECTER])).toEqual([]);
  });

  it('cotList vide / null / undefined → []', () => {
    expect(filterCotGuitarsToRig([], [LP60])).toEqual([]);
    expect(filterCotGuitarsToRig(null, [LP60])).toEqual([]);
    expect(filterCotGuitarsToRig(undefined, [LP60])).toEqual([]);
  });

  it('rigGuitars vide / null → []', () => {
    const cotList = [{ name: 'Les Paul', score: 90 }];
    expect(filterCotGuitarsToRig(cotList, [])).toEqual([]);
    expect(filterCotGuitarsToRig(cotList, null)).toEqual([]);
  });

  it('entries malformées ignorées (pas de name / null / name vide)', () => {
    const cotList = [
      { score: 95 },
      null,
      { name: '', score: 90 },
      { name: 'Les Paul Standard 60', score: 85 },
    ];
    const result = filterCotGuitarsToRig(cotList, [LP60]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Les Paul Standard 60');
  });

  it('immutabilité : ne mute pas la liste source', () => {
    const cotList = [
      { name: 'Les Paul Standard 60', score: 95 },
      { name: 'Strat AM Vintage II 61', score: 88 },
    ];
    const originalLength = cotList.length;
    filterCotGuitarsToRig(cotList, [LP60]);
    expect(cotList).toHaveLength(originalLength);
    expect(cotList[0].name).toBe('Les Paul Standard 60');
    expect(cotList[1].name).toBe('Strat AM Vintage II 61');
  });
});

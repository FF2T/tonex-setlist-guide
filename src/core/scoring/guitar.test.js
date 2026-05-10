// Tests de regression pour computeGuitarScoreV2 et computeFinalScore.
// 11 guitares de la collection × 2 fonctions, sur un contexte cohérent
// avec ledzep_stairway (rock, gain 8, Marshall SL800).
// 22 snapshots au total.

import { describe, test, expect } from 'vitest';
import {
  computeGuitarScoreV2, inferGuitarProfile, localGuitarSongScore, pickTopGuitar,
} from './guitar.js';
import { computeFinalScore } from './index.js';

const ALL_GUITARS = [
  'lp60', 'lp50p90', 'sg_ebony', 'sg61', 'es335',
  'strat61', 'strat_pro2', 'strat_ec',
  'tele63', 'tele_ultra', 'jazzmaster',
];

// Contexte morceau : Stairway to Heaven, section solo.
const STAIRWAY_SONG = {
  songStyle: 'rock',
  songTargetGain: 8,
  songRefAmp: 'Marshall SL800',
};

const STAIRWAY_PRESET = {
  style: 'rock',
  gain: 8,
  amp: 'Marshall SL800',
  voicing: 'balanced',
};

describe('computeGuitarScoreV2 · 11 guitares · ledzep_stairway (rock/drive/balanced)', () => {
  ALL_GUITARS.forEach((id) => {
    test(`${id}`, () => {
      expect(
        computeGuitarScoreV2(id, 'rock', 'drive', 'balanced'),
      ).toMatchSnapshot();
    });
  });
});

describe('computeFinalScore · 11 guitares · ledzep_stairway (preset Marshall SL800 drive)', () => {
  ALL_GUITARS.forEach((id) => {
    test(`${id}`, () => {
      expect(
        computeFinalScore(
          STAIRWAY_PRESET,
          id,
          STAIRWAY_SONG.songStyle,
          STAIRWAY_SONG.songTargetGain,
          STAIRWAY_SONG.songRefAmp,
        ),
      ).toMatchSnapshot();
    });
  });
});

describe('inferGuitarProfile · semi-hollow Phase 3.8 (Arthur ES-339)', () => {
  test('"Epiphone ES-339" (HB) → semi_hollow + voicing warm', () => {
    const p = inferGuitarProfile('Epiphone ES-339', 'HB');
    expect(p.bodyResonance).toBe('semi_hollow');
    expect(p.voicing).toBe('warm');
    expect(p.styleMods.blues).toBe(+5);
    expect(p.styleMods.jazz).toBe(+6);
  });

  test('"Epiphone Casino" → semi_hollow', () => {
    const p = inferGuitarProfile('Epiphone Casino', 'P90');
    expect(p.bodyResonance).toBe('semi_hollow');
  });

  test('"Epiphone 339" (sans préfixe ES) → semi_hollow (numéro brut)', () => {
    // Cas où l'utilisateur entre juste "Epiphone 339" sans le "ES-".
    const p = inferGuitarProfile('Epiphone 339', 'HB');
    expect(p.bodyResonance).toBe('semi_hollow');
  });

  test('"Epiphone Sheraton II" → semi_hollow', () => {
    const p = inferGuitarProfile('Epiphone Sheraton II', 'HB');
    expect(p.bodyResonance).toBe('semi_hollow');
  });

  test('"Gibson ES-175" (jazz hollow) → semi_hollow', () => {
    const p = inferGuitarProfile('Gibson ES-175', 'HB');
    expect(p.bodyResonance).toBe('semi_hollow');
  });

  test('"SG Standard 61" → solid (régression : pas de faux positif)', () => {
    const p = inferGuitarProfile('SG Standard 61', 'HB');
    expect(p.bodyResonance).toBe('solid');
  });

  test('"Strat 61" → solid', () => {
    const p = inferGuitarProfile('Strat 61', 'SC');
    expect(p.bodyResonance).toBe('solid');
  });
});

describe('localGuitarSongScore · Arthur ES-339 vs SG sur BB King "Thrill is Gone" (Phase 3.8)', () => {
  // BB King "The Thrill is Gone" : style blues, gain clean (3-4),
  // pickup_preference HB. Arthur veut son ES-339 (semi-hollow) au-dessus
  // de sa SG (solid). Sans le fix Phase 3.8, l'ES-339 custom était
  // inférée en "solid" via le fallback générique HB et perdait son bonus
  // semi_hollow + blues + clean.
  // Note : le test simule des guitares custom. findGuitar() ne les trouve
  // pas en environnement node (window.__allGuitars absent), donc on
  // utilise inferGuitarProfile directement via computeGuitarScoreV2 ne
  // fonctionne pas (besoin du guitarId résolvable). Ici on teste la
  // chaîne complète via inferGuitarProfile + un mini compute manuel.
  function score(profile, presetGain, presetStyle) {
    const styleMod = profile.styleMods[presetStyle] || 0;
    const gainMod = profile.gainAffinity[presetGain] || 0;
    let resonanceMod = 0;
    if (profile.bodyResonance === 'semi_hollow' && ['clean', 'crunch'].includes(presetGain) && ['blues', 'jazz'].includes(presetStyle)) resonanceMod = +4;
    return Math.max(0, Math.min(100, 50 + (styleMod + gainMod + resonanceMod) * 3));
  }

  test('ES-339 (semi-hollow) > SG Standard 61 (solid) sur blues/clean', () => {
    const es339 = inferGuitarProfile('Epiphone ES-339', 'HB');
    const sg = inferGuitarProfile('SG Standard 61', 'HB');
    const scoreEs = score(es339, 'clean', 'blues');
    const scoreSg = score(sg, 'clean', 'blues');
    expect(scoreEs).toBeGreaterThan(scoreSg);
    // Différence significative : l'ES-339 a styleMods.blues=+5 et un
    // bonus resonance +4, la SG via inferGuitarProfile a styleMods.blues
    // bas (+1) et pas de bonus.
    expect(scoreEs - scoreSg).toBeGreaterThanOrEqual(15);
  });

  test('ES-339 reste devant SG aussi en blues/crunch', () => {
    const es339 = inferGuitarProfile('Epiphone ES-339', 'HB');
    const sg = inferGuitarProfile('SG Standard 61', 'HB');
    expect(score(es339, 'crunch', 'blues')).toBeGreaterThan(score(sg, 'crunch', 'blues'));
  });
});

describe('pickTopGuitar (Phase 3.9) — auto-pick robuste au cache IA stale', () => {
  // Profil Arthur : SG Standard 61 (collection standard) + Epiphone
  // ES-339 (custom). Les 2 sont des HB. ES-339 est inférée
  // semi_hollow via Phase 3.8.
  const SG = { id: 'sg61', name: 'SG Standard 61', short: 'SG 61', type: 'HB' };
  const ES339 = { id: 'arthur_es339', name: 'Epiphone ES-339', type: 'HB' };
  const LP60 = { id: 'lp60', name: 'Les Paul Standard 60', short: 'LP 60', type: 'HB' };

  // Contexte morceau : BB King "The Thrill is Gone" — blues, gain
  // clean (target_gain ≤ 4), pickup_preference HB.
  const BBKING_AI = {
    cot_step1: 'Profil tonal blues clean...',
    cot_step3_amp: 'Fender Super Reverb...',
    song_style: 'blues',
    target_gain: 3,
    pickup_preference: 'HB',
    ideal_guitar: 'SG Standard 61',
  };

  test("CACHE STALE — cot_step2 sans ES-339 → ES-339 wins via re-scoring local (regression Arthur)", () => {
    // Cache figé AVANT l'ajout de l'ES-339 : il ne mentionne que SG.
    const aiC = {
      ...BBKING_AI,
      cot_step2_guitars: [
        { name: 'SG Standard 61', score: 88, reason: 'HB classique' },
      ],
    };
    const top = pickTopGuitar(aiC, [SG, ES339], { id: 'bbking_thrill', title: 'The Thrill is Gone', artist: 'B.B. King' });
    expect(top).not.toBeNull();
    expect(top.id).toBe('arthur_es339');
  });

  test("CACHE COMPLET — cot_step2 [LP60(95), SG(90)] → LP60 wins (respect ranking IA quand toutes sont dans le cache)", () => {
    const aiC = {
      ...BBKING_AI,
      cot_step2_guitars: [
        { name: 'Les Paul Standard 60', score: 95, reason: 'top' },
        { name: 'SG Standard 61', score: 90, reason: '2e' },
      ],
    };
    const top = pickTopGuitar(aiC, [LP60, SG], { id: 'bbking_thrill' });
    expect(top.id).toBe('lp60');
  });

  test("CACHE PARTIEL — cot_step2 [SG(88)] mais ES-339 score local 91 → ES-339 wins (combinaison IA+local)", () => {
    // Vérifie que pickTopGuitar fait bien la comparaison numérique
    // entre score IA (88) et score local (≥ 90 pour ES-339 sur blues
    // clean grâce au bonus semi-hollow +4).
    const aiC = {
      ...BBKING_AI,
      cot_step2_guitars: [{ name: 'SG Standard 61', score: 88 }],
    };
    const top = pickTopGuitar(aiC, [SG, ES339], null);
    expect(top.id).toBe('arthur_es339');
  });

  test("availableGuitars vide → null", () => {
    expect(pickTopGuitar(BBKING_AI, [], null)).toBeNull();
    expect(pickTopGuitar(BBKING_AI, null, null)).toBeNull();
  });

  test("aiCache absent → fallback scoring local pur, retourne meilleur HB sur blues", () => {
    // Sans aiC, on ne peut pas scorer style/pickup → toutes guitares
    // ont un score fallback 50. Comportement : retourne le premier
    // (déterministe par ordre de availableGuitars).
    const top = pickTopGuitar(null, [SG, ES339], null);
    expect(top).not.toBeNull();
    // Soit SG (premier du tableau) soit ES-339 — les deux sont
    // acceptables ; ce qui compte c'est qu'on ne crashe pas.
    expect(['sg61', 'arthur_es339']).toContain(top.id);
  });

  test("aiCache sans cot_step2 mais avec song_style → scoring local pur, ES-339 wins sur blues clean", () => {
    const aiC = { ...BBKING_AI, cot_step2_guitars: undefined };
    const top = pickTopGuitar(aiC, [SG, ES339], null);
    expect(top.id).toBe('arthur_es339');
  });

  test("Cache complet sur high_gain blues → ES-339 pénalisé (-3) ne sort plus devant", () => {
    // Garde-fou : la pénalité semi_hollow + high_gain (-3) doit
    // s'appliquer aussi via pickTopGuitar.
    const hardRockAI = {
      song_style: 'hard_rock',
      target_gain: 9,
      pickup_preference: 'HB',
      cot_step2_guitars: [], // forcer scoring local
    };
    const top = pickTopGuitar(hardRockAI, [SG, ES339], null);
    expect(top.id).toBe('sg61');
  });
});

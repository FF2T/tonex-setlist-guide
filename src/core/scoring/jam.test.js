// Tests Phase 14.2 — métrique « ampli passe-partout » (jam.js).
import { describe, test, expect } from 'vitest';
import { jamScore, versatilityStats, computeAmpVersatility, rankJamAmps } from './jam.js';

// ─── versatilityStats — cœur polyvalence (test de référence §4.4) ───
describe('versatilityStats — régularité, pas le pic (§4.4)', () => {
  const deluxe = [88, 90, 86, 92, 89]; // régulier
  const plexi = [98, 78, 99, 76, 99];  // pics + creux

  test('moyennes + couverture', () => {
    const d = versatilityStats(deluxe);
    const p = versatilityStats(plexi);
    expect(d.moyenne).toBe(89);
    expect(p.moyenne).toBe(90);
    expect(d.couverture).toBe(5); // tous ≥80
    expect(p.couverture).toBe(3); // 98,99,99
  });

  test('k=0 → Plexi gagne (moyenne brute, pics)', () => {
    expect(versatilityStats(plexi, 0).polyvalence).toBeGreaterThan(versatilityStats(deluxe, 0).polyvalence);
  });

  test('k=0.5 → Deluxe gagne (régularité commence à peser)', () => {
    expect(versatilityStats(deluxe, 0.5).polyvalence).toBeGreaterThan(versatilityStats(plexi, 0.5).polyvalence);
  });

  test('k=1.5 (défaut) → le passe-partout est le Deluxe', () => {
    const d = versatilityStats(deluxe, 1.5);
    const p = versatilityStats(plexi, 1.5);
    expect(d.polyvalence).toBe(86);   // 89 − 1.5×2
    expect(p.polyvalence).toBe(74);   // 90 − 1.5×10.6 ≈ 74
    expect(d.polyvalence).toBeGreaterThan(p.polyvalence);
  });

  test('série vide → zéros', () => {
    expect(versatilityStats([])).toEqual({ moyenne: 0, ecartType: 0, polyvalence: 0, couverture: 0, n: 0 });
    expect(versatilityStats(null).n).toBe(0);
  });
});

// ─── jamScore — fitness de style, refAmp ignoré ───
describe('jamScore — style fit (refAmp retiré)', () => {
  const bluesSong = { aiCache: { result: { song_style: 'blues', target_gain: 4 } } };
  const lpRig = [{ id: 'lp', type: 'HB' }];
  const stratRig = [{ id: 'st', type: 'SC' }];

  test('capture blues crunch sur blues → score élevé', () => {
    const cap = { amp: 'Fender Deluxe', gain: 'mid', style: 'blues' };
    expect(jamScore(cap, bluesSong, stratRig)).toBeGreaterThan(80);
  });

  test('capture metal high-gain sur blues → score faible (style + gain off)', () => {
    const cap = { amp: 'Mesa', gain: 'high', style: 'metal' };
    expect(jamScore(cap, bluesSong, lpRig)).toBeLessThan(50);
  });

  test('refAmp n\'intervient pas : 2 amplis différents même style/gain → même score', () => {
    const a = { amp: 'Fender Deluxe', gain: 'mid', style: 'blues' };
    const b = { amp: 'Vox AC30', gain: 'mid', style: 'blues' };
    expect(jamScore(a, bluesSong, stratRig)).toBe(jamScore(b, bluesSong, stratRig));
  });

  test('pickup = MEILLEUR sur le rig multi-guitares', () => {
    const cap = { amp: 'X', gain: 'mid', style: 'blues' };
    const mixed = jamScore(cap, bluesSong, [{ type: 'HB' }, { type: 'SC' }]);
    const scOnly = jamScore(cap, bluesSong, [{ type: 'SC' }]);
    // SC est meilleur en blues crunch → le mix (qui contient SC) ≥ HB seul,
    // et = SC seul (best-over-rig).
    expect(mixed).toBe(scOnly);
  });

  test('rig vide → terme pickup neutralisé (pas mis à 0), score non nul', () => {
    const cap = { amp: 'X', gain: 'mid', style: 'blues' };
    expect(jamScore(cap, bluesSong, [])).toBeGreaterThan(0);
  });

  test('preset null → 0', () => {
    expect(jamScore(null, bluesSong, lpRig)).toBe(0);
  });
});

// ─── computeAmpVersatility — gainSpanOK + bankFill ───
describe('computeAmpVersatility', () => {
  const bluesSongs = [
    { aiCache: { result: { song_style: 'blues', target_gain: 3 } } },
    { aiCache: { result: { song_style: 'blues', target_gain: 5 } } },
  ];
  const rig = [{ type: 'SC' }];

  test('ampli avec clean+crunch+lead → gainSpanOK true + bankFill complet', () => {
    const caps = [
      { name: 'X Clean', amp: 'X', gain: 'low', style: 'blues' },
      { name: 'X Crunch', amp: 'X', gain: 'mid', style: 'blues' },
      { name: 'X Lead', amp: 'X', gain: 'high', style: 'blues' },
    ];
    const v = computeAmpVersatility('X', bluesSongs, caps, rig);
    expect(v.gainSpanOK).toBe(true);
    expect(v.bankFill.A).toBe('X Clean');
    expect(v.bankFill.B).toBe('X Crunch');
    expect(v.bankFill.C).toBe('X Lead');
    expect(v.n).toBe(2);
  });

  test('ampli sans lead → gainSpanOK false', () => {
    const caps = [
      { name: 'Y Clean', amp: 'Y', gain: 'low', style: 'blues' },
      { name: 'Y Crunch', amp: 'Y', gain: 'mid', style: 'blues' },
    ];
    expect(computeAmpVersatility('Y', bluesSongs, caps, rig).gainSpanOK).toBe(false);
  });
});

// ─── rankJamAmps — tri, filtre source, fallback span ───
describe('rankJamAmps', () => {
  const catalog = {
    'D Clean': { src: 'TSR', amp: 'Deluxe', gain: 'low', style: 'blues' },
    'D Crunch': { src: 'TSR', amp: 'Deluxe', gain: 'mid', style: 'blues' },
    'D Lead': { src: 'TSR', amp: 'Deluxe', gain: 'high', style: 'blues' },
    'P Clean': { src: 'TSR', amp: 'Plexi', gain: 'low', style: 'hard_rock' },
    'P Crunch': { src: 'TSR', amp: 'Plexi', gain: 'mid', style: 'hard_rock' },
    'P Lead': { src: 'TSR', amp: 'Plexi', gain: 'high', style: 'hard_rock' },
    'Locked Clean': { src: 'Anniversary', amp: 'Locked', gain: 'low', style: 'blues' },
  };
  const bluesSongs = [
    { aiCache: { result: { song_style: 'blues', target_gain: 4 } } },
    { aiCache: { result: { song_style: 'blues', target_gain: 5 } } },
    { aiCache: { result: { song_style: 'rock', target_gain: 8 } } }, // pas blues → ignoré
  ];

  test('blues → Deluxe (style blues) classé devant Plexi (hard_rock)', () => {
    const r = rankJamAmps('blues', bluesSongs, catalog, {}, { guitars: [{ type: 'SC' }] });
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].ampModel).toBe('Deluxe');
    expect(r.every((x) => x.gainSpanOK)).toBe(true);
  });

  test('filtre source : amp dont la seule source est indispo → exclu', () => {
    const r = rankJamAmps('blues', bluesSongs, catalog, { Anniversary: false }, {
      guitars: [{ type: 'SC' }],
      isSourceAvailable: (src, owned) => !owned || owned[src] !== false,
    });
    expect(r.some((x) => x.ampModel === 'Locked')).toBe(false);
  });

  test('fallback span partiel : aucun ampli complet → flag gainSpanPartial', () => {
    const partialCat = { 'Z Clean': { src: 'TSR', amp: 'Z', gain: 'low', style: 'blues' } };
    const r = rankJamAmps('blues', bluesSongs, partialCat, {}, { guitars: [{ type: 'SC' }] });
    expect(r.length).toBe(1);
    expect(r[0].gainSpanPartial).toBe(true);
    expect(r[0].gainSpanOK).toBe(false);
  });
});

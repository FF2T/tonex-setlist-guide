// src/core/purchase-eval.test.js — Évaluateur d'achat de presets/packs.
//
// Les scores candidats sont rendus déterministes via le plancher usages
// (un candidat dont les usages matchent le morceau est forcé ≥ usagesStrong),
// et la baseline `currentBest` est passée en littéral à evaluatePack — donc
// les assertions ne dépendent pas des internes V9.

import { describe, it, expect, vi } from 'vitest';
import {
  usagesMatchSong,
  scoreEntryForSong,
  currentBestInstalled,
  resolveInstalledEntries,
  bestInstalledForSong,
  buildVerdict,
  evaluatePack,
  scoreCandidateAgainstRepertoire,
  DEFAULT_EVAL_OPTS,
} from './purchase-eval.js';

const GID = 'lp60'; // guitare HB réelle (GUITAR_PROFILES)
const USG = [{ artist: 'AC/DC', songs: ['Highway to Hell'] }];
const CTX = { song_style: 'rock', target_gain: 5, ref_amp: 'Marshall', artist: 'AC/DC', title: 'Highway to Hell', ref_guitarist: 'Angus Young' };

// Candidat dont les usages matchent CTX → score forcé ≥ usagesStrong.
function strongCand(name = 'Cand') {
  return { name, entry: { amp: 'Marshall', gain: 'high', style: 'rock', usages: USG }, confidence: 'catalog' };
}
function song(songId, currentBest, ctx = CTX) {
  return { songId, title: 'Highway to Hell', artist: 'AC/DC', ctx, guitarId: GID, currentBest };
}

describe('usagesMatchSong', () => {
  it('artiste + titre → 100', () => {
    expect(usagesMatchSong(USG, 'AC/DC', 'Highway to Hell', null)).toBe(100);
  });
  it('artiste seul (titre absent) → 50', () => {
    expect(usagesMatchSong(USG, 'AC/DC', 'Back in Black', null)).toBe(50);
  });
  it('refGuitarist substring → 50 (garde-fou length >= 4)', () => {
    const u = [{ artist: 'Joe Walsh' }];
    expect(usagesMatchSong(u, 'Eagles', 'Hotel California', 'Don Felder / Joe Walsh')).toBe(50);
  });
  it('artiste court (< 4) non matché en substring', () => {
    const u = [{ artist: 'U2' }];
    expect(usagesMatchSong(u, 'Other', 'X', 'Foo U2 Bar')).toBe(0);
  });
  it('aucun match → 0 ; usages absent → 0', () => {
    expect(usagesMatchSong(USG, 'Metallica', 'One', null)).toBe(0);
    expect(usagesMatchSong(null, 'AC/DC', 'Highway to Hell', null)).toBe(0);
  });
});

describe('scoreEntryForSong — plancher usages symétrique (P1)', () => {
  it('usages artiste+titre → score ≥ usagesStrong', () => {
    const { score } = scoreEntryForSong(strongCand().entry, CTX, GID);
    expect(score).toBeGreaterThanOrEqual(DEFAULT_EVAL_OPTS.usagesStrong);
  });
  it('applyUsages:false désactive le plancher', () => {
    const withFloor = scoreEntryForSong(strongCand().entry, CTX, GID).score;
    const without = scoreEntryForSong(strongCand().entry, CTX, GID, { ...DEFAULT_EVAL_OPTS, applyUsages: false }).score;
    expect(without).toBeLessThanOrEqual(withFloor);
  });
  it('entry null → score 0 sans throw', () => {
    expect(scoreEntryForSong(null, CTX, GID).score).toBe(0);
  });
  it('ctx sans target_gain/ref_amp → pas de throw (défensif)', () => {
    const r = scoreEntryForSong({ amp: 'Marshall', gain: 'mid', style: 'rock' }, { song_style: 'rock' }, GID);
    expect(typeof r.score).toBe('number');
  });
});

describe('buildVerdict — branches tunables (P5)', () => {
  it('positif si unlockedCount ≥ verdictMinUnlocked', () => {
    expect(buildVerdict({ unlockedCount: 1, improvedCount: 0, preliminary: false }).tone).toBe('positive');
  });
  it('nuancé si 0 débloqué mais ≥ 1 amélioré', () => {
    expect(buildVerdict({ unlockedCount: 0, improvedCount: 2, preliminary: false }).tone).toBe('nuanced');
  });
  it('négatif si rien débloqué ni amélioré', () => {
    expect(buildVerdict({ unlockedCount: 0, improvedCount: 0, preliminary: false }).tone).toBe('negative');
  });
  it('preliminary remonté', () => {
    expect(buildVerdict({ unlockedCount: 1, improvedCount: 0, preliminary: true }).preliminary).toBe(true);
  });
  it('marginal (E) : débloque mais peu d\'utiles sur l\'évaluable', () => {
    expect(buildVerdict({ unlockedCount: 1, useful: 1, evaluableCount: 10, improvedCount: 0, preliminary: false }).tone).toBe('marginal');
    expect(buildVerdict({ unlockedCount: 1, useful: 3, evaluableCount: 10, improvedCount: 0, preliminary: false }).tone).toBe('marginal'); // 0.30 ≤ 0.34
    expect(buildVerdict({ unlockedCount: 1, useful: 4, evaluableCount: 10, improvedCount: 0, preliminary: false }).tone).toBe('positive'); // 0.40 > 0.34
  });
});

describe('evaluatePack — métadonnées insuffisantes (D)', () => {
  it('amp Unknown → tag « unknown », non scoré, exclu du décompte', () => {
    const cand = { name: 'BOG XYZ', entry: { amp: 'Unknown', gain: 'mid', style: 'rock', scores: {} }, confidence: 'guessed' };
    const { presets, summary } = evaluatePack([cand], [song('s1', 60)]);
    expect(presets[0].tag).toBe('unknown');
    expect(presets[0].bestScore).toBeNull();
    expect(summary.unknownCount).toBe(1);
    expect(summary.evaluableCount).toBe(0);
    expect(summary.useful).toBe(0);
    expect(summary.duplicates).toBe(0);
  });
  it('pack 100 % inconnu (guessed) reste préliminaire (P2 préservé)', () => {
    const cands = [1, 2, 3].map((i) => ({ name: 'X' + i, entry: { amp: 'Unknown', gain: 'mid', style: 'rock' }, confidence: 'guessed' }));
    const { summary } = evaluatePack(cands, [song('s1', 60)]);
    expect(summary.preliminary).toBe(true);
    expect(summary.unknownCount).toBe(3);
  });
});

describe('resolveInstalledEntries / bestInstalledForSong (G)', () => {
  it('dédup par nom : 2 slots de même nom → 1 entry', () => {
    const banks = { ann: { 0: { A: 'Dup', B: 'Dup' }, 1: { A: 'Other' } } };
    const list = resolveInstalledEntries(banks, ['tonex-anniversary']);
    expect(list.map((x) => x.name).sort()).toEqual(['Dup', 'Other']);
  });
  it('aucune entry → null', () => {
    expect(bestInstalledForSong(CTX, [], GID)).toBeNull();
    expect(resolveInstalledEntries({ ann: {} }, ['tonex-anniversary'])).toEqual([]);
  });
});

describe('evaluatePack — classement', () => {
  it('FILL (🟢) : candidat fort sur trou réel (currentBest < weakThreshold) → débloqué', () => {
    // Parité (P1) : le cache aurait épinglé l'installé à 92, mais on compare
    // au brut 60 → le candidat comble bien.
    const { presets, unlockedSongs, summary } = evaluatePack([strongCand()], [song('s1', 60)]);
    expect(presets[0].tag).toBe('fill');
    expect(unlockedSongs).toHaveLength(1);
    expect(unlockedSongs[0].songId).toBe('s1');
    expect(summary.unlockedCount).toBe(1);
    expect(summary.verdict.tone).toBe('positive');
  });

  it('FILL strict : usages-match fort sur morceau déjà couvert (currentBest=85) → UPGRADE, pas FILL', () => {
    const { presets, unlockedSongs, improvedSongs } = evaluatePack([strongCand()], [song('s1', 85)]);
    expect(presets[0].tag).toBe('upgrade');
    expect(unlockedSongs).toHaveLength(0);
    expect(improvedSongs.map((s) => s.songId)).toContain('s1');
  });

  it('cache absent ≠ trou (P3) : currentBest null → jamais débloqué', () => {
    const { presets, unlockedSongs, summary } = evaluatePack([strongCand()], [song('s1', null)]);
    expect(presets[0].tag).not.toBe('fill');
    expect(unlockedSongs).toHaveLength(0);
    expect(summary.uncoveredUncomputed).toBe(1);
  });

  it('usages symétrique : installé déjà au plancher (currentBest=92) → candidat = doublon, pas amélioration', () => {
    const { presets, improvedSongs } = evaluatePack([strongCand()], [song('s1', 92)]);
    expect(presets[0].tag).toBe('duplicate');
    expect(improvedSongs).toHaveLength(0);
  });

  it('doublon : dupOf nomme le preset installé qui couvre déjà le morceau', () => {
    const s = { ...song('s1', 92), currentBestPreset: 'AA MRSH JT50' };
    const { presets } = evaluatePack([strongCand()], [s]);
    expect(presets[0].tag).toBe('duplicate');
    expect(presets[0].dupOf).toEqual(['AA MRSH JT50']);
  });

  it('doublon multi-morceaux : dupOf dédupliqué, trié par score, cap 3', () => {
    const songs = [
      { ...song('s1', 92), currentBestPreset: 'Inst A' },
      { ...song('s2', 92), currentBestPreset: 'Inst B' },
      { ...song('s3', 92), currentBestPreset: 'Inst A' }, // doublon de nom
    ];
    const { presets } = evaluatePack([strongCand()], songs);
    expect(presets[0].tag).toBe('duplicate');
    expect(new Set(presets[0].dupOf)).toEqual(new Set(['Inst A', 'Inst B']));
  });

  it('dupOf null hors doublon (fill) et sans nom installé', () => {
    const { presets: fill } = evaluatePack([strongCand()], [song('s1', 60)]);
    expect(fill[0].tag).toBe('fill');
    expect(fill[0].dupOf).toBeNull();
    const { presets: dup } = evaluatePack([strongCand()], [song('s1', 92)]); // pas de currentBestPreset
    expect(dup[0].tag).toBe('duplicate');
    expect(dup[0].dupOf).toBeNull();
  });

  it('dédup unlockedSongs (P5) : 5 presets débloquent le même morceau → 1 morceau', () => {
    const cands = [1, 2, 3, 4, 5].map((i) => strongCand('Cand' + i));
    const { unlockedSongs, summary } = evaluatePack(cands, [song('s1', 60)]);
    expect(unlockedSongs).toHaveLength(1);
    expect(summary.useful).toBe(5); // chaque preset est utile…
    expect(summary.unlockedCount).toBe(1); // …mais 1 seul morceau débloqué
  });

  it('hors répertoire (⚫) : max(score) < minRelevant via seuil', () => {
    const cand = { name: 'Jazz', entry: { amp: 'Fender Twin', gain: 'low', style: 'jazz' }, confidence: 'catalog' };
    const { presets } = evaluatePack([cand], [song('s1', 50, { song_style: 'metal', target_gain: 9, ref_amp: 'Mesa Dual Rectifier' })], { ...DEFAULT_EVAL_OPTS, minRelevant: 100 });
    expect(presets[0].tag).toBe('off');
  });

  it('seuils paramétrés : goodThreshold 95 → un candidat à ~92 ne comble plus', () => {
    const { presets } = evaluatePack([strongCand()], [song('s1', 60)], { ...DEFAULT_EVAL_OPTS, goodThreshold: 95 });
    expect(presets[0].tag).not.toBe('fill');
  });

  it('verdict préliminaire (P2) : > 40 % de presets devinés', () => {
    const cands = [
      { ...strongCand('A'), confidence: 'guessed' },
      { ...strongCand('B'), confidence: 'guessed' },
      { ...strongCand('C'), confidence: 'catalog' },
    ];
    const { summary } = evaluatePack(cands, [song('s1', 60)]);
    expect(summary.preliminary).toBe(true);
  });

  it('captures basse exclues : instrument bass → bucket basse, non notée guitare (P6)', () => {
    const bassCand = { name: 'A-Peg DI', entry: { amp: 'Ampeg SVT Bass', gain: 'mid', style: 'rock', instrument: 'bass' }, confidence: 'catalog' };
    const { presets, summary } = evaluatePack([bassCand], [song('s1', 60)]);
    expect(presets[0].tag).toBe('bass');
    expect(summary.bassCount).toBe(1);
    expect(summary.guitarCount).toBe(0);
  });

  it('faux positif basse (P6) : « Bassman » ampli guitare → noté guitare, pas bucket basse', () => {
    const cand = { name: 'Tweed Bassman Drive', entry: { amp: 'Fender Bassman', gain: 'mid', style: 'rock', usages: USG }, confidence: 'catalog' };
    const { presets, summary } = evaluatePack([cand], [song('s1', 60)]);
    expect(presets[0].tag).not.toBe('bass');
    expect(summary.bassCount).toBe(0);
    expect(summary.guitarCount).toBe(1);
  });

  it('répertoire vide → verdict négatif, tout à zéro', () => {
    const { summary, unlockedSongs } = evaluatePack([strongCand()], []);
    expect(unlockedSongs).toHaveLength(0);
    expect(summary.unlockedCount).toBe(0);
    expect(summary.verdict.tone).toBe('negative');
  });
});

describe('scoreCandidateAgainstRepertoire (levier simulation usages)', () => {
  it('parité avec evaluatePack pour un candidat (tag/score/dupOf)', () => {
    const rep = [song('s1', 92)];
    const cand = strongCand();
    const fromPack = evaluatePack([cand], rep).presets[0];
    const direct = scoreCandidateAgainstRepertoire(cand.entry, rep);
    expect(direct.tag).toBe(fromPack.tag);
    expect(direct.bestScore).toBe(fromPack.bestScore);
    expect(direct.dupOf).toEqual(fromPack.dupOf);
  });

  it('usages injectés sur morceau mal couvert (currentBest=70) → fill', () => {
    const withUsages = { amp: 'Marshall', gain: 'high', style: 'rock', usages: USG };
    const res = scoreCandidateAgainstRepertoire(withUsages, [song('s1', 70)]);
    expect(res.tag).toBe('fill'); // plancher usages 92 > 70 → débloque
  });

  it('usages injectés sur égalité (currentBest=92) → reste doublon (pas de flip magique)', () => {
    const withUsages = { amp: 'Marshall', gain: 'high', style: 'rock', usages: USG };
    const res = scoreCandidateAgainstRepertoire(withUsages, [song('s1', 92)]);
    expect(res.tag).toBe('duplicate');
  });
});

describe('currentBestInstalled', () => {
  it('aucun slot installé / pas de device → null (P3)', () => {
    expect(currentBestInstalled(CTX, { ann: {} }, ['tonex-anniversary'], GID)).toBeNull();
    expect(currentBestInstalled(CTX, { ann: { 0: { A: 'X' } } }, [], GID)).toBeNull();
  });

  it('retourne le meilleur slot avec sa localisation', () => {
    const banks = { ann: { 0: { A: 'Some Preset' } } };
    const r = currentBestInstalled(CTX, banks, ['tonex-anniversary'], GID);
    expect(r).not.toBeNull();
    expect(r.presetName).toBe('Some Preset');
    expect(typeof r.score).toBe('number');
  });

  it('dédup baseline (P6) : 2 slots de même nom → computeFinalScore 1 seule fois', async () => {
    vi.resetModules();
    const spy = vi.fn(() => ({ score: 80, breakdown: {} }));
    vi.doMock('./scoring/index.js', async (importOriginal) => {
      const actual = await importOriginal();
      return { ...actual, computeFinalScore: spy };
    });
    const mod = await import('./purchase-eval.js');
    const banks = { ann: { 0: { A: 'Dup', B: 'Dup' }, 1: { A: 'Dup' } } };
    const r = mod.currentBestInstalled({ song_style: 'rock' }, banks, ['tonex-anniversary'], GID);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(r.presetName).toBe('Dup');
    vi.doUnmock('./scoring/index.js');
    vi.resetModules();
  });
});

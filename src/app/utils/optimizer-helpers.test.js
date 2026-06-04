// Tests Phase 14.3 — optimizer-helpers (clustering Live + diff).
import { describe, test, expect } from 'vitest';
import { clusterSongsBySharedTone, buildLiveLayout, diffLayout, splitSwapsByImpact, buildJamLayout } from './optimizer-helpers.js';

// Fabrique de songs simples (id only, le reste vient des fns injectées).
const song = (id) => ({ id });

describe('clusterSongsBySharedTone — triplet, intra-ampli', () => {
  // 6 AC/DC sur Marshall 800SL + White Room sur Marshall Plexi.
  const acdc = ['hth', 'bib', 'tnt', 'ysm', 'hells', 'rosie'].map(song);
  const wr = song('white_room');
  const songs = [...acdc, wr];

  const reco = {
    white_room: { amp: 'Marshall Plexi', score: 98 },
    _default: { amp: 'Marshall 800SL', score: 98 },
  };
  const getReco = (s) => reco[s.id] || reco._default;
  const voicesForAmp = (amp) => amp === 'Marshall 800SL'
    ? { A: '800 Clean', B: '800 Drive', C: '800 Lead' }
    : { A: 'Plexi Clean', B: 'Plexi Crunch', C: 'Plexi Lead' };
  // AC/DC bien couverts par les voix 800SL (~97) ; White Room excellent sur Plexi.
  const scoreCapture = (s, cap) => {
    if (s.id === 'white_room') return cap.startsWith('Plexi') ? 98 : 60;
    return cap.startsWith('800') ? 97 : 60;
  };
  const opts = { bankModel: 'triplet', getReco, voicesForAmp, scoreCapture };

  test('6 AC/DC (même ampli, bien couverts) → 1 banque partagée', () => {
    const { clusters } = clusterSongsBySharedTone(songs, opts);
    const acdcCluster = clusters.find((c) => c.amp === 'Marshall 800SL' && c.shared);
    expect(acdcCluster).toBeTruthy();
    expect(acdcCluster.songs).toHaveLength(6);
    expect(acdcCluster.voices).toEqual({ A: '800 Clean', B: '800 Drive', C: '800 Lead' });
  });

  test('White Room (ampli différent) → banque propre, jamais fusionnée aux AC/DC', () => {
    const { clusters } = clusterSongsBySharedTone(songs, opts);
    const plexi = clusters.filter((c) => c.amp === 'Marshall Plexi');
    expect(plexi).toHaveLength(1);
    expect(plexi[0].songs).toHaveLength(1);
    expect(plexi[0].songs[0].id).toBe('white_room');
    // Total : 1 banque AC/DC + 1 banque White Room.
    expect(clusters).toHaveLength(2);
  });

  test('garde-fou régression : morceau du groupe mal couvert par les 3 voix → banque propre', () => {
    // 1 morceau AC/DC dont le best contre les voix 800SL régresse > δ.
    const weak = song('weak');
    const songs2 = [...acdc, weak];
    const getReco2 = (s) => (s.id === 'weak' ? { amp: 'Marshall 800SL', score: 98 } : getReco(s));
    const scoreCapture2 = (s, cap) => (s.id === 'weak' ? 85 : scoreCapture(s, cap)); // 85 < 98−5=93
    const { clusters } = clusterSongsBySharedTone(songs2, { ...opts, getReco: getReco2, scoreCapture: scoreCapture2 });
    const shared = clusters.find((c) => c.amp === 'Marshall 800SL' && c.shared);
    expect(shared.songs.map((s) => s.id)).not.toContain('weak');
    const own = clusters.find((c) => c.songs.length === 1 && c.songs[0].id === 'weak');
    expect(own).toBeTruthy();
  });

  test('plancher floor : même régression ≤ δ mais best < floor → banque propre', () => {
    const songs3 = acdc.slice(0, 2);
    const getReco3 = () => ({ amp: 'Marshall 800SL', score: 80 }); // dédié 80
    const scoreCapture3 = () => 78; // régression 2 ≤ δ MAIS 78 < floor 80
    const { clusters } = clusterSongsBySharedTone(songs3, { ...opts, getReco: getReco3, scoreCapture: scoreCapture3 });
    // Aucun morceau dans une banque partagée → 2 banques propres.
    expect(clusters.every((c) => !c.shared)).toBe(true);
    expect(clusters).toHaveLength(2);
  });

  test('δ paramétrable : δ large refusionne le morceau faible', () => {
    const weak = song('weak');
    const getReco2 = () => ({ amp: 'Marshall 800SL', score: 98 });
    const scoreCapture2 = (s, cap) => (s.id === 'weak' ? 85 : scoreCapture(s, cap));
    const { clusters } = clusterSongsBySharedTone([...acdc, weak], { ...opts, delta: 20, getReco: getReco2, scoreCapture: scoreCapture2 });
    const shared = clusters.find((c) => c.shared);
    expect(shared.songs.map((s) => s.id)).toContain('weak'); // 85 ≥ 98−20=78 ET ≥ floor 80
  });

  test('morceaux sans aiCache → cluster « non analysés », jamais regroupés', () => {
    const ghost = song('ghost');
    const getRecoG = (s) => (s.id === 'ghost' ? null : getReco(s));
    const { clusters, unanalyzed } = clusterSongsBySharedTone([...acdc, ghost], { ...opts, getReco: getRecoG });
    expect(unanalyzed.map((s) => s.id)).toEqual(['ghost']);
    expect(clusters.every((c) => !c.songs.some((s) => s.id === 'ghost'))).toBe(true);
  });
});

describe('clusterSongsBySharedTone — flat (One/One+)', () => {
  const getReco = (s) => ({ capture: s.id === 'c' ? 'Cap Y' : 'Cap X', score: 90 });
  test('group-by capture exacte : 1 slot par capture distincte', () => {
    const songs = [song('a'), song('b'), song('c')]; // a,b → Cap X ; c → Cap Y
    const { clusters } = clusterSongsBySharedTone(songs, { bankModel: 'flat', getReco });
    expect(clusters).toHaveLength(2);
    const x = clusters.find((c) => c.key === 'Cap X');
    expect(x.songs).toHaveLength(2);
    expect(x.voices).toEqual({ A: 'Cap X' });
    expect(clusters.find((c) => c.key === 'Cap Y').songs).toHaveLength(1);
  });
});

describe('buildLiveLayout', () => {
  const clusters = [
    { key: 'B', amp: 'Bamp', kind: 'amp', voices: { A: 'b1' }, songs: [song('s2')], order: 2 },
    { key: 'A', amp: 'Aamp', kind: 'amp', voices: { A: 'a1' }, songs: [song('s0'), song('s1')], order: 0 },
  ];
  test('axe setlist : ordre d\'apparition', () => {
    const { banks } = buildLiveLayout(clusters, 'setlist', { startBank: 0 });
    expect(banks.map((b) => b.cluster.key)).toEqual(['A', 'B']); // order 0 puis 2
    expect(banks[0].bank).toBe(0);
    expect(banks[1].bank).toBe(1);
    expect(banks[0].songCount).toBe(2);
  });
  test('axe ampFamily : tri par ampli', () => {
    const { banks } = buildLiveLayout(clusters, 'ampFamily', { startBank: 0 });
    expect(banks.map((b) => b.cluster.amp)).toEqual(['Aamp', 'Bamp']);
  });
  test('flat 1-based : startBank 1, slot A seul', () => {
    const { banks } = buildLiveLayout(clusters, 'setlist', { bankModel: 'flat', startBank: 1 });
    expect(banks[0].bank).toBe(1);
    expect(banks[0].slots).toEqual({ A: 'a1' });
  });
});

describe('diffLayout', () => {
  test('classe inchangée / modifiée / fusionnée / libérée dans la zone Live', () => {
    const current = {
      0: { A: 'a1', B: '', C: '' },        // identique au proposé → inchangée
      1: { A: 'old', B: '', C: '' },       // remplacé par fusion → fusionnée
      2: { A: 'gone', B: '', C: '' },      // plus de proposé → libérée
      40: { A: 'jam', B: '', C: '' },      // hors zone Live → ignorée
    };
    const proposed = [
      { bank: 0, slots: { A: 'a1', B: '', C: '' }, songCount: 1 },
      { bank: 1, slots: { A: 'new', B: 'new2', C: '' }, songCount: 3 },
    ];
    const d = diffLayout(current, proposed, { start: 0, liveEnd: 3 });
    const byBank = Object.fromEntries(d.perBank.map((p) => [p.bank, p.status]));
    expect(byBank[0]).toBe('inchangee');
    expect(byBank[1]).toBe('fusionnee');
    expect(byBank[2]).toBe('liberee');
    expect(d.unchanged).toBe(1);
    expect(d.merged).toBe(1);
    expect(d.freed).toBe(1);
    // La banque 40 (Jams) n'est jamais inspectée.
    expect(d.perBank.some((p) => p.bank === 40)).toBe(false);
  });
  test('banque modifiée (1 morceau, contenu différent) → modifiée', () => {
    const d = diffLayout({ 0: { A: 'x' } }, [{ bank: 0, slots: { A: 'y' }, songCount: 1 }], { start: 0, liveEnd: 1 });
    expect(d.perBank[0].status).toBe('modifiee');
    expect(d.moved).toBe(1);
  });
});

describe('splitSwapsByImpact — Phase 14.4', () => {
  const swap = (pairs) => ({ preset: { name: 'P' }, songs: pairs.map(([currentScore, newScore], i) => ({ song: { id: `s${i}` }, currentScore, newScore })) });

  test('sauvetage 55→78 → useful (rescues=1, crossings=0)', () => {
    const { useful, minor } = splitSwapsByImpact([swap([[55, 78]])]);
    expect(useful).toHaveLength(1);
    expect(useful[0].rescues).toBe(1);
    expect(useful[0].crossings).toBe(0);
    expect(minor).toHaveLength(0);
  });

  test('franchissement 79→80 → useful (crossings=1)', () => {
    const { useful } = splitSwapsByImpact([swap([[79, 80]])]);
    expect(useful).toHaveLength(1);
    expect(useful[0].crossings).toBe(1);
    expect(useful[0].rescues).toBe(0);
  });

  test('retouche 84→92 (déjà couvert) → minor', () => {
    const { useful, minor } = splitSwapsByImpact([swap([[84, 92]])]);
    expect(useful).toHaveLength(0);
    expect(minor).toHaveLength(1);
    expect(minor[0].crossings).toBe(0);
    expect(minor[0].rescues).toBe(0);
  });

  test('gain trop faible 72→78 (+6 < rescueGain) → minor', () => {
    const { minor } = splitSwapsByImpact([swap([[72, 78]])]);
    expect(minor).toHaveLength(1);
  });

  test('rescueGain paramétrable : rescueGain=30 → 55→78 (+23) devient minor', () => {
    const { useful, minor } = splitSwapsByImpact([swap([[55, 78]])], { rescueGain: 30 });
    expect(useful).toHaveLength(0);
    expect(minor).toHaveLength(1);
  });

  test('coverageThreshold paramétrable : seuil 70 → 65→72 franchit', () => {
    const { useful } = splitSwapsByImpact([swap([[65, 72]])], { coverageThreshold: 70 });
    expect(useful[0].crossings).toBe(1);
  });

  test('swap mixte (1 morceau franchit, autres non) → useful', () => {
    const { useful } = splitSwapsByImpact([swap([[84, 92], [70, 81]])]);
    expect(useful).toHaveLength(1);
    expect(useful[0].crossings).toBe(1); // seul 70→81 franchit ; 84→92 déjà couvert
    expect(useful[0].rescues).toBe(0);
  });

  test('entrée vide / falsy → { useful: [], minor: [] }', () => {
    expect(splitSwapsByImpact([])).toEqual({ useful: [], minor: [] });
    expect(splitSwapsByImpact(null)).toEqual({ useful: [], minor: [] });
  });
});

describe('buildJamLayout — Phase 14.5', () => {
  const ranked = (amp, bf) => [{ ampModel: amp, polyvalence: 86, couverture: 5, gainSpanPartial: false, bankFill: bf }];
  const rankedByStyle = {
    blues: ranked('Deluxe', { A: 'D Cln', B: 'D Crn', C: 'D Ld' }),
    rock: ranked('Plexi', { A: 'P Cln', B: 'P Crn', C: 'P Ld' }),
  };

  test('triplet : 1 banque A/B/C par style depuis jamStart', () => {
    const { banks, overflow } = buildJamLayout(rankedByStyle, { bankModel: 'triplet', jamStart: 25, jamCapacity: 15 });
    expect(overflow).toBe(false);
    expect(banks).toHaveLength(2);
    expect(banks[0]).toMatchObject({ bank: 25, style: 'blues', ampModel: 'Deluxe', slots: { A: 'D Cln', B: 'D Crn', C: 'D Ld' } });
    expect(banks[1].bank).toBe(26);
  });

  test('flat : 3 slots consécutifs par style (span clean→lead)', () => {
    const { banks } = buildJamLayout(rankedByStyle, { bankModel: 'flat', jamStart: 10, jamCapacity: 10 });
    expect(banks).toHaveLength(6); // 2 styles × 3 voix
    expect(banks.map((b) => b.bank)).toEqual([10, 11, 12, 13, 14, 15]);
    expect(banks[0].slots).toEqual({ A: 'D Cln' });
    expect(banks[3].slots).toEqual({ A: 'P Cln' });
  });

  test('override forcé : chosenAmp gagne sur top du ranking', () => {
    const r = { blues: [
      { ampModel: 'Top', polyvalence: 90, bankFill: { A: 'T1' } },
      { ampModel: 'Forced', polyvalence: 70, bankFill: { A: 'F1', B: 'F2', C: 'F3' } },
    ] };
    const { banks } = buildJamLayout(r, { bankModel: 'triplet', chosenAmp: { blues: 'Forced' } });
    expect(banks[0].ampModel).toBe('Forced');
  });

  test('overflow triplet : capacité < nb styles', () => {
    const { banks, overflow } = buildJamLayout(rankedByStyle, { bankModel: 'triplet', jamStart: 0, jamCapacity: 1 });
    expect(overflow).toBe(true);
    expect(banks).toHaveLength(1); // seul le 1er style tient
  });

  test('overflow flat : capacité < slots requis', () => {
    const { banks, overflow } = buildJamLayout(rankedByStyle, { bankModel: 'flat', jamStart: 0, jamCapacity: 4 });
    expect(overflow).toBe(true);
    expect(banks).toHaveLength(4); // blues 3 + 1 voix de rock, puis stop
  });

  test('style sans ampli éligible → ignoré (pas de crash)', () => {
    const { banks } = buildJamLayout({ blues: [], rock: rankedByStyle.rock }, { bankModel: 'triplet' });
    expect(banks).toHaveLength(1);
    expect(banks[0].style).toBe('rock');
  });

  test('entrée vide → { banks: [], overflow: false }', () => {
    expect(buildJamLayout({}, {})).toEqual({ banks: [], overflow: false });
    expect(buildJamLayout(null, {})).toEqual({ banks: [], overflow: false });
  });
});

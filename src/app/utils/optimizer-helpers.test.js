// Tests Phase 14.3 — optimizer-helpers (clustering Live + diff).
import { describe, test, expect } from 'vitest';
import { clusterSongsBySharedTone, buildLiveLayout, diffLayout, splitSwapsByImpact, buildJamLayout, packForCapacity, deriveLayoutFromReference, applyJamOverrides, numberDerivedLayout } from './optimizer-helpers.js';

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

describe('packForCapacity — Phase 14.6', () => {
  const liveBank = (amp, songCount, n) => ({ bank: n, slots: { A: amp + ' c', B: amp + ' d', C: amp + ' l' }, cluster: { kind: 'amp', amp, shared: songCount > 1 }, songCount });
  const jamBank = (style, n) => ({ bank: n, slots: { A: 'j', B: 'j', C: 'j' }, style });

  test('tient → rien ne saute, 3 zones gardées', () => {
    const layout = { live: [liveBank('A', 2, 0)], jams: [jamBank('blues', 1)], discovery: ['x'] };
    const r = packForCapacity(layout, 10, 'triplet');
    expect(r.dropped).toHaveLength(0);
    expect(r.zonesGardees).toEqual(['live', 'jams', 'discovery']);
  });

  test('ordre : Découverte saute en 1er', () => {
    const layout = { live: [liveBank('A', 2, 0), liveBank('B', 1, 1)], jams: [jamBank('blues', 2)], discovery: ['x', 'y'] };
    const r = packForCapacity(layout, 3, 'triplet'); // besoin 5 > 3 → drop 2 discovery → 3, tient
    expect(r.kept.discovery).toHaveLength(0);
    expect(r.kept.jams).toHaveLength(1);
    expect(r.kept.live).toHaveLength(2);
    expect(r.dropped.every((d) => d.zone === 'discovery')).toBe(true);
    expect(r.zonesGardees).toEqual(['live', 'jams']);
  });

  test('ordre : Jams sautent après la Découverte', () => {
    const layout = { live: [liveBank('A', 2, 0), liveBank('B', 1, 1)], jams: [jamBank('blues', 2), jamBank('rock', 3)], discovery: ['x'] };
    const r = packForCapacity(layout, 2, 'triplet'); // 5>2: -1 disc→4>2: -2 jams→2 tient
    expect(r.kept.discovery).toHaveLength(0);
    expect(r.kept.jams).toHaveLength(0);
    expect(r.kept.live).toHaveLength(2);
    expect(r.zonesGardees).toEqual(['live']);
    expect(r.dropped.filter((d) => d.zone === 'jams')).toHaveLength(2);
  });

  test('étape 3 : fusion Live même ampli (triplet) avant de trimmer', () => {
    // 3 banques même ampli "A" (1 shared + 2 split-out) → fusionnent en 1.
    const layout = { live: [liveBank('A', 4, 0), liveBank('A', 1, 1), liveBank('A', 1, 2)], jams: [], discovery: [] };
    const r = packForCapacity(layout, 1, 'triplet');
    expect(r.kept.live).toHaveLength(1);
    expect(r.kept.live[0].songCount).toBe(6); // 4+1+1
    expect(r.dropped).toHaveLength(0); // fusion suffit, pas de trim
  });

  test('étape 5 : priorisation couverture (plus faible songCount drop en 1er)', () => {
    const layout = { live: [liveBank('A', 5, 0), liveBank('B', 1, 1), liveBank('C', 3, 2)], jams: [], discovery: [] };
    const r = packForCapacity(layout, 2, 'triplet'); // amplis distincts, pas de fusion → trim 1
    expect(r.kept.live).toHaveLength(2);
    expect(r.dropped).toHaveLength(1);
    expect(r.dropped[0].zone).toBe('live');
    expect(r.dropped[0].item.cluster.amp).toBe('B'); // songCount 1 = plus faible
  });

  test('flat : sous pression, 1 son principal par item (slot A only)', () => {
    // 2 items, capacité 1 → step4 réduit chaque item au slot A, puis step5 trim à 1.
    const flatLive = [
      { bank: 1, slots: { A: 'x', B: 'y', C: 'z' }, cluster: { kind: 'capture' }, songCount: 3 },
      { bank: 2, slots: { A: 'p', B: 'q' }, cluster: { kind: 'capture' }, songCount: 1 },
    ];
    const r = packForCapacity({ live: flatLive, jams: [], discovery: [] }, 1, 'flat');
    expect(r.kept.live).toHaveLength(1);
    expect(Object.keys(r.kept.live[0].slots)).toEqual(['A']); // réduit au son principal
    expect(r.kept.live[0].slots.A).toBe('x'); // l'item plus couvrant gardé
  });

  test('jamais de drop silencieux : tout va dans dropped', () => {
    const layout = { live: [liveBank('A', 2, 0), liveBank('B', 1, 1)], jams: [jamBank('blues', 2)], discovery: ['x'] };
    const r = packForCapacity(layout, 1, 'triplet'); // tout sauf 1 live saute
    const total = r.kept.live.length + r.kept.jams.length + r.kept.discovery.length + r.dropped.length;
    expect(total).toBe(4); // 2 live + 1 jam + 1 disc
  });
});

describe('deriveLayoutFromReference — Phase 14.6', () => {
  const refLayout = {
    live: [{ bank: 0, slots: { A: 'AA Clean', B: 'AA Drive', C: 'AA Lead' }, cluster: { kind: 'amp', amp: 'Marshall' } }],
    jams: [{ bank: 25, slots: { A: 'JS Cln', B: 'JS Crn', C: 'JS Ld' }, style: 'blues' }],
  };
  // AA compatible, JS incompatible → substitué ; "AA Lead" incompatible sans substitut → vidé.
  const isCompatible = (n) => n.startsWith('AA') && n !== 'AA Lead';
  const findSubstitute = (n) => (n.startsWith('JS') ? { name: 'SUB ' + n, reason: 'capture-indispo' } : null);

  test('compatible gardée, incompatible substituée + flaggée', () => {
    const { layout, divergences } = deriveLayoutFromReference(refLayout, { bankModel: 'triplet', isCompatible, findSubstitute });
    expect(layout.live[0].slots.A).toBe('AA Clean'); // gardé
    expect(layout.jams[0].slots.A).toBe('SUB JS Cln'); // substitué
    const sub = divergences.find((d) => d.original === 'JS Cln');
    expect(sub).toMatchObject({ substitut: 'SUB JS Cln', reason: 'capture-indispo', context: 'blues' });
  });

  test('aucun substitut → slot vidé + divergence', () => {
    const { layout, divergences } = deriveLayoutFromReference(refLayout, { bankModel: 'triplet', isCompatible, findSubstitute });
    expect(layout.live[0].slots.C).toBe(''); // AA Lead vidé
    expect(divergences.find((d) => d.original === 'AA Lead')).toMatchObject({ substitut: null, reason: 'aucun-substitut', context: 'Marshall' });
  });

  test('flat : slot A seul', () => {
    const r = deriveLayoutFromReference({ live: [{ slots: { A: 'AA Clean' }, cluster: { kind: 'capture', key: 'AA Clean' } }], jams: [] }, { bankModel: 'flat', isCompatible, findSubstitute });
    expect(Object.keys(r.layout.live[0].slots)).toEqual(['A']);
  });

  test('recalcul : compatibilité différente → résultat différent (non figé)', () => {
    const allCompat = deriveLayoutFromReference(refLayout, { bankModel: 'triplet', isCompatible: () => true, findSubstitute });
    expect(allCompat.divergences).toHaveLength(0);
    expect(allCompat.layout.jams[0].slots.A).toBe('JS Cln');
  });

  test('layout vide → pas de crash', () => {
    expect(deriveLayoutFromReference({}, { bankModel: 'triplet' })).toEqual({ layout: { live: [], jams: [] }, divergences: [] });
  });
});

describe('applyJamOverrides — Phase 14.6 (override survit à la dérivation)', () => {
  const derived = [{ style: 'blues', slots: { A: 'ref-b' } }, { style: 'rock', slots: { A: 'ref-r' } }];
  const own = [{ style: 'blues', slots: { A: 'mine-b' } }, { style: 'rock', slots: { A: 'mine-r' } }];

  test('style overridé → remplacé par le choix du device cible ; autres dérivés', () => {
    const r = applyJamOverrides(derived, own, ['blues']);
    expect(r[0].slots.A).toBe('mine-b'); // override survit
    expect(r[1].slots.A).toBe('ref-r');  // non overridé → dérivé
  });
  test('aucun override → tout dérivé (copie)', () => {
    expect(applyJamOverrides(derived, own, [])).toEqual(derived);
  });
  test('override sans banque propre correspondante → garde le dérivé', () => {
    expect(applyJamOverrides(derived, [], ['blues'])[0].slots.A).toBe('ref-b');
  });
});

describe('numberDerivedLayout — Phase 14.6 (fix renumérotation contiguë)', () => {
  const live = (n) => Array.from({ length: n }, (_, i) => ({ slots: { A: 'L' + i }, songCount: 1 }));
  const jams = (n) => Array.from({ length: n }, (_, i) => ({ slots: { A: 'J' + i }, style: 's' + i }));

  test('Live puis Jams CONTIGUS depuis startBank (pas à la frontière de zone)', () => {
    const r = numberDerivedLayout({ live: live(2), jams: jams(3) }, { startBank: 1 });
    expect(r.live.map((b) => b.bank)).toEqual([1, 2]);
    expect(r.jams.map((b) => b.bank)).toEqual([3, 4, 5]); // juste après le Live, PAS 11-12
  });

  test('startBank 0 (Anniversary)', () => {
    const r = numberDerivedLayout({ live: live(1), jams: jams(1) }, { startBank: 0 });
    expect(r.live[0].bank).toBe(0);
    expect(r.jams[0].bank).toBe(1);
  });

  test('vide → vide', () => {
    expect(numberDerivedLayout({}, { startBank: 1 })).toEqual({ live: [], jams: [] });
  });
});

describe('14.6 — pack + number : jams jamais numérotés au-delà de la capacité', () => {
  const liveBank = (amp, songCount, n) => ({ bank: n, slots: { A: amp + ' c', B: amp + ' d', C: amp + ' l' }, cluster: { kind: 'amp', amp, shared: songCount > 1 }, songCount });
  const jamBank = (style, n) => ({ bank: n, slots: { A: 'j', B: 'j', C: 'j' }, style });

  test('Plug triplet (10 banques), zone Jams 0, contexte qui déborde → jams dropés, Live ≤ 10', () => {
    // 8 amplis distincts Live + 5 jams = 13 > 10. Pas de fusion (amplis distincts).
    const liveArr = Array.from({ length: 8 }, (_, i) => liveBank('amp' + i, 1, i));
    const jamArr = ['blues', 'rock', 'jazz', 'funk', 'metal'].map((s, i) => jamBank(s, 100 + i));
    const packed = packForCapacity({ live: liveArr, jams: jamArr, discovery: [] }, 10, 'triplet');
    const numbered = numberDerivedLayout(packed.kept, { startBank: 1 });
    expect(packed.dropped.filter((d) => d.zone === 'jams')).toHaveLength(5); // jams dropées en 1er
    const maxBank = Math.max(...numbered.live.map((b) => b.bank), ...numbered.jams.map((b) => b.bank), 0);
    expect(maxBank).toBeLessThanOrEqual(10); // jamais au-delà de 10 banques
  });

  test('One+ flat (20 slots), zone Jams 0, ça tient → jams placés APRÈS le Live (pas à 21-22)', () => {
    const flatLive = [{ bank: 1, slots: { A: 'x' }, cluster: { kind: 'capture' }, songCount: 1 }, { bank: 2, slots: { A: 'y' }, cluster: { kind: 'capture' }, songCount: 1 }];
    const flatJams = [{ bank: 1, slots: { A: 'j1' }, style: 'blues' }, { bank: 2, slots: { A: 'j2' }, style: 'blues' }, { bank: 3, slots: { A: 'j3' }, style: 'blues' }];
    const packed = packForCapacity({ live: flatLive, jams: flatJams, discovery: [] }, 20, 'flat');
    const numbered = numberDerivedLayout(packed.kept, { startBank: 1 });
    expect(numbered.live.map((b) => b.bank)).toEqual([1, 2]);
    expect(numbered.jams.map((b) => b.bank)).toEqual([3, 4, 5]); // PAS 21-22-23
    const maxBank = Math.max(...numbered.jams.map((b) => b.bank), 0);
    expect(maxBank).toBeLessThanOrEqual(20);
  });
});

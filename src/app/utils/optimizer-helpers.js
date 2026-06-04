// src/app/utils/optimizer-helpers.js — Phase 14.3.
//
// Helpers PURS (testables) pour le mode « Réorganiser » de l'Optimiseur :
// mutualisation des banques de la zone Live + aperçu diff. Toute la logique
// de scoring est INJECTÉE (getReco / voicesForAmp / scoreCapture) → ces
// helpers ne lisent ni le catalog ni le scoring directement, ce qui les
// garde purs et rapides à tester. BankOptimizerScreen fournit les closures
// réelles (basées sur computeFinalScore / computeBestPresets, déférées).
//
// Décisions §5bis du brief PHASE_14_OPTIMISEUR_ZONES.md :
//  - dedup INTRA-AMPLI uniquement (pas de fusion cross-ampli = zone Jams 14.5)
//  - garde-fou = régression du morceau contre les 3 VOIX A/B/C choisies de la
//    banque (≥ score dédié − δ ET ≥ floor), pas un score amp-level générique
//  - bankModel triplet (A/B/C) vs flat (1 slot = 1 capture exacte)
//  - morceaux sans aiCache → cluster « non analysés » à part

const VOICES = ['A', 'B', 'C'];

// clusterSongsBySharedTone(songs, opts)
// opts = { bankModel, delta=5, floor=80, getReco, voicesForAmp, scoreCapture }
//   getReco(song)              → { amp, capture, score } | null  (null = pas d'aiCache)
//   voicesForAmp(amp, songs)   → { A, B, C }  (noms captures clean/crunch/lead)  [triplet]
//   scoreCapture(song, name)   → number  (score d'un morceau contre UNE capture)  [triplet]
// Retour : { clusters: [{ key, kind, amp, voices, songs, shared, order }], unanalyzed: [songs] }
function clusterSongsBySharedTone(songs, opts = {}) {
  const {
    bankModel = 'triplet', delta = 5, floor = 80,
    getReco, voicesForAmp, scoreCapture,
  } = opts;
  const list = Array.isArray(songs) ? songs : [];
  const idxOf = (s) => list.indexOf(s);

  const unanalyzed = [];
  const analyzed = [];
  for (const s of list) {
    const reco = getReco ? getReco(s) : null;
    const usable = reco && (bankModel === 'flat' ? !!reco.capture : !!reco.amp);
    if (usable) analyzed.push({ song: s, reco });
    else unanalyzed.push(s);
  }

  const clusters = [];

  if (bankModel === 'flat') {
    // 1 slot = 1 capture exacte. Deux morceaux partagent un slot ssi leur
    // meilleure capture est identique.
    const byCap = new Map();
    for (const { song, reco } of analyzed) {
      const cap = reco.capture;
      if (!byCap.has(cap)) byCap.set(cap, []);
      byCap.get(cap).push(song);
    }
    for (const [cap, sgs] of byCap) {
      clusters.push({
        key: cap, kind: 'capture', amp: null,
        voices: { A: cap }, songs: sgs, shared: sgs.length >= 2,
        order: Math.min(...sgs.map(idxOf)),
      });
    }
    return { clusters, unanalyzed };
  }

  // triplet : group-by ampli EXACT (pas de fusion cross-ampli).
  const byAmp = new Map();
  for (const item of analyzed) {
    if (!byAmp.has(item.reco.amp)) byAmp.set(item.reco.amp, []);
    byAmp.get(item.reco.amp).push(item);
  }
  for (const [amp, items] of byAmp) {
    const groupSongs = items.map((i) => i.song);
    const voices = voicesForAmp ? voicesForAmp(amp, groupSongs) : { A: null, B: null, C: null };
    const voiceCaps = VOICES.map((v) => voices[v]).filter(Boolean);
    const kept = [];
    const sortedOut = [];
    for (const { song, reco } of items) {
      // Garde-fou : best du morceau contre les 3 VOIX choisies de la banque.
      let best = -1;
      for (const cap of voiceCaps) {
        const sc = scoreCapture ? scoreCapture(song, cap) : 0;
        if (typeof sc === 'number' && sc > best) best = sc;
      }
      const ok = best >= (reco.score - delta) && best >= floor;
      if (ok) kept.push(song); else sortedOut.push(song);
    }
    if (kept.length) {
      clusters.push({
        key: amp, kind: 'amp', amp, voices, songs: kept,
        shared: kept.length >= 2, order: Math.min(...kept.map(idxOf)),
      });
    }
    // Morceaux mal couverts par les 3 voix → banque propre (leurs propres voix).
    for (const song of sortedOut) {
      const ownVoices = voicesForAmp ? voicesForAmp(amp, [song]) : { A: null, B: null, C: null };
      clusters.push({
        key: `${amp}#${song.id || idxOf(song)}`, kind: 'amp', amp, voices: ownVoices,
        songs: [song], shared: false, order: idxOf(song),
      });
    }
  }
  return { clusters, unanalyzed };
}

// buildLiveLayout(clusters, axis, opts)
// opts = { bankModel, startBank=0 }. axis ∈ {'setlist','ampFamily'}.
// Numérote les banques à partir de startBank (ann=0 ; plug/One/One+ = 1-based).
// Retour : { banks: [{ bank, slots, cluster, songCount }] }
function buildLiveLayout(clusters, axis = 'setlist', opts = {}) {
  const { bankModel = 'triplet', startBank = 0 } = opts;
  const cl = (clusters || []).slice();
  if (axis === 'ampFamily') {
    cl.sort((a, b) => String(a.amp || a.key).localeCompare(String(b.amp || b.key))
      || (a.order - b.order));
  } else {
    cl.sort((a, b) => (a.order - b.order));
  }
  const banks = cl.map((cluster, i) => {
    const v = cluster.voices || {};
    const slots = bankModel === 'flat'
      ? { A: v.A || '' }
      : { A: v.A || '', B: v.B || '', C: v.C || '' };
    return { bank: startBank + i, slots, cluster, songCount: (cluster.songs || []).length };
  });
  return { banks };
}

// diffLayout(currentBanks, proposedBanks, liveRange)
// liveRange = { start, liveEnd }. Compare slot à slot UNIQUEMENT dans [start, liveEnd).
// Statuts : inchangée / modifiée / fusionnée / libérée.
function diffLayout(currentBanks, proposedBanks, liveRange = {}) {
  const start = typeof liveRange.start === 'number' ? liveRange.start : 0;
  const liveEnd = typeof liveRange.liveEnd === 'number' ? liveRange.liveEnd : 0;
  const cur = currentBanks || {};
  const propByBank = new Map((proposedBanks || []).map((b) => [b.bank, b]));
  const slotsEqual = (a, b) => VOICES.every((v) => (a?.[v] || '') === (b?.[v] || ''));
  const perBank = [];
  let moved = 0; let unchanged = 0; let freed = 0; let merged = 0;
  for (let n = start; n < liveEnd; n++) {
    const c = cur[n] || {};
    const curHas = VOICES.some((v) => c[v]);
    const prop = propByBank.get(n);
    if (!prop) {
      if (curHas) { perBank.push({ bank: n, status: 'liberee' }); freed++; }
      else { perBank.push({ bank: n, status: 'inchangee' }); unchanged++; }
      continue;
    }
    if (slotsEqual(c, prop.slots)) { perBank.push({ bank: n, status: 'inchangee' }); unchanged++; }
    else if (prop.songCount >= 2) { perBank.push({ bank: n, status: 'fusionnee', songCount: prop.songCount }); merged++; }
    else { perBank.push({ bank: n, status: 'modifiee' }); moved++; }
  }
  return { perBank, moved, unchanged, freed, merged };
}

export { clusterSongsBySharedTone, buildLiveLayout, diffLayout };

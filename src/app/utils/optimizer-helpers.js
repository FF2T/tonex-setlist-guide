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

// splitSwapsByImpact(swaps, opts) — Phase 14.4.
// Reclasse les swaps produits par computePriority (BankOptimizerScreen) en
// { useful, minor } pour le mode « Améliorer » seuillé. PUR : ne lit ni
// catalog ni scoring, les scores sont déjà dans swap.songs[].currentScore/
// newScore. Pas de falaise binaire « franchit 80 ou rien » : un swap est
// utile s'il franchit le seuil OU s'il sauve un point faible (gain ≥ rescueGain
// tout en restant < seuil). Annote swap.crossings / swap.rescues séparément.
//   opts = { coverageThreshold = 80, rescueGain = 10 }
function splitSwapsByImpact(swaps, opts = {}) {
  const threshold = typeof opts.coverageThreshold === 'number' ? opts.coverageThreshold : 80;
  const rescueGain = typeof opts.rescueGain === 'number' ? opts.rescueGain : 10;
  const list = Array.isArray(swaps) ? swaps : [];
  const useful = [];
  const minor = [];
  for (const swap of list) {
    const songs = Array.isArray(swap?.songs) ? swap.songs : [];
    let crossings = 0;
    let rescues = 0;
    for (const s of songs) {
      const cur = typeof s?.currentScore === 'number' ? s.currentScore : 0;
      const next = typeof s?.newScore === 'number' ? s.newScore : 0;
      if (cur < threshold && next >= threshold) crossings++;
      else if (cur < threshold && next < threshold && (next - cur) >= rescueGain) rescues++;
    }
    const annotated = { ...swap, crossings, rescues };
    if (crossings > 0 || rescues > 0) useful.push(annotated);
    else minor.push(annotated);
  }
  return { useful, minor };
}

// buildJamLayout(rankedByStyle, opts) — Phase 14.5.
// Assigne une banque jam par style dans la zone Jams. PUR : le ranking
// (jam.js rankJamAmps) est injecté ; l'override manuel est résolu en amont
// par l'appelant (il passe `chosenAmp` par style). Pour chaque style :
//   - ampli retenu = entrée du ranking dont ampModel === chosenAmp[style]
//     (sinon ranked[0]) ; voix = son bankFill {A,B,C}.
//   - triplet : 1 banque (A/B/C).
//   - flat    : 3 slots consécutifs (un jam VEUT le span clean→crunch→lead).
// Numérote depuis jamStart. overflow si banques/slots requis > jamCapacity
// (en banques pour triplet, en slots pour flat). Style sans ampli → ignoré.
//   opts = { bankModel='triplet', jamStart=0, jamCapacity=Infinity, chosenAmp={} }
//   rankedByStyle = { [style]: [{ ampModel, polyvalence, couverture,
//                     gainSpanPartial, bankFill:{A,B,C} }] }
// Retour : { banks:[{ bank, slots, style, ampModel, polyvalence, couverture,
//            gainSpanPartial }], overflow }
function buildJamLayout(rankedByStyle, opts = {}) {
  const {
    bankModel = 'triplet', jamStart = 0,
    jamCapacity = Infinity, chosenAmp = {},
  } = opts;
  const map = rankedByStyle || {};
  const picks = [];
  for (const style of Object.keys(map)) {
    const ranked = Array.isArray(map[style]) ? map[style] : [];
    if (!ranked.length) continue; // style sans ampli éligible → ignoré
    const forced = chosenAmp[style];
    const pick = (forced && ranked.find((r) => r.ampModel === forced)) || ranked[0];
    if (!pick) continue;
    picks.push({ style, pick });
  }
  const banks = [];
  let overflow = false;
  if (bankModel === 'flat') {
    // 3 slots consécutifs par style (voix A/B/C de l'ampli).
    let slot = jamStart;
    for (const { style, pick } of picks) {
      const v = pick.bankFill || {};
      const voices = [v.A, v.B, v.C].filter(Boolean);
      for (const cap of voices) {
        if (slot - jamStart >= jamCapacity) { overflow = true; break; }
        banks.push({
          bank: slot, slots: { A: cap }, style, ampModel: pick.ampModel,
          polyvalence: pick.polyvalence, couverture: pick.couverture,
          gainSpanPartial: !!pick.gainSpanPartial,
        });
        slot++;
      }
      if (overflow) break;
    }
  } else {
    // triplet : 1 banque A/B/C par style.
    picks.forEach(({ style, pick }, i) => {
      if (i >= jamCapacity) { overflow = true; return; }
      const v = pick.bankFill || {};
      banks.push({
        bank: jamStart + i, slots: { A: v.A || '', B: v.B || '', C: v.C || '' },
        style, ampModel: pick.ampModel, polyvalence: pick.polyvalence,
        couverture: pick.couverture, gainSpanPartial: !!pick.gainSpanPartial,
      });
    });
    if (picks.length > jamCapacity) overflow = true;
  }
  return { banks, overflow };
}

// mergeSameAmpLive(live) — Phase 14.6 step 3 : ré-absorbe les banques Live de
// même ampli séparées par le garde-fou régression 14.3 (relâche δ, déterministe).
function mergeSameAmpLive(live) {
  const byAmp = new Map();
  const out = [];
  for (const b of live) {
    const amp = b.cluster && b.cluster.kind === 'amp' ? b.cluster.amp : null;
    if (!amp) { out.push(b); continue; }
    if (byAmp.has(amp)) {
      const first = byAmp.get(amp);
      first.songCount = (first.songCount || 1) + (b.songCount || 1);
      first.cluster = { ...(first.cluster || {}), shared: true };
    } else {
      const copy = { ...b, cluster: b.cluster ? { ...b.cluster } : b.cluster };
      byAmp.set(amp, copy);
      out.push(copy);
    }
  }
  return out;
}

// packForCapacity(layout, capacity, bankModel, opts) — Phase 14.6.
// Dégradation gracieuse quand le besoin dépasse la capacité du device.
// `layout = { live:[bankEntry], jams:[bankEntry], discovery:[name] }`. `capacity`
// = unité native (slots flat / banques triplet) ; chaque bankEntry + chaque pin
// = 1 unité. Ordre §6bis : Découverte → Jams → mutualisation Live (triplet) →
// flat 1-son → priorisation couverture. JAMAIS de drop silencieux : tout va dans
// `dropped`. Retour { kept:{live,jams,discovery}, dropped:[{item,zone,reason}],
// zonesGardees:[...] }.
function packForCapacity(layout, capacity, bankModel = 'triplet', opts = {}) {
  const cap = typeof capacity === 'number' && capacity >= 0 ? Math.floor(capacity) : 0;
  let live = Array.isArray(layout?.live) ? layout.live.slice() : [];
  let jams = Array.isArray(layout?.jams) ? layout.jams.slice() : [];
  let discovery = Array.isArray(layout?.discovery) ? layout.discovery.slice() : [];
  const dropped = [];
  const zonesGardees = ['live', 'jams', 'discovery'];
  const need = () => live.length + jams.length + discovery.length;
  const dropZone = (z) => { const i = zonesGardees.indexOf(z); if (i >= 0) zonesGardees.splice(i, 1); };

  // 1. Découverte
  if (need() > cap && discovery.length) {
    discovery.forEach((name) => dropped.push({ item: name, zone: 'discovery', reason: 'capacity-discovery' }));
    discovery = []; dropZone('discovery');
  }
  // 2. Jams
  if (need() > cap && jams.length) {
    jams.forEach((b) => dropped.push({ item: b, zone: 'jams', reason: 'capacity-jams' }));
    jams = []; dropZone('jams');
  }
  // 3. Mutualisation Live plus agressive (triplet uniquement)
  if (need() > cap && bankModel !== 'flat') {
    live = mergeSameAmpLive(live);
  }
  // 4. flat : 1 son principal par item (slot A dominant)
  if (need() > cap && bankModel === 'flat') {
    live = live.map((b) => ({ ...b, slots: { A: b.slots?.A || b.slots?.B || b.slots?.C || '' } }));
  }
  // 5. Priorisation par couverture : retire les banques Live de plus faible couverture
  if (need() > cap && live.length) {
    const toDrop = Math.max(0, need() - cap);
    const order = live.map((b, i) => ({ i, cov: b.songCount || 1 })).sort((a, b) => a.cov - b.cov);
    const dropSet = new Set(order.slice(0, toDrop).map((x) => x.i));
    const keptLive = [];
    live.forEach((b, i) => { if (dropSet.has(i)) dropped.push({ item: b, zone: 'live', reason: 'capacity-live' }); else keptLive.push(b); });
    live = keptLive;
    if (!live.length) dropZone('live');
  }
  return { kept: { live, jams, discovery }, dropped, zonesGardees };
}

// deriveLayoutFromReference(referenceLayout, opts) — Phase 14.6.
// Dérive le layout PROPOSÉ du rig de référence vers un device cible. PUR :
// compatibilité + substitution INJECTÉES. Pour chaque capture : gardée si
// compatible, sinon substituée par l'équivalent le plus proche (même ampli/gain/
// style dispo sur la cible) + divergence, sinon slot vidé + divergence. Recalculé
// à chaque appel (dérivation non figée).
//   referenceLayout = { live:[bankEntry], jams:[bankEntry] }
//   opts = { bankModel='triplet', isCompatible(name)->bool, findSubstitute(name)->{name,reason}|null }
// Retour { layout:{ live, jams }, divergences:[{ context, slot, original, substitut, reason }] }
function deriveLayoutFromReference(referenceLayout, opts = {}) {
  const { bankModel = 'triplet', isCompatible, findSubstitute } = opts;
  const keys = bankModel === 'flat' ? ['A'] : ['A', 'B', 'C'];
  const divergences = [];
  const mapEntry = (entry, context) => {
    const slots = {};
    for (const k of keys) {
      const name = entry.slots ? entry.slots[k] : '';
      if (!name) { slots[k] = ''; continue; }
      if (isCompatible && isCompatible(name)) { slots[k] = name; continue; }
      const sub = findSubstitute ? findSubstitute(name) : null;
      if (sub && sub.name) {
        slots[k] = sub.name;
        divergences.push({ context, slot: k, original: name, substitut: sub.name, reason: sub.reason || 'capture-indispo' });
      } else {
        slots[k] = '';
        divergences.push({ context, slot: k, original: name, substitut: null, reason: 'aucun-substitut' });
      }
    }
    return { ...entry, slots };
  };
  const live = (referenceLayout?.live || []).map((e) => mapEntry(e, (e.cluster && (e.cluster.amp || e.cluster.key)) || ''));
  const jams = (referenceLayout?.jams || []).map((e) => mapEntry(e, e.style || ''));
  return { layout: { live, jams }, divergences };
}

// applyJamOverrides(derivedJams, ownJamBanks, overriddenStyles) — Phase 14.6.
// Précédence §6ter : un override manuel jam du device cible SURVIT à la
// dérivation. Pour chaque style overridé, remplace la banque jam dérivée (du rig
// de référence) par celle du device cible (son propre choix forcé). Les autres
// styles gardent la version dérivée. Pur.
function applyJamOverrides(derivedJams, ownJamBanks, overriddenStyles) {
  const styles = new Set(overriddenStyles || []);
  if (!styles.size) return Array.isArray(derivedJams) ? derivedJams.slice() : [];
  const ownByStyle = new Map((ownJamBanks || []).map((b) => [b.style, b]));
  return (derivedJams || []).map((b) => (styles.has(b.style) && ownByStyle.has(b.style) ? ownByStyle.get(b.style) : b));
}

export {
  clusterSongsBySharedTone, buildLiveLayout, diffLayout, splitSwapsByImpact,
  buildJamLayout, packForCapacity, deriveLayoutFromReference, applyJamOverrides,
};

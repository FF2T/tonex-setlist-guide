// src/core/purchase-eval.js — Évaluateur d'achat de presets/packs.
//
// Décide si l'achat d'un pack vaut le coup POUR le répertoire de l'user.
// On note chaque preset candidat contre chaque morceau analysé, et on le
// compare à ce que l'user a DÉJÀ installé. Verdict mené par les morceaux
// débloqués, pas par le nombre de presets.
//
// Principes (retour Sébastien — cf docs/SCORING.md esprit) :
//  - P1 Armes égales : candidat ET baseline notés par la MÊME fonction
//    (scoreEntryForSong), aucun pin asymétrique. On NE lit JAMAIS les
//    `result.preset_*.score` du cache (gonflés par Phase 7.31 max(90,v9)
//    + Phase 7.52.5 force 92). La baseline est recalculée brute.
//  - P3 « non calculé » ≠ « trou » : currentBest === null (aucun preset
//    installé scoré) est distinct d'un vrai score faible. Un morceau à
//    currentBest null n'est JAMAIS compté « comble un manque ».
//  - P5 On compte des MORCEAUX débloqués (dédupliqués), pas des presets.
//  - P6 Captures basse exclues du scoring guitare (isBassPreset).
//
// computeFinalScore (scoring/index.js) n'intègre PAS les usages (pickup/
// guitar/gain/refAmp/style seulement) → on empile le boost usages ici,
// symétriquement des deux côtés. Pas de double comptage.

import { computeFinalScore } from './scoring/index.js';
import { bucketizeScore } from './scoring/compat-buckets.js';
import { findCatalogEntry, isBassPreset } from './catalog.js';

// Défauts paramétrables. À recalibrer sur la distribution réelle (P4) :
// les scores sont tassés dans le haut, improveDelta:5 fixe se déclenche
// rarement → on couple un saut de bucket bucketizeScore à un delta plancher.
export const DEFAULT_EVAL_OPTS = {
  goodThreshold: 80,     // un candidat « bon » pour un morceau
  weakThreshold: 75,     // en dessous, la couverture actuelle est « faible »
  improveDelta: 5,       // delta absolu plancher pour « améliore »
  minRelevant: 70,       // en dessous, hors répertoire pour ce morceau
  applyUsages: true,     // boost usages appliqué symétriquement aux 2 côtés
  usagesStrong: 92,      // plancher de score si usages artiste+titre matchent
  usagesWeak: 80,        // plancher si usages artiste seul matche
  guessedRatioMax: 0.4,  // > 40 % de presets devinés → verdict préliminaire
  verdictMinUnlocked: 1, // morceaux débloqués mini pour un verdict positif
  marginalRatio: 0.34,   // useful/évaluables ≤ ce ratio → verdict « marginal »
};

// Règle usages (miroir de findCatalogEntryByUsages / findSlotByUsageMatch,
// ai-helpers.js). artist exact OU refGuitarist substring (garde-fou
// u.artist.length >= 4). 100 si artiste+titre, 50 si artiste seul, 0 sinon.
export function usagesMatchSong(usages, artist, title, refGuitarist) {
  if (!Array.isArray(usages)) return 0;
  const artistLc = String(artist || '').toLowerCase();
  const titleLc = String(title || '').toLowerCase();
  const guitaristLc = String(refGuitarist || '').toLowerCase();
  let best = 0;
  for (const u of usages) {
    if (!u?.artist) continue;
    const uArtistLc = u.artist.toLowerCase();
    const matchArtist = uArtistLc === artistLc;
    const matchGuitarist = guitaristLc.length > 0
      && u.artist.length >= 4
      && guitaristLc.includes(uArtistLc);
    const matchTitle = Array.isArray(u.songs)
      && u.songs.some((s) => String(s).toLowerCase() === titleLc);
    let score = 0;
    if ((matchArtist || matchGuitarist) && matchTitle) score = 100;
    else if (matchArtist || matchGuitarist) score = 50;
    if (score > best) best = score;
  }
  return best;
}

// Note un catalog entry contre le contexte d'un morceau. UTILISÉ DES DEUX
// CÔTÉS (candidat + baseline installée) pour garantir l'armes égales (P1).
//
// songCtx = { song_style, target_gain, ref_amp, artist, title, ref_guitarist }
// Défensif : aiCache anciens sans target_gain/ref_amp → undefined des deux
// côtés, la parité tient (computeFinalScore renormalise les poids).
export function scoreEntryForSong(entry, songCtx, guitarId, opts = DEFAULT_EVAL_OPTS) {
  if (!entry) return { score: 0, breakdown: null };
  const ctx = songCtx || {};
  const { score, breakdown } = computeFinalScore(
    entry,
    guitarId ?? null,
    ctx.song_style ?? null,
    ctx.target_gain ?? null,
    ctx.ref_amp ?? null,
    true,
  );
  let finalScore = score;
  if (opts.applyUsages && entry.usages) {
    const u = usagesMatchSong(entry.usages, ctx.artist, ctx.title, ctx.ref_guitarist);
    if (u >= 100) finalScore = Math.max(finalScore, opts.usagesStrong);
    else if (u >= 50) finalScore = Math.max(finalScore, opts.usagesWeak);
  }
  return { score: finalScore, breakdown };
}

// Mapping device activé → banks à scanner pour la baseline.
function _banksForDevices(banksByDevice, enabledDevices) {
  const out = [];
  const ed = Array.isArray(enabledDevices) ? enabledDevices : [];
  if (ed.includes('tonex-pedal') || ed.includes('tonex-anniversary')) {
    if (banksByDevice?.ann) out.push(['ann', banksByDevice.ann]);
  }
  if (ed.includes('tonex-plug') && banksByDevice?.plug) out.push(['plug', banksByDevice.plug]);
  if (ed.includes('tonex-one') && banksByDevice?.one) out.push(['one', banksByDevice.one]);
  if (ed.includes('tonex-one-plus') && banksByDevice?.onePlus) out.push(['onePlus', banksByDevice.onePlus]);
  return out;
}

// Résout les presets INSTALLÉS uniques en entries catalog, UNE seule fois
// (dédup par nom, findCatalogEntry coûteux via fallback toneModelName O(1700)).
// À mémoïser par (rig) côté écran : indépendant du morceau et du pack candidat
// → évite de re-résoudre 55× les mêmes slots (perf G, retour prod 2026-06-09).
export function resolveInstalledEntries(banksByDevice, enabledDevices) {
  const banksList = _banksForDevices(banksByDevice, enabledDevices);
  const seen = new Map(); // name -> { name, entry, device, bank, slot }
  for (const [device, banks] of banksList) {
    for (const [bankNum, bank] of Object.entries(banks || {})) {
      for (const slot of ['A', 'B', 'C']) {
        const name = bank?.[slot];
        if (!name || typeof name !== 'string') continue;
        if (!seen.has(name)) seen.set(name, { name, entry: findCatalogEntry(name), device, bank: Number(bankNum), slot });
      }
    }
  }
  return Array.from(seen.values());
}

// Meilleur installé pour un morceau, à partir des entries pré-résolues (P1).
// Retourne null si aucune entry (P3) — « non calculé », distinct d'un score faible.
export function bestInstalledForSong(songCtx, installedEntries, guitarId, opts = DEFAULT_EVAL_OPTS) {
  if (!Array.isArray(installedEntries) || installedEntries.length === 0) return null;
  let best = null;
  for (const it of installedEntries) {
    const { score } = scoreEntryForSong(it.entry, songCtx, guitarId, opts);
    if (!best || score > best.score) best = { score, presetName: it.name, device: it.device, bank: it.bank, slot: it.slot };
  }
  return best;
}

// Variante banks-based (tests / appelants simples). Résout puis score.
export function currentBestInstalled(songCtx, banksByDevice, enabledDevices, guitarId, opts = DEFAULT_EVAL_OPTS) {
  return bestInstalledForSong(songCtx, resolveInstalledEntries(banksByDevice, enabledDevices), guitarId, opts);
}

// Un candidat passe-t-il dans un bucket strictement supérieur ? (P4)
function _bucketJump(from, to) {
  return bucketizeScore(to).threshold > bucketizeScore(from).threshold;
}

// Classe la relation d'un candidat à un morceau.
//  fill              : trou réel comblé (🟢) — STRICT, pas d'exception usages
//  upgrade           : améliore une couverture correcte (🟡)
//  covered           : pertinent mais déjà couvert (⚪)
//  uncovered-relevant: pertinent mais rig non installé (currentBest null)
//  none              : non pertinent
function _classify(score, currentBest, opts) {
  if (currentBest == null) {
    return score >= opts.minRelevant ? 'uncovered-relevant' : 'none';
  }
  if (score >= opts.goodThreshold && currentBest < opts.weakThreshold) return 'fill';
  if (currentBest >= opts.weakThreshold
    && (_bucketJump(currentBest, score) || score >= currentBest + opts.improveDelta)) return 'upgrade';
  if (score >= opts.minRelevant) return 'covered';
  return 'none';
}

// Verdict tunable, mené par les morceaux (P5). Retourne une forme structurée
// (le libellé FR/i18n est composé par l'UI).
export function buildVerdict(summary, opts = DEFAULT_EVAL_OPTS) {
  let tone;
  if (summary.unlockedCount >= opts.verdictMinUnlocked) {
    // « Marginal » quand très peu de presets sont utiles sur l'ensemble
    // évaluable (ex. 1 utile / 10) : vrai mais l'info d'achat est nuancée.
    const ev = summary.evaluableCount || 0;
    tone = (ev > 0 && (summary.useful / ev) <= opts.marginalRatio) ? 'marginal' : 'positive';
  } else if (summary.improvedCount >= 1) tone = 'nuanced';
  else tone = 'negative';
  return { tone, preliminary: summary.preliminary };
}

// candidateEntries : [{ name, entry, confidence: 'catalog'|'ai'|'guessed' }]
// repertoire        : [{ songId, title, artist, ctx, guitarId, currentBest }]
//   ctx = { song_style, target_gain, ref_amp, artist, title, ref_guitarist }
//   currentBest = number | null (précalculé par l'écran via currentBestInstalled)
export function evaluatePack(candidateEntries, repertoire, opts = DEFAULT_EVAL_OPTS) {
  const o = { ...DEFAULT_EVAL_OPTS, ...(opts || {}) };
  const cands = Array.isArray(candidateEntries) ? candidateEntries : [];
  const rep = Array.isArray(repertoire) ? repertoire : [];

  const presets = [];
  let bassCount = 0;
  let unknownCount = 0;
  let guessedGuitar = 0;
  let guitarCount = 0; // non-basse (évaluables + inconnus) — base du ratio préliminaire

  // Accumulateurs par morceau (P5 — on dédupliquera).
  const fillBySong = new Map();    // songId -> { song, bestPreset, bestScore, currentBest }
  const upgradeBySong = new Map();

  for (const cand of cands) {
    if (isBassPreset(cand.name, cand.entry)) {
      bassCount += 1;
      presets.push({ name: cand.name, entry: cand.entry, confidence: cand.confidence, tag: 'bass', bestScore: null, bestSongId: null, helps: [] });
      continue;
    }
    guitarCount += 1;
    if (cand.confidence === 'guessed') guessedGuitar += 1;
    // D — métadonnées insuffisantes (amp inconnu) : non évaluable. On ne
    // le score PAS (un score plancher + tag « doublon » laisserait croire
    // « tu as l'équivalent »). Exclu du décompte du verdict.
    const ampStr = cand.entry?.amp;
    if (!ampStr || /^unknown$/i.test(String(ampStr).trim())) {
      unknownCount += 1;
      presets.push({ name: cand.name, entry: cand.entry, confidence: cand.confidence, tag: 'unknown', bestScore: null, bestSongId: null, helps: [] });
      continue;
    }

    const helps = [];
    let bestScore = -1;
    let bestSongId = null;

    for (const song of rep) {
      const { score } = scoreEntryForSong(cand.entry, song.ctx, song.guitarId, o);
      if (score > bestScore) { bestScore = score; bestSongId = song.songId; }
      const relation = _classify(score, song.currentBest, o);
      if (relation === 'none') continue;
      const delta = song.currentBest == null ? null : score - song.currentBest;
      helps.push({ songId: song.songId, title: song.title, artist: song.artist, score, currentBest: song.currentBest, delta, relation });

      if (relation === 'fill') {
        const cur = fillBySong.get(song.songId);
        if (!cur || score > cur.bestScore) {
          fillBySong.set(song.songId, { songId: song.songId, title: song.title, artist: song.artist, bestPreset: cand.name, bestScore: score, currentBest: song.currentBest });
        }
      } else if (relation === 'upgrade') {
        const cur = upgradeBySong.get(song.songId);
        if (!cur || score > cur.bestScore) {
          upgradeBySong.set(song.songId, { songId: song.songId, title: song.title, artist: song.artist, bestPreset: cand.name, bestScore: score, currentBest: song.currentBest });
        }
      }
    }

    const hasFill = helps.some((h) => h.relation === 'fill');
    const hasUpgrade = helps.some((h) => h.relation === 'upgrade');
    let tag;
    if (hasFill) tag = 'fill';
    else if (hasUpgrade) tag = 'upgrade';
    else if (bestScore >= o.minRelevant) tag = 'duplicate'; // pertinent quelque part mais ne bat rien
    else tag = 'off'; // hors répertoire ⟺ max(score) < minRelevant

    presets.push({ name: cand.name, entry: cand.entry, confidence: cand.confidence, tag, bestScore: bestScore < 0 ? null : bestScore, bestSongId, helps });
  }

  // P5 — morceaux débloqués (dédupliqués). Un morceau « amélioré » n'est
  // listé que s'il n'est pas déjà « débloqué ».
  const unlockedSongs = Array.from(fillBySong.values());
  const improvedSongs = Array.from(upgradeBySong.values()).filter((s) => !fillBySong.has(s.songId));

  const useful = presets.filter((p) => p.tag === 'fill' || p.tag === 'upgrade').length;
  const duplicates = presets.filter((p) => p.tag === 'duplicate').length;
  const offRepertoire = presets.filter((p) => p.tag === 'off').length;
  const uncoveredUncomputed = rep.filter((s) => s.currentBest == null).length;
  // Préliminaire = ratio devinés sur tous les non-basse (inconnus compris,
  // pour conserver P2 : un pack 100 % inconnu reste « préliminaire »).
  const preliminary = guitarCount > 0 && (guessedGuitar / guitarCount) > o.guessedRatioMax;

  const summary = {
    total: cands.length,
    guitarCount,
    evaluableCount: guitarCount - unknownCount,
    bassCount,
    unknownCount,
    useful,
    unlockedCount: unlockedSongs.length,
    improvedCount: improvedSongs.length,
    duplicates,
    offRepertoire,
    uncoveredUncomputed,
    preliminary,
  };
  summary.verdict = buildVerdict(summary, o);

  return { presets, unlockedSongs, improvedSongs, summary };
}

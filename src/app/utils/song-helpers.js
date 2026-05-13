// src/app/utils/song-helpers.js — Phase 7.14 (découpage main.jsx).
//
// Helpers de lecture du modèle song : preset par type, ig, history.
// Pures, lisent SONG_PRESETS (core/songs.js) et combinent avec
// pickTopGuitar (core/scoring/guitar.js) pour la résolution de la
// guitare idéale.
//
// Utilisés par tous les screens qui rendent une ligne morceau (RecapScreen,
// SongDetailCard, ListScreen, HomeScreen, SetlistsScreen, BankOptimizer).

import { GUITARS } from '../../core/guitars.js';
import { SONG_PRESETS, SONG_HISTORY } from '../../core/songs.js';
import { pickTopGuitar } from '../../core/scoring/guitar.js';

function getPA(song, type) {
  const p = SONG_PRESETS[song.id];
  if (!p) return null;
  return p.pA[type] || p.pA.HB || null;
}

function getPP(song, type) {
  const p = SONG_PRESETS[song.id];
  if (!p) return null;
  return p.pP[type] || p.pP.HB || null;
}

function getSet(song, type) {
  const p = SONG_PRESETS[song.id];
  if (!p) return {};
  return p.set[type] || p.set.HB || {};
}

function getGr(song, type) {
  const p = SONG_PRESETS[song.id];
  if (!p) return '';
  return p.gr[type] || p.gr.HB || '';
}

// Phase 3.9 — Auto-pick robuste au cache IA stale. Combine cot_step2_guitars
// (top 2-3 IA) + scoring local sur TOUTES les guitares du rig (pickTopGuitar).
// Fallback : SONG_PRESETS.ig pour les morceaux du seed sans aiCache.
function getIg(song, guitars) {
  const allG = guitars || GUITARS;
  const aiC = song.aiCache?.result;
  if (aiC && allG.length) {
    const top = pickTopGuitar(aiC, allG, song);
    if (top) return [top.id];
  }
  const p = SONG_PRESETS[song.id];
  const ig = song.ig?.length ? song.ig : p?.ig;
  if (ig?.length) {
    const filtered = ig.filter((id) => allG.some((g) => g.id === id));
    if (filtered.length) return filtered;
    if (allG.length) return [allG[0].id];
  }
  return [];
}

function getTsr(song, _type) {
  const p = SONG_PRESETS[song.id];
  if (!p) return null;
  if (p.tsrRef) return null; // handled by parent
  return p.tsr || null;
}

function getTsrRef(song) {
  return SONG_PRESETS[song.id]?.tsrRef || null;
}

// Retourne {guitarist, guitar, amp, effects} depuis le cache IA ou
// SONG_HISTORY (fallback). Si l'IA a analysé le morceau, on utilise ses
// valeurs (potentiellement plus précises que le seed pour les imports
// Newzik). Sinon le seed.
function getSongHist(song, aiResult = null) {
  const r = aiResult || song.aiCache?.result;
  if (r && r.ref_guitarist) {
    return {
      guitarist: r.ref_guitarist,
      guitar: r.ref_guitar,
      amp: r.ref_amp,
      effects: r.ref_effects,
    };
  }
  return SONG_HISTORY[song.id] || null;
}

export {
  getPA, getPP, getSet, getGr, getIg, getTsr, getTsrRef, getSongHist,
};

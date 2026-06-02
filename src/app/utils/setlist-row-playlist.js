// src/app/utils/setlist-row-playlist.js — Phase 7.55.7 S8 (S8-1).
//
// Helper pur qui transforme les données d'une row Setlists en structure
// "playlist-like" prête à rendre (Phase S8 refonte UX collapsed row).
//
// Validé Sébastien 25/05 : direction C "playlist-like numéroté", style
// Spotify/Apple Music. Numéro à gauche, titre dominant + chevron + score
// top à droite, ligne meta dense (artist · guitare · slot+preset · potards).
// Drop encadrés badges (texte coloré uniquement).
//
// Inputs :
//   - song : { id, title, artist, ... }
//   - aiC : aiCache.result enrichi (preset_ann, preset_plug, ...) ou null
//   - guitar : objet guitare choisie (g) ou null
//   - guitarScore : score calculé pour la guitare choisie ou null
//   - isOptimalGuitar : bool (guitare ∈ ig)
//
// Output :
//   {
//     title, artist,
//     guitarLabel: 'SG Ebony (HB)' | null,
//     guitarScore: 95 | null,
//     isOptimalGuitar: bool,
//     devices: [{ deviceKey, deviceLabel, slot, presetName, presetScore }],
//     potards: 'G6.2 B4.5 M7 T5.3 V6' | null,
//     fxOn: ['Gate', 'Verb'],
//     topScore: 88 | null,         // max(devices.presetScore) OR guitarScore fallback
//     needsAnalysis: bool          // true si aucun preset_* ni guitarScore
//   }

import { formatRowPotardsFX } from './setlist-row-extras.js';
import { findCatalogEntry } from '../../core/catalog.js';

// Labels devices courts pour la ligne meta playlist.
const DEVICE_SHORT_LABELS = {
  'tonex-pedal': 'Pedal',
  'tonex-anniversary': 'Anniv',
  'tonex-plug': 'Plug',
};

/**
 * Helper pur — construit le shape playlist d'une row.
 * @param {object} song - L'objet song (avec title, artist)
 * @param {object|null} aiC - aiCache.result enrichi
 * @param {object|null} guitar - guitare choisie (objet g)
 * @param {number|null} guitarScore - score guitare (cot.score ou local)
 * @param {boolean} isOptimalGuitar - true si guitar ∈ ideal_guitars
 * @returns {object} structure playlist
 */
export function getRowPlaylistData(song, aiC, guitar, guitarScore, isOptimalGuitar) {
  const title = song?.title || '';
  const artist = song?.artist || '';

  // v9.7.14 — nom COMPLET (g.name, ex "Gibson SG Standard Ebony") au lieu
  // du court Phase 7.85 P0-03 ("SG Ebony"). Le cadre vert passe pleine
  // largeur en mobile (cf CSS .songrow-pl-meta-guitar .songrow-pl-guitar
  // <640px) pour s'aligner avec les labels presets row 2 → ~315px dispo
  // sur iPhone 375, le nom complet rentre. word-break:normal +
  // overflow-wrap:break-word préservés pour wrap propre sur noms très
  // longs (ex "Fender Stratocaster American Vintage II 1961").
  const guitarLabel = guitar ? `${guitar.name} (${guitar.type})` : null;
  const guitarScoreClean = (typeof guitarScore === 'number' && Number.isFinite(guitarScore) && guitarScore > 0)
    ? guitarScore : null;

  // Devices : pioche preset_ann (Pedal/Anniversary partagent) + preset_plug.
  // Filtre les entrées sans label OU sans bank+col (pas de slot installé).
  // S8.2 fix : bank != null (et pas juste truthy) — bank 0 existe pour
  // Pedal/Anniversary (FACTORY_BANKS_PEDALE_V2 démarre à 0). Sans ce
  // fix, preset_ann avec bank=0 (slot ex : 0A "CL DMBL") était filtré
  // et seul preset_plug s'affichait (Sébastien 25/05).
  // S9.13 — Helper lookup amp pour afficher le nom de l'ampli modélisé
  // plutôt que le preset name préfixé/abrégé (Sébastien : "Marshall JCM800"
  // au lieu de "TSR - Mars 800SL Chnl 1 Drive"). Fallback sur presetName
  // si pas d'entry catalog (ex : preset unknown ou guessed).
  const resolveAmp = (label) => {
    if (!label) return null;
    const entry = findCatalogEntry(label);
    if (!entry || entry.guessed) return null;
    return entry.amp || null;
  };
  const devices = [];
  const aiPA = aiC?.preset_ann;
  if (aiPA && aiPA.label && aiPA.bank != null && aiPA.col) {
    devices.push({
      deviceKey: 'tonex-anniversary',
      deviceLabel: DEVICE_SHORT_LABELS['tonex-anniversary'],
      slot: `${aiPA.bank}${aiPA.col}`,
      presetName: aiPA.label,
      ampLabel: resolveAmp(aiPA.label),
      presetScore: typeof aiPA.score === 'number' ? aiPA.score : null,
    });
  }
  const aiPP = aiC?.preset_plug;
  if (aiPP && aiPP.label && aiPP.bank != null && aiPP.col) {
    devices.push({
      deviceKey: 'tonex-plug',
      deviceLabel: DEVICE_SHORT_LABELS['tonex-plug'],
      slot: `${aiPP.bank}${aiPP.col}`,
      presetName: aiPP.label,
      ampLabel: resolveAmp(aiPP.label),
      presetScore: typeof aiPP.score === 'number' ? aiPP.score : null,
    });
  }

  // Potards + FX via le helper Phase 9.1/9.2 existant (S4-3a).
  const extras = formatRowPotardsFX(aiC);
  const potards = extras?.potards || null;
  const fxOn = extras?.fxOn || [];

  // absoluteScore : score combiné guitare + preset top (moyenne).
  // S8.7 (Sébastien 25/05) : le topScore du header faisait doublon avec
  // les scores inline (guitar + preset) déjà visibles dans la meta line.
  // Sens nouveau : moyenne(guitarScore, maxPresetScore) = "performance
  // globale de la combinaison guitar+preset pour ce morceau".
  let maxPresetScore = null;
  for (const d of devices) {
    if (d.presetScore != null && (maxPresetScore == null || d.presetScore > maxPresetScore)) {
      maxPresetScore = d.presetScore;
    }
  }
  let absoluteScore = null;
  if (guitarScoreClean != null && maxPresetScore != null) {
    absoluteScore = Math.round((guitarScoreClean + maxPresetScore) / 2);
  } else if (guitarScoreClean != null) {
    absoluteScore = guitarScoreClean;
  } else if (maxPresetScore != null) {
    absoluteScore = maxPresetScore;
  }

  const needsAnalysis = devices.length === 0 && guitarScoreClean == null;

  return {
    title,
    artist,
    guitarLabel,
    guitarScore: guitarScoreClean,
    isOptimalGuitar: !!isOptimalGuitar,
    devices,
    potards,
    fxOn,
    // topScore conservé en alias rétrocompat pour les consumers existants.
    // absoluteScore = la nouvelle sémantique "moyenne guitar+preset top".
    topScore: absoluteScore,
    absoluteScore,
    maxPresetScore,
    needsAnalysis,
  };
}

export { DEVICE_SHORT_LABELS };

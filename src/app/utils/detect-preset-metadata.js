// src/app/utils/detect-preset-metadata.js — Phase 7.69.7
//
// Combine inferPresetInfo (amp/gain/style depuis le nom) + inferCreator
// (Phase 7.69 regex creator) + defaults scores par style pour produire
// une metadata complète prête à entrer dans PRESET_CATALOG_MERGED.
//
// Utilisé par l'import pack admin (PacksTab.jsx) pour pré-remplir
// les entries d'un pack massivement, l'admin éditant ensuite si besoin.

import { inferPresetInfo } from './infer-preset.js';
import { inferCreator } from '../screens/MyCustomPresetsTab.jsx';

// Defaults scores par style — calibrés pour donner du scoring V9 OK
// même sans curation manuelle. L'admin peut éditer après.
// HB (humbucker), SC (single coil), P90 — sur 0-100.
const STYLE_SCORES = {
  blues:     { HB: 70, SC: 85, P90: 80 },
  rock:      { HB: 85, SC: 75, P90: 80 },
  hard_rock: { HB: 92, SC: 65, P90: 75 },
  jazz:      { HB: 70, SC: 80, P90: 78 },
  metal:     { HB: 95, SC: 60, P90: 70 },
  pop:       { HB: 75, SC: 78, P90: 76 },
};

const DEFAULT_SCORES = { HB: 75, SC: 75, P90: 75 };

/**
 * detectPresetMetadata(name) → { name, amp, gain, style, channel, creator, scores }
 *
 * Pré-remplit metadata depuis le nom du preset via heuristiques.
 * Tous les champs ont une valeur sensible par défaut (jamais undefined).
 */
export function detectPresetMetadata(name) {
  if (!name || typeof name !== 'string') {
    return {
      name: '',
      amp: 'Unknown',
      gain: 'mid',
      style: 'rock',
      channel: '',
      creator: '',
      scores: { ...DEFAULT_SCORES },
    };
  }
  const info = inferPresetInfo(name) || {};
  const creator = inferCreator(name);
  const style = info.style || 'rock';
  const scores = STYLE_SCORES[style] || DEFAULT_SCORES;
  return {
    name,
    amp: info.amp || 'Unknown',
    gain: info.gain || 'mid',
    style,
    channel: info.channel || '',
    creator,
    scores: { ...scores },
  };
}

/**
 * Détecte les noms qui sont déjà dans PRESET_CATALOG_MERGED (collision).
 * Retourne un Set des noms en conflit pour warning UI.
 *
 * @param {string[]} names - liste de noms à checker
 * @param {object} catalogMerged - PRESET_CATALOG_MERGED
 * @param {function} findCatalogEntry - depuis core/catalog.js
 */
export function findDuplicates(names, catalogMerged, findCatalogEntry) {
  const dups = new Set();
  for (const name of names) {
    if (!name) continue;
    // Exact match dans le catalog (pas le fuzzy/guessed)
    if (catalogMerged && catalogMerged[name]) {
      dups.add(name);
      continue;
    }
    // Fuzzy match : findCatalogEntry retourne un entry non-guessed si
    // une variante normalize est dans le catalog
    if (findCatalogEntry) {
      const entry = findCatalogEntry(name);
      if (entry && !entry.guessed) dups.add(name);
    }
  }
  return dups;
}

export { STYLE_SCORES, DEFAULT_SCORES };

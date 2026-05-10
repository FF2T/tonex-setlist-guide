// src/devices/tonex-anniversary/catalog.js — Phase 2 + 3.5 + 3.6.
// ToneX Pedal Anniversary (édition 30 ans IK Multimedia). Hardware identique
// à tonex-pedal côté banks (50 A/B/C), même storage profile.banksAnn en
// Phase 2 (split éventuel reporté en Phase 5).
//
// Différence clé : le filtre source accepte les captures Anniversary
// exclusives (150 captures groupées par source AA/JS/TJ/TSR/WT) qui ne
// se chargent pas sur la pédale standard.
//
// FACTORY_BANKS_ANNIVERSARY (Phase 3.6) :
// Construit dynamiquement à partir du ANNIVERSARY_CATALOG (150 captures
// déjà disponibles dans data_catalogs.js — visibles via filtre Sources →
// ToneX Anniversary). Les 150 noms de captures sont chunkés dans
// l'ordre de définition du catalog (déjà groupés par préfixe source
// AA → JS → TJ → TSR → WT) en 50 banks A/B/C consécutifs :
//   bank 0 → A=keys[0], B=keys[1], C=keys[2]
//   bank 1 → A=keys[3], B=keys[4], C=keys[5]
//   ...
//   bank 49 → A=keys[147], B=keys[148], C=keys[149]
// Mapping déterministe (cohérent entre rebuilds) ; il ne reproduit PAS
// la disposition usine officielle d'IK (introuvable publiquement) mais
// fournit un point de départ utilisable pour le bouton "Réinitialiser
// config usine" et regroupe les captures par préfixe d'auteur.
// L'utilisateur peut ensuite réorganiser ses banks via l'éditeur.

import { INIT_BANKS_ANN, ANNIVERSARY_CATALOG } from '../../data/data_catalogs.js';

function buildFactoryBanksAnniversary(catalog) {
  const keys = Object.keys(catalog);
  const banks = {};
  for (let i = 0; i < 50; i++) {
    const a = keys[i * 3] || '';
    const b = keys[i * 3 + 1] || '';
    const c = keys[i * 3 + 2] || '';
    banks[i] = { cat: '', A: a, B: b, C: c };
  }
  return banks;
}

const FACTORY_BANKS_ANNIVERSARY = buildFactoryBanksAnniversary(ANNIVERSARY_CATALOG);

const TONEX_ANNIVERSARY_CATALOG = {
  id: 'tonex-anniversary',
  label: 'ToneX Pedal Anniversary',
  icon: '🏭',
  description: 'Édition Anniversary — accès aux 150 captures Anniversary exclusives en plus du catalogue Pedal standard.',
  initBanks: INIT_BANKS_ANN,
  factoryBanks: FACTORY_BANKS_ANNIVERSARY,
  maxBanks: 50,
  slots: ['A', 'B', 'C'],
  excludedSources: ['PlugFactory'],
  bankStorageKey: 'banksAnn',
  presetResultKey: 'preset_ann',
  defaultEnabled: false,
  requiresPro: false,
  deviceKey: 'ann',
  deviceColor: 'var(--copper-400)',
};

function isPresetSourceCompatible(src) {
  if (!src) return true;
  return src !== 'PlugFactory';
}

export {
  INIT_BANKS_ANN, FACTORY_BANKS_ANNIVERSARY,
  buildFactoryBanksAnniversary,
  TONEX_ANNIVERSARY_CATALOG, isPresetSourceCompatible,
};

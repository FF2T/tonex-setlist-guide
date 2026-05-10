// src/devices/tonex-anniversary/catalog.js — Phase 2 + 3.5.
// ToneX Pedal Anniversary (édition 30 ans IK Multimedia). Hardware identique
// à tonex-pedal côté banks (50 A/B/C), même storage profile.banksAnn en
// Phase 2 (split éventuel reporté en Phase 5).
//
// Différence clé : le filtre source accepte les captures Anniversary
// exclusives qui ne se chargent pas sur la pédale standard.
//
// TODO Phase 5 — Factory presets Anniversary.
// L'Anniversary embarque ses propres 150 captures factory exclusives
// (Pyle, Dr Z, Two-Rock Anniversary, etc.), DIFFÉRENTES des 50 banks
// factory du tonex-pedal standard. La donnée exacte n'a pas encore été
// exportée dans data_catalogs.js — on ne dispose donc pas du mapping
// bank/slot → preset.
// Choix Phase 3.5 : factoryBanks = null. Conséquence : le bouton
// "Réinitialiser (config usine)" est masqué dans BankEditor (gated par
// `{factoryBanks && ...}` cf src/main.jsx:1317). Mieux vaut ne rien
// proposer que proposer un reset vers le mauvais firmware.
// À traiter Phase 5 : ajouter ANNIVERSARY_FACTORY_BANKS dans
// data_catalogs.js depuis l'export firmware Anniversary, puis brancher
// ici factoryBanks: ANNIVERSARY_FACTORY_BANKS.

import { INIT_BANKS_ANN } from '../../data/data_catalogs.js';

const TONEX_ANNIVERSARY_CATALOG = {
  id: 'tonex-anniversary',
  label: 'ToneX Pedal Anniversary',
  icon: '🏭',
  description: 'Édition Anniversary — accès aux 150 captures Anniversary exclusives en plus du catalogue Pedal standard.',
  initBanks: INIT_BANKS_ANN,
  factoryBanks: null, // TODO Phase 5 — cf header.
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
  INIT_BANKS_ANN,
  TONEX_ANNIVERSARY_CATALOG, isPresetSourceCompatible,
};

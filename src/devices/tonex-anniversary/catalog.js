// src/devices/tonex-anniversary/catalog.js — Phase 2.
// ToneX Pedal Anniversary (édition 30 ans IK Multimedia). Hardware identique
// à tonex-pedal côté banks (50 A/B/C), même storage profile.banksAnn en
// Phase 2 (split éventuel reporté en Phase 5).
//
// Différence clé : le filtre source accepte les captures Anniversary
// exclusives qui ne se chargent pas sur la pédale standard.

import { INIT_BANKS_ANN, FACTORY_BANKS_PEDALE } from '../../data/data_catalogs.js';

const TONEX_ANNIVERSARY_CATALOG = {
  id: 'tonex-anniversary',
  label: 'ToneX Pedal Anniversary',
  icon: '🏭',
  description: 'Édition Anniversary — accès aux 150 captures Anniversary exclusives en plus du catalogue Pedal standard.',
  initBanks: INIT_BANKS_ANN,
  factoryBanks: FACTORY_BANKS_PEDALE,
  maxBanks: 50,
  slots: ['A', 'B', 'C'],
  excludedSources: ['PlugFactory'],
  bankStorageKey: 'banksAnn',
  presetResultKey: 'preset_ann',
  defaultEnabled: false,
  requiresPro: false,
  deviceKey: 'ann',
};

function isPresetSourceCompatible(src) {
  if (!src) return true;
  return src !== 'PlugFactory';
}

export {
  INIT_BANKS_ANN, FACTORY_BANKS_PEDALE,
  TONEX_ANNIVERSARY_CATALOG, isPresetSourceCompatible,
};

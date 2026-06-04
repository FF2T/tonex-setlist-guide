// src/devices/tonex-one-plus/catalog.js — Phase ToneX One+.
// ToneX One+ : pédale compacte 2e génération, 20 presets À PLAT.
// Modèle identique à la ToneX One (20 banques × 1 slot A, slots:['A']).
//
// Les captures factory de la One+ ont des noms INÉDITS → source dédiée
// "OnePlusFactory" (ONE_PLUS_FACTORY_CATALOG dans data_catalogs.js).

import { INIT_BANKS_ONE_PLUS, FACTORY_BANKS_ONE_PLUS } from '../../data/data_catalogs.js';

const TONEX_ONE_PLUS_CATALOG = {
  id: 'tonex-one-plus',
  label: 'ToneX One+',
  icon: '🎛️',
  iconId: 'amp',
  description: 'ToneX One+ — pédale compacte 2e génération, 20 presets à plat.',
  initBanks: INIT_BANKS_ONE_PLUS,
  factoryBanks: FACTORY_BANKS_ONE_PLUS,
  maxBanks: 20,
  slots: ['A'],
  flatPresets: true,
  excludedSources: ['Anniversary', 'PlugFactory', 'Factory', 'FactoryV1'],
  bankStorageKey: 'banksOnePlus',
  presetResultKey: 'preset_one_plus',
  defaultEnabled: false,
  requiresPro: false,
  deviceKey: 'oneplus',
  deviceColor: 'var(--success)',
};

function isPresetSourceCompatible(src) {
  if (!src) return true;
  return src !== 'Anniversary' && src !== 'PlugFactory'
    && src !== 'Factory' && src !== 'FactoryV1';
}

export {
  INIT_BANKS_ONE_PLUS, FACTORY_BANKS_ONE_PLUS,
  TONEX_ONE_PLUS_CATALOG, isPresetSourceCompatible,
};

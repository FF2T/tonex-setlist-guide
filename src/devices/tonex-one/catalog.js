// src/devices/tonex-one/catalog.js — Phase ToneX One.
// ToneX One : pédale compacte, 20 presets À PLAT (1-20, pas de A/B/C).
// Modélisée en "20 banques × 1 slot A" (cf data_catalogs.js) pour
// réutiliser tout le moteur scoring/findInBanks/CSV sans toucher aux
// boucles ['A','B','C'] hardcodées. Le BankEditor reçoit slots:['A'].
//
// Les captures factory de la One sont les MÊMES Tone Models que la
// Pédale classique Factory v2 → source partagée "Factory" (pas de
// source dédiée). isPresetSourceCompatible rejette les factory des
// AUTRES devices.

import { INIT_BANKS_ONE, FACTORY_BANKS_ONE } from '../../data/data_catalogs.js';

const TONEX_ONE_CATALOG = {
  id: 'tonex-one',
  label: 'ToneX One',
  icon: '🎛️',
  iconId: 'amp',
  description: 'ToneX One — pédale compacte, 20 presets à plat.',
  initBanks: INIT_BANKS_ONE,
  factoryBanks: FACTORY_BANKS_ONE,
  maxBanks: 20,
  slots: ['A'],
  flatPresets: true,
  bankModel: 'flat',
  nbSlots: 20,
  excludedSources: ['Anniversary', 'PlugFactory', 'OnePlusFactory', 'FactoryV1'],
  bankStorageKey: 'banksOne',
  presetResultKey: 'preset_one',
  defaultEnabled: false,
  requiresPro: false,
  deviceKey: 'one',
  deviceColor: 'var(--brass-400)',
};

function isPresetSourceCompatible(src) {
  if (!src) return true;
  return src !== 'Anniversary' && src !== 'PlugFactory'
    && src !== 'OnePlusFactory' && src !== 'FactoryV1';
}

export {
  INIT_BANKS_ONE, FACTORY_BANKS_ONE,
  TONEX_ONE_CATALOG, isPresetSourceCompatible,
};

// src/app/utils/devices-render.js — Phase 7.14 (découpage main.jsx).
//
// Bridge entre `getDevicesForRender` (core/state.js — résout l'id-list
// depuis profile.enabledDevices avec fallback legacy) et
// `getEnabledDevices` (devices/registry.js — hydrate les objets device
// complets depuis le registry).
//
// Utilisé par tous les screens qui doivent itérer sur les devices
// activés pour un profil donné (RecapScreen, SongDetailCard, ListScreen,
// BankOptimizerScreen, …).

import { getDevicesForRender } from '../../core/state.js';
import { getEnabledDevices } from '../../devices/registry.js';

function getActiveDevicesForRender(profile) {
  const ids = getDevicesForRender(profile);
  return getEnabledDevices({ enabledDevices: ids });
}

export { getActiveDevicesForRender };

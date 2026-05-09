// src/devices/registry.js — Phase 2.
// Registre des devices supportés par l'app. Chaque device s'auto-enregistre
// depuis son module index.js (side-effect import).
//
// API publique :
// - registerDevice(d)       : appelé par chaque module device au chargement.
// - getDevice(id)           : récupère un device par id.
// - getAllDevices()         : liste tous les devices enregistrés.
// - getEnabledDevices(profile) : liste les devices activés pour un profil
//                                (lit profile.enabledDevices, fallback sur
//                                les devices defaultEnabled=true).
// - getDeviceMeta(id)       : metadata légère pour l'UI (label, icon, …).
// - isSrcCompatible(src, deviceKey) : LEGACY (Phase 1) — conservé pour
//                                les call sites main.jsx qui utilisent les
//                                clés courtes 'ann' et 'plug'. Nouveau code :
//                                préférer device.isPresetSourceCompatible(src).

const _devices = new Map();

function registerDevice(d) {
  if (!d || !d.id) throw new Error('registerDevice: device must have an id');
  _devices.set(d.id, d);
}

function getDevice(id) {
  return _devices.get(id);
}

function getAllDevices() {
  return [..._devices.values()];
}

function getEnabledDevices(profile) {
  if (!profile) return [];
  const enabled = profile.enabledDevices;
  if (Array.isArray(enabled)) {
    // Préserve l'ordre d'enregistrement des devices (= ordre du registry).
    return [..._devices.values()].filter((d) => enabled.includes(d.id));
  }
  // Fallback : profil v2 brut (pré-migration) ou état partiel — on prend
  // les devices marqués defaultEnabled=true. Le caller (RecapScreen, etc.)
  // doit gérer le cas liste vide via un message UI.
  return [..._devices.values()].filter((d) => d.defaultEnabled);
}

function getDeviceMeta(id) {
  const d = _devices.get(id);
  if (!d) return null;
  return {
    id: d.id,
    label: d.label,
    icon: d.icon,
    description: d.description,
    defaultEnabled: !!d.defaultEnabled,
    requiresPro: !!d.requiresPro,
  };
}

// LEGACY — Phase 1. Conserve les sémantiques 'ann' (= ToneX Anniversary,
// permissif : rejette PlugFactory uniquement) et 'plug' (= ToneX Plug :
// rejette Anniversary et Factory). Les call sites main.jsx existants qui
// passent ces deux clés courtes continuent de fonctionner sans breaking
// change. Pour les nouveaux call sites, utiliser device.isPresetSourceCompatible.
function isSrcCompatible(src, deviceKey) {
  if (!src) return true;
  if (deviceKey === 'ann') return src !== 'PlugFactory';
  if (deviceKey === 'plug') return src !== 'Anniversary' && src !== 'Factory';
  // Si on passe un device id complet (ex. 'tonex-pedal'), déléguer.
  const d = _devices.get(deviceKey);
  if (d && typeof d.isPresetSourceCompatible === 'function') {
    return d.isPresetSourceCompatible(src);
  }
  return true;
}

export {
  registerDevice,
  getDevice,
  getAllDevices,
  getEnabledDevices,
  getDeviceMeta,
  isSrcCompatible,
};

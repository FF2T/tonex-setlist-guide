// src/devices/registry.js — Phase 1, étape 4.
// Registre des devices supportés par l'app. Permet l'ajout d'un device
// (ToneX Pedal, ToneX Plug, et plus tard Tone Master Pro) sans toucher
// au code applicatif central — chaque device s'auto-enregistre depuis
// son module index.js.

const _devices = new Map();

function registerDevice(d) {
  if (!d || !d.id) throw new Error('registerDevice: device must have an id');
  _devices.set(d.id, d);
}

function getDevice(id) {
  return _devices.get(id);
}

function getEnabledDevices() {
  return [..._devices.values()];
}

// Vérifie si un preset (par sa source) est compatible avec un device.
// Anniversary + Factory = pédale only ; PlugFactory = plug only ;
// le reste (TSR, ML, ToneNET, custom) = compatible des deux.
// deviceKey : "ann" pour ToneX Pedal, "plug" pour ToneX Plug.
function isSrcCompatible(src, deviceKey) {
  if (!src) return true;
  if (deviceKey === 'ann') return src !== 'PlugFactory';
  if (deviceKey === 'plug') return src !== 'Anniversary' && src !== 'Factory';
  return true;
}

export { registerDevice, getDevice, getEnabledDevices, isSrcCompatible };

// src/app/components/SongCollapsedDeviceRows.jsx — Phase 2 fix.
// Composant extrait du rendu vue repliée d'un morceau dans ListScreen.
// Testable isolément : reçoit profile + aiC + banks + render row → produit
// une <div> par device activé avec presetData non-null.
//
// L'extraction garantit que la logique iterative est centralisée et que
// la vue repliée + tout autre rendu équivalent peut s'appuyer dessus.
// Il n'y a plus aucune référence en dur à preset_ann/preset_plug ou
// 📦/🔌 ici.

import React from 'react';
import { getDevicesForRender } from '../../core/state.js';
import { getEnabledDevices } from '../../devices/registry.js';

function getActiveDevicesForProfile(profile) {
  return getEnabledDevices({ enabledDevices: getDevicesForRender(profile) });
}

// Rend une liste de lignes compactes (une par device activé qui a un
// preset associé dans aiC). renderRow reçoit (device, banks, presetData)
// et retourne le JSX d'une ligne (par exemple le presetRow legacy).
//
// Si aucun device activé n'a de preset, retourne null (rien rendu).
function SongCollapsedDeviceRows({ profile, aiC, banksAnn, banksPlug, renderRow }) {
  const enabledDevices = getActiveDevicesForProfile(profile);
  const devicePresets = enabledDevices
    .map((d) => {
      const banks = d.bankStorageKey === 'banksAnn' ? banksAnn : banksPlug;
      const presetData = aiC?.[d.presetResultKey];
      return { d, banks, presetData };
    })
    .filter((x) => x.presetData);
  if (devicePresets.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
      {devicePresets.map(({ d, banks, presetData }) => (
        <React.Fragment key={d.id}>
          {renderRow(d, banks, presetData)}
        </React.Fragment>
      ))}
    </div>
  );
}

export default SongCollapsedDeviceRows;
export { getActiveDevicesForProfile };

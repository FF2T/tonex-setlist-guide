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

// Rend une liste de lignes compactes (une par device activé qui a soit
// un preset dans aiC, soit son propre composant device.RecommendBlock).
//
// Pour Tone Master Pro (Phase 3) : le device expose RecommendBlock dans
// sa metadata. Si présent, on rend ce composant à la place du
// presetRow legacy. Le RecommendBlock reçoit (song, guitar, profile)
// et calcule sa recommandation en interne (pas via aiCache.preset_*).
//
// Pour ToneX (pas de RecommendBlock) : comportement legacy inchangé,
// on lit aiC[d.presetResultKey] et on appelle renderRow.
//
// Si aucun device activé n'a de contenu, retourne null.
function SongCollapsedDeviceRows({
  profile, aiC, banksAnn, banksPlug, renderRow,
  song, guitar, allGuitars,
  // Phase 3.10 perf — props optionnelles pour éviter le travail
  // redondant lorsque ce composant est appelé en boucle (129 morceaux) :
  //   enabledDevices : devices déjà résolus en haut de l'écran (évite
  //                    129 × getEnabledDevices).
  //   precomputedTopRecBySongId : Map<songId, topRec> pour les devices
  //                    avec RecommendBlock (TMP) déjà précalculés via
  //                    un useMemo unique au niveau de l'écran.
  enabledDevices: enabledDevicesProp,
  precomputedTopRecBySongId,
}) {
  const enabledDevices = enabledDevicesProp || getActiveDevicesForProfile(profile);
  // Devices avec leur propre RecommendBlock (TMP) : rendus avec le composant.
  // Devices sans RecommendBlock (ToneX) : voie legacy presetRow.
  const items = enabledDevices.map((d) => {
    if (typeof d.RecommendBlock === 'function') {
      return { kind: 'component', d };
    }
    const banks = d.bankStorageKey === 'banksAnn' ? banksAnn : banksPlug;
    const presetData = aiC?.[d.presetResultKey];
    return { kind: 'legacy', d, banks, presetData };
  }).filter((x) => x.kind === 'component' || x.presetData);
  if (items.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
      {items.map((item) => {
        if (item.kind === 'component') {
          const Comp = item.d.RecommendBlock;
          const precomputedTopRec = precomputedTopRecBySongId
            && song && precomputedTopRecBySongId.get
            ? precomputedTopRecBySongId.get(song.id)
            : null;
          return (
            <Comp
              key={item.d.id}
              song={song}
              guitar={guitar}
              profile={profile}
              allGuitars={allGuitars}
              precomputedTopRec={precomputedTopRec}
            />
          );
        }
        return (
          <React.Fragment key={item.d.id}>
            {renderRow(item.d, item.banks, item.presetData)}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default SongCollapsedDeviceRows;
export { getActiveDevicesForProfile };

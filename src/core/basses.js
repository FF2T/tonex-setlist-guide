// src/core/basses.js — Phase 8.1 (basse).
//
// Catalog statique de basses iconiques pour le scoring V9-bass et les
// recos contextuelles. Pattern parallèle à `core/guitars.js` :
//   - id : slug stable (jamais renommé après publication)
//   - name : nom marketing complet (visible UI : badge full)
//   - short : abréviation compacte (badge ListScreen vue repliée)
//   - type : famille électronique pour scoring
//     - 'SC'  : single-coil (Jazz Bass 2 SC, Rickenbacker 4001 2 SC)
//     - 'PJ'  : split coil Precision Bass (mid-focus, punchy)
//     - 'HB'  : humbucker (Stingray, Höfner split coil HB)
//     - 'MM'  : Music Man humbucker (variante HB, plus de mids)
//   - brand : marque
//
// Phase 8.1 — 8 modèles iconiques + 2 modèles Sébastien
// (Jazz Bass Player Plus + Precision American Vintage II). Customs
// utilisateur extensibles via `profile.customBasses` (Phase 8.x future).

const BASSES = [
  // Fender — Sébastien
  {id:"jazz_bass_player_plus",name:"Fender Jazz Bass Player Plus",short:"Jazz Bass Player+",type:"SC",brand:"Fender"},
  {id:"precision_avri",name:"Fender Precision Bass American Vintage II",short:"P-Bass AVII",type:"PJ",brand:"Fender"},
  // Fender autres
  {id:"jazz_bass_standard",name:"Fender Jazz Bass Standard",short:"Jazz Bass",type:"SC",brand:"Fender"},
  {id:"precision_standard",name:"Fender Precision Bass Standard",short:"P-Bass",type:"PJ",brand:"Fender"},
  // Music Man
  {id:"stingray_classic",name:"Music Man Stingray Classic",short:"Stingray",type:"MM",brand:"Music Man"},
  // Rickenbacker
  {id:"rickenbacker_4001",name:"Rickenbacker 4001",short:"Rickenbacker 4001",type:"SC",brand:"Rickenbacker"},
  // Höfner
  {id:"hofner_violin",name:"Höfner 500/1 Violin Bass",short:"Höfner 500/1",type:"HB",brand:"Höfner"},
  // Sire (entrée de gamme moderne, équivalent Larry Carlton pour basse)
  {id:"sire_v5",name:"Sire Marcus Miller V5",short:"Sire V5",type:"SC",brand:"Sire"},
];

const BASS_BRANDS = [...new Set(BASSES.map(b => b.brand))];

// Phase 8.1 — Lookup parallèle à findGuitar. Fallback window.__allBasses
// pour les custom basses utilisateur (Phase 8.x future).
function findBass(id) {
  const b = BASSES.find(x => x.id === id);
  if (b) return b;
  if (typeof window !== 'undefined' && window.__allBasses) {
    const cb = window.__allBasses.find(x => x.id === id);
    if (cb) return cb;
  }
  return null;
}

export { BASSES, BASS_BRANDS, findBass };

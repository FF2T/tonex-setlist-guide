// src/core/sources.js — Phase 5 (Item F).
// Centralisation des constantes liées au champ `src` des entrées
// catalog (PRESET_CATALOG_MERGED). Le champ src identifie l'origine
// d'une capture preset :
//   TSR          → pack 64 Studio Rats (zip ToneNET)
//   ML           → AmpliTube ML Sound Lab Essentials
//   Anniversary  → captures factory ToneX Anniversary
//   Factory      → captures factory ToneX Pedal (non-Anniversary)
//   PlugFactory  → captures factory ToneX Plug
//   ToneNET      → preset partagé ToneNET
//   custom       → capture user-uploadée
//
// Le NOM "Anniversary" est ici la SOURCE de capture (origin), à ne pas
// confondre avec le device-id 'tonex-anniversary' du registry. La
// conflation a longtemps existé en code legacy ; centraliser ici les
// labels permet de remplacer les hardcodes par des imports.

const SOURCE_IDS = ['TSR', 'ML', 'Anniversary', 'Factory', 'PlugFactory', 'ToneNET', 'custom'];

// Label long pour les UI principales (filtres profil, ProfileTab,
// ViewProfileScreen, ExportImportScreen…).
const SOURCE_LABELS = {
  TSR: '64 Studio Rats',
  ML: 'ML Sound Lab Essentials',
  Anniversary: 'ToneX Anniversary Factory',
  Factory: 'ToneX Factory',
  PlugFactory: 'ToneX Plug Factory',
  ToneNET: 'ToneNET',
  custom: 'Custom',
};

// Badge court (≤ 8 char) pour les listes denses où on n'a pas la
// place du label long. `Pédale` est utilisé pour Anniversary parce
// que la source Anniversary couvre le device pédale standard
// historiquement (avant que le device tonex-anniversary soit splitté
// du device tonex-pedal en Phase 2).
const SOURCE_BADGES = {
  TSR: 'TSR',
  ML: 'ML',
  Anniversary: 'Pédale',
  Factory: 'Factory',
  PlugFactory: 'Plug',
  ToneNET: 'ToneNET',
  custom: 'Custom',
};

// Info riche pour les drawer : icon + label long. Utilisé par
// presetSourceInfo() pour afficher la provenance d'un preset dans
// la fiche détaillée.
const SOURCE_INFO = {
  TSR: { icon: '📦', label: 'Pack 64 Studio Rats (zip)' },
  ML: { icon: '🎚', label: 'ML Sound Lab Essentials' },
  ToneNET: { icon: '🌐', label: 'ToneNET (preset partagé)' },
  Anniversary: { icon: '🏭', label: 'ToneX Anniversary Factory' },
  Factory: { icon: '🏭', label: 'ToneX Factory' },
  PlugFactory: { icon: '🔌', label: 'ToneX Plug Factory' },
  custom: { icon: '✨', label: 'Preset custom' },
};

// Helper : badge court depuis un nom de preset. Retourne '' si
// source inconnue (bouton/label vide géré par le caller).
function getSourceBadge(srcId) {
  return SOURCE_BADGES[srcId] || '';
}

// Helper : info détaillée. Si l'entry a un .pack (cas TSR/custom), on
// l'inclut dans le label.
function getSourceInfo(entry) {
  if (!entry || !entry.src) return null;
  const base = SOURCE_INFO[entry.src];
  if (!base) return { icon: '📁', label: String(entry.src) };
  if (entry.src === 'TSR' && entry.pack) {
    return { icon: base.icon, label: `Pack 64 Studio Rats « ${entry.pack}.zip »` };
  }
  if (entry.src === 'custom' && entry.pack) {
    return { icon: base.icon, label: `Custom — ${entry.pack}` };
  }
  return base;
}

export {
  SOURCE_IDS,
  SOURCE_LABELS,
  SOURCE_BADGES,
  SOURCE_INFO,
  getSourceBadge,
  getSourceInfo,
};

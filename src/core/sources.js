// src/core/sources.js — Phase 5 (Item F), étendu Phase 7.47.
// Centralisation des constantes liées au champ `src` des entrées
// catalog (PRESET_CATALOG_MERGED). Le champ src identifie l'origine
// d'une capture preset :
//   TSR          → pack 64 Studio Rats (zip ToneNET)
//   ML           → AmpliTube ML Sound Lab Essentials
//   Anniversary  → captures factory ToneX Anniversary
//   Factory      → captures factory ToneX Pedal — firmware v2 (PDF 2025/04/03)
//   FactoryV1    → captures factory ToneX Pedal — firmware v1 (à fournir)
//   PlugFactory  → captures factory ToneX Plug
//   ToneNET      → preset partagé ToneNET
//   custom       → capture user-uploadée
//
// Le NOM "Anniversary" est ici la SOURCE de capture (origin), à ne pas
// confondre avec le device-id 'tonex-anniversary' du registry. La
// conflation a longtemps existé en code legacy ; centraliser ici les
// labels permet de remplacer les hardcodes par des imports.
//
// Phase 7.47 — ajout de FactoryV1 (additif, pas de migration). Factory
// continue de pointer sur les presets factory v2 actuels. Le hardware
// ToneX Pedal est identique entre v1 et v2 — seul change le firmware
// pré-installé (et donc la liste des presets factory).

// Phase 7.67 — Extension SOURCE_IDS pour le tab "📦 Mes presets custom"
// (MyCustomPacksTab). Permet à un beta-tester non-admin de tagger ses
// presets avec le pack creator d'origine (AA Amalgam Audio, JS Jason
// Sadites, TJ Tone Junkie TV, WT Worship Tutorials, Galtone). Ces
// sources sont commerciales (le user a acheté un pack standalone),
// donc gerées comme TSR/ML : présentes dans availableSources, filtrables
// dans Profil → Sources.
//
// IMPORTANT : les entries `ANNIVERSARY_PREMIUM_CATALOG` (Phase 7.52)
// gardent `src: "Anniversary"` (collection livrée avec la pédale
// Anniversary). Les nouvelles SOURCE_IDS AA/JS/TJ/WT/Galtone servent
// pour les packs STANDALONE achetés séparément par le user.
const SOURCE_IDS = ['TSR', 'ML', 'AA', 'JS', 'TJ', 'WT', 'Galtone', 'Anniversary', 'Factory', 'FactoryV1', 'PlugFactory', 'ToneNET', 'custom'];

// Label long pour les UI principales (filtres profil, ProfileTab,
// ViewProfileScreen, ExportImportScreen…).
// Phase 5.12 — labels révisés pour clarifier la distinction
// device (matériel ToneX) vs source (collection de presets factory).
const SOURCE_LABELS = {
  TSR: 'TSR — 64 Studio Rats Packs',
  ML: 'ML — ML Sound Lab Essentials',
  AA: 'Amalgam Audio — Packs standalone',
  JS: 'Jason Sadites — Packs standalone',
  TJ: 'Tone Junkie TV — Packs standalone',
  WT: 'Worship Tutorials — Packs standalone',
  Galtone: 'Galtone — Packs standalone',
  Anniversary: 'Anniversary — Captures pré-installées',
  Factory: 'Pédale classique v2 — Captures pré-installées',
  FactoryV1: 'Pédale classique v1 — Captures pré-installées',
  PlugFactory: 'Plug — Captures pré-installées',
  ToneNET: 'ToneNET — Presets téléchargés',
  // Phase 7.69 — label uniformisé "Mes presets custom" (alignement avec
  // le tab "📦 Mes presets custom"). TOUS les presets persos du user
  // ont src: "custom" peu importe leur creator déclaré (TSR/AA/...).
  // Le filtre custom = 1 toggle global pour activer/désactiver tous
  // les presets persos. AA/TSR/etc. dans Sources = catalogues curated
  // (par moi-curator ou par les studios), distincts des presets persos.
  custom: 'Mes presets custom',
};

// Phase 5.12 — Descriptions courtes affichées sous chaque label en
// onglet Sources. Aide à comprendre quand cocher quoi.
const SOURCE_DESCRIPTIONS = {
  TSR: 'Si tu as acheté un ou plusieurs des 64 packs The Studio Rats.',
  ML: 'Si tu as acheté le pack ML Sound Lab Essentials.',
  AA: 'Si tu as acheté un pack standalone Amalgam Audio.',
  JS: 'Si tu as acheté un pack standalone Jason Sadites.',
  TJ: 'Si tu as acheté un pack standalone Tone Junkie TV.',
  WT: 'Si tu as acheté un pack standalone Worship Tutorials.',
  Galtone: 'Si tu as acheté un pack standalone Galtone.',
  Anniversary: 'Si tu possèdes une ToneX Pédale Anniversary (rouge).',
  Factory: 'Si ta ToneX Pédale classique tourne sur le firmware v2 (presets 2025/04/03).',
  FactoryV1: 'Si ta ToneX Pédale classique tourne sur le firmware v1 (presets historiques).',
  PlugFactory: 'Si tu possèdes une ToneX Plug (la petite).',
  ToneNET: 'Presets gratuits téléchargés depuis tonenet.com.',
  custom: 'Tous les presets que tu as documentés via le tab "📦 Mes presets custom" (peu importe leur provenance déclarée : TSR, AA, JS, ToneNET, etc.).',
};

// Badge court (≤ 8 char) pour les listes denses où on n'a pas la
// place du label long. `Pédale` est utilisé pour Anniversary parce
// que la source Anniversary couvre le device pédale standard
// historiquement (avant que le device tonex-anniversary soit splitté
// du device tonex-pedal en Phase 2).
const SOURCE_BADGES = {
  TSR: 'TSR',
  ML: 'ML',
  AA: 'AA',
  JS: 'JS',
  TJ: 'TJ',
  WT: 'WT',
  Galtone: 'Galtone',
  Anniversary: 'Pédale',
  Factory: 'Fact v2',
  FactoryV1: 'Fact v1',
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
  AA: { icon: '🎚', label: 'Amalgam Audio (standalone)' },
  JS: { icon: '🎚', label: 'Jason Sadites (standalone)' },
  TJ: { icon: '🎚', label: 'Tone Junkie TV (standalone)' },
  WT: { icon: '🎚', label: 'Worship Tutorials (standalone)' },
  Galtone: { icon: '🎚', label: 'Galtone (standalone)' },
  ToneNET: { icon: '🌐', label: 'ToneNET (preset partagé)' },
  Anniversary: { icon: '🏭', label: 'ToneX Anniversary Factory' },
  Factory: { icon: '🏭', label: 'ToneX Pedal Factory (firmware v2)' },
  FactoryV1: { icon: '🏭', label: 'ToneX Pedal Factory (firmware v1)' },
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

// Phase 5.6 — vérifie qu'une source est activée dans availableSources.
// availableSources = { [srcId]: boolean } (cf. profile.availableSources).
// - Si la source est explicitement false → bloquée.
// - Sinon (true, undefined, ou availableSources null/undefined) → autorisée.
//
// Cette fonction garantit le comportement de fallback "permissif quand
// availableSources est manquant" (cas profil v3 stale ou tests sans
// config). Elle est utilisée par tous les call sites qui doivent
// respecter le choix utilisateur dans Profil → Sources : Optimiseur,
// SongDetailCard install, JamScreen, etc.
function isSourceAvailable(srcId, availableSources) {
  if (!srcId) return true;
  if (!availableSources) return true;
  return availableSources[srcId] !== false;
}

export {
  SOURCE_IDS,
  SOURCE_LABELS,
  SOURCE_DESCRIPTIONS,
  SOURCE_BADGES,
  SOURCE_INFO,
  getSourceBadge,
  getSourceInfo,
  isSourceAvailable,
};

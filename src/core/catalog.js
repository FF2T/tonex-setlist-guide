// src/core/catalog.js — extrait verbatim depuis main.jsx (Phase 1, étape 3).
// PRESET_CATALOG_MERGED : fusion des 6 catalogues (full, TSR pack,
// Anniversary, Factory, Plug Factory, condensed) en table indexée par nom.
// findCatalogEntry : lookup avec fuzzy matching et fallback sur
// guessPresetInfo (heuristique amp + gain depuis le nom).
// patchTsrPacks : enrichit l'entrée TSR du catalog avec le champ `pack`
// (utilisé pour l'affichage source/pack dans le PresetBrowser).
// normalizePresetName : utilitaire de comparaison souple.

import {
  PRESET_CATALOG, FACTORY_CATALOG, PLUG_FACTORY_CATALOG, TSR_PACK_CATALOG,
  ANNIVERSARY_CATALOG,
} from '../data/data_catalogs.js';
import { PRESET_CATALOG_FULL } from '../data/preset_catalog_full.js';
import { ANNIVERSARY_PREMIUM_CATALOG } from '../data/anniversary-premium-catalog.js';
import { resolveUsagesCascade } from './usages-cascade.js';

// Cherche un preset dans le catalogue par nom exact puis fuzzy.
// Phase 7.52 : ANNIVERSARY_PREMIUM_CATALOG est spread APRÈS ANNIVERSARY_CATALOG
// pour override les 150 entrées legacy (mêmes clés, metadata curées :
// packName, character, stomp, scores curés un à un, usages artiste/morceau).
const PRESET_CATALOG_MERGED = {...PRESET_CATALOG_FULL, ...TSR_PACK_CATALOG, ...ANNIVERSARY_CATALOG, ...ANNIVERSARY_PREMIUM_CATALOG, ...FACTORY_CATALOG, ...PLUG_FACTORY_CATALOG, ...PRESET_CATALOG};

// Phase 7.79.3a — applique la cascade d'overrides d'usages si elle est
// exposée sur window._usagesCascadeState. Retourne l'entry enrichie d'un
// champ `_usagesSource` ('user'|'studio'|'backline'|'default') pour que
// l'UI puisse afficher le badge approprié. Le champ `usages` de l'entry
// peut aussi être null si l'user a explicitement vidé l'override.
//
// Si pas de cascade state (Vitest, SSR, ou app pré-7.79.3) → no-op,
// l'entry catalog brute est retournée tel quel (rétro-compat).
function _applyUsagesCascade(name, entry) {
  if (typeof window === 'undefined') return entry;
  const state = window._usagesCascadeState;
  if (!state || typeof state !== 'object') return entry;
  const resolved = resolveUsagesCascade(name, {
    profileOv: state.profileOv,
    studioOv: state.studioOv,
    backlineOv: state.backlineOv,
    catalogEntry: entry,
  });
  // Pas d'override actif et pas de usages catalog → entry inchangée
  if (resolved.source === null && (!entry || !entry.usages)) return entry;
  // Source 'default' → on retourne l'entry telle quelle (les usages
  // viennent déjà du catalog). On annote quand même _usagesSource.
  const enriched = entry ? { ...entry } : {};
  if (resolved.source && resolved.source !== 'default') {
    // Override actif → remplace usages (peut être null = "vide explicite")
    enriched.usages = resolved.usages;
  }
  enriched._usagesSource = resolved.source || 'default';
  if (resolved.curatedBy) enriched._usagesCuratedBy = resolved.curatedBy;
  return enriched;
}

// Lookup catalog brut, sans appliquer la cascade. Utilisé en interne par
// findCatalogEntry (qui ajoute la cascade) et exposé pour tests/cases
// très spécifiques.
function _findCatalogEntryRaw(name){
  if(!name) return null;
  if(PRESET_CATALOG_MERGED[name]) return PRESET_CATALOG_MERGED[name];
  // Chercher dans les presets ToneNET saisis par l'utilisateur
  // (Phase 7.52.4 — guard typeof pour SSR/Vitest sans window)
  if(typeof window!=='undefined'&&window._toneNetLookup){
    var tnMatch=window._toneNetLookup[name];
    if(tnMatch) return tnMatch;
  }
  // Phase 7.52.4 — Match via toneModelName (Anniversary Premium Phase 7.52).
  // Le firmware Anniversary affiche le "Tone Model Name" (col 2 du PDF) dans
  // les banks, alors que mes keys catalog utilisent le "Preset Name" (col 1).
  // Quand les deux divergent (ex: PDF preset "TSR D13 Clean" vs toneModel
  // "TSR D13 Best Tweed Ever Clean"), l'utilisateur voit le toneModel dans
  // sa pédale. Sans ce fallback, findCatalogEntry retombait sur guessPresetInfo.
  for(const [k,v] of Object.entries(PRESET_CATALOG_MERGED)){
    if(v?.toneModelName && v.toneModelName === name) return v;
  }
  if(PRESET_CATALOG_MERGED["AA "+name]) return PRESET_CATALOG_MERGED["AA "+name];
  if(name.startsWith("AA ")&&PRESET_CATALOG_MERGED[name.slice(3)]) return PRESET_CATALOG_MERGED[name.slice(3)];
  const norm=normalizePresetName(name);
  for(const [k,v] of Object.entries(PRESET_CATALOG_MERGED)){
    if(normalizePresetName(k)===norm) return v;
  }
  // Phase 7.52.4 — Match via toneModelName en mode fuzzy (cas typos PDF
  // comme "Slylark" vs "Skylark", ou casse différente "LEAD" vs "Lead").
  for(const [k,v] of Object.entries(PRESET_CATALOG_MERGED)){
    if(v?.toneModelName && normalizePresetName(v.toneModelName)===norm) return v;
  }
  const normBase=norm.replace(/\s+\d+$/,"");
  if(normBase!==norm){
    for(const [k,v] of Object.entries(PRESET_CATALOG_MERGED)){
      if(normalizePresetName(k)===normBase) return v;
    }
  }
  // Preset inconnu (ToneNET, custom) — deviner les caractéristiques depuis le nom
  return guessPresetInfo(name);
}

// Phase 7.79.3a — findCatalogEntry applique la cascade d'usages
// (profile.usagesOverrides > shared.studioUsages > shared.usagesOverrides
// > catalog.entry.usages) sur le résultat brut. La cascade est lue depuis
// window._usagesCascadeState qui doit être maintenu à jour par l'App au
// boot et à chaque mutation (Phase 7.79.3c).
//
// Si aucune cascade state n'est exposée (Vitest, SSR, app pré-7.79.3),
// le comportement est identique à _findCatalogEntryRaw (rétro-compat).
//
// Effet sur les entries retournées :
//   - Sans override actif : entry inchangée
//   - Avec override 'user'/'studio'/'backline' : entry.usages remplacé
//     (peut être null si override "vide explicite") + flag _usagesSource
//   - Avec override de tout niveau matche default : entry inchangée
//     mais _usagesSource='default' ajouté pour cohérence
//
// Les entries 'guessed' (fallback guessPresetInfo) reçoivent aussi la
// cascade — un user peut tagger des usages sur un preset que findCatalogEntry
// n'a pas trouvé dans le catalog (cas rare mais valide).
function findCatalogEntry(name){
  const raw = _findCatalogEntryRaw(name);
  if (!raw) return null;
  return _applyUsagesCascade(name, raw);
}
function guessPresetInfo(name){
  if(!name) return null;
  var nl=name.toLowerCase();
  // Deviner l'ampli depuis le nom
  var amp="Unknown";
  var ampKeywords=[
    ["supergroup","Laney Supergroup"],["laney","Laney Supergroup"],
    ["plexi","Marshall Plexi"],["jcm","Marshall JCM800"],["jubilee","Marshall Silver Jubilee"],["jtm","Marshall JTM45"],["marshall","Marshall"],
    ["blackface","Fender Twin"],["twin","Fender Twin"],["deluxe","Fender Deluxe"],["bassman","Fender Bassman"],["princeton","Fender Princeton"],["champ","Fender Champ"],["fender","Fender"],
    ["ac30","Vox AC30"],["ac15","Vox AC15"],["vox","Vox AC30"],
    ["rectifier","Mesa Rectifier"],["boogie","Mesa Boogie"],["mark v","Mesa Mark V"],["mesa","Mesa Boogie"],
    ["bogner","Bogner"],["ecstasy","Bogner Ecstasy"],
    ["orange","Orange"],["rockerverb","Orange Rockerverb"],
    ["hiwatt","Hiwatt"],["soldano","Soldano"],["slo","Soldano"],
    ["friedman","Friedman"],["matchless","Matchless"],
    ["dumble","Dumble"],["ods","Dumble ODS"],["d-style","Dumble"],
    ["peavey","Peavey 5150"],["5150","Peavey 5150"],["evh","Peavey 5150"],
    ["two rock","Two Rock"],["tworock","Two Rock"],
    ["dr z","Dr. Z"],["z-wreck","Dr. Z"],["wreck","Dr. Z"],
    ["supro","Supro"],["engl","ENGL"],["diezel","Diezel"],
    ["traynor","Traynor"],["ampeg","Ampeg"],["park","Park"],
    ["divided","Divided by 13"],["d13","Divided by 13"],
    ["budda","Budda"],["bad cat","Bad Cat"],["carr","Carr"],
    ["cornford","Cornford"],["reinhardt","Reinhardt"],
  ];
  for(var i=0;i<ampKeywords.length;i++){
    if(nl.includes(ampKeywords[i][0])){amp=ampKeywords[i][1];break;}
  }
  // Deviner le gain
  var gain="mid";
  if(/\bclean\b|\bcln\b|\bclr\b/i.test(nl)) gain="low";
  else if(/\bhigh.?gain\b|\blead\b|\bdimed\b|\bmax\b|\bfull.?beans\b/i.test(nl)) gain="high";
  else if(/\bdrive\b|\bod\b|\bcrunch\b|\bgrit\b|\bboost\b/i.test(nl)) gain="mid";
  // Deviner le style depuis l'ampli
  var style="rock";
  if(amp.includes("Fender")||amp.includes("Princeton")||amp.includes("Twin")) style="blues";
  else if(amp.includes("Mesa")||amp.includes("Rectifier")||amp.includes("5150")||amp.includes("ENGL")||amp.includes("Diezel")||amp.includes("Laney")) style="hard_rock";
  else if(amp.includes("Vox")) style="rock";
  return {src:"ToneNET",amp:amp,gain:gain,style:style,scores:{HB:75,SC:75,P90:75},guessed:true};
}

// Normalise un nom de preset pour comparaison souple
// "TSR - Mars 800SL Ch1 Drive" et "TSR Mars 800SL Chnl 1 Drive" doivent matcher
function normalizePresetName(n){
  if(!n) return "";
  return n.toLowerCase()
    .replace(/[^a-z0-9]/g," ")       // ponctuation/tirets → espaces
    .replace(/(\d)([a-z])/g,"$1 $2") // "1Dirty" → "1 Dirty", "800SL" → "800 sl" (sépare chiffre+lettre)
    .replace(/([a-z])(\d)/g,"$1 $2") // "ch1" → "ch 1" (sépare lettre+chiffre)
    .replace(/\bchnl\b/g,"ch")        // chnl → ch
    .replace(/\bchanl?\b/g,"ch")      // chanl/chan → ch
    // Phase 7.69.3 — Abréviations gain courantes dans les noms de presets
    // (CSV exportés depuis ToneX Editor ou packs avec naming abrégé).
    // Évite de marquer "Mars 800SL Chnl 1 Cln" inconnu alors que
    // "Mars 800SL Chnl 1 Clean" existe dans le catalog.
    .replace(/\bcln\b/g,"clean")
    .replace(/\bclr\b/g,"clean")
    .replace(/\bdrv\b/g,"drive")
    .replace(/\s+/g," ").trim();      // espaces multiples → un seul
}

// Patch one-shot : certaines entrées TSR de PRESET_CATALOG_FULL n'ont pas le
// champ `pack` alors que TSR_PACK_CATALOG l'a. On enrichit PRESET_CATALOG_MERGED
// en cross-référençant via le nom normalisé pour que presetSourceInfo affiche
// le bon « <pack>.zip ».
(function patchTsrPacks(){
  if(typeof TSR_PACK_CATALOG==="undefined") return;
  const byNorm={};
  for(const [k,v] of Object.entries(TSR_PACK_CATALOG)){
    if(v?.src==="TSR"&&v.pack) byNorm[normalizePresetName(k)]=v.pack;
  }
  for(const [k,v] of Object.entries(PRESET_CATALOG_MERGED)){
    if(v?.src==="TSR"&&!v.pack){
      const p=byNorm[normalizePresetName(k)];
      if(p) PRESET_CATALOG_MERGED[k]={...v,pack:p};
    }
  }
})();

// Phase 7.69.5 — Suggestions fuzzy pour remapper un nom CSV inconnu
// vers un preset existant du catalog. Algo : strip prefix pack + alias
// expansion + token-set ratio ≥ threshold. Évite d'ajouter un custom
// alors qu'un alias existe déjà.

// Préfixes de packs à strip avant tokenize. "TSR " / "TSR-" / "AA "
// etc. ne doivent pas peser dans le ratio (le user peut omettre le
// préfixe dans son CSV).
const PACK_PREFIXES = ['tsr', 'aa', 'ml', 'js', 'tj', 'wt', 'galtone', 'tonenet'];

// Aliases bi-directionnels : expand vers la forme longue avant tokenize.
// Ex: "dlx" → "deluxe" pour matcher "Bumble Deluxe Cln 1" ↔ "TSR Bumble
// DLX CLN 1". Liste extensible si nouveaux cas remontent.
const PRESET_ALIASES = [
  [/\bdlx\b/g, 'deluxe'],
  [/\bcln\b/g, 'clean'],
  [/\bclr\b/g, 'clean'],
  [/\bdrv\b/g, 'drive'],
  [/\bod\b/g, 'overdrive'],
  [/\bch\b/g, 'channel'],
  [/\bchnl\b/g, 'channel'],
  [/\bchanl?\b/g, 'channel'],
  [/\bld\b/g, 'lead'],
  [/\bfman\b/g, 'fender'],
  [/\bmars\b/g, 'marshall'],
  [/\bmesa\b/g, 'mesa'],
];

// Stopwords purs (mots qui n'aident pas à différencier).
const STOPWORDS = new Set(['the', 'a', 'an', 'and', '&', '+']);

function expandAliases(name) {
  let s = name.toLowerCase();
  for (const [re, replacement] of PRESET_ALIASES) {
    s = s.replace(re, replacement);
  }
  return s;
}

function stripPackPrefix(normalized) {
  // Retire le premier token s'il est un préfixe pack. Idempotent
  // (ne strip qu'une fois — ex: "tsr aa foo" → "aa foo" mais c'est
  // un cas dégénéré pas vu en pratique).
  const tokens = normalized.split(' ');
  if (tokens.length > 0 && PACK_PREFIXES.includes(tokens[0])) {
    return tokens.slice(1).join(' ');
  }
  return normalized;
}

function tokenizeForMatch(name) {
  const expanded = expandAliases(name);
  const normalized = normalizePresetName(expanded);
  const stripped = stripPackPrefix(normalized);
  const tokens = stripped.split(' ').filter((t) => t && !STOPWORDS.has(t));
  return new Set(tokens);
}

/**
 * findCatalogSuggestions(name, options) → Array<{name, src, score, entry}>
 *
 * Retourne les meilleurs candidats catalog qui matchent fuzzy le nom
 * donné. Score = |intersection| / max(|setA|, |setB|).
 *
 * Options:
 *   threshold (default 0.7) : score min pour inclure dans les suggestions
 *   max (default 3) : nombre max de suggestions retournées
 *   excludeGuessed (default true) : skip les entries "guessed: true"
 *
 * Tri : score décroissant, tiebreak nom alpha.
 */
function findCatalogSuggestions(name, options = {}) {
  const { threshold = 0.7, max = 3, excludeGuessed = true } = options;
  if (!name || typeof name !== 'string') return [];
  const tokensA = tokenizeForMatch(name);
  if (tokensA.size === 0) return [];
  const candidates = [];
  for (const [key, entry] of Object.entries(PRESET_CATALOG_MERGED)) {
    if (!entry || (excludeGuessed && entry.guessed)) continue;
    if (key === name) continue; // exclu : c'est lui-même
    const tokensB = tokenizeForMatch(key);
    if (tokensB.size === 0) continue;
    let common = 0;
    for (const t of tokensA) { if (tokensB.has(t)) common++; }
    const score = common / Math.max(tokensA.size, tokensB.size);
    if (score >= threshold) {
      candidates.push({ name: key, src: entry.src, score, entry });
    }
  }
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });
  return candidates.slice(0, max);
}

// Phase 7.70 — Code couleur curation preset (BankEditor + SongDetailCard).
//
// Catégorise un nom de preset en 4 statuts visuels :
//   - 'unknown'        : pas dans le catalog, fallback guessPresetInfo
//   - 'known'          : dans le catalog mais pas d'usages → pas de pin IA
//   - 'curated-perso'  : src=custom OU src=ToneNET, avec usages
//   - 'curated-admin'  : src dans catalog statique, avec usages
//   - 'curated-studio' : Phase 11 future, flag entry.curatedBy === 'studio'
//
// Slot vide ('' ou null) → retourne null (pas de pastille).
const CURATED_ADMIN_SOURCES = new Set(['Factory', 'FactoryV1', 'Anniversary', 'PlugFactory', 'TSR', 'ML', 'AA', 'JS', 'TJ', 'WT', 'Galtone']);

function getPresetCurationStatus(name) {
  if (!name || typeof name !== 'string' || !name.trim()) return null;
  const entry = findCatalogEntry(name);
  if (!entry || entry.guessed === true) return 'unknown';
  const hasUsages = Array.isArray(entry.usages) && entry.usages.length > 0;
  if (!hasUsages) return 'known';
  // Curated avec usages → distinguer studio / admin / perso
  if (entry.curatedBy === 'studio') return 'curated-studio'; // Phase 11
  // Phase 7.69 : tous les presets saisis par user ont src=custom
  // (peu importe la provenance déclarée via creator). ToneNET tagué via
  // tab utilisateur = saisie perso également (cohérence Phase 7.53).
  if (entry.src === 'custom' || entry.src === 'ToneNET') return 'curated-perso';
  // Reste : catalog statique curé par admin (TSR, AA, JS, TJ, WT,
  // Galtone, ML, Anniversary, Factory).
  if (CURATED_ADMIN_SOURCES.has(entry.src)) return 'curated-admin';
  // Fallback : entry inconnu mais a des usages → traiter comme admin
  return 'curated-admin';
}

// Palette couleurs Phase 7.70 — user a tranché 2026-05-19 :
// - Bleu clair / moyen / foncé pour les 3 catégories curées (gradient)
// - Rouge wine inconnu, brass-jaune connu non-curé
const CURATION_COLORS = {
  unknown:         { dot: 'var(--wine-400)',   bg: 'rgba(155,58,44,0.15)',  border: 'rgba(155,58,44,0.4)' },
  known:           { dot: 'var(--brass-300)',  bg: 'rgba(218,165,32,0.15)', border: 'rgba(218,165,32,0.4)' },
  'curated-perso': { dot: '#7dd3fc',           bg: 'rgba(125,211,252,0.15)',border: 'rgba(125,211,252,0.4)' },
  'curated-admin': { dot: '#3b82f6',           bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)' },
  'curated-studio':{ dot: '#1e40af',           bg: 'rgba(30,64,175,0.15)',  border: 'rgba(30,64,175,0.4)' },
};

// Labels i18n-ready pour tooltip hover. L'appelant peut passer son
// propre `t` (i18n helper) ou utiliser les fallbacks FR.
function getCurationLabel(status) {
  switch (status) {
    case 'unknown':         return 'Inconnu — scoring dégradé, pas de pin IA possible';
    case 'known':           return 'Connu non curé — scoring V9 OK mais pas de pin direct artiste';
    case 'curated-perso':   return 'Curé perso — tu as enrichi ce preset avec des usages artiste/morceau';
    case 'curated-admin':   return 'Curé admin — preset enrichi par Sébastien dans le catalog Backline';
    case 'curated-studio':  return 'Curé studio — preset enrichi par son créateur (Phase 11)';
    default: return '';
  }
}

export { PRESET_CATALOG_MERGED, findCatalogEntry, guessPresetInfo, normalizePresetName, findCatalogSuggestions, getPresetCurationStatus, CURATION_COLORS, getCurationLabel };

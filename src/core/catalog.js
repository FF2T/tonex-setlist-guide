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

// Cherche un preset dans le catalogue par nom exact puis fuzzy.
// Phase 7.52 : ANNIVERSARY_PREMIUM_CATALOG est spread APRÈS ANNIVERSARY_CATALOG
// pour override les 150 entrées legacy (mêmes clés, metadata curées :
// packName, character, stomp, scores curés un à un, usages artiste/morceau).
const PRESET_CATALOG_MERGED = {...PRESET_CATALOG_FULL, ...TSR_PACK_CATALOG, ...ANNIVERSARY_CATALOG, ...ANNIVERSARY_PREMIUM_CATALOG, ...FACTORY_CATALOG, ...PLUG_FACTORY_CATALOG, ...PRESET_CATALOG};
function findCatalogEntry(name){
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

export { PRESET_CATALOG_MERGED, findCatalogEntry, guessPresetInfo, normalizePresetName };

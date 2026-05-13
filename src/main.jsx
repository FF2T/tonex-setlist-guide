// src/main.jsx — Phase 1 entry point.
// Code applicatif déplacé verbatim depuis ToneX_Setlist_Guide.html (script type=text/babel).
// Firestore helpers et enregistrement Service Worker déplacés depuis le <head>.
// React/ReactDOM/hooks importés depuis npm au lieu du CDN.
// Globals data files (PRESET_CATALOG_FULL, INIT_BANKS_*, PRESET_CONTEXT, AMP_TAXONOMY, …)
// importés en bindings nommés depuis src/data/.
// Comportement applicatif identique à la version monolithique.

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import LZString from 'lz-string';

import { PRESET_CATALOG_FULL } from './data/preset_catalog_full.js';
import {
  PRESET_CATALOG, FACTORY_CATALOG, PLUG_FACTORY_CATALOG, TSR_PACK_CATALOG,
  ANNIVERSARY_CATALOG,
} from './data/data_catalogs.js';

// ─── Devices (Phase 1, étape 4 + Phase 2 + Phase 3) ─────────────────
// Side-effect imports : auto-registration via registry.
import './devices/tonex-pedal/index.js';
import './devices/tonex-anniversary/index.js';
import './devices/tonex-plug/index.js';
import './devices/tonemaster-pro/index.js';
import { TMP_FACTORY_PATCHES, recommendTMPPatch } from './devices/tonemaster-pro/index.js';
import TmpBrowser from './devices/tonemaster-pro/Browser.jsx';
import { INIT_BANKS_ANN, FACTORY_BANKS_PEDALE } from './devices/tonex-pedal/index.js';
import { FACTORY_BANKS_ANNIVERSARY } from './devices/tonex-anniversary/index.js';
import { INIT_BANKS_PLUG, FACTORY_BANKS_PLUG } from './devices/tonex-plug/index.js';
import { isSrcCompatible, getAllDevices, getEnabledDevices } from './devices/registry.js';
import {
  PRESET_CONTEXT, AMP_TAXONOMY, EXTERNAL_PACK_CATALOG,
} from './data/data_context.js';

// ─── core/ extractions (Phase 1, étape 3) ───────────────────────────
import { GUITARS, GUITAR_BRANDS, findGuitar } from './core/guitars.js';
import { SONG_PRESETS, INIT_SONG_DB_META, SONG_HISTORY, getSongInfo } from './core/songs.js';
import LiveScreen from './app/screens/LiveScreen.jsx';
import { exportSetlistPdf } from './app/screens/SetlistPdfExport.js';
import { APP_NAME, APP_TAGLINE } from './core/branding.js';
import BacklineIcon from './app/components/BacklineIcon.jsx';
import { INIT_SETLISTS } from './core/setlists.js';
import {
  PRESET_CATALOG_MERGED, findCatalogEntry, guessPresetInfo, normalizePresetName,
} from './core/catalog.js';
import {
  SCORING_VERSION, SCORING_WEIGHTS,
  BASE_SCORES, GUITAR_PROFILES, STYLE_COMPATIBILITY, GAIN_RANGES,
  computeGainMatchScore, computeFinalScore, computeSimpleScore,
  computePickupScore, computeGuitarScoreV2,
  computeStyleMatchScore, computeRefAmpScore,
  inferGuitarProfile, findGuitarProfile,
  matchGuitarName, findGuitarByAIName, findCotEntryForGuitar,
  localGuitarSongScore, pickTopGuitar,
  guitarChoiceFeedback, localGuitarSettings,
  getGainRange, gainToNumeric, inferGainFromName,
} from './core/scoring/index.js';

// ─── État (Phase 2, étape 2) ────────────────────────────────────────
import {
  STATE_VERSION, LS_KEY, LS_KEY_V1,
  mergeBanks, makeDefaultProfile,
  migrateV1toV2, migrateV2toV3,
  ensureProfileV3, ensureProfilesV3, ensureProfileV4, ensureProfilesV4,
  ensureProfileV6, ensureProfilesV6,
  ensureSharedV7, ensureProfileV7, ensureProfilesV7,
  gcTombstones,
  mergeDeletedSetlistIds, mergeSetlistsLWW, mergeProfilesLWW,
  stripAiCacheForSync, mergeSongDbPreservingLocalAiCache,
  computeNewzikCreateNames, computeNewzikMergeNames,
  toggleSetlistProfile,
  getDevicesForRender,
  loadState, saveState,
  autoBackup, listBackups, restoreBackup, clearBackups,
  loadSecrets, saveSecrets,
  loadTrusted, isTrusted, setTrusted,
  getAllRigsGuitars, computeGuitarBiasFromFeedback, mergeGuitarBias,
  dedupSetlists, dedupSetlistsWithTombstones, findSetlistDuplicatesByName,
} from './core/state.js';
import {
  SOURCE_LABELS, SOURCE_DESCRIPTIONS, SOURCE_BADGES, SOURCE_INFO,
  getSourceBadge, getSourceInfo,
} from './core/sources.js';

// Phase 7.14 — extracted to src/app/utils/devices-render.js.
import { getActiveDevicesForRender } from './app/utils/devices-render.js';

// ─── App UI helpers + leaf components (Phase 1, étape 5) ────────────
import {
  scoreColor, scoreBg, scoreLabel, BREAKDOWN_LABELS,
} from './app/components/score-utils.js';
import Row from './app/components/Row.jsx';
import GuitarSilhouette from './app/components/GuitarSilhouette.jsx';
import NavIcon from './app/components/NavIcon.jsx';
import AppFooter from './app/components/AppFooter.jsx';
import Breadcrumb from './app/components/Breadcrumb.jsx';
import SongCollapsedDeviceRows from './app/components/SongCollapsedDeviceRows.jsx';

// Phase 7.14 — DEFAULT_GEMINI_KEY déplacé dans src/app/utils/shared-key.js
// (getSharedGeminiKey / setSharedGeminiKey). Les call sites inline qui le
// lisaient utilisent maintenant getSharedGeminiKey() directement.
import { getSharedGeminiKey, setSharedGeminiKey } from './app/utils/shared-key.js';

// ─── Service Worker ──────────────────────────────────────────────────
// Phase 7.8 : SW externalisé dans public/sw.js (copié dans dist/sw.js par
// Vite). L'ancienne approche blob URL (Phase 5.2 → 7.7) registrait un SW
// dont le scope vivait à blob:…, distinct de l'origine de la page → le SW
// ne contrôlait jamais les fetchs du document. L'offline était cassé
// silencieusement. Désormais ./sw.js a pour scope la racine du site et
// reprend en main offline + stale-while-revalidate. Bumper le CACHE dans
// public/sw.js à chaque release.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// ─── Firestore REST API (déplacé du <head>) ─────────────────────────
// Firestore REST API — no SDK needed, just fetch()
var FS_BASE="https://firestore.googleapis.com/v1/projects/tonex-guide/databases/(default)/documents";
var FS_KEY="AIzaSyAnaJMN-a47S9W_cTC60lKAnzRMAgHNMAA";
var _lastSavedSyncId=null;
var _lastRemoteSyncId=null;

// Phase 5.7.1 — strip aiCache du payload Firestore pour rester sous la
// limite document 1 MiB. Le state local (localStorage) conserve les
// aiCache ; uniquement la sérialisation Firestore les exclut.
function saveToFirestore(s){
  // Phase 6 — push opportuniste de l'aiCache si le payload total tient
  // sous la limite Firestore. On teste d'abord la taille avec aiCache.
  // Si <800 KB → push avec (résout les ⏳ sur les autres devices).
  // Sinon → strip (fallback Phase 5.7.1).
  var SAFE_LIMIT=800*1024;
  var ts=(s&&s.shared&&typeof s.shared.lastModified==="number")?s.shared.lastModified:Date.now();
  var sid=Date.now().toString(36)+Math.random().toString(36).slice(2);
  _lastSavedSyncId=sid;
  // Helper interne pour préparer un clean d'un state donné.
  var prep=function(stateIn){
    var c=JSON.parse(JSON.stringify(stateIn));
    c.syncId=sid;
    if(c.profiles){for(var pid in c.profiles){if(c.profiles[pid].aiKeys)c.profiles[pid].aiKeys={anthropic:"",gemini:""};}}
    return c;
  };
  // Tente d'abord avec aiCache complet.
  var cleanFull=prep(s);
  var payloadFull=JSON.stringify(cleanFull);
  var sharedAi=true;
  var compressed=null;
  var clean=cleanFull;
  var payload=payloadFull;
  if(payloadFull.length>=SAFE_LIMIT){
    // Phase 6.1 — tenter la compression lz-string sur le payload complet
    // avec aiCache. JSON répétitif → ratio typique 4-6×. Si compressé <
    // SAFE_LIMIT, on push compressé. Sinon fallback strip Phase 5.7.1.
    compressed=LZString.compressToBase64(payloadFull);
    if(compressed.length<SAFE_LIMIT){
      console.log("[firestore] Push WITH aiCache COMPRESSED (raw "+(payloadFull.length/1024).toFixed(0)+" KB → compressed "+(compressed.length/1024).toFixed(0)+" KB).");
      payload=null; // on push compressed seul, pas data
    }else{
      // Toujours trop gros même compressé : fallback strip.
      sharedAi=false;
      compressed=null;
      var light=stripAiCacheForSync(s);
      clean=prep(light);
      payload=JSON.stringify(clean);
      console.log("[firestore] Push WITHOUT aiCache (compressed "+(LZString.compressToBase64(payloadFull).length/1024).toFixed(0)+" KB still ≥ "+(SAFE_LIMIT/1024)+" KB limit). After strip: "+(payload.length/1024).toFixed(0)+" KB.");
    }
  }else{
    console.log("[firestore] Push WITH aiCache opportunistic (size "+(payloadFull.length/1024).toFixed(0)+" KB < "+(SAFE_LIMIT/1024)+" KB limit).");
  }
  // Sanity check. Firestore document limit = 1 MiB.
  // Phase 6.1 — la taille effective qu'on push est compressed||payload.
  var actualPayload=compressed||payload;
  var sz=actualPayload.length;
  if(sz>=1000000){
    console.error("[firestore] Payload "+(sz/1024).toFixed(0)+" KB ≥ 1 MB — push aborted (would 400). songs="+(clean.shared&&clean.shared.songDb?clean.shared.songDb.length:0));
    return Promise.reject(new Error("Payload too large: "+sz+" bytes"));
  }
  if(sz>800*1024){
    console.warn("[firestore] Payload "+(sz/1024).toFixed(0)+" KB approche la limite 1 MB.");
  }
  // Phase 6.1 — si compressed, on push UNIQUEMENT dans dataCompressed.
  // Les anciens clients qui lisent data verront vide → fallback sur
  // dataCompressed s'ils sont mis à jour. Side-by-side incompatible
  // briefly avec anciens clients qui ne savent pas lire dataCompressed.
  var fields={syncId:{stringValue:sid},ts:{integerValue:String(ts)}};
  if(compressed){
    fields.dataCompressed={stringValue:compressed};
    // On push aussi data="" pour signaler aux anciens clients qu'il faut
    // upgrade (sinon ils continuent à lire l'ancien doc cached).
    fields.data={stringValue:""};
  }else{
    fields.data={stringValue:payload};
  }
  var body={fields:fields};
  return fetch(FS_BASE+"/sync/state?key="+FS_KEY,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
    .then(function(r){
      if(!r.ok){
        console.error("[firestore] Save failed: HTTP "+r.status+" (payload "+(sz/1024).toFixed(0)+" KB).");
        throw new Error("Firestore save: "+r.status);
      }
      return r.json();
    })
    .catch(function(e){
      console.error("[firestore] Save error:",e);
      throw e;
    });
}

function loadFromFirestore(){
  return fetch(FS_BASE+"/sync/state?key="+FS_KEY)
    .then(function(r){if(!r.ok)return null;return r.json();})
    .then(function(doc){
      if(!doc||!doc.fields)return null;
      // Phase 6.1 — priorité au format compressé si présent.
      if(doc.fields.dataCompressed&&doc.fields.dataCompressed.stringValue){
        try{
          var decompressed=LZString.decompressFromBase64(doc.fields.dataCompressed.stringValue);
          if(decompressed){
            var parsed=JSON.parse(decompressed);
            _lastRemoteSyncId=doc.fields.syncId?doc.fields.syncId.stringValue:null;
            console.log("[firestore] Pull WITH aiCache (compressed → "+(decompressed.length/1024).toFixed(0)+" KB).");
            return parsed;
          }
        }catch(e){console.warn("[firestore] Decompress failed, fallback to data:",e);}
      }
      // New format: JSON stored in a single "data" string field
      if(doc.fields.data&&doc.fields.data.stringValue){
        var parsed=JSON.parse(doc.fields.data.stringValue);
        _lastRemoteSyncId=doc.fields.syncId?doc.fields.syncId.stringValue:null;
        return parsed;
      }
      // Legacy format: native Firestore fields from old SDK — convert inline
      try{
        var f=doc.fields;
        var legacy=firestoreToJs(f);
        _lastRemoteSyncId=legacy.syncId||null;
        return legacy;
      }catch(e){console.warn("Legacy parse failed:",e);return null;}
    })
    .catch(function(e){console.error("loadFromFirestore:",e);return null;});
}
// Convert Firestore REST value format to plain JS
function firestoreToJs(fields){
  var result={};
  for(var k in fields){
    result[k]=fsVal(fields[k]);
  }
  return result;
}
function fsVal(v){
  if(v.stringValue!==undefined)return v.stringValue;
  if(v.integerValue!==undefined)return Number(v.integerValue);
  if(v.doubleValue!==undefined)return v.doubleValue;
  if(v.booleanValue!==undefined)return v.booleanValue;
  if(v.nullValue!==undefined)return null;
  if(v.mapValue)return firestoreToJs(v.mapValue.fields||{});
  if(v.arrayValue)return(v.arrayValue.values||[]).map(fsVal);
  return null;
}

// Poll for remote syncId changes (lightweight — only reads syncId+ts fields)
function pollRemoteSyncId(){
  return fetch(FS_BASE+"/sync/state?key="+FS_KEY+"&mask.fieldPaths=syncId&mask.fieldPaths=ts")
    .then(function(r){if(!r.ok)return null;return r.json();})
    .then(function(doc){
      if(!doc||!doc.fields||!doc.fields.syncId)return null;
      return doc.fields.syncId.stringValue;
    })
    .catch(function(){return null;});
}

function loadSharedKey(){
  return fetch(FS_BASE+"/config/apikeys?key="+FS_KEY)
    .then(function(r){if(!r.ok)return;return r.json();})
    .then(function(doc){if(doc&&doc.fields&&doc.fields.gemini)setSharedGeminiKey(doc.fields.gemini.stringValue);})
    .catch(function(){});
}
function saveSharedKey(key){
  var body={fields:{gemini:{stringValue:key}}};
  return fetch(FS_BASE+"/config/apikeys?key="+FS_KEY,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}).catch(function(){});
}

// ─── Code applicatif (verbatim depuis <script type="text/babel">) ───
//     Lignes 365-7400 du HTML monolithe — sans la redéclaration
//     `var DEFAULT_GEMINI_KEY = ""` (déjà ci-dessus) ni le destructuring
//     `const {useState,useMemo,useEffect,useRef} = React` (remplacé par
//     les imports nommés).

// ─── Clé localStorage ─────────────────────────────────────────────────────────

// Phase 7.14 — TSR_PACK_ZIPS + TSR_PACK_GROUPS extracted to src/data/tsr-packs.js.
import { TSR_PACK_ZIPS, TSR_PACK_GROUPS } from './data/tsr-packs.js';

// Phase 7.14 — ScoreWithBreakdown + PBlock extracted to src/app/components/PBlock.jsx.
import PBlock, { ScoreWithBreakdown } from './app/components/PBlock.jsx';

// Phase 7.14 — FeedbackPanel + FEEDBACK_TAGS extracted to src/app/components/FeedbackPanel.jsx.
import FeedbackPanel, { FEEDBACK_TAGS } from './app/components/FeedbackPanel.jsx';


// ─── Factory bank presets (ToneX Pedal / ToneX Plug) ─────────────────────────


// ─── Catalogue ML Sound Lab Essentials + presets custom ────────────────────────
// scores = pertinence 0-100 selon type de guitare : HB=humbucker, SC=single coil, P90
// style: "hard_rock" | "rock" | "blues" | "clean" | "metal"
// ─ IMPORTANT : même style = alternatives valables pour un même morceau ─────────




// ─── ToneX Pedal Factory Presets ───────────────────────────────────────────────
// ─── ToneX Plug Factory Presets ───────────────────────────────────────────────
// ─── TSR 64 Pack (additional presets) ──────────────────────────────────────────
// ─── Anniversary Factory Presets (150) ────────────────────────────────────────

// ─── Catalogue complet (auto-généré depuis les packs TSR/ML) ─────────────────

// ─── Contexte musical par ampli ───────────────────────────────────────────────
// Utilisé par PresetBrowser pour enrichir chaque preset de ses références musicales

// Couleur selon score
// Seuils V2 : 80+ excellent (fidèle au son original), 65+ bon, 50+ acceptable, <50 mauvais
// Phase 5 (Item F) — labels/badges/info centralisés dans core/sources.js.
function srcBadge(name){return getSourceBadge(findCatalogEntry(name)?.src);}
function presetSourceInfo(entry){
  return getSourceInfo(entry);
}
// isSrcCompatible : importé depuis ./devices/registry.js (étape 4).
function styleBadge(style){const l={hard_rock:"Hard Rock",rock:"Rock",blues:"Blues",jazz:"Jazz",pop:"Pop",metal:"Metal"}[style]||style;return <span className="badge badge-brass">{l}</span>;}
function gainBadge(gain){const l={low:"Low",mid:"Mid",high:"High"}[gain]||gain;return <span className="badge badge-wine">{l} gain</span>;}

// Phase 7.14 — extracted to src/app/utils/song-helpers.js (normalize + dup)
// and src/app/utils/preset-helpers.js (findInBanks, worstSlot,
// findBestAvailable, getInstallRec, guitarScore, presetScore, COMPAT_STYLES).
import {
  normalizeSongTitle, normalizeArtist, findDuplicateSong,
} from './app/utils/song-helpers.js';
import {
  COMPAT_STYLES,
  guitarScore, presetScore,
  findInBanks, worstSlot, findBestAvailable, getInstallRec,
} from './app/utils/preset-helpers.js';

// Phase 7.14 — CC/CL extracted to src/app/utils/ui-constants.js.
import { CC, CL, TYPE_LABELS, TYPE_COLORS } from './app/utils/ui-constants.js';

// ─── Helpers song (data access) ──────────────────────────────────────
// Phase 7.14 — extracted to src/app/utils/song-helpers.js.
import {
  getPA, getPP, getSet, getGr, getIg, getTsr, getTsrRef, getSongHist,
} from './app/utils/song-helpers.js';

const getType = id => findGuitar(id)?.type||"HB";

// ─── localStorage ─────────────────────────────────────────────────────────────
const APP_VERSION = "8.14.15";
const ADMIN_PIN = "212402";


// ─── Export/Import JSON ───────────────────────────────────────────────────────
function exportJSON(state) {
  const blob = new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=`backline_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── Export/Import CSV ────────────────────────────────────────────────────────
function generateCSV(banks, deviceName) {
  const rows=[["Pédale","Bank","Catégorie","Slot","Type","Preset"]];
  Object.entries(banks).sort((a,b)=>Number(a[0])-Number(b[0])).forEach(([k,v])=>{
    ["A","B","C"].forEach(c=>{rows.push([deviceName,k,v.cat,c,CL[c],v[c]||""]);});
  });
  return rows.map(r=>r.map(cell=>`"${String(cell).replace(/"/g,'""')}"`).join(",")).join("\n");
}
function downloadFile(content,filename,type="text/csv;charset=utf-8;") {
  try {
    const bom = type.includes("csv") ? "\uFEFF" : "";
    const blob=new Blob([bom+content],{type});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  } catch(e){console.error(e);}
}
function parseCSV(text) {
  const lines=text.split(/\r?\n/).filter(l=>l.trim());
  if(lines.length<2) return null;
  const sep=lines[0].includes(";")?";":",";
  const parseLine=line=>{
    const res=[];let cur="",inQ=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ;}
      else if(ch===sep&&!inQ){res.push(cur.trim());cur="";}else cur+=ch;
    }
    res.push(cur.trim());return res;
  };
  const header=parseLine(lines[0]).map(h=>h.toLowerCase().replace(/["""]/g,"").trim());
  const iDevice=header.findIndex(h=>h.includes("pédale")||h.includes("pedale"));
  const iBank=header.findIndex(h=>h==="bank"||h.includes("bank"));
  const iCat=header.findIndex(h=>h.includes("catég")||h.includes("categ")||h.includes("cat"));
  const iSlot=header.findIndex(h=>h==="slot");
  const iPreset=header.findIndex(h=>h==="preset");
  const iA=header.findIndex(h=>h.startsWith("preset a"));
  const iB=header.findIndex(h=>h.startsWith("preset b"));
  const iC=header.findIndex(h=>h.startsWith("preset c"));
  const isWide=iA>=0&&iB>=0&&iC>=0;
  if(iBank===-1) return null;
  if(!isWide&&(iSlot===-1||iPreset===-1)) return null;
  const ann={},plug={};
  for(let i=1;i<lines.length;i++){
    const cols=parseLine(lines[i]);if(cols.length<2)continue;
    const bank=parseInt(cols[iBank]);if(isNaN(bank))continue;
    const cat=iCat>=0?cols[iCat]||"":"";
    const device=(iDevice>=0?cols[iDevice]||"":"").toLowerCase();
    const target=device.includes("plug")?plug:ann;
    if(isWide){
      const pA=iA>=0?cols[iA]||"":"",pB=iB>=0?cols[iB]||"":"",pC=iC>=0?cols[iC]||"":"";
      if(!target[bank])target[bank]={cat,A:"",B:"",C:""};
      if(cat)target[bank].cat=cat;if(pA)target[bank].A=pA;if(pB)target[bank].B=pB;if(pC)target[bank].C=pC;
    } else {
      const slot=(cols[iSlot]||"").toUpperCase(),preset=cols[iPreset]||"";
      if(!["A","B","C"].includes(slot))continue;
      if(!target[bank])target[bank]={cat,A:"",B:"",C:""};
      if(cat&&!target[bank].cat)target[bank].cat=cat;
      target[bank][slot]=preset;
    }
  }
  return {ann,plug};
}

// ─── Composants UI ────────────────────────────────────────────────────────────
const s = (base) => ({...base});


// Phase 7.14 — GuitarSelect extracted to src/app/components/GuitarSelect.jsx.
import GuitarSelect from './app/components/GuitarSelect.jsx';

// ─── Breadcrumb ──────────────────────────────────────────────────────────────
// crumbs = [{label,screen},{label,screen},...,{label}]  — le dernier est l'écran courant (non cliquable)
// Phase 7.14 — StatusDot extracted to src/app/components/StatusDot.jsx.
import StatusDot from './app/components/StatusDot.jsx';
function AppHeader({profiles,activeProfileId,onProfile,screen,onNavigate,isAdmin,syncStatus}){
  var profileName=(profiles[activeProfileId]||{}).name||"";
  var c=profileColor(activeProfileId);
  var NAV_ITEMS=[
    {id:"list",label:"Accueil"},
    {id:"setlists",label:"Setlists"},
    {id:"explore",label:"Explorer"},
    {id:"jam",label:"Jammer"},
    {id:"optimizer",label:"Optimiser"},
  ];
  return <div>
    {/* Header bar — fixed on mobile */}
    <div className="app-header-bar" style={{display:"flex",alignItems:"center",gap:8,padding:"8px var(--s-3,12px)",background:"var(--surface-card,var(--bg-card))",borderBottom:"1px solid var(--border-subtle,var(--a8))"}}>
      <button onClick={onProfile} style={{background:c,color:"var(--text-inverse)",border:"none",borderRadius:"var(--r-pill,50%)",width:32,height:32,fontSize:14,fontWeight:800,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}} title={profileName}>{profileName[0]?.toUpperCase()||"?"}</button>
      <div style={{flex:1,minWidth:0,display:"flex",alignItems:"center",gap:6}}>
        <BacklineIcon size={20} color="var(--brass-300)"/>
        <div style={{fontSize:14,fontWeight:800,color:"var(--text-primary)",fontFamily:"var(--font-display,system-ui)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{APP_NAME}</div>
      </div>
      {syncStatus&&<span style={{fontSize:10,color:syncStatus==="synced"?"var(--status-success,var(--green))":syncStatus==="syncing"?"var(--status-warning,var(--yellow))":"var(--text-dim)"}}>{syncStatus==="synced"?"☁️":syncStatus==="syncing"?"⏳":"⚠️"}</span>}
      <span style={{fontSize:9,color:"var(--text-dim)",fontFamily:"var(--font-mono,monospace)"}}>v{APP_VERSION}</span>
    </div>
    {/* Desktop nav — inline tabs in header */}
    <div className="nav-desktop" style={{display:"none",gap:4,marginBottom:12}}>
      {NAV_ITEMS.map(function(item){
        var active=screen===item.id;
        return <button key={item.id} onClick={function(){onNavigate(item.id);}} style={{background:active?"var(--accent-soft,rgba(129,140,248,0.1))":"transparent",border:active?"1px solid var(--border-accent,rgba(129,140,248,0.3))":"1px solid transparent",color:active?"var(--accent,#818cf8)":"var(--text-tertiary,var(--text-muted))",borderRadius:"var(--r-md,8px)",padding:"6px 12px",fontSize:12,fontWeight:active?700:500,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}><NavIcon id={item.id} size={16}/>{item.label}</button>;
      })}
    </div>
  </div>;
}
function AppNavBottom({screen,onNavigate}){
  var NAV_ITEMS=[
    {id:"list",icon:"🏠",label:"Accueil"},
    {id:"setlists",icon:"🎵",label:"Setlists"},
    {id:"explore",label:"Explorer"},
    {id:"jam",label:"Jammer"},
    {id:"optimizer",label:"Optimiser"},
  ];
  return <div className="nav-mobile" style={{display:"flex",position:"fixed",bottom:0,left:0,right:0,background:"var(--surface-card,var(--bg-card))",borderTop:"1px solid var(--border-subtle,var(--a8))",zIndex:50,paddingBottom:"max(4px,env(safe-area-inset-bottom))"}}>
    {NAV_ITEMS.map(function(item){
      var active=screen===item.id;
      return <button key={item.id} onClick={function(){onNavigate(item.id);}} style={{flex:1,background:"none",border:"none",color:active?"var(--accent,#818cf8)":"var(--text-tertiary,var(--text-muted))",padding:"8px 0 4px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
        <NavIcon id={item.id} size={20}/>
        <span style={{fontSize:9,fontWeight:active?700:500}}>{item.label}</span>
      </button>;
    })}
  </div>;
}


// ─── Calcul algorithmique des meilleurs presets ──────────────────────────────
// Phase 7.14 — Helpers extraits vers src/app/utils/ai-helpers.js
// (AMP_ALIASES, resolveRefAmp, computeBestPresets, enrichAIResult,
// mergeBestResults, bestScoreOf, preserveHistorical, computeRigSnapshot,
// updateAiCache, getBestResult, safeParseJSON).
import {
  AMP_ALIASES,
  resolveRefAmp,
  computeBestPresets,
  enrichAIResult,
  mergeBestResults,
  bestScoreOf,
  preserveHistorical,
  HISTORICAL_FIELDS,
  computeRigSnapshot,
  updateAiCache,
  getBestResult,
  safeParseJSON,
} from './app/utils/ai-helpers.js';

// Phase 7.14 — fetchAI extracted to src/app/utils/fetchAI.js.
import { fetchAI } from './app/utils/fetchAI.js';



// ─── Export/Import Screen ─────────────────────────────────────────────────────
function ExportImportScreen({banksAnn,onBanksAnn,banksPlug,onBanksPlug,onBack,onNavigate,fullState,onImportState}) {
  const [exported,setExported]=useState(null);
  const [importData,setImportData]=useState(null);
  const [importErr,setImportErr]=useState(null);
  const [importMode,setImportMode]=useState("merge");
  const [toast,setToast]=useState(null);
  const csvRef=useRef(null);
  const jsonRef=useRef(null);
  const flash=msg=>{setToast(msg);setTimeout(()=>setToast(null),2500);};

  const doExportCSV=(banks,name,key)=>{try{downloadFile(generateCSV(banks,name),`ToneX_${key}.csv`);setExported(key);setTimeout(()=>setExported(null),2000);}catch(e){}};
  const doExportAll=()=>{try{const c1=generateCSV(banksAnn,"ToneX Anniversary");const c2=generateCSV(banksPlug,"ToneX Plug").split("\n").slice(1).join("\n");downloadFile(c1+"\n"+c2,"ToneX_Tous_Presets.csv");setExported("all");setTimeout(()=>setExported(null),2000);}catch(e){}};
  const doExportJSON=()=>{exportJSON(fullState);flash("Sauvegarde JSON exportée ✅");};

  const handleCSVFile=e=>{
    const file=e.target.files[0];if(!file)return;setImportErr(null);
    const reader=new FileReader();
    reader.onload=ev=>{try{const p=parseCSV(ev.target.result);if(!p){setImportErr("Format non reconnu.");return;}setImportData(p);}catch(err){setImportErr("Erreur : "+err.message);}};
    reader.readAsText(file,"UTF-8");e.target.value="";
  };
  const handleJSONFile=e=>{
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const data=JSON.parse(ev.target.result);
        onImportState(data);
        flash("Import JSON réussi ✅");
      }catch(err){setImportErr("Fichier JSON invalide.");}
    };
    reader.readAsText(file,"UTF-8");e.target.value="";
  };
  const confirmCSV=()=>{
    if(!importData)return;
    if(importMode==="replace"){if(Object.keys(importData.ann).length>0)onBanksAnn(importData.ann);if(Object.keys(importData.plug).length>0)onBanksPlug(importData.plug);}
    else{if(Object.keys(importData.ann).length>0)onBanksAnn(p=>({...p,...importData.ann}));if(Object.keys(importData.plug).length>0)onBanksPlug(p=>({...p,...importData.plug}));}
    setImportData(null);flash("Import CSV réussi ✅");
  };

  const xBtn=(onClick,key,label,color)=>(
    <button onClick={onClick} style={{background:exported===key?"var(--green-border)":color,border:"none",color:"var(--text)",borderRadius:"var(--r-lg)",padding:"10px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}}>
      {exported===key?"✅ OK":label}
    </button>
  );
  const th={padding:"7px 10px",textAlign:"left",fontSize:11,fontWeight:700,textTransform:"uppercase",borderBottom:"2px solid var(--a10)",color:"var(--text-sec)"};
  const td={padding:"6px 10px",fontSize:11,borderBottom:"1px solid var(--a5)",verticalAlign:"middle"};

  return (
    <div>
      {toast&&<div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:"var(--green)",color:"var(--text)",borderRadius:"var(--r-lg)",padding:"10px 22px",fontSize:13,fontWeight:700,zIndex:999}}>✅ {toast}</div>}
      <Breadcrumb crumbs={[{label:"Accueil",screen:"list"},{label:"Paramètres",screen:"settings"},{label:"Import / Export"}]} onNavigate={onNavigate}/>
      <div style={{fontFamily:"var(--font-display)",fontSize:"var(--fs-lg)",fontWeight:800,color:"var(--text-primary)",marginBottom:20}}>📋 Export / Import</div>

      {/* Sauvegarde JSON */}
      <div style={{background:"var(--green-bg)",border:"1px solid var(--green-border)",borderRadius:"var(--r-lg)",padding:16,marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:700,color:"var(--green)",marginBottom:10,fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"var(--tracking-wider)"}}>💾 Sauvegarde complète (JSON)</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={doExportJSON} style={{background:"var(--green)",border:"none",color:"var(--text)",borderRadius:"var(--r-lg)",padding:"10px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}}>⬇ Exporter JSON</button>
          <button onClick={()=>jsonRef.current?.click()} style={{background:"rgba(74,222,128,0.15)",border:"1px solid rgba(74,222,128,0.35)",color:"var(--green)",borderRadius:"var(--r-lg)",padding:"10px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}}>📂 Importer JSON</button>
          <input ref={jsonRef} type="file" accept=".json" onChange={handleJSONFile} style={{display:"none"}}/>
        </div>
        <div style={{fontSize:11,color:"var(--text-muted)",marginTop:8}}>Sauvegarde complète : setlists, morceaux, presets, banks. Parfait pour sauvegarder ou transférer entre appareils.</div>
      </div>

      {/* Export CSV */}
      <div style={{background:"var(--a3)",border:"1px solid var(--a7)",borderRadius:"var(--r-lg)",padding:16,marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:700,color:"var(--text-sec)",marginBottom:12,fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"var(--tracking-wider)"}}>Export CSV (Banks)</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {xBtn(()=>doExportCSV(banksAnn,"ToneX Anniversary","Anniversary"),"Anniversary","⬇ Anniversary","var(--brass-300)")}
          {xBtn(()=>doExportCSV(banksPlug,"ToneX Plug","Plug"),"Plug","⬇ Plug","var(--accent)")}
          {xBtn(doExportAll,"all","⬇ Les deux","var(--brass-500)")}
        </div>
      </div>

      {/* Import CSV */}
      <div style={{background:"var(--a3)",border:"1px solid var(--a7)",borderRadius:"var(--r-lg)",padding:16,marginBottom:16}}>
        <div style={{fontSize:12,fontWeight:700,color:"var(--text-sec)",marginBottom:12,fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"var(--tracking-wider)"}}>Import CSV (Banks)</div>
        <button onClick={()=>csvRef.current?.click()} style={{background:"var(--yellow-bg)",border:"1px solid rgba(251,191,36,0.35)",color:"var(--yellow)",borderRadius:"var(--r-lg)",padding:"10px 16px",fontSize:13,fontWeight:700,cursor:"pointer",marginBottom:8}}>📂 Charger CSV</button>
        <input ref={csvRef} type="file" accept=".csv,.txt" onChange={handleCSVFile} style={{display:"none"}}/>
        {importErr&&<div style={{marginTop:8,fontSize:12,color:"var(--red)",background:"rgba(239,68,68,0.1)",borderRadius:"var(--r-md)",padding:"8px 12px"}}>{importErr}</div>}
        {importData&&<div style={{marginTop:14,background:"var(--accent-soft)",border:"1px solid var(--accent-border)",borderRadius:"var(--r-lg)",padding:14}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--accent)",marginBottom:10}}>Aperçu</div>
          <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap"}}>
            {Object.keys(importData.ann).length>0&&<div style={{background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.3)",borderRadius:"var(--r-md)",padding:"6px 12px"}}><div style={{fontSize:12,color:"var(--text-sec)",fontWeight:700}}>📦 Pedale</div><div style={{fontSize:11,color:"var(--text-muted)"}}>{Object.keys(importData.ann).length} banks</div></div>}
            {Object.keys(importData.plug).length>0&&<div style={{background:"var(--accent-soft)",border:"1px solid var(--accent-border)",borderRadius:"var(--r-md)",padding:"6px 12px"}}><div style={{fontSize:12,color:"var(--accent)",fontWeight:700}}>🔌 Plug</div><div style={{fontSize:11,color:"var(--text-muted)"}}>{Object.keys(importData.plug).length} banks</div></div>}
          </div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            {[{v:"replace",l:"🔄 Remplacer"},{v:"merge",l:"🔀 Fusionner"}].map(({v,l})=>(
              <button key={v} onClick={()=>setImportMode(v)} style={{flex:1,background:importMode===v?"var(--accent-bg)":"var(--a5)",border:importMode===v?"1px solid var(--border-accent)":"1px solid var(--a10)",color:importMode===v?"var(--accent)":"var(--text-sec)",borderRadius:"var(--r-md)",padding:"8px",fontSize:12,fontWeight:600,cursor:"pointer"}}>{l}</button>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setImportData(null)} style={{flex:1,background:"var(--a7)",border:"1px solid var(--a10)",color:"var(--text-sec)",borderRadius:"var(--r-md)",padding:"9px",fontSize:12,fontWeight:600,cursor:"pointer"}}>Annuler</button>
            <button onClick={confirmCSV} style={{flex:2,background:"var(--accent)",border:"none",color:"var(--text)",borderRadius:"var(--r-md)",padding:"9px",fontSize:13,fontWeight:700,cursor:"pointer"}}>✅ Importer</button>
          </div>
        </div>}
      </div>

      {/* Tableaux banks */}
      {[{banks:banksAnn,label:"ToneX Anniversary",color:"var(--accent)"},{banks:banksPlug,label:"ToneX Plug",color:"var(--accent)"}].map(({banks,label,color})=>(
        <div key={label} style={{marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}><div style={{width:4,height:18,background:color,borderRadius:"var(--r-xs)"}}/><div style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>{label}</div><div style={{fontSize:11,color:"var(--text-muted)"}}>{Object.keys(banks).length} banks</div></div>
          <div style={{overflowX:"auto",borderRadius:"var(--r-lg)",border:"1px solid var(--a8)"}}>
            <table>
              <thead><tr style={{background:"var(--a4)"}}><th style={{...th,width:45}}>Bank</th><th style={th}>Catégorie</th>{["A","B","C"].map(c=><th key={c} style={{...th,color:CC[c]}}>{c} — {CL[c]}</th>)}</tr></thead>
              <tbody>
                {Object.entries(banks).sort((a,b)=>Number(a[0])-Number(b[0])).map(([k,v],i)=>(
                  <tr key={k} style={{background:i%2===0?"transparent":"var(--a3)"}}>
                    <td style={{...td,fontWeight:800,color:color,fontSize:13}}>{k}</td>
                    <td style={{...td,color:"var(--text-sec)"}}>{v.cat}</td>
                    {["A","B","C"].map(c=><td key={c} style={td}><span style={{color:"var(--text-bright)"}}>{v[c]}</span></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── BankEditor ───────────────────────────────────────────────────────────────
function PresetSearchModal({onSelect,onClose,toneNetPresets}){
  const [q,setQ]=useState("");
  const allPresets=useMemo(()=>{
    return Object.entries(PRESET_CATALOG_MERGED).sort((a,b)=>a[0].localeCompare(b[0]));
  },[toneNetPresets]);
  const results=useMemo(()=>{
    if(!q.trim()) return allPresets.slice(0,30);
    const lq=q.toLowerCase();
    return allPresets.filter(([n,info])=>n.toLowerCase().includes(lq)||info.amp.toLowerCase().includes(lq)).slice(0,30);
  },[q,allPresets]);
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:14,fontWeight:700,color:"var(--text)"}}>Chercher un preset</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--text-muted)",fontSize:18,cursor:"pointer"}}>✕</button>
        </div>
        <input autoFocus placeholder="Nom du preset ou ampli..." value={q} onChange={e=>setQ(e.target.value)} style={{width:"100%",background:"var(--bg-elev-1)",color:"var(--text)",border:"1px solid var(--a15)",borderRadius:"var(--r-md)",padding:"9px 12px",fontSize:13,boxSizing:"border-box",marginBottom:10}}/>
        <div style={{maxHeight:"50vh",overflowY:"auto"}}>
          {results.map(([name,info])=>(
            <button key={name} onClick={()=>onSelect(name)} style={{display:"block",width:"100%",textAlign:"left",background:"var(--a3)",border:"1px solid var(--a6)",borderRadius:"var(--r-md)",padding:"8px 10px",marginBottom:3,cursor:"pointer"}}>
              <div style={{fontSize:12,fontWeight:600,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
              <div style={{fontSize:10,color:"var(--text-muted)"}}>{info.amp} · {SOURCE_LABELS[info.src]||info.src}</div>
            </button>
          ))}
          {results.length===0&&<div style={{fontSize:12,color:"var(--text-dim)",textAlign:"center",padding:16}}>Aucun preset trouvé</div>}
        </div>
      </div>
    </div>
  );
}

function fuzzyMatch(query,catalog){
  const norm=normalizePresetName(query);
  const words=norm.split(" ").filter(w=>w.length>1);
  return Object.entries(catalog).map(([name,info])=>{
    const nn=normalizePresetName(name);
    let score=0;
    words.forEach(w=>{if(nn.includes(w))score+=w.length;});
    // Bonus for same start
    if(nn.startsWith(words[0]||""))score+=5;
    return {name,info,score};
  }).filter(r=>r.score>3).sort((a,b)=>b.score-a.score).slice(0,5);
}

function FuzzyPresetMatch({name,bank,slot,onAccept,onSearch,onManual,onClose}){
  const suggestions=useMemo(()=>fuzzyMatch(name,PRESET_CATALOG_MERGED),[name]);
  return(
    <div style={{background:"var(--a4)",border:"1px solid var(--a8)",borderRadius:"var(--r-md)",padding:10}}>
      <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:6}}>Preset non trouvé : <b style={{color:"var(--text)"}}>{name}</b></div>
      {suggestions.length>0&&<div style={{marginBottom:8}}>
        <div style={{fontSize:10,color:"var(--text-dim)",marginBottom:4}}>Presets approchants :</div>
        {suggestions.map(s=>(
          <button key={s.name} onClick={()=>onAccept(s.name)} style={{display:"block",width:"100%",textAlign:"left",background:"var(--green-bg)",border:"1px solid var(--green-border)",borderRadius:"var(--r-md)",padding:"6px 8px",marginBottom:3,cursor:"pointer"}}>
            <div style={{fontSize:11,fontWeight:600,color:"var(--text)"}}>{s.name}</div>
            <div style={{fontSize:9,color:"var(--text-muted)"}}>{s.info.amp} · {SOURCE_LABELS[s.info.src]||s.info.src}</div>
          </button>
        ))}
      </div>}
      {suggestions.length===0&&<div style={{fontSize:10,color:"var(--text-dim)",marginBottom:8}}>Aucun preset approchant trouvé.</div>}
      <div style={{display:"flex",gap:6}}>
        <button onClick={onSearch} style={{background:"var(--accent)",border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-md)",padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Rechercher</button>
        <button onClick={onManual} style={{background:"var(--a7)",border:"none",color:"var(--text-sec)",borderRadius:"var(--r-md)",padding:"5px 10px",fontSize:11,cursor:"pointer"}}>Saisie manuelle</button>
        <button onClick={onClose} style={{background:"var(--a7)",border:"none",color:"var(--text-sec)",borderRadius:"var(--r-md)",padding:"5px 10px",fontSize:11,cursor:"pointer"}}>Fermer</button>
      </div>
    </div>
  );
}

function BankEditor({banks,onBanks,color,maxBanks,startBank,factoryBanks,toneNetPresets}) {
  const start=startBank||0;
  const max=maxBanks||50;
  const [confirmReset,setConfirmReset]=useState(false);
  const [selectedPreset,setSelectedPreset]=useState(null); // {bank,slot,name}
  const [editingPreset,setEditingPreset]=useState(null); // {bank,slot} — search mode
  const [customInput,setCustomInput]=useState(null); // {bank,slot} — manual input
  const inp={background:"var(--bg-card)",color:"var(--text)",border:"1px solid var(--a15)",borderRadius:"var(--r-md)",padding:"5px 8px",fontSize:11,width:"100%",boxSizing:"border-box"};
  const edit=(k,f,v)=>onBanks(p=>({...p,[k]:{...(p[k]||{cat:"",A:"",B:"",C:""}),[f]:v}}));
  const resetFactory=()=>{if(factoryBanks){onBanks({...factoryBanks});setConfirmReset(false);}};
  const allBanks=[];
  for(let i=start;i<start+max;i++){allBanks.push([String(i),banks[i]||{cat:"",A:"",B:"",C:""}]);}

  const selInfo=selectedPreset?findCatalogEntry(selectedPreset.name):null;

  return (
    <div>
      {/* Reset factory button */}
      {factoryBanks&&<div style={{marginBottom:12}}>
        {!confirmReset?<button onClick={()=>setConfirmReset(true)} style={{background:"var(--yellow-bg)",border:"1px solid var(--yellow-border)",color:"var(--yellow)",borderRadius:"var(--r-md)",padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>Réinitialiser (config usine)</button>
        :<div style={{background:"var(--red-bg)",border:"1px solid var(--red-border)",borderRadius:"var(--r-lg)",padding:12}}>
          <div style={{fontSize:12,color:"var(--red)",fontWeight:600,marginBottom:8}}>Revenir à la configuration d'usine ? Toutes tes modifications seront perdues.</div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={resetFactory} style={{background:"var(--red)",border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-md)",padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Oui, réinitialiser</button>
            <button onClick={()=>setConfirmReset(false)} style={{background:"var(--a7)",border:"none",color:"var(--text-sec)",borderRadius:"var(--r-md)",padding:"6px 12px",fontSize:12,cursor:"pointer"}}>Annuler</button>
          </div>
        </div>}
      </div>}

      {/* Search modal */}
      {editingPreset&&<PresetSearchModal toneNetPresets={toneNetPresets} onClose={()=>setEditingPreset(null)} onSelect={name=>{
        edit(editingPreset.bank,editingPreset.slot,name);
        setEditingPreset(null);
      }}/>}

      {allBanks.map(([k,v])=>{
        const empty=!v.A&&!v.B&&!v.C;
        return <div key={k} style={{background:empty?"transparent":"var(--a3)",border:empty?"1px solid var(--a5)":"1px solid var(--a7)",borderRadius:"var(--r-md)",padding:"8px 10px",marginBottom:4}}>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <span style={{fontSize:12,fontWeight:800,color,minWidth:24}}>{k}</span>
            {["A","B","C"].map(c=>{
              const name=v[c]||"";
              const isSel=selectedPreset&&selectedPreset.bank===k&&selectedPreset.slot===c;
              const isCustom=customInput&&customInput.bank===k&&customInput.slot===c;
              const notInDb=name&&!findCatalogEntry(name);
              return <div key={c} style={{flex:1,minWidth:0}}>
                <button onClick={()=>{if(!name){setEditingPreset({bank:k,slot:c});setCustomInput(null);}else{setSelectedPreset(isSel?null:{bank:k,slot:c,name});setCustomInput(null);}}}
                  style={{display:"flex",alignItems:"center",gap:3,width:"100%",background:isSel?"var(--accent-bg)":notInDb?"var(--yellow-bg)":"transparent",border:isSel?"1px solid var(--accent-border)":notInDb?"1px solid var(--yellow-border)":"1px solid transparent",borderRadius:"var(--r-sm)",padding:"3px 4px",cursor:"pointer",textAlign:"left"}}>
                  <span style={{fontSize:10,fontWeight:700,color:CC[c],flexShrink:0}}>{c}</span>
                  <span style={{fontSize:10,color:name?"var(--text-bright)":"var(--text-dim)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{name||"—"}</span>
                </button>
              </div>;
            })}
          </div>
          {/* Detail card for selected preset */}
          {selectedPreset&&selectedPreset.bank===k&&<div style={{marginTop:6,animation:"slideDown .2s ease-out"}}>
            {selInfo?<div>
              <PresetDetailInline name={selectedPreset.name} info={selInfo} banksAnn={banks} banksPlug={banks}/>
              <div style={{display:"flex",gap:6,marginTop:6}}>
                <button onClick={()=>{setEditingPreset({bank:k,slot:selectedPreset.slot});setSelectedPreset(null);}} style={{background:"var(--accent)",border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-md)",padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Modifier</button>
                <button onClick={()=>setSelectedPreset(null)} style={{background:"var(--a7)",border:"none",color:"var(--text-sec)",borderRadius:"var(--r-md)",padding:"5px 10px",fontSize:11,cursor:"pointer"}}>Fermer</button>
              </div>
            </div>
            :<FuzzyPresetMatch name={selectedPreset.name} bank={k} slot={selectedPreset.slot} onAccept={(name)=>{edit(k,selectedPreset.slot,name);setSelectedPreset(null);}} onSearch={()=>{setEditingPreset({bank:k,slot:selectedPreset.slot});setSelectedPreset(null);}} onManual={()=>{setCustomInput({bank:k,slot:selectedPreset.slot});setSelectedPreset(null);}} onClose={()=>setSelectedPreset(null)}/>}
          </div>}
          {/* Custom input for manual entry */}
          {customInput&&customInput.bank===k&&<div style={{marginTop:6,display:"flex",gap:6,alignItems:"center"}}>
            <span style={{fontSize:10,fontWeight:700,color:CC[customInput.slot]}}>{customInput.slot}</span>
            <input autoFocus value={v[customInput.slot]||""} onChange={e=>edit(k,customInput.slot,e.target.value)} style={{...inp,flex:1}} placeholder="Nom du preset custom"/>
            <button onClick={()=>setCustomInput(null)} style={{background:"var(--accent)",border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-sm)",padding:"4px 10px",fontSize:10,fontWeight:700,cursor:"pointer"}}>OK</button>
          </div>}
        </div>;
      })}
    </div>
  );
}

// ─── Profile Picker (startup) ─────────────────────────────────────────────────
function ProfilePickerScreen({profiles,onPick}){
  const [selectedId,setSelectedId]=useState(null);
  const [pwd,setPwd]=useState("");
  const [pwdErr,setPwdErr]=useState(false);
  const [remember,setRemember]=useState(true);
  const pwdRef=useRef(null);
  useEffect(()=>{if(selectedId&&profiles[selectedId]?.password)setTimeout(()=>pwdRef.current?.focus(),50);},[selectedId]);
  const pickWith=(id)=>{
    const p=profiles[id];if(!p)return;
    if(!p.password){onPick(id);return;}
    if(isTrusted(id)){onPick(id);return;}
    setSelectedId(id);setPwd("");setPwdErr(false);setRemember(true);
  };
  const tryLogin=()=>{
    const p=profiles[selectedId];
    if(!p)return;
    if(!p.password||p.password===pwd){
      if(p.password)setTrusted(selectedId,remember);
      onPick(selectedId);
    }
    else{setPwdErr(true);}
  };
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"80vh",padding:20}}>
      <div style={{fontSize:32,marginBottom:8}}>🎸</div>
      <div style={{fontFamily:"var(--font-display)",fontSize:"var(--fs-xl)",fontWeight:800,color:"var(--text-primary)",marginBottom:4}}>{APP_NAME}</div>
      <div style={{fontSize:13,color:"var(--text-muted)",marginBottom:32}}>Qui joue aujourd'hui ?</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,width:"100%",maxWidth:400,marginBottom:16}}>
        {Object.values(profiles).sort((a,b)=>a.name.localeCompare(b.name)).map(p=>{
          const c=profileColor(p.id);
          const sel=selectedId===p.id;
          const trusted=p.password&&isTrusted(p.id);
          return <button key={p.id} onClick={()=>pickWith(p.id)} style={{background:sel?"var(--accent-bg)":"var(--a4)",border:sel?"2px solid var(--accent)":"2px solid var(--a10)",borderRadius:"var(--r-xl)",padding:"24px 12px",cursor:"pointer",textAlign:"center",transition:"all .15s"}}>
            <div style={{background:c,color:"var(--text-inverse)",borderRadius:"var(--r-pill)",width:48,height:48,fontSize:22,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px"}}>{p.name[0].toUpperCase()}</div>
            <div style={{fontSize:14,fontWeight:700,color:"var(--text)"}}>{p.name}</div>
            {p.password&&<div style={{fontSize:11,color:"var(--text-muted)",marginTop:4}}>{trusted?"🔓":"🔒"}</div>}
          </button>;
        })}
      </div>
      {selectedId&&profiles[selectedId]?.password&&!isTrusted(selectedId)&&<div style={{width:"100%",maxWidth:300}}>
        <div style={{fontSize:12,color:"var(--text-sec)",marginBottom:8,textAlign:"center"}}>Mot de passe pour {profiles[selectedId].name}</div>
        <div style={{display:"flex",gap:8}}>
          <input ref={pwdRef} type="password" inputMode="numeric" autoFocus placeholder="Mot de passe" value={pwd} onChange={e=>{setPwd(e.target.value);setPwdErr(false);}} onKeyDown={e=>e.key==="Enter"&&tryLogin()} style={{flex:1,background:"var(--bg-card)",color:"var(--text)",border:`1px solid ${pwdErr?"var(--red)":"var(--a15)"}`,borderRadius:"var(--r-md)",padding:"10px 14px",fontSize:14}}/>
          <button onClick={tryLogin} style={{background:"var(--accent)",border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-md)",padding:"10px 18px",fontSize:14,fontWeight:700,cursor:"pointer"}}>OK</button>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:6,marginTop:10,fontSize:12,color:"var(--text-sec)",cursor:"pointer",justifyContent:"center"}}>
          <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} style={{cursor:"pointer"}}/>
          Mémoriser sur cet appareil
        </label>
        {pwdErr&&<div style={{fontSize:11,color:"var(--red)",marginTop:6,textAlign:"center"}}>Mot de passe incorrect</div>}
      </div>}
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginTop:32}}>
        <span style={{fontSize:10,color:"var(--text-dim)",fontFamily:"var(--font-mono)"}}>v{APP_VERSION}</span>
        <button onClick={()=>{location.reload(true);}} style={{background:"none",border:"none",color:"var(--text-dim)",fontSize:10,cursor:"pointer",textDecoration:"underline",fontFamily:"var(--font-mono)"}} title="Recharger pour récupérer la dernière version">MAJ</button>
      </div>
    </div>
  );
}

// ─── Profile Selector ─────────────────────────────────────────────────────────
function ProfileSelector({profiles,activeProfileId,onSwitch,onSettings,onViewProfile}){
  const [open,setOpen]=useState(false);
  const [loginId,setLoginId]=useState(null);
  const [pwd,setPwd]=useState("");
  const [pwdErr,setPwdErr]=useState(false);
  const [remember,setRemember]=useState(true);
  const ref=useRef(null);
  const pwdRef2=useRef(null);
  useEffect(()=>{if(loginId)setTimeout(()=>pwdRef2.current?.focus(),50);},[loginId]);
  useEffect(()=>{
    if(!open)return;
    const h=e=>{if(ref.current&&!ref.current.contains(e.target)){setOpen(false);setLoginId(null);}};
    document.addEventListener("click",h,true);
    return ()=>document.removeEventListener("click",h,true);
  },[open]);
  const trySwitch=(id)=>{
    const p=profiles[id];
    if(!p)return;
    if(!p.password||isTrusted(id)){onSwitch(id);setOpen(false);setLoginId(null);return;}
    setLoginId(id);setPwd("");setPwdErr(false);setRemember(true);
  };
  const tryLogin=()=>{
    const p=profiles[loginId];
    if(!p)return;
    if(p.password===pwd){
      setTrusted(loginId,remember);
      onSwitch(loginId);setOpen(false);setLoginId(null);
    }
    else setPwdErr(true);
  };
  const active=profiles[activeProfileId];
  const color=profileColor(activeProfileId);
  return(
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={()=>{setOpen(!open);setLoginId(null);}} style={{background:color,border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-pill)",width:34,height:34,fontSize:15,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        {(active?.name||"?")[0].toUpperCase()}
      </button>
      {open&&<div style={{position:"absolute",top:40,left:0,background:"var(--bg-card)",border:"1px solid var(--a12)",borderRadius:"var(--r-lg)",padding:8,zIndex:50,minWidth:200,boxShadow:"var(--shadow-lg)"}}>
        {Object.values(profiles).sort((a,b)=>a.name.localeCompare(b.name)).map(p=>{
          const isActive=p.id===activeProfileId;
          const c=profileColor(p.id);
          const isLogin=loginId===p.id;
          return <div key={p.id}>
            <div style={{display:"flex",alignItems:"center",gap:6,width:"100%",background:isActive?"var(--a7)":isLogin?"var(--accent-bg)":"transparent",borderRadius:"var(--r-md)",padding:"6px 8px",marginBottom:2}}>
              <button onClick={()=>trySwitch(p.id)} style={{display:"flex",alignItems:"center",gap:8,flex:1,background:"transparent",border:"none",cursor:"pointer",padding:0}}>
                <div style={{background:c,color:"var(--text-inverse)",borderRadius:"var(--r-pill)",width:26,height:26,fontSize:12,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{p.name[0].toUpperCase()}</div>
                <span style={{fontSize:13,color:isActive?"var(--text)":"var(--text-sec)",fontWeight:isActive?700:400}}>{p.name}</span>
                {p.password&&<span style={{fontSize:9,color:"var(--text-dim)"}}>{isTrusted(p.id)?"🔓":"🔒"}</span>}
              </button>
              {isActive&&<span style={{fontSize:11,color:"var(--green)"}}>✓</span>}
              {!isActive&&<button onClick={()=>{if(onViewProfile){onViewProfile(p.id);setOpen(false);}}} style={{background:"var(--a5)",border:"none",color:"var(--text-dim)",borderRadius:"var(--r-sm)",padding:"2px 6px",fontSize:9,cursor:"pointer"}} title="Voir la config">👁</button>}
            </div>
            {isLogin&&<div style={{padding:"4px 8px 8px"}}>
              <div style={{display:"flex",gap:6}}>
                <input ref={pwdRef2} type="password" inputMode="numeric" autoFocus placeholder="Mot de passe" value={pwd} onChange={e=>{setPwd(e.target.value);setPwdErr(false);}} onKeyDown={e=>e.key==="Enter"&&tryLogin()} style={{flex:1,background:"var(--bg-elev-1)",color:"var(--text)",border:`1px solid ${pwdErr?"var(--red)":"var(--a15)"}`,borderRadius:"var(--r-md)",padding:"5px 8px",fontSize:11}}/>
                <button onClick={tryLogin} style={{background:"var(--accent)",border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-md)",padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>OK</button>
              </div>
              <label style={{display:"flex",alignItems:"center",gap:5,marginTop:5,fontSize:10,color:"var(--text-muted)",cursor:"pointer"}}>
                <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} style={{cursor:"pointer"}}/>
                Mémoriser sur cet appareil
              </label>
            </div>}
          </div>;
        })}
      </div>}
    </div>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────
const PROFILE_COLORS=["var(--brass-400)","var(--copper-400)","var(--wine-400)","var(--brass-300)","var(--copper-500)","var(--brass-600)"];
function profileColor(id){
  let h=0;for(let i=0;i<id.length;i++)h=id.charCodeAt(i)+((h<<5)-h);
  return PROFILE_COLORS[Math.abs(h)%PROFILE_COLORS.length];
}


function GuitarSearchAdd({inp,aiKeys,onAdd}){
  const [query,setQuery]=useState("");
  const [loading,setLoading]=useState(false);
  const [suggestion,setSuggestion]=useState(null);
  const [err,setErr]=useState(null);
  const [manual,setManual]=useState(false);
  const [mName,setMName]=useState("");
  const [mShort,setMShort]=useState("");
  const [mType,setMType]=useState("HB");

  const search=()=>{
    if(!query.trim())return;
    const key=aiKeys?.gemini||aiKeys?.anthropic||getSharedGeminiKey();
    if(!key){setErr("Clé API manquante");return;}
    setLoading(true);setErr(null);setSuggestion(null);
    const prompt=`L'utilisateur veut ajouter une guitare à son profil. Il a tapé : "${query.trim()}"
Identifie le modèle exact de guitare (marque + modèle + variante si mentionnée).
Détermine le type de micro principal : HB (humbucker), SC (single coil) ou P90.
Propose un nom abrégé court (ex: "Strat 60s", "LP Standard", "Tele 72", "SG 61", "ES-335").
Réponds UNIQUEMENT en JSON (sans markdown) : {"name":"Nom complet (Marque Modèle)","short":"Abrégé court","type":"HB|SC|P90","confidence":"high|medium|low"}`;
    const parse=safeParseJSON;
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${key}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})})
      .then(r=>r.json()).then(d=>{if(d.error)throw new Error(d.error.message);return parse(d.candidates?.[0]?.content?.parts?.[0]?.text||"");})
      .then(s=>setSuggestion(s)).catch(e=>setErr(e.message)).finally(()=>setLoading(false));
  };

  const confirm=()=>{
    if(suggestion){onAdd(suggestion.name,suggestion.short,suggestion.type);setSuggestion(null);setQuery("");}
  };
  const addManual=()=>{
    if(mName.trim()&&mShort.trim()){onAdd(mName.trim(),mShort.trim(),mType);setMName("");setMShort("");setMType("HB");setManual(false);}
  };

  return(
    <div style={{background:"var(--accent-bg)",border:"1px solid var(--accent-soft)",borderRadius:"var(--r-lg)",padding:12}}>
      <div style={{fontSize:11,color:"var(--accent)",fontWeight:600,marginBottom:8}}>+ Ajouter une guitare</div>
      {!manual?<>
        <div style={{display:"flex",gap:6,marginBottom:suggestion||err?8:0}}>
          <input placeholder="Ex: telecaster 72, les paul junior..." value={query} onChange={e=>{setQuery(e.target.value);setSuggestion(null);}} onKeyDown={e=>e.key==="Enter"&&search()} style={{...inp,flex:1,fontSize:11,padding:"6px 10px"}}/>
          <button onClick={search} disabled={!query.trim()||loading} style={{background:!query.trim()||loading?"var(--bg-disabled)":"var(--accent)",border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-md)",padding:"5px 12px",fontSize:11,fontWeight:700,cursor:!query.trim()||loading?"not-allowed":"pointer"}}>{loading?"...":"🔍"}</button>
        </div>
        {err&&<div style={{fontSize:10,color:"var(--red)",marginBottom:6}}>{err}</div>}
        {suggestion&&<div style={{background:"var(--green-bg)",border:"1px solid var(--green-border)",borderRadius:"var(--r-md)",padding:10}}>
          <div style={{fontSize:12,fontWeight:700,color:"var(--text)",marginBottom:2}}>{suggestion.name}</div>
          <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:8}}>
            <span style={{fontSize:11,color:"var(--text-sec)"}}>{suggestion.short}</span>
            <span style={{fontSize:10,color:`rgb(${TYPE_COLORS[suggestion.type]||"99,102,241"})`,background:`rgba(${TYPE_COLORS[suggestion.type]||"99,102,241"},0.15)`,borderRadius:"var(--r-sm)",padding:"1px 7px",fontWeight:700}}>{suggestion.type} — {TYPE_LABELS[suggestion.type]}</span>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={confirm} style={{background:"var(--green)",border:"none",color:"var(--bg)",borderRadius:"var(--r-md)",padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>Ajouter</button>
            <button onClick={()=>setSuggestion(null)} style={{background:"var(--a7)",border:"none",color:"var(--text-sec)",borderRadius:"var(--r-md)",padding:"5px 10px",fontSize:11,cursor:"pointer"}}>Corriger</button>
          </div>
        </div>}
        <button onClick={()=>setManual(true)} style={{background:"none",border:"none",color:"var(--text-dim)",fontSize:10,cursor:"pointer",padding:"6px 0 0",textDecoration:"underline"}}>Saisie manuelle</button>
      </>:<>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
          <input placeholder="Nom complet" value={mName} onChange={e=>setMName(e.target.value)} style={{...inp,flex:"1 1 120px",fontSize:11,padding:"5px 8px"}}/>
          <input placeholder="Abrégé" value={mShort} onChange={e=>setMShort(e.target.value)} style={{...inp,flex:"0 1 80px",fontSize:11,padding:"5px 8px"}}/>
          <select value={mType} onChange={e=>setMType(e.target.value)} style={{...inp,flex:"0 0 60px",fontSize:11,padding:"5px 4px"}}>
            <option value="HB">HB</option><option value="SC">SC</option><option value="P90">P90</option>
          </select>
          <button onClick={addManual} disabled={!mName.trim()||!mShort.trim()} style={{background:mName.trim()&&mShort.trim()?"var(--accent)":"var(--bg-disabled)",border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-md)",padding:"5px 12px",fontSize:11,fontWeight:700,cursor:mName.trim()&&mShort.trim()?"pointer":"not-allowed"}}>Ajouter</button>
        </div>
        <button onClick={()=>setManual(false)} style={{background:"none",border:"none",color:"var(--text-dim)",fontSize:10,cursor:"pointer",padding:0,textDecoration:"underline"}}>← Recherche IA</button>
      </>}
    </div>
  );
}

function ProfileTab({profile,profiles,onProfiles,activeProfileId,inp,section,aiKeys,customGuitars,onCustomGuitars}){
  const [editName,setEditName]=useState(profile.name);
  const [newProfileName,setNewProfileName]=useState("");
  const [newGuitarName,setNewGuitarName]=useState("");
  const [newGuitarShort,setNewGuitarShort]=useState("");
  const [newGuitarType,setNewGuitarType]=useState("HB");
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [editingGuitarId,setEditingGuitarId]=useState(null);
  const [editGName,setEditGName]=useState("");
  const [editGShort,setEditGShort]=useState("");
  const [editGType,setEditGType]=useState("HB");

  // Phase 5.7.3 — stamp profile.lastModified au write pour le LWW per-profile
  // (sinon myGuitars / customGuitars / availableSources / banks modifs sont
  // écrasées au prochain poll Firestore par tiebreak égalité des timestamps).
  const updateProfile=(field,value)=>onProfiles(p=>({...p,[activeProfileId]:{...p[activeProfileId],[field]:typeof value==="function"?value(p[activeProfileId][field]):value,lastModified:Date.now()}}));

  const toggleGuitar=id=>{
    updateProfile("myGuitars",prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  };
  const toggleSource=key=>{
    updateProfile("availableSources",prev=>({...prev,[key]:!prev[key]}));
  };
  const addCustomGuitar=(cg)=>{
    onCustomGuitars(prev=>[...(prev||[]),cg]);
    // Auto-check in current profile
    updateProfile("myGuitars",prev=>[...prev,cg.id]);
  };
  const removeCustomGuitar=id=>{
    onCustomGuitars(prev=>(prev||[]).filter(g=>g.id!==id));
    // Uncheck from all profiles
    onProfiles(p=>{const n={...p};for(const pid in n){n[pid]={...n[pid],myGuitars:(n[pid].myGuitars||[]).filter(x=>x!==id)};}return n;});
  };
  const startEditGuitar=(g,isCustom)=>{
    const edits=profile.editedGuitars||{};
    const orig=isCustom?g:({...GUITARS.find(x=>x.id===g.id),...(edits[g.id]||{})});
    setEditingGuitarId(g.id);setEditGName(orig.name);setEditGShort(orig.short);setEditGType(orig.type);
  };
  const saveEditGuitar=()=>{
    if(!editGName.trim()||!editGShort.trim()){setEditingGuitarId(null);return;}
    const isCustom=editingGuitarId?.startsWith("cg_");
    if(isCustom){
      onCustomGuitars(prev=>(prev||[]).map(g=>g.id===editingGuitarId?{...g,name:editGName.trim(),short:editGShort.trim(),type:editGType}:g));
    } else {
      updateProfile("editedGuitars",prev=>({...(prev||{}), [editingGuitarId]:{name:editGName.trim(),short:editGShort.trim(),type:editGType}}));
    }
    setEditingGuitarId(null);
  };
  const resetGuitar=id=>{
    updateProfile("editedGuitars",prev=>{const n={...(prev||{})};delete n[id];return n;});
    setEditingGuitarId(null);
  };
  const [adminPin,setAdminPin]=useState("");
  const [adminPinErr,setAdminPinErr]=useState(false);
  const createProfile=()=>{
    if(!newProfileName.trim())return;
    if(adminPin!==ADMIN_PIN){setAdminPinErr(true);return;}
    setAdminPinErr(false);
    const id=newProfileName.trim().toLowerCase().replace(/[^a-z0-9]/g,"_")+`_${Date.now()}`;
    onProfiles(p=>({...p,[id]:makeDefaultProfile(id,newProfileName.trim())}));
    setNewProfileName("");setAdminPin("");
  };
  const deleteProfile=()=>{
    if(Object.keys(profiles).length<=1)return;
    const remaining={...profiles};delete remaining[activeProfileId];
    onProfiles(remaining);
    setConfirmDelete(false);
  };
  const saveName=()=>{
    if(!editName.trim())return;
    updateProfile("name",editName.trim());
  };

  const s=section||"guitars";
  return (
    <div>
      {/* Mes guitares */}
      {s==="guitars"&&<div style={{background:"var(--a4)",border:"1px solid var(--a8)",borderRadius:"var(--r-lg)",padding:16,marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:"var(--text)",marginBottom:4}}>Mes guitares</div>
        <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:12}}>Coche les guitares que tu possèdes.</div>
        {(()=>{
          const customs=customGuitars||[];
          const allBrands=[...GUITAR_BRANDS];
          // Group custom guitars by brand (extract from name, default "Custom")
          const customByBrand={};
          customs.forEach(g=>{
            const brand=g.brand||"Mes guitares";
            if(!customByBrand[brand]) customByBrand[brand]=[];
            customByBrand[brand].push(g);
            if(!allBrands.includes(brand)) allBrands.push(brand);
          });
          // Always show "Mes guitares" if there are custom guitars without brand
          return <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:12}}>
          {allBrands.map(brand=>{
            const standardGuitars=GUITARS.filter(g=>g.brand===brand);
            const customGuitars=customByBrand[brand]||[];
            if(!standardGuitars.length&&!customGuitars.length) return null;
            return <div key={brand}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--text-sec)",fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"var(--tracking-wider)",marginBottom:6,paddingLeft:2}}>{brand}</div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {standardGuitars.map(g=>{
              const sel=profile.myGuitars.includes(g.id);
              const edits=profile.editedGuitars||{};
              const display={...g,...(edits[g.id]||{})};
              const isEdited=!!edits[g.id];
              const isEditing=editingGuitarId===g.id;
              return <div key={g.id}>
                <div style={{display:"flex",alignItems:"center",gap:8,background:sel?"var(--accent-soft)":"var(--a3)",border:sel?"1px solid var(--accent-border)":"1px solid var(--a6)",borderRadius:"var(--r-md)",padding:"8px 12px",cursor:"pointer"}} onClick={()=>toggleGuitar(g.id)}>
                  <div style={{width:18,height:18,borderRadius:"var(--r-sm)",border:sel?"2px solid var(--accent)":"2px solid var(--text-muted)",background:sel?"var(--accent)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{sel&&<span style={{color:"var(--text-inverse)",fontSize:10,fontWeight:900}}>✓</span>}</div>
                  <div style={{flex:1}}><span style={{fontSize:12,fontWeight:600,color:sel?"var(--text)":"var(--text-muted)"}}>{display.short}</span><span style={{fontSize:10,color:"var(--text-dim)",marginLeft:6}}>{display.name}</span>{isEdited&&<span style={{fontSize:9,color:"var(--copper-400)",marginLeft:4}}>modifié</span>}</div>
                  <span style={{fontSize:10,color:"var(--text-dim)",marginRight:4}}>{display.type}</span>
                  {sel&&<button onClick={e=>{e.stopPropagation();startEditGuitar(display,false);}} style={{background:"var(--a7)",border:"none",color:"var(--text-sec)",borderRadius:"var(--r-sm)",padding:"3px 7px",fontSize:10,cursor:"pointer"}}>✏️</button>}
                </div>
                {isEditing&&<div style={{background:"var(--a5)",borderRadius:"0 0 8px 8px",padding:"10px 12px",marginTop:-1,border:"1px solid var(--a8)",borderTop:"none"}} onClick={e=>e.stopPropagation()}>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
                    <input placeholder="Nom" value={editGName} onChange={e=>setEditGName(e.target.value)} style={{...inp,flex:"1 1 140px",fontSize:11,padding:"5px 8px"}}/>
                    <input placeholder="Abrégé" value={editGShort} onChange={e=>setEditGShort(e.target.value)} style={{...inp,flex:"0 1 80px",fontSize:11,padding:"5px 8px"}}/>
                    <select value={editGType} onChange={e=>setEditGType(e.target.value)} style={{...inp,flex:"0 0 55px",fontSize:11,padding:"5px 4px"}}><option value="HB">HB</option><option value="SC">SC</option><option value="P90">P90</option></select>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={saveEditGuitar} style={{background:"var(--accent)",border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-md)",padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>Sauver</button>
                    {isEdited&&<button onClick={()=>resetGuitar(g.id)} style={{background:"var(--yellow-bg)",border:"1px solid var(--yellow-border)",color:"var(--yellow)",borderRadius:"var(--r-md)",padding:"5px 10px",fontSize:11,cursor:"pointer"}}>Réinitialiser</button>}
                    <button onClick={()=>setEditingGuitarId(null)} style={{background:"var(--a7)",border:"none",color:"var(--text-sec)",borderRadius:"var(--r-md)",padding:"5px 10px",fontSize:11,cursor:"pointer"}}>Annuler</button>
                  </div>
                </div>}
              </div>;
            })}
            {customGuitars.map(g=>{
              const isEditing=editingGuitarId===g.id;
              const sel=profile.myGuitars.includes(g.id);
              return <div key={g.id}>
                <div style={{display:"flex",alignItems:"center",gap:8,background:sel?"var(--accent-soft)":"var(--a3)",border:sel?"1px solid var(--accent-border)":"1px solid var(--a6)",borderRadius:"var(--r-md)",padding:"8px 12px",cursor:"pointer"}} onClick={()=>toggleGuitar(g.id)}>
                  <div style={{width:18,height:18,borderRadius:"var(--r-sm)",border:sel?"2px solid var(--accent)":"2px solid var(--text-muted)",background:sel?"var(--accent)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{sel&&<span style={{color:"var(--text-inverse)",fontSize:10,fontWeight:900}}>✓</span>}</div>
                  <div style={{flex:1}}><span style={{fontSize:12,fontWeight:600,color:sel?"var(--text)":"var(--text-muted)"}}>{g.short}</span><span style={{fontSize:10,color:"var(--text-dim)",marginLeft:6}}>{g.name}</span></div>
                  <span style={{fontSize:10,color:"var(--text-dim)",marginRight:4}}>{g.type}</span>
                  {sel&&<button onClick={e=>{e.stopPropagation();startEditGuitar(g,true);}} style={{background:"var(--a7)",border:"none",color:"var(--text-sec)",borderRadius:"var(--r-sm)",padding:"3px 7px",fontSize:10,cursor:"pointer"}}>✏️</button>}
                  <button onClick={e=>{e.stopPropagation();removeCustomGuitar(g.id);}} style={{background:"none",border:"none",color:"var(--red)",cursor:"pointer",fontSize:11,padding:"2px 4px"}}>✕</button>
                </div>
                {isEditing&&<div style={{background:"var(--a5)",borderRadius:"0 0 8px 8px",padding:"10px 12px",marginTop:-1,border:"1px solid var(--a8)",borderTop:"none"}}>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
                    <input placeholder="Nom" value={editGName} onChange={e=>setEditGName(e.target.value)} style={{...inp,flex:"1 1 140px",fontSize:11,padding:"5px 8px"}}/>
                    <input placeholder="Abrégé" value={editGShort} onChange={e=>setEditGShort(e.target.value)} style={{...inp,flex:"0 1 80px",fontSize:11,padding:"5px 8px"}}/>
                    <select value={editGType} onChange={e=>setEditGType(e.target.value)} style={{...inp,flex:"0 0 55px",fontSize:11,padding:"5px 4px"}}><option value="HB">HB</option><option value="SC">SC</option><option value="P90">P90</option></select>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={saveEditGuitar} style={{background:"var(--accent)",border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-md)",padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>Sauver</button>
                    <button onClick={()=>setEditingGuitarId(null)} style={{background:"var(--a7)",border:"none",color:"var(--text-sec)",borderRadius:"var(--r-md)",padding:"5px 10px",fontSize:11,cursor:"pointer"}}>Annuler</button>
                  </div>
                </div>}
              </div>;
            })}
            </div>
          </div>;
          })}
        </div>;})()}
        <GuitarSearchAdd inp={inp} aiKeys={aiKeys} onAdd={(name,short,type)=>{
          const knownBrands=["Gibson","Fender","Epiphone","PRS","Ibanez","ESP","Jackson","Schecter","Gretsch","Squier","Yamaha","Taylor","Martin"];
          const firstWord=name.split(" ")[0];
          const brand=knownBrands.find(b=>b.toLowerCase()===firstWord.toLowerCase())||"Mes guitares";
          addCustomGuitar({id:`cg_${Date.now()}`,name,short,type,brand});
        }}/>
      </div>}

      {/* Mes appareils — Phase 2 : section déplacée dans MesAppareilsTab,
          piloté par le registry des devices. Le rendu ProfileTab section="devices"
          n'est plus utilisé. */}

      {/* Mes sources de presets */}
      {s==="sources"&&<div style={{background:"var(--a4)",border:"1px solid var(--a8)",borderRadius:"var(--r-lg)",padding:16,marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:"var(--text)",marginBottom:4}}>Mes sources de presets</div>
        <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:12}}>Coche uniquement les packs et matériels ToneX que tu possèdes réellement. Les recommandations seront filtrées en conséquence.</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {Object.entries(SOURCE_LABELS).map(([key,label])=>{
            // Auto-lock sources based on owned devices.
            // Phase 5 (Item E) : lit profile.enabledDevices au lieu du
            // champ legacy profile.devices supprimé en v6.
            const enabled=new Set(profile.enabledDevices||[]);
            const locked=(key==="Anniversary"&&enabled.has('tonex-anniversary'))
              ||(key==="Factory"&&enabled.has('tonex-pedal'))
              ||(key==="PlugFactory"&&enabled.has('tonex-plug'));
            const on=locked||profile.availableSources?.[key]!==false;
            const desc=SOURCE_DESCRIPTIONS[key]||"";
            const icon=SOURCE_INFO[key]?.icon||"📁";
            return <button key={key} onClick={()=>{if(!locked)toggleSource(key);}} style={{display:"flex",alignItems:"flex-start",gap:10,background:on?"var(--green-bg)":"var(--a3)",border:on?"1px solid var(--green-border)":"1px solid var(--a8)",borderRadius:"var(--r-md)",padding:"10px 14px",cursor:locked?"default":"pointer",textAlign:"left",opacity:locked?0.85:1}}>
              <div style={{width:18,height:18,borderRadius:"var(--r-sm)",border:on?"2px solid var(--green)":"2px solid var(--text-muted)",background:on?"var(--green)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2}}>{on&&<span style={{color:"var(--bg)",fontSize:10,fontWeight:900}}>✓</span>}</div>
              <div style={{flex:1,display:"flex",flexDirection:"column",gap:3}}>
                <div style={{fontSize:12,color:on?"var(--text)":"var(--text-muted)",fontWeight:on?700:500,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                  <span>{icon}</span>
                  <span>{label}</span>
                  {locked&&<span style={{fontSize:9,color:"var(--text-dim)",background:"var(--a6)",borderRadius:"var(--r-sm)",padding:"1px 6px",fontWeight:600}}>verrouillé (matériel coché)</span>}
                </div>
                {desc&&<div style={{fontSize:10,color:"var(--text-dim)",lineHeight:1.4}}>{desc}</div>}
              </div>
            </button>;
          })}
        </div>
      </div>}

    </div>
  );
}

// ─── Packs Tab ────────────────────────────────────────────────────────────────
function PacksTab({profile,onProfiles,activeProfileId,aiProvider,aiKeys}){
  const [packName,setPackName]=useState("");
  const [file,setFile]=useState(null);
  const [filePreview,setFilePreview]=useState(null);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState(null);
  const fileRef=useRef(null);

  // Phase 5.7.3 — stamp profile.lastModified au write pour le LWW per-profile
  // (sinon myGuitars / customGuitars / availableSources / banks modifs sont
  // écrasées au prochain poll Firestore par tiebreak égalité des timestamps).
  const updateProfile=(field,value)=>onProfiles(p=>({...p,[activeProfileId]:{...p[activeProfileId],[field]:typeof value==="function"?value(p[activeProfileId][field]):value,lastModified:Date.now()}}));

  const handleFile=e=>{
    const f=e.target.files?.[0];
    if(!f)return;
    setFile(f);setErr(null);
    const reader=new FileReader();
    reader.onload=ev=>{setFilePreview(ev.target.result);};
    reader.readAsDataURL(f);
  };

  const extractPresets=()=>{
    if(!packName.trim()||!filePreview)return;
    const key=aiKeys?.gemini||aiKeys?.anthropic||getSharedGeminiKey();
    const provider=(aiKeys?.gemini||getSharedGeminiKey())?"gemini":"anthropic";
    if(!key){setErr("Clé API manquante — configure-la dans ⚙️ Paramètres.");return;}
    setLoading(true);setErr(null);
    const prompt=`Analyse cette image/document d'un pack de presets pour guitare ToneX appelé "${packName.trim()}".
Extrais TOUS les noms de presets visibles et pour chacun déduis :
- amp : le modèle d'ampli simulé (nom générique, ex: "Marshall JCM800", "Fender Twin Reverb")
- gain : "low", "mid" ou "high"
- style : "blues", "rock", "hard_rock", "jazz", "pop" ou "metal"
- scores : compatibilité par type de micro {HB: 50-97, SC: 50-97, P90: 50-97}

Pour chaque ampli UNIQUE trouvé, génère aussi une fiche descriptive :
- emoji : un emoji représentatif
- refs : artistes et morceaux associés [{a:"Artiste",t:["Morceau 1","Morceau 2"]}]
- desc : description courte en français de l'ampli (2-3 phrases)

Réponds UNIQUEMENT en JSON (sans markdown) :
{"presets":[{"name":"...","amp":"...","gain":"...","style":"...","scores":{"HB":85,"SC":70,"P90":78}},...],
"ampContext":{"Nom Ampli":{"emoji":"🎸","refs":[{"a":"Artiste","t":["Morceau"]}],"desc":"Description..."},...}}`;
    const base64=filePreview.split(",")[1];
    const mimeType=filePreview.split(";")[0].split(":")[1];
    if(provider==="gemini"){
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${key}`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({contents:[{parts:[{inlineData:{mimeType,data:base64}},{text:prompt}]}]})
      }).then(r=>r.json()).then(d=>{
        if(d.error)throw new Error(d.error.message);
        const txt=d.candidates?.[0]?.content?.parts?.[0]?.text||"";
        const parsed=safeParseJSON(txt);
        savePack(parsed.presets||[],parsed.ampContext||{});
      }).catch(e=>setErr(e.message)).finally(()=>setLoading(false));
    } else {
      fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",headers:{"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:4096,messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:mimeType,data:base64}},{type:"text",text:prompt}]}]})
      }).then(r=>r.json()).then(d=>{
        if(d.error)throw new Error(d.error.message);
        const txt=d.content?.map(i=>i.text||"").join("")||"";
        const parsed=safeParseJSON(txt);
        savePack(parsed.presets||[],parsed.ampContext||{});
      }).catch(e=>setErr(e.message)).finally(()=>setLoading(false));
    }
  };

  const savePack=(presets,ampContext)=>{
    const pack={id:`pack_${Date.now()}`,name:packName.trim(),presetCount:presets.length,presets:presets.map(p=>({...p,src:packName.trim()})),ampContext:ampContext||{}};
    updateProfile("customPacks",prev=>[...(prev||[]),pack]);
    setPackName("");setFile(null);setFilePreview(null);
    if(fileRef.current)fileRef.current.value="";
  };

  const deletePack=id=>{
    updateProfile("customPacks",prev=>(prev||[]).filter(p=>p.id!==id));
  };

  const packs=profile.customPacks||[];
  const inp={background:"var(--bg-card)",color:"var(--text)",border:"1px solid var(--a15)",borderRadius:"var(--r-md)",padding:"6px 10px",fontSize:12,boxSizing:"border-box"};

  return(
    <div>
      <div style={{fontSize:13,color:"var(--text-sec)",marginBottom:16}}>Ajoute des packs de presets en joignant une photo ou un document. L'IA en extraira les presets.</div>

      {/* Packs existants */}
      {packs.length>0&&<div style={{marginBottom:16}}>
        {packs.map(p=>(
          <div key={p.id} style={{background:"var(--a4)",border:"1px solid var(--a8)",borderRadius:"var(--r-lg)",padding:12,marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <div style={{flex:1,fontSize:13,fontWeight:700,color:"var(--text)"}}>{p.name}</div>
              <span style={{fontSize:11,color:"var(--text-muted)"}}>{p.presetCount||p.presets?.length||0} presets</span>
              <button onClick={()=>deletePack(p.id)} style={{background:"var(--red-bg)",border:"1px solid var(--red-border)",color:"var(--red)",borderRadius:"var(--r-md)",padding:"3px 8px",fontSize:11,cursor:"pointer"}}>Supprimer</button>
            </div>
            {p.presets?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4}}>
              {p.presets.slice(0,8).map((pr,i)=><span key={i} style={{fontSize:10,background:"var(--a5)",border:"1px solid var(--a8)",borderRadius:"var(--r-sm)",padding:"2px 6px",color:"var(--text-sec)"}}>{pr.name}</span>)}
              {p.presets.length>8&&<span style={{fontSize:10,color:"var(--text-muted)"}}>+{p.presets.length-8} autres</span>}
            </div>}
          </div>
        ))}
      </div>}

      {/* Ajouter un pack */}
      <div style={{background:"var(--accent-bg)",border:"1px solid var(--accent-soft)",borderRadius:"var(--r-lg)",padding:16}}>
        <div style={{fontSize:13,fontWeight:700,color:"var(--accent)",marginBottom:12}}>+ Nouveau pack</div>
        <input placeholder="Nom du pack (ex: TSR Blues Pack)" value={packName} onChange={e=>setPackName(e.target.value)} style={{...inp,width:"100%",marginBottom:10}}/>
        <div style={{marginBottom:10}}>
          <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleFile} style={{fontSize:12,color:"var(--text-sec)"}}/>
        </div>
        {filePreview&&filePreview.startsWith("data:image")&&<div style={{marginBottom:10,borderRadius:"var(--r-md)",overflow:"hidden",border:"1px solid var(--a8)"}}>
          <img src={filePreview} style={{width:"100%",maxHeight:200,objectFit:"contain",background:"var(--a3)"}}/>
        </div>}
        {filePreview&&!filePreview.startsWith("data:image")&&<div style={{fontSize:11,color:"var(--text-muted)",marginBottom:10}}>Document joint ({file?.name})</div>}
        {err&&<div style={{fontSize:12,color:"var(--red)",marginBottom:10}}>{err}</div>}
        <button onClick={extractPresets} disabled={!packName.trim()||!filePreview||loading}
          style={{width:"100%",background:packName.trim()&&filePreview&&!loading?"var(--accent)":"var(--bg-disabled)",border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-lg)",padding:"12px",fontSize:13,fontWeight:700,cursor:packName.trim()&&filePreview&&!loading?"pointer":"not-allowed"}}>
          {loading?"Extraction IA en cours...":"Extraire les presets avec l'IA"}
        </button>
      </div>
    </div>
  );
}

// ─── ToneNET : auto-inférence ampli/gain/style depuis le nom du preset ───────
function inferPresetInfo(presetName){
  if(!presetName||presetName.length<3) return null;
  const n=presetName.toLowerCase();
  // 1. Detect amp via resolveRefAmp (uses AMP_ALIASES)
  let detectedAmp=resolveRefAmp(presetName);
  // If resolveRefAmp returned the raw name (no alias found), try AMP_TAXONOMY substring match
  if(detectedAmp===presetName||!AMP_TAXONOMY[detectedAmp]){
    const norm=n.replace(/[^a-z0-9\s]/g,"").trim();
    // Try common ToneNET naming patterns: "Brand Model Variant"
    const TONENET_PATTERNS=[
      [/\b(ac\s?30|ac30)\b/,"Vox AC30"],
      [/\b(ac\s?15|ac15)\b/,"Vox AC15"],
      [/\b(twin\s?reverb|twin\s?rev)\b/,"Fender Twin Silverface"],
      [/\b(blues?\s?junior|blues?\s?jr)\b/,"Fender Blues Junior"],
      [/\b(deluxe\s?reverb|dlx\s?rev)\b/,"Fender Deluxe Reverb"],
      [/\b(princeton)\b/,"Fender Princeton"],
      [/\b(bassman)\b/,"Fender Tweed Bassman"],
      [/\b(super\s?reverb)\b/,"Fender Twin Silverface"],
      [/\b(jcm\s?800|jcm800)\b/,"Marshall JCM800"],
      [/\b(jcm\s?900|jcm900)\b/,"Marshall JCM900"],
      [/\b(jtm\s?45|jtm45)\b/,"Marshall JTM45"],
      [/\b(silver\s?jubilee|2555)\b/,"Marshall Silver Jubilee"],
      [/\b(superlead|super\s?lead|1959)\b/,"Marshall SL800"],
      [/\b(dual\s?rec|recto|rectifier)\b/,"Mesa Rectifier"],
      [/\b(mark\s?(iv|4|iic|2c))\b/,"Mesa Mark IV"],
      [/\b(5150|evh|block\s?letter)\b/,"Peavey 5150"],
      [/\b(slo|slo.?100)\b/,"Soldano SLO-100"],
      [/\b(rockerverb|rocker\s?verb)\b/,"Orange Rockerverb"],
      [/\b(or.?120|orange)\b/i,"Orange Rockerverb"],
      [/\b(be.?100|friedman)\b/,"Friedman BE-100"],
      [/\b(bogner|ecstasy)\b/,"Bogner Ecstasy"],
      [/\b(matchless|dc.?30)\b/,"Matchless DC30"],
      [/\b(dumble|ods)\b/,"Dumble ODS"],
      [/\b(two\s?rock)\b/,"Two Rock Stevie G"],
      [/\b(dr\.?\s?z|carmen\s?ghia)\b/,"Dr. Z"],
      [/\b(supro)\b/,"Supro"],
      [/\b(hiwatt|dr.?103)\b/,"Hiwatt HG100"],
      [/\b(roland\s?jc|jazz\s?chorus)\b/,"Roland JC-120"],
      [/\b(ampeg|svt)\b/,"Ampeg SVT"],
      [/\b(diezel|herbert|vh4)\b/,"Diezel Herbert"],
      [/\b(engl|powerball|savage)\b/,"ENGL"],
      [/\b(soldano)\b/,"Soldano SLO-100"],
      [/\b(laney\s?supergroup|supergroup\s?bass|supergroup)/,"Laney Supergroup"],
      [/\b(laney\s?vh\s?100|vh\s?100)\b/,"Laney VH100"],
      [/\b(laney\s?vc\s?50|vc\s?50)\b/,"Laney VC50"],
      [/\b(laney\s?vc\s?30|vc\s?30)\b/,"Laney VC30"],
      [/\b(laney\s?aor)\b/,"Laney AOR"],
      [/\b(laney\s?lionheart|laney\s?lion)\b/,"Laney Lionheart"],
      [/\b(laney)\b/,"Laney"],
    ];
    for(const [rx,amp] of TONENET_PATTERNS){
      if(rx.test(norm)){detectedAmp=amp;break;}
    }
    // Still nothing? Try AMP_TAXONOMY keys by substring
    if(detectedAmp===presetName||!AMP_TAXONOMY[detectedAmp]){
      for(const k of Object.keys(AMP_TAXONOMY)){
        if(norm.includes(k.toLowerCase())){detectedAmp=k;break;}
      }
    }
  }
  // 2. Detect channel from name
  let channel="";
  const chMatch=n.match(/\b(ch\.?\s*\d|channel\s*\d|clean\s*ch|drive\s*ch|lead\s*ch|crunch\s*ch)/i);
  if(chMatch) channel=chMatch[1].trim();
  // 3. Detect gain via inferGainFromName + channel hint
  const gainNum=inferGainFromName(presetName);
  // Channel can override gain if name was ambiguous (default 6)
  let finalGainNum=gainNum;
  if(gainNum===6&&channel){
    const chLow=channel.toLowerCase();
    if(/clean/i.test(chLow)) finalGainNum=2;
    else if(/crunch/i.test(chLow)) finalGainNum=5;
    else if(/drive|od/i.test(chLow)) finalGainNum=7;
    else if(/lead|high/i.test(chLow)) finalGainNum=9;
  }
  const gain=finalGainNum<=3?"low":finalGainNum>=8?"high":"mid";
  // 4. Detect style from amp taxonomy school → default style mapping
  const SCHOOL_STYLE={"fender_clean":"blues","marshall_crunch":"rock","vox_chime":"rock","dumble_smooth":"blues","mesa_heavy":"hard_rock","hiwatt_clean":"rock","orange_crunch":"hard_rock","friedman_modern":"hard_rock","bogner_versatile":"rock","matchless_chime":"blues","soldano_lead":"hard_rock","diezel_modern":"metal","peavey_heavy":"metal","two_rock_boutique":"blues"};
  let style="rock";
  if(detectedAmp&&AMP_TAXONOMY[detectedAmp]){
    const school=AMP_TAXONOMY[detectedAmp].school;
    if(school&&SCHOOL_STYLE[school]) style=SCHOOL_STYLE[school];
  }
  // Override style from explicit keywords in name
  if(/\bmetal\b|\bheavy\b|\bdjent\b|\bbrutal\b/.test(n)) style="metal";
  else if(/\bblues\b/.test(n)) style="blues";
  else if(/\bjazz\b/.test(n)) style="jazz";
  else if(/\bfunk\b|\bpop\b/.test(n)) style="pop";
  // Resolved amp or empty
  const finalAmp=(detectedAmp&&detectedAmp!==presetName)?detectedAmp:"";
  return {amp:finalAmp,gain,style,channel};
}

// ─── ToneNET Tab ─────────────────────────────────────────────────────────────
function ToneNetTab({toneNetPresets,onToneNetPresets,inp}){
  const [name,setName]=useState("");
  const [amp,setAmp]=useState("");
  const [gain,setGain]=useState("mid");
  const [style,setStyle]=useState("rock");
  const [channel,setChannel]=useState("");
  const [cab,setCab]=useState("");
  const [comment,setComment]=useState("");
  const [editId,setEditId]=useState(null);
  const [autoFilled,setAutoFilled]=useState(false);
  const GAIN_OPTS=["low","mid","high"];
  const STYLE_OPTS=[{v:"blues",l:"Blues"},{v:"rock",l:"Rock"},{v:"hard_rock",l:"Hard Rock"},{v:"jazz",l:"Jazz"},{v:"pop",l:"Pop"},{v:"metal",l:"Metal"}];
  const suggestStyleFromAmp=function(ampName){
    if(!ampName) return null;
    var al=ampName.toLowerCase();
    if(/laney|mesa|rectifier|5150|peavey|engl|diezel|soldano|bogner|friedman/.test(al)) return "hard_rock";
    if(/fender|princeton|twin|deluxe|bassman|champ/.test(al)) return "blues";
    if(/vox|ac30|ac15|matchless|budda/.test(al)) return "rock";
    if(/dumble|two rock|carr/.test(al)) return "blues";
    if(/roland|jazz/.test(al)) return "jazz";
    return null;
  };
  const onAmpChange=function(val){
    setAmp(val);
    var suggested=suggestStyleFromAmp(val);
    if(suggested) setStyle(suggested);
  };
  const resetForm=()=>{setName("");setAmp("");setGain("mid");setStyle("rock");setChannel("");setCab("");setComment("");setEditId(null);setAutoFilled(false);};
  const onNameChange=(val)=>{
    setName(val);
    if(editId) return;
    const info=inferPresetInfo(val);
    if(info){
      if(info.amp) setAmp(info.amp);
      setGain(info.gain);
      setStyle(info.style);
      if(info.channel) setChannel(info.channel);
      setAutoFilled(true);
    }
  };
  const addPreset=()=>{
    if(!name.trim())return;
    const p={id:`tn_${Date.now()}`,name:name.trim(),amp:amp.trim()||"ToneNET",gain,style,channel:channel.trim(),cab:cab.trim(),comment:comment.trim(),scores:{HB:75,SC:75,P90:75}};
    onToneNetPresets(prev=>[...prev,p]);resetForm();
  };
  const saveEdit=()=>{
    if(!name.trim()||!editId)return;
    onToneNetPresets(prev=>prev.map(p=>p.id===editId?{...p,name:name.trim(),amp:amp.trim()||"ToneNET",gain,style,channel:channel.trim(),cab:cab.trim(),comment:comment.trim()}:p));resetForm();
  };
  const startEdit=(p)=>{setEditId(p.id);setName(p.name);setAmp(p.amp==="ToneNET"?"":p.amp);setGain(p.gain);setStyle(p.style);setChannel(p.channel||"");setCab(p.cab||"");setComment(p.comment||"");setAutoFilled(false);};
  const deletePreset=(id)=>onToneNetPresets(prev=>prev.filter(p=>p.id!==id));
  return(
    <div>
      <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)",marginBottom:4}}>Presets ToneNET</div>
      <div style={{fontSize:11,color:"var(--text-tertiary)",marginBottom:12}}>Ajoute les presets que tu as téléchargés depuis ToneNET.</div>
      {/* Formulaire d'ajout */}
      <div style={{background:"var(--accent-soft)",border:"1px solid var(--border-accent)",borderRadius:"var(--r-lg)",padding:"var(--s-4)",marginBottom:"var(--s-4)"}}>
        <div style={{fontFamily:"var(--font-mono)",fontSize:"var(--fs-xs)",textTransform:"uppercase",letterSpacing:"var(--tracking-wider)",color:"var(--accent)",marginBottom:"var(--s-3)"}}>{editId?"Modifier le preset":"Ajouter un preset"}</div>
        <div style={{display:"flex",flexDirection:"column",gap:"var(--s-2)"}}>
          <input placeholder="Nom du preset *" value={name} onChange={e=>onNameChange(e.target.value)} style={{...inp,fontSize:13}}/>
          <div style={{position:"relative"}}>
            <input placeholder="Modèle d'ampli (ex: Fender Twin)" value={amp} onChange={e=>{onAmpChange(e.target.value);setAutoFilled(false);}} style={{...inp,fontSize:13}}/>
            {autoFilled&&amp&&<span style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",fontSize:9,color:"var(--accent)",fontFamily:"var(--font-mono)"}}>auto</span>}
          </div>
          <div style={{display:"flex",gap:"var(--s-2)"}}>
            <select value={gain} onChange={e=>setGain(e.target.value)} style={{...inp,flex:1,fontSize:13}}>
              {GAIN_OPTS.map(g=><option key={g} value={g}>{g==="low"?"Low gain":g==="mid"?"Mid gain":"High gain"}</option>)}
            </select>
            <select value={style} onChange={e=>setStyle(e.target.value)} style={{...inp,flex:1,fontSize:13}}>
              {STYLE_OPTS.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          </div>
          <div style={{display:"flex",gap:"var(--s-2)"}}>
            <input placeholder="Canal (ex: Ch1, Clean, Lead)" value={channel} onChange={e=>setChannel(e.target.value)} style={{...inp,flex:1,fontSize:12}}/>
            <input placeholder="Cab (ex: 4x12 Greenback)" value={cab} onChange={e=>setCab(e.target.value)} style={{...inp,flex:1,fontSize:12}}/>
          </div>
          <input placeholder="Notes (optionnel)" value={comment} onChange={e=>setComment(e.target.value)} style={{...inp,fontSize:12}}/>
          <div style={{display:"flex",gap:"var(--s-2)"}}>
            {editId?<>
              <button onClick={saveEdit} disabled={!name.trim()} style={{flex:1,background:name.trim()?"var(--accent)":"var(--bg-elev-3)",border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-md)",padding:"8px",fontSize:12,fontWeight:700,cursor:name.trim()?"pointer":"not-allowed"}}>Sauver</button>
              <button onClick={resetForm} style={{background:"var(--bg-elev-2)",border:"1px solid var(--border-subtle)",color:"var(--text-secondary)",borderRadius:"var(--r-md)",padding:"8px 14px",fontSize:12,cursor:"pointer"}}>Annuler</button>
            </>:<button onClick={addPreset} disabled={!name.trim()} style={{width:"100%",background:name.trim()?"linear-gradient(180deg,var(--brass-200),var(--brass-400))":"var(--bg-elev-3)",border:"none",color:name.trim()?"var(--tolex-900)":"var(--text-tertiary)",borderRadius:"var(--r-md)",padding:"8px",fontSize:12,fontWeight:700,cursor:name.trim()?"pointer":"not-allowed",boxShadow:name.trim()?"var(--shadow-sm)":"none"}}>+ Ajouter</button>}
          </div>
        </div>
      </div>
      {/* Liste des presets */}
      {toneNetPresets.length===0?<div style={{textAlign:"center",padding:"20px",color:"var(--text-tertiary)",fontSize:12}}>Aucun preset ToneNET ajouté</div>
      :<div style={{display:"flex",flexDirection:"column",gap:"var(--s-2)"}}>
        <div style={{fontFamily:"var(--font-mono)",fontSize:"var(--fs-xs)",color:"var(--text-tertiary)",textTransform:"uppercase",letterSpacing:"var(--tracking-wider)",marginBottom:2}}>{toneNetPresets.length} preset{toneNetPresets.length>1?"s":""}</div>
        {toneNetPresets.map(p=>(
          <div key={p.id} style={{background:editId===p.id?"var(--accent-soft)":"var(--bg-elev-1)",border:editId===p.id?"1px solid var(--border-accent)":"1px solid var(--border-subtle)",borderRadius:"var(--r-lg)",padding:"var(--s-3) var(--s-4)",display:"flex",alignItems:"center",gap:"var(--s-3)"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:"var(--text-primary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
              <div style={{fontSize:11,color:"var(--text-secondary)",marginTop:2}}>{p.amp&&p.amp!=="ToneNET"?p.amp+" · ":""}{p.channel?p.channel+" · ":""}{p.gain} gain · {STYLE_OPTS.find(s=>s.v===p.style)?.l||p.style}{p.cab?" · "+p.cab:""}</div>
              {p.comment&&<div style={{fontSize:10,color:"var(--text-tertiary)",fontStyle:"italic",marginTop:1}}>{p.comment}</div>}
            </div>
            <div style={{display:"flex",gap:4,flexShrink:0}}>
              <button onClick={()=>startEdit(p)} style={{background:"var(--bg-elev-2)",border:"none",borderRadius:"var(--r-sm)",padding:"4px 8px",fontSize:10,color:"var(--text-secondary)",cursor:"pointer"}}>✏️</button>
              <button onClick={()=>deletePreset(p.id)} style={{background:"var(--red-bg)",border:"none",borderRadius:"var(--r-sm)",padding:"4px 8px",fontSize:10,color:"var(--danger)",cursor:"pointer"}}>🗑</button>
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────
// ─── Mon Profil Screen ────────────────────────────────────────────────────────
// MesAppareilsTab — Phase 2 étape 3 (étendu Phase 5 Item E).
// Liste les devices enregistrés (getAllDevices) avec une checkbox par
// device. Phase 5 : le toggle écrit UNIQUEMENT profile.enabledDevices.
// Le miroir vers profile.devices (legacy v2) a été supprimé en même
// temps que le drop du champ via migrateV5toV6.
// Garde-fou : au moins un device doit rester coché — décocher le
// dernier ne fait rien (refus silencieux).
function MesAppareilsTab({profile,profiles,onProfiles,activeProfileId}) {
  const allDevices = getAllDevices();
  const enabled = new Set(profile.enabledDevices || []);
  const toggleDevice = (id) => {
    const next = new Set(enabled);
    if (next.has(id)) {
      if (next.size <= 1) return;
      next.delete(id);
    } else {
      next.add(id);
    }
    const arr = allDevices.filter(d => next.has(d.id)).map(d => d.id);
    onProfiles(p => ({
      ...p,
      [activeProfileId]: {
        ...p[activeProfileId],
        enabledDevices: arr,
      },
    }));
  };
  return (
    <div style={{background:"var(--a4)",border:"1px solid var(--a8)",borderRadius:"var(--r-lg)",padding:16,marginBottom:16}}>
      <div style={{fontSize:13,fontWeight:700,color:"var(--text)",marginBottom:6}}>Mes appareils audio</div>
      <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:12}}>Coche les appareils que tu utilises. Les blocs Recap et Synthèse n'afficheront que ceux-ci. Au moins un appareil doit rester coché.</div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {allDevices.map(d => {
          const on = enabled.has(d.id);
          return (
            <button
              key={d.id}
              onClick={() => toggleDevice(d.id)}
              style={{
                display:"flex", alignItems:"center", gap:12,
                background: on ? "var(--green-bg)" : "var(--a3)",
                border: on ? "1px solid var(--green-border)" : "1px solid var(--a8)",
                borderRadius:"var(--r-md)", padding:"12px 14px",
                cursor:"pointer", textAlign:"left", width:"100%",
              }}
            >
              <div style={{
                width:18, height:18, borderRadius:"var(--r-sm)",
                border: on ? "2px solid var(--green)" : "2px solid var(--text-muted)",
                background: on ? "var(--green)" : "transparent",
                display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
              }}>
                {on && <span style={{color:"var(--bg)",fontSize:10,fontWeight:900}}>✓</span>}
              </div>
              <span style={{fontSize:18,flexShrink:0}}>{d.icon}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:on ? "var(--text)" : "var(--text-sec)"}}>{d.label}</div>
                <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>{d.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonProfilScreen({songDb,onSongDb,setlists,allSetlists,onSetlists,onDeletedSetlistIds,banksAnn,onBanksAnn,banksPlug,onBanksPlug,onBack,onNavigate,aiProvider,onAiProvider,aiKeys,onAiKeys,theme,onTheme,profile,profiles,onProfiles,activeProfileId,allGuitars,allRigsGuitars,guitarBias,initTab,customGuitars,onCustomGuitars,toneNetPresets,onToneNetPresets,fullState,onImportState,onLogout}) {
  const [tab,setTab]=useState(initTab||"profile");
  const [newSlName,setNewSlName]=useState("");
  const [editSlId,setEditSlId]=useState(null);
  const [editSlName,setEditSlName]=useState("");
  const [newSongTitle,setNewSongTitle]=useState("");
  const [newSongArtist,setNewSongArtist]=useState("");
  const [newSongSlIds,setNewSongSlIds]=useState([]);
  const toggleNewSongSl=id=>setNewSongSlIds(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const [expandedSongId,setExpandedSongId]=useState(null);
  const toggleSongInSetlist=(songId,slId)=>onSetlists(p=>p.map(sl=>sl.id!==slId?sl:{...sl,songIds:sl.songIds.includes(songId)?sl.songIds.filter(x=>x!==songId):[...sl.songIds,songId]}));
  const inp={background:"var(--bg-card)",color:"var(--text)",border:"1px solid var(--a15)",borderRadius:"var(--r-md)",padding:"6px 10px",fontSize:12,boxSizing:"border-box"};
  const tabBtn=(id,label)=>(
    <button onClick={()=>setTab(id)} style={{background:tab===id?"var(--accent-bg)":"var(--a5)",border:tab===id?"1px solid var(--border-accent)":"1px solid var(--a8)",color:tab===id?"var(--accent)":"var(--text-sec)",borderRadius:"var(--r-md)",padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>{label}</button>
  );
  const createSetlist=()=>{if(!newSlName.trim())return;onSetlists(p=>[...p,{id:`sl_${Date.now()}`,name:newSlName.trim(),songIds:[],profileIds:[activeProfileId]}]);setNewSlName("");};
  const deleteSetlist=id=>{
    const sl=setlists.find(s=>s.id===id);
    if(!sl) return;
    const n=sl.songIds.length;
    if(!window.confirm(`Supprimer la setlist "${sl.name}" ?${n>0?"\nElle contient "+n+" morceau"+(n>1?"x":"")+" (les morceaux ne sont pas supprimés de la base).":""}`)) return;
    onSetlists(p=>p.filter(s=>s.id!==id));
  };
  const renameSetlist=(id,name)=>onSetlists(p=>p.map(s=>s.id===id?{...s,name}:s));
  const removeSongFromSetlist=(slId,songId)=>onSetlists(p=>p.map(sl=>sl.id===slId?{...sl,songIds:sl.songIds.filter(x=>x!==songId)}:sl));
  const addSongToDb=()=>{
    if(!newSongTitle.trim())return;
    const title=newSongTitle.trim();
    const artist=newSongArtist.trim()||"Artiste inconnu";
    const dup=findDuplicateSong(songDb,title,artist);
    if(dup){
      const slCount=newSongSlIds.length;
      const msg=`"${dup.title}" (${dup.artist}) est déjà dans la base.${slCount>0?"\n\nVoulez-vous l'ajouter "+(slCount>1?"aux setlists sélectionnées":"à la setlist sélectionnée")+" ?":""}`;
      if(slCount>0){
        if(window.confirm(msg)){
          onSetlists(p=>p.map(sl=>newSongSlIds.includes(sl.id)&&!sl.songIds.includes(dup.id)?{...sl,songIds:[...sl.songIds,dup.id]}:sl));
        }
      }else{
        window.alert(msg);
      }
      setNewSongTitle("");setNewSongArtist("");setNewSongSlIds([]);
      return;
    }
    const ns={id:`c_${Date.now()}`,title,artist,isCustom:true,ig:[],aiCache:null};
    onSongDb(p=>[...p,ns]);
    if(newSongSlIds.length>0)onSetlists(p=>p.map(sl=>newSongSlIds.includes(sl.id)?{...sl,songIds:[...sl.songIds,ns.id]}:sl));
    fetchAI(ns,"",banksAnn,banksPlug,aiProvider,aiKeys,allGuitars,null,null,profile?.recoMode||"balanced",guitarBias)
      .then(r=>onSongDb(p=>p.map(x=>x.id===ns.id?{...x,aiCache:updateAiCache(x.aiCache,"",r)}:x)))
      .catch(()=>{});
    setNewSongTitle("");setNewSongArtist("");setNewSongSlIds([]);
  };
  const deleteSongFromDb=id=>{
    const s=songDb.find(x=>x.id===id);
    if(!s) return;
    if(!window.confirm(`Supprimer "${s.title}" (${s.artist}) de la base ?\nLe morceau sera retiré de toutes les setlists.`)) return;
    onSongDb(p=>p.filter(x=>x.id!==id));onSetlists(p=>p.map(sl=>({...sl,songIds:sl.songIds.filter(x=>x!==id)})));
  };
  return (
    <div>
      <Breadcrumb crumbs={[{label:"Accueil",screen:"list"},{label:"Mon profil"}]} onNavigate={onNavigate}/>
      <div style={{fontFamily:"var(--font-display)",fontSize:"var(--fs-lg)",fontWeight:800,color:"var(--text-primary)",marginBottom:16}}>👤 Mon profil</div>
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {tabBtn("profile","🎸 Guitares")}
        {tabBtn("devices","📱 Mes appareils")}
        {tabBtn("sources","📦 Sources")}
        {tabBtn("tonenet","🌐 ToneNET")}
        {/* Phase 5 (Item E) : tabs device-spécifiques basées sur
            enabledDevices (legacy profile.devices supprimé en v6). */}
        {(()=>{const en=new Set(profile.enabledDevices||[]);return <>
          {en.has('tonex-pedal')&&tabBtn("pedale","🎛 Pedale ToneX")}
          {en.has('tonex-anniversary')&&tabBtn("ann","🎛 ToneX Ann.")}
          {en.has('tonex-plug')&&tabBtn("plug","🔌 ToneX Plug")}
          {en.has('tonemaster-pro')&&tabBtn("tmp","🎚️ Patches TMP")}
        </>;})()}
        {tabBtn("display","🎨 Affichage")}
        {tabBtn("reco","🎯 Préférences IA")}
        {profile.isAdmin&&tabBtn("ia","🔑 Cle API")}
        {profile.isAdmin&&tabBtn("maintenance","🔧 Maintenance")}
        {profile.isAdmin&&tabBtn("export","📋 Export / Import")}
        {profile.isAdmin&&tabBtn("admin_profiles","👥 Profils")}
      </div>
      {tab==="profile"&&<ProfileTab profile={profile} profiles={profiles} onProfiles={onProfiles} activeProfileId={activeProfileId} inp={inp} section="guitars" aiKeys={aiKeys} customGuitars={customGuitars} onCustomGuitars={onCustomGuitars}/>}
      {tab==="devices"&&<MesAppareilsTab profile={profile} profiles={profiles} onProfiles={onProfiles} activeProfileId={activeProfileId}/>}
      {tab==="sources"&&<ProfileTab profile={profile} profiles={profiles} onProfiles={onProfiles} activeProfileId={activeProfileId} inp={inp} section="sources"/>}
      {tab==="tonenet"&&<ToneNetTab toneNetPresets={toneNetPresets} onToneNetPresets={onToneNetPresets} inp={inp}/>}
      {tab==="setlists"&&<div>
        <div style={{fontSize:13,color:"var(--text-sec)",marginBottom:12}}>{setlists.length} setlist{setlists.length>1?"s":""}</div>
        {setlists.map(sl=>(
          <div key={sl.id} style={{background:"var(--a4)",border:"1px solid var(--a8)",borderRadius:"var(--r-lg)",padding:14,marginBottom:12}}>
            {editSlId===sl.id?(
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                <InlineRenameInput initialName={sl.name} onSave={name=>{renameSetlist(sl.id,name);setEditSlId(null);}} onCancel={()=>setEditSlId(null)} inp={inp}/>
              </div>
            ):(
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{flex:1,fontSize:14,fontWeight:700,color:"var(--text)"}}>{sl.name}</div>
                <span style={{fontSize:11,color:"var(--text-muted)"}}>{sl.songIds.length} morceaux</span>
                <button onClick={()=>{setEditSlId(sl.id);setEditSlName(sl.name);}} style={{background:"var(--a7)",border:"none",color:"var(--text-sec)",borderRadius:"var(--r-md)",padding:"4px 8px",fontSize:11,cursor:"pointer"}}>✏️</button>
                {setlists.length>1&&<button onClick={()=>deleteSetlist(sl.id)} style={{background:"var(--red-bg)",border:"1px solid var(--red-border)",color:"var(--red)",borderRadius:"var(--r-md)",padding:"4px 8px",fontSize:11,cursor:"pointer"}}>🗑</button>}
              </div>
            )}
          </div>
        ))}
        <div style={{background:"var(--accent-bg)",border:"1px solid var(--accent-soft)",borderRadius:"var(--r-lg)",padding:14,marginTop:8}}>
          <div style={{fontSize:12,color:"var(--accent)",fontWeight:600,marginBottom:8}}>+ Nouvelle setlist</div>
          <div style={{display:"flex",gap:8}}>
            <input placeholder="Nom de la setlist" value={newSlName} onChange={e=>setNewSlName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createSetlist()} style={{...inp,flex:1}}/>
            <button onClick={createSetlist} disabled={!newSlName.trim()} style={{background:newSlName.trim()?"var(--accent)":"var(--bg-elev-3)",border:"none",color:"var(--text)",borderRadius:"var(--r-md)",padding:"6px 14px",fontSize:12,fontWeight:700,cursor:newSlName.trim()?"pointer":"not-allowed"}}>Créer</button>
          </div>
        </div>
      </div>}
      {tab==="songs"&&<div>
        <div style={{fontSize:13,color:"var(--text-sec)",marginBottom:12}}>{songDb.length} morceaux dans la base</div>
        {songDb.map(s=>{
          const expanded=expandedSongId===s.id;
          return (
          <div key={s.id} style={{background:"var(--a3)",border:"1px solid var(--a6)",borderRadius:"var(--r-lg)",marginBottom:6,overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px"}}>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{s.title}</div><div style={{fontSize:11,color:"var(--text-muted)"}}>{s.artist}{s.isCustom?" · ✨IA":""}</div></div>
              <button onClick={()=>setExpandedSongId(expanded?null:s.id)} style={{background:expanded?"var(--accent-soft)":"var(--a7)",border:expanded?"1px solid var(--accent-border)":"1px solid var(--a10)",color:expanded?"var(--accent)":"var(--text-sec)",borderRadius:"var(--r-md)",padding:"4px 8px",fontSize:11,cursor:"pointer"}}>Setlists</button>
              <button onClick={()=>deleteSongFromDb(s.id)} style={{background:"var(--red-bg)",border:"1px solid var(--red-border)",color:"var(--red)",borderRadius:"var(--r-md)",padding:"4px 10px",fontSize:11,cursor:"pointer"}}>Supprimer</button>
            </div>
            {expanded&&<div style={{padding:"8px 12px 10px",borderTop:"1px solid var(--a5)",display:"flex",gap:6,flexWrap:"wrap"}}>
              {setlists.map(sl=>{const inSl=sl.songIds.includes(s.id);return(
                <button key={sl.id} onClick={()=>toggleSongInSetlist(s.id,sl.id)} style={{background:inSl?"var(--green-border)":"var(--a5)",border:inSl?"1px solid rgba(74,222,128,0.4)":"1px solid var(--a10)",color:inSl?"var(--green)":"var(--text-sec)",borderRadius:"var(--r-md)",padding:"4px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{inSl?"✓ ":""}{sl.name}</button>
              );})}
            </div>}
          </div>
        );})}

        <div style={{background:"var(--accent-bg)",border:"1px solid var(--accent-soft)",borderRadius:"var(--r-lg)",padding:14,marginTop:10}}>
          <div style={{fontSize:12,color:"var(--accent)",fontWeight:600,marginBottom:10}}>+ Ajouter un morceau</div>
          <input placeholder="Titre *" value={newSongTitle} onChange={e=>setNewSongTitle(e.target.value)} style={{...inp,width:"100%",marginBottom:7}}/>
          <input placeholder="Artiste" value={newSongArtist} onChange={e=>setNewSongArtist(e.target.value)} style={{...inp,width:"100%",marginBottom:10}}/>
          <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:6}}>Ajouter aussi à :</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
            {setlists.map(sl=>{const sel=newSongSlIds.includes(sl.id);return(
              <button key={sl.id} onClick={()=>toggleNewSongSl(sl.id)} style={{background:sel?"var(--accent-bg)":"var(--a5)",border:sel?"1px solid var(--border-accent)":"1px solid var(--a10)",color:sel?"var(--accent)":"var(--text-sec)",borderRadius:"var(--r-md)",padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{sl.name}</button>
            );})}
          </div>
          <button onClick={addSongToDb} disabled={!newSongTitle.trim()} style={{width:"100%",background:newSongTitle.trim()?"var(--accent)":"var(--bg-elev-3)",color:"var(--text)",border:"none",borderRadius:"var(--r-md)",padding:"9px",fontSize:13,fontWeight:600,cursor:newSongTitle.trim()?"pointer":"not-allowed"}}>Ajouter à la base</button>
        </div>
      </div>}
      {tab==="display"&&<div>
        <div style={{fontSize:13,color:"var(--text-sec)",marginBottom:16}}>Apparence de l'application.</div>
        <div style={{background:"var(--a4)",border:"1px solid var(--a8)",borderRadius:"var(--r-lg)",padding:16}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--text)",marginBottom:12}}>Thème</div>
          <div style={{display:"flex",gap:8}}>
            {[{v:"dark",l:"🌙 Sombre",desc:"Fond sombre"},{v:"light",l:"☀️ Clair",desc:"Fond clair"}].map(({v,l,desc})=>(
              <button key={v} onClick={()=>onTheme(v)} style={{flex:1,background:theme===v?"var(--accent-bg)":"var(--a5)",border:theme===v?"1px solid var(--border-accent)":"1px solid var(--a10)",color:theme===v?"var(--accent)":"var(--text-sec)",borderRadius:"var(--r-lg)",padding:"14px 8px",fontSize:13,fontWeight:600,cursor:"pointer",textAlign:"center"}}>
                <div style={{fontSize:22,marginBottom:4}}>{v==="dark"?"🌙":"☀️"}</div>
                <div>{l.split(" ")[1]}</div>
                <div style={{fontSize:10,color:"var(--text-muted)",marginTop:2}}>{desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>}
      {tab==="pedale"&&<BankEditor banks={banksAnn} onBanks={onBanksAnn} color="var(--accent)" maxBanks={50} factoryBanks={FACTORY_BANKS_PEDALE} toneNetPresets={toneNetPresets}/>}
      {/* Anniversary : factoryBanks construit Phase 3.6 depuis les 150 captures
           Anniversary exclusives du ANNIVERSARY_CATALOG (50 banks A/B/C). */}
      {tab==="ann"&&<BankEditor banks={banksAnn} onBanks={onBanksAnn} color="var(--accent)" maxBanks={50} factoryBanks={FACTORY_BANKS_ANNIVERSARY} toneNetPresets={toneNetPresets}/>}
      {tab==="plug"&&<BankEditor banks={banksPlug} onBanks={onBanksPlug} color="var(--accent)" maxBanks={10} startBank={1} factoryBanks={FACTORY_BANKS_PLUG} toneNetPresets={toneNetPresets}/>}
      {tab==="tmp"&&<TmpBrowser profile={profile} onUpdateCustoms={(customs)=>{
        onProfiles(p=>{
          const cur=p[activeProfileId];if(!cur) return p;
          const prevTmp=cur.tmpPatches||{custom:[],factoryOverrides:{}};
          return {...p,[activeProfileId]:{...cur,tmpPatches:{...prevTmp,custom:customs},lastModified:Date.now()}};
        });
      }}/>}
      {tab==="reco"&&<div>
        {/* Phase 7.1 — Préférences IA : Mode reco (Fidèle / Interprétation
            / Équilibré). Influence les prompts fetchAI futurs et le
            scoring local. */}
        <div style={{fontSize:13,color:"var(--text-sec)",marginBottom:12}}>Comment l'IA propose les recommandations.</div>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
          {[
            {id:"balanced",icon:"⚖️",label:"Équilibré (défaut)",desc:"Mélange fidélité au morceau original et versatilité du rig. Comportement actuel."},
            {id:"faithful",icon:"🎯",label:"Fidèle à l'original",desc:"L'IA privilégie la guitare/ampli/effets exacts utilisés sur l'enregistrement original. Reco proche du son du disque."},
            {id:"interpretation",icon:"🎨",label:"Interprétation libre",desc:"L'IA privilégie les guitares versatiles (ES-335, SG, Strat) qui couvrent bien le style, même si ce n'est pas l'instrument original. Pratique si tu as un rig limité."},
          ].map(({id,icon,label,desc})=>{
            const active=(profile.recoMode||"balanced")===id;
            return <button
              key={id}
              data-testid={`reco-mode-${id}`}
              onClick={()=>{
                onProfiles(p=>({...p,[activeProfileId]:{...p[activeProfileId],recoMode:id,lastModified:Date.now()}}));
              }}
              style={{display:"flex",alignItems:"flex-start",gap:10,background:active?"var(--accent-bg)":"var(--a3)",border:active?"1px solid var(--accent-border)":"1px solid var(--a8)",borderRadius:"var(--r-md)",padding:"12px 14px",cursor:"pointer",textAlign:"left"}}
            >
              <div style={{width:18,height:18,borderRadius:"50%",border:active?"2px solid var(--accent)":"2px solid var(--text-muted)",background:active?"var(--accent)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2}}>{active&&<span style={{color:"var(--bg)",fontSize:11,fontWeight:900}}>✓</span>}</div>
              <div style={{flex:1,display:"flex",flexDirection:"column",gap:4}}>
                <div style={{fontSize:13,color:active?"var(--text)":"var(--text-muted)",fontWeight:active?700:500,display:"flex",alignItems:"center",gap:6}}>
                  <span>{icon}</span>
                  <span>{label}</span>
                </div>
                <div style={{fontSize:11,color:"var(--text-dim)",lineHeight:1.5}}>{desc}</div>
              </div>
            </button>;
          })}
        </div>
        <div style={{fontSize:10,color:"var(--text-dim)",fontStyle:"italic",lineHeight:1.5,marginBottom:16}}>Ce mode est passé en input à chaque appel IA. Les morceaux déjà analysés gardent leur cache jusqu'à invalidation.</div>
        {/* Phase 7.7 + 7.9 — Préférences guitare/style. Auto-dérivé des
            feedbacks (Phase 7.7) ET overridable manuellement par style
            (Phase 7.9). Manual > auto. Soft hint injecté dans chaque
            fetchAI. Section visible pour tous (admin et non-admin). */}
        {(()=>{
          const BIAS_STYLES=[
            {id:"blues",label:"Blues"},
            {id:"rock",label:"Rock"},
            {id:"hard_rock",label:"Hard rock"},
            {id:"jazz",label:"Jazz"},
            {id:"metal",label:"Metal"},
            {id:"pop",label:"Pop"},
          ];
          const manualMap=(profile.guitarBias&&typeof profile.guitarBias==="object")?profile.guitarBias:{};
          const manualCount=Object.values(manualMap).filter(Boolean).length;
          const writeOverride=(style,guitarId)=>{
            onProfiles(p=>{
              const cur=p[activeProfileId];if(!cur) return p;
              const nextBias={...(cur.guitarBias||{})};
              if(guitarId) nextBias[style]=guitarId; else delete nextBias[style];
              return {...p,[activeProfileId]:{...cur,guitarBias:nextBias,lastModified:Date.now()}};
            });
          };
          const resetAllManual=()=>{
            if(!window.confirm(`Effacer ${manualCount} override${manualCount>1?"s":""} manuel${manualCount>1?"s":""} ?\n\nLe bias retombera sur les valeurs auto-dérivées de tes feedbacks.`)) return;
            onProfiles(p=>{
              const cur=p[activeProfileId];if(!cur) return p;
              return {...p,[activeProfileId]:{...cur,guitarBias:{},lastModified:Date.now()}};
            });
          };
          return <div style={{background:"var(--a4)",border:"1px solid var(--a8)",borderRadius:"var(--r-lg)",padding:14,marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:700,color:"var(--text)",marginBottom:4}}>Préférences guitare/style</div>
            <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:10,lineHeight:1.4}}>L'IA apprend tes préférences depuis tes feedbacks (📊 auto, dès 3 morceaux feedbackés). Tu peux forcer un choix manuel (🎯 manuel — gagne sur l'auto). Soft hint dans le prompt, l'IA reste libre.</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {BIAS_STYLES.map(({id,label})=>{
                const effective=guitarBias&&guitarBias[id];
                const manualId=manualMap[id]||"";
                return <div key={id} data-testid={`bias-row-${id}`} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,background:"var(--a6)",borderRadius:"var(--r-md)",padding:"6px 10px",flexWrap:"wrap"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,minWidth:140}}>
                    <span style={{fontSize:11,fontWeight:700,color:"var(--accent)",textTransform:"uppercase",letterSpacing:0.5,minWidth:70}}>{label}</span>
                    {effective
                      ?<span style={{fontSize:10,padding:"2px 6px",borderRadius:"var(--r-sm)",background:effective.source==="manual"?"var(--accent-bg)":"var(--a8)",color:effective.source==="manual"?"var(--accent)":"var(--text-sec)",fontWeight:600}}>
                          {effective.source==="manual"?"🎯 manuel":`📊 auto · ${effective.count} fb`}
                        </span>
                      :<span style={{fontSize:10,color:"var(--text-dim)",fontStyle:"italic"}}>aucune</span>
                    }
                    {effective&&<span style={{fontSize:11,color:"var(--text)",fontWeight:500}}>→ {effective.guitarName}</span>}
                  </div>
                  <select
                    data-testid={`bias-override-${id}`}
                    value={manualId}
                    onChange={e=>writeOverride(id,e.target.value)}
                    style={{background:"var(--bg-card)",color:"var(--text)",border:"1px solid var(--a15)",borderRadius:"var(--r-sm)",padding:"4px 6px",fontSize:11,minWidth:140}}
                  >
                    <option value="">— Pas d'override —</option>
                    {(allGuitars||[]).map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>;
              })}
            </div>
            {manualCount>0&&<button
              data-testid="bias-reset-manual"
              onClick={resetAllManual}
              style={{marginTop:10,fontSize:11,background:"transparent",border:"1px solid var(--a15)",color:"var(--text-sec)",borderRadius:"var(--r-md)",padding:"6px 10px",cursor:"pointer"}}
            >Réinitialiser les {manualCount} override{manualCount>1?"s":""} manuel{manualCount>1?"s":""}</button>}
          </div>;
        })()}
        {/* Phase 7.4 — Bouton pour invalider tous les aiCache d'un coup.
            Au prochain ouvre d'un morceau, fetchAI tournera avec le nouveau
            recoMode profil. Combinable avec "🤖 Analyser/MAJ" dans Setlists
            pour batch immédiat. */}
        {profile.isAdmin&&<div style={{background:"var(--a4)",border:"1px solid var(--a8)",borderRadius:"var(--r-lg)",padding:14}}>
          <div style={{fontSize:12,fontWeight:700,color:"var(--text)",marginBottom:4}}>Appliquer le mode à toute la base</div>
          <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:10,lineHeight:1.4}}>Invalide tous les caches IA. Au prochain ouverture de morceau (ou via "⏳ Analyser/MAJ N" dans Setlists), une nouvelle analyse sera lancée avec le mode reco actuel.</div>
          <button
            data-testid="reco-invalidate-all"
            onClick={()=>{
              const n=(songDb||[]).filter(s=>s.aiCache).length;
              if(!n){window.alert("Aucun cache IA à invalider.");return;}
              if(!window.confirm(`Invalider ${n} cache${n>1?"s":""} IA ?\n\nMode actuel : ${profile.recoMode||"balanced"}.\n\nLes morceaux passeront en ⏳ et seront re-analysés à la demande (ouverture ou bouton "⏳ Analyser/MAJ" en setlists).\n\nCela consomme du quota Gemini quand les re-analyses tournent (~8s par morceau).`)) return;
              onSongDb(p=>p.map(s=>s.aiCache?{...s,aiCache:null}:s));
              window.alert(`✓ ${n} caches invalidés. Reviens dans Setlists et clique "⏳ Analyser/MAJ".`);
            }}
            style={{background:"var(--wine-400)",border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-md)",padding:"8px 14px",fontSize:11,fontWeight:700,cursor:"pointer"}}
          >🗑 Invalider tous les caches IA</button>
        </div>}
      </div>}
      {profile.isAdmin&&tab==="ia"&&<div>
        <div style={{fontSize:13,color:"var(--text-sec)",marginBottom:12}}>Configuration de la cle API pour l'IA.</div>
        <div style={{fontSize:11,color:"var(--text-muted)",background:"var(--a4)",border:"1px solid var(--a8)",borderRadius:"var(--r-md)",padding:"8px 12px",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontWeight:700}}>Modele actif :</span>
          <span style={{color:"var(--green)",fontWeight:600}}>{aiProvider==="gemini"?"gemini-3-flash-preview":"claude-haiku-4-5"}</span>
        </div>
        <div style={{fontSize:12,fontWeight:600,color:"var(--text)",marginBottom:6}}>Cle Gemini</div>
        <input type="password" placeholder="AIza..." value={aiKeys.gemini} onChange={e=>onAiKeys(p=>({...p,gemini:e.target.value}))} style={{...inp,width:"100%",marginBottom:8,fontFamily:"monospace"}}/>
        {/* Phase 5.11 — bouton "Partager la clé" déplacé ici depuis ⚙️ Paramètres
            (où il était PIN-protégé). Push la clé Gemini locale vers Firestore
            config/apikeys → tous les profils (Arthur, Franck, Emmanuel...) la
            chargent via loadSharedKey() au boot. Indispensable pour que les
            profils sans clé personnelle puissent utiliser l'IA. */}
        <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
          <button
            data-testid="profile-share-gemini-key"
            onClick={()=>{
              if(!aiKeys.gemini){window.alert("Configure d'abord une clé Gemini.");return;}
              if(!window.confirm("Partager ta clé Gemini avec tous les profils ?\n\n• La clé est stockée dans Firestore (config/apikeys.gemini)\n• Tous les devices (Mac, iPhone, iPad) la téléchargent au boot\n• Les profils sans clé personnelle l'utiliseront en fallback\n• Les appels IA seront facturés sur ton quota Google\n\nGemini a un free tier généreux (1500 req/jour) qui suffit largement.")) return;
              saveSharedKey(aiKeys.gemini).then(()=>{
                setSharedGeminiKey(aiKeys.gemini);
                window.alert("✓ Clé partagée. Les autres profils l'utiliseront au prochain reload.");
              }).catch(e=>{
                console.error("[saveSharedKey] failed:",e);
                window.alert("Échec du partage. Vérifie ta console pour le détail.");
              });
            }}
            disabled={!aiKeys.gemini}
            style={{background:aiKeys.gemini?"var(--green)":"var(--bg-disabled)",border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-md)",padding:"6px 14px",fontSize:11,fontWeight:700,cursor:aiKeys.gemini?"pointer":"not-allowed"}}
          >🔑 Partager la clé (tous les profils)</button>
          <span style={{fontSize:10,color:"var(--text-dim)",alignSelf:"center"}}>aistudio.google.com → Get API key</span>
        </div>
        <div style={{fontSize:12,fontWeight:600,color:"var(--text)",marginBottom:6}}>Cle Anthropic (fallback)</div>
        <input type="password" placeholder="sk-ant-..." value={aiKeys.anthropic} onChange={e=>onAiKeys(p=>({...p,anthropic:e.target.value}))} style={{...inp,width:"100%",fontFamily:"monospace"}}/>
      </div>}
      {profile.isAdmin&&tab==="maintenance"&&<MaintenanceTab songDb={songDb} onSongDb={onSongDb} setlists={allSetlists} onSetlists={onSetlists} onDeletedSetlistIds={onDeletedSetlistIds} banksAnn={banksAnn} banksPlug={banksPlug} aiProvider={aiProvider} aiKeys={aiKeys} profile={profile} guitarBias={guitarBias}/>}
      {profile.isAdmin&&tab==="export"&&<ExportImportScreen banksAnn={banksAnn} onBanksAnn={onBanksAnn} banksPlug={banksPlug} onBanksPlug={onBanksPlug} onBack={()=>setTab("profile")} onNavigate={onNavigate} fullState={fullState} onImportState={onImportState} inline={true}/>}
      {profile.isAdmin&&tab==="admin_profiles"&&<ProfilesAdmin profiles={profiles} onProfiles={onProfiles}/>}
      {/* Aide, MAJ, Déconnexion */}
      <div style={{marginTop:24,paddingTop:16,borderTop:"1px solid var(--a8)",display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
        <button onClick={()=>{if(typeof setShowOnboarding==="function")setShowOnboarding(true);else{var e=new CustomEvent("showOnboarding");window.dispatchEvent(e);}}} style={{background:"none",border:"none",color:"var(--text-dim)",fontSize:12,cursor:"pointer",textDecoration:"underline"}}>Aide</button>
        <button onClick={()=>{location.reload(true);}} style={{background:"none",border:"none",color:"var(--text-dim)",fontSize:12,cursor:"pointer",textDecoration:"underline"}}>Mise a jour</button>
        {onLogout&&<button onClick={onLogout} style={{background:"var(--a5)",border:"1px solid var(--a10)",color:"var(--text-muted)",borderRadius:"var(--r-md)",padding:"8px 16px",fontSize:12,cursor:"pointer",marginLeft:"auto"}}>Se deconnecter</button>}
      </div>
    </div>
  );
}

// ─── Paramètres Screen (admin PIN) ────────────────────────────────────────────
function ParametresScreen({onBack,onNavigate,aiProvider,onAiProvider,aiKeys,onAiKeys,profile,profiles,onProfiles,activeProfileId,fullState,onImportState,banksAnn,onBanksAnn,banksPlug,onBanksPlug,songDb,onSongDb,setlists:allSetlists,onSetlists}) {
  const [unlocked,setUnlocked]=useState(false);
  const [pin,setPin]=useState("");
  const [pinErr,setPinErr]=useState(false);
  const pinRef=useRef(null);
  useEffect(()=>{if(!unlocked)setTimeout(()=>pinRef.current?.focus(),100);},[]);
  const [tab,setTab]=useState("presets");
  const tryUnlock=()=>{if(pin===ADMIN_PIN){setUnlocked(true);setPinErr(false);}else{setPinErr(true);}};
  const inp={background:"var(--bg-card)",color:"var(--text)",border:"1px solid var(--a15)",borderRadius:"var(--r-md)",padding:"6px 10px",fontSize:12,boxSizing:"border-box"};
  const tabBtn=(id,label)=>(
    <button onClick={()=>setTab(id)} style={{background:tab===id?"var(--accent-bg)":"var(--a5)",border:tab===id?"1px solid var(--border-accent)":"1px solid var(--a8)",color:tab===id?"var(--accent)":"var(--text-sec)",borderRadius:"var(--r-md)",padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>{label}</button>
  );
  return(
    <div>
      <Breadcrumb crumbs={[{label:"Accueil",screen:"list"},{label:"Paramètres"}]} onNavigate={onNavigate}/>
      <div style={{fontFamily:"var(--font-display)",fontSize:"var(--fs-lg)",fontWeight:800,color:"var(--text-primary)",marginBottom:16}}>⚙️ Paramètres</div>
      {!unlocked?(
        <div>
          <div style={{fontSize:13,color:"var(--text-sec)",marginBottom:12}}>Entrez le code administrateur.</div>
          <div style={{display:"flex",gap:8}}>
            <input ref={pinRef} type="password" inputMode="numeric" autoFocus placeholder="Code admin" value={pin} onChange={e=>{setPin(e.target.value);setPinErr(false);}} onKeyDown={e=>e.key==="Enter"&&tryUnlock()} style={{...inp,flex:1}}/>
            <button onClick={tryUnlock} style={{background:"var(--accent)",border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-md)",padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>OK</button>
          </div>
          {pinErr&&<div style={{fontSize:11,color:"var(--red)",marginTop:6}}>Code incorrect</div>}
        </div>
      ):(
        <div>
          <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
            {tabBtn("presets","📦 Sources")}
            {tabBtn("ia","🔑 Clé API")}
            {tabBtn("profiles","👤 Profils")}
            {tabBtn("maintenance","🔧 Maintenance")}
            {tabBtn("export","📋 Export / Import")}
          </div>
          {tab==="presets"&&<PacksTab profile={profile} onProfiles={onProfiles} activeProfileId={activeProfileId} aiProvider={aiProvider} aiKeys={aiKeys}/>}
          {tab==="ia"&&<div>
            <div style={{fontSize:11,color:"var(--text-muted)",background:"var(--a4)",border:"1px solid var(--a8)",borderRadius:"var(--r-md)",padding:"8px 12px",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontWeight:700}}>Modèle actif :</span>
              <span style={{color:"var(--green)",fontWeight:600}}>{aiProvider==="gemini"?"gemini-3-flash-preview":"claude-haiku-4-5"}</span>
            </div>
            <div style={{fontSize:13,color:"var(--text-sec)",marginBottom:12}}>Fournisseur IA pour l'analyse des morceaux.</div>
            <div style={{display:"flex",gap:8,marginBottom:16}}>
              {[{v:"gemini",l:"Google (Gemini)"}].map(({v,l})=>(
                <button key={v} onClick={()=>onAiProvider(v)} style={{flex:1,background:aiProvider===v?"var(--green-border)":"var(--a5)",border:aiProvider===v?"1px solid rgba(74,222,128,0.6)":"1px solid var(--a10)",color:aiProvider===v?"var(--green)":"var(--text-sec)",borderRadius:"var(--r-md)",padding:"8px",fontSize:12,fontWeight:600,cursor:"pointer"}}>{l}</button>
              ))}
            </div>
            <div style={{background:"var(--green-bg)",border:"1px solid var(--green-border)",borderRadius:"var(--r-lg)",padding:16}}>
              <div style={{fontSize:12,fontWeight:700,color:"var(--green)",marginBottom:10}}>🔑 Clé API Google AI Studio</div>
              <input type="password" placeholder="AIza..." value={aiKeys.gemini} onChange={e=>{onAiKeys(p=>({...p,gemini:e.target.value}));}} style={{...inp,width:"100%",marginBottom:8,fontFamily:"monospace"}}/>
              <button onClick={()=>{if(aiKeys.gemini){saveSharedKey(aiKeys.gemini);setSharedGeminiKey(aiKeys.gemini);}}} disabled={!aiKeys.gemini} style={{background:aiKeys.gemini?"var(--green)":"var(--bg-disabled)",border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-md)",padding:"6px 14px",fontSize:11,fontWeight:700,cursor:aiKeys.gemini?"pointer":"not-allowed",marginBottom:8}}>Partager la clé (tous les utilisateurs)</button>
              <div style={{fontSize:11,color:"var(--text-muted)"}}>aistudio.google.com → Get API key</div>
              {aiKeys.gemini&&<div style={{fontSize:11,color:"var(--green)",marginTop:8}}>✓ Clé configurée ({aiKeys.gemini.slice(0,8)}...)</div>}
            </div>
          </div>}
          {tab==="profiles"&&<ProfilesAdmin profiles={profiles} onProfiles={onProfiles}/>}
          {tab==="maintenance"&&<MaintenanceTab songDb={songDb} onSongDb={onSongDb} setlists={allSetlists} onSetlists={onSetlists} onDeletedSetlistIds={onDeletedSetlistIds} banksAnn={banksAnn} banksPlug={banksPlug} aiProvider={aiProvider} aiKeys={aiKeys} profile={profile} guitarBias={guitarBias}/>}
          {tab==="export"&&<div>
            <button onClick={()=>onNavigate("exportimport")} style={{width:"100%",background:"var(--yellow-bg)",border:"1px solid var(--yellow-border)",color:"var(--yellow)",borderRadius:"var(--r-lg)",padding:"12px 16px",fontSize:13,fontWeight:700,cursor:"pointer",textAlign:"left"}}>
              📋 Export / Import →
            </button>
          </div>}
        </div>
      )}
    </div>
  );
}

function MaintenanceTab({songDb,onSongDb,setlists,onSetlists,onDeletedSetlistIds,banksAnn,banksPlug,aiProvider,aiKeys,profile,guitarBias,onFullReset}){
  const [recalculating,setRecalculating]=useState(false);
  const [progress,setProgress]=useState({done:0,total:0,current:""});
  const [done,setDone]=useState(false);
  const [confirmReset,setConfirmReset]=useState(false);
  const cachedCount=songDb.filter(s=>s.aiCache).length;

  // Détection de doublons : groupes de morceaux dont le titre + artiste se
  // normalisent à la même clé ("T.N.T." ≡ "TNT", "Romeo & Juliet" ≡ "Romeo and Juliet").
  const duplicateGroups=useMemo(()=>{
    const byKey={};
    for(const s of songDb){
      const k=normalizeSongTitle(s.title)+"|"+normalizeArtist(s.artist);
      (byKey[k]=byKey[k]||[]).push(s);
    }
    return Object.values(byKey).filter(g=>g.length>1);
  },[songDb]);
  const dupCount=duplicateGroups.reduce((n,g)=>n+g.length-1,0);

  const mergeDuplicates=()=>{
    if(!duplicateGroups.length) return;
    const lines=duplicateGroups.map(g=>"• "+g.map(s=>`"${s.title}" — ${s.artist}`).join(" / ")).join("\n");
    if(!window.confirm(`${dupCount} doublon${dupCount>1?"s":""} à fusionner :\n\n${lines}\n\nLa version la plus riche en cache est conservée, les setlists sont redirigées.`)) return;
    // Build remap : duplicate ID → canonical ID. Canonical = celui avec le cache CoT le plus complet.
    const idMap={};
    const idsToDelete=new Set();
    const richness=(s)=>(s.aiCache?.result?.cot_step1?2:0)+(s.aiCache?1:0);
    for(const group of duplicateGroups){
      const sorted=[...group].sort((a,b)=>richness(b)-richness(a));
      const canonical=sorted[0];
      for(const s of sorted.slice(1)){idMap[s.id]=canonical.id;idsToDelete.add(s.id);}
    }
    // Remap setlists (dédup au passage)
    if(onSetlists){
      onSetlists(prev=>prev.map(sl=>({...sl,songIds:[...new Set((sl.songIds||[]).map(id=>idMap[id]||id))]})));
    }
    // Supprime les doublons du songDb
    onSongDb(prev=>prev.filter(s=>!idsToDelete.has(s.id)));
    setDone(true);setTimeout(()=>setDone(false),3000);
  };

  const recalcAll=async()=>{
    setRecalculating(true);setDone(false);
    const total=songDb.length;
    setProgress({done:0,total,current:""});
    for(let i=0;i<songDb.length;i++){
      const s=songDb[i];
      setProgress({done:i,total,current:s.title});
      try{
        const r=await fetchAI(s,"",banksAnn,banksPlug,aiProvider,aiKeys,GUITARS,null,null,profile?.recoMode||"balanced",guitarBias);
        onSongDb(p=>p.map(x=>x.id===s.id?{...x,aiCache:updateAiCache(x.aiCache,"",r)}:x));
      }catch(e){console.warn("Recalc failed for",s.title,e);}
      // Pause between requests to avoid rate limit
      if(i<songDb.length-1) await new Promise(r=>setTimeout(r,2000));
    }
    setProgress({done:total,total,current:""});
    setRecalculating(false);setDone(true);
    setTimeout(()=>setDone(false),5000);
  };

  // Phase 3.7 — refonte UX : 2 actions IA explicites au lieu de 3 boutons
  // qui se chevauchent (clearCache + recalcForAllGuitars faisaient la même
  // chose, recalcAll lançait l'IA sans avertissement sur le quota).

  // Bouton 1 — Rafraîchir l'IA (tous morceaux) : invalide aiCache. Le
  // re-fetch se fait passivement à l'ouverture de chaque morceau, en
  // utilisant l'union all-rigs des guitares (cf Phase 3.6).
  const refreshAI=()=>{
    const n=songDb.length;
    if(!window.confirm(`Rafraîchir l'IA pour ${n} morceau${n>1?'x':''} ?\n\nLe cache est vidé immédiatement. Le recalcul IA se fera passivement à l'ouverture de chaque morceau (incluant tes nouvelles guitares).\n\nAucun appel API n'est lancé maintenant.`)) return;
    onSongDb(p=>p.map(s=>({...s,aiCache:null})));
    setDone(true);setTimeout(()=>setDone(false),4000);
  };

  // Bouton 2 — Forcer le recalcul IA en bloc : actuel recalcAll, mais
  // gardé derrière un confirm explicite avec estimation de temps + nombre
  // d'appels API (le user-flow Phase 3.5 manquait l'avertissement).
  // recalcAll attend ~2s entre chaque requête + ~3-5s par appel ≈ 5s/song.
  const recalcAllConfirmed=()=>{
    const n=songDb.length;
    const estimSec=Math.round(n*5);
    const estimMin=Math.ceil(estimSec/60);
    const dureeLabel=estimMin>=2?`~${estimMin} minutes`:`~${estimSec} secondes`;
    if(!window.confirm(`Forcer le recalcul IA EN BLOC pour ${n} morceau${n>1?'x':''} ?\n\n• Durée estimée : ${dureeLabel}\n• Appels API : ${n}\n• Consomme du quota API\n\nNe ferme pas l'app pendant le traitement. Préfère "Rafraîchir l'IA" si tu n'as pas besoin du résultat immédiatement.`)) return;
    recalcAll();
  };

  return(
    <div>
      <div style={{fontSize:13,color:"var(--text-sec)",marginBottom:16}}>Outils de maintenance de l'application.</div>

      {/* SECTION 1 — Mes analyses IA (Phase 3.7) */}
      <div style={{background:"var(--a4)",border:"1px solid var(--a8)",borderRadius:"var(--r-lg)",padding:16,marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:700,color:"var(--text)",marginBottom:4,display:"flex",alignItems:"center",gap:6}}>
          <span>🤖</span><span>Mes analyses IA</span>
        </div>
        <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:14}}>{cachedCount} morceau{cachedCount>1?'x':''} en cache sur {songDb.length}</div>
        {recalculating?<div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <div style={{fontSize:20,animation:"spin 1.5s linear infinite",display:"inline-block"}}>&#9203;</div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"var(--text)"}}>{progress.done}/{progress.total}</div>
              <div style={{fontSize:11,color:"var(--text-muted)"}}>{progress.current}</div>
            </div>
          </div>
          <div style={{background:"var(--a8)",borderRadius:"var(--r-sm)",height:6,overflow:"hidden"}}>
            <div style={{width:`${progress.total?progress.done/progress.total*100:0}%`,height:"100%",background:"var(--accent)",borderRadius:"var(--r-sm)",transition:"width 0.3s"}}/>
          </div>
        </div>
        :done?<div style={{fontSize:12,color:"var(--green)",fontWeight:600}}>Terminé !</div>
        :<div style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* Bouton 1 — Rafraîchir l'IA (passive) */}
          <div>
            <button onClick={refreshAI} style={{background:"var(--accent)",border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-md)",padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>🔄 Rafraîchir l'IA (tous morceaux)</button>
            <div style={{fontSize:11,color:"var(--text-muted)",marginTop:5,lineHeight:1.4}}>Vide le cache et relance l'IA passivement à l'ouverture de chaque morceau. À utiliser après avoir ajouté des guitares ou changé ton matériel.</div>
          </div>
          {/* Bouton 2 — Forcer recalcul en bloc */}
          <div>
            <button onClick={recalcAllConfirmed} style={{background:"linear-gradient(180deg,var(--brass-200),var(--brass-400))",border:"none",color:"var(--tolex-900)",borderRadius:"var(--r-md)",padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer",boxShadow:"var(--shadow-sm)"}}>⚡ Forcer le recalcul IA en bloc — {songDb.length} morceau{songDb.length>1?'x':''}</button>
            <div style={{fontSize:11,color:"var(--text-muted)",marginTop:5,lineHeight:1.4}}>Lance immédiatement l'IA pour tous les morceaux, en bloc. Long et consomme du quota API.</div>
          </div>
        </div>}
      </div>

      {/* Fusionner les doublons */}
      <div style={{background:"var(--a4)",border:"1px solid var(--a8)",borderRadius:"var(--r-lg)",padding:16,marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:700,color:"var(--text)",marginBottom:4}}>Fusionner les doublons</div>
        <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:10}}>
          {dupCount>0
            ?`${dupCount} morceau${dupCount>1?"x":""} doublon${dupCount>1?"s":""} détecté${dupCount>1?"s":""} (variantes d'orthographe : T.N.T./TNT, Romeo & Juliet/Romeo and Juliet…). Conserve la version avec le cache le plus riche, redirige les setlists.`
            :"Aucun doublon détecté dans la base."}
        </div>
        {dupCount>0&&<button onClick={mergeDuplicates} style={{background:"var(--accent)",border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-md)",padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>Fusionner ({dupCount})</button>}
      </div>

      {/* SECTION 2 — Scoring local (Phase 3.7) */}
      {/* Visuellement séparée par une bordure brass + bg légèrement différent
           pour souligner que cette action n'utilise PAS l'IA (instantanée,
           gratuite, pas de quota). */}
      <div style={{background:"var(--a3)",border:"1px solid var(--brass-400)",borderLeftWidth:3,borderRadius:"var(--r-lg)",padding:16,marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:700,color:"var(--text)",marginBottom:14,display:"flex",alignItems:"center",gap:6}}>
          <span>📐</span><span>Scoring local</span>
        </div>
        <div>
          <button onClick={()=>{
            try{
              const updated=songDb.map(s=>{
                if(!s.aiCache?.result?.cot_step1) return s;
                const gId=s.aiCache.gId||"";
                const gType=findGuitar(gId)?.type||"HB";
                const cleaned={...s.aiCache.result,preset_ann:null,preset_plug:null,ideal_preset:null,ideal_preset_score:0,ideal_top3:null};
                const recalc=enrichAIResult(cleaned,gType,gId,banksAnn,banksPlug);
                return {...s,aiCache:{...updateAiCache(s.aiCache,gId,recalc),sv:SCORING_VERSION}};
              });
              onSongDb(()=>updated);
            }catch(e){console.warn("Rescore error:",e);}
            setDone(true);setTimeout(()=>setDone(false),3000);
          }} style={{background:"linear-gradient(180deg,var(--brass-200),var(--brass-400))",border:"none",color:"var(--tolex-900)",borderRadius:"var(--r-md)",padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer",boxShadow:"var(--shadow-sm)"}}>📐 Recalculer les scores (sans IA) — {songDb.filter(s=>s.aiCache).length} morceau{songDb.filter(s=>s.aiCache).length>1?'x':''} en cache</button>
          <div style={{fontSize:11,color:"var(--text-muted)",marginTop:5,lineHeight:1.4}}>Réapplique le scoring sur les analyses existantes. À utiliser après avoir ajouté un preset ToneNET ou modifié tes banks.</div>
        </div>
      </div>

      {/* Backups automatiques */}
      <div style={{background:"var(--a4)",border:"1px solid var(--a8)",borderRadius:"var(--r-lg)",padding:16,marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:700,color:"var(--text)",marginBottom:4}}>Sauvegardes automatiques</div>
        <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:10}}>L'app sauvegarde automatiquement tes données toutes les 5 minutes. Tu peux restaurer un état précédent en cas de problème.</div>
        {(()=>{
          const backups=listBackups();
          if(!backups.length) return <div style={{fontSize:11,color:"var(--text-dim)"}}>Aucune sauvegarde disponible.</div>;
          return <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {backups.map((b,i)=>{
              const d=new Date(b.time);
              const ago=Math.round((Date.now()-b.time)/60000);
              const label=ago<60?`il y a ${ago} min`:ago<1440?`il y a ${Math.round(ago/60)}h`:`${d.toLocaleDateString("fr")} ${d.toLocaleTimeString("fr",{hour:"2-digit",minute:"2-digit"})}`;
              return <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"var(--a3)",borderRadius:"var(--r-md)",padding:"8px 10px"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,fontWeight:600,color:"var(--text)"}}>{label}</div>
                  <div style={{fontSize:10,color:"var(--text-dim)"}}>{b.songs} morceaux · {b.profiles} profil{b.profiles>1?"s":""}</div>
                </div>
                <button onClick={()=>{if(confirm("Restaurer cette sauvegarde ? Les données actuelles seront remplacées.")){restoreBackup(i);location.reload();}}} style={{background:"var(--accent)",border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-md)",padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>Restaurer</button>
              </div>;
            })}
          </div>;
        })()}
        {/* FIX 4.1 C — bouton "Vider les backups" pour reprendre la
            main sur le quota localStorage (utile en cas de
            QuotaExceededError observé sur tonex_guide_backups). */}
        <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
          <button data-testid="maint-clear-backups" onClick={()=>{
            const n=listBackups().length;
            if(n===0){window.alert("Aucune sauvegarde à supprimer.");return;}
            if(!window.confirm(`Vider les ${n} sauvegarde${n>1?"s":""} stockées localement ? Les données actuelles ne sont pas affectées.`)) return;
            clearBackups();
            // force re-render via un state local — on bricole avec
            // location.reload() pour rester simple : rare action
            // d'admin, perte d'état négligeable.
            location.reload();
          }} style={{background:"var(--a5)",border:"1px solid var(--a8)",color:"var(--text-muted)",borderRadius:"var(--r-md)",padding:"6px 12px",fontSize:11,cursor:"pointer"}}>🗑 Vider les sauvegardes</button>
        </div>
      </div>

      {/* FIX 4.1 B — bouton manuel "Fusionner setlists doublons".
          Compte les doublons (par name + profileIds) et propose une
          confirmation explicite avant de re-écrire setlists via
          dedupSetlists. */}
      <div style={{background:"var(--a4)",border:"1px solid var(--a8)",borderRadius:"var(--r-lg)",padding:16,marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:700,color:"var(--text)",marginBottom:4}}>Setlists — doublons</div>
        <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:10}}>Deux modes de dédup. Mode strict (gentle) = même nom ET mêmes profils. Mode aggressif = même nom seul, fusionne les profils en union.</div>
        {(()=>{
          // Phase 5.7.3 — utilise la variante avec tombstones pour propager
          // les suppressions via Firestore (sinon les autres devices
          // ressuscitent les setlists dédupliquées).
          const strictRes=dedupSetlistsWithTombstones(setlists);
          const dedupedStrict=strictRes.setlists;
          const tombstonesStrict=strictRes.tombstones;
          const removedStrict=setlists.length-dedupedStrict.length;
          const looseRes=dedupSetlistsWithTombstones(setlists,{mergeAcrossProfiles:true});
          const dedupedLoose=looseRes.setlists;
          const tombstonesLoose=looseRes.tombstones;
          const removedLoose=setlists.length-dedupedLoose.length;
          // Le mode aggressif englobe tous les doublons stricts ET les
          // name-only. removedExtra = strictement plus de fusion en
          // mode aggressif.
          const removedExtra=removedLoose-removedStrict;
          const dupByName=findSetlistDuplicatesByName(setlists);
          // Récap groupes name-only mais qui ne sont PAS strict-doublons
          // (donc différenciés par profileIds).
          const nameOnlyGroups=dupByName.filter(g=>{
            // Si tous les items du groupe ont le même profileIds, c'est
            // un doublon strict aussi → exclu ici.
            const keys=new Set(g.items.map(sl=>(Array.isArray(sl.profileIds)?[...sl.profileIds].sort().join('|'):'')));
            return keys.size>1;
          });
          return <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {/* Mode strict */}
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <div style={{fontSize:11,color:"var(--text-sec)",flex:1,minWidth:160}}>
                <b style={{color:"var(--text-muted)"}}>Strict</b> (name + profils) :
                {removedStrict<=0?<span style={{color:"var(--text-dim)",fontStyle:"italic"}}> aucun doublon</span>:` ${removedStrict} doublon${removedStrict>1?"s":""}`}
              </div>
              {removedStrict>0&&<button data-testid="maint-dedup-setlists" onClick={()=>{
                const msg=`${removedStrict} setlist${removedStrict>1?"s":""} doublon${removedStrict>1?"s":""} détecté${removedStrict>1?"s":""} (même nom ET mêmes profils).\n\nLa version la plus complète est conservée, morceaux fusionnés. Confirmer ?`;
                if(!window.confirm(msg)) return;
                onSetlists(()=>dedupedStrict);
                // Phase 5.7.3 — propage les tombstones pour bloquer la
                // résurrection via Firestore poll.
                if(onDeletedSetlistIds&&Object.keys(tombstonesStrict).length){
                  onDeletedSetlistIds(prev=>({...(prev||{}),...tombstonesStrict}));
                }
              }} style={{background:"linear-gradient(180deg,var(--brass-200),var(--brass-400))",border:"none",color:"var(--tolex-900)",borderRadius:"var(--r-md)",padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer",boxShadow:"var(--shadow-sm)"}}>🧹 Fusionner strict</button>}
            </div>
            {/* Mode aggressif (Phase 5.4) */}
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",borderTop:"1px solid var(--a7)",paddingTop:8}}>
              <div style={{fontSize:11,color:"var(--text-sec)",flex:1,minWidth:160}}>
                <b style={{color:"var(--text-muted)"}}>Aggressif</b> (name seul, fusionne profils) :
                {nameOnlyGroups.length===0?<span style={{color:"var(--text-dim)",fontStyle:"italic"}}> aucun doublon supplémentaire</span>:` ${nameOnlyGroups.length} groupe${nameOnlyGroups.length>1?"s":""} (${nameOnlyGroups.map(g=>g.name).join(", ")})`}
              </div>
              {removedExtra>0&&<button data-testid="maint-dedup-setlists-loose" onClick={()=>{
                const lines=nameOnlyGroups.map(g=>`• "${g.name}" → ${g.items.length} versions, profils fusionnés [${g.profileIdsUnion.join(", ")}]`).join("\n");
                const msg=`${removedExtra} setlist${removedExtra>1?"s":""} doublon${removedExtra>1?"s":""} par nom seul (profils différents) :\n\n${lines}\n\nLa version la plus complète est conservée, profils ET morceaux fusionnés. Confirmer ?`;
                if(!window.confirm(msg)) return;
                onSetlists(()=>dedupedLoose);
                // Phase 5.7.3 — propage les tombstones pour bloquer la
                // résurrection via Firestore poll.
                if(onDeletedSetlistIds&&Object.keys(tombstonesLoose).length){
                  onDeletedSetlistIds(prev=>({...(prev||{}),...tombstonesLoose}));
                }
              }} style={{background:"var(--wine-400)",border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-md)",padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer",boxShadow:"var(--shadow-sm)"}}>⚡ Fusionner aggressif</button>}
            </div>
          </div>;
        })()}
      </div>

      {/* Réinitialiser */}
      <div style={{background:"var(--red-bg)",border:"1px solid var(--red-border)",borderRadius:"var(--r-lg)",padding:16,marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:700,color:"var(--red)",marginBottom:4}}>Réinitialiser toutes les données</div>
        <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:10}}>Remet l'app à zéro : profils, banks, morceaux. Les presets par défaut et le profil initial seront restaurés.</div>
        {!confirmReset
          ?<button onClick={()=>setConfirmReset(true)} style={{background:"var(--red-bg)",border:"1px solid var(--red-border)",color:"var(--red)",borderRadius:"var(--r-md)",padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>Réinitialiser...</button>
          :<div style={{background:"rgba(239,68,68,0.1)",borderRadius:"var(--r-md)",padding:12}}>
            <div style={{fontSize:12,color:"var(--red)",fontWeight:700,marginBottom:8}}>Toutes les données seront supprimées. Cette action est irréversible.</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{localStorage.removeItem("tonex_guide_v2");localStorage.removeItem("tonex_guide_v1");location.reload();}} style={{background:"var(--danger)",border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-md)",padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Confirmer la réinitialisation</button>
              <button onClick={()=>setConfirmReset(false)} style={{background:"var(--a7)",border:"none",color:"var(--text-sec)",borderRadius:"var(--r-md)",padding:"8px 14px",fontSize:12,cursor:"pointer"}}>Annuler</button>
            </div>
          </div>
        }
      </div>
    </div>
  );
}

function ProfilesAdmin({profiles,onProfiles}){
  const [name,setName]=useState("");
  const [newPwd,setNewPwd]=useState("");
  const [editPwdId,setEditPwdId]=useState(null);
  const [editPwdVal,setEditPwdVal]=useState("");
  const [editNameId,setEditNameId]=useState(null);
  const [editNameVal,setEditNameVal]=useState("");
  const create=()=>{
    if(!name.trim())return;
    const id=name.trim().toLowerCase().replace(/[^a-z0-9]/g,"_")+`_${Date.now()}`;
    onProfiles(p=>({...p,[id]:makeDefaultProfile(id,name.trim(),false,newPwd)}));
    setName("");setNewPwd("");
  };
  const deleteProfile=id=>{
    if(Object.keys(profiles).length<=1)return;
    onProfiles(p=>{const n={...p};delete n[id];return n;});
  };
  const savePwd=(id)=>{
    onProfiles(p=>({...p,[id]:{...p[id],password:editPwdVal}}));
    // Password changed → invalidate any trusted-device flag for this profile so the new password gets prompted next time.
    setTrusted(id,false);
    setEditPwdId(null);setEditPwdVal("");
  };
  const [trustTick,setTrustTick]=useState(0);
  const forgetDevice=(id)=>{setTrusted(id,false);setTrustTick(t=>t+1);};
  const saveName=(id)=>{
    if(!editNameVal.trim())return;
    onProfiles(p=>({...p,[id]:{...p[id],name:editNameVal.trim()}}));
    setEditNameId(null);setEditNameVal("");
  };
  const inp={background:"var(--bg-card)",color:"var(--text)",border:"1px solid var(--a15)",borderRadius:"var(--r-md)",padding:"6px 10px",fontSize:12,boxSizing:"border-box"};
  return(
    <div>
      <div style={{fontSize:13,color:"var(--text-sec)",marginBottom:12}}>Gestion des utilisateurs.</div>
      {Object.values(profiles).map(p=>(
        <div key={p.id} style={{background:"var(--a4)",border:"1px solid var(--a8)",borderRadius:"var(--r-lg)",padding:"10px 14px",marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {editNameId===p.id?(
              <>
                <input value={editNameVal} onChange={e=>setEditNameVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveName(p.id)} style={{...inp,flex:1}} autoFocus/>
                <button onClick={()=>saveName(p.id)} style={{background:"var(--accent)",border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-md)",padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>OK</button>
                <button onClick={()=>setEditNameId(null)} style={{background:"none",border:"none",color:"var(--text-muted)",fontSize:12,cursor:"pointer"}}>✕</button>
              </>
            ):(
              <>
                <div style={{flex:1,fontSize:13,fontWeight:600,color:"var(--text)"}}>{p.name}{p.isAdmin&&<span style={{fontSize:9,color:"var(--text-dim)",marginLeft:6}}>admin</span>}</div>
                <button onClick={()=>{setEditNameId(p.id);setEditNameVal(p.name);}} style={{background:"none",border:"none",color:"var(--text-muted)",fontSize:12,cursor:"pointer",padding:"2px 4px"}}>✏️</button>
                <span style={{fontSize:10,color:"var(--text-muted)"}}>{p.password?(isTrusted(p.id)?"🔓":"🔒"):"🔓"}</span>
                <button onClick={()=>{setEditPwdId(editPwdId===p.id?null:p.id);setEditPwdVal(p.password||"");}} style={{background:"var(--a7)",border:"none",color:"var(--text-sec)",borderRadius:"var(--r-sm)",padding:"3px 7px",fontSize:10,cursor:"pointer"}}>Mot de passe</button>
                {p.password&&isTrusted(p.id)&&<button onClick={()=>forgetDevice(p.id)} title="Le mot de passe sera redemandé au prochain login sur cet appareil" style={{background:"var(--a5)",border:"none",color:"var(--text-muted)",borderRadius:"var(--r-sm)",padding:"3px 7px",fontSize:10,cursor:"pointer"}}>Oublier appareil</button>}
                {Object.keys(profiles).length>1&&!p.isAdmin&&<button onClick={()=>deleteProfile(p.id)} style={{background:"var(--red-bg)",border:"1px solid var(--red-border)",color:"var(--red)",borderRadius:"var(--r-md)",padding:"3px 8px",fontSize:11,cursor:"pointer"}}>Supprimer</button>}
              </>
            )}
          </div>
          {editPwdId===p.id&&editNameId!==p.id&&<div style={{display:"flex",gap:6,marginTop:8}}>
            <input type="text" placeholder="Nouveau mot de passe (vide = sans)" value={editPwdVal} onChange={e=>setEditPwdVal(e.target.value)} style={{...inp,flex:1}}/>
            <button onClick={()=>savePwd(p.id)} style={{background:"var(--accent)",border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-md)",padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>OK</button>
          </div>}
          {(p.loginHistory||[]).length>0&&<div style={{marginTop:8,borderTop:"1px solid var(--a8)",paddingTop:6}}>
            <div style={{fontSize:10,color:"var(--text-muted)",marginBottom:4}}>Dernières connexions</div>
            {(p.loginHistory||[]).slice(0,5).map((ts,i)=><div key={i} style={{fontSize:11,color:"var(--text-sec)",lineHeight:1.6}}>{new Date(ts).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>)}
          </div>}
        </div>
      ))}
      <div style={{background:"var(--accent-bg)",border:"1px solid var(--accent-soft)",borderRadius:"var(--r-lg)",padding:14,marginTop:10}}>
        <div style={{fontSize:12,color:"var(--accent)",fontWeight:600,marginBottom:8}}>+ Nouvel utilisateur</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <div style={{display:"flex",gap:8}}>
            <input placeholder="Nom" value={name} onChange={e=>setName(e.target.value)} style={{...inp,flex:1}}/>
            <input type="text" placeholder="Mot de passe" value={newPwd} onChange={e=>setNewPwd(e.target.value)} style={{...inp,flex:1}}/>
          </div>
          <button onClick={create} disabled={!name.trim()} style={{background:name.trim()?"var(--accent)":"var(--bg-disabled)",border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-md)",padding:"6px 14px",fontSize:12,fontWeight:700,cursor:name.trim()?"pointer":"not-allowed"}}>Créer</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Ajout Morceau + ListScreen ────────────────────────────────────────
// Phase 7.14 — extracted to src/app/components/AddSongModal.jsx
// + src/app/screens/ListScreen.jsx (InlineRenameInput co-localisé).
import AddSongModal from './app/components/AddSongModal.jsx';
import ListScreen from './app/screens/ListScreen.jsx';

// ─── Bank Optimizer Screen ───────────────────────────────────────────────────
function BankOptimizerScreen({songDb,setlists,banksAnn,onBanksAnn,banksPlug,onBanksPlug,allGuitars,availableSources,onNavigate,profile}) {
  // Phase 5.13.8 — perf instrumentation, même pattern que ListScreen.
  if(typeof window!=='undefined'&&window.__TONEX_PERF){
    if(!window.__optimizerRenderStart) window.__optimizerRenderStart=performance.now();
  }
  useEffect(()=>{
    if(typeof window!=='undefined'&&window.__TONEX_PERF&&window.__optimizerRenderStart){
      const dt=performance.now()-window.__optimizerRenderStart;
      console.log(`[perf] BankOptimizerScreen mount: ${dt.toFixed(1)}ms`);
      window.__optimizerRenderStart=null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  // Phase 2 fix : gate les sections device-spécifiques (analyse,
  // grille mini, plan de réorganisation, actions prioritaires).
  const enabledDevices=getActiveDevicesForRender(profile);
  const hasPedalDevice=enabledDevices.some(d=>d.deviceKey==='ann');
  const hasPlugDevice=enabledDevices.some(d=>d.deviceKey==='plug');
  const [slId,setSlId]=useState(setlists[0]?.id||"");
  const [showReconfig,setShowReconfig]=useState(null); // "ann"|"plug"|null
  const sl=setlists.find(s=>s.id===slId);
  // Phase 5.13.13 — mémoïse songs pour stabiliser sa référence. Sans
  // ça, `songs` est un nouveau tableau à chaque render → useEffect
  // analyzeDevice re-trigger → setAnnAnalysis → re-render → boucle
  // infinie (~51s de cascade observée).
  const songs=useMemo(()=>{
    if(!sl) return [];
    return sl.songIds.map(id=>songDb.find(s=>s.id===id)).filter(Boolean);
  },[sl,songDb]);
  // Types de micros du rig — ordre : SC, P90, HB
  const PICKUP_ORDER=["SC","HB","P90"];
  // Phase 5.13.14 — mémoïse pickupTypes pour stabiliser sa référence et
  // éviter une boucle infinie de re-renders via useEffect standardBanks.
  const pickupTypes=useMemo(()=>PICKUP_ORDER.filter(t=>allGuitars.some(g=>g.type===t)),[allGuitars]);
  const TYPE_LABELS={HB:"Humbucker",SC:"Single Coil",P90:"P-90"};

  // Pour chaque morceau, trouver la meilleure guitare du rig
  const bestGuitarForSong=(s)=>{
    // 1. Utiliser la guitare du cache (même que dans la setlist)
    const cachedGId=s.aiCache?.gId;
    if(cachedGId){const m=allGuitars.find(g=>g.id===cachedGId);if(m) return m;}
    const ai=s.aiCache?.result;
    if(!ai) return allGuitars[0];
    // 2. Guitare idéale recommandée par l'IA
    if(ai.ideal_guitar){
      const m=findGuitarByAIName(ai.ideal_guitar,allGuitars);
      if(m) return m;
    }
    // 3. Type de micro recommandé
    const pref=ai.pickup_preference;
    if(pref&&pref!=="any"){const m=allGuitars.find(g=>g.type===pref);if(m) return m;}
    // 4. Scorer toutes les guitares et prendre la meilleure
    const style=ai.song_style||"rock";
    const targetGain=typeof ai.target_gain==="number"?ai.target_gain:null;
    let bestG=allGuitars[0],bestScore=0;
    allGuitars.forEach(g=>{
      const sc=computePickupScore(style,getGainRange(targetGain||6),g.type);
      if(sc>bestScore){bestScore=sc;bestG=g;}
    });
    return bestG;
  };

  // Analyse pour un device — scorer chaque morceau avec sa meilleure guitare
  const analyzeDevice=(banks,deviceKey)=>{
    const usedPresets=new Map();
    const songRows=songs.map(s=>{
      const ai=s.aiCache?.result;
      if(!ai?.cot_step1) return {song:s,installed:null,installedScore:-1,ideal:null,idealScore:0,delta:0,noAI:true,guitar:null};
      const g=bestGuitarForSong(s);
      const gType=g?.type||"HB";const gId=g?.id||"";
      const style=ai.song_style||"rock";
      const targetGain=typeof ai.target_gain==="number"?ai.target_gain:null;
      // Score installé : cache setlist en priorité (source de vérité), sinon recalcul
      const cachedPreset=deviceKey==="ann"?ai.preset_ann:ai.preset_plug;
      let top=null;
      if(cachedPreset?.label&&cachedPreset.score>0){
        top={name:cachedPreset.label,score:cachedPreset.score,bank:cachedPreset.bank,col:cachedPreset.col,amp:"",style:"",breakdown:cachedPreset.breakdown};
      }
      if(!top){
        const bestInstalled=computeBestPresets(gType,style,deviceKey==="ann"?banks:{},deviceKey==="plug"?banks:{},gId,ai.ref_amp,targetGain,availableSources);
        top=deviceKey==="ann"?bestInstalled.annTop:bestInstalled.plugTop;
      }
      // IdealTop : scan complet du catalogue (pas de limite d'amplis)
      const resolvedAmp=resolveRefAmp(ai.ref_amp);
      const allCandidates=[];
      for(const [pName,pInfo] of Object.entries(PRESET_CATALOG_MERGED)){
        if(!pInfo||!pInfo.amp) continue;
        if(pInfo.src&&!isSrcCompatible(pInfo.src,deviceKey)) continue;
        // Phase 5.6 — respecte les sources désactivées par l'utilisateur.
        // Sans ce filtre, l'Optimiseur suggérait des presets Factory
        // alors que profile.availableSources.Factory === false
        // (l'utilisateur ne possède pas le pack). Bug rapporté sur
        // "VOWELS" → "🏭 ToneX Factory" en Banque 6B.
        if(pInfo.src&&availableSources&&availableSources[pInfo.src]===false) continue;
        const sc=computeFinalScore(pInfo,gId,style,targetGain,resolvedAmp,false);
        if(sc>=(top?.score||0)) allCandidates.push({name:pName,score:sc,amp:pInfo.amp,style:pInfo.style,src:pInfo.src});
      }
      allCandidates.sort((a,b)=>b.score-a.score);
      const idealCompat=[];
      const seenAmps=new Set();
      for(const c of allCandidates){
        if(!seenAmps.has(c.amp)){idealCompat.push(c);seenAmps.add(c.amp);}
        if(idealCompat.length>=10) break;
      }
      const idealTop=idealCompat[0]||null;
      if(top){
        if(!usedPresets.has(top.name)) usedPresets.set(top.name,{songs:[],bestScore:0});
        const u=usedPresets.get(top.name);u.songs.push(s.title);if(top.score>u.bestScore) u.bestScore=top.score;
      }
      return {song:s,installed:top,installedScore:top?.score||0,ideal:idealTop,idealTop3:idealCompat,idealScore:idealTop?.score||0,delta:(idealTop?.score||0)-(top?.score||0),guitar:g};
    });
    const allInstalled=[];
    for(const [k,v] of Object.entries(banks)){for(const slot of ["A","B","C"]){if(v[slot]) allInstalled.push({name:v[slot],bank:Number(k),slot});}}
    const unusedPresets=allInstalled.filter(p=>!usedPresets.has(p.name));
    const analyzed=songRows.filter(r=>!r.noAI);
    // Seuils alignés avec le perçu utilisateur : <70% = Faible, 70-80% = Moyen, ≥80% = Couvert
    const covered=analyzed.filter(r=>r.installedScore>=80).length;
    const acceptable=analyzed.filter(r=>r.installedScore>=70&&r.installedScore<80).length;
    const poor=analyzed.filter(r=>r.installedScore<70).length;
    const noAICount=songRows.filter(r=>r.noAI).length;
    return {songRows,usedPresets,unusedPresets,covered,acceptable,poor,noAICount};
  };

  // Phase 5.13.9 — defer analyzeDevice (5s synchrone) après mount.
  // Avant : useMemo synchrone bloquait le mount. Maintenant : on mount avec
  // analyses vides, puis on calcule via setTimeout(0) qui laisse le browser
  // paint d'abord. Les sections qui consomment annAnalysis/plugAnalysis
  // doivent gérer le state initial null (placeholder loading).
  const EMPTY_ANALYSIS={songRows:[],usedPresets:new Map(),unusedPresets:[],covered:0,acceptable:0,poor:0,noAICount:0,loading:true};
  const [annAnalysis,setAnnAnalysis]=useState(EMPTY_ANALYSIS);
  const [plugAnalysis,setPlugAnalysis]=useState(EMPTY_ANALYSIS);
  useEffect(()=>{
    let cancelled=false;
    const t=setTimeout(()=>{
      if(cancelled) return;
      const t0=performance.now();
      const ann=analyzeDevice(banksAnn,"ann");
      if(typeof window!=='undefined'&&window.__TONEX_PERF) console.log(`[perf] analyzeDevice(ann): ${(performance.now()-t0).toFixed(0)}ms`);
      if(!cancelled) setAnnAnalysis(ann);
      const t1=performance.now();
      const plug=analyzeDevice(banksPlug,"plug");
      if(typeof window!=='undefined'&&window.__TONEX_PERF) console.log(`[perf] analyzeDevice(plug): ${(performance.now()-t1).toFixed(0)}ms`);
      if(!cancelled) setPlugAnalysis(plug);
    },0);
    return ()=>{cancelled=true;clearTimeout(t);};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[songs,allGuitars,banksAnn,banksPlug,availableSources]);

  // Auto-pick d'une banque/slot pour installer un preset.
  // 1ère passe : un slot vide du bon gain. 2e passe : remplace le slot le plus faible
  // de la même famille de gain (banks plein → on fait une vraie optimisation, pas un blocage).
  const autoPlace=(banks,presetName,deviceKey,songRows)=>{
    const entry=findCatalogEntry(presetName);
    if(!entry) return null;
    const gain=typeof entry.gain==="number"?entry.gain:gainToNumeric(entry.gain);
    const gainRange=getGainRange(gain);
    const slot=gainRange==="clean"?"A":gainRange==="high_gain"?"C":"B";
    const startBank=deviceKey==="ann"?0:1;
    const maxBank=deviceKey==="ann"?49:9;
    // 1ère passe : slot vide
    for(let i=startBank;i<=maxBank;i++){
      const b=banks[i];
      if(!b||!b[slot]) return {bank:i,slot,replaces:null};
    }
    // 2e passe : remplace le preset le plus faible de ce slot (toutes banques)
    let worstBank=null,worstScore=101,worstPreset=null;
    for(let i=startBank;i<=maxBank;i++){
      const cur=banks[i]?.[slot];if(!cur) continue;
      const sc=computeSimpleScore(cur,null,pickupTypes[0]||"HB");
      if(sc<worstScore){worstScore=sc;worstBank=i;worstPreset=cur;}
    }
    if(worstBank!=null) return {bank:worstBank,slot,replaces:worstPreset,replacesScore:worstScore};
    return null;
  };

  // Actions prioritaires PAR DEVICE — chaque pédale/plug a ses propres top 3.
  // Pour chaque morceau, on parcourt tout le top 3 catalogue (pas juste le 1er).
  // Groupé par preset, classé par bénéfice total. Seuil bas (1%) pour ne plus rater
  // les micro-gains qui s'accumulent quand un même preset profite à plusieurs morceaux.
  const PRIO_DELTA_MIN=1;
  const computePriority=(rows,deviceKey,banks)=>{
    const grouped={};
    for(const r of rows){
      if(r.noAI) continue;
      const candidates=r.idealTop3?.length?r.idealTop3:(r.ideal?[r.ideal]:[]);
      for(const cand of candidates){
        if(!cand?.name) continue;
        if(findInBanks(cand.name,banks)) continue;
        const candScore=cand.score||0;
        const delta=candScore-r.installedScore;
        if(delta<PRIO_DELTA_MIN) continue;
        const k=cand.name;
        if(!grouped[k]){
          const place=autoPlace(banks,cand.name,deviceKey,rows);
          if(!place) continue;
          grouped[k]={device:deviceKey,preset:cand,songs:[],totalDelta:0,place,coveredIds:new Set()};
        }
        if(grouped[k].coveredIds.has(r.song.id)) continue;
        grouped[k].coveredIds.add(r.song.id);
        grouped[k].songs.push({song:r.song,currentScore:r.installedScore,newScore:candScore,delta});
        grouped[k].totalDelta+=delta;
      }
    }
    return Object.values(grouped).sort((a,b)=>b.totalDelta-a.totalDelta).slice(0,5);
  };
  const annPriority=useMemo(()=>computePriority(annAnalysis.songRows,"ann",banksAnn),[annAnalysis,banksAnn]);
  const plugPriority=useMemo(()=>computePriority(plugAnalysis.songRows,"plug",banksPlug),[plugAnalysis,banksPlug]);
  // Score moyen actuel + projection si toutes les actions sont appliquées
  const computeMean=(rows)=>{
    const ar=rows.filter(r=>!r.noAI);
    if(!ar.length) return null;
    return Math.round(ar.reduce((s,r)=>s+r.installedScore,0)/ar.length);
  };
  const annMean=computeMean(annAnalysis.songRows);
  const plugMean=computeMean(plugAnalysis.songRows);
  const computeProjected=(rows,priorityList)=>{
    const ar=rows.filter(r=>!r.noAI);
    if(!ar.length) return null;
    const upgrades={};
    priorityList.forEach(a=>{
      a.songs.forEach(s=>{if((upgrades[s.song.id]||0)<s.newScore) upgrades[s.song.id]=s.newScore;});
    });
    return Math.round(ar.reduce((sum,r)=>sum+(upgrades[r.song.id]!=null?Math.max(upgrades[r.song.id],r.installedScore):r.installedScore),0)/ar.length);
  };
  const annProjected=computeProjected(annAnalysis.songRows,annPriority);
  const plugProjected=computeProjected(plugAnalysis.songRows,plugPriority);

  const applyAction=(action)=>{
    if(!action.place) return;
    const onBanks=action.device==="ann"?onBanksAnn:onBanksPlug;
    onBanks(prev=>({...prev,[action.place.bank]:{...(prev[action.place.bank]||{cat:"",A:"",B:"",C:""}),[action.place.slot]:action.preset.name}}));
  };
  const applyAllForDevice=(list,deviceLabel,curMean,projMean)=>{
    if(!list.length) return;
    if(!window.confirm(`Appliquer les ${list.length} actions ${deviceLabel} ?\nGain estimé : ${curMean}% → ${projMean}% (+${projMean-curMean}%)`)) return;
    list.forEach(applyAction);
  };

  // Banques standard "univers" — un ampli iconique par banque, 3 slots Clean/Drive/Lead
  // Phase 5.13.10 — defer ce calcul après mount (10 universes × 3 slots × ~500 catalog filter
  // = 15k ops synchrones). useState + useEffect setTimeout.
  const [standardBanks,setStandardBanks]=useState([]);
  useEffect(()=>{
    let cancelled=false;
    const t=setTimeout(()=>{
      if(cancelled) return;
      const t0=performance.now();
      const result=computeStandardBanks();
      if(typeof window!=='undefined'&&window.__TONEX_PERF) console.log(`[perf] standardBanks: ${(performance.now()-t0).toFixed(0)}ms`);
      if(!cancelled) setStandardBanks(result);
    },10);
    return ()=>{cancelled=true;clearTimeout(t);};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[pickupTypes,availableSources]);
  const computeStandardBanks=()=>{
    const UNIVERSES=[
      {label:"Marshall Plexi",          amp:"Marshall Plexi",        style:"rock"},
      {label:"Marshall JCM800",         amp:"Marshall JCM800",       style:"hard_rock"},
      {label:"Fender Deluxe Reverb",    amp:"Fender Deluxe Reverb",  style:"blues"},
      {label:"Fender Twin Reverb",      amp:"Fender Twin Reverb",    style:"rock"},
      {label:"Fender Bassman",          amp:"Fender Bassman",        style:"blues"},
      {label:"Vox AC30",                amp:"Vox AC30",              style:"rock"},
      {label:"Mesa Dual Rectifier",     amp:"Mesa Boogie Rectifier", style:"hard_rock"},
      {label:"Hiwatt DR103",            amp:"Hiwatt DR103",          style:"rock"},
      {label:"Dumble ODS",              amp:"Dumble ODS",            style:"blues"},
      {label:"Soldano SLO 100",         amp:"Soldano SLO-100",       style:"hard_rock"},
    ];
    const SLOT_GAINS=[{slot:"A",label:"Clean",gainRange:"clean"},{slot:"B",label:"Drive",gainRange:"drive"},{slot:"C",label:"Lead",gainRange:"high_gain"}];
    const dominantPickup=pickupTypes[0]||"HB";
    return UNIVERSES.map(u=>{
      const usedNames=new Set();
      const slots=SLOT_GAINS.map(({slot,label,gainRange})=>{
        const candidates=Object.entries(PRESET_CATALOG_MERGED)
          .filter(([,info])=>{
            const g=getGainRange(gainToNumeric(info.gain));
            if(g!==gainRange&&!(gainRange==="drive"&&g==="crunch")) return false;
            if(info.src==="Anniversary"||info.src==="Factory"||info.src==="PlugFactory") return false;
            if(availableSources&&info.src&&availableSources[info.src]===false) return false;
            return true;
          })
          .map(([name,info])=>{
            const ampScore=computeRefAmpScore(info.amp,u.amp);
            const styleScore=computeStyleMatchScore(info.style,u.style);
            const pickupScore=computePickupScore(info.style,gainRange,dominantPickup);
            const dims=[{s:ampScore,w:0.60},{s:styleScore,w:0.25},{s:pickupScore,w:0.15}].filter(d=>d.s!==null);
            const tw=dims.reduce((s,d)=>s+d.w,0);
            const score=Math.round(dims.reduce((s,d)=>s+d.s*(d.w/tw),0));
            return {name,amp:info.amp,src:info.src,score};
          }).sort((a,b)=>b.score-a.score);
        const pick=candidates.find(c=>!usedNames.has(c.name))||candidates[0];
        if(pick) usedNames.add(pick.name);
        return {slot,label,preset:pick?.name||"—",amp:pick?.amp||"",src:pick?.src||"",score:pick?.score||0};
      });
      return {label:u.label,amp:u.amp,style:u.style,slots};
    });
  };

  // Reconfig A/B/C pour un device
  const reconfigPlan=useMemo(()=>{
    if(!showReconfig) return null;
    const banks=showReconfig==="ann"?banksAnn:banksPlug;
    const maxBanks=showReconfig==="ann"?50:10;
    const startBank=showReconfig==="ann"?0:1;
    const usedBanks=new Set();
    const analysis=showReconfig==="ann"?annAnalysis:plugAnalysis;
    analysis.songRows.forEach(r=>{if(r.installed?.bank!=null) usedBanks.add(r.installed.bank);});
    if(!usedBanks.size){for(let i=startBank;i<startBank+3&&i<startBank+maxBanks;i++) usedBanks.add(i);}
    const SLOT_GAINS=[{slot:"A",label:"Clean",targetGain:2},{slot:"B",label:"Drive",targetGain:7},{slot:"C",label:"Lead",targetGain:9}];
    const plan=[...usedBanks].sort((a,b)=>a-b).slice(0,10).map(bankNum=>{
      const current=banks[bankNum]||{cat:"",A:"",B:"",C:""};
      const bankSongs=analysis.songRows.filter(r=>r.installed?.bank===bankNum);
      const styles={};bankSongs.forEach(r=>{const st=r.song.aiCache?.result?.song_style||"rock";styles[st]=(styles[st]||0)+1;});
      const dominantStyle=Object.entries(styles).sort((a,b)=>b[1]-a[1])[0]?.[0]||"rock";
      const dominantAmp=bankSongs.map(r=>r.song.aiCache?.result?.ref_amp).filter(Boolean)[0]||null;
      // Utiliser le type de micro le plus fréquent des morceaux de cette banque
      const typeCounts={};bankSongs.forEach(r=>{if(r.guitar) typeCounts[r.guitar.type]=(typeCounts[r.guitar.type]||0)+1;});
      const bankGType=Object.entries(typeCounts).sort((a,b)=>b[1]-a[1])[0]?.[0]||"HB";
      const bankGId=allGuitars.find(g=>g.type===bankGType)?.id||"";
      const slots=SLOT_GAINS.map(({slot,label,targetGain})=>{
        const currentPreset=current[slot];
        const best=computeBestPresets(bankGType,dominantStyle,{},{},bankGId,dominantAmp,targetGain);
        // Filtrer par compatibilité source/device
        const idealRaw=best.idealTop3||[];
        const idealPreset=idealRaw.find(p=>{const e=findCatalogEntry(p.name);return !e||isSrcCompatible(e.src,showReconfig);})||best.idealTop;
        return {slot,label,current:currentPreset||"(vide)",proposed:idealPreset?.name||currentPreset||"—",proposedAmp:idealPreset?.amp||"",proposedScore:idealPreset?.score||0,changed:idealPreset&&idealPreset.name!==currentPreset};
      });
      return {bank:bankNum,cat:current.cat,dominantStyle,bankGType,slots};
    });
    return plan;
  },[showReconfig,banksAnn,banksPlug,annAnalysis,plugAnalysis,allGuitars,songs]);

  const applyReconfig=()=>{
    if(!reconfigPlan||!showReconfig) return;
    const onBanks=showReconfig==="ann"?onBanksAnn:onBanksPlug;
    onBanks(prev=>{
      const next={...prev};
      reconfigPlan.forEach(({bank,slots})=>{
        const current=next[bank]||{cat:"",A:"",B:"",C:""};
        const updated={...current};
        slots.forEach(({slot,proposed,changed})=>{if(changed) updated[slot]=proposed;});
        next[bank]=updated;
      });
      return next;
    });
    setShowReconfig(null);
  };

  // Phase 5.13.12 — content-visibility:auto sur les sections de l'Optimiseur.
  // Permet au navigateur de skip le rendering des sections offscreen, ce qui
  // réduit le coût du re-render après setAnnAnalysis/setPlugAnalysis. La hint
  // containIntrinsicSize donne au scroll bar une estimation pendant le skip.
  const sectionStyle={background:"var(--bg-elev-1)",border:"1px solid var(--border-subtle)",borderRadius:"var(--r-lg)",padding:"var(--s-4)",marginBottom:"var(--s-4)",contentVisibility:"auto",containIntrinsicSize:"0 600px"};
  const eyebrow=(icon,label)=><div style={{fontFamily:"var(--font-mono)",fontSize:"var(--fs-xs)",textTransform:"uppercase",letterSpacing:"var(--tracking-wider)",color:"var(--accent)",marginBottom:"var(--s-3)",display:"flex",alignItems:"center",gap:5}}>{icon} {label}</div>;

  const renderStats=(a)=><div style={{display:"flex",gap:"var(--s-2)",marginBottom:"var(--s-3)"}}>
    {[{n:a.covered,c:"var(--success)",bg:"var(--green-bg)",bd:"var(--green-border)",l:"Couverts"},{n:a.acceptable,c:"var(--yellow)",bg:"var(--yellow-bg)",bd:"var(--yellow-border)",l:"Moyens"},{n:a.poor,c:"var(--danger)",bg:"var(--red-bg)",bd:"var(--red-border)",l:"Faibles"}].map(({n,c,bg,bd,l})=>
      <div key={l} style={{flex:1,background:bg,border:"1px solid "+bd,borderRadius:"var(--r-md)",padding:"var(--s-2)",textAlign:"center"}}>
        <div style={{fontFamily:"var(--font-mono)",fontSize:"var(--fs-lg)",fontWeight:800,color:c}}>{n}</div>
        <div style={{fontSize:9,color:"var(--text-secondary)"}}>{l}</div>
      </div>
    )}
  </div>;

  // Song rows avec suggestion inline
  const [songInstall,setSongInstall]=useState(null); // {songId,presetName,deviceKey,bank:0,slot:"A"}
  const renderSongRows=(rows,banks,onBanks,deviceKey)=>{
    const maxBank=deviceKey==="ann"?49:9;
    const startBank=deviceKey==="ann"?0:1;
    return <div style={{display:"flex",flexDirection:"column",gap:4}}>
    {rows.map(({song,installed,installedScore,ideal,idealScore,delta,noAI,guitar})=>{
      if(noAI) return <div key={song.id} style={{display:"flex",alignItems:"center",gap:"var(--s-2)",padding:"4px var(--s-2)",background:"var(--bg-elev-2)",borderRadius:"var(--r-sm)",border:"1px solid var(--border-subtle)",opacity:0.5}}>
        <span style={{fontSize:12}}>⏳</span>
        <div style={{flex:1,fontSize:11,color:"var(--text-tertiary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{song.title}</div>
        <span style={{fontSize:9,color:"var(--text-tertiary)"}}>Non analysé</span>
      </div>;
      const needsSuggestion=delta>5&&ideal&&!findInBanks(ideal.name,banks);
      const isInstalling=songInstall?.songId===song.id&&songInstall?.deviceKey===deviceKey;
      return <div key={song.id}>
        <div style={{display:"flex",alignItems:"center",gap:"var(--s-2)",padding:"4px var(--s-2)",background:"var(--bg-elev-2)",borderRadius:needsSuggestion||isInstalling?"var(--r-sm) var(--r-sm) 0 0":"var(--r-sm)",border:"1px solid var(--border-subtle)"}}>
          <span style={{fontSize:12}}>{installedScore>=80?"✅":installedScore>=70?"⚠️":"❌"}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,fontWeight:600,color:"var(--text-primary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{song.title}</div>
            <div style={{fontSize:9,color:"var(--text-tertiary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{installed?installed.name:"—"}{guitar?" · "+guitar.short:""}</div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontFamily:"var(--font-mono)",fontSize:11,fontWeight:800,color:scoreColor(installedScore)}}>{installedScore}%</div>
          </div>
        </div>
        {needsSuggestion&&!isInstalling&&<div style={{display:"flex",alignItems:"center",gap:"var(--s-2)",padding:"3px var(--s-2) 3px var(--s-6)",background:"var(--accent-soft)",borderRadius:"0 0 var(--r-sm) var(--r-sm)",border:"1px solid var(--border-accent)",borderTop:"none",fontSize:10}}>
          <span style={{color:"var(--accent)"}}>💡</span>
          <span style={{flex:1,color:"var(--text-secondary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ideal.name} <span style={{color:"var(--text-tertiary)"}}>({ideal.amp})</span></span>
          <span style={{fontFamily:"var(--font-mono)",fontWeight:700,color:"var(--success)",flexShrink:0}}>{idealScore}%</span>
          <button onClick={()=>setSongInstall({songId:song.id,presetName:ideal.name,deviceKey,bank:startBank,slot:"B"})} style={{background:"linear-gradient(180deg,var(--brass-200),var(--brass-400))",border:"none",color:"var(--tolex-900)",borderRadius:"var(--r-sm)",padding:"2px 6px",fontSize:8,fontWeight:700,cursor:"pointer",flexShrink:0}}>Installer</button>
        </div>}
        {isInstalling&&<div style={{display:"flex",alignItems:"center",gap:"var(--s-2)",padding:"4px var(--s-2)",background:"var(--accent-soft)",borderRadius:"0 0 var(--r-sm) var(--r-sm)",border:"1px solid var(--border-accent)",borderTop:"none",fontSize:10,flexWrap:"wrap"}}>
          <span style={{fontSize:9,color:"var(--text-secondary)",flexShrink:0}}>{songInstall.presetName}</span>
          <select value={songInstall.bank} onChange={e=>setSongInstall(p=>({...p,bank:Number(e.target.value)}))} style={{background:"var(--bg-elev-1)",color:"var(--text-primary)",border:"1px solid var(--border-strong)",borderRadius:"var(--r-xs)",padding:"2px 4px",fontSize:10}}>
            {Array.from({length:maxBank-startBank+1},(_,i)=>i+startBank).map(b=><option key={b} value={b}>B{b}</option>)}
          </select>
          <select value={songInstall.slot} onChange={e=>setSongInstall(p=>({...p,slot:e.target.value}))} style={{background:"var(--bg-elev-1)",color:"var(--text-primary)",border:"1px solid var(--border-strong)",borderRadius:"var(--r-xs)",padding:"2px 4px",fontSize:10}}>
            <option value="A">A</option><option value="B">B</option><option value="C">C</option>
          </select>
          <button onClick={()=>{onBanks(p=>({...p,[songInstall.bank]:{...(p[songInstall.bank]||{cat:"",A:"",B:"",C:""}),[songInstall.slot]:songInstall.presetName}}));setSongInstall(null);}} style={{background:"linear-gradient(180deg,var(--brass-200),var(--brass-400))",border:"none",color:"var(--tolex-900)",borderRadius:"var(--r-sm)",padding:"2px 8px",fontSize:9,fontWeight:700,cursor:"pointer"}}>OK</button>
          <button onClick={()=>setSongInstall(null)} style={{background:"none",border:"none",color:"var(--text-tertiary)",fontSize:9,cursor:"pointer"}}>✕</button>
        </div>}
      </div>;
    })}
  </div>;
  };

  const renderUnused=(unused)=>unused.length>0&&<div style={{marginTop:"var(--s-3)"}}>
    <div style={{fontSize:10,fontWeight:700,color:"var(--text-tertiary)",fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"var(--tracking-wider)",marginBottom:4}}>🗑 Non utilisés ({unused.length})</div>
    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
      {unused.slice(0,10).map((p,i)=><span key={i} style={{fontSize:9,background:"var(--bg-elev-2)",border:"1px solid var(--border-subtle)",borderRadius:"var(--r-sm)",padding:"2px 6px",color:"var(--text-tertiary)"}}><span style={{fontFamily:"var(--font-mono)",color:"var(--accent)",marginRight:3}}>B{p.bank}{p.slot}</span>{p.name}</span>)}
      {unused.length>10&&<span style={{fontSize:9,color:"var(--text-tertiary)"}}>+{unused.length-10}</span>}
    </div>
  </div>;

  const renderReconfigInline=(plan)=><div>
    <div style={{overflowX:"auto",marginBottom:"var(--s-2)"}}>
      {plan.map(({bank,slots})=>(
        <div key={bank} style={{background:"var(--bg-elev-2)",border:"1px solid var(--border-subtle)",borderRadius:"var(--r-sm)",padding:"var(--s-2)",marginBottom:4}}>
          <div style={{fontFamily:"var(--font-mono)",fontSize:10,fontWeight:700,color:"var(--text-primary)",marginBottom:4}}>Banque {bank}</div>
          <div style={{display:"flex",gap:4}}>
            {slots.map(s=>(
              <div key={s.slot} style={{flex:1,textAlign:"center",background:s.changed?"var(--accent-soft)":"transparent",borderRadius:"var(--r-xs)",padding:"3px 2px"}}>
                <div style={{fontFamily:"var(--font-mono)",fontSize:8,color:"var(--text-tertiary)",textTransform:"uppercase"}}>{s.slot}·{s.label}</div>
                <div style={{fontSize:9,fontWeight:s.changed?700:400,color:s.changed?"var(--accent)":"var(--text-secondary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.proposed}</div>
                {s.changed&&<div style={{fontSize:7,color:"var(--text-tertiary)"}}>← {s.current}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
    <div style={{display:"flex",gap:"var(--s-2)"}}>
      <button onClick={applyReconfig} style={{flex:1,background:"linear-gradient(180deg,var(--brass-200),var(--brass-400))",border:"none",color:"var(--tolex-900)",borderRadius:"var(--r-sm)",padding:"6px",fontSize:10,fontWeight:700,cursor:"pointer",boxShadow:"var(--shadow-sm)"}}>Appliquer</button>
      <button onClick={()=>setShowReconfig(null)} style={{background:"var(--bg-elev-2)",border:"1px solid var(--border-subtle)",color:"var(--text-tertiary)",borderRadius:"var(--r-sm)",padding:"6px 10px",fontSize:10,cursor:"pointer"}}>Annuler</button>
    </div>
  </div>;

  if(typeof window!=='undefined'&&window.__TONEX_PERF&&window.__optimizerRenderStart){
    console.log(`[perf] BankOptimizerScreen before-return: ${(performance.now()-window.__optimizerRenderStart).toFixed(0)}ms`);
  }
  return(
    <div>
      <Breadcrumb crumbs={[{label:"Accueil",screen:"list"},{label:"Optimiseur"}]} onNavigate={onNavigate}/>
      <div style={{fontFamily:"var(--font-display)",fontSize:"var(--fs-lg)",fontWeight:800,color:"var(--text-primary)",marginBottom:"var(--s-4)"}}>🔧 Optimiseur de Banks</div>

      {/* Sélecteur de setlist commun aux sections */}
      <div style={{marginBottom:"var(--s-3)"}}>
        <select value={slId} onChange={e=>setSlId(e.target.value)} style={{width:"100%",background:"var(--bg-elev-1)",color:"var(--text-primary)",border:"1px solid var(--border-strong)",borderRadius:"var(--r-md)",padding:"8px 12px",fontSize:13}}>
          {setlists.map(s=><option key={s.id} value={s.id}>{s.name} ({s.songIds.length})</option>)}
        </select>
      </div>

      {/* ── TOP 3 ACTIONS PRIORITAIRES PAR DEVICE ── */}
      {songs.length>0&&(()=>{
        const renderDeviceBlock=(deviceKey,deviceLabel,curMean,projMean,actions,rows)=>{
          if(curMean==null) return null;
          const delta=projMean!=null?projMean-curMean:0;
          // Morceaux sous 80% sans action générée — ils sont "bloqués au plafond catalogue"
          const stuck=rows.filter(r=>!r.noAI&&r.installedScore<80&&!actions.some(a=>a.songs.some(s=>s.song.id===r.song.id)));
          return <div style={{background:"var(--bg-elev-2)",border:"1px solid var(--border-subtle)",borderRadius:"var(--r-md)",padding:"var(--s-3)"}}>
            <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:"var(--s-2)"}}>
              <span style={{fontSize:13,fontWeight:700,color:"var(--text-primary)"}}>{deviceLabel}</span>
              <span style={{fontSize:11,color:"var(--text-tertiary)",marginLeft:"auto"}}>Score</span>
              <span style={{fontFamily:"var(--font-mono)",fontSize:18,fontWeight:800,color:scoreColor(curMean)}}>{curMean}%</span>
              {actions.length>0&&projMean!=null&&<>
                <span style={{fontSize:11,color:"var(--text-tertiary)"}}>→</span>
                <span style={{fontFamily:"var(--font-mono)",fontSize:18,fontWeight:800,color:scoreColor(projMean)}}>{projMean}%</span>
                <span style={{fontSize:11,color:"var(--success)",fontWeight:700}}>+{delta}</span>
              </>}
            </div>
            {actions.length===0
              ?<div>
                {stuck.length===0
                  ?<div style={{fontSize:11,color:"var(--success)",padding:"6px 0"}}>✓ Rien à optimiser sur ce device</div>
                  :<div>
                    <div style={{fontSize:11,color:"var(--text-secondary)",marginBottom:5}}>Pas de meilleur preset disponible pour {stuck.length} morceau{stuck.length>1?"x":""} (déjà au plafond du catalogue compatible) :</div>
                    <div style={{display:"flex",flexDirection:"column",gap:3}}>
                      {stuck.map(r=>(
                        <div key={r.song.id} style={{fontSize:10,color:"var(--text-tertiary)",display:"flex",gap:6,alignItems:"baseline"}}>
                          <span style={{fontFamily:"var(--font-mono)",fontWeight:700,color:scoreColor(r.installedScore),minWidth:32}}>{r.installedScore}%</span>
                          <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.song.title}</span>
                          {r.installed?.name&&<span style={{color:"var(--text-tertiary)",fontStyle:"italic"}}>· {r.installed.name}</span>}
                        </div>
                      ))}
                    </div>
                    <div style={{fontSize:9,color:"var(--text-tertiary)",marginTop:6,fontStyle:"italic"}}>Pour faire mieux : changer la guitare assignée, activer un pack non coché dans Profil → Sources, ou créer un preset custom.</div>
                  </div>
                }
              </div>
              :<>
                <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:8}}>
                  {actions.map((a,i)=>{
                    const songsList=a.songs.map(s=>s.song.title);
                    const songsPreview=songsList.slice(0,3).join(", ")+(songsList.length>3?` +${songsList.length-3}`:"");
                    return <div key={i} style={{background:"var(--bg-elev-1)",border:"1px solid var(--border-subtle)",borderRadius:"var(--r-sm)",padding:"7px 9px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3,flexWrap:"wrap"}}>
                        <span style={{fontSize:12,fontWeight:800,color:"var(--accent)",minWidth:18}}>#{i+1}</span>
                        <span style={{fontSize:10,background:"var(--green-bg)",color:"var(--success)",borderRadius:"var(--r-sm)",padding:"1px 6px",fontWeight:700,border:"1px solid var(--green-border)"}}>+{a.totalDelta}%</span>
                        <span style={{fontSize:9,color:"var(--text-tertiary)",marginLeft:"auto"}}>{a.songs.length} morceau{a.songs.length>1?"x":""}</span>
                      </div>
                      <div style={{fontSize:11,fontWeight:700,color:"var(--text-primary)",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis"}}>Installer "{a.preset.name}"</div>
                      {(()=>{const e=findCatalogEntry(a.preset.name);const si=presetSourceInfo(e);if(!si)return null;return <div style={{fontSize:9,color:"var(--text-sec)",marginBottom:3,display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}><span>{si.icon} {si.label}</span>{e?.pack&&TSR_PACK_ZIPS?.[e.pack]&&<span style={{color:"var(--text-dim)"}}>📁 {TSR_PACK_ZIPS[e.pack]}.zip</span>}</div>;})()}
                      <div style={{fontSize:10,color:"var(--text-tertiary)",marginBottom:5}}>
                        → Banque <span style={{fontFamily:"var(--font-mono)",color:CC[a.place.slot],fontWeight:700}}>{a.place.bank}{a.place.slot}</span>
                        {a.place.replaces&&<span style={{color:"var(--yellow)",marginLeft:4}}>· remplace "{a.place.replaces}" ({a.place.replacesScore}%)</span>}
                        <span style={{display:"block",marginTop:2}}>{songsPreview}</span>
                      </div>
                      <button onClick={()=>applyAction(a)} style={{background:"var(--accent)",border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-sm)",padding:"4px 10px",fontSize:10,fontWeight:700,cursor:"pointer"}}>Installer</button>
                    </div>;
                  })}
                </div>
                {actions.length>1&&<button onClick={()=>applyAllForDevice(actions,deviceLabel,curMean,projMean)} style={{width:"100%",background:"linear-gradient(180deg,var(--brass-200),var(--brass-400))",border:"none",color:"var(--tolex-900)",borderRadius:"var(--r-sm)",padding:"7px",fontSize:11,fontWeight:700,cursor:"pointer",boxShadow:"var(--shadow-sm)"}}>⚡ Tout appliquer {deviceLabel} ({actions.length})</button>}
              </>}
          </div>;
        };
        return <div style={sectionStyle}>
          {eyebrow("⚡","Actions prioritaires")}
          <div style={{display:"flex",flexDirection:"column",gap:"var(--s-2)"}}>
            {hasPedalDevice&&renderDeviceBlock("ann","📦 Pédale",annMean,annProjected,annPriority,annAnalysis.songRows)}
            {hasPlugDevice&&renderDeviceBlock("plug","🔌 Plug",plugMean,plugProjected,plugPriority,plugAnalysis.songRows)}
          </div>
        </div>;
      })()}

      {/* ── SECTION 1 : DIAGNOSTIC ── */}
      <div style={sectionStyle}>
        {eyebrow("📊","Diagnostic")}
        {songs.length===0?<div style={{textAlign:"center",padding:"20px",color:"var(--text-tertiary)"}}>Setlist vide</div>:<>
        <div style={{fontSize:10,color:"var(--text-tertiary)",marginBottom:"var(--s-3)"}}>🎸 {allGuitars.map(g=>g.short||g.name).join(", ")} · {songs.length} morceau{songs.length>1?"x":""}</div>
        <div style={{display:"grid",gridTemplateColumns: hasPedalDevice&&hasPlugDevice?"1fr 1fr":"1fr",gap:"var(--s-3)",marginBottom:"var(--s-3)"}}>
          {hasPedalDevice&&<div>{renderStats(annAnalysis)}<div style={{fontSize:9,color:"var(--text-tertiary)",textAlign:"center"}}>📦 Pedale</div></div>}
          {hasPlugDevice&&<div>{renderStats(plugAnalysis)}<div style={{fontSize:9,color:"var(--text-tertiary)",textAlign:"center"}}>🔌 Plug</div></div>}
        </div>
        {/* Carte visuelle compacte */}
        {(()=>{
          var buildBankMap=function(banks,deviceKey){
            var usedBanks={};
            songs.forEach(function(s){
              var ai=s.aiCache?.result;if(!ai?.cot_step1) return;
              var preset=deviceKey==="ann"?ai.preset_ann:ai.preset_plug;
              if(preset?.label){var loc=findInBanks(preset.label,banks);if(loc){
                if(!usedBanks[loc.bank]) usedBanks[loc.bank]={songs:[],score:0,preset:preset.label};
                usedBanks[loc.bank].songs.push(s.title);
                usedBanks[loc.bank].score=Math.max(usedBanks[loc.bank].score,preset.score||0);
              }}
            });return usedBanks;
          };
          var miniGrid=function(banks,max,start,deviceKey,label){
            var used=buildBankMap(banks,deviceKey);
            var nums=[];for(var i=start;i<start+max;i++) nums.push(i);
            var usedCount=Object.keys(used).length;
            var spread=usedCount>0?Math.max(...Object.keys(used).map(Number))-Math.min(...Object.keys(used).map(Number)):0;
            return <div style={{marginBottom:"var(--s-2)"}}>
              <div style={{fontSize:10,color:"var(--text-secondary)",marginBottom:3}}>{label} — <b>{usedCount}</b> banques utilisees{spread>usedCount+2?<span style={{color:"var(--red)"}}> (dispersees sur {spread} banques)</span>:""}</div>
              <div style={{display:"flex",gap:2,flexWrap:"wrap"}}>
                {nums.map(function(b){
                  var u=used[b];var has=banks[b]&&(banks[b].A||banks[b].B||banks[b].C);
                  var bg=u?(u.score>=80?"var(--green)":u.score>=65?"var(--accent-primary,#818cf8)":"var(--red)"):(has?"var(--bg-elev-3)":"var(--bg-elev-1)");
                  return <div key={b} title={u?b+": "+u.preset+" ("+u.score+"%) — "+u.songs.join(", "):(has?b+": "+((banks[b]||{}).A||"")+"/"+((banks[b]||{}).B||"")+"/"+((banks[b]||{}).C||""):b+": vide")} style={{width:14,height:14,borderRadius:2,background:bg,border:u?"none":"1px solid var(--border-subtle)",opacity:has||u?1:0.3,cursor:"default"}}></div>;
                })}
              </div>
            </div>;
          };
          var hasAnn=Object.keys(banksAnn||{}).length>0;
          var hasPlug=Object.keys(banksPlug||{}).length>0;
          return <div>
            {hasAnn&&hasPedalDevice&&miniGrid(banksAnn,50,0,"ann","📦 Pedale")}
            {hasPlug&&hasPlugDevice&&miniGrid(banksPlug,10,1,"plug","🔌 Plug")}
            <div style={{display:"flex",gap:"var(--s-3)",marginTop:4,fontSize:8,color:"var(--text-tertiary)"}}>
              <span><span style={{display:"inline-block",width:6,height:6,borderRadius:1,background:"var(--green)",marginRight:2,verticalAlign:"middle"}}></span>80%+</span>
              <span><span style={{display:"inline-block",width:6,height:6,borderRadius:1,background:"var(--accent-primary,#818cf8)",marginRight:2,verticalAlign:"middle"}}></span>65-79%</span>
              <span><span style={{display:"inline-block",width:6,height:6,borderRadius:1,background:"var(--red)",marginRight:2,verticalAlign:"middle"}}></span>&lt;65%</span>
              <span><span style={{display:"inline-block",width:6,height:6,borderRadius:1,background:"var(--bg-elev-3)",border:"1px solid var(--border-subtle)",marginRight:2,verticalAlign:"middle"}}></span>Non utilise</span>
            </div>
          </div>;
        })()}
        </>}
      </div>

      {songs.length>0&&<>

      {/* ── SECTION 2 : PLAN DE REORGANISATION ── */}
      {(()=>{
        var buildReorg=function(banks,maxBanks,startBank,deviceKey){
          var plan=[];var bankIdx=startBank;
          var seenSigs=new Set();
          standardBanks.forEach(function(sb){
            if(bankIdx>=startBank+maxBanks) return;
            var sig=(sb.slots[0].preset||"")+"|"+(sb.slots[1].preset||"")+"|"+(sb.slots[2].preset||"");
            if(seenSigs.has(sig)) return;
            seenSigs.add(sig);
            plan.push({bank:bankIdx,label:sb.label,type:"standard",A:sb.slots[0].preset,B:sb.slots[1].preset,C:sb.slots[2].preset,scoreA:sb.slots[0].score,scoreB:sb.slots[1].score,scoreC:sb.slots[2].score});
            bankIdx++;
          });
          var usedPresets=new Set();
          plan.forEach(function(p){usedPresets.add(p.A);usedPresets.add(p.B);usedPresets.add(p.C);});
          songs.forEach(function(s){
            if(bankIdx>=startBank+maxBanks) return;
            var ai=s.aiCache?.result;if(!ai?.cot_step1) return;
            var g=bestGuitarForSong(s);var gType=g?.type||"HB";
            var style=ai.song_style||"rock";
            var refAmp=ai.ref_amp?resolveRefAmp(ai.ref_amp):null;
            var findBest=function(gainRange){
              return Object.entries(PRESET_CATALOG_MERGED).filter(function(e){
                var info=e[1];
                var gr=getGainRange(gainToNumeric(info.gain));
                if(gr!==gainRange&&!(gainRange==="drive"&&gr==="crunch")) return false;
                if(usedPresets.has(e[0])) return false;
                if(!isSrcCompatible(info.src,deviceKey)) return false;
                if(availableSources&&info.src&&availableSources[info.src]===false) return false;
                return true;
              }).map(function(e){
                var info=e[1];
                var dims=[{s:computePickupScore(info.style,gainRange,gType),w:0.20},{s:computeStyleMatchScore(info.style,style),w:0.25},{s:refAmp?computeRefAmpScore(info.amp,refAmp):null,w:0.35}].filter(function(d){return d.s!==null;});
                var tw=dims.reduce(function(s2,d){return s2+d.w;},0);
                return {name:e[0],amp:info.amp,score:Math.round(dims.reduce(function(s2,d){return s2+d.s*(d.w/tw);},0))};
              }).sort(function(a,b){return b.score-a.score;})[0]||null;
            };
            var cP=findBest("clean"),dP=findBest("drive"),lP=findBest("high_gain");
            if(!cP&&!dP&&!lP) return;
            if(cP) usedPresets.add(cP.name);if(dP) usedPresets.add(dP.name);if(lP) usedPresets.add(lP.name);
            plan.push({bank:bankIdx,label:s.title+" — "+s.artist,type:"song",A:cP?.name||"—",B:dP?.name||"—",C:lP?.name||"—",scoreA:cP?.score||0,scoreB:dP?.score||0,scoreC:lP?.score||0});
            bankIdx++;
          });
          return plan;
        };
        var hasAnn2=Object.keys(banksAnn||{}).length>0;
        var hasPlug2=Object.keys(banksPlug||{}).length>0;
        var annPlan=hasAnn2?buildReorg(banksAnn,50,0,"ann"):[];
        var plugPlan=hasPlug2?buildReorg(banksPlug,10,1,"plug"):[];
        if(!annPlan.length&&!plugPlan.length) return null;
        var renderPlan=function(plan,emoji,label,onBanks){
          if(!plan.length) return null;
          var stdCount=plan.filter(function(p){return p.type==="standard";}).length;
          var songCount=plan.filter(function(p){return p.type==="song";}).length;
          return <div style={{marginBottom:"var(--s-4)"}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--text-secondary)",marginBottom:"var(--s-2)"}}>{emoji} {label} — {stdCount} standard{stdCount>1?"s":""} + {songCount} morceau{songCount>1?"x":""}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:4,marginBottom:"var(--s-3)"}}>
              {plan.map(function(p){
                var isSong=p.type==="song";
                var applyOne=function(){
                  if(!confirm("Appliquer la banque "+p.bank+" ("+p.label+") ?")) return;
                  onBanks(function(prev){
                    var next={};for(var k in prev) next[k]=prev[k];
                    next[p.bank]={cat:p.label,A:p.A==="—"?"":p.A,B:p.B==="—"?"":p.B,C:p.C==="—"?"":p.C};
                    return next;
                  });
                };
                return <div key={p.bank} style={{background:isSong?"var(--bg-elev-2)":"var(--accent-soft,rgba(129,140,248,0.06))",border:"1px solid "+(isSong?"var(--border-subtle)":"var(--border-accent,rgba(129,140,248,0.3))"),borderRadius:6,padding:"6px 8px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                    <span style={{fontSize:11,fontWeight:800,color:"var(--text-primary)"}}>{p.bank}</span>
                    <span style={{fontSize:8,fontWeight:600,color:isSong?"var(--text-tertiary)":"var(--accent)",textTransform:"uppercase"}}>{isSong?"Morceau":"Standard"}</span>
                  </div>
                  <div style={{fontSize:9,color:"var(--text-tertiary)",marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:600}}>{p.label}</div>
                  {[{s:"A",l:"Clean",n:p.A,sc:p.scoreA},{s:"B",l:"Drive",n:p.B,sc:p.scoreB},{s:"C",l:"Lead",n:p.C,sc:p.scoreC}].map(function(x){
                    return <div key={x.s} style={{fontSize:9,display:"flex",gap:3,alignItems:"baseline",marginBottom:1}}>
                      <span style={{fontWeight:700,color:"var(--text-tertiary)",width:14,flexShrink:0}}>{x.s}</span>
                      <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,color:x.n==="—"?"var(--text-tertiary)":"var(--text-secondary)"}}>{x.n}</span>
                      {x.sc>0&&<span style={{fontFamily:"var(--font-mono)",fontWeight:700,color:scoreColor(x.sc),flexShrink:0}}>{x.sc}%</span>}
                    </div>;
                  })}
                  <button onClick={applyOne} style={{marginTop:6,width:"100%",background:"var(--bg-elev-1)",border:"1px solid var(--border-subtle)",color:"var(--text-secondary)",borderRadius:"var(--r-sm)",padding:"3px 6px",fontSize:9,fontWeight:700,cursor:"pointer"}}>Appliquer cette banque</button>
                </div>;
              })}
            </div>

            {/* ── SECTION 3 : APPLIQUER ── */}
            <button onClick={function(){
              if(!confirm("Appliquer cette reorganisation sur les banques "+plan[0].bank+" a "+(plan[plan.length-1].bank)+" ?")) return;
              onBanks(function(prev){
                var next={};for(var k in prev) next[k]=prev[k];
                plan.forEach(function(p){next[p.bank]={cat:p.label,A:p.A==="—"?"":p.A,B:p.B==="—"?"":p.B,C:p.C==="—"?"":p.C};});
                return next;
              });
            }} style={{width:"100%",background:"linear-gradient(180deg,var(--brass-200,#d4a017),var(--brass-400,#b8860b))",border:"none",color:"var(--tolex-900,#1a1a1a)",borderRadius:"var(--r-md)",padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer",boxShadow:"var(--shadow-sm,0 1px 3px rgba(0,0,0,0.3))"}}>Tout appliquer ({plan.length} banques)</button>
          </div>;
        };
        return <div style={sectionStyle}>
          {eyebrow("🎯","Plan de reorganisation")}
          <div style={{fontSize:10,color:"var(--text-tertiary)",marginBottom:"var(--s-3)"}}>Banques regroupees pour le live. Standards (tes gouts) en premier, puis une banque par morceau. A=Clean, B=Drive, C=Lead.</div>
          {hasAnn2&&hasPedalDevice&&renderPlan(annPlan,"📦","Pedale",onBanksAnn)}
          {hasPlug2&&hasPlugDevice&&renderPlan(plugPlan,"🔌","Plug",onBanksPlug)}
        </div>;
      })()}

      </>}
    </div>
  );
}

// ─── Recap Screen ─────────────────────────────────────────────────────────────
// Phase 7.14 — extracted to src/app/screens/RecapScreen.jsx.
import RecapScreen from './app/screens/RecapScreen.jsx';

// ─── Synthesis Screen ─────────────────────────────────────────────────────────
function SynthesisScreen({songs,gps,aiR,onBack,onNavigate,songDb,banksAnn,banksPlug,allGuitars,availableSources,profile}) {
  // Phase 2 : itération sur les devices activés du profil. Chaque device
  // expose bankStorageKey (banksAnn|banksPlug) et presetResultKey
  // (preset_ann|preset_plug). Garde-fou : si liste vide, on retombe sur
  // les defaults du registry pour ne pas afficher un tableau sans colonne.
  // Phase 3 : on filtre les devices avec RecommendBlock (TMP) — ils ne
  // fittent pas une colonne tabulaire ; ils restent visibles dans Recap
  // et Setlists vue repliée.
  const enabledDevices=getActiveDevicesForRender(profile).filter(d=>typeof d.RecommendBlock!=='function');
  const rows=songs.map(s=>{
    const g=(allGuitars||GUITARS).find(x=>x.id===gps[s.id]);
    const type=g?.type||"HB";
    const gId=g?.id||"";
    const aiCraw=getBestResult(s,gId,aiR[s.id]||s.aiCache?.result)||null;
    const ai=aiCraw?enrichAIResult({...aiCraw,preset_ann:null,preset_plug:null,ideal_preset:null,ideal_preset_score:0,ideal_top3:null},type,gId,banksAnn,banksPlug):null;
    const perDevice={};
    if(ai){
      enabledDevices.forEach(d=>{
        const banks=d.bankStorageKey==='banksAnn'?banksAnn:banksPlug;
        const presetData=ai[d.presetResultKey];
        if(presetData){
          const rec=getInstallRec(presetData.label,type,banks,gId);
          perDevice[d.id]={name:presetData.label,score:presetData.score,rec};
        }
      });
    }
    return {s,g,type,perDevice};
  });
  const th={fontSize:11,color:"var(--text-muted)",fontWeight:700,fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"var(--tracking-wider)",padding:"8px 10px",borderBottom:"1px solid var(--a10)",textAlign:"left"};
  const td={fontSize:12,padding:"10px",borderBottom:"1px solid var(--a5)",verticalAlign:"top"};
  const cellPreset=(item,accentColor)=>{
    if(!item) return <span style={{color:"var(--text-muted)"}}>—</span>;
    const {name,score,rec}=item;
    const sc=score!=null?score:rec?.score;
    const scC=sc!=null?scoreColor(sc):"var(--text-tertiary)";
    const scB=sc!=null?scoreBg(sc):"transparent";
    return (
      <div>
        {rec?.installed
          ?<span style={{fontWeight:700,color:accentColor,fontSize:13,marginRight:4}}>Banque {rec.bank}{rec.slot}</span>
          :<span style={{fontSize:10,background:"var(--yellow-bg)",color:"var(--yellow)",borderRadius:"var(--r-sm)",padding:"1px 6px",fontWeight:700,marginRight:4}}>⬇ À installer</span>
        }
        {sc!=null&&<span style={{fontSize:10,fontWeight:800,color:scC,background:scB,borderRadius:"var(--r-sm)",padding:"1px 6px"}}>{sc}%</span>}
        <div style={{fontSize:11,color:"var(--text-sec)",lineHeight:1.5,marginTop:2}}>{name}</div>
        {!rec?.installed&&rec?.replaceBank!=null&&<div style={{fontSize:10,color:"var(--text-dim)",marginTop:1}}>→ Remplace Banque {rec.replaceBank}{rec.replaceSlot}</div>}
      </div>
    );
  };
  return (
    <div>
      <Breadcrumb crumbs={[{label:"Accueil",screen:"list"},{label:"Récap",screen:"recap"},{label:"Synthèse"}]} onNavigate={onNavigate}/>
      <div style={{marginBottom:20}}><div style={{fontFamily:"var(--font-display)",fontSize:"var(--fs-xl)",fontWeight:800,color:"var(--text-primary)"}}>Tableau de synthèse</div><div style={{fontSize:12,color:"var(--text-muted)",marginTop:3}}>{songs.length} morceau{songs.length>1?"x":""}</div></div>
      <div style={{overflowX:"auto",borderRadius:"var(--r-lg)",border:"1px solid var(--a8)"}}>
        <table>
          <thead><tr style={{background:"var(--a4)"}}>
            <th style={th}>Morceau</th>
            <th style={th}>Guitare</th>
            {enabledDevices.map(d=>(
              <th key={d.id} style={{...th,color:d.id==='tonex-plug'?"var(--accent)":"var(--text-sec)"}}>{d.icon} {d.label}</th>
            ))}
          </tr></thead>
          <tbody>
            {rows.map(({s,g,perDevice},i)=>(
              <tr key={s.id} style={{background:i%2===0?"transparent":"var(--a3)"}}>
                <td style={td}><div style={{fontWeight:600,color:"var(--text)",fontSize:13}}>{s.title}</div><div style={{fontSize:11,color:"var(--text-muted)"}}>{s.artist}</div></td>
                <td style={td}>{g?<span style={{fontSize:12,color:"var(--green)",background:"var(--green-bg)",borderRadius:"var(--r-sm)",padding:"2px 8px",fontWeight:600,whiteSpace:"nowrap"}}>{g.short}</span>:<span style={{color:"var(--text-muted)"}}>—</span>}</td>
                {enabledDevices.map(d=>(
                  <td key={d.id} style={td}>{cellPreset(perDevice[d.id],d.id==='tonex-plug'?"var(--accent)":"var(--text-sec)")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// ─── PresetBrowser ────────────────────────────────────────────────────────────
const PRESET_PAGE_SIZE=30;
function findAmpContext(ampName,ctxMap){
  if(!ampName)return null;
  const ctx=ctxMap||PRESET_CONTEXT;
  if(ctx[ampName])return ctx[ampName];
  // Alias table pour les noms volontairement déformés (trademark avoidance)
  const ALIASES={
    "Cornfield Harle":"Cornford Harlequin",
    "Reinguard T-36":"Reinhardt RT-36",
    "Diesel Humbert":"Diezel Herbert",
    "Electro Dime":"Electro-Harmonix",
    "Chandler GAV19T":"Benson Chimera",
    "Chandler 19T":"Benson Chimera",
    "Bumble Deluxe":"Dumble Deluxe",
    "Rouge Plate D50":"Dr. Z",
    "Sons Amplification":"Sons Amp",
    "Mega Barba":"Mesa Boogie",
    "Ample Betty":"Supro",
    "Amplified Nation Overdrive Reverb":"Dumble ODS",
    "Amplified Nation Wonderland Overdrive":"Dumble ODS",
    "Bogner Goldfinger":"Bogner G-Finger",
    "Dumble Overdrive Deluxe":"Dumble Deluxe",
    "Mega Amp":"Mesa Boogie",
    "Synergy SYN-30":"Fender Champ",
    "Suhr PT-100 / 2864-S":"Marshall Plexi",
    "Divers British":"Marshall Plexi",
    "Divers basse":"Ampeg SVT",
    "Divided by 13":"Divided by 13",
    "Pédales de drive":"Drive Pedals",
  };
  if(ALIASES[ampName]&&ctx[ALIASES[ampName]])return ctx[ALIASES[ampName]];
  // Combo "ampli + pédale" → chercher l'ampli de base (avant le " + ")
  if(ampName.includes(" + ")){
    const baseAmp=ampName.split(" + ")[0].trim();
    const baseCtx=findAmpContext(baseAmp,ctx);
    if(baseCtx)return baseCtx;
  }
  // Fuzzy: essayer variations de marque
  const norm=ampName.replace(/\s+/g," ").trim();
  const variations=[
    norm.replace("Mesa Boogie ","Mesa "),
    norm.replace("Mesa ","Mesa Boogie "),
    norm.replace("Marshall ","Mars "),
    norm.replace("Mars ","Marshall "),
    norm.replace("Fender ","FNDR "),
    norm.replace("FNDR ","Fender "),
  ];
  for(const v of variations){if(ctx[v])return ctx[v];}
  // Substring match: chercher une clé qui contient le nom ou vice-versa
  const lower=norm.toLowerCase();
  for(const [k,v] of Object.entries(ctx)){
    if(k.toLowerCase().includes(lower)||lower.includes(k.toLowerCase())) return v;
  }
  return null;
}

function PresetDetailInline({name,info,banksAnn,banksPlug,presetContext,guitars}){
  const ctx=findAmpContext(info.amp,presetContext||PRESET_CONTEXT);
  const annLoc=findInBanks(name,banksAnn);
  const plugLoc=findInBanks(name,banksPlug);
  const allGuitars=guitars||GUITARS;
  const sectionStyle={background:"var(--a3)",border:"1px solid var(--a7)",borderRadius:"var(--r-lg)",padding:"10px 12px",marginBottom:8};
  const sectionTitle=(icon,label)=><div style={{fontSize:10,fontWeight:700,color:"var(--text-muted)",fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"var(--tracking-wider)",marginBottom:8,display:"flex",alignItems:"center",gap:5}}>{icon} {label}</div>;
  const STYLE_LABELS={blues:"Blues",rock:"Rock",hard_rock:"Hard Rock",jazz:"Jazz",metal:"Metal",pop:"Pop"};
  const GAIN_LABELS={low:"Low gain — Clean / Edge of breakup",mid:"Mid gain — Crunch / Drive",high:"High gain — Lead / Saturé"};
  const GAIN_SHORT={low:"Clean",mid:"Crunch / Drive",high:"Lead / High gain"};
  // Styles compatibles selon le gain
  const GAIN_STYLES={
    low:{primary:["blues","jazz","pop","rock"],desc:"Son clean : ideal pour blues, jazz, pop, rock rythmique"},
    mid:{primary:["rock","blues","hard_rock"],desc:"Son crunch/drive : ideal pour rock, blues-rock, hard rock"},
    high:{primary:["hard_rock","metal","rock"],desc:"Son sature : ideal pour hard rock, metal, rock lead"}
  };
  const gainStyles=GAIN_STYLES[info.gain]||GAIN_STYLES.mid;
  // Morceaux connus par registre (pour filtrer les refs par gain)
  const CLEAN_TRACKS=["gravity","waiting on the world","sultans of swing","romeo","juliet","wonderful tonight","tears in heaven","blackbird","dust in the wind","stairway","hotel california intro","wish you were here","under the bridge","hallelujah","the thrill is gone","truckin"];
  const HEAVY_TRACKS=["money for nothing","paranoid","back in black","highway to hell","thunderstruck","smoke on the water","purple haze","whole lotta love","eruption","master of puppets","enter sandman","schism","b.y.o.b.","ace of spades","crazy train","iron man"];
  const filterRefs=(refs)=>{
    if(!refs||refs.length===0)return refs;
    var gain=info.gain;
    // Filter tracks within each artist ref based on gain
    var filtered=refs.map(function(r){
      if(!r.t||r.t.length===0) return r;
      var tracks=r.t.filter(function(t){
        var tl=t.toLowerCase();
        if(gain==="low") return !HEAVY_TRACKS.some(function(h){return tl.includes(h);});
        if(gain==="high") return !CLEAN_TRACKS.some(function(c){return tl.includes(c);});
        return true;
      });
      return {...r,t:tracks};
    });
    // Remove artists with no remaining tracks (unless they had none to begin with)
    filtered=filtered.filter(function(r){return r.t.length>0||(refs.find(function(o){return o.a===r.a;})?.t||[]).length===0;});
    return filtered.length>0?filtered:refs; // fallback to all if filter empties everything
  };
  // Parse preset character from name
  const nameLower=name.toLowerCase();
  const presetChar=
    (/\bclean\b|\bclr\b|\bcln\b/i.test(nameLower))?"Clean — Son clair, dynamique, expressif":
    (/\bedge\b|\beob\b|\bbreakup\b/i.test(nameLower))?"Edge of breakup — A la limite de la saturation, très dynamique":
    (/\bcrunch\b|\bgrit\b/i.test(nameLower))?"Crunch — Saturation légère, réactif au toucher":
    (/\bdrive\b|\bod\b|\boverdrive\b/i.test(nameLower))?"Drive — Saturation moyenne, sustain musical":
    (/\blead\b|\bsolo\b/i.test(nameLower))?"Lead — Saturation prononcée, sustain long pour solos":
    (/\bhigh.?gain\b|\bfull.?beans\b|\bdimed\b|\bmax\b/i.test(nameLower))?"High gain — Saturation maximale, mur de son":
    (/\bboost\b|\bklon\b|\bts\b|\btube.?screamer\b|\brodent\b|\bmuff\b|\bfuzz\b/i.test(nameLower))?"Boost / Pedale — Son avec pedale de drive en amont":
    null;
  const filteredRefs=filterRefs(ctx?.refs);
  // Compute per-guitar scores
  const guitarScores=allGuitars.map(g=>{
    const sc=computePickupScore(info.style,getGainRange(gainToNumeric(info.gain)),g.type);
    const gs=computeGuitarScoreV2(g.id,info.style,getGainRange(gainToNumeric(info.gain)),info.voicing);
    const combined=Math.round(sc*0.6+gs*0.4);
    return {id:g.id,name:g.short||g.name,type:g.type,score:combined};
  }).sort((a,b)=>b.score-a.score);
  return(
    <div style={{background:"var(--bg-elev-1)",border:"1px solid var(--a7)",borderRadius:"0 0 9px 9px",padding:12,marginTop:-1,animation:"slideDown .2s ease-out",display:"flex",flexDirection:"column",gap:6}}>

      {/* SECTION 1 : Infos ampli / preset */}
      <div style={sectionStyle}>
        {sectionTitle("🔊","Infos ampli / preset")}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,color:"var(--text-bright)",marginBottom:2}}>{ctx?.emoji&&<span style={{marginRight:4}}>{ctx.emoji}</span>}{info.amp}</div>
            <div style={{fontSize:10,color:"var(--text-muted)",marginBottom:4}}>{name}{info.channel?" · "+info.channel:""}</div>
          </div>
        </div>
        {presetChar&&<div style={{fontSize:11,color:"var(--text-sec)",background:"var(--a4)",border:"1px solid var(--a8)",borderRadius:"var(--r-md)",padding:"6px 10px",marginBottom:6,fontWeight:500}}>{presetChar}</div>}
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
          {info.src&&<span style={{fontSize:9,color:"var(--text-muted)",background:"var(--a6)",borderRadius:"var(--r-sm)",padding:"2px 6px",fontWeight:600}}>{SOURCE_LABELS[info.src]||info.src}</span>}
          {info.cab&&<span style={{fontSize:9,color:"var(--text-muted)",background:"var(--a6)",borderRadius:"var(--r-sm)",padding:"2px 6px"}}>🔈 {info.cab}</span>}
          {info.pack&&<span style={{fontSize:9,color:"var(--text-muted)",background:"var(--a6)",borderRadius:"var(--r-sm)",padding:"2px 6px"}}>{info.pack}</span>}
          {info.pack&&TSR_PACK_ZIPS[info.pack]&&<span style={{fontSize:9,color:"var(--text-dim)"}}>📁 {TSR_PACK_ZIPS[info.pack]}.zip</span>}
        </div>
        {info.comment&&<div style={{fontSize:10,color:"var(--text-sec)",fontStyle:"italic",marginBottom:6}}>{info.comment}</div>}
        {ctx?.desc&&<div style={{fontSize:11,color:"var(--text-sec)",lineHeight:1.5}}>{ctx.desc}</div>}
        {!ctx?.desc&&<div style={{fontSize:11,color:"var(--text-dim)",fontStyle:"italic"}}>Pas de description disponible pour cet ampli.</div>}
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:6}}>
          {annLoc
            ?<span style={{fontSize:10,color:"var(--green)",background:"var(--green-bg)",border:"1px solid var(--green-border)",borderRadius:"var(--r-md)",padding:"3px 8px",fontWeight:600}}>📦 Banque {annLoc.bank}{annLoc.slot}</span>
            :<span style={{fontSize:10,color:"var(--text-dim)",background:"var(--a4)",border:"1px solid var(--a8)",borderRadius:"var(--r-md)",padding:"3px 8px"}}>📦 Non installe</span>}
          {plugLoc
            ?<span style={{fontSize:10,color:"var(--green)",background:"var(--green-bg)",border:"1px solid var(--green-border)",borderRadius:"var(--r-md)",padding:"3px 8px",fontWeight:600}}>🔌 Banque {plugLoc.bank}{plugLoc.slot}</span>
            :<span style={{fontSize:10,color:"var(--text-dim)",background:"var(--a4)",border:"1px solid var(--a8)",borderRadius:"var(--r-md)",padding:"3px 8px"}}>🔌 Non installe</span>}
        </div>
      </div>

      {/* SECTION 2 : Style & gain */}
      <div style={sectionStyle}>
        {sectionTitle("🎛","Style & gain")}
        <div style={{display:"flex",flexDirection:"column",gap:4}}>
          <div style={{fontSize:11,color:"var(--text-sec)"}}><span style={{color:"var(--text-muted)",fontSize:10}}>Gain</span> <span style={{fontWeight:600}}>{GAIN_LABELS[info.gain]||info.gain}</span></div>
          <div style={{fontSize:11,color:"var(--text-sec)"}}><span style={{color:"var(--text-muted)",fontSize:10}}>Style catalogue</span> <span style={{fontWeight:600}}>{STYLE_LABELS[info.style]||info.style}</span></div>
          <div style={{fontSize:10,color:"var(--text-dim)",marginTop:2}}>{gainStyles.desc}</div>
        </div>
      </div>

      {/* SECTION 3 : Morceaux mythiques */}
      {filteredRefs&&filteredRefs.length>0&&<div style={sectionStyle}>
        {sectionTitle("🎵","Morceaux mythiques — registre "+GAIN_SHORT[info.gain])}
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {filteredRefs.map(r=><div key={r.a} style={{fontSize:11,color:"var(--text-sec)"}}>
            <span style={{fontWeight:600,color:"var(--text-bright)"}}>{r.a}</span>
            {r.t.length>0&&<span style={{color:"var(--text-dim)"}}> — {r.t.join(", ")}</span>}
          </div>)}
        </div>
      </div>}

      {/* SECTION 4 : Guitares adaptées */}
      <div style={sectionStyle}>
        {sectionTitle("🎸","Guitares adaptees")}
        <div style={{display:"flex",flexDirection:"column",gap:4}}>
          {guitarScores.map(g=><div key={g.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:11}}>
            <span style={{fontWeight:600,color:"var(--text-bright)",flex:1}}>{g.name} <span style={{fontSize:9,color:"var(--text-dim)"}}>({g.type})</span></span>
            <div style={{width:60,height:4,background:"var(--a8)",borderRadius:"var(--r-xs)",overflow:"hidden",flexShrink:0}}><div style={{width:`${g.score}%`,height:"100%",background:scoreColor(g.score),borderRadius:"var(--r-xs)"}}/></div>
            <span style={{fontSize:10,fontWeight:700,color:scoreColor(g.score),width:32,textAlign:"right",flexShrink:0}}>{g.score}%</span>
          </div>)}
        </div>
      </div>

    </div>
  );
}

function PresetList({filtered,selected,setSelected,banksAnn,banksPlug,fullCatalog,filterSrcs,filterPacks,togglePack,setFilterPacks,mergedContext,guitars}){
  const [shown,setShown]=useState(PRESET_PAGE_SIZE);
  useEffect(()=>setShown(PRESET_PAGE_SIZE),[filtered,filterPacks]);

  // Sub-grouping: par modèle d'ampli (explicite)
  const subPacks=useMemo(()=>{
    var groups={};
    filtered.forEach(function([name,info]){
      var key=info.amp||"Autre";
      groups[key]=(groups[key]||0)+1;
    });
    return Object.entries(groups).sort(function(a,b){return b[1]-a[1];});
  },[filtered]);

  const displayFiltered=useMemo(()=>{
    if(filterPacks.length===0) return filtered;
    return filtered.filter(function([,info]){return filterPacks.includes(info.amp||"Autre");});
  },[filtered,filterPacks]);

  const visible=displayFiltered.slice(0,shown);
  const remaining=displayFiltered.length-shown;
  return(
    <div>
      {/* Sub-filters: modèles d'ampli */}
      {subPacks&&subPacks.length>1&&(()=>{
        var chipStyle=function(on){return{fontSize:10,fontWeight:on?700:500,color:on?"var(--accent)":"var(--text-sec)",background:on?"var(--accent-bg)":"var(--a3)",border:on?"1px solid var(--accent-border)":"1px solid var(--a6)",borderRadius:"var(--r-md)",padding:"4px 8px",cursor:"pointer"};};
        return <div style={{marginBottom:12}}>
          <div style={{fontSize:10,color:"var(--text-muted)",fontWeight:700,fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"var(--tracking-wider)",marginBottom:6}}>Modele d'ampli</div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            <button onClick={function(){setFilterPacks([]);}} style={chipStyle(filterPacks.length===0)}>Tous ({filtered.length})</button>
            {subPacks.slice(0,20).map(function([amp,count]){var on=filterPacks.includes(amp);return(
              <button key={amp} onClick={function(){togglePack(amp);}} style={chipStyle(on)}>{amp} ({count})</button>);})}
          </div>
        </div>;
      })()}
      <div style={{fontSize:10,color:"var(--text-muted)",fontWeight:700,fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"var(--tracking-wider)",marginBottom:8}}>
        {displayFiltered.length} preset{displayFiltered.length>1?"s":""} — clique pour voir la fiche
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:3}}>
        {visible.map(([name,info])=>{
          const annLoc=findInBanks(name,banksAnn);
          const plugLoc=findInBanks(name,banksPlug);
          const isSel=selected===name;
          return(
            <div key={name}>
              <div onClick={()=>setSelected(isSel?null:name)}
                style={{display:"flex",alignItems:"center",gap:8,background:isSel?"var(--accent-bg)":"var(--a3)",border:isSel?"1px solid var(--accent-border)":"1px solid var(--a6)",borderRadius:isSel?"9px 9px 0 0":9,padding:"8px 11px",cursor:"pointer"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,color:isSel?"var(--accent)":"var(--text-bright)",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
                  <div style={{display:"flex",gap:5,alignItems:"center",marginTop:2,flexWrap:"wrap"}}>
                    <span style={{fontSize:10,color:"var(--text-muted)"}}>{info.amp}</span>
                    {(info.pack||info.amp)&&<span style={{fontSize:9,color:"var(--text-muted)",background:"var(--a6)",borderRadius:"var(--r-sm)",padding:"1px 5px"}}>{info.pack||info.amp}</span>}
                    {annLoc&&<span style={{fontSize:9,color:"var(--accent)",background:"var(--accent-bg)",borderRadius:"var(--r-sm)",padding:"1px 5px",fontWeight:700}}>📦{annLoc.bank}{annLoc.slot}</span>}
                    {plugLoc&&<span style={{fontSize:9,color:"var(--accent)",background:"rgba(165,180,252,0.1)",borderRadius:"var(--r-sm)",padding:"1px 5px",fontWeight:700}}>🔌{plugLoc.bank}{plugLoc.slot}</span>}
                  </div>
                </div>
                <div style={{display:"flex",gap:3,alignItems:"center",flexShrink:0}}>
                  {["HB","SC","P90"].map(gt=>{const sc=computePickupScore(info.style,getGainRange(gainToNumeric(info.gain)),gt);return <span key={gt} style={{fontSize:9,color:scoreColor(sc),fontWeight:700,background:scoreBg(sc),borderRadius:"var(--r-sm)",padding:"1px 4px"}}>{sc}</span>;})}
                </div>
              </div>
              {isSel&&<PresetDetailInline name={name} info={info} banksAnn={banksAnn} banksPlug={banksPlug} presetContext={mergedContext} guitars={guitars}/>}
            </div>
          );
        })}
      </div>
      {remaining>0&&(
        <button onClick={()=>setShown(s=>s+PRESET_PAGE_SIZE)}
          style={{width:"100%",marginTop:10,background:"var(--a5)",border:"1px solid var(--a10)",color:"var(--text-sec)",borderRadius:"var(--r-lg)",padding:"10px",fontSize:12,cursor:"pointer",fontWeight:600}}>
          Voir {Math.min(remaining,PRESET_PAGE_SIZE)} de plus ({remaining} restants)
        </button>
      )}
    </div>
  );
}

// Curated amp families for Explorer level-2 grouping. Each entry = [familyName, [substring patterns]]
// Order matters: more specific patterns first (Plexi catches "Super Lead" before SL800 / JCM800 are tested).
const CURATED_FAMILIES={
  "Fender":[
    ["Bassman",    ["Bassman"]],
    ["Twin",       ["Twin"]],
    ["Princeton",  ["Princeton"]],
    ["Deluxe",     ["Deluxe"]],
    ["Champ",      ["Champ"]],
    ["Super",      ["Super Reverb","Super S","Super "]],
    ["Concert",    ["Concert"]],
    ["Pro",        ["Pro Amp"]],
    ["Cambridge",  ["Cambridge"]],
    ["Bandmaster", ["Bandmaster"]],
    ["Texas Star", ["Texas Star"]],
    ["Tweed",      ["Tweed"]],
  ],
  "Marshall":[
    ["Plexi",          ["Plexi","Super Lead","Super 100","1974X","Major"]],
    ["JCM800",         ["JCM800","JC800"]],
    ["JCM900",         ["JCM900"]],
    ["SL800",          ["SL800"]],
    ["SL100",          ["SL100"]],
    ["JTM",            ["JTM"]],
    ["SLT60",          ["SLT60"]],
    ["Silver Jubilee", ["Silver Jubilee","Silver J"]],
    ["Super Bass",     ["Super Bass","SB100"]],
    ["18W",            ["18W"]],
  ],
};
function familyForAmp(amp,brand){
  if(!amp) return "Autre";
  // Pédales : la "famille" est la pédale citée après le +
  if(brand==="Pédales"){
    var after=amp.split(" + ").slice(1).join(" + ").trim();
    return after||amp;
  }
  // Pour les combos "Ampli + Pédale", on regroupe par l'ampli
  var base=amp.split(" + ")[0].trim();
  var curated=CURATED_FAMILIES[brand];
  if(curated){
    for(var i=0;i<curated.length;i++){
      var fam=curated[i][0],pats=curated[i][1];
      for(var j=0;j<pats.length;j++){
        if(base.indexOf(pats[j])!==-1) return fam;
      }
    }
  }
  // Heuristique : on enlève la marque, les qualifiants d'époque, les références de circuit, les années
  var name=base;
  if(brand&&name.indexOf(brand)===0) name=name.substring(brand.length).trim();
  name=name.replace(/^(Tweed|Blonde|Silverface|Blackface|BF|SF|Custom|Hot Rod)\s+/i,"");
  name=name.replace(/^(5E\d+|505\d+|AA\d+|AB\d+|6G\d+)\s+/i,"");
  name=name.replace(/\b(19[5-9]\d|20[0-2]\d)\b/g,"").trim().replace(/\s+/g," ");
  return name||base||"Autre";
}

function PresetBrowser({banksAnn,banksPlug,availableSources,customPacks,guitars,toneNetPresets}) {
  const [soundProfile,setSoundProfile]=useState("all");
  const [filterBrand,setFilterBrand]=useState("");
  const [filterModel,setFilterModel]=useState("");
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState(null);
  const [filterPacks,setFilterPacks]=useState([]);
  const togglePack=key=>setFilterPacks(p=>p.includes(key)?p.filter(x=>x!==key):[...p,key]);

  // Merge PRESET_CONTEXT with custom pack ampContext
  const mergedContext=useMemo(()=>{
    const ctx={...PRESET_CONTEXT};
    (customPacks||[]).forEach(pack=>{
      if(pack.ampContext){
        for(const [amp,info] of Object.entries(pack.ampContext)){
          if(!ctx[amp]) ctx[amp]=info;
        }
      }
    });
    return ctx;
  },[customPacks]);

  // Merge custom packs into catalog — TSR_PACK_CATALOG is authoritative for TSR presets
  const fullCatalog=useMemo(()=>{
    // Dedup PRESET_CATALOG_FULL: remove entries that are normalized duplicates of TSR_PACK_CATALOG
    const tsrNorms=new Set(Object.keys(TSR_PACK_CATALOG).map(normalizePresetName));
    const fullDeduped={};
    for(const [k,v] of Object.entries(PRESET_CATALOG_FULL)){
      if(!tsrNorms.has(normalizePresetName(k))) fullDeduped[k]=v;
    }
    const cat={...fullDeduped,...TSR_PACK_CATALOG,...ANNIVERSARY_CATALOG,...FACTORY_CATALOG,...PLUG_FACTORY_CATALOG,...PRESET_CATALOG};
    (customPacks||[]).forEach(pack=>{
      (pack.presets||[]).forEach(p=>{
        if(p.name&&!cat[p.name]) cat[p.name]={src:pack.name,amp:p.amp||"Custom",gain:p.gain||"mid",style:p.style||"rock",scores:p.scores||{HB:78,SC:78,P90:78}};
      });
    });
    (toneNetPresets||[]).forEach(p=>{
      if(p.name&&!cat[p.name]) cat[p.name]={src:"ToneNET",amp:p.amp||"ToneNET",gain:p.gain||"mid",style:p.style||"rock",channel:p.channel||"",cab:p.cab||"",comment:p.comment||"",scores:p.scores||{HB:75,SC:75,P90:75}};
    });
    // Filter to only sources the user has
    if(availableSources){
      for(const k of Object.keys(cat)){
        if(availableSources[cat[k].src]===false) delete cat[k];
      }
    }
    return cat;
  },[customPacks,toneNetPresets,availableSources]);

  // Profils sonores : combinaison style + gain orientée finalité
  const SOUND_PROFILES={
    all:{label:"Tous les presets",filter:()=>true},
    clean_cristallin:{label:"Clean cristallin",desc:"Fender, jazz, pop",filter:i=>i.gain==="low"&&["jazz","pop","blues","rock"].includes(i.style)},
    blues_vintage:{label:"Blues vintage",desc:"B.B. King, Clapton, edge of breakup",filter:i=>(i.style==="blues")||(i.gain==="low"&&i.style==="rock")},
    jazz_warm:{label:"Jazz warm",desc:"Son rond, chaleureux",filter:i=>i.style==="jazz"||(i.gain==="low"&&i.style==="pop")},
    crunch_70s:{label:"Crunch rock 70s",desc:"Led Zep, Stones, Hendrix",filter:i=>i.gain==="mid"&&["rock","blues"].includes(i.style)},
    british:{label:"British invasion",desc:"Marshall, Vox, AC/DC",filter:i=>i.gain==="mid"&&["rock","hard_rock"].includes(i.style)},
    blues_rock:{label:"Blues-rock texan",desc:"SRV, Mayer, Bonamassa",filter:i=>i.style==="blues"&&["mid","low"].includes(i.gain)},
    funk_soul:{label:"Funk / Soul",desc:"Clean dynamique, Nile Rodgers",filter:i=>i.gain==="low"&&["pop","rock"].includes(i.style)},
    hard_rock:{label:"Hard rock classique",desc:"AC/DC, GN'R, Van Halen",filter:i=>i.style==="hard_rock"&&["mid","high"].includes(i.gain)},
    metal:{label:"Metal moderne",desc:"Metallica, Tool, Petrucci",filter:i=>i.style==="metal"||(i.gain==="high"&&i.style==="hard_rock")},
    high_gain_lead:{label:"High gain lead",desc:"Solos, shred, sustain",filter:i=>i.gain==="high"},
    pedales:{label:"Pedales de drive",desc:"Captures pedales seules",filter:i=>(i.amp||"").includes("drive")||(i.amp||"").includes("Pedal")||(i.amp||"").toLowerCase().includes("pédale")},
  };

  // Build amp brand grouping
  const ampBrands=useMemo(()=>{
    var brands={};
    Object.values(fullCatalog).forEach(function(info){
      if(!info.amp) return;
      var brand=info.amp.split(" ")[0];
      if(brand==="Dr."||brand==="Two"||brand==="Bad"||brand==="Divided") brand=info.amp.split(" ").slice(0,2).join(" ");
      if(!brands[brand]) brands[brand]=0;
      brands[brand]++;
    });
    return Object.entries(brands).sort(function(a,b){return b[1]-a[1];});
  },[fullCatalog]);

  const filtered=useMemo(()=>
    Object.entries(fullCatalog).filter(([name,info])=>{
      const profile=SOUND_PROFILES[soundProfile];
      if(profile&&!profile.filter(info))return false;
      if(filterBrand){var b=info.amp?info.amp.split(" ")[0]:"";if(b==="Dr."||b==="Two"||b==="Bad"||b==="Divided")b=info.amp.split(" ").slice(0,2).join(" ");if(b!==filterBrand)return false;}
      if(filterModel&&familyForAmp(info.amp,filterBrand)!==filterModel)return false;
      if(search.trim()){
        const q=search.toLowerCase();
        const ctx=mergedContext[info.amp];
        const artistsStr=(ctx?.refs||[]).map(r=>r.a).join(" ").toLowerCase();
        const tracksStr=(ctx?.refs||[]).flatMap(r=>r.t).join(" ").toLowerCase();
        if(!name.toLowerCase().includes(q)&&!info.amp.toLowerCase().includes(q)&&!artistsStr.includes(q)&&!tracksStr.includes(q))return false;
      }
      return true;
    })
  ,[soundProfile,filterBrand,filterModel,search]);

  const [randomPick,setRandomPick]=useState(null);
  const pickRandom=()=>{
    const pool=Object.entries(fullCatalog);
    if(!pool.length)return;
    const [name,info]=pool[Math.floor(Math.random()*pool.length)];
    setRandomPick({name,info});
    setSelected(null);
  };

  const ALL_SRC_OPTS={TSR:"64 Studio Rats",ML:"ML Sound Lab Essentials",Anniversary:"ToneX Anniversary Factory",Factory:"ToneX Factory",PlugFactory:"ToneX Plug Factory",custom:"Custom",ToneNET:"ToneNET"};
  const SRC_OPTS={all:"Toutes sources",...Object.fromEntries(Object.entries(ALL_SRC_OPTS).filter(([k])=>!availableSources||availableSources[k]!==false))};
  const ampFamilies=useMemo(()=>{
    if(!filterBrand) return [];
    var fams={};
    Object.values(fullCatalog).forEach(function(info){
      if(!info.amp) return;
      var b=info.amp.split(" ")[0];
      if(b==="Dr."||b==="Two"||b==="Bad"||b==="Divided") b=info.amp.split(" ").slice(0,2).join(" ");
      if(b!==filterBrand) return;
      var profile=SOUND_PROFILES[soundProfile];
      if(profile&&!profile.filter(info)) return;
      var fam=familyForAmp(info.amp,filterBrand);
      if(!fams[fam]) fams[fam]={count:0,amps:new Set()};
      fams[fam].count++;
      fams[fam].amps.add(info.amp);
    });
    return Object.entries(fams).map(function([fam,data]){
      return [fam,{count:data.count,amps:[...data.amps].sort()}];
    }).sort(function(a,b){return b[1].count-a[1].count;});
  },[fullCatalog,filterBrand,soundProfile]);
  const hasFilter=soundProfile!=="all"||filterBrand||search.trim();
  return (
    <div>
      <div style={{fontSize:13,color:"var(--text-muted)",marginBottom:10}}>Explore ta bibliothèque de presets et découvre leur contexte musical.</div>

      {/* Recherche — en haut, bien visible */}
      <input placeholder="🔍 Rechercher artiste, morceau, ampli..." value={search} onChange={e=>setSearch(e.target.value)}
        style={{width:"100%",background:"var(--bg-card)",color:"var(--text)",border:"2px solid var(--a15)",borderRadius:"var(--r-lg)",padding:"14px 16px",fontSize:15,boxSizing:"border-box",marginBottom:14}}/>

      {/* Bouton aléatoire */}
      <button onClick={pickRandom} style={{width:"100%",background:"var(--accent)",border:"none",color:"var(--text-inverse)",borderRadius:"var(--r-lg)",padding:"12px",fontSize:14,fontWeight:700,cursor:"pointer",marginBottom:16}}>
        🎲 Preset aléatoire
      </button>

      {/* Fiche du preset aléatoire */}
      {randomPick&&<div style={{marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
          <span style={{fontSize:13,fontWeight:800,color:"var(--text)"}}>{randomPick.name}</span>
          <button onClick={()=>setRandomPick(null)} style={{background:"none",border:"none",color:"var(--text-muted)",cursor:"pointer",fontSize:14}}>✕</button>
        </div>
        <PresetDetailInline name={randomPick.name} info={randomPick.info} banksAnn={banksAnn} banksPlug={banksPlug} presetContext={mergedContext} guitars={guitars}/>
      </div>}

      {/* Filtres */}
      {(()=>{
        const tile=(active)=>({fontSize:11,fontWeight:active?700:500,color:active?"var(--accent)":"var(--text-muted)",background:active?"var(--accent-bg)":"var(--a3)",border:active?"1px solid var(--accent-border)":"1px solid var(--a7)",borderRadius:"var(--r-md)",padding:"6px 12px",cursor:"pointer",textAlign:"left"});
        const PROFILE_GROUPS=[
          {title:"Sons cleans",profiles:["clean_cristallin","blues_vintage","jazz_warm","funk_soul"]},
          {title:"Sons crunch / drive",profiles:["crunch_70s","british","blues_rock"]},
          {title:"Sons satures",profiles:["hard_rock","metal","high_gain_lead"]},
          {title:"Autre",profiles:["pedales"]},
        ];
        return <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
        {/* Profils sonores */}
        <div>
          <div style={{fontSize:10,color:"var(--text-muted)",fontWeight:700,fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"var(--tracking-wider)",marginBottom:6}}>Quel son cherches-tu ?</div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
            <button onClick={()=>setSoundProfile("all")} style={tile(soundProfile==="all")}>Tous</button>
          </div>
          {PROFILE_GROUPS.map(g=><div key={g.title} style={{marginBottom:6}}>
            <div style={{fontSize:9,color:"var(--text-dim)",fontWeight:600,fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"var(--tracking-wider)",marginBottom:4}}>{g.title}</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {g.profiles.map(id=>{const p=SOUND_PROFILES[id];if(!p)return null;const active=soundProfile===id;return(
                <button key={id} onClick={()=>setSoundProfile(active?"all":id)} style={tile(active)}>
                  <div>{p.label}</div>
                  {p.desc&&<div style={{fontSize:9,fontWeight:400,color:active?"var(--accent)":"var(--text-dim)",marginTop:1}}>{p.desc}</div>}
                </button>
              );})}
            </div>
          </div>)}
        </div>
        {hasFilter&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {filterBrand&&!filterModel&&<button onClick={()=>{setFilterBrand("");setFilterModel("");}} style={{fontSize:11,color:"var(--accent)",background:"none",border:"none",cursor:"pointer",padding:0}}>← Amplis</button>}
            {filterBrand&&filterModel&&<button onClick={()=>setFilterModel("")} style={{fontSize:11,color:"var(--accent)",background:"none",border:"none",cursor:"pointer",padding:0}}>← {filterBrand}</button>}
            {filterBrand&&!filterModel&&<span style={{fontSize:12,fontWeight:700,color:"var(--text-primary)"}}>{filterBrand}</span>}
            {filterModel&&<span style={{fontSize:12,fontWeight:700,color:"var(--text-primary)"}}>{filterModel}</span>}
            <span style={{fontSize:11,color:"var(--text-muted)"}}>{filtered.length} preset{filtered.length>1?"s":""}</span>
          </div>
          <button onClick={()=>{setSoundProfile("all");setFilterBrand("");setFilterModel("");setFilterPacks([]);setSearch("");}} style={{fontSize:11,color:"var(--text-muted)",background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>Reinitialiser</button>
        </div>}
      </div>;})()}

      {/* Browse by amp brand */}
      {!hasFilter&&(()=>{
        return <div>
          <div style={{fontSize:10,color:"var(--text-muted)",fontWeight:700,fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"var(--tracking-wider)",marginBottom:10}}>Parcourir par ampli — {Object.keys(fullCatalog).length} presets</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
            {ampBrands.slice(0,18).map(([brand,count])=>(
              <button key={brand} onClick={()=>{setFilterBrand(brand);setFilterModel("");}}
                style={{background:"var(--a4)",border:"1px solid var(--a8)",borderRadius:"var(--r-md)",padding:"12px 8px",cursor:"pointer",textAlign:"center",transition:"all .15s"}}
                onMouseOver={e=>{e.currentTarget.style.borderColor="var(--a15)";e.currentTarget.style.background="var(--a7)";}}
                onMouseOut={e=>{e.currentTarget.style.borderColor="var(--a8)";e.currentTarget.style.background="var(--a4)";}}>
                <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)"}}>{brand}</div>
                <div style={{fontSize:10,color:"var(--text-tertiary)",marginTop:2}}>{count} preset{count>1?"s":""}</div>
              </button>
            ))}
          </div>
        </div>;
      })()}
      {/* Level 2: Amp family grid (Brand selected, no family yet) */}
      {filterBrand&&!filterModel&&!search.trim()&&ampFamilies.length>0&&<div style={{marginTop:8}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr",gap:4}}>
          {ampFamilies.map(([fam,data])=>{
            var sub=data.amps.length>1?data.amps.map(a=>a.replace(filterBrand,"").replace(" + "," + ").trim()).slice(0,3).join(" · "):"";
            return <button key={fam} onClick={()=>setFilterModel(fam)}
              style={{background:"var(--a4)",border:"1px solid var(--a8)",borderRadius:"var(--r-md)",padding:"8px 12px",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,transition:"all .15s"}}
              onMouseOver={e=>{e.currentTarget.style.borderColor="var(--a15)";e.currentTarget.style.background="var(--a7)";}}
              onMouseOut={e=>{e.currentTarget.style.borderColor="var(--a8)";e.currentTarget.style.background="var(--a4)";}}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,color:"var(--text-primary)"}}>{fam}</div>
                {sub&&<div style={{fontSize:9,color:"var(--text-dim)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:1}}>{sub}{data.amps.length>3?" …":""}</div>}
              </div>
              <span style={{fontSize:10,color:"var(--text-tertiary)",flexShrink:0}}>{data.count}</span>
            </button>;
          })}
        </div>
      </div>}
      {hasFilter&&(filterModel||search.trim()||!filterBrand)&&filtered.length===0&&<div style={{textAlign:"center",padding:"24px",color:"var(--text-dim)",fontSize:13}}>Aucun preset ne correspond à ces critères.</div>}
      {hasFilter&&(filterModel||search.trim()||!filterBrand)&&filtered.length>0&&<PresetList filtered={filtered} selected={selected} setSelected={setSelected} banksAnn={banksAnn} banksPlug={banksPlug} fullCatalog={fullCatalog} filterSrcs={[]} filterPacks={filterPacks} togglePack={togglePack} setFilterPacks={setFilterPacks} mergedContext={mergedContext} guitars={guitars}/>}
    </div>
  );
}

// ─── JamScreen ────────────────────────────────────────────────────────────────
const JAM_STYLES=[
  {id:"jazz",   label:"Jazz",       emoji:"🎹", color:"148,163,184"},
  {id:"blues",  label:"Blues",      emoji:"🎷", color:"148,163,184"},
  {id:"rock",   label:"Rock",       emoji:"🎸", color:"148,163,184"},
  {id:"hard_rock",label:"Hard Rock",emoji:"🔥", color:"148,163,184"},
  {id:"metal",  label:"Metal",      emoji:"💀", color:"148,163,184"},
];
// Phase 7.14 — TYPE_LABELS / TYPE_COLORS extraits à src/app/utils/ui-constants.js (importés en tête de fichier).

function JamPresetItem({p,rank,isSelected,onSelect,banksAnn,banksPlug,guitars}){
  const rankColors=["var(--accent)","var(--text-sec)","var(--text-muted)"];
  const sc=scoreColor(p.score);
  const sb=scoreBg(p.score);
  const info=findCatalogEntry(p.name);
  return(
    <div>
      <div className="preset-result-card" onClick={onSelect} style={{cursor:"pointer",borderRadius:isSelected?"10px 10px 0 0":10}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:18,fontWeight:900,color:rankColors[rank]||"var(--text-muted)",minWidth:22}}>#{rank+1}</span>
          {"bank" in p&&<span style={{background:"var(--accent-bg)",color:"var(--accent)",border:"1px solid var(--accent-border)",borderRadius:"var(--r-sm)",padding:"2px 8px",fontSize:11,fontWeight:700}}>Banque {p.bank}{p.slot}</span>}
          <span style={{fontSize:11,fontWeight:800,color:sc,background:sb,borderRadius:"var(--r-sm)",padding:"1px 7px",border:`1px solid ${sc}40`}}>{p.scoreLabel||p.score+"%"}</span>
          {gainBadge(p.gain)}
          <span style={{fontSize:9,color:"var(--text-muted)",background:"var(--a6)",borderRadius:"var(--r-sm)",padding:"1px 5px",fontWeight:600}}>{p.src}</span>
          <span style={{fontSize:10,color:"var(--text-dim)",marginLeft:"auto"}}>{isSelected?"▲":"▼"}</span>
        </div>
        <div style={{fontSize:12,color:"var(--text-bright)",fontWeight:600,marginTop:5,lineHeight:1.3}}>{p.name}</div>
        <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>{p.amp}</div>
      </div>
      {isSelected&&info&&<PresetDetailInline name={p.name} info={info} banksAnn={banksAnn} banksPlug={banksPlug} guitars={guitars}/>}
    </div>
  );
}

function JamScreen({banksAnn,banksPlug,allGuitars,availableSources,profile}){
  // Phase 2 fix : ne montre les sections Pédale/Plug que si le device
  // correspondant est activé dans le profil.
  const enabledDevices=getActiveDevicesForRender(profile);
  const hasPedalDevice=enabledDevices.some(d=>d.deviceKey==='ann');
  const hasPlugDevice=enabledDevices.some(d=>d.deviceKey==='plug');
  const guitars=allGuitars||GUITARS;
  const [step,setStep]=useState("guitar"); // "guitar" | "style" | "results"
  const [guitarId,setGuitarId]=useState(null);
  const [style,setStyle]=useState(null);
  const [selectedJam,setSelectedJam]=useState(null);

  const guitar=guitars.find(g=>g.id===guitarId);
  const recs=useMemo(()=>{
    if(!guitarId||!style) return null;
    return getJamRecs(guitarId,style,banksAnn,banksPlug,guitars,availableSources);
  },[guitarId,style,banksAnn,banksPlug,guitars,availableSources]);

  const reset=()=>{setStep("guitar");setGuitarId(null);setStyle(null);};

  if(step==="results"&&recs){
    const styleInfo=JAM_STYLES.find(s=>s.id===style);
    const typeRgb=TYPE_COLORS[recs.gType]||"99,102,241";
    return(
      <div>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
          <button onClick={reset} style={{background:"var(--a8)",border:"1px solid var(--a12)",color:"var(--text-sec)",borderRadius:"var(--r-md)",padding:"6px 12px",fontSize:12,cursor:"pointer",flexShrink:0}}>← Nouveau Jam</button>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <span style={{fontSize:12,background:`rgba(${typeRgb},0.15)`,color:`rgb(${typeRgb})`,border:`1px solid rgba(${typeRgb},0.4)`,borderRadius:"var(--r-md)",padding:"3px 10px",fontWeight:700}}>{guitar?.name} · {TYPE_LABELS[recs.gType]}</span>
            <span style={{fontSize:12,background:`rgba(${styleInfo?.color||"99,102,241"},0.15)`,color:`rgb(${styleInfo?.color||"99,102,241"})`,border:`1px solid rgba(${styleInfo?.color||"99,102,241"},0.4)`,borderRadius:"var(--r-md)",padding:"3px 10px",fontWeight:700}}>{styleInfo?.emoji} {styleInfo?.label}</span>
          </div>
        </div>

        {/* Top 3 Pédale — n'apparaît que si un device pedal est activé */}
        {hasPedalDevice&&<div style={{marginBottom:16}}>
          <div style={{fontSize:12,color:"var(--text-muted)",fontWeight:700,fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"var(--tracking-wider)",marginBottom:8}}>📦 Top 3 — Pedale <span style={{fontSize:10,color:"var(--text-dim)",fontWeight:400,textTransform:"none"}}>(presets installés)</span></div>
          {recs.annTop3.length>0
            ?recs.annTop3.map((p,i)=><JamPresetItem key={p.name} p={p} rank={i} isSelected={selectedJam===p.name} onSelect={()=>setSelectedJam(selectedJam===p.name?null:p.name)} banksAnn={banksAnn} banksPlug={banksPlug} guitars={guitars}/>)
            :<div style={{fontSize:12,color:"var(--text-dim)",padding:"12px",background:"var(--a3)",borderRadius:"var(--r-md)",textAlign:"center"}}>Aucun preset {styleInfo?.label} installé sur la Pédale pour ce type de guitare.</div>
          }
        </div>}

        {/* Best Plug — n'apparaît que si tonex-plug est activé */}
        {hasPlugDevice&&<div style={{marginBottom:16}}>
          <div style={{fontSize:12,color:"var(--text-muted)",fontWeight:700,fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"var(--tracking-wider)",marginBottom:8}}>🔌 Top 3 — ToneX Plug <span style={{fontSize:10,color:"var(--text-dim)",fontWeight:400,textTransform:"none"}}>(presets installés)</span></div>
          {recs.plugBest.length>0
            ?recs.plugBest.map((p,i)=><JamPresetItem key={p.name} p={p} rank={i} isSelected={selectedJam===p.name} onSelect={()=>setSelectedJam(selectedJam===p.name?null:p.name)} banksAnn={banksAnn} banksPlug={banksPlug} guitars={guitars}/>)
            :<div style={{fontSize:12,color:"var(--text-dim)",padding:"12px",background:"var(--a3)",borderRadius:"var(--r-md)",textAlign:"center"}}>Aucun preset {styleInfo?.label} installé sur le Plug pour ce type de guitare.</div>
          }
        </div>}

        {/* Top 3 Full Catalog */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,color:"var(--text-muted)",fontWeight:700,fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"var(--tracking-wider)",marginBottom:8}}>🌐 Top 3 — Catalogue complet <span style={{fontSize:10,color:"var(--text-dim)",fontWeight:400,textTransform:"none"}}>(tous presets, installés ou non)</span></div>
          {recs.fullTop3.map((p,i)=><JamPresetItem key={p.name} p={p} rank={i} isSelected={selectedJam===p.name} onSelect={()=>setSelectedJam(selectedJam===p.name?null:p.name)} banksAnn={banksAnn} banksPlug={banksPlug} guitars={guitars}/>)}
        </div>
      </div>
    );
  }

  if(step==="style"){
    return(
      <div>
        <button onClick={()=>setStep("guitar")} style={{background:"var(--a8)",border:"1px solid var(--a12)",color:"var(--text-sec)",borderRadius:"var(--r-md)",padding:"6px 12px",fontSize:12,cursor:"pointer",marginBottom:16}}>← Changer de guitare</button>
        <div style={{fontSize:14,color:"var(--text)",fontWeight:700,marginBottom:4}}>Guitare : <span style={{color:"var(--green)"}}>{guitar?.name}</span></div>
        <div style={{fontSize:12,color:"var(--text-muted)",marginBottom:16}}>Quel style joues-tu ?</div>
        <div className="style-grid">
          {JAM_STYLES.map(s=>(
            <button key={s.id} onClick={()=>{setStyle(s.id);setStep("results");}}
              style={{background:`rgba(${s.color},0.1)`,border:`1px solid rgba(${s.color},0.3)`,borderRadius:"var(--r-lg)",padding:"14px 8px",cursor:"pointer",textAlign:"center",transition:"all .15s"}}>
              <div style={{fontSize:22,marginBottom:4}}>{s.emoji}</div>
              <div style={{fontSize:12,fontWeight:700,color:`rgb(${s.color})`}}>{s.label}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // step === "guitar"
  const typeGroups={HB:[],SC:[],P90:[]};
  guitars.forEach(g=>typeGroups[g.type]?.push(g));
  return(
    <div>
      <div style={{fontSize:12,color:"var(--text-muted)",marginBottom:16}}>Sélectionne ta guitare pour ce jam :</div>
      {Object.entries(typeGroups).filter(([,arr])=>arr.length>0).map(([type,arr])=>(
        <div key={type} style={{marginBottom:16}}>
          <div style={{fontSize:11,color:`rgb(${TYPE_COLORS[type]||"99,102,241"})`,fontWeight:700,fontFamily:"var(--font-mono)",textTransform:"uppercase",letterSpacing:"var(--tracking-wider)",marginBottom:8}}>{type} — {TYPE_LABELS[type]}</div>
          <div className="guitar-grid">
            {arr.map(g=>(
              <button key={g.id} className={`guitar-card${guitarId===g.id?" selected":""}`} onClick={()=>{setGuitarId(g.id);setStep("style");}}>
                <GuitarSilhouette id={g.id} size={36}/>
                <div style={{fontSize:11,fontWeight:700,color:"var(--text-bright)",lineHeight:1.3,marginTop:4}}>{g.short||g.name}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SetlistsScreen (onglets Setlists + Morceaux) ────────────────────────────
// Phase 7.14 — extracted to src/app/screens/SetlistsScreen.jsx.
import SetlistsScreen from './app/screens/SetlistsScreen.jsx';

// Phase 7.14 — HomeScreen + SongSearchBar + SplashPopup + OnboardingWizard
// extracted to src/app/screens/HomeScreen.jsx (co-located car les 3 sub-
// components ne servent qu'au HomeScreen).
import HomeScreen from './app/screens/HomeScreen.jsx';

// ─── ViewProfileScreen (lecture seule) ────────────────────────────────────────
function ViewProfileScreen({profile,onBack,onNavigate}){
  if(!profile) return null;
  // Phase 5 (Item E) : enabledDevices → drapeaux locaux (legacy
  // profile.devices supprimé en v6).
  const enabled=new Set(profile.enabledDevices||[]);
  const hasPedale=enabled.has('tonex-pedal')||enabled.has('tonex-anniversary');
  const edits=profile.editedGuitars||{};
  const guitars=GUITARS.filter(g=>(profile.myGuitars||[]).includes(g.id)).map(g=>({...g,...(edits[g.id]||{})}));
  const customG=profile.customGuitars||[];
  return(
    <div>
      <Breadcrumb crumbs={[{label:"Accueil",screen:"list"},{label:"Config de "+profile.name}]} onNavigate={onNavigate}/>
      <div style={{fontFamily:"var(--font-display)",fontSize:"var(--fs-lg)",fontWeight:800,color:"var(--text-primary)",marginBottom:4}}>👁 {profile.name}</div>
      <div style={{fontSize:12,color:"var(--text-muted)",marginBottom:16}}>Configuration en lecture seule</div>

      {/* Matériel */}
      <div style={{background:"var(--a4)",border:"1px solid var(--a8)",borderRadius:"var(--r-lg)",padding:12,marginBottom:10}}>
        <div style={{fontSize:12,fontWeight:700,color:"var(--text)",marginBottom:6}}>Matériel</div>
        <div style={{fontSize:11,color:"var(--text-sec)"}}>
          {d.pedale&&!d.anniversary&&"Pédale ToneX Standard"}
          {d.anniversary&&"Pédale ToneX Anniversary"}
          {hasPedale&&d.plug&&" + "}{d.plug&&"ToneX Plug"}
          {!hasPedale&&!d.plug&&"Aucun appareil configuré"}
        </div>
      </div>

      {/* Guitares */}
      <div style={{background:"var(--a4)",border:"1px solid var(--a8)",borderRadius:"var(--r-lg)",padding:12,marginBottom:10}}>
        <div style={{fontSize:12,fontWeight:700,color:"var(--text)",marginBottom:6}}>Guitares ({guitars.length+customG.length})</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
          {guitars.map(g=><span key={g.id} style={{fontSize:10,background:"var(--a5)",borderRadius:"var(--r-sm)",padding:"2px 8px",color:"var(--text-sec)"}}>{g.short} ({g.type})</span>)}
          {customG.map(g=><span key={g.id} style={{fontSize:10,background:"var(--a6)",borderRadius:"var(--r-sm)",padding:"2px 8px",color:"var(--text-bright)"}}>{g.short} ({g.type})</span>)}
        </div>
      </div>

      {/* Banques Pédale */}
      {hasPedale&&<div style={{background:"var(--a4)",border:"1px solid var(--a8)",borderRadius:"var(--r-lg)",padding:12,marginBottom:10}}>
        <div style={{fontSize:12,fontWeight:700,color:"var(--text)",marginBottom:6}}>Banques Pédale (50)</div>
        <div style={{maxHeight:200,overflowY:"auto"}}>
          {Object.entries(profile.banksAnn||{}).sort((a,b)=>Number(a[0])-Number(b[0])).map(([k,v])=>(
            v.A||v.B||v.C?<div key={k} style={{fontSize:10,color:"var(--text-sec)",marginBottom:2}}>
              <span style={{fontWeight:700,color:"var(--text-muted)",minWidth:20,display:"inline-block"}}>{k}</span>
              <span style={{color:CC.A}}>A:</span>{v.A||"—"} <span style={{color:CC.B}}>B:</span>{v.B||"—"} <span style={{color:CC.C}}>C:</span>{v.C||"—"}
            </div>:null
          ))}
        </div>
      </div>}

      {/* Banques Plug */}
      {d.plug&&<div style={{background:"var(--a4)",border:"1px solid var(--a8)",borderRadius:"var(--r-lg)",padding:12,marginBottom:10}}>
        <div style={{fontSize:12,fontWeight:700,color:"var(--text)",marginBottom:6}}>Banques Plug (10)</div>
        {Object.entries(profile.banksPlug||{}).sort((a,b)=>Number(a[0])-Number(b[0])).map(([k,v])=>(
          v.A||v.B||v.C?<div key={k} style={{fontSize:10,color:"var(--text-sec)",marginBottom:2}}>
            <span style={{fontWeight:700,color:"var(--text-muted)",minWidth:20,display:"inline-block"}}>{k}</span>
            <span style={{color:CC.A}}>A:</span>{v.A||"—"} <span style={{color:CC.B}}>B:</span>{v.B||"—"} <span style={{color:CC.C}}>C:</span>{v.C||"—"}
          </div>:null
        ))}
      </div>}

      <button onClick={onBack} style={{width:"100%",background:"var(--a5)",border:"1px solid var(--a10)",color:"var(--text-sec)",borderRadius:"var(--r-md)",padding:"10px",fontSize:13,cursor:"pointer",marginTop:8}}>Retour</button>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
// Fusionne les banks sauvées avec les banks initiales (ajoute les nouvelles sans écraser les modifs utilisateur)

function applySecrets(profiles){
  const secrets=loadSecrets();
  const result={...profiles};
  for(const [id,p] of Object.entries(result)){
    const s=secrets[id]||{};
    // Local secrets override Firestore only if they exist (non-empty)
    result[id]={...p,
      aiKeys:(s.aiKeys&&(s.aiKeys.gemini||s.aiKeys.anthropic))?s.aiKeys:(p.aiKeys||{anthropic:"",gemini:""}),
      password:s.password?s.password:(p.password||"")
    };
  }
  return result;
}

function App() {
  const saved = loadState();
  const [firestoreLoaded, setFirestoreLoaded] = useState(false);
  const initDefault = saved || {
    version:STATE_VERSION,
    activeProfileId:"sebastien",
    shared:{songDb:INIT_SONG_DB_META, theme:"dark", setlists:[{id:"sl_main",name:"Ma Setlist",songIds:INIT_SONG_DB_META.map(s=>s.id),profileIds:["sebastien"],lastModified:Date.now()}], toneNetPresets:[], deletedSetlistIds:{}, lastModified:Date.now()},
    profiles:{sebastien:makeDefaultProfile("sebastien","Sébastien",true)}
  };

  // Phase 5.7 — toast one-shot post-migration v6→v7 (cleanup doublons).
  // Lu une fois depuis initDefault, jamais persisté en state React. Le
  // champ `_migrationToast` disparaît naturellement au prochain save
  // légitime (l'objet `shared` reconstruit ci-dessous ne l'inclut pas).
  const initialMigrationToast = initDefault.shared?._migrationToast || null;

  // Shared state
  const [songDb,  setSongDb]  = useState(initDefault.shared.songDb);
  const [theme,   setTheme]   = useState(initDefault.shared.theme);
  const [setlists, setSetlistsRaw] = useState(initDefault.shared?.setlists || [{id:"sl_main",name:"Ma Setlist",songIds:INIT_SONG_DB_META.map(s=>s.id),profileIds:[initDefault.activeProfileId],lastModified:Date.now()}]);
  // Tombstones v7 : map {[setlistId]: timestamp}. Synchronisés via
  // Firestore pour que le poll/merge ne ressuscite pas une setlist
  // supprimée. Conversion défensive si la valeur initiale est encore
  // un array legacy (cas remote v6 stale).
  const [deletedSetlistIds, setDeletedSetlistIds] = useState(()=>{
    const cur = initDefault.shared?.deletedSetlistIds;
    if (Array.isArray(cur)) {
      const ts = Date.now() - 1000;
      const m = {};
      for (const id of cur) if (typeof id === "string") m[id] = ts;
      return m;
    }
    return cur && typeof cur === "object" ? cur : {};
  });
  // Wrapper qui (1) détecte les suppressions de setlists et écrit
  // tombstone {[id]: now} ; (2) stamp `lastModified = now` sur chaque
  // setlist modifiée (diff shallow length+name+profileIds+songIds).
  // Tous les écrans utilisent setSetlists comme avant.
  const setSetlists = (updater) => {
    setSetlistsRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!Array.isArray(next)) return next;
      const now = Date.now();
      const shallowHash = (sl) => {
        const pIds = Array.isArray(sl.profileIds) ? [...sl.profileIds].sort().join("+") : "";
        const sIds = Array.isArray(sl.songIds) ? [...sl.songIds].sort().join("+") : "";
        return `${(sl.songIds||[]).length}|${sl.name||""}|${pIds}|${sIds}`;
      };
      const prevById = new Map(prev.map(sl => [sl.id, sl]));
      const stamped = next.map(sl => {
        if (!sl || !sl.id) return sl;
        const prevSl = prevById.get(sl.id);
        if (!prevSl) return { ...sl, lastModified: now }; // nouveau
        if (shallowHash(prevSl) !== shallowHash(sl)) return { ...sl, lastModified: now };
        return sl;
      });
      const prevIds = new Set(prev.map(s=>s.id));
      const nextIds = new Set(stamped.map(s=>s.id));
      const removed = [...prevIds].filter(id=>!nextIds.has(id));
      if(removed.length) {
        setDeletedSetlistIds(d => {
          const out = { ...(d||{}) };
          for (const id of removed) out[id] = now;
          return out;
        });
      }
      return stamped;
    });
  };
  // Migrate custom guitars from profiles to shared (one-time)
  const [customGuitars, setCustomGuitars] = useState(()=>{
    const shared=initDefault.shared?.customGuitars||[];
    const migrated=[...shared];
    const existingIds=new Set(migrated.map(g=>g.id));
    for(const [,p] of Object.entries(initDefault.profiles||{})){
      (p.customGuitars||[]).forEach(g=>{if(!existingIds.has(g.id)){migrated.push(g);existingIds.add(g.id);}});
    }
    return migrated;
  });
  const [toneNetPresets, setToneNetPresets] = useState(initDefault.shared?.toneNetPresets || []);
  // Sync ToneNET presets to global lookup for findCatalogEntry
  useEffect(()=>{
    var lookup={};
    (toneNetPresets||[]).forEach(function(p){
      if(p.name) lookup[p.name]={src:"ToneNET",amp:p.amp||"ToneNET",gain:p.gain||"mid",style:p.style||"rock",scores:p.scores||{HB:75,SC:75,P90:75}};
    });
    window._toneNetLookup=lookup;
  },[toneNetPresets]);

  // Sync ToneNET presets into global catalog for scoring engine (useMemo = synchronous, runs before child useMemos)
  useMemo(()=>{
    for(const k of Object.keys(PRESET_CATALOG_MERGED)){if(PRESET_CATALOG_MERGED[k].src==="ToneNET")delete PRESET_CATALOG_MERGED[k];}
    (toneNetPresets||[]).forEach(p=>{
      if(!p.name) return;
      let amp=p.amp||"ToneNET";
      let style=p.style||"rock";
      if(amp==="ToneNET"||style==="rock"){
        const info=inferPresetInfo(p.name);
        if(info){if(amp==="ToneNET"&&info.amp) amp=info.amp;if(style==="rock"&&info.style&&info.style!=="rock") style=info.style;}
      }
      PRESET_CATALOG_MERGED[p.name]={src:"ToneNET",amp,gain:p.gain||"mid",style,channel:p.channel||"",cab:p.cab||"",comment:p.comment||"",scores:p.scores||{HB:75,SC:75,P90:75}};
    });
  },[toneNetPresets]);

  // Profiles state — merge banks + apply local secrets (aiKeys, passwords).
  // Phase 5.7 : ensureProfilesV7 chaîne v3→v4→v6→v7 (drop legacy devices
  // + stamp lastModified si manquant). Filet de sécurité au cas où
  // initDefault viendrait d'un état non migré (Firestore stale, etc.).
  const mergedProfiles = useMemo(()=>{
    const p=ensureProfilesV7({...initDefault.profiles});
    for(const [id,prof] of Object.entries(p)){
      p[id]={...prof, banksAnn:mergeBanks(prof.banksAnn,INIT_BANKS_ANN), banksPlug:mergeBanks(prof.banksPlug,INIT_BANKS_PLUG)};
    }
    return applySecrets(p);
  },[]);
  const [profiles, setProfiles] = useState(mergedProfiles);
  const [activeProfileId, setActiveProfileId] = useState(initDefault.activeProfileId);

  // Current profile (derived)
  const profile = profiles[activeProfileId] || Object.values(profiles)[0];

  // Publie availableSources du profil actif vers window pour que le scoring
  // (computeBestPresets / enrichAIResult) le lise sans qu'on doive le threader
  // dans tous les call-sites de fetchAI/enrichAIResult. Sync pendant le render
  // pour être disponible dès le premier appel (avant useEffect).
  if(typeof window!=="undefined") window.__activeSources=profile?.availableSources||null;

  // Per-profile convenience setters. Phase 5.7 : stamp profile.lastModified
  // au write pour permettre le LWW per-profile côté merge Firestore.
  const setProfileField = (field, value) => {
    setProfiles(p => {
      const cur = p[activeProfileId];
      if (!cur) return p;
      const resolved = typeof value === "function" ? value(cur[field]) : value;
      return {...p, [activeProfileId]: {...cur, [field]: resolved, lastModified: Date.now()}};
    });
  };
  const setBanksAnn  = v => setProfileField("banksAnn", v);
  const setBanksPlug = v => setProfileField("banksPlug", v);
  const setAiProvider= v => setProfileField("aiProvider", v);
  const setAiKeys    = v => setProfileField("aiKeys", v);

  // Phase 4 — override d'un patch factory TMP (scenes, footswitchMap…).
  // Stocké dans profile.tmpPatches.factoryOverrides[patchId]. Merge sur
  // l'éventuel override existant (ne supprime pas les autres champs).
  const onTmpPatchOverride = (patchId, partial) => {
    if(!patchId||!partial) return;
    setProfileField("tmpPatches", prev => {
      const cur = prev || { custom: [], factoryOverrides: {} };
      const fo = { ...(cur.factoryOverrides || {}) };
      fo[patchId] = { ...(fo[patchId] || {}), ...partial };
      return { ...cur, factoryOverrides: fo };
    });
  };

  // Guitars for current profile (with edits merged)
  const allGuitars = useMemo(()=>{
    const edits=profile.editedGuitars||{};
    const base = GUITARS.filter(g=>profile.myGuitars.includes(g.id)).map(g=>({...g,...(edits[g.id]||{})}));
    const customs=(customGuitars||[]).filter(g=>profile.myGuitars.includes(g.id));
    return [...base, ...customs];
  },[profile.myGuitars, customGuitars, profile.editedGuitars]);
  useEffect(()=>{window.__allGuitars=allGuitars;},[allGuitars]);

  // Phase 3.6 — Union all-rigs des guitares de TOUS les profils
  // (Sébastien + Arthur + Franck + …). Utilisé par le mécanisme passif
  // de re-fetch IA pour que cot_step2_guitars couvre la collection
  // complète de la famille, pas seulement le profil actif.
  const allRigsGuitars = useMemo(
    ()=>getAllRigsGuitars(profiles, customGuitars, GUITARS),
    [profiles, customGuitars],
  );

  // Phase 7.7 — Bias auto-dérivé des feedbacks (style → guitare préférée).
  // Soft hint injecté dans chaque fetchAI via le prompt. Recompute à chaque
  // mutation de songDb ou du rig. Pas persisté dans profile : la source de
  // vérité est song.feedback[] (déjà sync Firestore).
  const derivedGuitarBias = useMemo(
    ()=>computeGuitarBiasFromFeedback(songDb, allRigsGuitars),
    [songDb, allRigsGuitars],
  );

  // Phase 7.9 — Merge avec les overrides manuels (profile.guitarBias). Les
  // entries manuelles écrasent le auto-dérivé sur le même style. Source:
  // 'manual' marque les overrides, 'auto' les détectés. C'est cet objet qui
  // est passé partout (UI + prompt fetchAI), pas le auto brut.
  const effectiveGuitarBias = useMemo(
    ()=>mergeGuitarBias(derivedGuitarBias, profile?.guitarBias, allRigsGuitars),
    [derivedGuitarBias, profile?.guitarBias, allRigsGuitars],
  );

  // Non-persisted
  const [screen,  setScreen]  = useState("loading");
  const [checked, setChecked] = useState([]);
  const [synth,   setSynth]   = useState(null);
  const [syncStatus, setSyncStatus] = useState("idle");
  // lastSaveTime removed — echo detection now uses syncId
  const [viewProfileId, setViewProfileId] = useState(null);
  // Phase 4 — id de la setlist en cours de lecture en mode scène (live).
  // null = "tous les morceaux" (toute la base songDb si on lance live
  // depuis HomeScreen sans setlist active).
  const [liveSetlistId, setLiveSetlistId] = useState(null);

  // Destructure profile fields for convenience
  const {banksAnn, banksPlug, aiProvider, aiKeys, availableSources} = profile;
  // Filter setlists for current profile
  const mySetlists = setlists.filter(sl => !sl.profileIds || sl.profileIds.length === 0 || sl.profileIds.includes(activeProfileId));

  // Auto batch rescore: when guitars change or scoring version is outdated
  const guitarIds=allGuitars.map(g=>g.id).sort().join(",");
  const rescoreDone=React.useRef("");
  useEffect(()=>{
    var key=guitarIds+"_"+SCORING_VERSION;
    if(rescoreDone.current===key) return;
    if(!songDb?.length||!allGuitars?.length) return;
    var outdated=songDb.filter(s=>s.aiCache?.result?.cot_step1&&s.aiCache.sv!==SCORING_VERSION);
    if(!outdated.length){rescoreDone.current=key;return;}
    rescoreDone.current=key;
    console.log("[rescore] Batch rescore "+outdated.length+" morceaux");
    setSongDb(prev=>prev.map(s=>{
      if(!s.aiCache?.result?.cot_step1||s.aiCache.sv===SCORING_VERSION) return s;
      var gId=s.aiCache.gId;
      if(!gId) return s;
      var gType=findGuitar(gId)?.type||"HB";
      var cleaned={...s.aiCache.result,preset_ann:null,preset_plug:null,ideal_preset:null,ideal_preset_score:0,ideal_top3:null};
      var recalc=enrichAIResult(cleaned,gType,gId,banksAnn,banksPlug);
      return {...s,aiCache:{...updateAiCache(s.aiCache,gId,recalc),sv:SCORING_VERSION}};
    }));
  },[guitarIds]);

  // One-time migration: import Newzik setlists (idempotent per setlist name)
  // Phase 5.7.2 — Gate derrière firestoreLoaded + skip si Firestore a déjà
  // amené des setlists avec ces noms (Mac est source de vérité ; iPhone
  // fraîchement nettoyé doit recevoir les données via sync, pas re-courir
  // la migration). Le guard original (skip-if-exists-by-name+profileIds)
  // était cassé sur fresh local + Firestore async : la migration s'exécutait
  // AVANT que loadFromFirestore réponde, créant des doublons.
  useEffect(()=>{
    if(!firestoreLoaded) return;
    var LISTS={
      "Cours Franck B":[
        ["Play That Funky Music","Wild Cherry"],["I Got All You Need","Joe Bonamassa"],
        ["The Thrill Is Gone","B.B. King"],["Ticket to Ride","The Beatles"],
        ["You Shook Me All Night Long","AC/DC"],["Day Tripper","The Beatles"],
        ["Johnny B. Goode","Chuck Berry"],["Sarbacane","Francis Cabrel"],
        ["Immortels","Alain Bashung"],["Knockin' on Heaven's Door","Guns N' Roses"],
        ["Motherless Child","Eric Clapton"],["Come Together","The Beatles"],
        ["Crazy Little Thing Called Love","Queen"],["Satisfaction","The Rolling Stones"],
        ["Romeo and Juliet","Dire Straits"],["Tush","ZZ Top"],
        ["Devil Inside","INXS"],["Bohemian Rhapsody","Queen"],
        ["Should I Stay or Should I Go","The Clash"],["I've All I Need","Liam Gallagher"],
        ["The Power of Love","Huey Lewis and The News"],["Brothers in Arms","Dire Straits"],
        ["What's Up","4 Non Blondes"],["Thunderstruck","AC/DC"],
        ["Stairway to Heaven","Led Zeppelin"],["Walk of Life","Dire Straits"],
        ["Flipper","Téléphone"],["Hoochie Coochie Man","Muddy Waters"],
        ["Smoke on the Water","Deep Purple"],["Autumn Leaves","Standard Jazz"],
        ["Space Oddity","David Bowie"],["Heroes","David Bowie"],
        ["White Room","Cream"],["Still Loving You","Scorpions"],
        ["Another One Bites the Dust","Queen"],["Highway to Hell","AC/DC"],
        ["No Surprises","Radiohead"],["Paranoid","Black Sabbath"],
        ["Under Pressure","Queen"],["TNT","AC/DC"],
        ["Money for Nothing","Dire Straits"],["La Grange","ZZ Top"],
        ["Calling Elvis","Dire Straits"],["Sunshine of Your Love","Cream"],
        ["Black Magic Woman","Peter Green"]
      ],
      "Arthur & Seb":[
        ["Back in Black","AC/DC"],["Flipper","Téléphone"],
        ["Highway to Hell","AC/DC"],["Hoochie Coochie Man","Muddy Waters"],
        ["Money for Nothing","Dire Straits"],["Smoke on the Water","Deep Purple"],
        ["Stairway to Heaven","Led Zeppelin"],["The Thrill Is Gone","B.B. King"],
        ["Thunderstruck","AC/DC"],["TNT","AC/DC"],
        ["White Room","Cream"],["You Shook Me All Night Long","AC/DC"],
        ["Autumn Leaves","Standard Jazz"],["Black Magic Woman","Peter Green"],
        ["Bohemian Rhapsody","Queen"],["Calling Elvis","Dire Straits"],
        ["Come Together","The Beatles"],["Day Tripper","The Beatles"],
        ["Hells Bells","AC/DC"],["I Got All You Need","Joe Bonamassa"],
        ["Johnny B. Goode","Chuck Berry"],["Knockin' on Heaven's Door","Guns N' Roses"],
        ["La Grange","ZZ Top"],["Paranoid","Black Sabbath"],
        ["Sunshine of Your Love","Cream"],["Ticket to Ride","The Beatles"],
        ["Under Pressure","Queen"],["Walk of Life","Dire Straits"]
      ],
      "Nouvelle setlist":[
        ["Black Magic Woman","Peter Green"],["Sunshine of Your Love","Cream"],
        ["Calling Elvis","Dire Straits"],["La Grange","ZZ Top"],
        ["Smoke on the Water","Deep Purple"],["Space Oddity","David Bowie"],
        ["Paranoid","Black Sabbath"],["TNT","AC/DC"],
        ["Your Song","Elton John"],["Stairway to Heaven","Led Zeppelin"],
        ["Flipper","Téléphone"],["Walk of Life","Dire Straits"],
        ["Autumn Leaves","Standard Jazz"],["Hoochie Coochie Man","Muddy Waters"],
        ["Heroes","David Bowie"],["Under Pressure","Queen"],
        ["Money for Nothing","Dire Straits"],["No Surprises","Radiohead"],
        ["Highway to Hell","AC/DC"],["White Room","Cream"],
        ["Still Loving You","Scorpions"],["Thunderstruck","AC/DC"],
        ["I Got All You Need","Joe Bonamassa"],["Play That Funky Music","Wild Cherry"],
        ["Johnny B. Goode","Chuck Berry"],["Ticket to Ride","The Beatles"],
        ["What's Up","4 Non Blondes"],["Should I Stay or Should I Go","The Clash"],
        ["I've All I Need","Liam Gallagher"],["Bohemian Rhapsody","Queen"],
        ["Devil Inside","INXS"],["Tush","ZZ Top"],
        ["I Can't Dance","Genesis"],["Fly Me to the Moon","Frank Sinatra"],
        ["Sultans of Swing","Dire Straits"],["Self Esteem","The Offspring"],
        ["Change the World","The Offspring"],["Come Out and Play","The Offspring"],
        ["Don't Look Back in Anger","Oasis"],["Godfather Theme","Guns N' Roses"],
        ["La Javanaise","Serge Gainsbourg"],["Cocaine","Eric Clapton"],
        ["Paradise City","Guns N' Roses"],["Change the World","Eric Clapton"],
        ["Get Back","The Beatles"],["Let It Be","The Beatles"],
        ["Good Times","Chic"],["Wonderful Tonight","Eric Clapton"],
        ["Wicked Game","Chris Isaak"],["Wild World","Cat Stevens"],
        ["Viva la Vida","Coldplay"],["Wake Me Up","Avicii"],
        ["Tears in Heaven","Eric Clapton"],["While My Guitar Gently Weeps","The Beatles"],
        ["Sweet Child O' Mine","Guns N' Roses"],["Talking About a Revolution","Tracy Chapman"],
        ["Sweet Home Chicago","Robert Johnson"],["Sweet Home Alabama","Lynyrd Skynyrd"],
        ["Sunday Bloody Sunday","U2"],["Surf Rider","The Lively Ones"],
        ["Strong Enough","Sheryl Crow"],["Save Tonight","Eagle Eye Cherry"],
        ["Shape of My Heart","Sting"],["Something","The Beatles"],
        ["Jumping Jack Flash","The Rolling Stones"],["Message in a Bottle","The Police"],
        ["Every Breath You Take","The Police"],["Wish You Were Here","Pink Floyd"],
        ["Nothing Else Matters","Metallica"],["Motherless Child","Eric Clapton"],
        ["Minor Swing","Django Reinhardt"],["Knockin' on Heaven's Door","Guns N' Roses"],
        ["Master Blaster","Stevie Wonder"],["Is This Love","Bob Marley"],
        ["Hotel California","Eagles"],["Hallelujah","Leonard Cohen"],
        ["The Girl from Ipanema","Astrud Gilberto"],["Get Back","The Beatles"],
        ["Englishman in New York","Sting"],["Boom Boom","John Lee Hooker"],
        ["Dust in the Wind","Kansas"],["Get Lucky","Daft Punk"],
        ["Come Together","The Beatles"],["Layla","Eric Clapton"],
        ["C'est vraiment toi","Téléphone"],["Californication","Red Hot Chili Peppers"],
        ["Hallelujah","Jeff Buckley"],["Billie Jean","Michael Jackson"],
        ["Berimbau","Baden Powell"],["Here Comes the Sun","The Beatles"],
        ["Blackbird","The Beatles"],["Immortels","Alain Bashung"],
        ["Another One Bites the Dust","Queen"],["Angie","The Rolling Stones"],
        ["Alter Ego","Jean-Louis Aubert"],["A Horse with No Name","America"],
        ["Under the Bridge","Red Hot Chili Peppers"],["All Apologies","Nirvana"],
        ["California Dreamin'","The Mamas and the Papas"],["The Wind","Cat Stevens"],
        ["The Sound of Silence","Simon & Garfunkel"],["O Holy Night","Sufjan Stevens"],
        ["Sweet Virginia","The Rolling Stones"],["Father and Son","Cat Stevens"],
        ["Take Me Home Country Roads","John Denver"],["Ring of Fire","Johnny Cash"],
        ["Wish You Were Here","Pink Floyd"],["Simple Man","Lynyrd Skynyrd"]
      ]
    };
    var MERGE_INTO={"Nouvelle setlist":"Ma Setlist"};
    // FIX 4.1 B — fusion par (name, profileIds) au lieu de skip-on-name.
    // Si une setlist du même nom ET mêmes profileIds existe déjà, on la
    // détecte ici pour fusionner ses songIds plus bas (pas de doublon
    // créé). Le filter d'antan (skip-if-name-match) retournait quand
    // la setlist existait sans même fusionner les nouveaux morceaux ;
    // la nouvelle logique préserve l'idempotence du skip ET ajoute les
    // morceaux manquants.
    var sameProfileIds=function(a,b){
      var ax=Array.isArray(a)?[...a].sort().join("|"):"";
      var bx=Array.isArray(b)?[...b].sort().join("|"):"";
      return ax===bx;
    };
    var existingSetlistFor=function(slName){
      return setlists.find(function(sl){
        return sl.name===slName && sameProfileIds(sl.profileIds,[activeProfileId]);
      });
    };
    // Phase 5.7.2 — Helpers purs depuis core/state.js. Skip si une setlist
    // du même nom existe DÉJÀ (peu importe les profileIds). Si Firestore
    // a déjà ramené "Cours Franck B" ou "Arthur & Seb" (même partagée avec
    // d'autres profileIds), on considère la migration faite et on n'y
    // touche pas. Évite la création de doublons sur device fraîchement
    // reconnecté.
    var createNames=computeNewzikCreateNames(setlists,Object.keys(LISTS),MERGE_INTO);
    var mergeNames=computeNewzikMergeNames(setlists,MERGE_INTO);
    if(!createNames.length&&!mergeNames.length){
      console.log("[migration] Newzik migration skipped — setlists already present (Firestore sync or manual creation).");
      return;
    }
    var needed=[].concat(createNames,mergeNames);
    var newSongs=[];var songIdMap={};
    var allItems=[].concat(...needed.map(function(n){return LISTS[n];}));
    allItems.forEach(function([title,artist]){
      var key=title.toLowerCase()+"|||"+artist.toLowerCase();
      if(songIdMap[key]) return;
      var dup=findDuplicateSong(songDb,title,artist)||findDuplicateSong(newSongs,title,artist);
      if(dup){songIdMap[key]=dup.id;return;}
      var ns={id:"c_"+Date.now()+"_"+Math.random().toString(36).slice(2,6),title:title,artist:artist,isCustom:true,ig:[],aiCache:null};
      newSongs.push(ns);songIdMap[key]=ns.id;
    });
    if(newSongs.length) setSongDb(function(p){return p.concat(newSongs);});
    setSetlists(function(prev){
      var result=[...prev];
      var actuallyCreated=[];
      var actuallyMergedExisting=[];
      createNames.forEach(function(slName){
        var ids=LISTS[slName].map(function([t,a]){return songIdMap[t.toLowerCase()+"|||"+a.toLowerCase()];}).filter(Boolean);
        // FIX 4.1 B — fusion si setlist existante (même name + même
        // profileIds), sinon création.
        var existing=result.find(function(sl){
          return sl.name===slName && sameProfileIds(sl.profileIds,[activeProfileId]);
        });
        if(existing){
          var existingIds=new Set(existing.songIds||[]);
          var added=ids.filter(function(id){return !existingIds.has(id);});
          if(added.length){
            existing.songIds=(existing.songIds||[]).concat(added);
            actuallyMergedExisting.push(slName+" (+"+added.length+")");
          }
        }else{
          result.push({id:"sl_"+Date.now()+"_"+Math.random().toString(36).slice(2,8),name:slName,songIds:ids,profileIds:[activeProfileId]});
          actuallyCreated.push(slName);
        }
      });
      mergeNames.forEach(function(srcName){
        var targetName=MERGE_INTO[srcName];
        var target=result.find(function(sl){return sl.name===targetName;});
        if(!target) return;
        var ids=LISTS[srcName].map(function([t,a]){return songIdMap[t.toLowerCase()+"|||"+a.toLowerCase()];}).filter(Boolean);
        var existingIds=new Set(target.songIds);
        var merged=ids.filter(function(id){return !existingIds.has(id);});
        target.songIds=target.songIds.concat(merged);
        result=result.filter(function(sl){return sl.name!==srcName;});
      });
      return result;
    });
    console.log("[migration] Imported "+newSongs.length+" new songs. Created: "+createNames.join(", ")+". Merged into Ma Setlist: "+mergeNames.join(", "));
  },[firestoreLoaded]);

  // Save secrets (aiKeys, passwords) to separate localStorage key — never synced
  useEffect(()=>{
    const secrets={};
    for(const [id,p] of Object.entries(profiles)){
      secrets[id]={aiKeys:p.aiKeys||{anthropic:"",gemini:""},password:p.password||""};
    }
    saveSecrets(secrets);
  },[profiles]);

  // Phase 5.7.1 — mergeSongDb inline supprimé. Utilise désormais
  // `mergeSongDbPreservingLocalAiCache` de state.js, qui adopte
  // remote.* mais réinjecte local.aiCache si remote l'a stripped
  // (push light). Le state local localStorage conserve les aiCache
  // comme avant — seul le push Firestore les exclut.
  const mergeSongDb = mergeSongDbPreservingLocalAiCache;
  // Phase 5.7 — mergeSetlists inline supprimé. Le merge est désormais
  // last-write-wins par setlist via `mergeSetlistsLWW` (state.js), qui
  // arbitre sur `setlist.lastModified` et respecte les tombstones
  // `{[id]: ts}`. Voir applyRemoteData ci-dessous.

  // Normalise un tombstone potentiellement legacy (array remote
  // arrivant d'un client v6) en map {[id]: ts}.
  const normalizeTombstones = (raw) => {
    if (Array.isArray(raw)) {
      const ts = Date.now() - 1000;
      const m = {};
      for (const id of raw) if (typeof id === "string") m[id] = ts;
      return m;
    }
    return raw && typeof raw === "object" ? raw : {};
  };

  // Persist to localStorage (immediate) + Firestore (debounced 2s).
  // Phase 5.7 : `shared.lastModified` est le timestamp global de save
  // utilisé côté merge LWW. Le top-level `lastModified` est supprimé
  // (redondant avec shared.lastModified, plus simple côté arbitrage).
  // Phase 6.1 fix — Track le dernier shared.lastModified explicitement
  // setté par un setter (setSetlists wrapper qui stamp, etc.). Si pas de
  // stamp depuis dernière fois, on garde l'ancien lastModified. Évite
  // la boucle infinie de sync où chaque pull → push tire un nouveau
  // Date.now() même sans modif réelle.
  const hasMounted = useRef(false);
  const firestoreDebounceRef = useRef(null);
  // Phase 6.1 fix — Anti-boucle infinie de sync. On hash le contenu effectif
  // (sans timestamps) et on skip le push si rien n'a changé depuis le
  // dernier push. Sans ça, applyRemoteData → setSongDb → useEffect persist
  // → push même si le state pull == state local.
  const lastSharedModRef = useRef(Date.now());
  const lastSyncHashRef = useRef('');
  // Phase 6.1.3 fix — Flag "just pulled" pour éviter la boucle subtile :
  // pull adopte les 44 aiCaches manquants → syncHash change → useEffect
  // persist déclencherait un push → écrase Firestore avec le même contenu
  // (mais perspective locale). On set ce flag à applyRemoteData, on le
  // reset 3s après. Le useEffect persist skip pendant cette fenêtre.
  const justPulledRef = useRef(false);
  useEffect(()=>{
    // Hash léger : structure des setlists, profiles, customGuitars. Pas crypto,
    // mais discrimine les vraies modifs des re-sets identiques.
    // Phase 6.1.1 — Hash basé UNIQUEMENT sur les vraies données, pas
    // les timestamps. Les lastModified peuvent muter à chaque mergeLWW
    // sans qu'il y ait vraiment eu modif locale → cause boucle.
    const profileHash=Object.entries(profiles||{}).map(([id,p])=>
      id+":"+(p.myGuitars||[]).slice().sort().join(',')+":"+(p.customGuitars||[]).map(g=>g.id).slice().sort().join(',')+":"+JSON.stringify(p.availableSources||{})+":"+(p.enabledDevices||[]).slice().sort().join(',')+":"+(p.aiProvider||'')
    ).join('|');
    const syncHash=[
      (songDb||[]).map(s=>s.id+":"+(s.aiCache?.sv||0)+":"+(s.aiCache?.rigSnapshot||'')+":"+(s.aiCache?.gId||'')).join(','),
      (setlists||[]).map(s=>s.id+":"+(s.songIds||[]).slice().sort().join(',')+":"+(s.profileIds||[]).slice().sort().join(',')+":"+(s.name||'')).join('|'),
      (customGuitars||[]).map(g=>g.id).slice().sort().join(','),
      Object.keys(deletedSetlistIds||{}).slice().sort().join(','),
      profileHash,
      activeProfileId,
      theme,
    ].join('#');
    const shouldBump=syncHash!==lastSyncHashRef.current;
    if(shouldBump){
      lastSharedModRef.current=Date.now();
      lastSyncHashRef.current=syncHash;
    }
    const state={
      version:STATE_VERSION,
      activeProfileId,
      shared:{songDb,theme,setlists,customGuitars,toneNetPresets,deletedSetlistIds,lastModified:lastSharedModRef.current},
      profiles,
    };
    autoBackup();
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch(e){}
    if(!hasMounted.current){hasMounted.current=true;return;}
    if(!firestoreLoaded) return;
    // Phase 6.1.3 — si on vient juste de pull (justPulledRef=true), la
    // modif syncHash est due à l'adoption des données remote, pas à une
    // action user. Skip le push pour éviter d'écraser Firestore avec
    // notre perspective locale.
    if(justPulledRef.current){
      setSyncStatus("synced");
      return;
    }
    // Phase 6.1 fix — skip push si rien n'a réellement changé. shouldBump
    // est true seulement quand syncHash a changé (vraie modif locale).
    // Sans ce check, applyRemoteData re-déclenche un push à chaque pull.
    if(!shouldBump){
      // Toujours marquer "synced" pour ne pas laisser ⏳ infini.
      setSyncStatus("synced");
      return;
    }
    if(firestoreDebounceRef.current) clearTimeout(firestoreDebounceRef.current);
    setSyncStatus("syncing");
    firestoreDebounceRef.current = setTimeout(()=>{
      saveToFirestore(state).then(()=>setSyncStatus("synced")).catch(()=>setSyncStatus("error"));
    }, 2000);
    return ()=>{if(firestoreDebounceRef.current)clearTimeout(firestoreDebounceRef.current);};
  },[songDb,theme,setlists,customGuitars,toneNetPresets,deletedSetlistIds,profiles,activeProfileId,firestoreLoaded]);

  // Apply remote data into local state, using LWW per record (Phase 5.7).
  //  - songDb : union by id (mergeSongDb, hors scope LWW).
  //  - tombstones : union avec max(ts).
  //  - setlists : LWW per id via mergeSetlistsLWW + remap des ids
  //    dédupliqués par mergeSongDb.
  //  - profiles : LWW per id via mergeProfilesLWW (secrets locaux
  //    réappliqués sur les remote-adopted).
  const applyRemoteData = (data) => {
    if(!data||!data.shared) return;
    // Phase 6.1.3 — flag justPulled pour 3s. Le useEffect persist détecte
    // ça et skip le push, évitant l'écho infini pull → push → pull.
    justPulledRef.current=true;
    setTimeout(()=>{justPulledRef.current=false;},3000);
    var pollRemap={};
    if(data.shared.songDb) setSongDb(prev=>{
      const m=mergeSongDb(prev,data.shared.songDb);
      pollRemap=m._idRemap||{};
      if(m.length===prev.length&&m.every((s,i)=>s===prev[i]))return prev;
      return m;
    });
    if(data.shared.theme) setTheme(data.shared.theme);
    // Tombstones : merge LWW (union avec max ts), conversion défensive
    // si remote arrive en array legacy.
    const remoteDel=normalizeTombstones(data.shared.deletedSetlistIds);
    const mergedDel=mergeDeletedSetlistIds(deletedSetlistIds,remoteDel);
    if(JSON.stringify(mergedDel)!==JSON.stringify(deletedSetlistIds||{})){
      setDeletedSetlistIds(mergedDel);
    }
    if(data.shared.setlists) setSetlistsRaw(prev=>{
      var m=mergeSetlistsLWW(prev,data.shared.setlists,mergedDel);
      if(Object.keys(pollRemap).length>0){
        m=m.map(function(sl){var ids=(sl.songIds||[]).map(function(id){return pollRemap[id]||id;});return{...sl,songIds:[...new Set(ids)]};});
      }
      if(JSON.stringify(m)===JSON.stringify(prev))return prev;
      return m;
    });
    if(data.shared.customGuitars) setCustomGuitars(prev=>{
      if(JSON.stringify(data.shared.customGuitars)===JSON.stringify(prev))return prev;
      return data.shared.customGuitars;
    });
    if(data.shared.toneNetPresets) setToneNetPresets(prev=>{
      if(JSON.stringify(data.shared.toneNetPresets)===JSON.stringify(prev))return prev;
      return data.shared.toneNetPresets;
    });
    if(data.profiles) setProfiles(prev=>{
      // Phase 5.7 : LWW per-profile via profile.lastModified. Les
      // profils remote adoptés passent par applySecrets pour réinjecter
      // aiKeys/password locaux. ensureProfileV7 chaîne le heal v3→v7
      // (dont le drop legacy `devices` de la Phase 5.1).
      const next=mergeProfilesLWW(prev,data.profiles,{applySecrets});
      if(JSON.stringify(next)===JSON.stringify(prev))return prev;
      return next;
    });
    if(data.activeProfileId) setActiveProfileId(data.activeProfileId);
  };

  // Load from Firestore on first mount — merge with local using LWW.
  const [firestoreProfiles,setFirestoreProfiles]=useState(null);
  useEffect(()=>{
    loadSharedKey().then(()=>console.log("Shared key loaded")).catch(()=>{});
    loadFromFirestore().then(data=>{
      if(data&&data.shared){
        applyRemoteData(data);
        if(data.profiles) setFirestoreProfiles(data.profiles);
        // If local had more data, push merged result back.
        var remoteSongs=data.shared.songDb||[];
        var remoteSl=data.shared.setlists||[];
        var remoteDel=normalizeTombstones(data.shared.deletedSetlistIds);
        var mergedDel=mergeDeletedSetlistIds(deletedSetlistIds,remoteDel);
        var mergedSongs=mergeSongDb(songDb||[],remoteSongs);
        var mergedSl=mergeSetlistsLWW(setlists||[],remoteSl,mergedDel);
        // Remap duplicated song IDs in setlists
        var remap=mergedSongs._idRemap||{};
        if(Object.keys(remap).length>0){
          mergedSl=mergedSl.map(function(sl){
            var ids=(sl.songIds||[]).map(function(id){return remap[id]||id;});
            return {...sl,songIds:[...new Set(ids)]};
          });
        }
        // Phase 5.7.1 — push initial inconditionnel pour refresh
        // Firestore avec la version light (aiCache stripped). Sans ça,
        // si applyRemoteData ne change pas le state (cas no-op), le
        // persist effect ne push pas et Firestore reste avec un
        // payload >1 MB qui continue de renvoyer 400 à chaque save.
        var ps={
          version:STATE_VERSION,
          activeProfileId:data.activeProfileId||activeProfileId,
          shared:{
            songDb:mergedSongs,
            theme:data.shared.theme||theme,
            setlists:mergedSl,
            customGuitars:data.shared.customGuitars||customGuitars,
            deletedSetlistIds:mergedDel,
            lastModified:Date.now(),
          },
          profiles:mergeProfilesLWW(profiles,data.profiles||{},{applySecrets}),
        };
        saveToFirestore(ps).catch(function(){});
      }
      setFirestoreLoaded(true);
    }).catch(()=>setFirestoreLoaded(true));
  },[]);

  // Poll for remote changes every 5s (replaces onSnapshot — no SDK needed)
  useEffect(()=>{
    if(!firestoreLoaded) return;
    const iv=setInterval(()=>{
      pollRemoteSyncId().then(remoteSid=>{
        if(!remoteSid) return;
        // Skip our own saves
        if(remoteSid===_lastSavedSyncId) return;
        // Skip if nothing changed since last poll
        if(remoteSid===_lastRemoteSyncId) return;
        // New remote change detected — fetch full data
        loadFromFirestore().then(data=>{
          if(!data) return;
          applyRemoteData(data);
          setSyncStatus("synced");
        });
      });
    },5000);
    return ()=>clearInterval(iv);
  },[firestoreLoaded]);

  const recordLogin = id => {
    // Phase 5.7 : stamp lastModified pour que le LWW per-profile
    // adopte ce login côté Firestore.
    setProfiles(p=>{if(!p[id])return p;const h=(p[id].loginHistory||[]).slice();h.unshift(Date.now());if(h.length>5)h.length=5;return{...p,[id]:{...p[id],loginHistory:h,lastModified:Date.now()}};});
  };

  // Once Firestore loaded, decide initial screen
  const loginRecorded=useRef(false);
  useEffect(()=>{
    if(!firestoreLoaded||screen!=="loading") return;
    const allProfiles=firestoreProfiles||profiles;
    const profileCount=Object.keys(allProfiles).length;
    // Check if a session was active before reload
    const sessionProfile=sessionStorage.getItem("tonex_active_profile");
    if(sessionProfile&&allProfiles[sessionProfile]){
      setActiveProfileId(sessionProfile);recordLogin(sessionProfile);loginRecorded.current=true;setScreen("list");
    } else {
      // Check trusted devices — auto-login to remembered profile
      var trustedIds=Object.keys(allProfiles).filter(function(id){return isTrusted(id);});
      if(trustedIds.length===1&&allProfiles[trustedIds[0]]){
        var tid=trustedIds[0];
        setActiveProfileId(tid);sessionStorage.setItem("tonex_active_profile",tid);recordLogin(tid);loginRecorded.current=true;setScreen("list");
      } else if(profileCount>1){setScreen("pick");}
    else{recordLogin(activeProfileId);loginRecorded.current=true;setScreen("list");}
    }
  },[firestoreLoaded,firestoreProfiles]);

  // Reset on profile switch
  useEffect(()=>{if(screen!=="loading"){setChecked([]);setScreen("list");}},[activeProfileId]);

  // Phase 5.7 — Toast post-migration (lit une fois depuis loadState,
  // affiche, oublie). Le champ shared._migrationToast n'est jamais
  // copié dans le state React et disparaît au prochain save légitime.
  const [migrationToast,setMigrationToast]=useState(null);
  useEffect(()=>{
    if(initialMigrationToast&&initialMigrationToast.count>0){
      const c=initialMigrationToast.count;
      setMigrationToast(`Nettoyage initial : ${c} setlist${c>1?"s":""} doublon${c>1?"s":""} fusionnée${c>1?"s":""}`);
      const t=setTimeout(()=>setMigrationToast(null),5000);
      return ()=>clearTimeout(t);
    }
  },[]);

  // Phase 5.7 — GC défensif des tombstones au mount (purge entries
  // >30 jours). Si la map est modifiée, propage via setDeletedSetlistIds
  // pour que le clean soit persisté au prochain save.
  useEffect(()=>{
    const gced=gcTombstones(deletedSetlistIds);
    if(JSON.stringify(gced)!==JSON.stringify(deletedSetlistIds||{})){
      setDeletedSetlistIds(gced);
    }
  },[]);

  // Apply theme to document
  useEffect(()=>{
    document.documentElement.setAttribute("data-theme",theme);
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta) meta.content=theme==="dark"?"var(--bg)":"var(--cream-50)";
  },[theme]);
  const switchProfile = id => { if(profiles[id]){recordLogin(id);setActiveProfileId(id);sessionStorage.setItem("tonex_active_profile",id);} };
  const isAdmin = profile.isAdmin === true;
  const pickProfile = id => { recordLogin(id);setActiveProfileId(id);sessionStorage.setItem("tonex_active_profile",id); setScreen("list"); };
  const createAndPick = name => {
    const id=name.toLowerCase().replace(/[^a-z0-9]/g,"_")+`_${Date.now()}`;
    const np=makeDefaultProfile(id,name);
    setProfiles(p=>({...p,[id]:np}));
    setActiveProfileId(id);
    setScreen("list");
  };

  const songs=useMemo(()=>checked.map(id=>{
    const d=songDb.find(x=>x.id===id);
    return d?{...d}:{id,title:id,artist:"",isCustom:true,ig:[]};
  }),[checked,songDb]);

  const fullState={songDb,setlists,banksAnn,banksPlug};
  const onImportState=data=>{
    if(data.songDb)    setSongDb(data.songDb);
    if(data.setlists)  setSetlists(data.setlists);
    if(data.banksAnn)  setBanksAnn(data.banksAnn);
    if(data.banksPlug) setBanksPlug(data.banksPlug);
    setChecked([]);
    setScreen("list");
  };

  const [profileInitTab,setProfileInitTab]=useState(null);
  var headerProps={profiles:profiles,activeProfileId:activeProfileId,onProfile:function(){setProfileInitTab(null);setScreen("profile");},screen:screen,onNavigate:setScreen,isAdmin:isAdmin,syncStatus:syncStatus};
  var mainScreens=["list","setlists","explore","jam","optimizer","recap","synthesis","profile","settings","viewprofile","exportimport"];
  var showNav=mainScreens.includes(screen);

  if(screen==="loading") return <div className="page-root"><div style={{textAlign:"center",padding:"60px 20px"}}><div style={{marginBottom:16,display:"flex",justifyContent:"center"}}><BacklineIcon size={56} color="var(--brass-300)"/></div><div style={{fontFamily:"var(--font-display)",fontSize:"var(--fs-lg)",fontWeight:800,color:"var(--text-primary)"}}>{APP_NAME}</div><div style={{fontSize:13,color:"var(--text-muted)",marginTop:8}}>Chargement...</div></div></div>;
  if(screen==="pick") return <div className="page-root"><ProfilePickerScreen profiles={profiles} onPick={pickProfile}/></div>;

  // Phase 4 — mode scène plein écran. Le LiveScreen gère lui-même son
  // layout (pas d'AppHeader/AppNavBottom).
  if(screen==="live"){
    // FIX 4.1 A — fallback sur la liste complète si la setlist n'est
    // pas dans mySetlists (cas profil non-admin qui clique sur une
    // setlist partagée par un autre profil).
    const sl = liveSetlistId
      ? (mySetlists.find(s=>s.id===liveSetlistId) || setlists.find(s=>s.id===liveSetlistId))
      : null;
    const songIds = sl ? sl.songIds : songDb.map(s=>s.id);
    const liveSongs = songIds.map(id=>songDb.find(s=>s.id===id)).filter(Boolean);
    const liveDevices = getActiveDevicesForRender(profile);
    const exitToOrigin = ()=>{ setScreen(liveSetlistId ? "setlists" : "list"); };
    return <LiveScreen
      songs={liveSongs}
      profile={profile}
      allGuitars={allGuitars}
      banksAnn={banksAnn}
      banksPlug={banksPlug}
      availableSources={availableSources}
      enabledDevices={liveDevices}
      onExit={exitToOrigin}
      getGuitarForSong={(song)=>{
        const savedId = sl?.guitars?.[song.id];
        if(savedId) return allGuitars.find(g=>g.id===savedId)||null;
        const ig = getIg(song,allGuitars);
        return ig?.[0] ? allGuitars.find(g=>g.id===ig[0]) : null;
      }}
      onTmpPatchOverride={onTmpPatchOverride}
    />;
  }

  var screenContent=null;
  if(screen==="viewprofile"&&viewProfileId&&profiles[viewProfileId]) screenContent=<ViewProfileScreen profile={profiles[viewProfileId]} onBack={()=>setScreen("list")} onNavigate={setScreen}/>;
  else if(screen==="exportimport") screenContent=<ExportImportScreen banksAnn={banksAnn} onBanksAnn={setBanksAnn} banksPlug={banksPlug} onBanksPlug={setBanksPlug} onBack={()=>setScreen("settings")} onNavigate={setScreen} fullState={fullState} onImportState={onImportState}/>;
  else if(screen==="profile") screenContent=<MonProfilScreen songDb={songDb} onSongDb={setSongDb} setlists={mySetlists} allSetlists={setlists} onSetlists={setSetlists} onDeletedSetlistIds={setDeletedSetlistIds} banksAnn={banksAnn} onBanksAnn={setBanksAnn} banksPlug={banksPlug} onBanksPlug={setBanksPlug} onBack={()=>setScreen("list")} onNavigate={setScreen} aiProvider={aiProvider} onAiProvider={setAiProvider} aiKeys={aiKeys} onAiKeys={setAiKeys} theme={theme} onTheme={setTheme} profile={profile} profiles={profiles} onProfiles={setProfiles} activeProfileId={activeProfileId} allGuitars={allGuitars} allRigsGuitars={allRigsGuitars} guitarBias={effectiveGuitarBias} initTab={profileInitTab} customGuitars={customGuitars} onCustomGuitars={setCustomGuitars} toneNetPresets={toneNetPresets} onToneNetPresets={setToneNetPresets} fullState={fullState} onImportState={onImportState} onLogout={()=>{sessionStorage.removeItem("tonex_active_profile");setScreen("pick");}}/>;
  else if(screen==="settings") screenContent=<ParametresScreen onBack={()=>setScreen("list")} onNavigate={setScreen} aiProvider={aiProvider} onAiProvider={setAiProvider} aiKeys={aiKeys} onAiKeys={setAiKeys} profile={profile} profiles={profiles} onProfiles={setProfiles} activeProfileId={activeProfileId} fullState={fullState} onImportState={onImportState} banksAnn={banksAnn} onBanksAnn={setBanksAnn} banksPlug={banksPlug} onBanksPlug={setBanksPlug} songDb={songDb} onSongDb={setSongDb} setlists={setlists} onSetlists={setSetlists}/>;
  else if(screen==="setlists") screenContent=<SetlistsScreen songDb={songDb} onSongDb={setSongDb} setlists={mySetlists} allSetlists={setlists} onSetlists={setSetlists} checked={checked} onChecked={setChecked} onNext={()=>setScreen("recap")} onSettings={()=>setScreen("profile")} onNavigate={setScreen} banksAnn={banksAnn} onBanksAnn={setBanksAnn} banksPlug={banksPlug} onBanksPlug={setBanksPlug} aiProvider={aiProvider} aiKeys={aiKeys} allGuitars={allGuitars} allRigsGuitars={allRigsGuitars} guitarBias={effectiveGuitarBias} availableSources={availableSources} activeProfileId={activeProfileId} profiles={profiles} profile={profile} onTmpPatchOverride={onTmpPatchOverride} onLive={(slId)=>{setLiveSetlistId(slId||null);setScreen("live");}}/>;
  else if(screen==="jam") screenContent=<div><Breadcrumb crumbs={[{label:"Accueil",screen:"list"},{label:"Jammer"}]} onNavigate={setScreen}/><div style={{fontFamily:"var(--font-display)",fontSize:"var(--fs-lg)",fontWeight:800,color:"var(--text-primary)",marginBottom:16}}>🎲 Jammer</div><JamScreen banksAnn={banksAnn} banksPlug={banksPlug} allGuitars={allGuitars} availableSources={availableSources} profile={profile}/></div>;
  else if(screen==="explore") screenContent=<div><Breadcrumb crumbs={[{label:"Accueil",screen:"list"},{label:"Explorer"}]} onNavigate={setScreen}/><div style={{fontFamily:"var(--font-display)",fontSize:"var(--fs-lg)",fontWeight:800,color:"var(--text-primary)",marginBottom:16}}>🎛️ Explorer les presets</div><PresetBrowser banksAnn={banksAnn} banksPlug={banksPlug} availableSources={availableSources} customPacks={profile.customPacks} guitars={allGuitars} toneNetPresets={toneNetPresets}/></div>;
  else if(screen==="optimizer") screenContent=<BankOptimizerScreen songDb={songDb} setlists={mySetlists} banksAnn={banksAnn} onBanksAnn={setBanksAnn} banksPlug={banksPlug} onBanksPlug={setBanksPlug} allGuitars={allGuitars} availableSources={availableSources} onNavigate={setScreen} profile={profile}/>;
  else if(screen==="synthesis"&&synth) screenContent=<SynthesisScreen songs={songs} gps={synth.gps} aiR={synth.aiR} onBack={()=>setScreen("recap")} onNavigate={setScreen} songDb={songDb} banksAnn={banksAnn} banksPlug={banksPlug} allGuitars={allGuitars} availableSources={availableSources} profile={profile}/>;
  else if(screen==="recap") screenContent=<RecapScreen songs={songs} onBack={()=>setScreen("list")} onNavigate={setScreen} onValidate={(gps,aiR)=>{setSynth({gps,aiR});setScreen("synthesis");}} songDb={songDb} onSongDb={setSongDb} banksAnn={banksAnn} banksPlug={banksPlug} aiProvider={aiProvider} aiKeys={aiKeys} allGuitars={allGuitars} guitarBias={effectiveGuitarBias} availableSources={availableSources} profile={profile} onTmpPatchOverride={onTmpPatchOverride}/>;
  else screenContent=<HomeScreen songDb={songDb} onSongDb={setSongDb} setlists={mySetlists} allSetlists={setlists} onSetlists={setSetlists} checked={checked} onChecked={setChecked} onNext={()=>setScreen("recap")} onSettings={()=>setScreen("settings")} onProfile={(tab)=>{setProfileInitTab(tab||null);setScreen("profile");}} onSetlistScreen={()=>setScreen("setlists")} onJam={()=>setScreen("jam")} onExplore={()=>setScreen("explore")} onOptimizer={()=>setScreen("optimizer")} banksAnn={banksAnn} banksPlug={banksPlug} aiProvider={aiProvider} aiKeys={aiKeys} allGuitars={allGuitars} guitarBias={effectiveGuitarBias} availableSources={availableSources} profiles={profiles} activeProfileId={activeProfileId} onSwitchProfile={switchProfile} onProfiles={setProfiles} customPacks={profile.customPacks} syncStatus={syncStatus} onViewProfile={(id)=>{setViewProfileId(id);setScreen("viewprofile");}} onLogout={()=>{sessionStorage.removeItem("tonex_active_profile");setScreen("pick");}} onTmpPatchOverride={onTmpPatchOverride} onLive={(slId)=>{setLiveSetlistId(slId||null);setScreen("live");}}/>;

  return <div className="page-root">
    <AppHeader {...headerProps}/>
    {screenContent}
    {showNav&&<AppNavBottom screen={screen} onNavigate={setScreen}/>}
    {migrationToast&&<div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",background:"var(--brass)",color:"var(--ink)",padding:"10px 18px",borderRadius:"var(--r-md)",fontSize:13,fontWeight:600,zIndex:9999,boxShadow:"var(--shadow-md)",maxWidth:"90vw",textAlign:"center"}}>{migrationToast}</div>}
  </div>;
}

ReactDOM.render(<App/>, document.getElementById("root"));

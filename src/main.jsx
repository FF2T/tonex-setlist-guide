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
import { useLocale, t, bindActiveProfile, setProfileLanguageUpdater } from './i18n/index.js';
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
  applySecrets,
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

// Phase 7.22 — Firestore REST API extracted to src/app/utils/firestore.js.
import {
  saveToFirestore, loadFromFirestore, pollRemoteSyncId,
  loadSharedKey, saveSharedKey,
  getLastSavedSyncId, getLastRemoteSyncId,
  setNoSyncMode,
} from './app/utils/firestore.js';

// Phase 7.25 — Auto-activation du mode beta via URL param `?beta=1`.
// L'utilisateur reçoit un lien `https://ff2t.github.io/...?beta=1` →
// le mode local est activé AVANT toute initialisation Firestore (avant
// le mount de App), donc aucune donnée Sébastien/Arthur/Franck n'est
// pull. L'URL est nettoyée du param pour éviter la confusion.
if (typeof window !== 'undefined' && window.location && window.location.search) {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('beta') === '1') {
      setNoSyncMode(true);
      params.delete('beta');
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;
      window.history.replaceState({}, '', newUrl);
      console.log('[beta] Auto-activated no-sync mode via URL param. Local-only.');
    }
  } catch (e) { console.warn('[beta] URL param check failed:', e); }
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

// Phase 7.22 — badge helpers (srcBadge, presetSourceInfo, styleBadge,
// gainBadge) supprimés : dead code, plus aucune référence dans main.jsx
// post-découpage Phase 7.14+. JamScreen a son propre gainBadge inline.

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
const APP_VERSION = "8.14.50";
// Phase 7.26 — ADMIN_PIN supprimé : l'écran ⚙️ Paramètres était redondant
// avec Mon Profil → tabs admin (déjà gated sur profile.isAdmin). Tout
// l'admin passe désormais par Mon Profil, pas de PIN à mémoriser.


// Phase 7.18 — CSV/JSON helpers extracted to src/app/utils/csv-helpers.js.
import { exportJSON, generateCSV, downloadFile, parseCSV } from './app/utils/csv-helpers.js';


// ─── Composants UI ────────────────────────────────────────────────────────────
const s = (base) => ({...base});


// Phase 7.14 — GuitarSelect extracted to src/app/components/GuitarSelect.jsx.
import GuitarSelect from './app/components/GuitarSelect.jsx';

// ─── Breadcrumb ──────────────────────────────────────────────────────────────
// crumbs = [{label,screen},{label,screen},...,{label}]  — le dernier est l'écran courant (non cliquable)
// Phase 7.14 — StatusDot extracted to src/app/components/StatusDot.jsx.
import StatusDot from './app/components/StatusDot.jsx';


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

// Phase 7.18 — ExportImportScreen extracted to src/app/screens/ExportImportScreen.jsx.
import ExportImportScreen from './app/screens/ExportImportScreen.jsx';

// Phase 7.18 — Preset/Bank modals + editor extracted to src/app/components/.
import PresetSearchModal from './app/components/PresetSearchModal.jsx';
import FuzzyPresetMatch from './app/components/FuzzyPresetMatch.jsx';
import BankEditor from './app/components/BankEditor.jsx';

// Phase 7.18 — Profile picker/selector + couleur extracted.
import ProfilePickerScreen from './app/screens/ProfilePickerScreen.jsx';
import ProfileSelector from './app/components/ProfileSelector.jsx';
import { profileColor } from './app/components/profile-color.js';
import GuitarSearchAdd from './app/components/GuitarSearchAdd.jsx';


// Phase 7.19 — ProfileTab + PacksTab extracted to src/app/screens/.
import ProfileTab from './app/screens/ProfileTab.jsx';
import PacksTab from './app/screens/PacksTab.jsx';

// Phase 7.19 — MesAppareilsTab + ToneNetTab extracted to src/app/screens/.
// inferPresetInfo extracted to src/app/utils/infer-preset.js (réutilisé
// par PRESET_CATALOG_MERGED enrichment ci-dessous).
import MesAppareilsTab from './app/screens/MesAppareilsTab.jsx';
import ToneNetTab from './app/screens/ToneNetTab.jsx';
import { inferPresetInfo } from './app/utils/infer-preset.js';

// Phase 7.19 — MonProfilScreen extracted to src/app/screens/MonProfilScreen.jsx.
// MaintenanceTab reste dans main.jsx pour l'instant (passé en composant
// prop pour éviter une dépendance circulaire le temps de la séparation).
import MonProfilScreen from './app/screens/MonProfilScreen.jsx';

// Phase 7.26 — ParametresScreen retiré (redondant avec Mon Profil).

// Phase 7.19 — MaintenanceTab extracted to src/app/screens/MaintenanceTab.jsx.
import MaintenanceTab from './app/screens/MaintenanceTab.jsx';

// Phase 7.18 — ProfilesAdmin extracted to src/app/screens/ProfilesAdmin.jsx.
import ProfilesAdmin from './app/screens/ProfilesAdmin.jsx';

// ─── Modal Ajout Morceau + ListScreen ────────────────────────────────────────
// Phase 7.14 — extracted to src/app/components/AddSongModal.jsx
// + src/app/screens/ListScreen.jsx (InlineRenameInput co-localisé).
import AddSongModal from './app/components/AddSongModal.jsx';
import ListScreen from './app/screens/ListScreen.jsx';

// ─── Bank Optimizer Screen ───────────────────────────────────────────────────
// Phase 7.16 — extracted to src/app/screens/BankOptimizerScreen.jsx.
import BankOptimizerScreen from './app/screens/BankOptimizerScreen.jsx';

// ─── Recap Screen ─────────────────────────────────────────────────────────────
// Phase 7.14 — extracted to src/app/screens/RecapScreen.jsx.
import RecapScreen from './app/screens/RecapScreen.jsx';

// ─── Phase 7.17 : SynthesisScreen / PresetBrowser / JamScreen / ViewProfileScreen
// tous extraits vers src/app/screens/. Aussi : restauré getJamRecs qui
// avait été accidentellement supprimé au step 9 (Phase 7.14), maintenant
// co-localisé dans JamScreen.jsx. ViewProfileScreen avait un bug
// pré-existant (`d.X` non défini, hérité de Phase 5 Item E) — corrigé
// pendant l'extraction.
import SynthesisScreen from './app/screens/SynthesisScreen.jsx';
import PresetBrowser from './app/screens/PresetBrowser.jsx';
import JamScreen from './app/screens/JamScreen.jsx';
import ViewProfileScreen from './app/screens/ViewProfileScreen.jsx';
// Phase 7.14 — HomeScreen + SetlistsScreen extraits. Les imports étaient
// inline dans le range supprimé par le sed Phase 7.17 → restaurés ici.
import HomeScreen from './app/screens/HomeScreen.jsx';
import SetlistsScreen from './app/screens/SetlistsScreen.jsx';

// Phase 7.22 — AppHeader + AppNavBottom extracted.
import { AppHeader, AppNavBottom } from './app/components/AppHeader.jsx';

// Phase 7.23 — Newzik migration one-time extracted.
import { prepareNewzikMigration } from './app/utils/newzik-migration.js';

// ─── App ──────────────────────────────────────────────────────────────────────
// Fusionne les banks sauvées avec les banks initiales (ajoute les nouvelles sans écraser les modifs utilisateur)

function App() {
  // Re-render global de App à chaque setLocale() pour propager le
  // changement de langue à tout l'arbre. Phase 7.36 : aucune string
  // wrappée encore, donc l'effet visible est uniquement le sélecteur
  // dans Mon Profil → Affichage.
  useLocale();
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

  // Phase 7.49 — i18n per-profile : binder le profil actif et l'updater
  // de langue à chaque switch. setLocale() écrira directement dans
  // profile.language (via l'updater) au lieu du localStorage global seul.
  useEffect(() => { bindActiveProfile(profile); }, [profile?.id, profile?.language]);
  useEffect(() => {
    setProfileLanguageUpdater((loc) => {
      setProfiles((p) => {
        const cur = p[activeProfileId]; if (!cur) return p;
        if (cur.language === loc) return p;
        return { ...p, [activeProfileId]: { ...cur, language: loc, lastModified: Date.now() } };
      });
    });
    return () => setProfileLanguageUpdater(null);
  }, [activeProfileId]);

  // Publie availableSources du profil actif vers window pour que le scoring
  // (computeBestPresets / enrichAIResult) le lise sans qu'on doive le threader
  // dans tous les call-sites de fetchAI/enrichAIResult. Sync pendant le render
  // pour être disponible dès le premier appel (avant useEffect).
  if(typeof window!=="undefined") window.__activeSources=profile?.availableSources||null;

  // Phase 7.30 — Sync customPacks du profil actif dans PRESET_CATALOG_MERGED
  // pour que findCatalogEntry retourne la vraie metadata (amp/style/gain) des
  // captures user au lieu du fallback guessPresetInfo. Mirror du pattern
  // ToneNET (line ~423). Tourne aussi en useMemo synchrone pour être prêt
  // avant les child useMemos qui scorent les banks (computeBestPresets).
  // Évite que "Blink-182 Mesa Boggie" (capture Mesa Triple Rectifier) soit
  // interprété comme metadata fragile guessée depuis le mot "boogie".
  useMemo(()=>{
    for(const k of Object.keys(PRESET_CATALOG_MERGED)){
      if(PRESET_CATALOG_MERGED[k].src==="custom") delete PRESET_CATALOG_MERGED[k];
    }
    (profile?.customPacks||[]).forEach(pack=>{
      (pack.presets||[]).forEach(p=>{
        if(!p.name) return;
        PRESET_CATALOG_MERGED[p.name]={
          src:"custom",
          amp:p.amp||"Custom",
          gain:p.gain||"mid",
          style:p.style||"rock",
          channel:p.channel||"",
          pack:pack.name||"Custom Pack",
          scores:p.scores||{HB:75,SC:75,P90:75},
        };
      });
    });
  },[profile?.customPacks]);

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
  // Filter setlists for current profile.
  // Phase 7.42 — useMemo crucial : sans memo, mySetlists devient une
  // nouvelle ref à chaque render de App → invalide mySongIds → activeSongs
  // → songRowData → collapsedAiCBySongId qui recompute enrichAIResult
  // pour CHAQUE morceau (chacun itère PRESET_CATALOG_MERGED ~700 entries).
  // Pour 100+ morceaux × ~10ms = ~1s par re-render → 5s cumulés sur
  // plusieurs renders du mount = écran lent + timeout navigateur.
  const mySetlists = useMemo(
    () => setlists.filter(sl => !sl.profileIds || sl.profileIds.length === 0 || sl.profileIds.includes(activeProfileId)),
    [setlists, activeProfileId]
  );
  // Phase 7.29.5 — visibilité songDb : admin voit tout, non-admin voit
  // uniquement les morceaux présents dans au moins une de ses setlists.
  // null = pas de filtre (admin), Set = filtre actif (non-admin).
  const mySongIds = useMemo(() => {
    if (profile?.isAdmin === true) return null;
    const ids = new Set();
    for (const sl of mySetlists) for (const id of (sl.songIds || [])) ids.add(id);
    return ids;
  }, [profile?.isAdmin, mySetlists]);

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
    const result = prepareNewzikMigration(songDb, setlists, activeProfileId);
    if (!result) {
      console.log("[migration] Newzik migration skipped — setlists already present (Firestore sync or manual creation).");
      return;
    }
    if (result.newSongs.length) setSongDb((p) => p.concat(result.newSongs));
    setSetlists(result.setlistUpdater);
    console.log("[migration] Imported " + result.newSongs.length + " new songs. Created: " + result.createNames.join(", ") + ". Merged into Ma Setlist: " + result.mergeNames.join(", "));
  }, [firestoreLoaded]);


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
    // Phase 7.46 — Inclure tous les champs LWW qu'un user peut éditer
    // (banks, customPacks, editedGuitars, tmpPatches, recoMode,
    // guitarBias). Bug pré-7.46 : modifier les banks bumpe
    // profile.lastModified mais le hash skippait le push → banks
    // restaient en local, jamais propagées à Firestore. Un autre device
    // qui pushe son profil ensuite (avec lastModified plus récent par
    // login ou autre) écrasait ces banks fraîches via mergeProfilesLWW.
    // Les secrets (aiKeys, password) restent EXCLUS : stripés au push
    // dans saveToFirestore et réinjectés via applySecrets côté pull.
    const profileHash=Object.entries(profiles||{}).map(([id,p])=>
      id
      +":"+(p.myGuitars||[]).slice().sort().join(',')
      +":"+(p.customGuitars||[]).map(g=>g.id).slice().sort().join(',')
      +":"+JSON.stringify(p.availableSources||{})
      +":"+(p.enabledDevices||[]).slice().sort().join(',')
      +":"+(p.aiProvider||'')
      +":"+JSON.stringify(p.banksAnn||{})
      +":"+JSON.stringify(p.banksPlug||{})
      +":"+(p.customPacks||[]).map(pk=>(pk.name||'')+":"+((pk.presets||[]).map(pr=>pr.name||'').sort().join(','))).join('|')
      +":"+JSON.stringify(p.editedGuitars||{})
      +":"+JSON.stringify(p.tmpPatches||{})
      +":"+(p.recoMode||'')
      +":"+JSON.stringify(p.guitarBias||{})
      +":"+(p.language||'')                      // Phase 7.49 — i18n per-profile
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
        if(remoteSid===getLastSavedSyncId()) return;
        // Skip if nothing changed since last poll
        if(remoteSid===getLastRemoteSyncId()) return;
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
  var headerProps={profiles:profiles,activeProfileId:activeProfileId,onProfile:function(){setProfileInitTab(null);setScreen("profile");},screen:screen,onNavigate:setScreen,isAdmin:isAdmin,syncStatus:syncStatus,appVersion:APP_VERSION};
  var mainScreens=["list","setlists","explore","jam","optimizer","recap","synthesis","profile","viewprofile","exportimport"];
  var showNav=mainScreens.includes(screen);

  if(screen==="loading") return <div className="page-root"><div style={{textAlign:"center",padding:"60px 20px"}}><div style={{marginBottom:16,display:"flex",justifyContent:"center"}}><BacklineIcon size={56} color="var(--brass-300)"/></div><div style={{fontFamily:"var(--font-display)",fontSize:"var(--fs-lg)",fontWeight:800,color:"var(--text-primary)"}}>{APP_NAME}</div><div style={{fontSize:13,color:"var(--text-muted)",marginTop:8}}>{t("loading","Chargement...")}</div></div></div>;
  if(screen==="pick") return <div className="page-root"><ProfilePickerScreen profiles={profiles} onPick={pickProfile} appVersion={APP_VERSION} onUpgradePassword={(id,newHash)=>setProfiles(p=>({...p,[id]:{...p[id],password:newHash,lastModified:Date.now()}}))}/></div>;

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
  if(screen==="viewprofile"&&profile?.isAdmin&&viewProfileId&&profiles[viewProfileId]) screenContent=<ViewProfileScreen profile={profiles[viewProfileId]} onBack={()=>setScreen("list")} onNavigate={setScreen}/>;
  else if(screen==="exportimport") screenContent=<ExportImportScreen banksAnn={banksAnn} onBanksAnn={setBanksAnn} banksPlug={banksPlug} onBanksPlug={setBanksPlug} onBack={()=>setScreen("profile")} onNavigate={setScreen} fullState={fullState} onImportState={onImportState}/>;
  else if(screen==="profile") screenContent=<MonProfilScreen songDb={songDb} onSongDb={setSongDb} setlists={mySetlists} allSetlists={setlists} onSetlists={setSetlists} onDeletedSetlistIds={setDeletedSetlistIds} banksAnn={banksAnn} onBanksAnn={setBanksAnn} banksPlug={banksPlug} onBanksPlug={setBanksPlug} onBack={()=>setScreen("list")} onNavigate={setScreen} aiProvider={aiProvider} onAiProvider={setAiProvider} aiKeys={aiKeys} onAiKeys={setAiKeys} theme={theme} onTheme={setTheme} profile={profile} profiles={profiles} onProfiles={setProfiles} activeProfileId={activeProfileId} allGuitars={allGuitars} allRigsGuitars={allRigsGuitars} guitarBias={effectiveGuitarBias} initTab={profileInitTab} customGuitars={customGuitars} onCustomGuitars={setCustomGuitars} toneNetPresets={toneNetPresets} onToneNetPresets={setToneNetPresets} fullState={fullState} onImportState={onImportState} onLogout={()=>{sessionStorage.removeItem("tonex_active_profile");setScreen("pick");}} MaintenanceTabComponent={MaintenanceTab} onSaveSharedKey={saveSharedKey}/>;
  else if(screen==="setlists") screenContent=<SetlistsScreen songDb={songDb} onSongDb={setSongDb} setlists={mySetlists} allSetlists={setlists} onSetlists={setSetlists} mySongIds={mySongIds} checked={checked} onChecked={setChecked} onNext={()=>setScreen("recap")} onSettings={()=>setScreen("profile")} onNavigate={setScreen} banksAnn={banksAnn} onBanksAnn={setBanksAnn} banksPlug={banksPlug} onBanksPlug={setBanksPlug} aiProvider={aiProvider} aiKeys={aiKeys} allGuitars={allGuitars} allRigsGuitars={allRigsGuitars} guitarBias={effectiveGuitarBias} availableSources={availableSources} activeProfileId={activeProfileId} profiles={profiles} profile={profile} onTmpPatchOverride={onTmpPatchOverride} onLive={(slId)=>{setLiveSetlistId(slId||null);setScreen("live");}}/>;
  else if(screen==="jam") screenContent=<div><Breadcrumb crumbs={[{label:t("nav.home","Accueil"),screen:"list"},{label:t("nav.jam","Jammer")}]} onNavigate={setScreen}/><div style={{fontFamily:"var(--font-display)",fontSize:"var(--fs-lg)",fontWeight:800,color:"var(--text-primary)",marginBottom:16}}>{t("jam.page-title","🎲 Jammer")}</div><JamScreen banksAnn={banksAnn} banksPlug={banksPlug} allGuitars={allGuitars} availableSources={availableSources} profile={profile}/></div>;
  else if(screen==="explore") screenContent=<div><Breadcrumb crumbs={[{label:t("nav.home","Accueil"),screen:"list"},{label:t("nav.explore","Explorer")}]} onNavigate={setScreen}/><div style={{fontFamily:"var(--font-display)",fontSize:"var(--fs-lg)",fontWeight:800,color:"var(--text-primary)",marginBottom:16}}>{t("preset-browser.page-title","🎛️ Explorer les presets")}</div><PresetBrowser banksAnn={banksAnn} banksPlug={banksPlug} availableSources={availableSources} customPacks={profile.customPacks} guitars={allGuitars} toneNetPresets={toneNetPresets}/></div>;
  else if(screen==="optimizer"&&isAdmin) screenContent=<BankOptimizerScreen songDb={songDb} setlists={mySetlists} banksAnn={banksAnn} onBanksAnn={setBanksAnn} banksPlug={banksPlug} onBanksPlug={setBanksPlug} allGuitars={allGuitars} availableSources={availableSources} onNavigate={setScreen} profile={profile}/>;
  else if(screen==="synthesis"&&synth) screenContent=<SynthesisScreen songs={songs} gps={synth.gps} aiR={synth.aiR} onBack={()=>setScreen("recap")} onNavigate={setScreen} songDb={songDb} banksAnn={banksAnn} banksPlug={banksPlug} allGuitars={allGuitars} availableSources={availableSources} profile={profile}/>;
  else if(screen==="recap") screenContent=<RecapScreen songs={songs} onBack={()=>setScreen("list")} onNavigate={setScreen} onValidate={(gps,aiR)=>{setSynth({gps,aiR});setScreen("synthesis");}} songDb={songDb} onSongDb={setSongDb} banksAnn={banksAnn} banksPlug={banksPlug} aiProvider={aiProvider} aiKeys={aiKeys} allGuitars={allGuitars} guitarBias={effectiveGuitarBias} availableSources={availableSources} profile={profile} onTmpPatchOverride={onTmpPatchOverride}/>;
  else screenContent=<HomeScreen songDb={songDb} onSongDb={setSongDb} setlists={mySetlists} allSetlists={setlists} onSetlists={setSetlists} mySongIds={mySongIds} checked={checked} onChecked={setChecked} onNext={()=>setScreen("recap")} onSettings={()=>setScreen("profile")} onProfile={(tab)=>{setProfileInitTab(tab||null);setScreen("profile");}} onSetlistScreen={()=>setScreen("setlists")} onJam={()=>setScreen("jam")} onExplore={()=>setScreen("explore")} onOptimizer={()=>setScreen("optimizer")} banksAnn={banksAnn} banksPlug={banksPlug} aiProvider={aiProvider} aiKeys={aiKeys} allGuitars={allGuitars} guitarBias={effectiveGuitarBias} availableSources={availableSources} profiles={profiles} activeProfileId={activeProfileId} onSwitchProfile={switchProfile} onProfiles={setProfiles} customPacks={profile.customPacks} syncStatus={syncStatus} onViewProfile={(id)=>{setViewProfileId(id);setScreen("viewprofile");}} onLogout={()=>{sessionStorage.removeItem("tonex_active_profile");setScreen("pick");}} onTmpPatchOverride={onTmpPatchOverride} onLive={(slId)=>{setLiveSetlistId(slId||null);setScreen("live");}}/>;

  return <div className="page-root">
    <AppHeader {...headerProps}/>
    {screenContent}
    <AppFooter/>
    {showNav&&<AppNavBottom screen={screen} onNavigate={setScreen} isAdmin={isAdmin}/>}
    {migrationToast&&<div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",background:"var(--brass)",color:"var(--ink)",padding:"10px 18px",borderRadius:"var(--r-md)",fontSize:13,fontWeight:600,zIndex:9999,boxShadow:"var(--shadow-md)",maxWidth:"90vw",textAlign:"center"}}>{migrationToast}</div>}
  </div>;
}

ReactDOM.render(<App/>, document.getElementById("root"));

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

// Phase 7.74.5 — Wrapper console persistant pour observer en différé
// les logs du merge LWW Firestore. Survit aux reloads quand
// localStorage.__backline_persist_logs === 'true'. Idempotent + no-op
// si flag absent. À installer le plus tôt possible pour catch tous les
// logs au boot.
import { installPersistLogger } from './app/utils/merge-debug-logger.js';
installPersistLogger();

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
import { useLocale, t, bindActiveProfile, setProfileLanguageUpdater, getLocale, detectFreshLocale, forceDemoLocale } from './i18n/index.js';
import { INIT_SETLISTS } from './core/setlists.js';
import {
  PRESET_CATALOG_MERGED, findCatalogEntry, guessPresetInfo, normalizePresetName,
} from './core/catalog.js';
import { saveUsagesForPreset, removeUsagesOverride } from './core/preset-curation.js';
import { mergeUsagesOverridesLWW } from './core/usages-cascade.js';
import { setArtistsRuntimeState, mergeArtistsOverridesLWW } from './core/artists.js';
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
  mergeToneNetPresetsLWW, mergeDeletedToneNetIds,
  stripAiCacheForSync, mergeSongDbPreservingLocalAiCache,
  computeNewzikCreateNames, computeNewzikMergeNames,
  toggleSetlistProfile,
  ADMIN_ORIGIN_KEY, recordAdminSwitch, isAdminAsMode, appendLoginEntry,
  getDevicesForRender,
  loadState, saveState, persistState,
  autoBackup, listBackups, restoreBackup, clearBackups,
  loadSecrets, saveSecrets,
  loadTrusted, isTrusted, setTrusted,
  getAllRigsGuitars, computeGuitarBiasFromFeedback, mergeGuitarBias,
  dedupSetlists, dedupSetlistsWithTombstones, findSetlistDuplicatesByName,
  applySecrets,
  isDemoMode, isDemoProfile, loadDemoSnapshot, wrapDemoGuard,
  createManualSnapshot, listManualSnapshots, restoreManualSnapshot, deleteManualSnapshot,
  validateProfileGuitars, repairProfileGuitarsOrphans,
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
// Phase 7.60 — Gate la registration à PROD uniquement. En dev (Vite
// serve, hot reload), un SW déjà installé intercepte les fetchs Vite
// (paths différents du build prod) → erreurs "Failed to convert value
// to 'Response'" + écran noir. Le SW n'est utile que pour la PWA prod
// déployée (offline + stale-while-revalidate).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// Phase 7.22 — Firestore REST API extracted to src/app/utils/firestore.js.
import {
  saveToFirestore, loadFromFirestore, pollRemoteSyncId,
  loadSharedKey, saveSharedKey,
  getLastSavedSyncId, getLastRemoteSyncId,
  setNoSyncMode,
  setFirestoreDemoMode,
} from './app/utils/firestore.js';
import ToastDemoBlocked from './app/components/ToastDemoBlocked.jsx';
import DemoBanner from './app/components/DemoBanner.jsx';
import AdminAsBanner from './app/components/AdminAsBanner.jsx';

// Phase 7.25 — Auto-activation du mode beta via URL param `?beta=1`.
// L'utilisateur reçoit un lien `https://ff2t.github.io/...?beta=1` →
// le mode local est activé AVANT toute initialisation Firestore (avant
// le mount de App), donc aucune donnée Sébastien/Arthur/Franck n'est
// pull. L'URL est nettoyée du param pour éviter la confusion.
//
// Phase 7.51.3 — Auto-activation du mode démo via URL param `?demo=1`.
// Le snapshot bundlé (loadDemoSnapshot) est injecté in-memory dans le
// state initial de App (cf. useEffect mount). L'URL est nettoyée.
let _demoModeRequested = false;
// Phase 7.60 — Param `?thanks=1` posé par la redirection Tally après
// soumission du formulaire "demande accès beta". Le visiteur atterrit
// sur ThanksScreen (page de remerciement branded mybackline.app) au
// lieu d'être ramené sur tally.so/r/.../thanks générique.
let _thanksRequested = false;
// Phase 7.55-G — URL paramétrable `?demo=1&song=X&guitar=Y` pour
// pré-ouvrir une fiche song (et optionnellement pré-sélectionner une
// guitare). Permet à Sébastien de partager des liens cas studies
// précis ("Regarde Hotel California en mode démo").
let _demoPrefSongId = null;
let _demoPrefGuitarId = null;
if (typeof window !== 'undefined' && window.location && window.location.search) {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('beta') === '1') {
      setNoSyncMode(true);
      params.delete('beta');
    }
    if (params.get('thanks') === '1' || params.get('thanks') === 'true') {
      _thanksRequested = true;
      params.delete('thanks');
      console.log('[thanks] Auto-activated thanks screen via URL param.');
    }
    if (params.get('demo') === '1' || params.get('demo') === 'true') {
      _demoModeRequested = true;
      params.delete('demo');
      // Phase 7.55-G — capture les query params optionnels song/guitar
      // + expose sur window pour que HomeScreen puisse les consommer
      // après enterDemoMode (useEffect autoOpen).
      const sParam = params.get('song');
      if (sParam) {
        _demoPrefSongId = sParam;
        if (typeof window !== 'undefined') window._demoPrefSongId = sParam;
        params.delete('song');
      }
      const gParam = params.get('guitar');
      if (gParam) {
        _demoPrefGuitarId = gParam;
        if (typeof window !== 'undefined') window._demoPrefGuitarId = gParam;
        params.delete('guitar');
      }
      console.log('[demo] Auto-activated demo mode via URL param.',
        _demoPrefSongId ? `song=${_demoPrefSongId}` : '',
        _demoPrefGuitarId ? `guitar=${_demoPrefGuitarId}` : '');
    }
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;
    if (newUrl !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.replaceState({}, '', newUrl);
    }
  } catch (e) { console.warn('[url] Param check failed:', e); }
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
const APP_VERSION = "9.7.30";
// Phase 7.73.0 — expose pour le bouton feedback Tally (URL params).
if (typeof window !== 'undefined') window.__BACKLINE_APP_VERSION = APP_VERSION;
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
// Phase 7.60 — Landing publique pour first-time visitors.
import LandingScreen from './app/screens/LandingScreen.jsx';
// Phase 7.60 — Page de remerciement post-soumission Tally.
import ThanksScreen from './app/screens/ThanksScreen.jsx';
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
import AdminScreen from './app/screens/AdminScreen.jsx';

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

// ─── Phase 7.17 : PresetBrowser / JamScreen / ViewProfileScreen extraits
// vers src/app/screens/. getJamRecs co-localisé dans JamScreen.jsx.
// (RecapScreen + SynthesisScreen supprimés v9.7.4 — flow récap/synthèse
// devenu inaccessible depuis Phase 7.71 qui a retiré les checkboxes.)
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

// `export` ajouté pour permettre le test smoke-mount (main.smoke.test.jsx)
// d'importer { App } et de vérifier que le mount React ne throw pas
// (filet anti-régression contre les bugs runtime-only type TDZ — cf
// hotfix v8.14.156 écran noir).
export function App() {
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
    shared:{songDb:INIT_SONG_DB_META, theme:"dark", setlists:[{id:"sl_main",name:"Ma Setlist",songIds:INIT_SONG_DB_META.map(s=>s.id),profileIds:["sebastien"],lastModified:Date.now()}], toneNetPresets:[], deletedSetlistIds:{}, adminPacks:[], lastModified:Date.now()},
    profiles:{sebastien:makeDefaultProfile("sebastien","Sébastien",true)}
  };

  // Phase 5.7 — toast one-shot post-migration v6→v7 (cleanup doublons).
  // Lu une fois depuis initDefault, jamais persisté en state React. Le
  // champ `_migrationToast` disparaît naturellement au prochain save
  // légitime (l'objet `shared` reconstruit ci-dessous ne l'inclut pas).
  const initialMigrationToast = initDefault.shared?._migrationToast || null;

  // Shared state
  const [songDb,  _setSongDbRaw]  = useState(initDefault.shared.songDb);
  const [theme,   setTheme]   = useState(initDefault.shared.theme);
  const [setlists, setSetlistsRaw] = useState(initDefault.shared?.setlists || [{id:"sl_main",name:"Ma Setlist",songIds:INIT_SONG_DB_META.map(s=>s.id),profileIds:[initDefault.activeProfileId],lastModified:Date.now()}]);
  // Tombstones v7 : map {[setlistId]: timestamp}. Synchronisés via
  // Firestore pour que le poll/merge ne ressuscite pas une setlist
  // supprimée. Conversion défensive si la valeur initiale est encore
  // un array legacy (cas remote v6 stale).
  const [deletedSetlistIds, _setDeletedSetlistIdsRaw] = useState(()=>{
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
  // Phase 7.51.2 — wrapper composé en fonction inline. Le wrapper démo
  // démo en aval (setSetlists via useMemo) inclut _setSetlistsComposed
  // dans ses dépendances pour rester synchronisé.
  const _setSetlistsComposed = (updater) => {
    setSetlistsRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!Array.isArray(next)) return next;
      const now = Date.now();
      // Phase 7.54.2 — Hash COMPLET (tous champs sauf lastModified) pour
      // détecter TOUTE modif et stamper. Avant : shallowHash ne couvrait
      // que length+name+profileIds+songIds, donc modifs guitars/notes/
      // recoMode/etc. ne stampaient pas → merge LWW iPhone tiebreak
      // keep local (lastModified égal) → modifs Mac perdues. Bug observé
      // sur sélection guitare per-song qui ne propageait pas Mac→iPhone.
      const shallowHash = (sl) => {
        if (!sl) return '';
        const { lastModified: _lm, ...rest } = sl;
        try { return JSON.stringify(rest); } catch { return String(rest); }
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
  // Phase 7.53.2 — Tombstones ToneNET pour résoudre la résurrection
  // cross-device. Suppression UI dans ToneNetTab stamp `deletedToneNetIds[id]
  // = Date.now()`. Au merge LWW, item avec ts <= tombstone[id] est dropped
  // (cf src/core/state.js mergeToneNetPresetsLWW). GC 30j au boot via
  // _runFullChain (gcTombstones existant Phase 5.7).
  const [deletedToneNetIds, setDeletedToneNetIds] = useState(() => {
    const raw = initDefault.shared?.deletedToneNetIds;
    if (!raw || typeof raw !== 'object') return {};
    return gcTombstones(raw);
  });
  // Phase 7.69.7 — adminPacks : packs créés par l'admin via PacksTab
  // (import listing texte unzip -l). Stockés dans shared.* → visibles
  // par tous les profils via leur toggle Sources existant (TSR / AA /
  // ML / JS / TJ / WT / Galtone / ToneNET selon la source choisie).
  const [adminPacks, setAdminPacks] = useState(initDefault.shared?.adminPacks || []);
  // Phase 7.79.3b — shared.usagesOverrides : niveau 3 de la cascade
  // d'overrides d'usages (cf src/core/usages-cascade.js). Écrit par l'admin
  // depuis UsagesSection sur un catalog statique → visible par tous les
  // profils via la cascade. Sync Firestore en Phase 7.79.3c (merge per-item
  // LWW pattern Phase 7.53.1). Slot { [presetName]: { usages, lastModified } }.
  const [sharedUsagesOverrides, setSharedUsagesOverrides] = useState(initDefault.shared?.usagesOverrides || {});
  // Phase 7.79.3b — shared.studioUsages : niveau 2 de la cascade (slot Phase 11).
  // Non écrit par Backline V1 mais lu par findCatalogEntry pour préparer
  // le routing studio-driven (cf "Idées en attente" Phase 11).
  const [sharedStudioUsages, setSharedStudioUsages] = useState(initDefault.shared?.studioUsages || {});
  // Phase 13.4 — shared.artistsOverrides : admin edits runtime sur ARTISTS_SEED.
  // Slot { [artistId]: { artist: Artist|null, lastModified: number } }.
  // null = delete override (l'entry du seed reprend la main). Sync Firestore
  // via LWW per-item (pattern Phase 7.79.3).
  const [sharedArtistsOverrides, setSharedArtistsOverrides] = useState(initDefault.shared?.artistsOverrides || {});
  // Sync ToneNET presets to global lookup for findCatalogEntry
  useEffect(()=>{
    var lookup={};
    (toneNetPresets||[]).forEach(function(p){
      if(!p.name) return;
      const entry={src:"ToneNET",amp:p.amp||"ToneNET",gain:p.gain||"mid",style:p.style||"rock",scores:p.scores||{HB:75,SC:75,P90:75}};
      // Phase 7.53 — propage usages user-défini dans le fallback lookup.
      if(Array.isArray(p.usages)&&p.usages.length>0) entry.usages=p.usages;
      lookup[p.name]=entry;
    });
    window._toneNetLookup=lookup;
  },[toneNetPresets]);

  // Phase 7.79.3b — Sync de l'état cascade vers window._usagesCascadeState
  // utilisé par findCatalogEntry pour résoudre la cascade 4 niveaux.
  // ⚠ Bug v8.14.155 → fix v8.14.156 : ce useEffect a été déplacé APRÈS
  // la déclaration de `profile` (~ligne 580). Avant ça, le deps array
  // `[profile?.usagesOverrides, ...]` était évalué synchroneusement au
  // render avant que `const profile = ...` soit déclaré → ReferenceError
  // TDZ "Cannot access 'D' before initialization" → écran noir au mount.
  // Cf docs/CASCADE.md piège #2 (sync window state).

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
      // Phase 7.53 — Propage le champ `usages` user-défini dans le catalog
      // merge. Exploité par buildInstalledSlotsSection (prompt IA Phase
      // 7.52.1, PRIORITÉ 1) et findSlotByUsageMatch (Phase 7.52.5/.6).
      const entry={src:"ToneNET",amp,gain:p.gain||"mid",style,channel:p.channel||"",cab:p.cab||"",comment:p.comment||"",scores:p.scores||{HB:75,SC:75,P90:75}};
      if(Array.isArray(p.usages)&&p.usages.length>0) entry.usages=p.usages;
      PRESET_CATALOG_MERGED[p.name]=entry;
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
  const [profiles, _setProfilesRaw] = useState(mergedProfiles);
  const [activeProfileId, setActiveProfileId] = useState(initDefault.activeProfileId);

  // Current profile (derived)
  const profile = profiles[activeProfileId] || Object.values(profiles)[0];

  // Phase 7.79.3b (fix v8.14.156) — Sync window._usagesCascadeState pour
  // que findCatalogEntry résolve la cascade 4 niveaux. ⚠ DOIT être après
  // la déclaration `const profile = ...` ci-dessus (deps array évalué
  // synchroneusement au render → TDZ ReferenceError sinon).
  useEffect(()=>{
    if(typeof window==='undefined') return;
    window._usagesCascadeState = {
      profileOv: profile?.usagesOverrides || {},
      studioOv: sharedStudioUsages || {},
      backlineOv: sharedUsagesOverrides || {},
    };
  },[profile?.usagesOverrides, sharedStudioUsages, sharedUsagesOverrides]);

  // Phase 13.4 — Pose les overrides ARTISTS dans le module runtime à chaque
  // changement. setArtistsRuntimeState extrait .artist depuis chaque wrapper
  // { artist, lastModified } pour la cascade lookup côté getEffectiveArtistsMap.
  useEffect(()=>{ setArtistsRuntimeState(sharedArtistsOverrides); },[sharedArtistsOverrides]);

  // Phase 7.54 — Dérivation songDb avec aiCache résolu depuis le profil
  // actif. Pour chaque song, si profile.aiCache[song.id] existe → l'utiliser
  // en priorité, sinon fallback song.aiCache shared (rétro-compat Phase 3.6).
  // Permet aux 92+ sites de lecture de continuer à lire `song.aiCache`
  // sans changement. Les sites d'écriture utilisent `setSongAiCache` pour
  // écrire dans profile.aiCache (pas dans shared.songDb).
  const songDbWithProfileCache = useMemo(() => {
    const profCache = profile?.aiCache;
    if (!profCache || typeof profCache !== 'object') return songDb;
    return (songDb || []).map((s) => {
      if (!s || !s.id) return s;
      const profEntry = profCache[s.id];
      if (profEntry) return { ...s, aiCache: profEntry };
      return s; // fallback à song.aiCache shared (legacy)
    });
  }, [songDb, profile?.aiCache]);

  // Phase 7.54 — Setter aiCache per-profile. Écrit dans profile.aiCache[songId]
  // au lieu de shared.songDb[i].aiCache.
  // `value` peut être null pour invalider (mais on supprime l'entrée pour
  // éviter de polluer le state avec des nulls).
  //
  // Phase 7.74.9 — NE STAMP PLUS `lastModified`. Une écriture aiCache
  // (ouverture d'un morceau, rescore) n'est pas une « modification du
  // profil » au sens LWW per-field — elle se propage déjà via le merge
  // aiCache per-songId qui s'auto-arbitre via `ts` per-entry (Phase 7.81).
  // Stamper `lastModified` ici faisait gagner le LWW à tous les autres
  // champs (banks, language, sources, etc.) sans raison — c'était l'un
  // des amplificateurs structurels de la pollution profile (cf
  // INVESTIGATION_POLLUTION_PROFILE.md Session 3).
  //
  // Le syncHash inclut profile.aiCache (Phase 7.46) donc une nouvelle
  // entrée aiCache déclenche bien un push Firestore sans avoir besoin de
  // toucher lastModified. Le merge aiCache dans mergeProfileLWW est
  // appliqué dans les DEUX branches (rts > lts ET rts <= lts) pour que
  // les nouvelles analyses descendent bien sur les autres devices même
  // quand lastModified n'a pas changé.
  const setSongAiCache = useCallback((songId, value) => {
    if (!songId || !activeProfileId) return;
    setProfiles((p) => {
      const cur = p[activeProfileId];
      if (!cur) return p;
      const prevCache = (cur.aiCache && typeof cur.aiCache === 'object') ? cur.aiCache : {};
      const nextCache = { ...prevCache };
      if (value === null || value === undefined) delete nextCache[songId];
      else nextCache[songId] = value;
      return { ...p, [activeProfileId]: { ...cur, aiCache: nextCache } };
    });
  }, [activeProfileId]);

  // Phase 7.51.2 — Demo guard runtime.
  // isDemo dérivé du profil actif. Quand true, tous les setters wrappés
  // ci-dessous deviennent no-op + déclenchent un toast non-intrusif.
  // Le ref isDemoRef sert au passage du flag dans des contextes qui
  // n'ont pas accès au state React (ex : i18n module).
  const isDemo = useMemo(() => isDemoMode({ profiles }, activeProfileId), [profiles, activeProfileId]);
  const [demoToastMsg, setDemoToastMsg] = useState(null);
  const showDemoToast = useCallback(() => {
    setDemoToastMsg(t('demo.blocked', 'Action désactivée en mode démo'));
  }, []);

  // Wrappers démo : si isDemo=false, retournent le setter Raw identité.
  // Si isDemo=true, retournent un no-op qui appelle showDemoToast.
  // Les useMemo recapturent _setSetlistsComposed à chaque render (il est
  // recréé inline) pour garder le wrapper synchronisé. Pour les setters
  // useState bruts (stables), pas besoin en deps.
  const setSongDb = useMemo(() => wrapDemoGuard(_setSongDbRaw, isDemo, showDemoToast, 'songDb'), [isDemo, showDemoToast]); // eslint-disable-line react-hooks/exhaustive-deps
  const setDeletedSetlistIds = useMemo(() => wrapDemoGuard(_setDeletedSetlistIdsRaw, isDemo, showDemoToast, 'deletedSetlistIds'), [isDemo, showDemoToast]); // eslint-disable-line react-hooks/exhaustive-deps
  const setProfiles = useMemo(() => wrapDemoGuard(_setProfilesRaw, isDemo, showDemoToast, 'profile'), [isDemo, showDemoToast]); // eslint-disable-line react-hooks/exhaustive-deps
  const setSetlists = useMemo(() => wrapDemoGuard(_setSetlistsComposed, isDemo, showDemoToast, 'setlists'), [isDemo, showDemoToast, _setSetlistsComposed]);

  // Phase 7.51.2 — Bind module Firestore au flag démo (early-return des
  // appels save/load/poll/sharedKey). Symétrique à isNoSyncMode Phase 7.24.
  useEffect(() => { setFirestoreDemoMode(isDemo); }, [isDemo]);

  // Phase 7.51.3 — enterDemoMode : entre dans le mode démo via la carte
  // ProfilePicker ou l'URL ?demo=1. Ajoute le profil démo aux profils
  // existants (non-destructif) + injecte ses setlists et songs + bascule
  // sur activeProfileId='demo'. Le useEffect persist Phase 7.51.3 skip
  // localStorage tant qu'isDemo est true → aucune trace au reload.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const enterDemoMode = useCallback(() => {
    const snap = loadDemoSnapshot();
    if (!snap || !snap.profile) { console.warn('[demo] Snapshot invalide'); return; }
    // Phase 7.82.1 — Bug #0 (suite Phase 7.82) : Phase 7.82 utilisait
    // getLocale() qui pouvait retourner _cachedLocale figé au boot
    // (LandingScreen rendu avant que le visiteur ait choisi sa langue).
    // detectFreshLocale() re-lit localStorage + navigator.language
    // directement, bypass cache. forceDemoLocale() bascule l'i18n module
    // (_cachedLocale + _activeProfileLanguage + clear memo + notify
    // listeners) AVANT le re-render React, pour que les composants
    // déjà mounted reflètent le bon locale immédiatement (sinon
    // bindActiveProfile ne se déclenche qu'au re-render suivant et la
    // modale d'intro SplashPopup peut flash en FR).
    const currentLocale = detectFreshLocale();
    forceDemoLocale(currentLocale);
    const demoProfile = { ...snap.profile, language: currentLocale };
    _setProfilesRaw(prev => ({ ...prev, [demoProfile.id]: demoProfile }));
    // Phase 7.52.14 — FORCE l'override par id : si une setlist du snapshot
    // a le même id qu'une setlist existante en local (héritage historique
    // du curateur), on remplace par la version snapshot fraîche. Sans
    // ça (Phase 7.51.3 original), le filter `!existingIds.has` skip
    // l'ajout → le snapshot frais ne s'applique jamais → mode démo
    // affiche une Demo Setlist polluée (profileIds=['sebastien'] etc.)
    // au lieu de la version curée (profileIds=['demo']).
    // Phase 7.52.18 — Merge profileIds au lieu de remplacement bloc.
    // Si une setlist locale existe avec le même id, on adopte la version
    // snapshot MAIS on conserve les profileIds locaux qui n'étaient pas
    // dans le snapshot. Défense ultime contre un snapshot externe importé
    // manuellement qui aurait profileIds=['demo'] seul et qui écraserait
    // le curateur. Phase 7.52.16 force déjà profileIds=['demo', origId] à
    // l'export, mais snapshots historiques ou imports manuels peuvent
    // bypass.
    setSetlistsRaw(prev => {
      const snapById = new Map((snap.setlists || []).map(s => [s.id, s]));
      const result = [];
      const seenSnapIds = new Set();
      for (const local of (prev || [])) {
        if (!local || !local.id) continue;
        const snapVer = snapById.get(local.id);
        if (snapVer) {
          seenSnapIds.add(local.id);
          // Union profileIds (snapshot + local, dédupliqué)
          const mergedIds = Array.from(new Set([
            ...(Array.isArray(snapVer.profileIds) ? snapVer.profileIds : []),
            ...(Array.isArray(local.profileIds) ? local.profileIds : []),
          ]));
          result.push({ ...snapVer, profileIds: mergedIds });
        } else {
          result.push(local);
        }
      }
      // Snapshot-only setlists (jamais existées en local)
      for (const snapSl of (snap.setlists || [])) {
        if (!seenSnapIds.has(snapSl.id)) result.push(snapSl);
      }
      return result;
    });
    _setSongDbRaw(prev => {
      const snapIds = new Set((snap.songs || []).map(s => s.id));
      const kept = (prev || []).filter(s => !snapIds.has(s.id));
      return [...kept, ...(snap.songs || [])];
    });
    setActiveProfileId(demoProfile.id);
    setScreen('list');
    console.log('[demo] Entered demo mode with snapshot', { setlists: snap.setlists?.length || 0, songs: snap.songs?.length || 0, locale: currentLocale });
  }, []);

  // Phase 7.49 — i18n per-profile : binder le profil actif et l'updater
  // de langue à chaque switch. setLocale() écrira directement dans
  // profile.language (via l'updater) au lieu du localStorage global seul.
  // Phase 7.51.2 — bindActiveProfile détecte aussi isDemo pour skip
  // l'updater profile.language en mode démo (cf. i18n/index.js).
  useEffect(() => { bindActiveProfile(profile); }, [profile?.id, profile?.language, profile?.isDemo]);
  useEffect(() => {
    setProfileLanguageUpdater((loc) => {
      setProfiles((p) => {
        const cur = p[activeProfileId]; if (!cur) return p;
        if (cur.language === loc) return p;
        // Phase 7.74.10 — stamp `languageModified` en plus du `lastModified`
        // global. Le merge LWW utilise ce timestamp dédié pour décider
        // d'adopter ou non la langue remote, sans se laisser piéger par
        // un `lastModified` global gonflé par une autre écriture.
        const now = Date.now();
        return { ...p, [activeProfileId]: { ...cur, language: loc, lastModified: now, languageModified: now } };
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
  //
  // Phase 7.65.x — Recopie aussi `usages` (champ optionnel ajouté quand
  // l'utilisateur tague son custom avec un artiste/morceau spécifique).
  // Sans ce champ, `findCatalogEntry("Kirk & James - Gasoline v2")` retournait
  // metadata sans usages → `buildInstalledSlotsSection` n'envoyait pas
  // l'info au prompt IA et `findSlotByUsageMatch` ne matchait pas. Le pin
  // ne fonctionnait que pour les customs dont le NOM contenait l'artiste
  // littéralement (Blink-182, Dr. Stein) via PRIORITÉ 2 du prompt.
  // Phase 7.69 — `src` toujours "custom" pour TOUS les presets persos
  // (peu importe la provenance déclarée par le user : TSR, AA, ToneNET,
  // etc.). Décision UX : 1 seul toggle dans Sources ("Mes presets custom")
  // active/désactive TOUS les presets persos. Le champ `creator` séparé
  // garde la provenance informative (label sur le badge) sans affecter
  // le filtrage isSourceAvailable.
  //
  // Migration silencieuse : si un preset legacy avait p.src = "AA"
  // (Phase 7.67), on récupère cette valeur dans `creator` et on force
  // `src: "custom"`. Pas de bump STATE_VERSION (additif, idempotent).
  useMemo(()=>{
    for(const k of Object.keys(PRESET_CATALOG_MERGED)){
      if(PRESET_CATALOG_MERGED[k].src==="custom") delete PRESET_CATALOG_MERGED[k];
    }
    (profile?.customPacks||[]).forEach(pack=>{
      (pack.presets||[]).forEach(p=>{
        if(!p.name) return;
        const entry={
          src:"custom",
          // Phase 7.69 — creator informatif (TSR/AA/JS/TJ/ML/WT/Galtone/
          // ToneNET/Custom maison/Autre). Préservation du legacy p.src
          // si différent de "custom" (Phase 7.67 stockait la provenance
          // dans src). Sinon p.creator explicit (saisi dans le form).
          creator:p.creator||(p.src&&p.src!=="custom"?p.src:""),
          amp:p.amp||"Custom",
          gain:p.gain||"mid",
          style:p.style||"rock",
          channel:p.channel||"",
          pack:pack.name||"Custom Pack",
          scores:p.scores||{HB:75,SC:75,P90:75},
        };
        // Phase 7.65.x : ajout conditionnel pour ne pas polluer le catalog
        // avec un champ vide quand le user n'a pas tagué d'usages.
        if(Array.isArray(p.usages) && p.usages.length>0) entry.usages=p.usages;
        PRESET_CATALOG_MERGED[p.name]=entry;
      });
    });
  },[profile?.customPacks]);

  // Phase 7.69.7 — Sync adminPacks dans PRESET_CATALOG_MERGED.
  // Pattern identique customPacks mais lecture depuis shared.adminPacks
  // (visible à tous les profils). Chaque preset prend src = pack.source
  // (SOURCE_ID standard : TSR, AA, JS, TJ, ML, WT, Galtone, ToneNET ou
  // custom). Le toggle Sources existant du user contrôle l'inclusion.
  // Marqueur interne `adminPack: true` + `pack: pack.name` pour
  // traçabilité (debug + UI).
  useMemo(()=>{
    // Clean : retire d'abord les entries marquées adminPack: true (pour
    // gérer suppression/édition).
    for(const k of Object.keys(PRESET_CATALOG_MERGED)){
      if(PRESET_CATALOG_MERGED[k].adminPack) delete PRESET_CATALOG_MERGED[k];
    }
    (adminPacks||[]).forEach(pack=>{
      const src = pack.source || 'custom';
      (pack.presets||[]).forEach(p=>{
        if(!p.name) return;
        const entry={
          src,
          adminPack:true,
          creator:p.creator||'',
          amp:p.amp||'Unknown',
          gain:p.gain||'mid',
          style:p.style||'rock',
          channel:p.channel||'',
          pack:pack.name||'Admin Pack',
          scores:p.scores||{HB:75,SC:75,P90:75},
        };
        if(Array.isArray(p.usages) && p.usages.length>0) entry.usages=p.usages;
        PRESET_CATALOG_MERGED[p.name]=entry;
      });
    });
  },[adminPacks]);

  // Per-profile convenience setters. Phase 5.7 : stamp profile.lastModified
  // au write pour permettre le LWW per-profile côté merge Firestore.
  // Phase 7.74.9 — stamp aussi `banksModified` quand banksAnn/banksPlug
  // sont modifiés. Le merge LWW utilise ce timestamp dédié pour décider
  // d'adopter ou non les banks remote, sans se laisser piéger par un
  // `lastModified` global gonflé par une autre écriture.
  // Phase 7.74.10 — étend le pattern aux champs language / enabledDevices /
  // availableSources via leurs timestamps dédiés respectifs.
  const setProfileField = (field, value) => {
    setProfiles(p => {
      const cur = p[activeProfileId];
      if (!cur) return p;
      const resolved = typeof value === "function" ? value(cur[field]) : value;
      const now = Date.now();
      const next = {...cur, [field]: resolved, lastModified: now};
      if (field === 'banksAnn' || field === 'banksPlug') {
        next.banksModified = now;
      } else if (field === 'language') {
        next.languageModified = now;
      } else if (field === 'enabledDevices') {
        next.enabledDevicesModified = now;
      } else if (field === 'availableSources') {
        next.availableSourcesModified = now;
      } else if (field === 'myGuitars') {
        // Phase 7.74.12 — stamp dédié myGuitars pour LWW per-field.
        next.myGuitarsModified = now;
      }
      return {...p, [activeProfileId]: next};
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

  // Phase 8.7 — Pattern parallèle pour basses + amplis basse : expose
  // sur window le combiné catalog + profile.customBasses pour que
  // findBass / findBassAmp puissent les résoudre (fallback window).
  useEffect(()=>{
    window.__allBasses=[...(profile.customBasses||[])];
    window.__allBassAmps=[...(profile.customBassAmps||[])];
  },[profile.customBasses, profile.customBassAmps]);

  // Phase A — Amplis guitare traditionnels custom (parallèle aux amplis basse).
  useEffect(()=>{
    window.__allGuitarAmps=[...(profile.customGuitarAmps||[])];
  },[profile.customGuitarAmps]);

  // Phase C — Pédales custom (résolution findPedal via window.__allPedals).
  useEffect(()=>{
    window.__allPedals=[...(profile.customPedals||[])];
  },[profile.customPedals]);

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
  const [syncStatus, setSyncStatus] = useState("idle");
  // lastSaveTime removed — echo detection now uses syncId
  const [viewProfileId, setViewProfileId] = useState(null);
  // Phase 4 — id de la setlist en cours de lecture en mode scène (live).
  // null = "tous les morceaux" (toute la base songDb si on lance live
  // depuis HomeScreen sans setlist active).
  const [liveSetlistId, setLiveSetlistId] = useState(null);

  // Destructure profile fields for convenience
  const {banksAnn, banksPlug, aiProvider: rawAiProvider, aiKeys, availableSources} = profile;
  // S9.11 — Auto-fallback Anthropic pour admin si clé Anthropic configurée.
  // Sébastien admin peut éviter de cramer le quota Gemini partagé sans
  // toucher au comportement des beta-testeurs (qui n'ont pas la clé
  // Anthropic et donc tombent toujours sur Gemini partagée). Invisible
  // côté UI : pas de toggle, déterministe selon présence de la clé.
  // La clé Anthropic est strippée du push Firestore (Phase 7.30) →
  // elle reste sur le device Mac de Sébastien, jamais visible aux autres.
  const aiProvider = (profile?.isAdmin && aiKeys?.anthropic && String(aiKeys.anthropic).trim())
    ? 'anthropic'
    : (rawAiProvider || 'gemini');
  // Filter setlists for current profile.
  // Phase 7.42 — useMemo crucial : sans memo, mySetlists devient une
  // nouvelle ref à chaque render de App → invalide mySongIds → activeSongs
  // → songRowData → collapsedAiCBySongId qui recompute enrichAIResult
  // pour CHAQUE morceau (chacun itère PRESET_CATALOG_MERGED ~700 entries).
  // Pour 100+ morceaux × ~10ms = ~1s par re-render → 5s cumulés sur
  // plusieurs renders du mount = écran lent + timeout navigateur.
  // Phase 7.52.7 — En mode démo, filtre STRICT : seulement les setlists
  // dont profileIds inclut explicitement 'demo'. Sinon (mode normal),
  // garde les setlists "publiques" (pas de profileIds ou vide) visibles
  // à tous + celles qui matchent activeProfileId.
  //
  // Bug iPhone 2026-05-16 : Sébastien voyait "Cours Franck B" en mode
  // démo car cette setlist n'avait pas profileIds en local sur iPhone
  // (sync Firestore antérieure à Phase 5.7 stamping ?) → considérée
  // publique → visible à 'demo'. Le filtre strict empêche toute setlist
  // legacy non-taggée 'demo' de polluer le mode démo public.
  const mySetlists = useMemo(() => {
    if (profile?.isDemo) {
      return setlists.filter(sl => Array.isArray(sl.profileIds) && sl.profileIds.includes(activeProfileId));
    }
    return setlists.filter(sl => !sl.profileIds || sl.profileIds.length === 0 || sl.profileIds.includes(activeProfileId));
  }, [setlists, activeProfileId, profile?.isDemo]);
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
    if(!songDbWithProfileCache?.length||!allGuitars?.length) return;
    // Phase 7.54 — Itère sur songDbWithProfileCache (aiCache résolu depuis
    // profile.aiCache + fallback shared). Écrit dans profile.aiCache via
    // setSongAiCache au lieu de setSongDb.
    var outdated=songDbWithProfileCache.filter(s=>s.aiCache?.result?.cot_step1&&s.aiCache.sv!==SCORING_VERSION);
    if(!outdated.length){rescoreDone.current=key;return;}
    rescoreDone.current=key;
    console.log("[rescore] Batch rescore "+outdated.length+" morceaux");
    outdated.forEach(s=>{
      var gId=s.aiCache.gId;
      if(!gId) return;
      var gType=findGuitar(gId)?.type||"HB";
      var cleaned={...s.aiCache.result,preset_ann:null,preset_plug:null,ideal_preset:null,ideal_preset_score:0,ideal_top3:null};
      var recalc=enrichAIResult(cleaned,gType,gId,banksAnn,banksPlug,undefined,s);
      setSongAiCache(s.id,{...updateAiCache(s.aiCache,gId,recalc),sv:SCORING_VERSION});
    });
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

  // Phase 7.74.2 — DÉSACTIVÉ 2026-05-19 suite à régression critique.
  // Le helper droppait les guitares custom d'autres profils (Francisco,
  // Arthur, Emmanuel, Bruno) car leur metadata vit per-profile sur le
  // device d'origine et n'est pas connue côté Sébastien Mac. Phase 7.59.1
  // avait correctement identifié ces cg_* comme "soft orphans légitimes"
  // → Phase 7.74.2 était trop strict.
  //
  // Pour réactiver en mode opt-in (debug only) :
  //   window.__BACKLINE_AUTO_REPAIR_GUITARS = true; location.reload();
  //
  // Phase 7.74.3 future : approche plus rigoureuse via union de TOUTES
  // les customGuitars connues (tous profils + shared) — mais limite
  // intrinsèque : la metadata d'une custom guitar peut vivre uniquement
  // sur son device d'origine et ne JAMAIS être disponible côté Sébastien.
  // Donc auto-repair structurellement risqué. Repair manuel via snippet
  // console reste la voie sûre.
  const repairRanRef = useRef(false);
  useEffect(() => {
    if (!firestoreLoaded || repairRanRef.current) return;
    repairRanRef.current = true;
    if (typeof window === 'undefined' || window.__BACKLINE_AUTO_REPAIR_GUITARS !== true) {
      return; // OPT-IN ONLY
    }
    const stateLike = { profiles, shared: { customGuitars } };
    const { state: cleaned, repairs } = repairProfileGuitarsOrphans(stateLike, GUITARS);
    if (repairs.length > 0) {
      console.warn('[backline-repair-7.74.2] Orphan guitars detected and removed:', repairs);
      setProfiles(cleaned.profiles);
    }
  }, [firestoreLoaded]);  // eslint-disable-line react-hooks/exhaustive-deps


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
  // Phase 7.52.11 — hash snapshot juste après adoption pull. Permet de
  // distinguer "le useEffect se déclenche à cause de l'adoption Firestore"
  // (skip push) vs "user a vraiment modifié après le pull" (push autorisé
  // malgré justPulledRef true). Reset à null au prochain pull.
  const lastPulledHashRef = useRef(null);
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
      +":"+(p.preferredStyles||[]).slice().sort().join(',')  // Phase 7.73.2 Session A — bonus sync
      +":"+(p.instruments||[]).slice().sort().join(',')      // Phase 8.6 — toggle bass + futur multi-instrument
      +":"+(p.myBasses||[]).slice().sort().join(',')         // Phase 8.6 — basses cochées
      +":"+(p.myBassAmps||[]).slice().sort().join(',')       // Phase 8.6 — amplis basse cochés
      +":"+(p.customBasses||[]).map(b=>b.id).slice().sort().join(',')  // Phase 8.6 — custom basses future
      +":"+(p.customBassAmps||[]).map(a=>a.id).slice().sort().join(',') // Phase 8.6 — custom amplis basse future
      +":"+(p.myGuitarAmps||[]).slice().sort().join(',')     // Phase A — amplis guitare cochés
      +":"+(p.customGuitarAmps||[]).map(a=>a.id).slice().sort().join(',') // Phase A — custom amplis guitare
      +":"+(p.playInstrument||'')+":"+(p.playRig||'')        // Phase B — contexte de jeu (instrument × rig)
      +":"+(p.myPedals||[]).slice().sort().join(',')         // Phase C — pédales cochées
      +":"+(p.customPedals||[]).map(p2=>p2.id).slice().sort().join(',') // Phase C — pédales custom
      +":"+Object.keys(p.aiCache||{}).slice().sort().join(',')+":"+Object.values(p.aiCache||{}).map(a=>(a?.sv||0)+'|'+(a?.rigSnapshot||'')+'|'+(a?.gId||'')+'|'+(a?.ts||0)).join('!')  // Phase 7.54 + 7.81 — aiCache per-profile, ts pour propager LWW
      // Phase 7.79.3c — usagesOverrides per-profile : sync via push profil
      // habituel. Hash basé sur (name, lastModified, usages?null|len) pour
      // détecter add/remove/modify et déclencher le push.
      +":"+Object.entries(p.usagesOverrides||{}).map(([n,o])=>n+'|'+(o?.lastModified||0)+'|'+(o?.usages===null?'NULL':Array.isArray(o?.usages)?o.usages.length:'NA')).sort().join('!')
    ).join('|');
    const syncHash=[
      // Phase 7.54 — Hash basé sur songDbWithProfileCache (aiCache résolu
      // depuis profile.aiCache + fallback shared). Sans ça, les modifs
      // dans profile.aiCache ne déclenchaient pas le push Firestore.
      (songDbWithProfileCache||[]).map(s=>s.id+":"+(s.aiCache?.sv||0)+":"+(s.aiCache?.rigSnapshot||'')+":"+(s.aiCache?.gId||'')+":"+(s.aiCache?.ts||0)).join(','),
      (setlists||[]).map(s=>s.id+":"+(s.songIds||[]).slice().sort().join(',')+":"+(s.profileIds||[]).slice().sort().join(',')+":"+(s.name||'')).join('|'),
      (customGuitars||[]).map(g=>g.id).slice().sort().join(','),
      Object.keys(deletedSetlistIds||{}).slice().sort().join(','),
      // Phase 7.69.7 — hash adminPacks pour déclencher sync sur modif
      (adminPacks||[]).map(pk=>(pk.id||'')+':'+(pk.lastModified||0)+':'+((pk.presets||[]).length)).join('|'),
      // Phase 7.73.2.6 — hash toneNetPresets pour déclencher push sur modif
      // (add/remove/edit). Sans ça : suppression locale d'un preset ToneNET
      // ne déclenchait PAS push Firestore → autres devices gardent les 5
      // entries → re-injectent au prochain pull (cycle infini sans tombstones
      // Phase 7.53.1 documentée). Le hash inclut name + lastModified +
      // usages.len pour détecter add/remove/edit + tag usages curation.
      (toneNetPresets||[]).map(p=>(p.id||p.name||'')+':'+(p.lastModified||0)+':'+(Array.isArray(p.usages)?p.usages.length:0)).sort().join('|'),
      // Phase 7.53.2 — hash deletedToneNetIds pour déclencher push sur
      // nouvelle suppression. Format compact id:ts trié.
      Object.entries(deletedToneNetIds||{}).map(([id,ts])=>id+':'+ts).sort().join('|'),
      // Phase 7.79.3c — hash shared.usagesOverrides + studioUsages (niveau 2/3 cascade)
      Object.entries(sharedUsagesOverrides||{}).map(([n,o])=>n+'|'+(o?.lastModified||0)+'|'+(o?.usages===null?'NULL':Array.isArray(o?.usages)?o.usages.length:'NA')).sort().join('!'),
      Object.entries(sharedStudioUsages||{}).map(([n,o])=>n+'|'+(o?.lastModified||0)+'|'+(o?.curatedBy||'')+'|'+(o?.usages===null?'NULL':Array.isArray(o?.usages)?o.usages.length:'NA')).sort().join('!'),
      // Phase 13.4 — hash artistsOverrides : déclencher push sur modif
      // (add/edit/delete artiste admin). Format wrapper : {artist, lastModified}.
      // artist === null → tombstone (delete override). Cohérent avec
      // mergeArtistsOverridesLWW (LWW per-item).
      Object.entries(sharedArtistsOverrides||{}).map(([id,o])=>id+'|'+(o?.lastModified||0)+'|'+(o?.artist===null?'NULL':(o?.artist?.name||'NA'))).sort().join('!'),
      profileHash,
      activeProfileId,
      theme,
    ].join('#');
    const shouldBump=syncHash!==lastSyncHashRef.current;
    if(shouldBump){
      lastSharedModRef.current=Date.now();
      // Phase 7.52.12 — NE PAS update lastSyncHashRef ici. Si on le fait,
      // un re-run du useEffect dans la fenêtre de 2s debounce (avant que
      // saveToFirestore se déclenche) verra shouldBump=false → cleanup
      // annule le setTimeout → push jamais fait → ☁️ flashe brièvement
      // puis revient à synced sans rien pousser. lastSyncHashRef est
      // updaté seulement après le push successful (cf .then() ligne ~893).
    }
    const state={
      version:STATE_VERSION,
      activeProfileId,
      // Phase 7.79.3c — shared.usagesOverrides + studioUsages persistés
      // dans localStorage + push Firestore. Le profile.usagesOverrides est
      // déjà dans `profiles` via le useState standard.
      shared:{songDb,theme,setlists,customGuitars,toneNetPresets,deletedSetlistIds,deletedToneNetIds,adminPacks,usagesOverrides:sharedUsagesOverrides,studioUsages:sharedStudioUsages,artistsOverrides:sharedArtistsOverrides,lastModified:lastSharedModRef.current},
      profiles,
    };
    // Phase 7.51.3 — mode démo : ne JAMAIS persister le snapshot in-memory
    // dans localStorage (sinon le snapshot démo pollue le profil normal
    // de l'utilisateur trusted sur cet appareil). Le visiteur démo a
    // tout in-memory ; reload → on relit le snapshot frais bundlé.
    if(isDemo) return;
    autoBackup();
    // Phase 7.52.2 (B-TECH-02) — persistState avec retry-on-quota.
    // Si quota saturé, purge les backups et re-tente. Si échec final,
    // console.error LOUD : indique que les modifs locales ne sont pas
    // persistées localement (mais peuvent quand même être pushées à
    // Firestore via le bloc suivant si firestoreLoaded).
    persistState(state);
    if(!hasMounted.current){hasMounted.current=true;return;}
    if(!firestoreLoaded) return;
    // Phase 6.1.3 — si on vient juste de pull (justPulledRef=true), la
    // modif syncHash est due à l'adoption des données remote, pas à une
    // action user. Skip le push pour éviter d'écraser Firestore avec
    // notre perspective locale.
    // Phase 7.52.11 — Mais si l'utilisateur a fait une VRAIE modif
    // pendant cette fenêtre 3s (toggle guitare, ajout custom, etc.),
    // le push doit quand même passer. On compare le syncHash actuel
    // au snapshot du hash juste après adoption pull (lastPulledHashRef) :
    // - hash inchangé depuis adoption → c'est l'adoption qui a triggered
    //   ce useEffect, pas le user → skip
    // - hash changé depuis adoption → user a modifié après le pull →
    //   push autorisé malgré justPulledRef true
    if(justPulledRef.current){
      if(lastPulledHashRef.current===null){
        lastPulledHashRef.current=syncHash;
        setSyncStatus("synced");
        return;
      }
      if(syncHash===lastPulledHashRef.current){
        setSyncStatus("synced");
        return;
      }
      // sinon : user a modifié post-pull → on continue (fall-through)
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
    // Phase 7.52.12 — capture le syncHash dans la closure pour l'updater
    // de lastSyncHashRef seulement après le push successful. Si l'état
    // a évolué entre temps, shouldBump redeviendra true au prochain
    // useEffect → re-push → OK.
    const pushedHash=syncHash;
    firestoreDebounceRef.current = setTimeout(()=>{
      saveToFirestore(state).then(()=>{
        setSyncStatus("synced");
        lastSyncHashRef.current=pushedHash;
      }).catch(()=>setSyncStatus("error"));
    }, 2000);
    // Phase 7.52.12 — NO cleanup clearTimeout. Le cleanup ne sert qu'au
    // unmount App (jamais en pratique). Mais il était appelé à CHAQUE
    // re-run du useEffect → annulait le push debounce si un poll Firestore
    // ou autre re-render se produisait dans les 2s → push jamais fait.
    // Le clearTimeout explicite ligne 888 (en début de branche
    // shouldBump=true) suffit pour le debounce normal sur modifs
    // consécutives.
  },[songDb,theme,setlists,customGuitars,toneNetPresets,deletedSetlistIds,deletedToneNetIds,adminPacks,profiles,activeProfileId,firestoreLoaded]);

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
    // Phase 7.52.11 — reset hash snapshot à chaque nouveau pull pour
    // que le test "user a modifié après pull" se base sur le hash POST
    // adoption de CE pull, pas du précédent.
    lastPulledHashRef.current=null;
    setTimeout(()=>{
      justPulledRef.current=false;
      lastPulledHashRef.current=null;
    },3000);
    var pollRemap={};
    if(data.shared.songDb) setSongDb(prev=>{
      // Phase 7.54.1 — isV10:true → skip remote.aiCache (legacy obsolète)
      const m=mergeSongDb(prev,data.shared.songDb,{isV10:true});
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
    // Phase 7.53.1 — Merge LWW per-item au lieu de remplacement en bloc.
    // Évite qu'un device avec [] vide écrase la curation d'un autre device.
    // Le remote.toneNetPresets peut être absent (pas d'écrasement local
    // par []) ou présent (merge per-id par lastModified).
    //
    // Phase 7.53.2 — Tombstones ToneNET pour résoudre la résurrection
    // cross-device. Merge LWW des tombstones d'abord (union max(ts)) →
    // passe au mergeToneNetPresetsLWW comme 3e param → drop items dont
    // ts <= tombstone[id]. Cycle cassé.
    const remoteDelTn = data.shared.deletedToneNetIds;
    const mergedDelTn = mergeDeletedToneNetIds(deletedToneNetIds, remoteDelTn);
    if (JSON.stringify(mergedDelTn) !== JSON.stringify(deletedToneNetIds||{})) {
      setDeletedToneNetIds(mergedDelTn);
    }
    if(data.shared.toneNetPresets!==undefined) setToneNetPresets(prev=>{
      const merged=mergeToneNetPresetsLWW(prev,data.shared.toneNetPresets,mergedDelTn);
      if(JSON.stringify(merged)===JSON.stringify(prev))return prev;
      return merged;
    });
    // Phase 7.69.7 — Merge adminPacks (admin write seul → LWW grossier
    // par pack id, remote gagne si lastModified plus récent ou si pack
    // local absent. Pas de tombstone, suppression non propagée auto —
    // si nécessaire, ajouter shared.deletedAdminPackIds plus tard).
    if(Array.isArray(data.shared.adminPacks)) setAdminPacks(prev=>{
      const remote=data.shared.adminPacks;
      const byId={};
      (prev||[]).forEach(pk=>{ if(pk?.id) byId[pk.id]=pk; });
      remote.forEach(pk=>{
        if(!pk?.id) return;
        const local=byId[pk.id];
        if(!local || (pk.lastModified||0)>=(local.lastModified||0)) byId[pk.id]=pk;
      });
      const merged=Object.values(byId);
      if(JSON.stringify(merged)===JSON.stringify(prev))return prev;
      return merged;
    });
    // Phase 7.79.3c — Merge shared.usagesOverrides + studioUsages per-item LWW.
    // Pattern identique à mergeToneNetPresetsLWW (Phase 7.53.1). Pas de
    // tombstones v1 — pour retirer un override on écrit { usages: null }
    // (override "vide explicite") via removeUsagesOverride côté UI, qui
    // DELETE l'entry localement et la LWW propage le delete au prochain push.
    if(data.shared.usagesOverrides!==undefined) setSharedUsagesOverrides(prev=>{
      const merged=mergeUsagesOverridesLWW(prev,data.shared.usagesOverrides);
      if(JSON.stringify(merged)===JSON.stringify(prev))return prev;
      return merged;
    });
    if(data.shared.studioUsages!==undefined) setSharedStudioUsages(prev=>{
      const merged=mergeUsagesOverridesLWW(prev,data.shared.studioUsages);
      if(JSON.stringify(merged)===JSON.stringify(prev))return prev;
      return merged;
    });
    // Phase 13.4 — Merge shared.artistsOverrides LWW per-item.
    // Pattern identique aux 2 maps ci-dessus. Format wrapper :
    // { [artistId]: { artist: Artist|null, lastModified } }.
    if(data.shared.artistsOverrides!==undefined) setSharedArtistsOverrides(prev=>{
      const merged=mergeArtistsOverridesLWW(prev,data.shared.artistsOverrides);
      if(JSON.stringify(merged)===JSON.stringify(prev))return prev;
      return merged;
    });
    if(data.profiles) setProfiles(prev=>{
      // Phase 5.7 : LWW per-profile via profile.lastModified. Les
      // profils remote adoptés passent par applySecrets pour réinjecter
      // aiKeys/password locaux. ensureProfileV7 chaîne le heal v3→v7
      // (dont le drop legacy `devices` de la Phase 5.1).
      // Phase 7.74.11 — passe remoteDeviceId/Label pour enrichir les
      // logs forensique des merges mass-change BLOCKED/ADOPTED.
      const next=mergeProfilesLWW(prev,data.profiles,{
        applySecrets,
        remoteDeviceId: data._deviceId || null,
        remoteDeviceLabel: data._deviceLabel || null,
      });
      if(JSON.stringify(next)===JSON.stringify(prev))return prev;
      return next;
    });
    // Phase 7.62 — NE PAS adopter data.activeProfileId depuis Firestore.
    // C'est une notion local par device. Avant fix : un device A switche
    // sur profil X → push à Firestore → device B pull → setActiveProfileId(X)
    // → bascule involontaire. Cf docstring strip côté firestore.js prep().
    // Cohabitation : un client pre-7.62 peut encore push activeProfileId,
    // mais on l'ignore au pull, donc no-op de notre côté.
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
        // Phase 7.54.1 — isV10:true → skip remote.aiCache (legacy obsolète)
        var mergedSongs=mergeSongDb(songDb||[],remoteSongs,{isV10:true});
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
          // Phase 7.62 — activeProfileId retiré (local-only, strippé en
          // prep() côté firestore.js de toute façon). Cosmétique.
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
    // Phase 7.74.7 — délègue à appendLoginEntry : ajoute l'entrée dans
    // loginHistory SANS re-stamper lastModified. Re-stamper à chaque
    // boot/login était l'amplificateur de la pollution profile (6
    // occurrences) — cf docs/SYNC.md « Phase 7.74.7 ».
    setProfiles(p=>appendLoginEntry(p,id));
  };

  // Once Firestore loaded, decide initial screen
  const loginRecorded=useRef(false);
  useEffect(()=>{
    if(!firestoreLoaded||screen!=="loading") return;
    // Phase 7.60 — URL ?thanks=1 (redirect après soumission Tally) :
    // affiche ThanksScreen branded mybackline.app au lieu de
    // continuer l'auto-login. PRIORITAIRE sur tout : un user trusted
    // qui clique "Demander un accès beta" depuis la landing et soumet
    // verra quand même la confirmation (pas auto-login direct).
    if(_thanksRequested){
      _thanksRequested = false; // consommé
      setScreen("thanks");
      return;
    }
    // Phase 7.51.3 — URL ?demo=1 court-circuite l'auto-login : on entre
    // direct dans le profil démo, aucun trusted device n'est consulté
    // ni ajouté.
    if(_demoModeRequested){
      _demoModeRequested = false; // consommé
      enterDemoMode();
      loginRecorded.current=true;
      return;
    }
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
      } else if(trustedIds.length===0){
        // Phase 7.60 — Aucun device trusted = first-time visitor.
        // Servir LandingScreen au lieu de basculer direct sur
        // ProfilePicker (qui demanderait nom + password sans contexte).
        // Le visiteur peut depuis cette page : entrer en mode démo,
        // demander un accès beta (formulaire Tally), ou cliquer "J'ai
        // déjà un compte" → setScreen("pick") classique.
        setScreen("landing");
      } else if(profileCount>1){setScreen("pick");}
    else{recordLogin(activeProfileId);loginRecorded.current=true;setScreen("list");}
    }
  },[firestoreLoaded,firestoreProfiles]);

  // Reset on profile switch
  useEffect(()=>{if(screen!=="loading"){setChecked([]);setScreen("list");}},[activeProfileId]);

  // Phase 7.52.8 — Scroll reset au changement d'écran (et au mount initial).
  // Bug rapporté 2026-05-16 : après connexion Mac depuis ProfilePicker
  // (screen pick → list), la page restait scrollée au milieu → header
  // (AppHeader) invisible. Le browser restaure la dernière position
  // scroll connue après l'unmount/remount du contenu. Fix : forcer
  // window.scrollTo(0,0) à chaque changement de screen. `auto` (vs
  // smooth) pour effet immédiat sans animation gênante.
  useEffect(()=>{
    if(typeof window!=="undefined") window.scrollTo({top:0,left:0,behavior:"auto"});
  },[screen]);

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

  // Phase 7.59-B — Sanity check au boot : log warning si un profil a
  // des guitar ids "orphelins" dans myGuitars (ni dans GUITARS catalog,
  // ni dans shared.customGuitars, ni dans profile.customGuitars legacy).
  // Détecte les pollutions cross-profile (cas observé 2026-05-17 sur
  // profile.sebastien.myGuitars contenant sire_t7/t3 issus de Francisco
  // sans repro identifié).
  // Tourne une seule fois au mount. Non bloquant — juste un log console
  // explicite pour faciliter le diagnostic.
  useEffect(() => {
    const state = { profiles, shared: { customGuitars } };
    const warnings = validateProfileGuitars(state, GUITARS);
    if (warnings.length > 0) {
      console.warn('[backline-sanity] Pollution profile détectée — guitar ids orphelins:', warnings);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply theme to document
  useEffect(()=>{
    document.documentElement.setAttribute("data-theme",theme);
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta) meta.content=theme==="dark"?"var(--bg)":"var(--cream-50)";
  },[theme]);
  // Phase 7.63 — Sécurité admin-switch profil. Si l'admin switch vers
  // un profil non-admin, on tracke l'origine via sessionStorage et on
  // logge un `admin_switch` dans le loginHistory du profil cible
  // (transparence pour le beta-testeur). Retour sur le profil admin
  // d'origine → clear sessionStorage. Switch entre profils admin →
  // pas de mode admin-as (les 2 sont admin).
  const switchProfile = id => {
    if(!profiles[id]||id===activeProfileId) return;
    const stored=sessionStorage.getItem(ADMIN_ORIGIN_KEY);
    const currentIsAdmin=!!profiles[activeProfileId]?.isAdmin;
    const adminOriginId=stored||(currentIsAdmin?activeProfileId:null);
    const adminOrigin=adminOriginId?profiles[adminOriginId]:null;
    const targetIsAdmin=!!profiles[id]?.isAdmin;
    if(adminOrigin?.isAdmin&&id!==adminOriginId&&!targetIsAdmin){
      // Entrée/changement mode admin-as (admin → non-admin)
      sessionStorage.setItem(ADMIN_ORIGIN_KEY,adminOriginId);
      setProfiles(p=>recordAdminSwitch(p,id,adminOrigin));
    }else{
      // Tous les autres cas : retour admin d'origine, switch vers admin,
      // ou switch entre non-admins (rare). Clear le marker.
      if(id===adminOriginId||targetIsAdmin) sessionStorage.removeItem(ADMIN_ORIGIN_KEY);
      recordLogin(id);
    }
    setActiveProfileId(id);
    sessionStorage.setItem("tonex_active_profile",id);
  };
  const isAdmin = profile.isAdmin === true;
  const pickProfile = id => { recordLogin(id);setActiveProfileId(id);sessionStorage.setItem("tonex_active_profile",id); setScreen("list"); };
  const createAndPick = name => {
    const id=name.toLowerCase().replace(/[^a-z0-9]/g,"_")+`_${Date.now()}`;
    const np=makeDefaultProfile(id,name);
    setProfiles(p=>({...p,[id]:np}));
    setActiveProfileId(id);
    setScreen("list");
  };


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
  // Phase 7.63 — Réintroduit le ProfileSelector dropdown dans AppHeader
  // pour les admins (régression Phase 7.22 du découpage). switchProfile
  // appelé via onSwitch → push entry admin_switch dans loginHistory du
  // profil cible + active le banner AdminAsBanner. Aussi expose
  // onViewProfile + onUpgradePassword pour les fonctionnalités existantes
  // du composant ProfileSelector.
  var headerProps={
    profiles:profiles,
    activeProfileId:activeProfileId,
    onProfile:function(){setProfileInitTab(null);setScreen("profile");},
    onSwitch:switchProfile,
    onViewProfile:function(id){setViewProfileId(id);setScreen("viewprofile");},
    onUpgradePassword:function(id,newHash){setProfiles(function(p){return Object.assign({},p,{[id]:Object.assign({},p[id],{password:newHash,lastModified:Date.now()})});});},
    screen:screen,
    onNavigate:setScreen,
    isAdmin:isAdmin,
    syncStatus:syncStatus,
    appVersion:APP_VERSION,
  };
  var mainScreens=["list","setlists","explore","jam","optimizer","profile","viewprofile","exportimport"];
  var showNav=mainScreens.includes(screen);

  if(screen==="loading") return <div className="page-root"><div style={{textAlign:"center",padding:"60px 20px"}}><div style={{marginBottom:16,display:"flex",justifyContent:"center"}}><BacklineIcon size={56} color="var(--brass-300)"/></div><div style={{fontFamily:"var(--font-display)",fontSize:"var(--fs-lg)",fontWeight:800,color:"var(--text-primary)"}}>{APP_NAME}</div><div style={{fontSize:13,color:"var(--text-muted)",marginTop:8}}>{t("loading","Chargement...")}</div></div></div>;
  if(screen==="landing") return <div className="page-root"><LandingScreen onDemoEnter={enterDemoMode} onShowPicker={()=>setScreen("pick")} appVersion={APP_VERSION}/></div>;
  if(screen==="thanks") return <div className="page-root"><ThanksScreen onDemoEnter={enterDemoMode} onBackHome={()=>setScreen("landing")} appVersion={APP_VERSION}/></div>;
  if(screen==="pick") return <div className="page-root"><ProfilePickerScreen profiles={profiles} onPick={pickProfile} appVersion={APP_VERSION} onUpgradePassword={(id,newHash)=>setProfiles(p=>({...p,[id]:{...p[id],password:newHash,lastModified:Date.now()}}))} onDemoEnter={enterDemoMode}/></div>;

  // Phase 4 — mode scène plein écran. Le LiveScreen gère lui-même son
  // layout (pas d'AppHeader/AppNavBottom).
  if(screen==="live"){
    // FIX 4.1 A — fallback sur la liste complète si la setlist n'est
    // pas dans mySetlists (cas profil non-admin qui clique sur une
    // setlist partagée par un autre profil).
    const sl = liveSetlistId
      ? (mySetlists.find(s=>s.id===liveSetlistId) || setlists.find(s=>s.id===liveSetlistId))
      : null;
    // Phase 4.6 fix — résoudre l'aiCache via songDbWithProfileCache
    // (Phase 7.54 per-profile aiCache). Avant : songDb brut retournait
    // les songs avec aiCache=null après la migration v10 → LiveScreen
    // affichait "Pas de preset déterminé pour ce morceau".
    const songIds = sl ? sl.songIds : songDbWithProfileCache.map(s=>s.id);
    const liveSongs = songIds.map(id=>songDbWithProfileCache.find(s=>s.id===id)).filter(Boolean);
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
  else if(screen==="profile") screenContent=<MonProfilScreen songDb={songDbWithProfileCache} onSongDb={setSongDb} onAiCacheUpdate={setSongAiCache} setlists={mySetlists} allSetlists={setlists} onSetlists={setSetlists} onDeletedSetlistIds={setDeletedSetlistIds} banksAnn={banksAnn} onBanksAnn={setBanksAnn} banksPlug={banksPlug} onBanksPlug={setBanksPlug} onBack={()=>setScreen("list")} onNavigate={setScreen} aiProvider={aiProvider} onAiProvider={setAiProvider} aiKeys={aiKeys} onAiKeys={setAiKeys} theme={theme} onTheme={setTheme} profile={profile} profiles={profiles} onProfiles={setProfiles} activeProfileId={activeProfileId} allGuitars={allGuitars} allRigsGuitars={allRigsGuitars} guitarBias={effectiveGuitarBias} initTab={profileInitTab} customGuitars={customGuitars} onCustomGuitars={setCustomGuitars} toneNetPresets={toneNetPresets} onToneNetPresets={setToneNetPresets} adminPacks={adminPacks} onAdminPacks={setAdminPacks} fullState={fullState} onImportState={onImportState} onLogout={()=>{sessionStorage.removeItem("tonex_active_profile");sessionStorage.removeItem(ADMIN_ORIGIN_KEY);setScreen("pick");}} MaintenanceTabComponent={MaintenanceTab} onSaveSharedKey={saveSharedKey}
    onSharedUsagesOverrides={(reducer)=>setSharedUsagesOverrides((prevMap)=>{const sh={usagesOverrides:prevMap};const next=reducer(sh);return next?.usagesOverrides||{};})}
  />;
  else if(screen==="setlists") screenContent=<SetlistsScreen songDb={songDbWithProfileCache} onSongDb={setSongDb} onAiCacheUpdate={setSongAiCache} setlists={mySetlists} allSetlists={setlists} onSetlists={setSetlists} mySongIds={mySongIds} checked={checked} onChecked={setChecked} onSettings={()=>setScreen("profile")} onNavigate={setScreen} banksAnn={banksAnn} onBanksAnn={setBanksAnn} banksPlug={banksPlug} onBanksPlug={setBanksPlug} aiProvider={aiProvider} aiKeys={aiKeys} allGuitars={allGuitars} allRigsGuitars={allRigsGuitars} guitarBias={effectiveGuitarBias} availableSources={availableSources} activeProfileId={activeProfileId} profiles={profiles} profile={profile} onProfiles={setProfiles} onTmpPatchOverride={onTmpPatchOverride} onLive={(slId)=>{setLiveSetlistId(slId||null);setScreen("live");}} toneNetPresets={toneNetPresets} onToneNetPresets={setToneNetPresets} onSharedUsagesOverrides={(reducer)=>setSharedUsagesOverrides((prevMap)=>{const sh={usagesOverrides:prevMap};const next=reducer(sh);return next?.usagesOverrides||{};})}/>;
  else if(screen==="jam") screenContent=<div><Breadcrumb crumbs={[{label:t("nav.home","Accueil"),screen:"list"},{label:t("nav.jam","Jammer")}]} onNavigate={setScreen}/><div style={{fontFamily:"var(--font-display)",fontSize:"var(--fs-lg)",fontWeight:800,color:"var(--text-primary)",marginBottom:16}}>{t("jam.page-title","🎲 Jammer")}</div><JamScreen banksAnn={banksAnn} banksPlug={banksPlug} allGuitars={allGuitars} availableSources={availableSources} profile={profile}/></div>;
  else if(screen==="explore") screenContent=<div><Breadcrumb crumbs={[{label:t("nav.home","Accueil"),screen:"list"},{label:t("nav.explore","Explorer")}]} onNavigate={setScreen}/><div style={{fontFamily:"var(--font-display)",fontSize:"var(--fs-lg)",fontWeight:800,color:"var(--text-primary)",marginBottom:16}}>{t("preset-browser.page-title-flat","Explorer les presets")}</div><PresetBrowser banksAnn={banksAnn} banksPlug={banksPlug} availableSources={availableSources} customPacks={profile.customPacks} guitars={allGuitars} toneNetPresets={toneNetPresets} isAdmin={isAdmin} songDb={songDb}
    onSaveUsages={(name,usages)=>{
      // Phase 7.79.3b — ctx étendu pour router custom/ToneNET/catalog statique
      // selon entry.src + isAdmin. cf src/core/preset-curation.js.
      saveUsagesForPreset(name, usages, {
        findEntry: findCatalogEntry,
        activeProfileId,
        isAdmin,
        onProfiles: setProfiles,
        onToneNetPresets: setToneNetPresets,
        // Adapter : saveUsagesForPreset attend onShared(reducer(sh) => sh').
        // On compose un sh partiel à la volée avec la forme fonctionnelle
        // de setSharedUsagesOverrides pour éviter les closures stales.
        onShared: (reducer) => setSharedUsagesOverrides((prevMap) => {
          const sh = { usagesOverrides: prevMap };
          const next = reducer(sh);
          return next?.usagesOverrides || {};
        }),
      });
    }}
    onRemoveOverride={(name)=>{
      removeUsagesOverride(name, {
        findEntry: findCatalogEntry,
        activeProfileId,
        isAdmin,
        onProfiles: setProfiles,
        onShared: (reducer) => setSharedUsagesOverrides((prevMap) => {
          const sh = { usagesOverrides: prevMap };
          const next = reducer(sh);
          return next?.usagesOverrides || {};
        }),
      });
    }}
  /></div>;
  else if(screen==="optimizer"&&isAdmin) screenContent=<BankOptimizerScreen songDb={songDbWithProfileCache} setlists={mySetlists} banksAnn={banksAnn} onBanksAnn={setBanksAnn} banksPlug={banksPlug} onBanksPlug={setBanksPlug} allGuitars={allGuitars} availableSources={availableSources} onNavigate={setScreen} profile={profile}/>;
  // Phase 7.72 — Écran ⚙️ Admin séparé, gated isAdmin (URL hack defense).
  else if(screen==="admin"&&isAdmin) screenContent=<AdminScreen profile={profile} profiles={profiles} onProfiles={setProfiles} activeProfileId={activeProfileId} songDb={songDbWithProfileCache} onSongDb={setSongDb} onAiCacheUpdate={setSongAiCache} allSetlists={setlists} onSetlists={setSetlists} onDeletedSetlistIds={setDeletedSetlistIds} banksAnn={banksAnn} banksPlug={banksPlug} aiProvider={aiProvider} aiKeys={aiKeys} onAiKeys={setAiKeys} onSaveSharedKey={saveSharedKey} guitarBias={effectiveGuitarBias} toneNetPresets={toneNetPresets} onToneNetPresets={setToneNetPresets} onDeletedToneNetIds={setDeletedToneNetIds} adminPacks={adminPacks} onAdminPacks={setAdminPacks} sharedArtistsOverrides={sharedArtistsOverrides} onSharedArtistsOverrides={(reducer)=>setSharedArtistsOverrides((prev)=>{const next=typeof reducer==='function'?reducer(prev||{}):reducer;return next||{};})} MaintenanceTabComponent={MaintenanceTab} fullState={fullState} onImportState={onImportState} onBack={()=>setScreen("list")} onNavigate={setScreen}/>;
  else screenContent=<HomeScreen songDb={songDbWithProfileCache} onSongDb={setSongDb} onAiCacheUpdate={setSongAiCache} setlists={mySetlists} allSetlists={setlists} onSetlists={setSetlists} mySongIds={mySongIds} checked={checked} onChecked={setChecked} onSettings={()=>setScreen("profile")} onProfile={(tab)=>{setProfileInitTab(tab||null);setScreen("profile");}} onSetlistScreen={()=>setScreen("setlists")} onJam={()=>setScreen("jam")} onExplore={()=>setScreen("explore")} onOptimizer={()=>setScreen("optimizer")} banksAnn={banksAnn} banksPlug={banksPlug} aiProvider={aiProvider} aiKeys={aiKeys} allGuitars={allGuitars} guitarBias={effectiveGuitarBias} availableSources={availableSources} profiles={profiles} activeProfileId={activeProfileId} onSwitchProfile={switchProfile} onProfiles={setProfiles} customPacks={profile.customPacks} syncStatus={syncStatus} onViewProfile={(id)=>{setViewProfileId(id);setScreen("viewprofile");}} onLogout={()=>{sessionStorage.removeItem("tonex_active_profile");sessionStorage.removeItem(ADMIN_ORIGIN_KEY);setScreen("pick");}} onTmpPatchOverride={onTmpPatchOverride} onLive={(slId)=>{setLiveSetlistId(slId||null);setScreen("live");}}/>;

  // Phase 7.63 — Détection mode admin-as. sessionStorage.tonex_admin_origin
  // est posé par switchProfile quand un admin switch vers un profil
  // non-admin. Le banner s'affiche tant que le marker est posé ET que
  // le profil actif n'est pas le profil admin d'origine.
  const _adminOriginId = (typeof window !== 'undefined') ? sessionStorage.getItem(ADMIN_ORIGIN_KEY) : null;
  const _showAdminAsBanner = isAdminAsMode(profiles, activeProfileId, _adminOriginId) && screen !== 'live' && !isDemo;
  const _adminOriginProfile = _adminOriginId ? profiles[_adminOriginId] : null;

  return <div className="page-root">
    {_showAdminAsBanner && (
      <AdminAsBanner
        targetProfileName={profile?.name}
        adminProfileName={_adminOriginProfile?.name}
        onSwitchBack={() => { if (_adminOriginId) switchProfile(_adminOriginId); }}
      />
    )}
    {isDemo && screen!=="live" && <DemoBanner onExit={()=>{
      // Phase 7.55-B — Sortie explicite mode démo. Clean state in-memory
      // (drop le profil démo) + reset session + reload propre.
      try { sessionStorage.removeItem("tonex_active_profile"); } catch {}
      try { sessionStorage.removeItem(ADMIN_ORIGIN_KEY); } catch {}
      _setProfilesRaw(prev => { const out = { ...prev }; delete out.demo; return out; });
      // Reload sans le param ?demo=1 si présent
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has('demo')) {
          url.searchParams.delete('demo');
          window.history.replaceState({}, '', url.toString());
        }
      } catch {}
      setScreen("pick");
    }}/>}
    <AppHeader {...headerProps}/>
    {screenContent}
    <AppFooter/>
    {showNav&&<AppNavBottom screen={screen} onNavigate={setScreen} isAdmin={isAdmin}/>}
    {migrationToast&&<div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",background:"var(--brass)",color:"var(--ink)",padding:"10px 18px",borderRadius:"var(--r-md)",fontSize:13,fontWeight:600,zIndex:9999,boxShadow:"var(--shadow-md)",maxWidth:"90vw",textAlign:"center"}}>{migrationToast}</div>}
    <ToastDemoBlocked message={demoToastMsg} onDismiss={()=>setDemoToastMsg(null)}/>
  </div>;
}

// Guard du render module-level : en environnement de test (jsdom sans
// élément #root), l'import de main.jsx ne doit PAS tenter de monter
// l'app — main.smoke.test.jsx importe { App } et le monte lui-même.
// En prod, index.html fournit toujours <div id="root">, comportement
// strictement inchangé.
const _rootEl = (typeof document !== 'undefined') ? document.getElementById("root") : null;
if (_rootEl) ReactDOM.render(<App/>, _rootEl);

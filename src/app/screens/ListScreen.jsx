// src/app/screens/ListScreen.jsx — Phase 7.14 (découpage main.jsx).
//
// Sélecteur de setlist + liste de morceaux avec :
// - rendu compact par row (titre + artiste + history + per-device preset
//   recs via SongCollapsedDeviceRows + score guitare).
// - expand → SongDetailCard plein détail.
// - actions bulk : 🤖 Analyser/MAJ (refetch IA), 🧹 Retirer non-cochés,
//   🗑️ retrait individuel avec undo toast 5s.
// - édition setlists inline (rename, vider, supprimer, partage profils).
// - mode scène (onLive callback).
// - "Tout améliorer" : itère IA × 3 rounds tant que bestScore < 90.
//
// Perf : lazy batch rendering (12 puis +18 toutes les 60ms via
// requestIdleCallback), content-visibility:auto sur chaque row,
// deferring 80ms des SongCollapsedDeviceRows, hoisting des helpers
// par useMemo (songRowData, tmpTopRecBySongId, enabledDevicesForRender).
// Voir CLAUDE.md "Phase 5.13" pour le marathon perf.
//
// InlineRenameInput est co-localisé car n'est utilisé que par ce screen.

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { t, tFormat, tPlural } from '../../i18n/index.js';
import { GUITARS } from '../../core/guitars.js';
import { SCORING_VERSION, computeFinalScore } from '../../core/scoring/index.js';
import {
  findGuitarByAIName, findCotEntryForGuitar, localGuitarSongScore,
} from '../../core/scoring/guitar.js';
import { findCatalogEntry } from '../../core/catalog.js';
import { toggleSetlistProfile, getEffectivePlayContext } from '../../core/state.js';
import { TMP_FACTORY_PATCHES, recommendTMPPatch } from '../../devices/tonemaster-pro/index.js';
import NavIcon from '../components/NavIcon.jsx';
import { getActiveDevicesForRender } from '../utils/devices-render.js';
import { getIg, getPA, getPP, getSongHist } from '../utils/song-helpers.js';
import { findBass } from '../../core/basses.js';
import { findBassAmp } from '../../core/bass-amps.js';
import { findGuitarAmp } from '../../core/guitar-amps.js';
import { findPedal } from '../../core/pedals.js';
import {
  enrichAIResult, getBestResult, bestScoreOf, updateAiCache,
  computeRigSnapshot, computeAnalysisFingerprint, diffAnalysisFingerprint,
  resolveRefAmp, stripSlotPrefix,
} from '../utils/ai-helpers.js';
import { findInBanks, guitarScore } from '../utils/preset-helpers.js';
import { resolveDisplayGuitar } from '../utils/display-guitar.js';
import { fetchAI } from '../utils/fetchAI.js';
import { CC, CL, TYPE_COLORS } from '../utils/ui-constants.js';
import { scoreColor, scoreBg, scoreLabel } from '../components/score-utils.js';
import { bucketizeScore } from '../../core/scoring/compat-buckets.js';


// Phase 7.83 final3 (2026-05-27) — style inline fond plein bucket compat
// (pattern score pills). Appliqué aux libellés guitare + preset en vue
// repliée pour cohérence avec SongDetailCard fiche dépliée. Strip aussi
// "(HB)/(SC)/(P90)" résiduel que Gemini peut injecter dans des noms.
// v9.7.28 — Aligné sur SongDetailCard.compatLabelStyle (v9.7.24) :
// padding 4px 10px pour cohérence visuelle (desktop avait padding plus
// petit, mobile compensait par width:100% via CSS). Maintenant le cadre
// a un look uniforme entre desktop et mobile.
function _compatLabelStyle(score) {
  if (score == null) return null;
  const b = bucketizeScore(score);
  return {
    background: b.color,
    color: 'var(--text-inverse)',
    padding: '4px 10px',
    borderRadius: 'var(--r-sm)',
    fontWeight: 700,
  };
}
function _cleanGuitarLabel(n) {
  return (n || '').replace(/\s*\((?:HB|SC|P90)\)\s*$/i, '').trim();
}
import StatusDot from '../components/StatusDot.jsx';
import SongCollapsedDeviceRows from '../components/SongCollapsedDeviceRows.jsx';
import { formatRowPotardsFX } from '../utils/setlist-row-extras.js';
import { getRowPlaylistData } from '../utils/setlist-row-playlist.js';
import { TYPO, WEIGHT, TEXT_1, TEXT_2, TEXT_3, BG_1, BORDER_SUBTLE, badgeScore, badgeSlot, badgeLabel, badgePill } from '../styles/tokens.js';
import AddSongModal from '../components/AddSongModal.jsx';
import SongDetailCard from './SongDetailCard.jsx';
import { exportSetlistPdf } from './SetlistPdfExport.js';

// Sous-composant local pour les renames de setlist inline. Pas exporté
// car ne sert qu'au ListScreen.
function InlineRenameInput({ initialName, onSave, onCancel, inp, placeholder, buttonLabel, disabled }) {
  const [val, setVal] = useState(initialName || '');
  const submit = () => { if (val.trim() && !disabled) { onSave(val.trim()); setVal(''); } };
  const demoTitle = disabled ? t('demo.blocked', 'Action désactivée en mode démo') : undefined;
  const canSubmit = val.trim() && !disabled;
  return (
    <div style={{ display: 'flex', gap: 6, opacity: disabled ? 0.5 : 1, maxWidth: 480 }} title={demoTitle}>
      <input value={val} onChange={(e) => setVal(e.target.value)} placeholder={placeholder || ''} disabled={disabled} style={{ ...inp, flex: 1, cursor: disabled ? 'not-allowed' : 'text' }} autoFocus={!!initialName && !disabled} onKeyDown={(e) => e.key === 'Enter' && submit()} title={demoTitle}/>
      {/* Phase 7.85 — minHeight 44 iOS HIG (rapport Cowork B11 : "+ Créer"
          25×36px sous seuil touch). */}
      <button onClick={submit} disabled={!canSubmit} style={{ background: canSubmit ? 'var(--accent)' : 'var(--a7)', border: 'none', color: canSubmit ? 'var(--text-inverse)' : 'var(--text-dim)', borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: 12, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'not-allowed', minHeight: 44 }} title={demoTitle}>{buttonLabel || t('list.ok', 'OK')}</button>
      {initialName && <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>✕</button>}
    </div>
  );
}

function ListScreen({
  songDb, onSongDb, onAiCacheUpdate, setlists, allSetlists, onSetlists, mySongIds,
  checked, onChecked, onSettings,
  banksAnn, onBanksAnn, banksPlug, onBanksPlug,
  banksOne, banksOnePlus,
  aiProvider, aiKeys, hideHeader = false, allGuitars, allRigsGuitars,
  availableSources, activeProfileId, profiles, profile, onProfiles, guitarBias,
  onTmpPatchOverride, onLive,
  toneNetPresets, onToneNetPresets,
  onSharedUsagesOverrides, // Phase 7.79.3 — propagé à SongDetailCard → PresetCurationModal
}) {
  const [activeSlId, setActiveSlId] = useState(setlists[0]?.id || null);
  const activeSl = activeSlId ? setlists.find((s) => s.id === activeSlId) : null;
  const [showAdd, setShowAdd] = useState(false);
  const [sort, setSort] = useState((activeSl?.sort && activeSl.sort !== 'default') ? activeSl.sort : 'artist');
  const saveSort = (v) => { setSort(v); if (activeSlId) onSetlists((p) => p.map((sl) => sl.id === activeSlId ? { ...sl, sort: v } : sl)); };
  const activeSongs = useMemo(() => {
    const sl = activeSl;
    const baseAll = mySongIds ? songDb.filter((s) => mySongIds.has(s.id)) : songDb;
    const arr = sl ? (sl.songIds || []).map((id) => songDb.find((s) => s.id === id)).filter(Boolean) : [...baseAll];
    // Defensive : dedup by id pour éviter les warning React keys dupliquées
    // (cas observé : songDb a 2 entrées même id suite à corruption locale
    // ou collision Date.now() sur ajouts rapides).
    const seen = new Set();
    const deduped = arr.filter((s) => { if (seen.has(s.id)) return false; seen.add(s.id); return true; });
    if (sort === 'alpha') deduped.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    else if (sort === 'artist') deduped.sort((a, b) => a.artist.localeCompare(b.artist, 'fr') || a.title.localeCompare(b.title, 'fr'));
    return deduped;
  }, [songDb, activeSlId, sort, setlists, mySongIds]);

  const enabledDevicesForRender = useMemo(
    () => getActiveDevicesForRender(profile),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile?.enabledDevices, profile?.devices?.pedale, profile?.devices?.anniversary, profile?.devices?.plug],
  );
  const hasTMPDevice = enabledDevicesForRender.some((d) => d.id === 'tonemaster-pro');

  // Phase 7.42 — visibleCount hoisté avant collapsedAiCBySongId qui le consomme.
  const [visibleCount, setVisibleCount] = useState(12);

  const songRowData = useMemo(() => {
    const guitars = allGuitars || GUITARS;
    const map = new Map();
    for (const s of activeSongs) {
      const ig = getIg(s, guitars);
      const savedGId = activeSl?.guitars?.[s.id];
      const gId = savedGId || ig?.[0] || '';
      const g = gId ? guitars.find((x) => x.id === gId) : null;
      map.set(s.id, { ig, savedGId, gId, g });
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSongs, allGuitars, activeSl?.guitars]);

  // Phase 7.29.11 + 7.42 — bank-specific recommendations recomputées
  // pour le profil actif. enrichAIResult coûte ~150ms par song sur des
  // gros catalogs (customPacks user). Pour 120 morceaux ça donnait 14s
  // synchrones qui bloquaient le main thread → timeout navigateur.
  //
  // Solution Phase 7.42 : compute PROGRESSIF en background via
  // requestIdleCallback. Batches de 3 songs entre frames. L'UI affiche
  // immediately les rows sans badges enrichis (fallback raw aiCache),
  // puis les badges arrivent progressivement. Persistance via setState
  // de la Map → les rows déjà enrichies conservent leur aiC ref (memo
  // React.memo SongCollapsedDeviceRows OK), seules les nouvelles entrées
  // déclenchent un re-render incrémental.
  const [collapsedAiCBySongId, setCollapsedAiCBySongId] = useState(() => new Map());
  useEffect(() => {
    let cancelled = false;
    setCollapsedAiCBySongId(new Map()); // reset au changement de setlist/banks/etc.
    if (!activeSongs.length) return undefined;
    let i = 0;
    const BATCH = 3;
    const perfEnabled = typeof window !== 'undefined' && window.__TONEX_PERF;
    const overallStart = perfEnabled ? performance.now() : 0;
    let totalEnriched = 0;
    const tick = () => {
      if (cancelled) return;
      const batch = activeSongs.slice(i, i + BATCH);
      if (batch.length === 0) {
        if (perfEnabled) {
          // eslint-disable-next-line no-console
          console.log(`[perf] collapsedAiCBySongId total: ${(performance.now() - overallStart).toFixed(0)}ms (${totalEnriched}/${activeSongs.length} enriched)`);
        }
        return;
      }
      const newEntries = [];
      for (const s of batch) {
        const rd = songRowData.get(s.id);
        if (!rd?.gId || !s.aiCache?.result) continue;
        const aiCraw = getBestResult(s, rd.gId, s.aiCache.result);
        if (!aiCraw) continue;
        const gType = rd.g?.type || 'HB';
        const cleaned = { ...aiCraw, preset_ann: null, preset_plug: null, preset_one: null, preset_one_plus: null, ideal_preset: null, ideal_preset_score: 0, ideal_top3: null };
        newEntries.push([s.id, enrichAIResult(cleaned, gType, rd.gId, banksAnn, banksPlug, availableSources, s)]);
        totalEnriched += 1;
      }
      if (newEntries.length && !cancelled) {
        setCollapsedAiCBySongId((prev) => {
          const next = new Map(prev);
          for (const [k, v] of newEntries) next.set(k, v);
          return next;
        });
      }
      i += BATCH;
      if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(tick, { timeout: 200 });
      } else {
        setTimeout(tick, 0);
      }
    };
    // Premier tick après render initial.
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(tick, { timeout: 50 });
    } else {
      setTimeout(tick, 0);
    }
    return () => { cancelled = true; };
  }, [activeSongs, songRowData, banksAnn, banksPlug, banksOne, banksOnePlus, availableSources]);

  const tmpTopRecBySongId = useMemo(() => {
    if (!hasTMPDevice || !activeSongs.length) return new Map();
    const map = new Map();
    for (const s of activeSongs) {
      const rd = songRowData.get(s.id);
      const recs = recommendTMPPatch(TMP_FACTORY_PATCHES, s, rd?.g || null, profile);
      if (recs[0]) map.set(s.id, recs[0]);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTMPDevice, activeSongs, songRowData]);

  if (typeof window !== 'undefined' && window.__TONEX_PERF) {
    if (!window.__tonexRenderStart) window.__tonexRenderStart = performance.now();
  }
  useEffect(() => {
    if (typeof window !== 'undefined' && window.__TONEX_PERF && window.__tonexRenderStart) {
      const dt = performance.now() - window.__tonexRenderStart;
      // eslint-disable-next-line no-console
      console.log(`[perf] ListScreen mount: ${dt.toFixed(1)}ms (${activeSongs.length} morceaux, ${enabledDevicesForRender.length} devices actifs)`);
      window.__tonexRenderStart = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [expandedId, setExpandedId] = useState(null);
  const [showTopGuitars, setShowTopGuitars] = useState(false);
  const [editingSetlists, setEditingSetlists] = useState(false);
  // visibleCount déclaré plus haut (avant collapsedAiCBySongId, Phase 7.42).
  const [showDeviceRows, setShowDeviceRows] = useState(false);
  useEffect(() => {
    setShowDeviceRows(false);
    const id = setTimeout(() => setShowDeviceRows(true), 80);
    return () => clearTimeout(id);
  }, [activeSlId, sort]);
  useEffect(() => { setVisibleCount(12); }, [activeSlId, sort]);
  useEffect(() => {
    if (visibleCount >= activeSongs.length) return;
    const ric = typeof window !== 'undefined' && window.requestIdleCallback;
    const handle = ric
      ? window.requestIdleCallback(() => setVisibleCount((c) => Math.min(c + 18, activeSongs.length)), { timeout: 200 })
      : setTimeout(() => setVisibleCount((c) => Math.min(c + 18, activeSongs.length)), 60);
    return () => {
      if (ric) window.cancelIdleCallback(handle);
      else clearTimeout(handle);
    };
  }, [visibleCount, activeSongs.length]);

  const [newSlName, setNewSlName] = useState('');
  const [editSlId, setEditSlId] = useState(null);
  const [editSlName, setEditSlName] = useState('');
  const [removedSong, setRemovedSong] = useState(null);
  const removedTimeoutRef = useRef(null);
  const removeSongFromActiveSetlist = (songId, songTitle) => {
    if (!activeSlId) return;
    const currentSl = setlists.find((s) => s.id === activeSlId);
    if (!currentSl) return;
    const position = currentSl.songIds.indexOf(songId);
    if (position < 0) return;
    onSetlists((p) => p.map((sl) => sl.id === activeSlId ? { ...sl, songIds: sl.songIds.filter((x) => x !== songId) } : sl));
    // Phase 7.55.7 S3 — En mode démo, onSetlists ci-dessus est wrappé
    // par wrapDemoGuard qui affiche déjà le toast 🔒 et bloque l'écriture.
    // Pas de toast undo "morceau retiré" qui laissait croire à une vraie
    // suppression (rapport Cowork v8.14.191 BUG 3).
    if (profile?.isDemo === true) return;
    if (removedTimeoutRef.current) { clearTimeout(removedTimeoutRef.current); removedTimeoutRef.current = null; }
    setRemovedSong({ slId: activeSlId, songId, songTitle: songTitle || songId, position, expiresAt: Date.now() + 5000 });
    removedTimeoutRef.current = setTimeout(() => { setRemovedSong(null); removedTimeoutRef.current = null; }, 5000);
  };
  const undoRemoveSong = () => {
    if (!removedSong) return;
    const { slId, songId, position } = removedSong;
    onSetlists((p) => p.map((sl) => {
      if (sl.id !== slId) return sl;
      if (sl.songIds.includes(songId)) return sl;
      const ids = [...sl.songIds];
      ids.splice(Math.min(position, ids.length), 0, songId);
      return { ...sl, songIds: ids };
    }));
    if (removedTimeoutRef.current) { clearTimeout(removedTimeoutRef.current); removedTimeoutRef.current = null; }
    setRemovedSong(null);
  };
  useEffect(() => () => { if (removedTimeoutRef.current) clearTimeout(removedTimeoutRef.current); }, []);
  const createSetlist = () => { if (!newSlName.trim()) return; onSetlists((p) => [...p, { id: `sl_${Date.now()}`, name: newSlName.trim(), songIds: [], profileIds: [activeProfileId] }]); setNewSlName(''); };
  const deleteSetlist = (id) => {
    const sl = setlists.find((s) => s.id === id);
    if (!sl) return;
    const n = sl.songIds.length;
    const detail = n > 0
      ? '\n' + tFormat('list.delete-detail', { songs: tPlural('list.songs-count', n, {}, { one: '1 morceau', other: '{count} morceaux' }) }, 'Elle contient {songs} (les morceaux ne sont pas supprimés de la base).')
      : '';
    if (!window.confirm(tFormat('list.delete-setlist-confirm', { name: sl.name, detail }, 'Supprimer la setlist "{name}" ?{detail}'))) return;
    onSetlists((p) => p.filter((s) => s.id !== id));
    if (activeSlId === id) { setActiveSlId(null); onChecked([]); }
  };
  const renameSetlist = (id, name) => { onSetlists((p) => p.map((s) => s.id === id ? { ...s, name } : s)); setEditSlId(null); };
  // Phase 7.71 — checkboxes + sélection multiple supprimées (devenues
  // inutiles avec le mode scène Phase 4 LiveScreen). Remplacé par un
  // mode édition local qui révèle la corbeille 🗑 par morceau.
  const inp = { background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-md)', padding: '6px 10px', fontSize: 12, boxSizing: 'border-box' };
  // Reset le mode édition quand on change de setlist active
  const [editingSongs, setEditingSongs] = useState(false);
  useEffect(() => { setEditingSongs(false); }, [activeSlId]);

  // ─── Tout améliorer ───
  const IMPROVE_THRESHOLD = 90;
  const IMPROVE_MAX_ROUNDS = 3;
  const [improving, setImproving] = useState(false);
  const [improveStatus, setImproveStatus] = useState(null);
  const [cancelRequested, setCancelRequested] = useState(false);
  const improveCancelRef = useRef(false);
  const songDbRef = useRef(songDb);
  songDbRef.current = songDb;
  const getSongsToImprove = () => {
    const guitars = allGuitars || GUITARS;
    const sl = activeSl;
    const arr = sl ? (sl.songIds || []).map((id) => songDbRef.current.find((s) => s.id === id)).filter(Boolean) : [...songDbRef.current];
    return arr.filter((s) => {
      if (!s.aiCache) return false;
      const ig = getIg(s, guitars); const savedGId = sl?.guitars?.[s.id]; const gId = savedGId || ig?.[0] || '';
      const best = getBestResult(s, gId, s.aiCache?.result);
      return best ? bestScoreOf(best) < IMPROVE_THRESHOLD : false;
    });
  };
  const [improveBadgeCount, setImproveBadgeCount] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      const t0 = performance.now();
      const count = getSongsToImprove().length;
      if (typeof window !== 'undefined' && window.__TONEX_PERF) {
        // eslint-disable-next-line no-console
        console.log(`[perf] improveBadgeCount calc: ${(performance.now() - t0).toFixed(0)}ms`);
      }
      setImproveBadgeCount(count);
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songDb, activeSl, banksAnn, banksPlug, allGuitars]);

  // Phase 7.81 — rigSnapshot scopé au rig du profil actif (pas allRigsGuitars).
  // allRigsGuitars (union all-rigs Phase 3.6) reste utilisé pour le PROMPT
  // fetchAI, mais le rigSnapshot stocké au cache doit représenter le rig
  // propre du user pour ne pas générer de faux positifs rigStale quand un
  // AUTRE profil ajoute/perd une custom guitar (pollution myGuitars
  // cross-profile observée Phase 7.74.x).
  const currentRigSnapshot = useMemo(() => computeRigSnapshot(allGuitars || GUITARS), [allGuitars]);
  // Phase 8.x (2026-05-27) — user bass-actif : utilisé pour détecter
  // les aiCache sans bass_recommendation (cf bassStale dans SongDetailCard).
  const userHasBassRig = profile?.instruments?.includes('bass')
    && ((profile?.myBasses || []).length > 0
      || (profile?.myBassAmps || []).length > 0);
  // Phase 9.9 — empreinte profil courante + raisons par morceau.
  const currentFingerprint = useMemo(() => computeAnalysisFingerprint(profile),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile?.availableSources, profile?.myGuitarAmps, profile?.myBassAmps, profile?.myPedals, profile?.instruments, profile?.recoMode]);
  // Raisons fingerprint d'un morceau ANALYSÉ (vide si jamais analysé — géré
  // à part par le ··· pending). Sert au badge bandeau + bouton recalcul ciblé.
  const fpStaleReasons = (s) => (s.aiCache
    ? diffAnalysisFingerprint(s.aiCache.fingerprint, currentFingerprint) : []);
  // v9.7.34 — Levier 1 mono-langue : aiCache stamped _locale différent
  // de la locale active = stale (re-fetch dans la bonne langue).
  const currentLocale = profile?.language || 'fr';
  const isStaleSong = (s) => {
    if (!s.aiCache) return true;
    if (s.aiCache.rigSnapshot && s.aiCache.rigSnapshot !== currentRigSnapshot) return true;
    // v9.7.34 — locale stale (user a switché FR↔EN↔ES).
    const cachedLocale = s.aiCache.result?._locale;
    if (cachedLocale && cachedLocale !== currentLocale) return true;
    // Phase 9.9 — profil modifié depuis l'analyse (sources/amplis/pédales/
    // instruments/recoMode) OU analyse antérieure à la feature (legacy).
    if (fpStaleReasons(s).length > 0) return true;
    // bassStale : aiCache sans bass_recommendation OU (vague B) bass_recommendation
    // présent mais sans cot_step2_basses (= pré-vague-B, manque scoring/EQ/FX).
    if (userHasBassRig && s.aiCache?.result?.cot_step1) {
      const br = s.aiCache.result.bass_recommendation;
      if (br === null || br === undefined
        || (typeof br === 'object' && br.cot_step2_basses === undefined)) return true;
    }
    return false;
  };
  const missingCount = useMemo(() => (activeSongs || []).filter(isStaleSong).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeSongs, currentRigSnapshot, userHasBassRig, currentFingerprint, currentLocale]);
  // v9.7.41 — Estimation parallèle (au lieu de séquentiel × 40s qui
  // affichait des fausses estimations 5× trop hautes).
  // Formule : ceil(N/CONCURRENCY) × ~33s par vague.
  // Mesures réelles : 6 morceaux = 36s · 13 = 104s · 16 = 135s · 21 = 160s
  // → cohérent avec ~33s/vague et concurrency 5.
  const BATCH_CONCURRENCY = 5;
  const SEC_PER_WAVE = 33;
  const estimateBatchSec = (count) => Math.ceil(count / BATCH_CONCURRENCY) * SEC_PER_WAVE;
  const formatDuration = (sec) => {
    if (sec <= 0) return '';
    if (sec < 60) return `${sec}s`;
    return `${Math.max(1, Math.round(sec / 60))} min`;
  };
  const missingDurationStr = formatDuration(estimateBatchSec(missingCount));
  // Phase 9.9 — union des raisons fingerprint sur les morceaux analysés de la
  // setlist active → bandeau explicatif en tête (évite de flagger chaque ligne
  // pour un changement global). Map des labels via i18n.
  const FP_REASON_LABELS = {
    sources: t('list.stale-reason-sources', 'sources de presets'),
    amps: t('list.stale-reason-amps', 'amplis'),
    pedals: t('list.stale-reason-pedals', 'pédales'),
    instruments: t('list.stale-reason-instruments', 'instruments'),
    recoMode: t('list.stale-reason-recomode', 'mode de reco'),
    legacy: t('list.stale-reason-legacy', 'réglages récents'),
  };
  const fpStaleInfo = useMemo(() => {
    const reasons = new Set();
    let count = 0;
    for (const s of (activeSongs || [])) {
      const r = fpStaleReasons(s);
      if (r.length > 0) { count += 1; r.forEach((d) => reasons.add(d)); }
    }
    return { count, reasons: Array.from(reasons) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSongs, currentFingerprint]);
  const [analyzeAllStatus, setAnalyzeAllStatus] = useState(null);
  const analyzeCancelRef = useRef(false);
  // v9.7.37 — Jauge animée rAF (v9.7.20) SUPPRIMÉE.
  // Avec batch parallèle concurrency 3, la progression avance par paliers
  // naturels rapprochés. Plus besoin d'interpoler une fake progress entre
  // paliers — le `transition: width 0.3s ease-out` CSS suffit pour adoucir
  // les transitions. Bonus : supprime les centaines de
  // `[Violation] requestAnimationFrame handler took <N> ms` qui polluaient
  // la console pendant le batch.
  const isDemo = profile?.isDemo === true;
  // Phase 9.9 — recalcul ciblé d'UN morceau (bouton sur le header de ligne,
  // activable en vue repliée). Analyse complète (basses/amplis/pédales).
  const [recalcingId, setRecalcingId] = useState(null);
  const recalcSong = async (s) => {
    if (isDemo || recalcingId || !s) return;
    setRecalcingId(s.id);
    try {
      const guitars = allGuitars || GUITARS;
      const historicalFeedback = Array.isArray(s.feedback) && s.feedback.length > 0
        ? s.feedback.map((f) => f.text).filter(Boolean).join('. ')
        : null;
      const r = await fetchAI(s, '', banksAnn, banksPlug, aiProvider, aiKeys, guitars, historicalFeedback, null, profile?.recoMode || 'balanced', guitarBias, s.outputContext || profile?.outputContext || 'frfr', profile?.preferredStyles || [], (profile?.myBasses || []).map((id) => findBass(id)).filter(Boolean), (profile?.myBassAmps || []).map((id) => findBassAmp(id)).filter(Boolean), (profile?.myGuitarAmps || []).map((id) => findGuitarAmp(id)).filter(Boolean), (profile?.myPedals || []).map((id) => findPedal(id)).filter(Boolean));
      const rigSnapshot = computeRigSnapshot(guitars);
      const fingerprint = computeAnalysisFingerprint(profile);
      const newCache = { ...updateAiCache(s.aiCache, '', r, { rigSnapshot, fingerprint }), sv: SCORING_VERSION };
      if (onAiCacheUpdate) onAiCacheUpdate(s.id, newCache);
      else onSongDb((p) => p.map((x) => x.id === s.id ? { ...x, aiCache: newCache } : x));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[recalcSong] Skip "${s.title}":`, e?.message || e);
    }
    setRecalcingId(null);
  };
  const analyzeMissingAll = async () => {
    if (isDemo) return; // Phase 7.51.2 — pas de fetchAI en mode démo
    analyzeCancelRef.current = false;
    const missing = (activeSongs || []).filter(isStaleSong);
    if (!missing.length) return;
    const guitars = allGuitars || GUITARS;
    const total = missing.length;
    // v9.7.37 — Parallélisation. v9.7.38 — concurrency 3 → 5 après mesure
    // batch 3 morceaux : speedup 2.70x sur concurrency 3 (90% efficacité),
    // Gemini Flash scale presque linéairement, pas de bottleneck rate-limit
    // observé. Pousser à 5 pour gratter ~15% supplémentaire sur les gros
    // batches (30 morceaux : ~5min → ~4min). Retry quota 429 reste câblé.
    // Chrono détaillé console pour mesurer la perf en condition réelle.
    const CONCURRENCY = 5;
    const batchStart = performance.now();
    const perFetchTimings = [];
    // eslint-disable-next-line no-console
    console.group(`[batch] analyzeMissingAll: ${total} morceaux, concurrency ${CONCURRENCY}`);
    let nextIdx = 0;
    let completed = 0;
    const inFlight = new Set();
    setAnalyzeAllStatus({ completed: 0, total, inFlightCount: 0 });
    const worker = async () => {
      while (!analyzeCancelRef.current) {
        const myIdx = nextIdx++;
        if (myIdx >= total) return;
        const s = missing[myIdx];
        inFlight.add(s.id);
        setAnalyzeAllStatus({ completed, total, inFlightCount: inFlight.size });
        const fetchStart = performance.now();
        try {
          const historicalFeedback = Array.isArray(s.feedback) && s.feedback.length > 0
            ? s.feedback.map((f) => f.text).filter(Boolean).join('. ')
            : null;
          // Phase 7.66 — Prompt scopé au rig du profil actif.
          // Phase 9.9 — passe basses/amplis/pédales pour analyse COMPLÈTE.
          const r = await fetchAI(s, '', banksAnn, banksPlug, aiProvider, aiKeys, guitars, historicalFeedback, null, profile?.recoMode || 'balanced', guitarBias, s.outputContext || profile?.outputContext || 'frfr', profile?.preferredStyles || [], (profile?.myBasses || []).map((id) => findBass(id)).filter(Boolean), (profile?.myBassAmps || []).map((id) => findBassAmp(id)).filter(Boolean), (profile?.myGuitarAmps || []).map((id) => findGuitarAmp(id)).filter(Boolean), (profile?.myPedals || []).map((id) => findPedal(id)).filter(Boolean));
          const fetchDuration = Math.round(performance.now() - fetchStart);
          perFetchTimings.push(fetchDuration);
          // eslint-disable-next-line no-console
          console.log(`[batch] ${myIdx + 1}/${total} "${s.title}" — ${fetchDuration}ms`);
          if (analyzeCancelRef.current) return;
          // Phase 7.81 — rigSnapshot scopé profil actif.
          const rigSnapshot = computeRigSnapshot(guitars);
          // Phase 9.9 — empreinte profil au moment de l'analyse.
          const fingerprint = computeAnalysisFingerprint(profile);
          // Phase 7.54 — Écrit dans profile.aiCache via setSongAiCache.
          const newCache = { ...updateAiCache(s.aiCache, '', r, { rigSnapshot, fingerprint }), sv: SCORING_VERSION };
          if (onAiCacheUpdate) onAiCacheUpdate(s.id, newCache);
          else onSongDb((p) => p.map((x) => x.id === s.id ? { ...x, aiCache: newCache } : x));
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn(`[batch] Skip "${s.title}":`, e?.message || e);
        } finally {
          inFlight.delete(s.id);
          completed += 1;
          setAnalyzeAllStatus({ completed, total, inFlightCount: inFlight.size });
        }
      }
    };
    // Lance N workers concurrents qui se distribuent la queue.
    await Promise.all(Array.from(
      { length: Math.min(CONCURRENCY, total) },
      () => worker(),
    ));
    const batchTotal = Math.round(performance.now() - batchStart);
    if (perFetchTimings.length > 0) {
      const sum = perFetchTimings.reduce((a, b) => a + b, 0);
      const avg = Math.round(sum / perFetchTimings.length);
      const min = Math.min(...perFetchTimings);
      const max = Math.max(...perFetchTimings);
      // eslint-disable-next-line no-console
      console.log(`[batch] TOTAL: ${(batchTotal / 1000).toFixed(1)}s wall-clock · ${perFetchTimings.length} fetches`);
      // eslint-disable-next-line no-console
      console.log(`[batch] Per-fetch: min ${min}ms · avg ${avg}ms · max ${max}ms`);
      // eslint-disable-next-line no-console
      console.log(`[batch] Speedup vs séquentiel : ${(sum / batchTotal).toFixed(2)}x (sum fetches ${(sum / 1000).toFixed(1)}s / wall ${(batchTotal / 1000).toFixed(1)}s)`);
    }
    // eslint-disable-next-line no-console
    console.groupEnd();
    setAnalyzeAllStatus(null);
    analyzeCancelRef.current = false;
  };
  const improveAll = async () => {
    if (isDemo) return; // Phase 7.51.2 — pas de fetchAI en mode démo
    improveCancelRef.current = false;
    setCancelRequested(false);
    setImproving(true);
    const guitars = allGuitars || GUITARS;
    const waitOrCancel = (p) => new Promise((resolve, reject) => {
      let done = false;
      const tick = setInterval(() => {
        if (improveCancelRef.current && !done) { done = true; clearInterval(tick); reject(new Error('cancelled')); }
      }, 120);
      p.then((r) => { if (!done) { done = true; clearInterval(tick); resolve(r); } },
        (e) => { if (!done) { done = true; clearInterval(tick); reject(e); } });
    });
    for (let round = 1; round <= IMPROVE_MAX_ROUNDS; round++) {
      if (improveCancelRef.current) break;
      const toImprove = getSongsToImprove();
      if (toImprove.length === 0) break;
      for (let i = 0; i < toImprove.length; i++) {
        if (improveCancelRef.current) break;
        const s = toImprove[i];
        const ig = getIg(s, guitars);
        const savedGId = activeSl?.guitars?.[s.id];
        const gId = savedGId || ig?.[0] || '';
        setImproveStatus({ current: i + 1, total: toImprove.length, round, songTitle: s.title });
        try {
          const historicalFeedback = Array.isArray(s.feedback) && s.feedback.length > 0
            ? s.feedback.map((f) => f.text).filter(Boolean).join('. ')
            : null;
          // Phase 7.66 — Prompt scopé au rig profil actif.
          const r = await waitOrCancel(fetchAI(s, gId, banksAnn, banksPlug, aiProvider, aiKeys, guitars, historicalFeedback, null, profile?.recoMode || 'balanced', guitarBias, s.outputContext || profile?.outputContext || 'frfr', profile?.preferredStyles || [], (profile?.myBasses || []).map((id) => findBass(id)).filter(Boolean), (profile?.myBassAmps || []).map((id) => findBassAmp(id)).filter(Boolean), (profile?.myGuitarAmps || []).map((id) => findGuitarAmp(id)).filter(Boolean), (profile?.myPedals || []).map((id) => findPedal(id)).filter(Boolean)));
          if (improveCancelRef.current) break;
          // Phase 7.54 — Écrit dans profile.aiCache. Phase 9.9 — empreinte profil.
          const newCache = updateAiCache(s.aiCache, gId, r, { rigSnapshot: computeRigSnapshot(guitars), fingerprint: computeAnalysisFingerprint(profile) });
          if (onAiCacheUpdate) onAiCacheUpdate(s.id, newCache);
          else onSongDb((p) => p.map((x) => x.id === s.id ? { ...x, aiCache: newCache } : x));
        } catch (e) { if (improveCancelRef.current) break; /* skip */ }
      }
      if (improveCancelRef.current) break;
    }
    setImproving(false); setImproveStatus(null); setCancelRequested(false);
  };

  return (
    <div>
      {/* Sélecteur setlist compact */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <select value={activeSlId || ''} onChange={(e) => { const v = e.target.value; setActiveSlId(v || null); onChecked([]); const ss = v && setlists.find((s) => s.id === v)?.sort; setSort(ss && ss !== 'default' ? ss : 'artist'); }} style={{ flex: 1, background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-strong,var(--a15))', borderRadius: 'var(--r-md)', padding: '10px 12px', fontSize: 13, cursor: 'pointer', minHeight: 44, maxWidth: 480 }}>
          <option value="">{tFormat('list.all-songs', { count: mySongIds ? songDb.filter((s) => mySongIds.has(s.id)).length : songDb.length }, 'Tous les morceaux ({count})')}</option>
          {setlists.map((sl) => <option key={sl.id} value={sl.id}>{sl.name} ({sl.songIds.length})</option>)}
        </select>
        {/* Phase 7.82.1 — Désactive le 🎤 Live mode en profil démo
            (la Phase 7.82 ne masquait que le CTA HomeScreen, ce bouton
            de la barre Setlists restait actif → le visiteur démo pouvait
            quand même entrer en LiveScreen et tomber sur le bug #6
            "preset not determined"). Cohérence avec HomeScreen. */}
        {/* Phase 7.85 — minHeight 44 + minWidth 44 iOS HIG sur boutons icônes
            (rapport Cowork B12 P1 : ✏️ 34×33px sous seuil 44). */}
        {typeof onLive === 'function' && !isDemo && activeSongs.length > 0 && <button data-testid="list-screen-live" onClick={() => onLive(activeSlId || null)} title={t('list.live-mode', 'Mode scène plein écran')} style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', color: 'var(--accent)', borderRadius: 'var(--r-md)', padding: '8px 12px', fontSize: 15, cursor: 'pointer', flexShrink: 0, fontWeight: 700, minHeight: 44, minWidth: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><NavIcon id="live" size={18}/></button>}
        <button title={editingSetlists ? t('list.edit-done', 'Terminer') : t('list.edit-setlist-title', 'Modifier les setlists')} onClick={() => setEditingSetlists(!editingSetlists)} style={{ background: editingSetlists ? 'var(--accent-bg)' : 'var(--a5)', border: '1px solid ' + (editingSetlists ? 'var(--accent-border)' : 'var(--a10)'), color: editingSetlists ? 'var(--accent)' : 'var(--text-muted)', borderRadius: 'var(--r-md)', padding: '8px 12px', fontSize: 13, cursor: 'pointer', flexShrink: 0, minHeight: 44, minWidth: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{editingSetlists ? '×' : <NavIcon id="pen" size={16}/>}</button>
      </div>
      {editingSetlists && (
        <div style={{ background: 'var(--a3)', border: '1px solid var(--a7)', borderRadius: 'var(--r-md)', padding: 10, marginBottom: 8 }}>
          {setlists.map((sl) => (
            <div key={sl.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {editSlId === sl.id
                  ? <InlineRenameInput initialName={sl.name} onSave={(name) => renameSetlist(sl.id, name)} onCancel={() => setEditSlId(null)} inp={inp} disabled={isDemo}/>
                  : (
                    <>
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{sl.name} <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>({sl.songIds.length})</span></span>
                      {sl.songIds.length > 0 && <button data-testid={`setlist-pdf-${sl.id}`} title={`Export PDF — ${sl.name}`} onClick={() => {
                        const songs = sl.songIds.map((id) => songDb.find((s) => s.id === id)).filter(Boolean);
                        const doc = exportSetlistPdf(sl, songs, { profile, banksAnn, banksPlug });
                        doc.save(`${sl.name.replace(/[^a-z0-9_-]+/gi, '_') || 'setlist'}.pdf`);
                      }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}><NavIcon id="doc" size={16}/></button>}
                      <button title={isDemo ? t('demo.blocked', 'Action désactivée en mode démo') : t('list.rename-setlist', 'Renommer la setlist')} onClick={() => setEditSlId(sl.id)} disabled={isDemo} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}><NavIcon id="pen" size={16}/></button>
                      {sl.songIds.length > 0 && <button
                        data-testid={`setlist-empty-${sl.id}`}
                        title={isDemo ? t('demo.blocked', 'Action désactivée en mode démo') : t('list.empty-setlist-title', 'Vider la setlist (garde la setlist mais retire tous les morceaux)')}
                        onClick={() => {
                          const n = sl.songIds.length;
                          const msg = tFormat('list.empty-setlist-confirm', { name: sl.name, songs: tPlural('list.songs-count', n, {}, { one: '1 morceau', other: '{count} morceaux' }) }, 'Vider "{name}" ?\n\n{songs} vont être retirés de cette setlist.\n\nLes morceaux restent disponibles dans la base globale (Setlists → onglet Morceaux). La setlist "{name}" continue d\'exister, juste vide.');
                          if (!window.confirm(msg)) return;
                          onSetlists((p) => p.map((s) => s.id === sl.id ? { ...s, songIds: [] } : s));
                        }}
                        disabled={isDemo}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}
                      ><NavIcon id="broom" size={16}/></button>}
                      {setlists.length > 1 && <button title={isDemo ? t('demo.blocked', 'Action désactivée en mode démo') : t('list.delete-setlist', 'Supprimer la setlist')} onClick={() => deleteSetlist(sl.id)} disabled={isDemo} style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 11, cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}><NavIcon id="trash" size={16}/></button>}
                    </>
                  )}
              </div>
              {profiles && Object.keys(profiles).length > 1 && editSlId !== sl.id && (() => {
                const slProfileIds = Array.isArray(sl.profileIds) ? sl.profileIds : [];
                const profileEntries = Object.values(profiles);
                return (
                  <div data-testid={`setlist-share-${sl.id}`} style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('list.share', 'Partager :')}</span>
                    {profileEntries.map((pf) => {
                      const isMe = pf.id === activeProfileId;
                      const isChecked = slProfileIds.includes(pf.id);
                      const onClick = () => {
                        if (isMe || isDemo) return;
                        onSetlists((p) => p.map((s) => s.id === sl.id ? toggleSetlistProfile(s, pf.id, activeProfileId) : s));
                      };
                      const pillDisabled = isMe || isDemo;
                      return (
                        <button
                          key={pf.id}
                          data-testid={`setlist-share-pill-${sl.id}-${pf.id}`}
                          onClick={onClick}
                          disabled={pillDisabled}
                          title={isDemo ? t('demo.blocked', 'Action désactivée en mode démo') : (isMe ? t('list.share-you', 'Toi (verrouillé)') : (isChecked ? t('list.share-remove', 'Cliquer pour retirer') : t('list.share-add', 'Cliquer pour partager')))}
                          style={{
                            background: isChecked ? (isMe ? 'var(--accent-soft)' : 'var(--accent-bg)') : 'var(--a4)',
                            border: `1px solid ${isChecked ? 'var(--accent-border)' : 'var(--a8)'}`,
                            color: isChecked ? 'var(--accent)' : 'var(--text-dim)',
                            borderRadius: 'var(--r-sm)', padding: '2px 6px', fontSize: 9,
                            fontWeight: isChecked ? 700 : 500, cursor: pillDisabled ? (isDemo ? 'not-allowed' : 'default') : 'pointer',
                            opacity: isDemo ? 0.5 : (isMe ? 0.85 : 1),
                          }}
                        >
                          {isChecked ? '✓ ' : ''}{pf.name || pf.id}{isMe ? ' (' + t('list.share-me', 'moi') + ')' : ''}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          ))}
          <InlineRenameInput initialName="" onSave={(name) => { onSetlists((p) => [...p, { id: `sl_${Date.now()}`, name, songIds: [], profileIds: [activeProfileId] }]); }} onCancel={() => {}} inp={inp} placeholder={t('list.new-setlist-placeholder', 'Nouvelle setlist...')} buttonLabel={t('list.create', '+ Creer')} disabled={isDemo}/>
        </div>
      )}

      {/* Barre d'actions compacte */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tPlural('list.songs-count', activeSongs.length, {}, { one: '1 morceau', other: '{count} morceaux' })}</span>
        <select value={sort} onChange={(e) => saveSort(e.target.value)} style={{ background: 'var(--bg-card)', color: 'var(--text-sec)', border: '1px solid var(--a10)', borderRadius: 'var(--r-sm)', padding: '8px 10px', fontSize: 12, cursor: 'pointer', minHeight: 44 }}>
          <option value="artist">{t('list.sort-artist', 'Par artiste')}</option>
          <option value="alpha">{t('list.sort-alpha', 'A → Z')}</option>
        </select>
        {/* v9.7.30 — Cowork audit P0-B : à 375px (iPhone mini), la toolbar
            (Guitares · Éditer · Analyser/MAJ N · +) totalisait ~411px sur
            369px utiles → bouton + sortait du viewport sans scroll horiz
            possible. flexWrap permet aux boutons de wrap sur 2 lignes
            au lieu de déborder. Sur ≥393px tout rentre déjà sur 1 ligne. */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {activeSongs.length > 0 && <button onClick={() => setShowTopGuitars(!showTopGuitars)} style={{ fontSize: 10, color: showTopGuitars ? 'var(--accent)' : 'var(--text-muted)', background: showTopGuitars ? 'var(--accent-bg)' : 'var(--a5)', border: '1px solid ' + (showTopGuitars ? 'var(--accent-border)' : 'var(--a10)'), borderRadius: 'var(--r-sm)', padding: '3px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>{t('list.guitars', 'Guitares')}</button>}
          {/* Phase 7.71 — Mode édition setlist : révèle la corbeille
              individuelle 🗑 par morceau. Visible uniquement quand une
              setlist est active (pas en vue "Tous les morceaux"). */}
          {activeSlId && activeSongs.length > 0 && (
            <button
              onClick={() => setEditingSongs((x) => !x)}
              // Phase 7.55.7 fix Cowork — cible touch 36px min (vs 23-25px)
              style={{ fontSize: 11, minHeight: 44, color: editingSongs ? 'var(--wine-400)' : 'var(--text-muted)', background: editingSongs ? 'rgba(155,58,44,0.12)' : 'var(--a5)', border: '1px solid ' + (editingSongs ? 'rgba(155,58,44,0.3)' : 'var(--a10)'), borderRadius: 'var(--r-sm)', padding: '7px 12px', cursor: 'pointer', fontWeight: editingSongs ? 700 : 500, whiteSpace: 'nowrap' }}
              title={t('list.edit-setlist-title', "Mode édition : permet de retirer les morceaux de la setlist (sans toucher à la base globale)")}
            >
              {editingSongs
                ? t('list.edit-done', '✅ Terminer')
                : t('list.edit-songs-flat', 'Éditer la setlist')}
            </button>
          )}
          {missingCount > 0 && !analyzeAllStatus && <button
            data-testid="list-screen-analyze-missing"
            onClick={() => {
              // v9.7.41 — Estimation parallèle ceil(N/5) × 33s par vague.
              const durStr = formatDuration(estimateBatchSec(missingCount));
              const msg = tFormat('list.analyze-confirm-flat', { songs: tPlural('list.songs-count', missingCount, {}, { one: '1 morceau', other: '{count} morceaux' }), duration: durStr }, "Analyser/actualiser {songs} ?\n\nInclut :\n• Morceaux sans analyse IA\n• Morceaux dont l'analyse date d'avant un changement de rig (guitare ajoutée/retirée)\n\nDurée estimée : {duration} (batch parallèle 5 fetches).\nLa clé Gemini partagée sera utilisée. Tu peux annuler à tout moment.");
              if (!window.confirm(msg)) return;
              analyzeMissingAll();
            }}
            title={tFormat('list.analyze-title', { count: missingCount }, '{count} morceau(x) à analyser ou actualiser après modif du rig.')}
            style={{ fontSize: 11, minHeight: 44, color: 'var(--accent)', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 'var(--r-sm)', padding: '7px 12px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}
          >{tFormat('list.analyze-button-flat', { count: missingCount, duration: missingDurationStr }, 'Analyser/MAJ {count} (~{duration})')}</button>}
          {analyzeAllStatus && (() => {
            // v9.7.37 — Format parallèle : {completed, total, inFlightCount}.
            // Plus de fake animation rAF (v9.7.20 obsolète : avec concurrency 3
            // la barre avance par paliers rapprochés naturellement, pas besoin
            // d'interpoler). transition CSS 0.3s suffit pour adoucir.
            const { completed, total, inFlightCount } = analyzeAllStatus;
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
            return (
              <button
                data-testid="list-screen-analyze-cancel"
                onClick={() => { analyzeCancelRef.current = true; }}
                style={{
                  fontSize: 11,
                  minHeight: 44,
                  color: 'var(--wine-400)',
                  background: 'rgba(155,58,44,0.12)',
                  border: '1px solid rgba(155,58,44,0.3)',
                  borderRadius: 'var(--r-sm)',
                  padding: '7px 12px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  position: 'relative',
                  overflow: 'hidden',
                  minWidth: 180,
                  maxWidth: 320,
                }}
                title={tFormat('list.cancel-analyze', { current: completed, total }, "Annuler l'analyse en cours ({current}/{total})")}
              >
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${pct}%`,
                    background: 'rgba(155,58,44,0.28)',
                    transition: 'width 0.3s ease-out',
                    zIndex: 0,
                    pointerEvents: 'none',
                  }}
                />
                <span style={{ position: 'relative', zIndex: 1 }}>
                  {pct}% · {completed}/{total}
                  {inFlightCount > 0 && ` · ${inFlightCount} en cours`}
                  {' ⏸'}
                </span>
              </button>
            );
          })()}
          {/* Phase 7.71 — Bouton "Retirer non-cochés" supprimé (Phase 5.5)
              car dépendait des checkboxes. Mode édition (bouton ci-dessus)
              + corbeille par morceau remplace ce workflow. */}
          <button onClick={() => setShowAdd(true)} disabled={isDemo} title={isDemo ? t('demo.blocked', 'Action désactivée en mode démo') : t('list.add-song', 'Ajouter un morceau')} style={{ fontSize: 14, minWidth: 44, minHeight: 44, color: 'var(--accent)', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 'var(--r-sm)', padding: '3px 12px', cursor: isDemo ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: isDemo ? 0.5 : 1, whiteSpace: 'nowrap' }}>+</button>
        </div>
      </div>

      {/* Phase 9.9 — Bandeau global : profil modifié depuis des analyses
          (sources/amplis/pédales/instruments/recoMode) ou analyses antérieures
          aux dernières features. Un seul bandeau plutôt que flagger chaque
          ligne (évite la pollution visuelle). La raison aide l'user à décider
          de recalculer ou non. */}
      {activeSlId && fpStaleInfo.count > 0 && !analyzeAllStatus && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8, padding: '8px 12px', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 'var(--r-md)' }}>
          <NavIcon id="info" size={16}/>
          <span style={{ flex: 1, minWidth: 160, fontSize: 11, color: 'var(--text-sec)' }}>
            {tFormat('list.fp-stale-banner', { count: fpStaleInfo.count, reasons: fpStaleInfo.reasons.map((r) => FP_REASON_LABELS[r] || r).join(', ') }, '{count} morceau(x) analysé(s) avant un changement de profil ({reasons}). Recalcule pour des recos à jour.')}
          </span>
          {!isDemo && <button
            onClick={() => {
              // v9.7.41 — Estimation parallèle ceil(N/5) × 33s par vague.
              const durStr = formatDuration(estimateBatchSec(missingCount));
              const msg = tFormat('list.fp-stale-confirm', { count: missingCount, duration: durStr }, 'Recalculer {count} morceau(x) ? Durée estimée : {duration}. La clé Gemini partagée sera utilisée.');
              if (!window.confirm(msg)) return;
              analyzeMissingAll();
            }}
            style={{ fontSize: 11, minHeight: 32, color: 'var(--accent)', background: 'var(--a5)', border: '1px solid var(--accent-border)', borderRadius: 'var(--r-sm)', padding: '5px 10px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}
          >{tFormat('list.fp-stale-recalc-all', { count: missingCount, duration: missingDurationStr }, 'Tout recalculer ({count}, ~{duration})')}</button>}
        </div>
      )}

      {/* Top guitares (dépliable) */}
      {showTopGuitars && activeSongs.length > 0 && (() => {
        const guitars = allGuitars || GUITARS;
        const songsByGuitar = {};
        activeSongs.forEach((s) => {
          const ig = getIg(s, guitars);
          let matched = false;
          ig.forEach((gId) => {
            if (!songsByGuitar[gId]) songsByGuitar[gId] = new Set();
            songsByGuitar[gId].add(s.id);
            matched = true;
          });
          const aiG = s.aiCache?.result?.ideal_guitar;
          if (aiG) {
            const m = findGuitarByAIName(aiG, guitars);
            if (m) {
              if (!songsByGuitar[m.id]) songsByGuitar[m.id] = new Set();
              songsByGuitar[m.id].add(s.id); matched = true;
            }
          }
          if (!matched) {
            const typeScores = { HB: 0, SC: 0, P90: 0 };
            ['HB', 'SC', 'P90'].forEach((t) => {
              const pA = getPA(s, t); const pP = getPP(s, t);
              const name = pA?.l || pP?.l;
              if (name) { const e = findCatalogEntry(name); if (e?.scores?.[t]) typeScores[t] = e.scores[t]; }
            });
            const bestType = Object.entries(typeScores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'HB';
            const matching = guitars.filter((g) => g.type === bestType);
            if (matching.length) {
              if (!songsByGuitar[matching[0].id]) songsByGuitar[matching[0].id] = new Set();
              songsByGuitar[matching[0].id].add(s.id);
            }
          }
        });
        const ranked = Object.entries(songsByGuitar)
          .map(([gId, songs]) => ({ gId, count: songs.size }))
          .sort((a, b) => b.count - a.count).slice(0, 3);
        if (!ranked.length) return null;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {ranked.map(({ gId, count }, i) => {
              const g = guitars.find((x) => x.id === gId);
              if (!g) return null;
              const rgb = TYPE_COLORS[g.type] || '99,102,241';
              return (
                <span key={gId} style={{ fontSize: 11, fontWeight: i === 0 ? 700 : 600, color: `rgb(${rgb})`, background: `rgba(${rgb},${i === 0 ? 0.15 : 0.08})`, border: `1px solid rgba(${rgb},${i === 0 ? 0.4 : 0.2})`, borderRadius: 'var(--r-md)', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {i === 0 && '🏆 '}{g.short || g.name}
                  <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{tPlural('list.songs-count', count, {}, { one: '1 morceau', other: '{count} morceaux' })}</span>
                </span>
              );
            })}
          </div>
        );
      })()}

      {activeSongs.length === 0 && <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}><div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center', color: 'var(--text-dim)' }}><NavIcon id="setlists" size={24}/></div><div style={{ fontSize: 14 }}>{t('list.empty', 'Setlist vide — clique sur "+ Ajouter"')}</div></div>}

      {(() => {
        let lastArtist = '';
        return activeSongs.slice(0, visibleCount).map((s, idx) => {
          const showArtistHeader = sort === 'artist' && s.artist !== lastArtist;
          if (showArtistHeader) lastArtist = s.artist;
          const playlistNumber = idx + 1;
          const rd = songRowData.get(s.id) || { ig: [], savedGId: undefined, gId: '', g: null };
          const ig = rd.ig;
          const savedGId = rd.savedGId;
          const gId = rd.gId;
          const g = rd.g;
          const gType = g?.type || 'HB';
          const isExpanded = expandedId === s.id;
          const aiCraw = getBestResult(s, gId, s.aiCache?.result) || null;
          const needRescore = isExpanded && aiCraw && gId && s.aiCache?.gId !== gId;
          // Pour la vue repliée (badges device), on utilise les recos
          // recomputées pour le profil actif (collapsedAiCBySongId).
          // Pour la vue dépliée, SongDetailCard fait son propre rescore.
          const aiC = needRescore
            ? enrichAIResult({ ...aiCraw }, gType, gId, banksAnn, banksPlug, undefined, s)
            : (collapsedAiCBySongId.get(s.id) || aiCraw);
          const aiPA = aiC?.preset_ann || null;
          const aiPP = aiC?.preset_plug || null;
          const hist = getSongHist(s);
          const presetRow = (emoji, label, banks, overrideScore, deviceId, deviceColor) => {
            const loc = findInBanks(label, banks);
            const entry = findCatalogEntry(label);
            const sc = overrideScore != null ? overrideScore : (aiC && gId && entry ? computeFinalScore(entry, gId, aiC.song_style, typeof aiC.target_gain === 'number' ? aiC.target_gain : null, resolveRefAmp(aiC.ref_amp)) : (gId ? guitarScore(label, gId) : (entry?.scores?.[gType] ?? null)));
            const ampName = entry?.amp || null;
            const scColorV = sc != null ? scoreColor(sc) : null;
            const scBgV = sc != null ? scoreBg(sc) : null;
            const isIdeal = label && aiC?.ideal_preset && label === aiC.ideal_preset;
            // Phase 7.61 — Audit couleurs badges : 1 règle homogène. Tous
            // les badges du row (slot, label, score%) prennent la couleur
            // du score (`scColorV`) pour cohérence visuelle. Fallback sur
            // la couleur device/slot uniquement si score absent (cas rare,
            // preset orphelin). Avant : badge slot en deviceColor, badge
            // label+score en scoreColor — mélange confus rapporté
            // 2026-05-17 par Sébastien.
            const unifiedColor = scColorV || deviceColor || (loc ? CC[loc.slot] : null) || 'var(--text-sec)';
            // Phase 7.55.7 S6 — Helpers badge centralisés (tokens.js).
            // Variants : slot (bank+slot), label (preset name+amp), score (% mono).
            // unifiedColor sert de couleur dynamique pour les 3 (cohérence visuelle
            // déjà acquise Phase 7.61, ici on harmonise le STYLE).
            const slotMissingStyle = {
              fontSize: TYPO.meta,
              fontWeight: WEIGHT.bold,
              color: 'var(--yellow)',
              background: 'var(--yellow-bg)',
              border: `1px solid var(--yellow-border)`,
              borderRadius: 'var(--r-sm)',
              padding: '1px 6px',
            };
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }} data-device-id={deviceId || 'unknown'}>
                <StatusDot score={sc} ideal={isIdeal}/>
                {loc
                  ? <span title={tFormat('list.bank-tooltip', { bank: loc.bank, slot: loc.slot, label: CL[loc.slot] }, 'Banque {bank}, slot {slot} — {label}')} style={badgeSlot({ color: unifiedColor })}>{loc.bank}{loc.slot}</span>
                  : <span style={slotMissingStyle}>—</span>}
                {label && <span title={ampName ? `${label} · ${ampName}` : label} style={{ ...badgeLabel({ color: unifiedColor, bg: scBgV || 'transparent' }), maxWidth: 'clamp(200px, 35vw, 500px)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{label}</span>
                  {ampName && <span style={{ opacity: 0.6, fontWeight: WEIGHT.normal, fontSize: TYPO.micro, flexShrink: 0 }}>· {ampName.replace(/^Marshall /, '').replace(/^Fender /, '').replace(/^Mesa Boogie /, 'Mesa ')}</span>}
                </span>}
                {sc != null && <span style={badgeScore({ color: unifiedColor, bg: scBgV })} title={scoreLabel(sc).tip}>{sc}%</span>}
              </div>
            );
          };
          return (
            <div key={s.id} id={'song-' + s.id} style={{ contentVisibility: 'auto', containIntrinsicSize: '0 140px' }}>
              {showArtistHeader && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', marginTop: lastArtist === s.artist ? 0 : 12, marginBottom: 4, paddingLeft: 2, borderBottom: '1px solid var(--a7)', paddingBottom: 4 }}>{s.artist}</div>}
              <div style={{ marginBottom: isExpanded ? 0 : 8 }}>
                <div style={{ display: 'flex' }}>
                  <div onClick={() => {
                    const newId = isExpanded ? null : s.id;
                    setExpandedId(newId);
                    if (newId) {
                      requestAnimationFrame(() => requestAnimationFrame(() => {
                        const el = document.getElementById('song-' + s.id);
                        if (el) {
                          const headerH = document.querySelector('.app-header-bar');
                          const offset = headerH ? headerH.offsetHeight + 8 : 60;
                          const top = el.getBoundingClientRect().top + window.scrollY - offset;
                          window.scrollTo({ top, behavior: 'smooth' });
                        }
                      }));
                    }
                  }}
                  className="songrow-clickable songrow-playlist"
                  title={isExpanded ? t('list.row-collapse-tip', 'Clique sur le header pour replier la fiche.') : undefined}
                  style={{ flex: 1, background: 'var(--bg-elev-1)', border: '1px solid var(--border-subtle)', borderRight: (activeSlId && editingSongs) ? 'none' : '1px solid var(--border-subtle)', borderRadius: (activeSlId && editingSongs) ? (isExpanded ? '10px 0 0 0' : '10px 0 0 10px') : (isExpanded ? '10px 10px 0 0' : '10px'), cursor: 'pointer',
                    // S9.14 — Header sticky quand fiche dépliée : le row
                    // playlist devient le "header" du morceau, reste visible
                    // en haut du scroll → clic pour replier sans devoir
                    // remonter en bas trouver le bouton "Fermer ↑".
                    ...(isExpanded ? { position: 'sticky', top: 60, zIndex: 5 } : {})
                  }}>
                    {(() => {
                      // Phase 7.55.7 S8 — Refonte playlist-like (variante C
                      // maquette validée Sébastien 25/05). Numéro à gauche,
                      // titre dominant + score top + chevron à droite, ligne
                      // meta dense (artist · guitare · slot+preset · potards),
                      // ligne FX si présent. Pas d'encadrés badges (texte
                      // coloré uniquement). CSS .songrow-playlist gère le
                      // bumper desktop +2pt + spacing aéré.
                      // Phase 7.65 préservée : guitare affichée doit être
                      // dans le rig actif.
                      const rig = allGuitars || GUITARS;
                      const gInRig = g && rig.some((r) => r.id === g.id) ? g : null;
                      let playlistG = null;
                      let playlistScore = null;
                      let playlistIsOptimal = false;
                      if (gInRig) {
                        const cot = findCotEntryForGuitar(aiC?.cot_step2_guitars, gInRig);
                        playlistG = gInRig;
                        playlistScore = (cot?.score != null) ? cot.score : localGuitarSongScore(gInRig, aiC);
                        playlistIsOptimal = ig.includes(gInRig.id);
                      } else if (showDeviceRows) {
                        const resolved = resolveDisplayGuitar(aiC, rig);
                        if (resolved.guitar) {
                          playlistG = resolved.guitar;
                          playlistScore = resolved.score;
                          playlistIsOptimal = resolved.source === 'ideal' || resolved.source === 'cot';
                        }
                      }
                      let rowData = getRowPlaylistData(s, aiC, playlistG, playlistScore, playlistIsOptimal);
                      // v9.5.1 — contexte de jeu : pour un morceau joué à la
                      // basse, la vue repliée affiche la basse + sa capture (au
                      // lieu de la guitare + preset guitare). Mirror du gating
                      // SongDetailCard Phase B.
                      const rowPlayCtx = getEffectivePlayContext(profile, s);
                      if (rowPlayCtx.instrument === 'bass') {
                        const br = aiC?.bass_recommendation || null;
                        const bassScore = (Array.isArray(br?.cot_step2_basses) && br.cot_step2_basses[0]?.score != null)
                          ? br.cot_step2_basses[0].score
                          : (Array.isArray(br?.bass_alternatives) && br.bass_alternatives[0]?.score != null ? br.bass_alternatives[0].score : null);
                        const bassDevices = [];
                        if (rowPlayCtx.rig === 'tonex' && Array.isArray(br?.bass_alternatives) && br.bass_alternatives.length > 0) {
                          const top = br.bass_alternatives[0];
                          const nm = stripSlotPrefix(top.name || '');
                          const locAnn = findInBanks(nm, banksAnn);
                          const loc = locAnn || findInBanks(nm, banksPlug);
                          if (loc) {
                            bassDevices.push({
                              deviceKey: 'bass-capture',
                              deviceLabel: locAnn ? 'Ann' : 'Plug',
                              slot: `${loc.bank}${loc.slot}`,
                              presetName: top.name,
                              ampLabel: top.amp || null,
                              presetScore: top.score != null ? top.score : null,
                            });
                          }
                        }
                        rowData = {
                          ...rowData,
                          guitarLabel: br?.ideal_bass || null,
                          guitarScore: bassScore,
                          isOptimalGuitar: false,
                          devices: bassDevices,
                          potards: null,
                          fxOn: [],
                        };
                      }
                      return (
                        <div className="songrow-pl-row">
                          <span className="songrow-pl-number">{playlistNumber}</span>
                          <div className="songrow-pl-content">
                            <div className="songrow-pl-headline">
                              <span className="songrow-pl-title">{rowData.title}</span>
                              {!s.aiCache && <span className="songrow-pl-pending" title={t('list.pending-analysis', 'Pas encore analysé')}>···</span>}
                              {rowData.isOptimalGuitar && <span className="songrow-pl-optimal" title={t('list.optimal-guitar', 'Guitare idéale')}>★</span>}
                              {/* Phase 9.9 — bouton recalcul ciblé sur le header
                                  (donc accessible en vue repliée). Visible quand
                                  l'analyse du morceau est antérieure à un
                                  changement de profil. stopPropagation pour ne
                                  pas (dé)plier la fiche. */}
                              {!isDemo && fpStaleReasons(s).length > 0 && (
                                <span
                                  role="button"
                                  onClick={(e) => { e.stopPropagation(); recalcSong(s); }}
                                  title={recalcingId === s.id
                                    ? t('list.row-recalc-loading', 'Recalcul en cours…')
                                    : tFormat('list.row-recalc-title', { reasons: fpStaleReasons(s).map((r) => FP_REASON_LABELS[r] || r).join(', ') }, 'Analyse antérieure à un changement ({reasons}). Cliquer pour recalculer ce morceau.')}
                                  style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--accent)', cursor: recalcingId === s.id ? 'wait' : 'pointer', opacity: recalcingId === s.id ? 0.45 : 1, marginLeft: 2 }}
                                >
                                  <NavIcon id="refresh" size={15}/>
                                </span>
                              )}
                              <span className="songrow-pl-chevron">{isExpanded ? '▲' : '▼'}</span>
                            </div>
                            {/* S8.4 — Meta grid 4 colonnes desktop pour
                                alignement strict entre rows (Sébastien
                                25/05 "j'ai vraiment besoin d'alignements").
                                Mobile : stack flex column.
                                S9.3 — Reste visible aussi quand isExpanded
                                pour servir de header à la fiche dépliée
                                (drop sticky bandeau dupliqué Sébastien 25/05). */}
                            {(rowData.artist || rowData.guitarLabel || rowData.devices.length > 0 || rowData.potards || rowData.fxOn.length > 0) && (
                              <div className="songrow-pl-meta-grid">
                                <div className="songrow-pl-meta-cell songrow-pl-meta-artist">
                                  {rowData.artist || ''}
                                </div>
                                <div className="songrow-pl-meta-cell songrow-pl-meta-guitar">
                                  {rowData.guitarLabel && (
                                    <>
                                      {/* Phase 7.85 — Spacer transparent retiré (servait à
                                          préserver la col 1 du grid 40px 1fr quand le pill
                                          score séparée existait, Phase 7.83 final4 l'a
                                          retiré). Maintenant le label guitare s'aligne à
                                          gauche sans décalage de 40-44px (retour Sébastien
                                          v8.14.240 : "décalage visuel iPhone"). Le grid CSS
                                          est aussi simplifié à 1 col. */}
                                      {(() => {
                                        const cleanLabel = _cleanGuitarLabel(rowData.guitarLabel);
                                        const labelStyle = _compatLabelStyle(rowData.guitarScore);
                                        const titleText = rowData.guitarScore != null
                                          ? `${rowData.guitarLabel} — ${rowData.guitarScore}%`
                                          : rowData.guitarLabel;
                                        return labelStyle
                                          ? <span className="songrow-pl-guitar" style={labelStyle} title={titleText}>{cleanLabel}</span>
                                          : <span className="songrow-pl-guitar">{cleanLabel}</span>;
                                      })()}
                                    </>
                                  )}
                                </div>
                                <div className="songrow-pl-meta-cell songrow-pl-meta-devices">
                                  {rowData.devices.map((d) => (
                                    <div key={d.deviceKey} className="songrow-pl-device-line">
                                      <span className="songrow-pl-device">{d.deviceLabel}</span>
                                      <span className="songrow-pl-slot-pill">{d.slot}</span>
                                      {/* Phase 7.83 final4 — pill "Idéal" séparé retiré (même
                                          raison qu'au-dessus pour la guitare). Spacer transparent
                                          préserve le grid 4 col `52px 44px 44px 1fr`. */}
                                      {d.presetScore != null
                                        ? <span className="songrow-pl-score-pill-inline" style={{ background: 'transparent', border: 'none', padding: 0 }} aria-hidden="true"/>
                                        : <span className="songrow-pl-score-pill-empty" aria-hidden="true"/>}
                                      {(() => {
                                        const presetDisplay = d.ampLabel || d.presetName;
                                        const labelStyle = _compatLabelStyle(d.presetScore);
                                        const tooltipParts = [];
                                        if (d.ampLabel && d.ampLabel !== d.presetName) tooltipParts.push(d.presetName);
                                        if (d.presetScore != null) tooltipParts.push(`${d.presetScore}%`);
                                        const titleText = tooltipParts.join(' — ') || undefined;
                                        return labelStyle
                                          ? <span className="songrow-pl-preset" style={labelStyle} title={titleText}>{presetDisplay}</span>
                                          : <span className="songrow-pl-preset" title={titleText}>{presetDisplay}</span>;
                                      })()}
                                    </div>
                                  ))}
                                </div>
                                <div className="songrow-pl-meta-cell songrow-pl-meta-extras">
                                  {rowData.potards && (
                                    <div className="songrow-pl-potards">{rowData.potards}</div>
                                  )}
                                  {rowData.fxOn.length > 0 && (
                                    <div className="songrow-pl-fx">
                                      <span className="songrow-pl-fx-icon">FX</span>
                                      <span className="songrow-pl-fx-list">{rowData.fxOn.join(' · ')}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  {activeSlId && editingSongs && <button
                    data-testid={`song-row-remove-${s.id}`}
                    onClick={(e) => { e.stopPropagation(); removeSongFromActiveSetlist(s.id, s.title); }}
                    disabled={isDemo}
                    title={isDemo ? t('demo.blocked', 'Action désactivée en mode démo') : tFormat('list.remove-song-title', { title: s.title }, 'Retirer "{title}" de la setlist')}
                    style={{
                      background: 'var(--a3)',
                      border: '1px solid var(--a7)',
                      borderLeft: 'none',
                      borderRadius: isExpanded ? '0 10px 0 0' : '0 10px 10px 0',
                      padding: '0 8px', cursor: isDemo ? 'not-allowed' : 'pointer', color: 'var(--text-dim)',
                      fontSize: 14, minWidth: 36, flexShrink: 0, transition: 'color 0.15s ease',
                      opacity: isDemo ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => { if (!isDemo) e.currentTarget.style.color = 'var(--red)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; }}
                  ><NavIcon id="trash" size={16}/></button>}
                </div>
                {isExpanded && <SongDetailCard song={s} banksAnn={banksAnn} banksPlug={banksPlug} onBanksAnn={onBanksAnn} onBanksPlug={onBanksPlug} onClose={() => setExpandedId(null)} guitars={allGuitars} allRigsGuitars={allRigsGuitars} availableSources={availableSources} savedGuitarId={activeSl?.guitars?.[s.id]} onGuitarChange={(songId, gId) => { if (activeSlId) onSetlists((p) => p.map((sl) => sl.id === activeSlId ? { ...sl, guitars: { ...(sl.guitars || {}), [songId]: gId } } : sl)); }} savedBassId={activeSl?.basses?.[s.id]} onBassChange={(songId, bassId) => { if (activeSlId) onSetlists((p) => p.map((sl) => sl.id === activeSlId ? { ...sl, basses: { ...(sl.basses || {}), [songId]: bassId } } : sl)); }} aiProvider={aiProvider} aiKeys={aiKeys} onSongDb={onSongDb} onAiCacheUpdate={onAiCacheUpdate} profile={profile} guitarBias={guitarBias} onTmpPatchOverride={onTmpPatchOverride} songDb={songDb} onProfiles={onProfiles} activeProfileId={activeProfileId} toneNetPresets={toneNetPresets} onToneNetPresets={onToneNetPresets} onSharedUsagesOverrides={onSharedUsagesOverrides}/>}
              </div>
            </div>
          );
        });
      })()}

      {/* Phase 7.71 — Bouton "Générer le récap" supprimé. Dépendait de
          checked. Le mode scène (🎤 LiveScreen) remplace ce workflow.
          Si besoin du récap PDF, accessible via Setlists tab → édition. */}

      {removedSong && <div
        data-testid="song-remove-toast"
        style={{
          position: 'fixed', left: '50%',
          bottom: 'max(20px, env(safe-area-inset-bottom))',
          transform: 'translateX(-50%)',
          background: 'var(--bg-card)', border: '1px solid var(--a12)',
          borderRadius: 'var(--r-lg)', padding: '10px 14px', fontSize: 13,
          color: 'var(--text)', display: 'flex', alignItems: 'center',
          gap: 12, boxShadow: 'var(--shadow-md)', zIndex: 999,
          maxWidth: 'min(440px, 92vw)',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <b style={{ color: 'var(--text-bright)' }}>"{removedSong.songTitle}"</b> {t('list.removed', 'retiré')}
        </span>
        <button
          data-testid="song-remove-toast-undo"
          onClick={undoRemoveSong}
          style={{
            background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
            color: 'var(--accent)', borderRadius: 'var(--r-md)',
            padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            flexShrink: 0,
          }}
        >{t('list.undo', '↩ Annuler')}</button>
      </div>}

      {showAdd && <AddSongModal songDb={songDb} onSongDb={onSongDb} onAiCacheUpdate={onAiCacheUpdate} isDemo={isDemo} setlists={setlists} onSetlists={onSetlists} activeSlId={activeSlId} onClose={() => setShowAdd(false)} banksAnn={banksAnn} banksPlug={banksPlug} aiProvider={aiProvider} aiKeys={aiKeys} guitars={allGuitars} guitarBias={guitarBias}/>}
    </div>
  );
}

export default ListScreen;
export { ListScreen, InlineRenameInput };

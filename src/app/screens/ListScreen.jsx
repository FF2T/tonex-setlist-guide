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
import { toggleSetlistProfile } from '../../core/state.js';
import { TMP_FACTORY_PATCHES, recommendTMPPatch } from '../../devices/tonemaster-pro/index.js';
import { getActiveDevicesForRender } from '../utils/devices-render.js';
import { getIg, getPA, getPP, getSongHist } from '../utils/song-helpers.js';
import {
  enrichAIResult, getBestResult, bestScoreOf, updateAiCache,
  computeRigSnapshot, resolveRefAmp,
} from '../utils/ai-helpers.js';
import { findInBanks, guitarScore } from '../utils/preset-helpers.js';
import { fetchAI } from '../utils/fetchAI.js';
import { CC, CL, TYPE_COLORS } from '../utils/ui-constants.js';
import { scoreColor, scoreBg, scoreLabel } from '../components/score-utils.js';
import StatusDot from '../components/StatusDot.jsx';
import SongCollapsedDeviceRows from '../components/SongCollapsedDeviceRows.jsx';
import AddSongModal from '../components/AddSongModal.jsx';
import SongDetailCard from './SongDetailCard.jsx';
import { exportSetlistPdf } from './SetlistPdfExport.js';

// Sous-composant local pour les renames de setlist inline. Pas exporté
// car ne sert qu'au ListScreen.
function InlineRenameInput({ initialName, onSave, onCancel, inp, placeholder, buttonLabel }) {
  const [val, setVal] = useState(initialName || '');
  const submit = () => { if (val.trim()) { onSave(val.trim()); setVal(''); } };
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <input value={val} onChange={(e) => setVal(e.target.value)} placeholder={placeholder || ''} style={{ ...inp, flex: 1 }} autoFocus={!!initialName} onKeyDown={(e) => e.key === 'Enter' && submit()}/>
      <button onClick={submit} disabled={!val.trim()} style={{ background: val.trim() ? 'var(--accent)' : 'var(--a7)', border: 'none', color: val.trim() ? 'var(--text-inverse)' : 'var(--text-dim)', borderRadius: 'var(--r-md)', padding: '4px 12px', fontSize: 11, fontWeight: 700, cursor: val.trim() ? 'pointer' : 'not-allowed' }}>{buttonLabel || t('list.ok', 'OK')}</button>
      {initialName && <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>✕</button>}
    </div>
  );
}

function ListScreen({
  songDb, onSongDb, setlists, allSetlists, onSetlists, mySongIds,
  checked, onChecked, onNext, onSettings,
  banksAnn, onBanksAnn, banksPlug, onBanksPlug,
  aiProvider, aiKeys, hideHeader = false, allGuitars, allRigsGuitars,
  availableSources, activeProfileId, profiles, profile, guitarBias,
  onTmpPatchOverride, onLive,
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
        const cleaned = { ...aiCraw, preset_ann: null, preset_plug: null, ideal_preset: null, ideal_preset_score: 0, ideal_top3: null };
        newEntries.push([s.id, enrichAIResult(cleaned, gType, rd.gId, banksAnn, banksPlug, availableSources)]);
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
  }, [activeSongs, songRowData, banksAnn, banksPlug, availableSources]);

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
  const toggle = (id) => onChecked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleAll = () => onChecked(checked.length === activeSongs.length ? [] : activeSongs.map((s) => s.id));
  const inp = { background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-md)', padding: '6px 10px', fontSize: 12, boxSizing: 'border-box' };

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

  const currentRigSnapshot = useMemo(() => computeRigSnapshot(allRigsGuitars || allGuitars || GUITARS), [allRigsGuitars, allGuitars]);
  const missingCount = useMemo(() => (activeSongs || []).filter((s) => {
    if (!s.aiCache) return true;
    if (s.aiCache.rigSnapshot && s.aiCache.rigSnapshot !== currentRigSnapshot) return true;
    return false;
  }).length, [activeSongs, currentRigSnapshot]);
  const [analyzeAllStatus, setAnalyzeAllStatus] = useState(null);
  const analyzeCancelRef = useRef(false);
  const analyzeMissingAll = async () => {
    analyzeCancelRef.current = false;
    const missing = (activeSongs || []).filter((s) => {
      if (!s.aiCache) return true;
      if (s.aiCache.rigSnapshot && s.aiCache.rigSnapshot !== currentRigSnapshot) return true;
      return false;
    });
    if (!missing.length) return;
    const guitars = allGuitars || GUITARS;
    setAnalyzeAllStatus({ current: 0, total: missing.length, songTitle: '' });
    for (let i = 0; i < missing.length; i++) {
      if (analyzeCancelRef.current) break;
      const s = missing[i];
      setAnalyzeAllStatus({ current: i + 1, total: missing.length, songTitle: s.title });
      try {
        const historicalFeedback = Array.isArray(s.feedback) && s.feedback.length > 0
          ? s.feedback.map((f) => f.text).filter(Boolean).join('. ')
          : null;
        const r = await fetchAI(s, '', banksAnn, banksPlug, aiProvider, aiKeys, allRigsGuitars || guitars, historicalFeedback, null, profile?.recoMode || 'balanced', guitarBias);
        if (analyzeCancelRef.current) break;
        const rigSnapshot = computeRigSnapshot(allRigsGuitars || guitars);
        onSongDb((p) => p.map((x) => x.id === s.id ? { ...x, aiCache: { ...updateAiCache(x.aiCache, '', r, { rigSnapshot }), sv: SCORING_VERSION } } : x));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(`[analyzeMissingAll] Skip "${s.title}":`, e?.message || e);
      }
    }
    setAnalyzeAllStatus(null);
    analyzeCancelRef.current = false;
  };
  const improveAll = async () => {
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
          const r = await waitOrCancel(fetchAI(s, gId, banksAnn, banksPlug, aiProvider, aiKeys, allRigsGuitars || guitars, historicalFeedback, null, profile?.recoMode || 'balanced', guitarBias));
          if (improveCancelRef.current) break;
          onSongDb((p) => p.map((x) => x.id === s.id ? { ...x, aiCache: updateAiCache(x.aiCache, gId, r) } : x));
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
        <select value={activeSlId || ''} onChange={(e) => { const v = e.target.value; setActiveSlId(v || null); onChecked([]); const ss = v && setlists.find((s) => s.id === v)?.sort; setSort(ss && ss !== 'default' ? ss : 'artist'); }} style={{ flex: 1, background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-strong,var(--a15))', borderRadius: 'var(--r-md)', padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}>
          <option value="">{tFormat('list.all-songs', { count: mySongIds ? songDb.filter((s) => mySongIds.has(s.id)).length : songDb.length }, 'Tous les morceaux ({count})')}</option>
          {setlists.map((sl) => <option key={sl.id} value={sl.id}>{sl.name} ({sl.songIds.length})</option>)}
        </select>
        {typeof onLive === 'function' && activeSongs.length > 0 && <button data-testid="list-screen-live" onClick={() => onLive(activeSlId || null)} title={t('list.live-mode', 'Mode scène plein écran')} style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', color: 'var(--accent)', borderRadius: 'var(--r-md)', padding: '8px 10px', fontSize: 13, cursor: 'pointer', flexShrink: 0, fontWeight: 700 }}>🎤</button>}
        <button onClick={() => setEditingSetlists(!editingSetlists)} style={{ background: editingSetlists ? 'var(--accent-bg)' : 'var(--a5)', border: '1px solid ' + (editingSetlists ? 'var(--accent-border)' : 'var(--a10)'), color: editingSetlists ? 'var(--accent)' : 'var(--text-muted)', borderRadius: 'var(--r-md)', padding: '8px 10px', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>{editingSetlists ? '✕' : '✏️'}</button>
      </div>
      {editingSetlists && (
        <div style={{ background: 'var(--a3)', border: '1px solid var(--a7)', borderRadius: 'var(--r-md)', padding: 10, marginBottom: 8 }}>
          {setlists.map((sl) => (
            <div key={sl.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {editSlId === sl.id
                  ? <InlineRenameInput initialName={sl.name} onSave={(name) => renameSetlist(sl.id, name)} onCancel={() => setEditSlId(null)} inp={inp}/>
                  : (
                    <>
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{sl.name} <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>({sl.songIds.length})</span></span>
                      {sl.songIds.length > 0 && <button data-testid={`setlist-pdf-${sl.id}`} title={`Export PDF — ${sl.name}`} onClick={() => {
                        const songs = sl.songIds.map((id) => songDb.find((s) => s.id === id)).filter(Boolean);
                        const doc = exportSetlistPdf(sl, songs, { profile, banksAnn, banksPlug });
                        doc.save(`${sl.name.replace(/[^a-z0-9_-]+/gi, '_') || 'setlist'}.pdf`);
                      }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>📄</button>}
                      <button onClick={() => setEditSlId(sl.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>✏️</button>
                      {sl.songIds.length > 0 && <button
                        data-testid={`setlist-empty-${sl.id}`}
                        title={t('list.empty-setlist-title', 'Vider la setlist (garde la setlist mais retire tous les morceaux)')}
                        onClick={() => {
                          const n = sl.songIds.length;
                          const msg = tFormat('list.empty-setlist-confirm', { name: sl.name, songs: tPlural('list.songs-count', n, {}, { one: '1 morceau', other: '{count} morceaux' }) }, 'Vider "{name}" ?\n\n{songs} vont être retirés de cette setlist.\n\nLes morceaux restent disponibles dans la base globale (Setlists → onglet Morceaux). La setlist "{name}" continue d\'exister, juste vide.');
                          if (!window.confirm(msg)) return;
                          onSetlists((p) => p.map((s) => s.id === sl.id ? { ...s, songIds: [] } : s));
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}
                      >🧹</button>}
                      {setlists.length > 1 && <button onClick={() => deleteSetlist(sl.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 11, cursor: 'pointer' }}>🗑</button>}
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
                        if (isMe) return;
                        onSetlists((p) => p.map((s) => s.id === sl.id ? toggleSetlistProfile(s, pf.id, activeProfileId) : s));
                      };
                      return (
                        <button
                          key={pf.id}
                          data-testid={`setlist-share-pill-${sl.id}-${pf.id}`}
                          onClick={onClick}
                          disabled={isMe}
                          title={isMe ? t('list.share-you', 'Toi (verrouillé)') : (isChecked ? t('list.share-remove', 'Cliquer pour retirer') : t('list.share-add', 'Cliquer pour partager'))}
                          style={{
                            background: isChecked ? (isMe ? 'var(--accent-soft)' : 'var(--accent-bg)') : 'var(--a4)',
                            border: `1px solid ${isChecked ? 'var(--accent-border)' : 'var(--a8)'}`,
                            color: isChecked ? 'var(--accent)' : 'var(--text-dim)',
                            borderRadius: 'var(--r-sm)', padding: '2px 6px', fontSize: 9,
                            fontWeight: isChecked ? 700 : 500, cursor: isMe ? 'default' : 'pointer',
                            opacity: isMe ? 0.85 : 1,
                          }}
                        >
                          {isChecked ? '✓ ' : ''}{pf.name || pf.id}{isMe ? ' 🔒' : ''}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          ))}
          <InlineRenameInput initialName="" onSave={(name) => { onSetlists((p) => [...p, { id: `sl_${Date.now()}`, name, songIds: [], profileIds: [activeProfileId] }]); }} onCancel={() => {}} inp={inp} placeholder={t('list.new-setlist-placeholder', 'Nouvelle setlist...')} buttonLabel={t('list.create', '+ Creer')}/>
        </div>
      )}

      {/* Barre d'actions compacte */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tPlural('list.songs-count', activeSongs.length, {}, { one: '1 morceau', other: '{count} morceaux' })}</span>
        <select value={sort} onChange={(e) => saveSort(e.target.value)} style={{ background: 'var(--bg-card)', color: 'var(--text-sec)', border: '1px solid var(--a10)', borderRadius: 'var(--r-sm)', padding: '3px 6px', fontSize: 10, cursor: 'pointer' }}>
          <option value="artist">{t('list.sort-artist', 'Par artiste')}</option>
          <option value="alpha">{t('list.sort-alpha', 'A → Z')}</option>
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {activeSongs.length > 0 && <button onClick={() => setShowTopGuitars(!showTopGuitars)} style={{ fontSize: 10, color: showTopGuitars ? 'var(--accent)' : 'var(--text-muted)', background: showTopGuitars ? 'var(--accent-bg)' : 'var(--a5)', border: '1px solid ' + (showTopGuitars ? 'var(--accent-border)' : 'var(--a10)'), borderRadius: 'var(--r-sm)', padding: '3px 8px', cursor: 'pointer' }}>{t('list.guitars', 'Guitares')}</button>}
          {activeSongs.length > 0 && <button onClick={toggleAll} style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--a5)', border: '1px solid var(--a10)', borderRadius: 'var(--r-sm)', padding: '3px 8px', cursor: 'pointer' }}>{checked.length === activeSongs.length ? t('list.uncheck-all', 'Décocher') : t('list.check-all', 'Cocher')}</button>}
          {missingCount > 0 && !analyzeAllStatus && <button
            data-testid="list-screen-analyze-missing"
            onClick={() => {
              const msg = tFormat('list.analyze-confirm', { songs: tPlural('list.songs-count', missingCount, {}, { one: '1 morceau', other: '{count} morceaux' }), duration: Math.ceil(missingCount * 8) }, "Analyser/actualiser {songs} ?\n\nInclut :\n• Morceaux sans analyse IA (⏳)\n• Morceaux dont l'analyse date d'avant un changement de rig (guitare ajoutée/retirée)\n\nDurée estimée : {duration}s (~8s par morceau).\nLa clé Gemini partagée sera utilisée. Tu peux annuler à tout moment.");
              if (!window.confirm(msg)) return;
              analyzeMissingAll();
            }}
            title={tFormat('list.analyze-title', { count: missingCount }, '{count} morceau(x) à analyser ou actualiser après modif du rig.')}
            style={{ fontSize: 10, color: 'var(--accent)', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 'var(--r-sm)', padding: '3px 8px', cursor: 'pointer', fontWeight: 700 }}
          >{tFormat('list.analyze-button', { count: missingCount }, '🤖 Analyser/MAJ {count}')}</button>}
          {analyzeAllStatus && <button
            data-testid="list-screen-analyze-cancel"
            onClick={() => { analyzeCancelRef.current = true; }}
            style={{ fontSize: 10, color: 'var(--wine-400)', background: 'rgba(155,58,44,0.12)', border: '1px solid rgba(155,58,44,0.3)', borderRadius: 'var(--r-sm)', padding: '3px 8px', cursor: 'pointer', fontWeight: 700 }}
            title={tFormat('list.cancel-analyze', { current: analyzeAllStatus.current, total: analyzeAllStatus.total }, "Annuler l'analyse en cours ({current}/{total})")}
          >⏸ {analyzeAllStatus.current}/{analyzeAllStatus.total}</button>}
          {activeSlId && checked.length > 0 && checked.length < activeSongs.length && <button
            data-testid="list-screen-keep-checked"
            onClick={() => {
              const keepIds = new Set(checked);
              const removeCount = activeSongs.length - checked.length;
              const keepLabel = tPlural('list.songs-count', checked.length, {}, { one: '1 morceau', other: '{count} morceaux' });
              const removeLabel = tPlural('list.others-count', removeCount, {}, { one: "1 autre", other: '{count} autres' });
              const slName = activeSl?.name || t('list.this-setlist', 'cette setlist');
              const msg = tFormat('list.keep-checked-confirm', { keep: keepLabel, remove: removeLabel, name: slName }, 'Garder {keep} et retirer les {remove} de "{name}" ?\n\nLes morceaux retirés restent dans la base globale.');
              if (!window.confirm(msg)) return;
              onSetlists((p) => p.map((sl) => sl.id === activeSlId ? { ...sl, songIds: sl.songIds.filter((id) => keepIds.has(id)) } : sl));
              onChecked([]);
            }}
            style={{ fontSize: 10, color: 'var(--wine-400)', background: 'rgba(155,58,44,0.12)', border: '1px solid rgba(155,58,44,0.3)', borderRadius: 'var(--r-sm)', padding: '3px 8px', cursor: 'pointer', fontWeight: 600 }}
            title={t('list.remove-unchecked-title', 'Retirer les morceaux non cochés de cette setlist (garde-fou : confirmation)')}
          >{tFormat('list.remove-unchecked', { count: activeSongs.length - checked.length }, '🧹 Retirer non-cochés ({count})')}</button>}
          <button onClick={() => setShowAdd(true)} style={{ fontSize: 10, color: 'var(--accent)', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 'var(--r-sm)', padding: '3px 8px', cursor: 'pointer', fontWeight: 600 }}>+</button>
        </div>
      </div>

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
                  <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{count} morceau{count > 1 ? 'x' : ''}</span>
                </span>
              );
            })}
          </div>
        );
      })()}

      {activeSongs.length === 0 && <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}><div style={{ fontSize: 24, marginBottom: 8 }}>🎵</div><div style={{ fontSize: 14 }}>{t('list.empty', 'Setlist vide — clique sur "+ Ajouter"')}</div></div>}

      {(() => {
        let lastArtist = '';
        return activeSongs.slice(0, visibleCount).map((s) => {
          const showArtistHeader = sort === 'artist' && s.artist !== lastArtist;
          if (showArtistHeader) lastArtist = s.artist;
          const isC = checked.includes(s.id);
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
            ? enrichAIResult({ ...aiCraw }, gType, gId, banksAnn, banksPlug)
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
            const badgeColor = deviceColor || (loc ? CC[loc.slot] : null);
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }} data-device-id={deviceId || 'unknown'}>
                <StatusDot score={sc} ideal={isIdeal}/>
                {loc
                  ? <span title={tFormat('list.bank-tooltip', { bank: loc.bank, slot: loc.slot, label: CL[loc.slot] }, 'Banque {bank}, slot {slot} — {label}')} style={{ fontSize: 10, background: `${badgeColor}18`, color: badgeColor, border: `1px solid ${badgeColor}40`, borderRadius: 'var(--r-sm)', padding: '1px 6px', fontWeight: 700 }}>{loc.bank}{loc.slot}</span>
                  : <span style={{ fontSize: 10, background: 'var(--yellow-bg)', color: 'var(--yellow)', borderRadius: 'var(--r-sm)', padding: '1px 6px', fontWeight: 700 }}>⬇</span>}
                {label && <span style={{ fontSize: 10, color: scColorV || 'var(--text-sec)', background: scBgV || 'transparent', border: scColorV ? `1px solid ${scColorV}30` : 'none', borderRadius: 'var(--r-sm)', padding: '1px 6px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span>{label}</span>
                  {ampName && <span style={{ opacity: 0.6, fontWeight: 500, fontSize: 9 }}>· {ampName.replace(/^Marshall /, '').replace(/^Fender /, '').replace(/^Mesa Boogie /, 'Mesa ')}</span>}
                </span>}
                {sc != null && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 800, color: scColorV, background: scBgV, borderRadius: 'var(--r-sm)', padding: '1px 6px', border: `1px solid ${scColorV}30` }} title={scoreLabel(sc).tip}>{sc}%</span>}
              </div>
            );
          };
          return (
            <div key={s.id} id={'song-' + s.id} style={{ contentVisibility: 'auto', containIntrinsicSize: '0 140px' }}>
              {showArtistHeader && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', marginTop: lastArtist === s.artist ? 0 : 12, marginBottom: 4, paddingLeft: 2, borderBottom: '1px solid var(--a7)', paddingBottom: 4 }}>{s.artist}</div>}
              <div style={{ marginBottom: isExpanded ? 0 : 8 }}>
                <div style={{ display: 'flex' }}>
                  <button onClick={() => toggle(s.id)} style={{ background: isC ? 'rgba(74,222,128,0.15)' : 'var(--a4)', border: isC ? '1px solid rgba(74,222,128,0.4)' : '1px solid var(--a10)', borderRight: 'none', borderRadius: isExpanded ? '10px 0 0 0' : '10px 0 0 10px', padding: '0 14px', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: 18, height: 18, borderRadius: 'var(--r-sm)', border: isC ? '2px solid #4ade80' : '2px solid var(--text-muted)', background: isC ? 'var(--green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{isC && <span style={{ color: 'var(--bg)', fontSize: 11, fontWeight: 900 }}>✓</span>}</div>
                  </button>
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
                  }} style={{ flex: 1, background: isC ? 'rgba(74,222,128,0.05)' : 'var(--a3)', border: isC ? '1px solid var(--green-border)' : '1px solid var(--a7)', borderLeft: 'none', borderRight: activeSlId ? 'none' : (isC ? '1px solid var(--green-border)' : '1px solid var(--a7)'), borderRadius: activeSlId ? '0' : (isExpanded ? '0 10px 0 0' : '0 10px 10px 0'), padding: '10px 13px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{s.title}</span>
                      {!s.aiCache && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>⏳</span>}
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-dim)' }}>{isExpanded ? '▲' : '▼'}</span>
                    </div>
                    {sort !== 'artist' && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: hist ? 3 : 0 }}>{s.artist}</div>}
                    {showDeviceRows && hist && !isExpanded && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{hist.guitarist}</span>
                      <span style={{ color: 'var(--text-tertiary)' }}>·</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{hist.amp}</span>
                    </div>}
                    {showDeviceRows && !isExpanded && (g || aiC?.ideal_guitar) && (() => {
                      const chosenGuitarCot = findCotEntryForGuitar(aiC?.cot_step2_guitars, g);
                      const idealGuitarScore = aiC?.cot_step2_guitars?.[0]?.score || null;
                      const gScore = chosenGuitarCot?.score || (g ? localGuitarSongScore(g, aiC) : idealGuitarScore);
                      const isIdealGuitar = g ? ig.includes(gId) : true;
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                          <StatusDot score={gScore || null} ideal={isIdealGuitar}/>
                          {g
                            ? <span style={{ fontSize: 10, color: 'var(--text-sec)', background: 'var(--a6)', borderRadius: 'var(--r-sm)', padding: '1px 7px', fontWeight: 600 }}>{g.name} ({g.type}){savedGId && !ig.includes(savedGId) ? ' ' + t('list.custom-choice', '(choix perso)') : ''}</span>
                            : aiC?.ideal_guitar && <span style={{ fontSize: 10, color: 'var(--text-sec)', background: 'var(--a6)', borderRadius: 'var(--r-sm)', padding: '1px 7px', fontWeight: 600 }}>{aiC.ideal_guitar}</span>}
                          {gScore > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: scoreColor(gScore), background: scoreBg(gScore), borderRadius: 'var(--r-sm)', padding: '1px 6px', border: `1px solid ${scoreColor(gScore)}30` }} title={scoreLabel(gScore).tip + '  —  score guitare'}>{gScore}%</span>}
                        </div>
                      );
                    })()}
                    {!isExpanded && showDeviceRows && <SongCollapsedDeviceRows
                      profile={profile}
                      aiC={aiC}
                      banksAnn={banksAnn}
                      banksPlug={banksPlug}
                      song={s}
                      guitar={g}
                      allGuitars={allGuitars}
                      enabledDevices={enabledDevicesForRender}
                      precomputedTopRecBySongId={tmpTopRecBySongId}
                      renderRow={(d, banks, presetData) => presetRow(d.icon, presetData.label, banks, presetData.score, d.id, d.deviceColor)}
                    />}
                  </div>
                  {activeSlId && <button
                    data-testid={`song-row-remove-${s.id}`}
                    onClick={(e) => { e.stopPropagation(); removeSongFromActiveSetlist(s.id, s.title); }}
                    title={tFormat('list.remove-song-title', { title: s.title }, 'Retirer "{title}" de la setlist')}
                    style={{
                      background: isC ? 'rgba(74,222,128,0.05)' : 'var(--a3)',
                      border: isC ? '1px solid var(--green-border)' : '1px solid var(--a7)',
                      borderLeft: 'none',
                      borderRadius: isExpanded ? '0 10px 0 0' : '0 10px 10px 0',
                      padding: '0 6px', cursor: 'pointer', color: 'var(--text-dim)',
                      fontSize: 14, minWidth: 32, flexShrink: 0, transition: 'color 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--red)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; }}
                  >🗑️</button>}
                </div>
                {isExpanded && <SongDetailCard song={s} banksAnn={banksAnn} banksPlug={banksPlug} onBanksAnn={onBanksAnn} onBanksPlug={onBanksPlug} onClose={() => setExpandedId(null)} guitars={allGuitars} allRigsGuitars={allRigsGuitars} availableSources={availableSources} savedGuitarId={activeSl?.guitars?.[s.id]} onGuitarChange={(songId, gId) => { if (activeSlId) onSetlists((p) => p.map((sl) => sl.id === activeSlId ? { ...sl, guitars: { ...(sl.guitars || {}), [songId]: gId } } : sl)); }} aiProvider={aiProvider} aiKeys={aiKeys} onSongDb={onSongDb} profile={profile} guitarBias={guitarBias} onTmpPatchOverride={onTmpPatchOverride}/>}
              </div>
            </div>
          );
        });
      })()}

      {checked.length > 0 && <div className="bottom-action" style={{ paddingTop: 12 }}><button onClick={onNext} style={{ width: '100%', background: 'linear-gradient(180deg,var(--brass-200),var(--brass-400))', border: 'none', color: 'var(--tolex-900)', borderRadius: 'var(--r-lg)', padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-sm)', fontFamily: 'var(--font-ui)' }}>{tFormat('list.generate-recap', { songs: tPlural('list.songs-count', checked.length, {}, { one: '1 morceau', other: '{count} morceaux' }) }, 'Générer le récap — {songs} →')}</button></div>}

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

      {showAdd && <AddSongModal songDb={songDb} onSongDb={onSongDb} setlists={setlists} onSetlists={onSetlists} activeSlId={activeSlId} onClose={() => setShowAdd(false)} banksAnn={banksAnn} banksPlug={banksPlug} aiProvider={aiProvider} aiKeys={aiKeys} guitars={allGuitars} guitarBias={guitarBias}/>}
    </div>
  );
}

export default ListScreen;
export { ListScreen, InlineRenameInput };

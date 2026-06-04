// src/app/screens/BankOptimizerScreen.jsx — Phase 14.3.
//
// Optimiseur de banks, deux modes (segmented control) :
//  - Améliorer : actions prioritaires + diagnostic (contenu historique
//    Phase 7.16, inchangé — reframe seuillé = 14.4).
//  - Réorganiser : zone Live MUTUALISÉE par device ToneX. 1 banque par
//    ampli partagé (triplet A=Clean/B=Crunch/C=Lead) ou par capture
//    exacte (flat One/One+), avec aperçu diff (inchangée / modifiée /
//    fusionnée / libérée) + axes (ordre setlist / famille d'ampli).
//    Application UNIQUEMENT dans la zone Live [start, start+liveCount) —
//    Jams/Découverte jamais touchées. Clustering pur dans
//    src/app/utils/optimizer-helpers.js (testé), scoring injecté ici.
//
// Perf-critique : toutes les analyses (Améliorer ET Réorganiser) scannent
// le catalog merged par morceau → deferred via setTimeout(0) après mount.
// Le build Réorganiser n'est calculé QUE quand mode === 'reorganize'.
// Voir CLAUDE.md "Phase 5.13" + window.__TONEX_PERF.

import React, { useState, useEffect, useMemo } from 'react';
import { t, tFormat, tPlural } from '../../i18n/index.js';
import NavIcon from '../components/NavIcon.jsx';
import {
  computePickupScore, computeFinalScore, computeSimpleScore,
  computeRefAmpScore, computeStyleMatchScore,
  getGainRange, gainToNumeric, rankJamAmps,
} from '../../core/scoring/index.js';
import { findGuitarByAIName } from '../../core/scoring/guitar.js';
import { findCatalogEntry, PRESET_CATALOG_MERGED } from '../../core/catalog.js';
import { getSourceInfo, isSourceAvailable } from '../../core/sources.js';
import { isSrcCompatible } from '../../devices/registry.js';
import { TSR_PACK_ZIPS } from '../../data/tsr-packs.js';
import { getActiveDevicesForRender } from '../utils/devices-render.js';
import { getEffectiveZones, getEffectiveJamStyles } from '../../core/state.js';
import { computeBestPresets, resolveRefAmp } from '../utils/ai-helpers.js';
import { findInBanks } from '../utils/preset-helpers.js';
import { clusterSongsBySharedTone, buildLiveLayout, diffLayout, splitSwapsByImpact, buildJamLayout } from '../utils/optimizer-helpers.js';
import { CC, TYPE_LABELS } from '../utils/ui-constants.js';
import { scoreColor } from '../components/score-utils.js';
import Breadcrumb from '../components/Breadcrumb.jsx';

// Phase 14.1 — Barre de zones d'un device : strip de banques colorées
// (Live / Jams / Découverte) + 2 curseurs (fin Live / fin Jams) + budget.
// Écrit profile.bankZones[deviceId] via onZones. Modèle flat (One/One+) :
// 1 banque = 1 preset → label "Preset", sinon "Banque".
const ZONE_COLORS = { live: 'var(--accent)', jam: 'var(--brass-300)', disc: 'var(--text-tertiary)' };
function ZonesBar({ device, zones, onZones }) {
  const n = device.maxBanks || 0;
  const { liveEnd, jamEnd } = zones;
  const liveCount = liveEnd;
  const jamCount = jamEnd - liveEnd;
  const discCount = n - jamEnd;
  const cells = [];
  for (let i = 0; i < n; i++) {
    const zone = i < liveEnd ? 'live' : (i < jamEnd ? 'jam' : 'disc');
    cells.push(<div key={i} title={`${i}`} style={{ flex: 1, height: 14, background: ZONE_COLORS[zone], opacity: zone === 'disc' ? 0.35 : 0.85, borderRight: '1px solid var(--bg-elev-1)' }}/>);
  }
  const legend = (color, label, count) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-sec)' }}>
      <span style={{ width: 10, height: 10, background: color, borderRadius: 2, display: 'inline-block', opacity: 0.85 }}/>{label} ({count})
    </span>
  );
  const sliderStyle = { flex: 1, accentColor: 'var(--accent)' };
  return (
    <div style={{ background: 'var(--a3)', border: '1px solid var(--a7)', borderRadius: 'var(--r-md)', padding: '8px 10px', marginBottom: 'var(--s-2)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        <NavIcon id={device.iconId || 'amp'} size={14}/>{device.label}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 400 }}>{tFormat('optimizer.zones-budget', { n }, '{n} banques')}</span>
      </div>
      <div style={{ display: 'flex', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>{cells}</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        {legend(ZONE_COLORS.live, t('optimizer.zone-live', 'Live'), liveCount)}
        {legend(ZONE_COLORS.jam, t('optimizer.zone-jams', 'Jams'), jamCount)}
        {legend(ZONE_COLORS.disc, t('optimizer.zone-discovery', 'Découverte'), discCount)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 64 }}>{t('optimizer.zone-live-end', 'Fin Live')}</span>
        <input type="range" min={0} max={n} value={liveEnd} onChange={(e) => { const v = Number(e.target.value); onZones({ liveEnd: v, jamEnd: Math.max(v, jamEnd) }); }} style={sliderStyle}/>
        <span style={{ fontSize: 11, color: 'var(--text-sec)', minWidth: 28, textAlign: 'right' }}>{liveEnd}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 64 }}>{t('optimizer.zone-jams-end', 'Fin Jams')}</span>
        <input type="range" min={0} max={n} value={jamEnd} onChange={(e) => { const v = Number(e.target.value); onZones({ liveEnd: Math.min(v, liveEnd), jamEnd: v }); }} style={sliderStyle}/>
        <span style={{ fontSize: 11, color: 'var(--text-sec)', minWidth: 28, textAlign: 'right' }}>{jamEnd}</span>
      </div>
    </div>
  );
}

// Mappe le bucket de gain d'une capture vers sa voix triplet (A clean /
// B crunch / C lead = drive + high_gain). Cohérent avec jam.captureVoice.
function captureVoiceOf(gain) {
  const gr = getGainRange(typeof gain === 'number' ? gain : gainToNumeric(gain));
  if (gr === 'clean') return 'A';
  if (gr === 'crunch') return 'B';
  return 'C';
}

function BankOptimizerScreen({
  songDb, setlists,
  banksAnn, onBanksAnn, banksPlug, onBanksPlug,
  banksOne, onBanksOne, banksOnePlus, onBanksOnePlus,
  allGuitars, availableSources, onNavigate, profile, onProfiles, activeProfileId,
}) {
  if (typeof window !== 'undefined' && window.__TONEX_PERF) {
    if (!window.__optimizerRenderStart) window.__optimizerRenderStart = performance.now();
  }
  useEffect(() => {
    if (typeof window !== 'undefined' && window.__TONEX_PERF && window.__optimizerRenderStart) {
      const dt = performance.now() - window.__optimizerRenderStart;
      // eslint-disable-next-line no-console
      console.log(`[perf] BankOptimizerScreen mount: ${dt.toFixed(1)}ms`);
      window.__optimizerRenderStart = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase 14.1 — écrit profile.bankZones[deviceId]. Stamp lastModified
  // pour que le profileHash (Phase 14) déclenche le push Firestore.
  const setBankZones = (deviceId, zones) => {
    if (!onProfiles || !activeProfileId) return;
    onProfiles((p) => {
      const cur = p[activeProfileId]; if (!cur) return p;
      const next = { ...(cur.bankZones || {}), [deviceId]: zones };
      return { ...p, [activeProfileId]: { ...cur, bankZones: next, lastModified: Date.now() } };
    });
  };
  // Phase 14.5 — forçage ampli jam par style + épingles découverte (stamp lastModified).
  const setJamOverride = (deviceId, style, ampModel) => {
    if (!onProfiles || !activeProfileId) return;
    onProfiles((p) => {
      const cur = p[activeProfileId]; if (!cur) return p;
      const dev = { ...((cur.jamOverrides || {})[deviceId] || {}) };
      if (ampModel) dev[style] = ampModel; else delete dev[style];
      const next = { ...(cur.jamOverrides || {}), [deviceId]: dev };
      return { ...p, [activeProfileId]: { ...cur, jamOverrides: next, lastModified: Date.now() } };
    });
  };
  const setDiscoveryPins = (deviceId, fn) => {
    if (!onProfiles || !activeProfileId) return;
    onProfiles((p) => {
      const cur = p[activeProfileId]; if (!cur) return p;
      const list = (cur.discoveryPins || {})[deviceId] || [];
      const updated = fn(list.slice());
      const next = { ...(cur.discoveryPins || {}), [deviceId]: updated };
      return { ...p, [activeProfileId]: { ...cur, discoveryPins: next, lastModified: Date.now() } };
    });
  };
  const enabledDevices = getActiveDevicesForRender(profile);
  const hasPedalDevice = enabledDevices.some((d) => d.deviceKey === 'ann');
  const hasPlugDevice = enabledDevices.some((d) => d.deviceKey === 'plug');
  // Phase 7.50 (B-UX-02) : label dynamique selon le device pedal réellement coché.
  const enabledSet = new Set(profile?.enabledDevices || []);
  const annLabelShort = enabledSet.has('tonex-anniversary')
    ? t('optimizer.anniversary-label-flat', 'Anniversary')
    : (enabledSet.has('tonex-pedal') ? t('optimizer.pedal-label-flat', 'ToneX Pedal') : t('optimizer.pedal-fallback-flat', 'Pédale'));
  const annLabelTiny = enabledSet.has('tonex-anniversary')
    ? t('optimizer.anniversary-short-flat', 'Anniversary')
    : (enabledSet.has('tonex-pedal') ? t('optimizer.pedal-short-flat', 'Pedal') : t('optimizer.pedal-tiny-fallback-flat', 'Pédale'));
  const [slId, setSlId] = useState(setlists[0]?.id || '');
  const [mode, setMode] = useState('improve'); // 'improve' | 'reorganize'
  const [axis, setAxis] = useState('setlist'); // 'setlist' | 'ampFamily'
  const [showMinorByDevice, setShowMinorByDevice] = useState({}); // Phase 14.4 : repli améliorations mineures par device
  const [jamK, setJamK] = useState(1.5); // Phase 14.5 : réglage avancé polyvalence (éphémère, non persisté)
  const sl = setlists.find((s) => s.id === slId);

  const songs = useMemo(() => {
    if (!sl) return [];
    return sl.songIds.map((id) => songDb.find((s) => s.id === id)).filter(Boolean);
  }, [sl, songDb]);

  const PICKUP_ORDER = ['SC', 'HB', 'P90'];
  const pickupTypes = useMemo(() => PICKUP_ORDER.filter((t) => allGuitars.some((g) => g.type === t)), [allGuitars]);

  const bestGuitarForSong = (s) => {
    const cachedGId = s.aiCache?.gId;
    if (cachedGId) { const m = allGuitars.find((g) => g.id === cachedGId); if (m) return m; }
    const ai = s.aiCache?.result;
    if (!ai) return allGuitars[0];
    if (ai.ideal_guitar) {
      const m = findGuitarByAIName(ai.ideal_guitar, allGuitars);
      if (m) return m;
    }
    const pref = ai.pickup_preference;
    if (pref && pref !== 'any') { const m = allGuitars.find((g) => g.type === pref); if (m) return m; }
    const style = ai.song_style || 'rock';
    const targetGain = typeof ai.target_gain === 'number' ? ai.target_gain : null;
    let bestG = allGuitars[0]; let bestScore = 0;
    allGuitars.forEach((g) => {
      const sc = computePickupScore(style, getGainRange(targetGain || 6), g.type);
      if (sc > bestScore) { bestScore = sc; bestG = g; }
    });
    return bestG;
  };

  const analyzeDevice = (banks, deviceKey) => {
    const usedPresets = new Map();
    const songRows = songs.map((s) => {
      const ai = s.aiCache?.result;
      if (!ai?.cot_step1) return { song: s, installed: null, installedScore: -1, ideal: null, idealScore: 0, delta: 0, noAI: true, guitar: null };
      const g = bestGuitarForSong(s);
      const gType = g?.type || 'HB'; const gId = g?.id || '';
      const style = ai.song_style || 'rock';
      const targetGain = typeof ai.target_gain === 'number' ? ai.target_gain : null;
      const cachedPreset = deviceKey === 'ann' ? ai.preset_ann : ai.preset_plug;
      let top = null;
      if (cachedPreset?.label && cachedPreset.score > 0) {
        top = { name: cachedPreset.label, score: cachedPreset.score, bank: cachedPreset.bank, col: cachedPreset.col, amp: '', style: '', breakdown: cachedPreset.breakdown };
      }
      if (!top) {
        const bestInstalled = computeBestPresets(gType, style, deviceKey === 'ann' ? banks : {}, deviceKey === 'plug' ? banks : {}, gId, ai.ref_amp, targetGain, availableSources);
        top = deviceKey === 'ann' ? bestInstalled.annTop : bestInstalled.plugTop;
      }
      const resolvedAmp = resolveRefAmp(ai.ref_amp);
      const allCandidates = [];
      for (const [pName, pInfo] of Object.entries(PRESET_CATALOG_MERGED)) {
        if (!pInfo || !pInfo.amp) continue;
        if (pInfo.src && !isSrcCompatible(pInfo.src, deviceKey)) continue;
        if (pInfo.src && availableSources && availableSources[pInfo.src] === false) continue;
        const sc = computeFinalScore(pInfo, gId, style, targetGain, resolvedAmp, false);
        if (sc >= (top?.score || 0)) allCandidates.push({ name: pName, score: sc, amp: pInfo.amp, style: pInfo.style, src: pInfo.src });
      }
      allCandidates.sort((a, b) => b.score - a.score);
      const idealCompat = [];
      const seenAmps = new Set();
      for (const c of allCandidates) {
        if (!seenAmps.has(c.amp)) { idealCompat.push(c); seenAmps.add(c.amp); }
        if (idealCompat.length >= 10) break;
      }
      const idealTop = idealCompat[0] || null;
      if (top) {
        if (!usedPresets.has(top.name)) usedPresets.set(top.name, { songs: [], bestScore: 0 });
        const u = usedPresets.get(top.name); u.songs.push(s.title); if (top.score > u.bestScore) u.bestScore = top.score;
      }
      return { song: s, installed: top, installedScore: top?.score || 0, ideal: idealTop, idealTop3: idealCompat, idealScore: idealTop?.score || 0, delta: (idealTop?.score || 0) - (top?.score || 0), guitar: g };
    });
    const allInstalled = [];
    for (const [k, v] of Object.entries(banks)) { for (const slot of ['A', 'B', 'C']) { if (v[slot]) allInstalled.push({ name: v[slot], bank: Number(k), slot }); } }
    const unusedPresets = allInstalled.filter((p) => !usedPresets.has(p.name));
    const analyzed = songRows.filter((r) => !r.noAI);
    const covered = analyzed.filter((r) => r.installedScore >= 80).length;
    const acceptable = analyzed.filter((r) => r.installedScore >= 70 && r.installedScore < 80).length;
    const poor = analyzed.filter((r) => r.installedScore < 70).length;
    const noAICount = songRows.filter((r) => r.noAI).length;
    return { songRows, usedPresets, unusedPresets, covered, acceptable, poor, noAICount };
  };

  const EMPTY_ANALYSIS = { songRows: [], usedPresets: new Map(), unusedPresets: [], covered: 0, acceptable: 0, poor: 0, noAICount: 0, loading: true };
  const [annAnalysis, setAnnAnalysis] = useState(EMPTY_ANALYSIS);
  const [plugAnalysis, setPlugAnalysis] = useState(EMPTY_ANALYSIS);
  useEffect(() => {
    if (mode !== 'improve') return undefined;
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      const t0 = performance.now();
      const ann = analyzeDevice(banksAnn, 'ann');
      if (typeof window !== 'undefined' && window.__TONEX_PERF) {
        // eslint-disable-next-line no-console
        console.log(`[perf] analyzeDevice(ann): ${(performance.now() - t0).toFixed(0)}ms`);
      }
      if (!cancelled) setAnnAnalysis(ann);
      const t1 = performance.now();
      const plug = analyzeDevice(banksPlug, 'plug');
      if (typeof window !== 'undefined' && window.__TONEX_PERF) {
        // eslint-disable-next-line no-console
        console.log(`[perf] analyzeDevice(plug): ${(performance.now() - t1).toFixed(0)}ms`);
      }
      if (!cancelled) setPlugAnalysis(plug);
    }, 0);
    return () => { cancelled = true; clearTimeout(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, songs, allGuitars, banksAnn, banksPlug, availableSources]);

  const autoPlace = (banks, presetName, deviceKey, songRows) => {
    const entry = findCatalogEntry(presetName);
    if (!entry) return null;
    const gain = typeof entry.gain === 'number' ? entry.gain : gainToNumeric(entry.gain);
    const gainRange = getGainRange(gain);
    const slot = gainRange === 'clean' ? 'A' : gainRange === 'high_gain' ? 'C' : 'B';
    const startBank = deviceKey === 'ann' ? 0 : 1;
    const maxBank = deviceKey === 'ann' ? 49 : 9;
    for (let i = startBank; i <= maxBank; i++) {
      const b = banks[i];
      if (!b || !b[slot]) return { bank: i, slot, replaces: null };
    }
    let worstBank = null; let worstScore = 101; let worstPreset = null;
    for (let i = startBank; i <= maxBank; i++) {
      const cur = banks[i]?.[slot]; if (!cur) continue;
      const sc = computeSimpleScore(cur, null, pickupTypes[0] || 'HB');
      if (sc < worstScore) { worstScore = sc; worstBank = i; worstPreset = cur; }
    }
    if (worstBank != null) return { bank: worstBank, slot, replaces: worstPreset, replacesScore: worstScore };
    return null;
  };

  const PRIO_DELTA_MIN = 1;
  const computePriority = (rows, deviceKey, banks) => {
    const grouped = {};
    for (const r of rows) {
      if (r.noAI) continue;
      const candidates = r.idealTop3?.length ? r.idealTop3 : (r.ideal ? [r.ideal] : []);
      for (const cand of candidates) {
        if (!cand?.name) continue;
        if (findInBanks(cand.name, banks)) continue;
        const candScore = cand.score || 0;
        const delta = candScore - r.installedScore;
        if (delta < PRIO_DELTA_MIN) continue;
        const k = cand.name;
        if (!grouped[k]) {
          const place = autoPlace(banks, cand.name, deviceKey, rows);
          if (!place) continue;
          grouped[k] = { device: deviceKey, preset: cand, songs: [], totalDelta: 0, place, coveredIds: new Set() };
        }
        if (grouped[k].coveredIds.has(r.song.id)) continue;
        grouped[k].coveredIds.add(r.song.id);
        grouped[k].songs.push({ song: r.song, currentScore: r.installedScore, newScore: candScore, delta });
        grouped[k].totalDelta += delta;
      }
    }
    return Object.values(grouped).sort((a, b) => b.totalDelta - a.totalDelta).slice(0, 5);
  };
  const annPriority = useMemo(() => computePriority(annAnalysis.songRows, 'ann', banksAnn), [annAnalysis, banksAnn]);
  const plugPriority = useMemo(() => computePriority(plugAnalysis.songRows, 'plug', banksPlug), [plugAnalysis, banksPlug]);

  const computeMean = (rows) => {
    const ar = rows.filter((r) => !r.noAI);
    if (!ar.length) return null;
    return Math.round(ar.reduce((s, r) => s + r.installedScore, 0) / ar.length);
  };
  const annMean = computeMean(annAnalysis.songRows);
  const plugMean = computeMean(plugAnalysis.songRows);
  const computeProjected = (rows, priorityList) => {
    const ar = rows.filter((r) => !r.noAI);
    if (!ar.length) return null;
    const upgrades = {};
    priorityList.forEach((a) => {
      a.songs.forEach((s) => { if ((upgrades[s.song.id] || 0) < s.newScore) upgrades[s.song.id] = s.newScore; });
    });
    return Math.round(ar.reduce((sum, r) => sum + (upgrades[r.song.id] != null ? Math.max(upgrades[r.song.id], r.installedScore) : r.installedScore), 0) / ar.length);
  };
  const annProjected = computeProjected(annAnalysis.songRows, annPriority);
  const plugProjected = computeProjected(plugAnalysis.songRows, plugPriority);

  const applyAction = (action) => {
    if (!action.place) return;
    const onBanks = action.device === 'ann' ? onBanksAnn : onBanksPlug;
    onBanks((prev) => ({ ...prev, [action.place.bank]: { ...(prev[action.place.bank] || { cat: '', A: '', B: '', C: '' }), [action.place.slot]: action.preset.name } }));
  };
  const applyAllForDevice = (list, deviceLabel, curMean, projMean) => {
    if (!list.length) return;
    if (!window.confirm(tFormat('optimizer.apply-confirm', { count: list.length, device: deviceLabel, cur: curMean, proj: projMean, delta: projMean - curMean }, 'Appliquer les {count} actions {device} ?\nGain estimé : {cur}% → {proj}% (+{delta}%)'))) return;
    list.forEach(applyAction);
  };

  // ─────────────────────────────────────────────────────────────────
  // Phase 14.3 — Mode RÉORGANISER : zone Live mutualisée par device.
  // Descripteur des devices ToneX activés + leurs banks/setters/index.
  // ─────────────────────────────────────────────────────────────────
  const REORG_DEVMETA = {
    ann: { banks: banksAnn, onBanks: onBanksAnn, startBank: 0 },
    plug: { banks: banksPlug, onBanks: onBanksPlug, startBank: 1 },
    one: { banks: banksOne, onBanks: onBanksOne, startBank: 1 },
    oneplus: { banks: banksOnePlus, onBanks: onBanksOnePlus, startBank: 1 },
  };
  const reorgDevices = enabledDevices
    .filter((d) => REORG_DEVMETA[d.deviceKey] && REORG_DEVMETA[d.deviceKey].onBanks && ['triplet', 'flat'].includes(d.bankModel))
    .map((d) => ({ ...d, ...REORG_DEVMETA[d.deviceKey] }));

  // Construit les clusters d'un device (closures de scoring injectées dans
  // clusterSongsBySharedTone). Tout le catalog est filtré aux sources
  // compatibles avec le device (isSrcCompatible + availableSources).
  const buildReorgForDevice = (dev) => {
    const deviceKey = dev.deviceKey;
    const srcOk = (src) => isSrcCompatible(src, deviceKey) && !(src && availableSources && availableSources[src] === false);
    const ctxBySong = new Map();
    const songCtx = (s) => {
      if (ctxBySong.has(s.id)) return ctxBySong.get(s.id);
      const ai = s.aiCache?.result;
      let c = null;
      if (ai?.cot_step1) {
        const g = bestGuitarForSong(s);
        c = {
          gId: g?.id || '', gType: g?.type || 'HB',
          style: ai.song_style || 'rock',
          targetGain: typeof ai.target_gain === 'number' ? ai.target_gain : null,
          resolvedAmp: resolveRefAmp(ai.ref_amp),
        };
      }
      ctxBySong.set(s.id, c); return c;
    };
    // Reco idéale du morceau sur CE device (meilleure capture catalog filtrée).
    const getReco = (s) => {
      const c = songCtx(s);
      if (!c) return null;
      let best = null; let bestScore = -1;
      for (const [name, info] of Object.entries(PRESET_CATALOG_MERGED)) {
        if (!info || !info.amp) continue;
        if (info.src && !srcOk(info.src)) continue;
        const sc = computeFinalScore(info, c.gId, c.style, c.targetGain, c.resolvedAmp, false);
        if (sc > bestScore) { bestScore = sc; best = { name, amp: info.amp, capture: name, score: sc }; }
      }
      return best;
    };
    // Meilleure capture par voix (A/B/C) d'un ampli, jugée sur le morceau
    // représentatif du groupe (ctx du 1er morceau).
    const voicesForAmp = (amp, groupSongs) => {
      const repr = groupSongs && groupSongs[0];
      const c = repr ? songCtx(repr) : null;
      const best = { A: null, B: null, C: null };
      const bestSc = { A: -1, B: -1, C: -1 };
      for (const [name, info] of Object.entries(PRESET_CATALOG_MERGED)) {
        if (!info || info.amp !== amp) continue;
        if (info.src && !srcOk(info.src)) continue;
        const v = captureVoiceOf(info.gain);
        const sc = c
          ? computeFinalScore(info, c.gId, c.style, c.targetGain, c.resolvedAmp, false)
          : (info.scores?.HB ?? 60);
        if (sc > bestSc[v]) { bestSc[v] = sc; best[v] = name; }
      }
      return best;
    };
    const scoreCapture = (s, captureName) => {
      const c = songCtx(s); if (!c) return 0;
      const e = findCatalogEntry(captureName); if (!e) return 0;
      return computeFinalScore(e, c.gId, c.style, c.targetGain, c.resolvedAmp, false);
    };
    return clusterSongsBySharedTone(songs, {
      bankModel: dev.bankModel,
      getReco,
      voicesForAmp: dev.bankModel === 'triplet' ? voicesForAmp : undefined,
      scoreCapture,
    });
  };

  // reorgData : { [deviceKey]: { clusters, unanalyzed } }. Calculé UNIQUEMENT
  // en mode 'reorganize' (scan catalog × morceaux × devices = lourd) + déféré.
  const [reorgData, setReorgData] = useState(null);
  useEffect(() => {
    if (mode !== 'reorganize') { setReorgData(null); return undefined; }
    let cancelled = false;
    const tm = setTimeout(() => {
      if (cancelled) return;
      const t0 = performance.now();
      const out = {};
      for (const dev of reorgDevices) out[dev.deviceKey] = buildReorgForDevice(dev);
      if (typeof window !== 'undefined' && window.__TONEX_PERF) {
        // eslint-disable-next-line no-console
        console.log(`[perf] reorg build (${reorgDevices.length} dev): ${(performance.now() - t0).toFixed(0)}ms`);
      }
      if (!cancelled) setReorgData(out);
    }, 0);
    return () => { cancelled = true; clearTimeout(tm); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, songs, allGuitars, banksAnn, banksPlug, banksOne, banksOnePlus, availableSources]);

  // Phase 14.5 — jamData : ranking « ampli passe-partout » par style × device.
  // Pool = TOUTE la librairie (songDb) filtrée par style dans rankJamAmps —
  // un jam est un contexte de STYLE général, pas la setlist courante (qui pilote
  // le Live). Catalog pré-filtré aux sources compatibles du device.
  const jamStyles = getEffectiveJamStyles(profile);
  const buildJamForDevice = (dev) => {
    const deviceKey = dev.deviceKey;
    const srcOk = (src) => isSrcCompatible(src, deviceKey) && !(src && availableSources && availableSources[src] === false);
    const cat = {};
    for (const [name, info] of Object.entries(PRESET_CATALOG_MERGED)) {
      if (!info || !info.amp) continue;
      if (info.src && !srcOk(info.src)) continue;
      cat[name] = info;
    }
    const rankedByStyle = {};
    for (const style of jamStyles) {
      rankedByStyle[style] = rankJamAmps(style, songDb, cat, availableSources, {
        guitars: allGuitars, isSourceAvailable: () => true, k: jamK,
      });
    }
    return { rankedByStyle };
  };
  const [jamData, setJamData] = useState(null); // { [deviceKey]: { rankedByStyle } }
  useEffect(() => {
    if (mode !== 'reorganize') { setJamData(null); return undefined; }
    let cancelled = false;
    const tm = setTimeout(() => {
      if (cancelled) return;
      const t0 = performance.now();
      const out = {};
      for (const dev of reorgDevices) out[dev.deviceKey] = buildJamForDevice(dev);
      if (typeof window !== 'undefined' && window.__TONEX_PERF) {
        // eslint-disable-next-line no-console
        console.log(`[perf] jam ranking (${reorgDevices.length} dev × ${jamStyles.length} styles): ${(performance.now() - t0).toFixed(0)}ms`);
      }
      if (!cancelled) setJamData(out);
    }, 0);
    return () => { cancelled = true; clearTimeout(tm); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, songDb, allGuitars, availableSources, jamK, jamStyles.join(',')]);

  const catLabelOf = (cluster) => (cluster.kind === 'amp' ? (cluster.amp || '') : (cluster.key || ''));
  const slotsToBank = (slots, cluster) => ({
    cat: catLabelOf(cluster),
    A: slots.A || '', B: slots.B || '', C: slots.C || '',
  });
  const applyOneBank = (dev, b) => {
    if (!window.confirm(tFormat('optimizer.apply-bank-confirm', { bank: b.bank }, 'Appliquer la banque {bank} ?'))) return;
    dev.onBanks((prev) => ({ ...prev, [b.bank]: slotsToBank(b.slots, b.cluster) }));
  };
  const applyLiveZone = (dev, liveBanks, freed) => {
    if (!liveBanks.length && !freed.length) return;
    if (!window.confirm(tFormat('optimizer.apply-live-confirm', { n: liveBanks.length }, 'Réécrire la zone Live ({n} banques) ? Les banques libérées seront vidées. Jams et Découverte restent intactes.'))) return;
    dev.onBanks((prev) => {
      const next = {}; for (const k in prev) next[k] = prev[k];
      liveBanks.forEach((b) => { next[b.bank] = slotsToBank(b.slots, b.cluster); });
      freed.forEach((p) => { next[p.bank] = { cat: '', A: '', B: '', C: '' }; });
      return next;
    });
  };

  // Phase 14.5 — apply jam (n'écrit QUE la zone Jams).
  const jamBankToSlots = (b) => (b.slots.B !== undefined || b.slots.C !== undefined)
    ? { cat: b.style, A: b.slots.A || '', B: b.slots.B || '', C: b.slots.C || '' }
    : { cat: b.style, A: b.slots.A || '' };
  const applyJamBank = (dev, b) => {
    if (!window.confirm(tFormat('optimizer.jam-apply-confirm', { bank: b.bank }, 'Appliquer la banque jam {bank} ?'))) return;
    dev.onBanks((prev) => ({ ...prev, [b.bank]: jamBankToSlots(b) }));
  };
  const applyAllJams = (dev, jamBanks) => {
    if (!jamBanks.length) return;
    if (!window.confirm(tFormat('optimizer.jam-apply-all-confirm', { n: jamBanks.length }, 'Écrire les {n} banques jam ? La zone Jams seule est modifiée.'))) return;
    dev.onBanks((prev) => {
      const next = {}; for (const k in prev) next[k] = prev[k];
      jamBanks.forEach((b) => { next[b.bank] = jamBankToSlots(b); });
      return next;
    });
  };

  // Phase 14.5 — Découverte : navigation Explorer + promotion + épingles.
  const openInExplorer = (name) => {
    if (typeof window !== 'undefined') window._explorePreset = name;
    if (onNavigate) onNavigate('explore');
  };
  // 1re banque/slot libre de la zone Live pour une capture (promotion → Live).
  const firstFreeLiveSlot = (dev, captureName) => {
    const zones = getEffectiveZones(profile, dev.id, dev.maxBanks);
    const start = dev.startBank; const end = dev.startBank + zones.liveEnd;
    if (dev.bankModel === 'flat') {
      for (let n = start; n < end; n++) { if (!(dev.banks[n] && dev.banks[n].A)) return { bank: n, slot: 'A' }; }
      return null;
    }
    const e = findCatalogEntry(captureName);
    const gr = getGainRange(typeof e?.gain === 'number' ? e.gain : gainToNumeric(e?.gain));
    const slot = gr === 'clean' ? 'A' : gr === 'high_gain' ? 'C' : 'B';
    for (let n = start; n < end; n++) { if (!(dev.banks[n] && dev.banks[n][slot])) return { bank: n, slot }; }
    return null;
  };
  const promoteToJam = (dev, name) => {
    const e = findCatalogEntry(name);
    const style = e?.style || jamStyles[0] || 'rock';
    setJamOverride(dev.deviceKey, style, e?.amp || name);
    setDiscoveryPins(dev.deviceKey, (l) => l.filter((x) => x !== name));
  };
  const promoteToLive = (dev, name) => {
    const place = firstFreeLiveSlot(dev, name);
    if (!place) { window.alert(t('optimizer.live-full', 'Zone Live pleine — libère un slot ou agrandis-la.')); return; }
    dev.onBanks((prev) => ({ ...prev, [place.bank]: { ...(prev[place.bank] || { cat: '', A: '', B: '', C: '' }), [place.slot]: name } }));
    setDiscoveryPins(dev.deviceKey, (l) => l.filter((x) => x !== name));
  };

  const sectionStyle = { background: 'var(--bg-elev-1)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: 'var(--s-4)', marginBottom: 'var(--s-4)', contentVisibility: 'auto', containIntrinsicSize: '0 600px' };
  const eyebrow = (icon, label) => <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', color: 'var(--accent)', marginBottom: 'var(--s-3)' }}>{label}</div>;

  const renderStats = (a) => (
    <div style={{ display: 'flex', gap: 'var(--s-2)', marginBottom: 'var(--s-3)' }}>
      {[{ n: a.covered, c: 'var(--success)', bg: 'var(--green-bg)', bd: 'var(--green-border)', l: t('optimizer.stat-covered', 'Couverts') }, { n: a.acceptable, c: 'var(--yellow)', bg: 'var(--yellow-bg)', bd: 'var(--yellow-border)', l: t('optimizer.stat-medium', 'Moyens') }, { n: a.poor, c: 'var(--danger)', bg: 'var(--red-bg)', bd: 'var(--red-border)', l: t('optimizer.stat-weak', 'Faibles') }].map(({ n, c, bg, bd, l }) => (
        <div key={l} style={{ flex: 1, background: bg, border: '1px solid ' + bd, borderRadius: 'var(--r-md)', padding: 'var(--s-2)', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-lg)', fontWeight: 800, color: c }}>{n}</div>
          <div style={{ fontSize: 9, color: 'var(--text-secondary)' }}>{l}</div>
        </div>
      ))}
    </div>
  );

  // ── Rendu d'un device en mode Réorganiser ──
  const DIFF_META = {
    inchangee: { color: 'var(--text-tertiary)', label: t('optimizer.diff-unchanged', 'inchangée') },
    modifiee: { color: 'var(--accent)', label: t('optimizer.diff-modified', 'modifiée') },
    fusionnee: { color: 'var(--success)', label: t('optimizer.diff-merged', 'fusionnée') },
    liberee: { color: 'var(--yellow)', label: t('optimizer.diff-freed', 'libérée → vidée') },
  };
  const renderReorgDevice = (dev) => {
    const data = reorgData?.[dev.deviceKey];
    if (!data) return null;
    const hasBanks = Object.keys(dev.banks || {}).length > 0;
    if (!hasBanks) {
      return (
        <div key={dev.id} style={{ marginBottom: 'var(--s-4)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><NavIcon id={dev.iconId || 'amp'} size={14}/>{dev.label}</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{t('optimizer.reorg-device-empty', 'Aucune banque installée — charge les presets factory dans Mon matériel.')}</div>
        </div>
      );
    }
    const zones = getEffectiveZones(profile, dev.id, dev.maxBanks);
    const liveCount = zones.liveEnd; // nombre de banques de la zone Live
    const { banks: layoutBanks } = buildLiveLayout(data.clusters, axis, { bankModel: dev.bankModel, startBank: dev.startBank });
    const overflow = layoutBanks.length > liveCount;
    const liveBanks = layoutBanks.slice(0, liveCount);
    const diff = diffLayout(dev.banks, liveBanks, { start: dev.startBank, liveEnd: dev.startBank + liveCount });
    const statusByBank = Object.fromEntries(diff.perBank.map((p) => [p.bank, p.status]));
    const freed = diff.perBank.filter((p) => p.status === 'liberee');
    const slotDefs = dev.bankModel === 'flat'
      ? [{ s: 'A', l: t('optimizer.flat-slot', 'Preset') }]
      : [{ s: 'A', l: t('optimizer.slot-clean', 'Clean') }, { s: 'B', l: t('optimizer.slot-crunch', 'Crunch') }, { s: 'C', l: t('optimizer.slot-lead', 'Lead') }];

    const subHead = (label) => <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', color: 'var(--text-tertiary)', margin: '12px 0 6px' }}>{label}</div>;
    const discBtn = { background: 'var(--bg-elev-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 'var(--r-sm)', padding: '3px 8px', fontSize: 9, fontWeight: 700, cursor: 'pointer' };

    // ── Zone Jams ──
    const renderJamsZone = () => {
      const jamCapacity = zones.jamEnd - zones.liveEnd;
      const jamStart = dev.startBank + zones.liveEnd;
      if (jamCapacity <= 0) {
        return (
          <>
            {subHead(t('optimizer.jams-title', 'Jams (amplis passe-partout)'))}
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{t('optimizer.jams-need-zone', 'Agrandis la zone Jams (curseurs ci-dessus) pour générer des banques d\'impro.')}</div>
          </>
        );
      }
      const jd = jamData?.[dev.deviceKey];
      const rankedByStyle = jd?.rankedByStyle || {};
      const chosenAmp = (profile?.jamOverrides || {})[dev.deviceKey] || {};
      const { banks: jamBanks, overflow: jamOverflow } = buildJamLayout(rankedByStyle, { bankModel: dev.bankModel, jamStart, jamCapacity, chosenAmp });
      return (
        <>
          {subHead(t('optimizer.jams-title', 'Jams (amplis passe-partout)'))}
          {!jd
            ? <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t('optimizer.reorg-loading', 'Analyse en cours…')}</div>
            : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{tFormat('optimizer.jam-k', { k: jamK.toFixed(1) }, 'Régularité k={k}')}</span>
                  <input type="range" min={0} max={3} step={0.5} value={jamK} onChange={(e) => setJamK(Number(e.target.value))} style={{ flex: 1, maxWidth: 160, accentColor: 'var(--accent)' }}/>
                </div>
                {jamOverflow && <div style={{ fontSize: 10, color: 'var(--yellow)', background: 'var(--yellow-bg)', border: '1px solid var(--yellow-border)', borderRadius: 'var(--r-sm)', padding: '4px 8px', marginBottom: 6 }}>{t('optimizer.jams-overflow', 'Trop de styles pour la zone Jams — agrandis-la ou réduis tes styles de jam.')}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 4, marginBottom: 8 }}>
                  {jamStyles.map((style) => {
                    const ranked = rankedByStyle[style] || [];
                    if (!ranked.length) {
                      return <div key={style} style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '6px 8px' }}><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{style}</div><div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{t('optimizer.jam-no-amp', 'Aucun ampli passe-partout dispo (active des packs).')}</div></div>;
                    }
                    const chosen = chosenAmp[style] || ranked[0].ampModel;
                    const cr = ranked.find((r) => r.ampModel === chosen) || ranked[0];
                    const styleBanks = jamBanks.filter((b) => b.style === style);
                    const bf = cr.bankFill || {};
                    return (
                      <div key={style} style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '6px 8px' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'capitalize', marginBottom: 2 }}>{style}</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 3 }}>
                          <span style={{ fontSize: 9, background: 'var(--a8)', color: 'var(--text)', borderRadius: 'var(--r-sm)', padding: '1px 6px', fontWeight: 700 }}>{tFormat('optimizer.jam-polyvalence', { v: cr.polyvalence }, 'polyv. {v}')}</span>
                          <span style={{ fontSize: 9, background: 'var(--a8)', color: 'var(--text)', borderRadius: 'var(--r-sm)', padding: '1px 6px', fontWeight: 700 }}>{tFormat('optimizer.jam-coverage', { n: cr.couverture, total: cr.n }, 'couv. {n}/{total}')}</span>
                          {cr.gainSpanPartial && <span style={{ fontSize: 9, background: 'var(--yellow-bg)', color: 'var(--yellow)', border: '1px solid var(--yellow-border)', borderRadius: 'var(--r-sm)', padding: '1px 6px', fontWeight: 700 }}>{t('optimizer.jam-span-partial', 'span partiel')}</span>}
                        </div>
                        <select value={chosenAmp[style] || ''} onChange={(e) => setJamOverride(dev.deviceKey, style, e.target.value || null)} style={{ width: '100%', background: 'var(--bg-elev-1)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-sm)', padding: '3px 6px', fontSize: 10, marginBottom: 4 }}>
                          <option value="">{tFormat('optimizer.jam-auto', { amp: ranked[0].ampModel }, 'Auto ({amp})')}</option>
                          {ranked.slice(0, 8).map((r) => <option key={r.ampModel} value={r.ampModel}>{r.ampModel} ({r.polyvalence})</option>)}
                        </select>
                        {[{ s: 'A', l: t('optimizer.slot-clean', 'Clean') }, { s: 'B', l: t('optimizer.slot-crunch', 'Crunch') }, { s: 'C', l: t('optimizer.slot-lead', 'Lead') }].map((x) => (
                          <div key={x.s} style={{ fontSize: 9, display: 'flex', gap: 3, alignItems: 'baseline', marginBottom: 1 }}>
                            <span style={{ fontWeight: 700, color: CC[x.s] || 'var(--text-tertiary)', width: 42, flexShrink: 0 }}>{x.l}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: bf[x.s] ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>{bf[x.s] || '—'}</span>
                          </div>
                        ))}
                        {styleBanks.length > 0
                          ? <button onClick={() => applyAllJams(dev, styleBanks)} style={{ marginTop: 6, width: '100%', background: 'var(--bg-elev-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 'var(--r-sm)', padding: '3px 6px', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>{tFormat('optimizer.jam-apply', { banks: styleBanks.map((b) => b.bank).join('/') }, 'Installer en banque {banks}')}</button>
                          : <div style={{ fontSize: 9, color: 'var(--yellow)', marginTop: 6 }}>{t('optimizer.jam-no-room', 'pas de place dans la zone Jams')}</div>}
                      </div>
                    );
                  })}
                </div>
                {jamBanks.length > 1 && <button onClick={() => applyAllJams(dev, jamBanks)} style={{ width: '100%', background: 'linear-gradient(180deg,var(--brass-200,#d4a017),var(--brass-400,#b8860b))', border: 'none', color: 'var(--tolex-900,#1a1a1a)', borderRadius: 'var(--r-md)', padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>{tFormat('optimizer.jam-apply-all', { n: jamBanks.length }, 'Installer toutes les jams ({n})')}</button>}
              </>
            )}
        </>
      );
    };

    // ── Zone Découverte ──
    const renderDiscoveryZone = () => {
      const jd = jamData?.[dev.deviceKey];
      const pins = (profile?.discoveryPins || {})[dev.deviceKey] || [];
      // Suggestions : runners-up (rangs 1-3) des rankings jam, captures non épinglées.
      const suggSet = new Set();
      if (jd) {
        for (const style of jamStyles) {
          const ranked = jd.rankedByStyle[style] || [];
          for (const r of ranked.slice(1, 4)) {
            const bf = r.bankFill || {};
            [bf.A, bf.B, bf.C].forEach((c) => { if (c && !pins.includes(c)) suggSet.add(c); });
          }
        }
      }
      const suggestions = Array.from(suggSet).slice(0, 6);
      const posOf = (name) => { const loc = findInBanks(name, dev.banks); return loc ? `${loc.bank}${loc.slot || ''}` : null; };
      const pinRow = (name) => {
        const e = findCatalogEntry(name); const si = getSourceInfo(e); const pos = posOf(name);
        return (
          <div key={name} style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '6px 8px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
            <div style={{ fontSize: 9, color: 'var(--text-sec)', marginBottom: 4 }}>{si ? `${si.icon} ${si.label}` : ''}{pos ? ` · ${tFormat('optimizer.discovery-at', { pos }, 'Banque {pos}')}` : ` · ${t('optimizer.discovery-not-installed', 'non installé')}`}</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button onClick={() => openInExplorer(name)} style={discBtn}>{t('optimizer.discovery-see', 'Voir')}</button>
              <button onClick={() => promoteToJam(dev, name)} style={discBtn}>{t('optimizer.discovery-to-jam', '→ Jam')}</button>
              <button onClick={() => promoteToLive(dev, name)} style={discBtn}>{t('optimizer.discovery-to-live', '→ Live')}</button>
              <button onClick={() => setDiscoveryPins(dev.deviceKey, (l) => l.filter((x) => x !== name))} style={{ ...discBtn, color: 'var(--yellow)' }}>{t('optimizer.discovery-unpin', 'Retirer')}</button>
            </div>
          </div>
        );
      };
      return (
        <>
          {subHead(t('optimizer.discovery-title', 'Découverte (à auditionner)'))}
          {pins.length === 0 && suggestions.length === 0
            ? <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{t('optimizer.discovery-empty', 'Épingle des presets à auditionner depuis l\'Explorer ou les suggestions.')}</div>
            : (
              <>
                {pins.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 4, marginBottom: 6 }}>{pins.map(pinRow)}</div>}
                {suggestions.length > 0 && (
                  <>
                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 4 }}>{t('optimizer.discovery-suggestions', 'Suggestions à auditionner :')}</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {suggestions.map((name) => (
                        <button key={name} onClick={() => setDiscoveryPins(dev.deviceKey, (l) => (l.includes(name) ? l : [...l, name]))} style={{ background: 'var(--bg-elev-1)', border: '1px dashed var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 'var(--r-sm)', padding: '3px 8px', fontSize: 9, fontWeight: 600, cursor: 'pointer' }}>+ {name}</button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
        </>
      );
    };

    return (
      <div key={dev.id} style={{ marginBottom: 'var(--s-4)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <NavIcon id={dev.iconId || 'amp'} size={14}/>{dev.label}
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 400 }}>{tFormat('optimizer.reorg-metrics', { merged: diff.merged, moved: diff.moved, freed: diff.freed, unchanged: diff.unchanged }, '{merged} fus. · {moved} modif. · {freed} libér. · {unchanged} inch.')}</span>
        </div>
        {subHead(t('optimizer.live-title', 'Live (1 banque/morceau)'))}
        {overflow && (
          <div style={{ fontSize: 10, color: 'var(--yellow)', background: 'var(--yellow-bg)', border: '1px solid var(--yellow-border)', borderRadius: 'var(--r-sm)', padding: '4px 8px', marginBottom: 6 }}>
            {tFormat('optimizer.reorg-overflow', { n: layoutBanks.length, cap: liveCount }, 'Déborde la zone Live ({n} banques pour {cap} dispo) — agrandis la zone Live ci-dessus.')}
          </div>
        )}
        {data.unanalyzed.length > 0 && (
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6, fontStyle: 'italic' }}>
            {tFormat('optimizer.reorg-unanalyzed', { n: data.unanalyzed.length }, '{n} morceau(x) à analyser d\'abord (pas d\'analyse IA).')}
          </div>
        )}
        {liveBanks.length === 0
          ? <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t('optimizer.reorg-empty', 'Aucun morceau analysé pour proposer une réorganisation.')}</div>
          : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 4, marginBottom: 'var(--s-3)' }}>
                {liveBanks.map((b) => {
                  const st = statusByBank[b.bank] || 'modifiee';
                  const meta = DIFF_META[st] || DIFF_META.modifiee;
                  return (
                    <div key={b.bank} style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '6px 8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2, gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)' }}>{b.bank}</span>
                        <span style={{ fontSize: 8, fontWeight: 700, color: meta.color, textTransform: 'uppercase' }}>{meta.label}</span>
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                        {catLabelOf(b.cluster)}
                        {b.cluster.shared && <span style={{ color: 'var(--success)', marginLeft: 4 }}>· {tPlural('optimizer.songs-count', b.songCount, {}, { one: '1 morceau', other: '{count} morceaux' })}</span>}
                      </div>
                      {slotDefs.map((x) => (
                        <div key={x.s} style={{ fontSize: 9, display: 'flex', gap: 3, alignItems: 'baseline', marginBottom: 1 }}>
                          <span style={{ fontWeight: 700, color: CC[x.s] || 'var(--text-tertiary)', width: 42, flexShrink: 0 }}>{x.l}</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: b.slots[x.s] ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>{b.slots[x.s] || '—'}</span>
                        </div>
                      ))}
                      <button onClick={() => applyOneBank(dev, b)} style={{ marginTop: 6, width: '100%', background: 'var(--bg-elev-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 'var(--r-sm)', padding: '3px 6px', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>{t('optimizer.apply-this-bank', 'Appliquer cette banque')}</button>
                    </div>
                  );
                })}
              </div>
              {freed.length > 0 && (
                <div style={{ fontSize: 10, color: 'var(--yellow)', marginBottom: 'var(--s-2)' }}>
                  {tFormat('optimizer.reorg-freed-list', { banks: freed.map((p) => p.bank).join(', ') }, 'Banques libérées (vidées) : {banks}')}
                </div>
              )}
              <button onClick={() => applyLiveZone(dev, liveBanks, freed)} style={{ width: '100%', background: 'linear-gradient(180deg,var(--brass-200,#d4a017),var(--brass-400,#b8860b))', border: 'none', color: 'var(--tolex-900,#1a1a1a)', borderRadius: 'var(--r-md)', padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
                {tFormat('optimizer.apply-live-zone', { n: liveBanks.length }, 'Appliquer la zone Live ({n} banques)')}
              </button>
            </>
          )}
        {renderJamsZone()}
        {renderDiscoveryZone()}
      </div>
    );
  };

  if (typeof window !== 'undefined' && window.__TONEX_PERF && window.__optimizerRenderStart) {
    // eslint-disable-next-line no-console
    console.log(`[perf] BankOptimizerScreen before-return: ${(performance.now() - window.__optimizerRenderStart).toFixed(0)}ms`);
  }

  const segBtn = (id, label) => (
    <button onClick={() => setMode(id)} style={{ flex: 1, background: mode === id ? 'var(--accent)' : 'var(--bg-elev-1)', color: mode === id ? 'var(--text-inverse)' : 'var(--text-secondary)', border: '1px solid ' + (mode === id ? 'var(--accent)' : 'var(--border-subtle)'), borderRadius: 'var(--r-sm)', padding: '8px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
  );
  const axisBtn = (id, label) => (
    <button onClick={() => setAxis(id)} style={{ background: axis === id ? 'var(--a8)' : 'transparent', color: axis === id ? 'var(--text)' : 'var(--text-tertiary)', border: '1px solid ' + (axis === id ? 'var(--a15)' : 'var(--border-subtle)'), borderRadius: 'var(--r-sm)', padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
  );

  return (
    <div>
      <Breadcrumb crumbs={[{ label: t('common.home', 'Accueil'), screen: 'list' }, { label: t('optimizer.breadcrumb', 'Optimiseur') }]} onNavigate={onNavigate}/>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--s-4)', display: 'flex', alignItems: 'center', gap: 8 }}><NavIcon id="wrench" size={20}/>{t('optimizer.title-flat', 'Optimiseur de Banks')}</div>

      <div style={{ marginBottom: 'var(--s-3)' }}>
        <select value={slId} onChange={(e) => setSlId(e.target.value)} style={{ width: '100%', background: 'var(--bg-elev-1)', color: 'var(--text-primary)', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-md)', padding: '8px 12px', fontSize: 13 }}>
          {setlists.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.songIds.length})</option>)}
        </select>
      </div>

      {/* Phase 14.1 — Barre de zones par device (Live / Jams / Découverte) */}
      {onProfiles && enabledDevices.filter((d) => ['triplet', 'flat'].includes(d.bankModel)).map((d) => (
        <ZonesBar
          key={d.id}
          device={d}
          zones={getEffectiveZones(profile, d.id, d.maxBanks)}
          onZones={(z) => setBankZones(d.id, z)}
        />
      ))}

      {/* Phase 14.3 — Segmented control Améliorer / Réorganiser */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--s-3)' }}>
        {segBtn('improve', t('optimizer.mode-improve', 'Améliorer'))}
        {segBtn('reorganize', t('optimizer.mode-reorganize', 'Réorganiser'))}
      </div>

      {mode === 'improve' && (
        <>
          {/* TOP 3 ACTIONS PRIORITAIRES PAR DEVICE */}
          {songs.length > 0 && (() => {
            // Phase 14.4 — carte d'un swap (réutilisée par utiles + mineures).
            const renderSwapCard = (a, i, { badges }) => {
              const songsList = a.songs.map((s) => s.song.title);
              const songsPreview = songsList.slice(0, 3).join(', ') + (songsList.length > 3 ? ` +${songsList.length - 3}` : '');
              return (
                <div key={i} style={{ background: 'var(--bg-elev-1)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-sm)', padding: '7px 9px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', minWidth: 18 }}>#{i + 1}</span>
                    <span style={{ fontSize: 10, background: 'var(--green-bg)', color: 'var(--success)', borderRadius: 'var(--r-sm)', padding: '1px 6px', fontWeight: 700, border: '1px solid var(--green-border)' }}>+{a.totalDelta}%</span>
                    <span style={{ fontSize: 9, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{tPlural('optimizer.songs-count', a.songs.length, {}, { one: '1 morceau', other: '{count} morceaux' })}</span>
                  </div>
                  {badges && (a.crossings > 0 || a.rescues > 0) && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 3 }}>
                      {a.crossings > 0 && <span style={{ fontSize: 9, background: 'var(--green-bg)', color: 'var(--success)', border: '1px solid var(--green-border)', borderRadius: 'var(--r-sm)', padding: '1px 6px', fontWeight: 700 }}>{tFormat('optimizer.swap-crosses', { n: a.crossings }, 'fait passer {n} morceau(x) ≥80%')}</span>}
                      {a.rescues > 0 && <span style={{ fontSize: 9, background: 'var(--yellow-bg)', color: 'var(--yellow)', border: '1px solid var(--yellow-border)', borderRadius: 'var(--r-sm)', padding: '1px 6px', fontWeight: 700 }}>{tFormat('optimizer.swap-rescues', { n: a.rescues }, 'remonte {n} point(s) faible(s)')}</span>}
                    </div>
                  )}
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>{tFormat('optimizer.install-preset', { name: a.preset.name }, 'Installer "{name}"')}</div>
                  {(() => { const e = findCatalogEntry(a.preset.name); const si = getSourceInfo(e); if (!si) return null; return <div style={{ fontSize: 9, color: 'var(--text-sec)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}><span>{si.icon} {si.label}</span>{e?.pack && TSR_PACK_ZIPS?.[e.pack] && <span style={{ color: 'var(--text-dim)' }}>📁 {TSR_PACK_ZIPS[e.pack]}.zip</span>}</div>; })()}
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 5 }}>
                    {t('optimizer.arrow-bank', '→ Banque ')}<span style={{ fontFamily: 'var(--font-mono)', color: CC[a.place.slot], fontWeight: 700 }}>{a.place.bank}{a.place.slot}</span>
                    {a.place.replaces && <span style={{ color: 'var(--yellow)', marginLeft: 4 }}>{tFormat('optimizer.replaces', { name: a.place.replaces, score: a.place.replacesScore }, '· remplace "{name}" ({score}%)')}</span>}
                    <span style={{ display: 'block', marginTop: 2 }}>{songsPreview}</span>
                  </div>
                  <button onClick={() => applyAction(a)} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-sm)', padding: '4px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>{t('optimizer.install', 'Installer')}</button>
                </div>
              );
            };
            const renderDeviceBlock = (deviceKey, deviceLabel, curMean, _projMeanIgnored, actions, rows) => {
              if (curMean == null) return null;
              // Phase 14.4 — seuillage : franchissement 80% OU sauvetage point faible.
              const { useful, minor } = splitSwapsByImpact(actions, { coverageThreshold: 80, rescueGain: 10 });
              const projMean = computeProjected(rows, useful);
              const delta = projMean != null ? projMean - curMean : 0;
              const covered = rows.filter((r) => !r.noAI && r.installedScore >= 80).length;
              const stuck = rows.filter((r) => !r.noAI && r.installedScore < 80 && !actions.some((a) => a.songs.some((s) => s.song.id === r.song.id)));
              const showMinor = !!showMinorByDevice[deviceKey];
              const toggleMinor = () => setShowMinorByDevice((m) => ({ ...m, [deviceKey]: !m[deviceKey] }));
              const minorToggle = (
                <div style={{ marginTop: 6 }}>
                  <button onClick={toggleMinor} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: 10, fontWeight: 600, cursor: 'pointer', padding: '2px 0', textAlign: 'left' }}>
                    {showMinor
                      ? t('optimizer.minor-hide', '▲ Masquer les améliorations mineures')
                      : tFormat('optimizer.minor-show', { n: minor.length }, '▼ {n} améliorations mineures (gain faible)')}
                  </button>
                  {showMinor && <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 5 }}>{minor.map((a, i) => renderSwapCard(a, i, { badges: false }))}</div>}
                </div>
              );
              return (
                <div style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-md)', padding: 'var(--s-3)' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 'var(--s-2)' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{deviceLabel}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{t('optimizer.score', 'Score')}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800, color: scoreColor(curMean) }}>{curMean}%</span>
                    {useful.length > 0 && projMean != null && (
                      <>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>→</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800, color: scoreColor(projMean) }}>{projMean}%</span>
                        <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 700 }}>+{delta}</span>
                      </>
                    )}
                  </div>
                  {useful.length > 0
                    ? (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>{tFormat('optimizer.useful-swaps-title', { n: useful.length }, '{n} swap(s) utile(s)')}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                          {useful.map((a, i) => renderSwapCard(a, i, { badges: true }))}
                        </div>
                        {useful.length > 1 && <button onClick={() => applyAllForDevice(useful, deviceLabel, curMean, projMean)} style={{ width: '100%', background: 'linear-gradient(180deg,var(--brass-200),var(--brass-400))', border: 'none', color: 'var(--tolex-900)', borderRadius: 'var(--r-sm)', padding: '7px', fontSize: 11, fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>{tFormat('optimizer.apply-useful', { n: useful.length }, 'Appliquer les swaps utiles ({n})')}</button>}
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>{tFormat('optimizer.already-covered', { n: covered }, '{n} morceau(x) déjà couvert(s) (≥80%)')}</div>
                        {minor.length > 0 && minorToggle}
                      </>
                    )
                    : minor.length > 0
                      ? (
                        <>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{tFormat('optimizer.no-decisive', { covered }, 'Aucun swap décisif — {covered} morceau(x) déjà couvert(s).')}</div>
                          {minorToggle}
                        </>
                      )
                      : stuck.length > 0
                        ? (
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 5 }}>{tFormat('optimizer.no-better-preset', { songs: tPlural('optimizer.songs-count', stuck.length, {}, { one: '1 morceau', other: '{count} morceaux' }) }, 'Pas de meilleur preset disponible pour {songs} (déjà au plafond du catalogue compatible) :')}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              {stuck.map((r) => (
                                <div key={r.song.id} style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', gap: 6, alignItems: 'baseline' }}>
                                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: scoreColor(r.installedScore), minWidth: 32 }}>{r.installedScore}%</span>
                                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.song.title}</span>
                                  {r.installed?.name && <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>· {r.installed.name}</span>}
                                </div>
                              ))}
                            </div>
                            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 6, fontStyle: 'italic' }}>{t('optimizer.improvement-tip', 'Pour faire mieux : changer la guitare assignée, activer un pack non coché dans Profil → Sources, ou créer un preset custom.')}</div>
                          </div>
                        )
                        : <div style={{ fontSize: 11, color: 'var(--success)', padding: '6px 0' }}>{t('optimizer.all-optimal', '✓ Tout est déjà optimal sur ce device')}</div>}
                </div>
              );
            };
            return (
              <div style={sectionStyle}>
                {eyebrow('⚡', t('optimizer.priority-actions', 'Actions prioritaires'))}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
                  {hasPedalDevice && renderDeviceBlock('ann', annLabelShort, annMean, annProjected, annPriority, annAnalysis.songRows)}
                  {hasPlugDevice && renderDeviceBlock('plug', 'Plug', plugMean, plugProjected, plugPriority, plugAnalysis.songRows)}
                </div>
              </div>
            );
          })()}

          {/* SECTION : DIAGNOSTIC */}
          <div style={sectionStyle}>
            {eyebrow('📊', t('optimizer.diagnostic', 'Diagnostic'))}
            {songs.length === 0 ? <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)' }}>{t('optimizer.empty-setlist', 'Setlist vide')}</div> : (
              <>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 'var(--s-3)' }}>{allGuitars.map((g) => g.short || g.name).join(', ')} · {songs.length} morceau{songs.length > 1 ? 'x' : ''}</div>
                <div style={{ display: 'grid', gridTemplateColumns: hasPedalDevice && hasPlugDevice ? '1fr 1fr' : '1fr', gap: 'var(--s-3)', marginBottom: 'var(--s-3)' }}>
                  {hasPedalDevice && <div>{renderStats(annAnalysis)}<div style={{ fontSize: 9, color: 'var(--text-tertiary)', textAlign: 'center' }}>{annLabelTiny}</div></div>}
                  {hasPlugDevice && <div>{renderStats(plugAnalysis)}<div style={{ fontSize: 9, color: 'var(--text-tertiary)', textAlign: 'center' }}>Plug</div></div>}
                </div>
                {/* Carte visuelle compacte */}
                {(() => {
                  const buildBankMap = (banks, deviceKey) => {
                    const usedBanks = {};
                    songs.forEach((s) => {
                      const ai = s.aiCache?.result; if (!ai?.cot_step1) return;
                      const preset = deviceKey === 'ann' ? ai.preset_ann : ai.preset_plug;
                      if (preset?.label) {
                        const loc = findInBanks(preset.label, banks);
                        if (loc) {
                          if (!usedBanks[loc.bank]) usedBanks[loc.bank] = { songs: [], score: 0, preset: preset.label };
                          usedBanks[loc.bank].songs.push(s.title);
                          usedBanks[loc.bank].score = Math.max(usedBanks[loc.bank].score, preset.score || 0);
                        }
                      }
                    });
                    return usedBanks;
                  };
                  const miniGrid = (banks, max, start, deviceKey, label) => {
                    const used = buildBankMap(banks, deviceKey);
                    const nums = []; for (let i = start; i < start + max; i++) nums.push(i);
                    const usedCount = Object.keys(used).length;
                    const spread = usedCount > 0 ? Math.max(...Object.keys(used).map(Number)) - Math.min(...Object.keys(used).map(Number)) : 0;
                    return (
                      <div style={{ marginBottom: 'var(--s-2)' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 3 }}>{label} — <b>{usedCount}</b> banques utilisees{spread > usedCount + 2 ? <span style={{ color: 'var(--red)' }}> (dispersees sur {spread} banques)</span> : ''}</div>
                        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                          {nums.map((b) => {
                            const u = used[b]; const has = banks[b] && (banks[b].A || banks[b].B || banks[b].C);
                            const bg = u ? (u.score >= 80 ? 'var(--green)' : u.score >= 65 ? 'var(--accent-primary,#818cf8)' : 'var(--red)') : (has ? 'var(--bg-elev-3)' : 'var(--bg-elev-1)');
                            return <div key={b} title={u ? b + ': ' + u.preset + ' (' + u.score + '%) — ' + u.songs.join(', ') : (has ? b + ': ' + ((banks[b] || {}).A || '') + '/' + ((banks[b] || {}).B || '') + '/' + ((banks[b] || {}).C || '') : b + ': vide')} style={{ width: 14, height: 14, borderRadius: 2, background: bg, border: u ? 'none' : '1px solid var(--border-subtle)', opacity: has || u ? 1 : 0.3, cursor: 'default' }}/>;
                          })}
                        </div>
                      </div>
                    );
                  };
                  const hasAnn = Object.keys(banksAnn || {}).length > 0;
                  const hasPlug = Object.keys(banksPlug || {}).length > 0;
                  return (
                    <div>
                      {hasAnn && hasPedalDevice && miniGrid(banksAnn, 50, 0, 'ann', annLabelTiny)}
                      {hasPlug && hasPlugDevice && miniGrid(banksPlug, 10, 1, 'plug', 'Plug')}
                      <div style={{ display: 'flex', gap: 'var(--s-3)', marginTop: 4, fontSize: 8, color: 'var(--text-tertiary)' }}>
                        <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 1, background: 'var(--green)', marginRight: 2, verticalAlign: 'middle' }}/>80%+</span>
                        <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 1, background: 'var(--accent-primary,#818cf8)', marginRight: 2, verticalAlign: 'middle' }}/>65-79%</span>
                        <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 1, background: 'var(--red)', marginRight: 2, verticalAlign: 'middle' }}/>&lt;65%</span>
                        <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 1, background: 'var(--bg-elev-3)', border: '1px solid var(--border-subtle)', marginRight: 2, verticalAlign: 'middle' }}/>{t('optimizer.not-used', 'Non utilise')}</span>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </>
      )}

      {mode === 'reorganize' && (
        <div style={sectionStyle}>
          {eyebrow('🎯', t('optimizer.mode-reorganize', 'Réorganiser'))}
          {songs.length === 0
            ? <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)' }}>{t('optimizer.empty-setlist', 'Setlist vide')}</div>
            : (
              <>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 'var(--s-3)' }}>{t('optimizer.reorg-hint', 'Mutualise les banques de la zone Live : 1 banque par ampli partagé (A=Clean, B=Crunch, C=Lead). Aperçu avant d\'appliquer — Jams et Découverte intactes.')}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--s-3)', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('optimizer.reorg-axis', 'Axe')}</span>
                  {axisBtn('setlist', t('optimizer.axis-setlist', 'Ordre setlist'))}
                  {axisBtn('ampFamily', t('optimizer.axis-amp', 'Famille d\'ampli'))}
                </div>
                {!reorgData
                  ? <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '12px 0' }}>{t('optimizer.reorg-loading', 'Analyse en cours…')}</div>
                  : (reorgDevices.length === 0
                    ? <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t('optimizer.reorg-no-device', 'Aucun device ToneX activé.')}</div>
                    : reorgDevices.map((dev) => renderReorgDevice(dev)))}
              </>
            )}
        </div>
      )}
    </div>
  );
}

export default BankOptimizerScreen;
export { BankOptimizerScreen };

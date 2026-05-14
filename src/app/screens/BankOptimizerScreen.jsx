// src/app/screens/BankOptimizerScreen.jsx — Phase 7.16 (découpage main.jsx).
//
// Optimiseur de banks : pour une setlist donnée, analyse les presets
// installés sur chaque device (Pédale / Plug), score chaque morceau
// avec sa meilleure guitare, calcule les actions prioritaires (top
// presets à installer qui maximisent le gain agrégé) et propose un
// plan de réorganisation complète des banks par "univers" (un ampli
// iconique par banque, A=Clean / B=Drive / C=Lead).
//
// Perf-critique : analyzeDevice itère sur le catalog merged à chaque
// morceau. Toutes les analyses sont deferred via setTimeout(0) après
// mount pour ne pas bloquer le first paint. Voir CLAUDE.md "Phase 5.13"
// pour les marathons d'optim (5.13.9-14).

import React, { useState, useEffect, useMemo } from 'react';
import { t, tFormat, tPlural } from '../../i18n/index.js';
import {
  computePickupScore, computeFinalScore, computeSimpleScore,
  computeRefAmpScore, computeStyleMatchScore,
  getGainRange, gainToNumeric,
} from '../../core/scoring/index.js';
import { findGuitarByAIName } from '../../core/scoring/guitar.js';
import { findCatalogEntry, PRESET_CATALOG_MERGED } from '../../core/catalog.js';
import { getSourceInfo } from '../../core/sources.js';
import { isSrcCompatible } from '../../devices/registry.js';
import { TSR_PACK_ZIPS } from '../../data/tsr-packs.js';
import { getActiveDevicesForRender } from '../utils/devices-render.js';
import { computeBestPresets, resolveRefAmp } from '../utils/ai-helpers.js';
import { findInBanks } from '../utils/preset-helpers.js';
import { CC, TYPE_LABELS } from '../utils/ui-constants.js';
import { scoreColor } from '../components/score-utils.js';
import Breadcrumb from '../components/Breadcrumb.jsx';

function BankOptimizerScreen({ songDb, setlists, banksAnn, onBanksAnn, banksPlug, onBanksPlug, allGuitars, availableSources, onNavigate, profile }) {
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

  const enabledDevices = getActiveDevicesForRender(profile);
  const hasPedalDevice = enabledDevices.some((d) => d.deviceKey === 'ann');
  const hasPlugDevice = enabledDevices.some((d) => d.deviceKey === 'plug');
  const [slId, setSlId] = useState(setlists[0]?.id || '');
  const [showReconfig, setShowReconfig] = useState(null);
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
  }, [songs, allGuitars, banksAnn, banksPlug, availableSources]);

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

  const [standardBanks, setStandardBanks] = useState([]);
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      const t0 = performance.now();
      const result = computeStandardBanks();
      if (typeof window !== 'undefined' && window.__TONEX_PERF) {
        // eslint-disable-next-line no-console
        console.log(`[perf] standardBanks: ${(performance.now() - t0).toFixed(0)}ms`);
      }
      if (!cancelled) setStandardBanks(result);
    }, 10);
    return () => { cancelled = true; clearTimeout(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupTypes, availableSources]);

  const computeStandardBanks = () => {
    const UNIVERSES = [
      { label: 'Marshall Plexi', amp: 'Marshall Plexi', style: 'rock' },
      { label: 'Marshall JCM800', amp: 'Marshall JCM800', style: 'hard_rock' },
      { label: 'Fender Deluxe Reverb', amp: 'Fender Deluxe Reverb', style: 'blues' },
      { label: 'Fender Twin Reverb', amp: 'Fender Twin Reverb', style: 'rock' },
      { label: 'Fender Bassman', amp: 'Fender Bassman', style: 'blues' },
      { label: 'Vox AC30', amp: 'Vox AC30', style: 'rock' },
      { label: 'Mesa Dual Rectifier', amp: 'Mesa Boogie Rectifier', style: 'hard_rock' },
      { label: 'Hiwatt DR103', amp: 'Hiwatt DR103', style: 'rock' },
      { label: 'Dumble ODS', amp: 'Dumble ODS', style: 'blues' },
      { label: 'Soldano SLO 100', amp: 'Soldano SLO-100', style: 'hard_rock' },
    ];
    const SLOT_GAINS = [{ slot: 'A', label: 'Clean', gainRange: 'clean' }, { slot: 'B', label: 'Drive', gainRange: 'drive' }, { slot: 'C', label: 'Lead', gainRange: 'high_gain' }];
    const dominantPickup = pickupTypes[0] || 'HB';
    return UNIVERSES.map((u) => {
      const usedNames = new Set();
      const slots = SLOT_GAINS.map(({ slot, label, gainRange }) => {
        const candidates = Object.entries(PRESET_CATALOG_MERGED)
          .filter(([, info]) => {
            const g = getGainRange(gainToNumeric(info.gain));
            if (g !== gainRange && !(gainRange === 'drive' && g === 'crunch')) return false;
            if (info.src === 'Anniversary' || info.src === 'Factory' || info.src === 'PlugFactory') return false;
            if (availableSources && info.src && availableSources[info.src] === false) return false;
            return true;
          })
          .map(([name, info]) => {
            const ampScore = computeRefAmpScore(info.amp, u.amp);
            const styleScore = computeStyleMatchScore(info.style, u.style);
            const pickupScore = computePickupScore(info.style, gainRange, dominantPickup);
            const dims = [{ s: ampScore, w: 0.60 }, { s: styleScore, w: 0.25 }, { s: pickupScore, w: 0.15 }].filter((d) => d.s !== null);
            const tw = dims.reduce((s, d) => s + d.w, 0);
            const score = Math.round(dims.reduce((s, d) => s + d.s * (d.w / tw), 0));
            return { name, amp: info.amp, src: info.src, score };
          }).sort((a, b) => b.score - a.score);
        const pick = candidates.find((c) => !usedNames.has(c.name)) || candidates[0];
        if (pick) usedNames.add(pick.name);
        return { slot, label, preset: pick?.name || '—', amp: pick?.amp || '', src: pick?.src || '', score: pick?.score || 0 };
      });
      return { label: u.label, amp: u.amp, style: u.style, slots };
    });
  };

  const reconfigPlan = useMemo(() => {
    if (!showReconfig) return null;
    const banks = showReconfig === 'ann' ? banksAnn : banksPlug;
    const maxBanks = showReconfig === 'ann' ? 50 : 10;
    const startBank = showReconfig === 'ann' ? 0 : 1;
    const usedBanks = new Set();
    const analysis = showReconfig === 'ann' ? annAnalysis : plugAnalysis;
    analysis.songRows.forEach((r) => { if (r.installed?.bank != null) usedBanks.add(r.installed.bank); });
    if (!usedBanks.size) { for (let i = startBank; i < startBank + 3 && i < startBank + maxBanks; i++) usedBanks.add(i); }
    const SLOT_GAINS = [{ slot: 'A', label: 'Clean', targetGain: 2 }, { slot: 'B', label: 'Drive', targetGain: 7 }, { slot: 'C', label: 'Lead', targetGain: 9 }];
    const plan = [...usedBanks].sort((a, b) => a - b).slice(0, 10).map((bankNum) => {
      const current = banks[bankNum] || { cat: '', A: '', B: '', C: '' };
      const bankSongs = analysis.songRows.filter((r) => r.installed?.bank === bankNum);
      const styles = {}; bankSongs.forEach((r) => { const st = r.song.aiCache?.result?.song_style || 'rock'; styles[st] = (styles[st] || 0) + 1; });
      const dominantStyle = Object.entries(styles).sort((a, b) => b[1] - a[1])[0]?.[0] || 'rock';
      const dominantAmp = bankSongs.map((r) => r.song.aiCache?.result?.ref_amp).filter(Boolean)[0] || null;
      const typeCounts = {}; bankSongs.forEach((r) => { if (r.guitar) typeCounts[r.guitar.type] = (typeCounts[r.guitar.type] || 0) + 1; });
      const bankGType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'HB';
      const bankGId = allGuitars.find((g) => g.type === bankGType)?.id || '';
      const slots = SLOT_GAINS.map(({ slot, label, targetGain }) => {
        const currentPreset = current[slot];
        const best = computeBestPresets(bankGType, dominantStyle, {}, {}, bankGId, dominantAmp, targetGain);
        const idealRaw = best.idealTop3 || [];
        const idealPreset = idealRaw.find((p) => { const e = findCatalogEntry(p.name); return !e || isSrcCompatible(e.src, showReconfig); }) || best.idealTop;
        return { slot, label, current: currentPreset || '(vide)', proposed: idealPreset?.name || currentPreset || '—', proposedAmp: idealPreset?.amp || '', proposedScore: idealPreset?.score || 0, changed: idealPreset && idealPreset.name !== currentPreset };
      });
      return { bank: bankNum, cat: current.cat, dominantStyle, bankGType, slots };
    });
    return plan;
  }, [showReconfig, banksAnn, banksPlug, annAnalysis, plugAnalysis, allGuitars, songs]);

  const applyReconfig = () => {
    if (!reconfigPlan || !showReconfig) return;
    const onBanks = showReconfig === 'ann' ? onBanksAnn : onBanksPlug;
    onBanks((prev) => {
      const next = { ...prev };
      reconfigPlan.forEach(({ bank, slots }) => {
        const current = next[bank] || { cat: '', A: '', B: '', C: '' };
        const updated = { ...current };
        slots.forEach(({ slot, proposed, changed }) => { if (changed) updated[slot] = proposed; });
        next[bank] = updated;
      });
      return next;
    });
    setShowReconfig(null);
  };

  const sectionStyle = { background: 'var(--bg-elev-1)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: 'var(--s-4)', marginBottom: 'var(--s-4)', contentVisibility: 'auto', containIntrinsicSize: '0 600px' };
  const eyebrow = (icon, label) => <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', color: 'var(--accent)', marginBottom: 'var(--s-3)', display: 'flex', alignItems: 'center', gap: 5 }}>{icon} {label}</div>;

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

  if (typeof window !== 'undefined' && window.__TONEX_PERF && window.__optimizerRenderStart) {
    // eslint-disable-next-line no-console
    console.log(`[perf] BankOptimizerScreen before-return: ${(performance.now() - window.__optimizerRenderStart).toFixed(0)}ms`);
  }

  return (
    <div>
      <Breadcrumb crumbs={[{ label: t('common.home', 'Accueil'), screen: 'list' }, { label: t('optimizer.breadcrumb', 'Optimiseur') }]} onNavigate={onNavigate}/>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--s-4)' }}>{t('optimizer.title', '🔧 Optimiseur de Banks')}</div>

      <div style={{ marginBottom: 'var(--s-3)' }}>
        <select value={slId} onChange={(e) => setSlId(e.target.value)} style={{ width: '100%', background: 'var(--bg-elev-1)', color: 'var(--text-primary)', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-md)', padding: '8px 12px', fontSize: 13 }}>
          {setlists.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.songIds.length})</option>)}
        </select>
      </div>

      {/* TOP 3 ACTIONS PRIORITAIRES PAR DEVICE */}
      {songs.length > 0 && (() => {
        const renderDeviceBlock = (deviceKey, deviceLabel, curMean, projMean, actions, rows) => {
          if (curMean == null) return null;
          const delta = projMean != null ? projMean - curMean : 0;
          const stuck = rows.filter((r) => !r.noAI && r.installedScore < 80 && !actions.some((a) => a.songs.some((s) => s.song.id === r.song.id)));
          return (
            <div style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-md)', padding: 'var(--s-3)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 'var(--s-2)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{deviceLabel}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{t('optimizer.score', 'Score')}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800, color: scoreColor(curMean) }}>{curMean}%</span>
                {actions.length > 0 && projMean != null && (
                  <>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>→</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800, color: scoreColor(projMean) }}>{projMean}%</span>
                    <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 700 }}>+{delta}</span>
                  </>
                )}
              </div>
              {actions.length === 0
                ? (
                  <div>
                    {stuck.length === 0
                      ? <div style={{ fontSize: 11, color: 'var(--success)', padding: '6px 0' }}>{t('optimizer.nothing-to-optimize', '✓ Rien à optimiser sur ce device')}</div>
                      : (
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
                      )}
                  </div>
                )
                : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                      {actions.map((a, i) => {
                        const songsList = a.songs.map((s) => s.song.title);
                        const songsPreview = songsList.slice(0, 3).join(', ') + (songsList.length > 3 ? ` +${songsList.length - 3}` : '');
                        return (
                          <div key={i} style={{ background: 'var(--bg-elev-1)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-sm)', padding: '7px 9px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', minWidth: 18 }}>#{i + 1}</span>
                              <span style={{ fontSize: 10, background: 'var(--green-bg)', color: 'var(--success)', borderRadius: 'var(--r-sm)', padding: '1px 6px', fontWeight: 700, border: '1px solid var(--green-border)' }}>+{a.totalDelta}%</span>
                              <span style={{ fontSize: 9, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{tPlural('optimizer.songs-count', a.songs.length, {}, { one: '1 morceau', other: '{count} morceaux' })}</span>
                            </div>
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
                      })}
                    </div>
                    {actions.length > 1 && <button onClick={() => applyAllForDevice(actions, deviceLabel, curMean, projMean)} style={{ width: '100%', background: 'linear-gradient(180deg,var(--brass-200),var(--brass-400))', border: 'none', color: 'var(--tolex-900)', borderRadius: 'var(--r-sm)', padding: '7px', fontSize: 11, fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>{tFormat('optimizer.apply-all', { device: deviceLabel, count: actions.length }, '⚡ Tout appliquer {device} ({count})')}</button>}
                  </>
                )}
            </div>
          );
        };
        return (
          <div style={sectionStyle}>
            {eyebrow('⚡', 'Actions prioritaires')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
              {hasPedalDevice && renderDeviceBlock('ann', '📦 Pédale', annMean, annProjected, annPriority, annAnalysis.songRows)}
              {hasPlugDevice && renderDeviceBlock('plug', '🔌 Plug', plugMean, plugProjected, plugPriority, plugAnalysis.songRows)}
            </div>
          </div>
        );
      })()}

      {/* SECTION 1 : DIAGNOSTIC */}
      <div style={sectionStyle}>
        {eyebrow('📊', 'Diagnostic')}
        {songs.length === 0 ? <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)' }}>{t('optimizer.empty-setlist', 'Setlist vide')}</div> : (
          <>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 'var(--s-3)' }}>🎸 {allGuitars.map((g) => g.short || g.name).join(', ')} · {songs.length} morceau{songs.length > 1 ? 'x' : ''}</div>
            <div style={{ display: 'grid', gridTemplateColumns: hasPedalDevice && hasPlugDevice ? '1fr 1fr' : '1fr', gap: 'var(--s-3)', marginBottom: 'var(--s-3)' }}>
              {hasPedalDevice && <div>{renderStats(annAnalysis)}<div style={{ fontSize: 9, color: 'var(--text-tertiary)', textAlign: 'center' }}>📦 Pedale</div></div>}
              {hasPlugDevice && <div>{renderStats(plugAnalysis)}<div style={{ fontSize: 9, color: 'var(--text-tertiary)', textAlign: 'center' }}>🔌 Plug</div></div>}
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
                  {hasAnn && hasPedalDevice && miniGrid(banksAnn, 50, 0, 'ann', '📦 Pedale')}
                  {hasPlug && hasPlugDevice && miniGrid(banksPlug, 10, 1, 'plug', '🔌 Plug')}
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

      {songs.length > 0 && (
        <>
          {/* SECTION 2 : PLAN DE REORGANISATION */}
          {(() => {
            const buildReorg = (banks, maxBanks, startBank, deviceKey) => {
              const plan = []; let bankIdx = startBank;
              const seenSigs = new Set();
              standardBanks.forEach((sb) => {
                if (bankIdx >= startBank + maxBanks) return;
                const sig = (sb.slots[0].preset || '') + '|' + (sb.slots[1].preset || '') + '|' + (sb.slots[2].preset || '');
                if (seenSigs.has(sig)) return;
                seenSigs.add(sig);
                plan.push({ bank: bankIdx, label: sb.label, type: 'standard', A: sb.slots[0].preset, B: sb.slots[1].preset, C: sb.slots[2].preset, scoreA: sb.slots[0].score, scoreB: sb.slots[1].score, scoreC: sb.slots[2].score });
                bankIdx++;
              });
              const usedPresets = new Set();
              plan.forEach((p) => { usedPresets.add(p.A); usedPresets.add(p.B); usedPresets.add(p.C); });
              songs.forEach((s) => {
                if (bankIdx >= startBank + maxBanks) return;
                const ai = s.aiCache?.result; if (!ai?.cot_step1) return;
                const g = bestGuitarForSong(s); const gType = g?.type || 'HB';
                const style = ai.song_style || 'rock';
                const refAmp = ai.ref_amp ? resolveRefAmp(ai.ref_amp) : null;
                const findBest = (gainRange) => Object.entries(PRESET_CATALOG_MERGED).filter((e) => {
                  const info = e[1];
                  const gr = getGainRange(gainToNumeric(info.gain));
                  if (gr !== gainRange && !(gainRange === 'drive' && gr === 'crunch')) return false;
                  if (usedPresets.has(e[0])) return false;
                  if (!isSrcCompatible(info.src, deviceKey)) return false;
                  if (availableSources && info.src && availableSources[info.src] === false) return false;
                  return true;
                }).map((e) => {
                  const info = e[1];
                  const dims = [{ s: computePickupScore(info.style, gainRange, gType), w: 0.20 }, { s: computeStyleMatchScore(info.style, style), w: 0.25 }, { s: refAmp ? computeRefAmpScore(info.amp, refAmp) : null, w: 0.35 }].filter((d) => d.s !== null);
                  const tw = dims.reduce((s2, d) => s2 + d.w, 0);
                  return { name: e[0], amp: info.amp, score: Math.round(dims.reduce((s2, d) => s2 + d.s * (d.w / tw), 0)) };
                }).sort((a, b) => b.score - a.score)[0] || null;
                const cP = findBest('clean'); const dP = findBest('drive'); const lP = findBest('high_gain');
                if (!cP && !dP && !lP) return;
                if (cP) usedPresets.add(cP.name); if (dP) usedPresets.add(dP.name); if (lP) usedPresets.add(lP.name);
                plan.push({ bank: bankIdx, label: s.title + ' — ' + s.artist, type: 'song', A: cP?.name || '—', B: dP?.name || '—', C: lP?.name || '—', scoreA: cP?.score || 0, scoreB: dP?.score || 0, scoreC: lP?.score || 0 });
                bankIdx++;
              });
              return plan;
            };
            const hasAnn2 = Object.keys(banksAnn || {}).length > 0;
            const hasPlug2 = Object.keys(banksPlug || {}).length > 0;
            const annPlan = hasAnn2 ? buildReorg(banksAnn, 50, 0, 'ann') : [];
            const plugPlan = hasPlug2 ? buildReorg(banksPlug, 10, 1, 'plug') : [];
            if (!annPlan.length && !plugPlan.length) return null;
            const renderPlan = (plan, emoji, label, onBanks) => {
              if (!plan.length) return null;
              const stdCount = plan.filter((p) => p.type === 'standard').length;
              const songCount = plan.filter((p) => p.type === 'song').length;
              return (
                <div style={{ marginBottom: 'var(--s-4)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 'var(--s-2)' }}>{emoji} {label} — {stdCount} standard{stdCount > 1 ? 's' : ''} + {songCount} morceau{songCount > 1 ? 'x' : ''}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 4, marginBottom: 'var(--s-3)' }}>
                    {plan.map((p) => {
                      const isSong = p.type === 'song';
                      const applyOne = () => {
                        if (!confirm('Appliquer la banque ' + p.bank + ' (' + p.label + ') ?')) return;
                        onBanks((prev) => {
                          const next = {}; for (const k in prev) next[k] = prev[k];
                          next[p.bank] = { cat: p.label, A: p.A === '—' ? '' : p.A, B: p.B === '—' ? '' : p.B, C: p.C === '—' ? '' : p.C };
                          return next;
                        });
                      };
                      return (
                        <div key={p.bank} style={{ background: isSong ? 'var(--bg-elev-2)' : 'var(--accent-soft,rgba(129,140,248,0.06))', border: '1px solid ' + (isSong ? 'var(--border-subtle)' : 'var(--border-accent,rgba(129,140,248,0.3))'), borderRadius: 6, padding: '6px 8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)' }}>{p.bank}</span>
                            <span style={{ fontSize: 8, fontWeight: 600, color: isSong ? 'var(--text-tertiary)' : 'var(--accent)', textTransform: 'uppercase' }}>{isSong ? 'Morceau' : 'Standard'}</span>
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{p.label}</div>
                          {[{ s: 'A', l: 'Clean', n: p.A, sc: p.scoreA }, { s: 'B', l: 'Drive', n: p.B, sc: p.scoreB }, { s: 'C', l: 'Lead', n: p.C, sc: p.scoreC }].map((x) => (
                            <div key={x.s} style={{ fontSize: 9, display: 'flex', gap: 3, alignItems: 'baseline', marginBottom: 1 }}>
                              <span style={{ fontWeight: 700, color: 'var(--text-tertiary)', width: 14, flexShrink: 0 }}>{x.s}</span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: x.n === '—' ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>{x.n}</span>
                              {x.sc > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: scoreColor(x.sc), flexShrink: 0 }}>{x.sc}%</span>}
                            </div>
                          ))}
                          <button onClick={applyOne} style={{ marginTop: 6, width: '100%', background: 'var(--bg-elev-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 'var(--r-sm)', padding: '3px 6px', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>{t('optimizer.apply-this-bank', 'Appliquer cette banque')}</button>
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={() => {
                    if (!confirm('Appliquer cette reorganisation sur les banques ' + plan[0].bank + ' a ' + (plan[plan.length - 1].bank) + ' ?')) return;
                    onBanks((prev) => {
                      const next = {}; for (const k in prev) next[k] = prev[k];
                      plan.forEach((p) => { next[p.bank] = { cat: p.label, A: p.A === '—' ? '' : p.A, B: p.B === '—' ? '' : p.B, C: p.C === '—' ? '' : p.C }; });
                      return next;
                    });
                  }} style={{ width: '100%', background: 'linear-gradient(180deg,var(--brass-200,#d4a017),var(--brass-400,#b8860b))', border: 'none', color: 'var(--tolex-900,#1a1a1a)', borderRadius: 'var(--r-md)', padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-sm,0 1px 3px rgba(0,0,0,0.3))' }}>Tout appliquer ({plan.length} banques)</button>
                </div>
              );
            };
            return (
              <div style={sectionStyle}>
                {eyebrow('🎯', 'Plan de reorganisation')}
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 'var(--s-3)' }}>{t('optimizer.bank-grouping-hint', 'Banques regroupees pour le live. Standards (tes gouts) en premier, puis une banque par morceau. A=Clean, B=Drive, C=Lead.')}</div>
                {hasAnn2 && hasPedalDevice && renderPlan(annPlan, '📦', 'Pedale', onBanksAnn)}
                {hasPlug2 && hasPlugDevice && renderPlan(plugPlan, '🔌', 'Plug', onBanksPlug)}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

export default BankOptimizerScreen;
export { BankOptimizerScreen };

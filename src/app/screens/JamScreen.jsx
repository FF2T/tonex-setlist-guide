// src/app/screens/JamScreen.jsx — Phase 7.17 (découpage main.jsx).
//
// Mode "Jam" : 3 steps (guitare → style → résultats). Pour un (guitare,
// style) donné, montre top 3 presets installés Pédale + top 3 Plug + top
// 3 catalogue (diversifié par ampli). Chaque item dépliable affiche
// PresetDetailInline (importé depuis PresetBrowser.jsx).
//
// Note Phase 7.17 : getJamRecs avait été accidentellement supprimé de
// main.jsx au step 9 du découpage (Phase 7.14). Restauré ici comme
// helper local — il n'est utilisé que par JamScreen.

import React, { useState, useMemo } from 'react';
import { t, tFormat } from '../../i18n/index.js';
import { GUITARS } from '../../core/guitars.js';
import { findCatalogEntry, PRESET_CATALOG_MERGED } from '../../core/catalog.js';
import { computeFinalScore } from '../../core/scoring/index.js';
import { getActiveDevicesForRender } from '../utils/devices-render.js';
import { COMPAT_STYLES, findInBanks } from '../utils/preset-helpers.js';
import { TYPE_COLORS, TYPE_LABELS } from '../utils/ui-constants.js';
import { scoreColor, scoreBg } from '../components/score-utils.js';
import GuitarSilhouette from '../components/GuitarSilhouette.jsx';
import { PresetDetailInline } from './PresetBrowser.jsx';

const JAM_STYLES = [
  { id: 'jazz', label: 'Jazz', emoji: '🎹', color: '148,163,184' },
  { id: 'blues', label: 'Blues', emoji: '🎷', color: '148,163,184' },
  { id: 'rock', label: 'Rock', emoji: '🎸', color: '148,163,184' },
  { id: 'hard_rock', label: 'Hard Rock', emoji: '🔥', color: '148,163,184' },
  { id: 'metal', label: 'Metal', emoji: '💀', color: '148,163,184' },
];

// Mini badge du gain (low/mid/high) — version locale (l'inline gainBadge
// de main.jsx n'a pas été extrait, on duplique ici à 3 lignes près).
function gainBadge(gain) {
  const labels = { low: t('jam.gain-low', 'Low'), mid: t('jam.gain-mid', 'Mid'), high: t('jam.gain-high', 'High') };
  const l = labels[gain] || gain;
  return <span className="badge badge-wine">{tFormat('jam.gain-suffix', { gain: l }, '{gain} gain')}</span>;
}

// Compute jam recommendations : top 3 presets installés Pédale + top 3
// Plug + top 3 catalogue, tous diversifiés par ampli. Filtrage par style
// compatible + sources disponibles.
function getJamRecs(guitarId, style, banksAnn, banksPlug, guitars, availableSources) {
  const guitar = (guitars || GUITARS).find((g) => g.id === guitarId);
  const gType = guitar?.type || 'HB';
  const compat = COMPAT_STYLES[style] || [style];
  const allEntries = Object.entries(PRESET_CATALOG_MERGED);
  const seen = new Set();
  const unique = allEntries.filter(([n]) => { if (seen.has(n)) return false; seen.add(n); return true; });
  const scored = unique
    .filter(([, info]) => !style || compat.includes(info.style))
    .filter(([, info]) => !availableSources || availableSources[info.src] !== false)
    .map(([name, info]) => {
      let score; let rawScore;
      if (guitarId) {
        const r = computeFinalScore(info, guitarId, style, null, null, true);
        score = r.score; rawScore = r.rawScore;
      } else {
        score = info.scores?.[gType] ?? 60; rawScore = score;
      }
      return { name, score, rawScore, sortScore: rawScore, amp: info.amp, gain: info.gain, style: info.style, src: info.src };
    })
    .sort((a, b) => b.sortScore - a.sortScore);
  const pickTop3 = (list) => {
    const out = []; const amps = new Set();
    for (const p of list) {
      if (!amps.has(p.amp)) { out.push(p); amps.add(p.amp); }
      if (out.length >= 3) break;
    }
    return out;
  };
  const labelTies = (list) => {
    if (!list.length) return list;
    const counts = {}; list.forEach((p) => { counts[p.score] = (counts[p.score] || 0) + 1; });
    return list.map((p) => {
      const tied = counts[p.score] > 1 && typeof p.rawScore === 'number' && p.rawScore !== p.score;
      return { ...p, scoreLabel: tied ? p.rawScore.toFixed(1) + '%' : p.score + '%' };
    });
  };
  const annInstalled = scored.map((p) => { const loc = findInBanks(p.name, banksAnn); return loc ? { ...p, ...loc } : null; }).filter(Boolean);
  const plugInstalled = scored.map((p) => { const loc = findInBanks(p.name, banksPlug); return loc ? { ...p, ...loc } : null; }).filter(Boolean);
  const fullTop3 = []; const fullAmps = new Set();
  for (const p of scored) {
    if (fullAmps.has(p.amp)) continue;
    const annLoc = findInBanks(p.name, banksAnn);
    const plugLoc = findInBanks(p.name, banksPlug);
    fullTop3.push({ ...p, annLoc, plugLoc, installed: !!(annLoc || plugLoc) });
    fullAmps.add(p.amp);
    if (fullTop3.length >= 3) break;
  }
  return { annTop3: labelTies(pickTop3(annInstalled)), plugBest: labelTies(pickTop3(plugInstalled)), fullTop3: labelTies(fullTop3), gType };
}

function JamPresetItem({ p, rank, isSelected, onSelect, banksAnn, banksPlug, guitars }) {
  const rankColors = ['var(--accent)', 'var(--text-sec)', 'var(--text-muted)'];
  const sc = scoreColor(p.score);
  const sb = scoreBg(p.score);
  const info = findCatalogEntry(p.name);
  return (
    <div>
      <div className="preset-result-card" onClick={onSelect} style={{ cursor: 'pointer', borderRadius: isSelected ? '10px 10px 0 0' : 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 18, fontWeight: 900, color: rankColors[rank] || 'var(--text-muted)', minWidth: 22 }}>#{rank + 1}</span>
          {'bank' in p && <span style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)', borderRadius: 'var(--r-sm)', padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{tFormat('jam.bank', { bank: p.bank, slot: p.slot }, 'Banque {bank}{slot}')}</span>}
          <span style={{ fontSize: 11, fontWeight: 800, color: sc, background: sb, borderRadius: 'var(--r-sm)', padding: '1px 7px', border: `1px solid ${sc}40` }}>{p.scoreLabel || p.score + '%'}</span>
          {gainBadge(p.gain)}
          <span style={{ fontSize: 9, color: 'var(--text-muted)', background: 'var(--a6)', borderRadius: 'var(--r-sm)', padding: '1px 5px', fontWeight: 600 }}>{p.src}</span>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto' }}>{isSelected ? '▲' : '▼'}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-bright)', fontWeight: 600, marginTop: 5, lineHeight: 1.3 }}>{p.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.amp}</div>
      </div>
      {isSelected && info && <PresetDetailInline name={p.name} info={info} banksAnn={banksAnn} banksPlug={banksPlug} guitars={guitars}/>}
    </div>
  );
}

function JamScreen({ banksAnn, banksPlug, allGuitars, availableSources, profile }) {
  const enabledDevices = getActiveDevicesForRender(profile);
  const hasPedalDevice = enabledDevices.some((d) => d.deviceKey === 'ann');
  const hasPlugDevice = enabledDevices.some((d) => d.deviceKey === 'plug');
  const guitars = allGuitars || GUITARS;
  const [step, setStep] = useState('guitar');
  const [guitarId, setGuitarId] = useState(null);
  const [style, setStyle] = useState(null);
  const [selectedJam, setSelectedJam] = useState(null);

  const guitar = guitars.find((g) => g.id === guitarId);
  const recs = useMemo(() => {
    if (!guitarId || !style) return null;
    return getJamRecs(guitarId, style, banksAnn, banksPlug, guitars, availableSources);
  }, [guitarId, style, banksAnn, banksPlug, guitars, availableSources]);

  const reset = () => { setStep('guitar'); setGuitarId(null); setStyle(null); };

  if (step === 'results' && recs) {
    const styleInfo = JAM_STYLES.find((s) => s.id === style);
    const typeRgb = TYPE_COLORS[recs.gType] || '99,102,241';
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <button onClick={reset} style={{ background: 'var(--a8)', border: '1px solid var(--a12)', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '6px 12px', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>{t('jam.new-jam', '← Nouveau Jam')}</button>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, background: `rgba(${typeRgb},0.15)`, color: `rgb(${typeRgb})`, border: `1px solid rgba(${typeRgb},0.4)`, borderRadius: 'var(--r-md)', padding: '3px 10px', fontWeight: 700 }}>{guitar?.name} · {TYPE_LABELS[recs.gType]}</span>
            <span style={{ fontSize: 12, background: `rgba(${styleInfo?.color || '99,102,241'},0.15)`, color: `rgb(${styleInfo?.color || '99,102,241'})`, border: `1px solid rgba(${styleInfo?.color || '99,102,241'},0.4)`, borderRadius: 'var(--r-md)', padding: '3px 10px', fontWeight: 700 }}>{styleInfo?.emoji} {styleInfo?.label}</span>
          </div>
        </div>

        {hasPedalDevice && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', marginBottom: 8 }}>{t('jam.top3-pedale', '📦 Top 3 — Pedale')} <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 400, textTransform: 'none' }}>{t('jam.installed-hint', '(presets installés)')}</span></div>
            {recs.annTop3.length > 0
              ? recs.annTop3.map((p, i) => <JamPresetItem key={p.name} p={p} rank={i} isSelected={selectedJam === p.name} onSelect={() => setSelectedJam(selectedJam === p.name ? null : p.name)} banksAnn={banksAnn} banksPlug={banksPlug} guitars={guitars}/>)
              : <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '12px', background: 'var(--a3)', borderRadius: 'var(--r-md)', textAlign: 'center' }}>{tFormat('jam.no-preset-pedale', { style: styleInfo?.label || '' }, 'Aucun preset {style} installé sur la Pédale pour ce type de guitare.')}</div>}
          </div>
        )}

        {hasPlugDevice && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', marginBottom: 8 }}>{t('jam.top3-plug', '🔌 Top 3 — ToneX Plug')} <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 400, textTransform: 'none' }}>{t('jam.installed-hint', '(presets installés)')}</span></div>
            {recs.plugBest.length > 0
              ? recs.plugBest.map((p, i) => <JamPresetItem key={p.name} p={p} rank={i} isSelected={selectedJam === p.name} onSelect={() => setSelectedJam(selectedJam === p.name ? null : p.name)} banksAnn={banksAnn} banksPlug={banksPlug} guitars={guitars}/>)
              : <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '12px', background: 'var(--a3)', borderRadius: 'var(--r-md)', textAlign: 'center' }}>{tFormat('jam.no-preset-plug', { style: styleInfo?.label || '' }, 'Aucun preset {style} installé sur le Plug pour ce type de guitare.')}</div>}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', marginBottom: 8 }}>{t('jam.top3-catalog', '🌐 Top 3 — Catalogue complet')} <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 400, textTransform: 'none' }}>{t('jam.all-presets-hint', '(tous presets, installés ou non)')}</span></div>
          {recs.fullTop3.map((p, i) => <JamPresetItem key={p.name} p={p} rank={i} isSelected={selectedJam === p.name} onSelect={() => setSelectedJam(selectedJam === p.name ? null : p.name)} banksAnn={banksAnn} banksPlug={banksPlug} guitars={guitars}/>)}
        </div>
      </div>
    );
  }

  if (step === 'style') {
    return (
      <div>
        <button onClick={() => setStep('guitar')} style={{ background: 'var(--a8)', border: '1px solid var(--a12)', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '6px 12px', fontSize: 12, cursor: 'pointer', marginBottom: 16 }}>{t('jam.change-guitar', '← Changer de guitare')}</button>
        <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700, marginBottom: 4 }}>{t('jam.guitar-label', 'Guitare :')} <span style={{ color: 'var(--green)' }}>{guitar?.name}</span></div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{t('jam.what-style', 'Quel style joues-tu ?')}</div>
        <div className="style-grid">
          {JAM_STYLES.map((s) => (
            <button key={s.id} onClick={() => { setStyle(s.id); setStep('results'); }}
              style={{ background: `rgba(${s.color},0.1)`, border: `1px solid rgba(${s.color},0.3)`, borderRadius: 'var(--r-lg)', padding: '14px 8px', cursor: 'pointer', textAlign: 'center', transition: 'all .15s' }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{s.emoji}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: `rgb(${s.color})` }}>{s.label}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // step === 'guitar'
  const typeGroups = { HB: [], SC: [], P90: [] };
  guitars.forEach((g) => typeGroups[g.type]?.push(g));
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{t('jam.pick-guitar', 'Sélectionne ta guitare pour ce jam :')}</div>
      {Object.entries(typeGroups).filter(([, arr]) => arr.length > 0).map(([type, arr]) => (
        <div key={type} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: `rgb(${TYPE_COLORS[type] || '99,102,241'})`, fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', marginBottom: 8 }}>{type} — {TYPE_LABELS[type]}</div>
          <div className="guitar-grid">
            {arr.map((g) => (
              <button key={g.id} className={`guitar-card${guitarId === g.id ? ' selected' : ''}`} onClick={() => { setGuitarId(g.id); setStep('style'); }}>
                <GuitarSilhouette id={g.id} size={36}/>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-bright)', lineHeight: 1.3, marginTop: 4 }}>{g.short || g.name}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default JamScreen;
export { JamScreen, JamPresetItem, getJamRecs, JAM_STYLES };

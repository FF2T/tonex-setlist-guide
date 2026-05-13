// src/app/screens/SongDetailCard.jsx — Phase 7.14 (découpage main.jsx).
//
// Card de détail morceau dépliée. Affiche 4 sections :
// 1. Infos morceau (year/album/key/bpm éditables + desc + ref guitariste/guitar/amp).
// 2. Raisonnement IA (cot_step1/2/3 collapsible).
// 3. Recommandation idéale (guitar + preset + top 3 catalogue + settings).
// 4. Paramétrage (guitar choisie + mode reco par morceau + presets installés).
// 5. Suggestion d'amélioration (si bestScore<90% : packs à acheter + ToneNET).
// 6. Feedback IA (historique + nouveau feedback → relance fetchAI).
//
// useEffect central : déclenche fetchAI quand pas de cache OU cache stale
// (SCORING_VERSION mismatch), et auto-select ideal_guitar si gId="".
//
// Toutes les mutations remontent via onSongDb / onGuitarChange callbacks.

import React, { useState, useEffect } from 'react';
import { GUITARS } from '../../core/guitars.js';
import { SCORING_VERSION } from '../../core/scoring/index.js';
import {
  findGuitarByAIName, findCotEntryForGuitar, localGuitarSongScore,
  localGuitarSettings, guitarChoiceFeedback,
} from '../../core/scoring/guitar.js';
import { findCatalogEntry } from '../../core/catalog.js';
import { getSongInfo } from '../../core/songs.js';
import { getSourceInfo } from '../../core/sources.js';
import { AMP_TAXONOMY, EXTERNAL_PACK_CATALOG } from '../../data/data_context.js';
import { TSR_PACK_ZIPS } from '../../data/tsr-packs.js';
import { getIg, getSongHist } from '../utils/song-helpers.js';
import {
  enrichAIResult, mergeBestResults, updateAiCache, computeRigSnapshot,
  getBestResult,
} from '../utils/ai-helpers.js';
import { findInBanks } from '../utils/preset-helpers.js';
import { getActiveDevicesForRender } from '../utils/devices-render.js';
import { fetchAI } from '../utils/fetchAI.js';
import { scoreColor } from '../components/score-utils.js';
import StatusDot from '../components/StatusDot.jsx';
import GuitarSelect from '../components/GuitarSelect.jsx';
import PBlock from '../components/PBlock.jsx';
import FeedbackPanel from '../components/FeedbackPanel.jsx';

function SongDetailCard({ song, banksAnn, banksPlug, onBanksAnn, onBanksPlug, onClose, guitars, allRigsGuitars, availableSources, savedGuitarId, onGuitarChange, aiProvider, aiKeys, onSongDb, profile, guitarBias, onTmpPatchOverride }) {
  const ig = getIg(song, guitars);
  const [gId, setGId] = useState(savedGuitarId || ig[0] || '');
  const [reloading, setReloading] = useState(false);
  const [localAiResult, setLocalAiResult] = useState(null);
  const [localAiErr, setLocalAiErr] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showCot, setShowCot] = useState(false);
  const [installTarget, setInstallTarget] = useState(null);
  const [installBank, setInstallBank] = useState({ ann: '', plug: '' });
  const [installSlot, setInstallSlot] = useState({ ann: 'A', plug: 'A' });

  const needsRescore = song.aiCache?.sv !== SCORING_VERSION;

  useEffect(() => {
    if (localAiResult && !needsRescore) return;
    if (song.aiCache?.result?.cot_step1 && gId) {
      const gType = (guitars || GUITARS).find((x) => x.id === gId)?.type || 'HB';
      const cleaned2 = { ...song.aiCache.result, preset_ann: null, preset_plug: null, ideal_preset: null, ideal_preset_score: 0, ideal_top3: null };
      const recalc = enrichAIResult(cleaned2, gType, gId, banksAnn, banksPlug);
      setLocalAiResult(recalc);
      setLocalAiErr(null);
      setTimeout(() => onSongDb((p) => p.map((x) => x.id === song.id ? { ...x, aiCache: { ...updateAiCache(x.aiCache, gId, recalc), sv: SCORING_VERSION } } : x)), 0);
      return;
    }
    if (!onSongDb) return;
    setReloading(true);
    setLocalAiErr(null);
    const effectiveRecoMode = song.recoMode || profile?.recoMode || 'balanced';
    const historicalFeedback = Array.isArray(song.feedback) && song.feedback.length > 0
      ? song.feedback.map((f) => f.text).filter(Boolean).join('. ')
      : null;
    fetchAI(song, gId, banksAnn, banksPlug, aiProvider, aiKeys, allRigsGuitars || guitars, historicalFeedback, null, effectiveRecoMode, guitarBias)
      .then((r) => {
        setLocalAiResult(r);
        setLocalAiErr(null);
        const rigSnapshot = computeRigSnapshot(allRigsGuitars || guitars);
        onSongDb((p) => p.map((x) => x.id === song.id ? { ...x, aiCache: { ...updateAiCache(x.aiCache, gId, r, { rigSnapshot }), sv: SCORING_VERSION } } : x));
        if (!gId && r?.ideal_guitar && onGuitarChange) {
          const matched = findGuitarByAIName(r.ideal_guitar, allRigsGuitars || guitars);
          if (matched) {
            setTimeout(() => {
              try { onGuitarChange(matched.id); } catch (e) { /* parent may not provide */ }
            }, 0);
          }
        }
      })
      .catch((e) => { setLocalAiErr(e?.message || String(e)); })
      .finally(() => setReloading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id, gId, needsRescore]);

  const handleGuitarChange = (v) => {
    setGId(v);
    setLocalAiResult(null);
    setLocalAiErr(null);
    if (onGuitarChange) onGuitarChange(song.id, v);
  };
  const g = (guitars || GUITARS).find((x) => x.id === gId);
  const type = g?.type || 'HB';
  const hist = getSongHist(song);
  const aiCraw = localAiResult || (getBestResult(song, gId, song.aiCache?.result) || null);
  const needRescore = !localAiResult && aiCraw && gId && song.aiCache?.gId !== gId;
  const aiC = needRescore ? enrichAIResult({ ...aiCraw, preset_ann: null, preset_plug: null, ideal_preset: null, ideal_preset_score: 0, ideal_top3: null }, type, gId, banksAnn, banksPlug) : aiCraw;
  const songInfo = getSongInfo(song);
  const idealGuitarFromCollection = aiC?.ideal_guitar ? findGuitarByAIName(aiC.ideal_guitar, guitars) : null;
  const idealGuitarCot = idealGuitarFromCollection ? findCotEntryForGuitar(aiC?.cot_step2_guitars, idealGuitarFromCollection) : null;
  const idealGuitarObj = idealGuitarCot || aiC?.cot_step2_guitars?.[0];
  const idealGuitarScore = idealGuitarCot?.score
    || (idealGuitarFromCollection ? localGuitarSongScore(idealGuitarFromCollection, aiC) : null)
    || idealGuitarObj?.score || null;
  const chosenGuitarCot = findCotEntryForGuitar(aiC?.cot_step2_guitars, g);
  const chosenGuitarScore = chosenGuitarCot?.score || localGuitarSongScore(g, aiC);
  const chosenGuitarScoreEstimated = !chosenGuitarCot && chosenGuitarScore != null;
  const sectionStyle = { background: 'var(--a3)', border: '1px solid var(--a7)', borderRadius: 'var(--r-lg)', padding: '10px 12px', marginBottom: 8 };
  const customSectionStyle = { background: 'var(--a5)', border: '1px solid var(--a10)', borderRadius: 'var(--r-lg)', padding: '10px 12px', marginBottom: 8 };
  const sectionTitle = (icon, label) => <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>{icon} {label}</div>;

  return (
    <div className="song-row-detail" style={{ background: 'var(--bg-elev-1)', borderRadius: '0 0 12px 12px', padding: '10px 12px', marginBottom: 8, marginTop: -2, display: 'flex', flexDirection: 'column', gap: 6 }}>

      {/* SECTION 1 : Infos morceau */}
      <div style={sectionStyle}>
        {sectionTitle('📖', 'Infos morceau')}
        {(songInfo.year || songInfo.album || songInfo.key || songInfo.bpm) && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{songInfo.year}{songInfo.album ? ' · ' + songInfo.album : ''}{songInfo.key ? ' · ' + songInfo.key : ''}{songInfo.bpm ? ' · ' + songInfo.bpm + ' BPM' : ''}</div>}
        {onSongDb && (
          <div data-testid="song-bpm-key-editor" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 10, color: 'var(--text-sec)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>BPM</span>
              <input type="number" min={30} max={300} defaultValue={song.bpm ?? ''} key={`bpm-${song.id}-${song.bpm ?? ''}`}
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  if (raw === '') { onSongDb((p) => p.map((x) => x.id === song.id ? { ...x, bpm: undefined } : x)); return; }
                  const n = Math.max(30, Math.min(300, parseInt(raw, 10)));
                  if (Number.isFinite(n)) onSongDb((p) => p.map((x) => x.id === song.id ? { ...x, bpm: n } : x));
                }}
                placeholder={songInfo.bpm ? String(songInfo.bpm) : '—'} aria-label="BPM"
                style={{ width: 55, background: 'var(--a5)', border: '1px solid var(--a8)', borderRadius: 'var(--r-sm)', padding: '2px 4px', color: 'var(--text)', fontSize: 10 }}/>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>Tonalité</span>
              <input type="text" maxLength={12} defaultValue={song.key ?? ''} key={`key-${song.id}-${song.key ?? ''}`} list="tonex-key-suggestions"
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  if (raw === '') { onSongDb((p) => p.map((x) => x.id === song.id ? { ...x, key: undefined } : x)); return; }
                  onSongDb((p) => p.map((x) => x.id === song.id ? { ...x, key: raw } : x));
                }}
                placeholder={songInfo.key || '—'} aria-label="Tonalité"
                style={{ width: 80, background: 'var(--a5)', border: '1px solid var(--a8)', borderRadius: 'var(--r-sm)', padding: '2px 4px', color: 'var(--text)', fontSize: 10 }}/>
            </label>
            <datalist id="tonex-key-suggestions">
              {['E', 'A', 'D', 'G', 'C', 'F', 'B', 'E minor', 'A minor', 'D minor', 'G minor', 'C minor', 'B minor', 'F# minor', 'C#', 'F#', 'Bb', 'Eb'].map((k) => <option key={k} value={k}/>)}
            </datalist>
          </div>
        )}
        {songInfo.desc && <div style={{ fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.5, marginBottom: 6 }}>{songInfo.desc}</div>}
        {aiC && (aiC.ref_guitarist || aiC.ref_guitar || aiC.ref_amp) && (
          <div style={{ fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.6 }}>
            <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 10 }}>{aiC.ref_guitarist || 'Référence'}</span><br/>
            {aiC.ref_guitar && <>🎸 {aiC.ref_guitar} · </>}
            {aiC.ref_amp && <>🔊 {aiC.ref_amp}</>}
            {aiC.ref_effects && aiC.ref_effects !== 'Aucun effet' && <> · 🎚 {aiC.ref_effects}</>}
          </div>
        )}
        {hist && !aiC && (
          <div style={{ fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.6 }}>
            <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 10 }}>{hist.guitarist}</span><br/>
            🎸 {hist.guitar} · 🔊 {hist.amp}{hist.effects ? ' · 🎚 ' + hist.effects : ''}
          </div>
        )}
      </div>

      {/* Loading */}
      {reloading && (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 28, marginBottom: 6, animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>&#9203;</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Analyse en cours pour {g?.short || 'cette guitare'}...</div>
        </div>
      )}

      {!reloading && aiC && (
        <>
          {/* SECTION 2 : Raisonnement IA */}
          {(aiC.cot_step1 || aiC.cot_step2_guitars || aiC.cot_step3_amp) && (
            <div style={sectionStyle}>
              <div onClick={() => setShowCot((p) => !p)} style={{ cursor: 'pointer', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', display: 'flex', alignItems: 'center', gap: 5, userSelect: 'none' }}>
                🧠 Raisonnement IA <span style={{ fontSize: 10, marginLeft: 'auto', fontWeight: 400 }}>{showCot ? '▲' : '▼'}</span>
              </div>
              {showCot && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {aiC.cot_step1 && <div style={{ background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>Profil tonal</div>
                    <div style={{ fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.4 }}>{aiC.cot_step1}</div>
                  </div>}
                  {aiC.cot_step2_guitars?.length > 0 && <div style={{ background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>Scoring guitares</div>
                    {aiC.cot_step2_guitars.map((gt, i) => <div key={i} style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: i < aiC.cot_step2_guitars.length - 1 ? 4 : 0, display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-bright)', flexShrink: 0 }}>{gt.name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: scoreColor(gt.score), flexShrink: 0 }}>{gt.score}%</span>
                      <span style={{ color: 'var(--text-dim)' }}>{gt.reason}</span>
                    </div>)}
                  </div>}
                  {aiC.cot_step3_amp && <div style={{ background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>Profil ampli</div>
                    <div style={{ fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.4 }}>{aiC.cot_step3_amp}</div>
                  </div>}
                </div>
              )}
            </div>
          )}

          {/* SECTION 3 : Recommandations idéales */}
          <div style={sectionStyle}>
            {sectionTitle(<StatusDot score={100} ideal={true} size={10}/>, 'Recommandation ideale')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {aiC.ideal_guitar && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  <StatusDot score={idealGuitarScore} ideal={true}/>
                  <div style={{ flex: 1 }}>Guitare <span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{aiC.ideal_guitar}</span></div>
                  {idealGuitarScore && <b style={{ color: scoreColor(idealGuitarScore), flexShrink: 0 }}>{idealGuitarScore}%</b>}
                </div>
              )}
              {aiC.guitar_reason && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: -2, marginBottom: 2 }}>{aiC.guitar_reason}</div>}
              {aiC.ideal_preset && getActiveDevicesForRender(profile).some((d) => d.deviceKey === 'ann' || d.deviceKey === 'plug') && (() => {
                const idealScore = aiC.ideal_preset_score || 0;
                const locAnn = findInBanks(aiC.ideal_preset, banksAnn);
                const locPlug = findInBanks(aiC.ideal_preset, banksPlug);
                const loc = locAnn || locPlug;
                const entry = findCatalogEntry(aiC.ideal_preset);
                if (availableSources && entry?.src && availableSources[entry.src] === false) return null;
                const canInstallAnn = !locAnn && onBanksAnn;
                const canInstallPlug = !locPlug && onBanksPlug;
                const doInstall = (device) => {
                  const bk = Number(installBank[device]);
                  const sl = installSlot[device];
                  const onBanks = device === 'ann' ? onBanksAnn : onBanksPlug;
                  if (isNaN(bk) || !sl || !onBanks) return;
                  onBanks((p) => ({ ...p, [bk]: { ...(p[bk] || { cat: '', A: '', B: '', C: '' }), [sl]: aiC.ideal_preset } }));
                  setInstallTarget(null);
                };
                const bankInput = (device, maxBanks) => {
                  const banks = device === 'ann' ? banksAnn : banksPlug;
                  const bk = installBank[device];
                  const sl = installSlot[device];
                  const currentPreset = bk !== '' && banks[Number(bk)] ? banks[Number(bk)][sl] || '(vide)' : '';
                  const dev = getActiveDevicesForRender(profile).find((d) => d.deviceKey === device);
                  const deviceLabel = dev ? `${dev.icon} ${dev.label}` : (device === 'ann' ? '📦 Pedale' : '🔌 Plug');
                  return (
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-sec)', marginBottom: 4, fontWeight: 600 }}>{deviceLabel}</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Banque</span>
                        <input type="number" inputMode="numeric" min={device === 'ann' ? 0 : 1} max={maxBanks} value={bk} onChange={(e) => setInstallBank((p) => ({ ...p, [device]: e.target.value }))} style={{ width: 50, fontSize: 11, background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-md)', padding: '4px 6px', textAlign: 'center' }} placeholder={device === 'ann' ? '0-49' : '1-10'}/>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Slot</span>
                        <select value={sl} onChange={(e) => setInstallSlot((p) => ({ ...p, [device]: e.target.value }))} style={{ fontSize: 11, background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-md)', padding: '4px 6px' }}>
                          <option value="A">A (Clean)</option><option value="B">B (Drive)</option><option value="C">C (Lead)</option>
                        </select>
                        <button onClick={() => doInstall(device)} disabled={bk === ''} style={{ fontSize: 10, background: bk !== '' ? 'var(--accent)' : 'var(--bg-disabled)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '4px 10px', cursor: bk !== '' ? 'pointer' : 'not-allowed', fontWeight: 700 }}>OK</button>
                      </div>
                      {bk !== '' && currentPreset && <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>Remplace : {currentPreset}</div>}
                    </div>
                  );
                };
                return (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                      <StatusDot score={idealScore} ideal={true}/>
                      <div style={{ flex: 1 }}>Preset <span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{aiC.ideal_preset}</span></div>
                      {idealScore > 0 && <b style={{ color: scoreColor(idealScore), flexShrink: 0 }}>{idealScore}%</b>}
                    </div>
                    <div style={{ fontSize: 9, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {loc ? <span style={{ color: 'var(--green)' }}>✓ Installe — Banque {loc.bank}{loc.slot}</span>
                        : <span style={{ color: 'var(--yellow)' }}>⬇ Non installe</span>}
                      {(() => { const si = getSourceInfo(entry); return si ? <span style={{ color: loc ? 'var(--text-tertiary)' : 'var(--text-sec)' }}>· {si.icon} {si.label}</span> : null; })()}
                      {!loc && !installTarget && (canInstallAnn || canInstallPlug) && <button onClick={() => setInstallTarget({ preset: aiC.ideal_preset })} style={{ fontSize: 9, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', color: 'var(--accent)', borderRadius: 'var(--r-sm)', padding: '2px 8px', cursor: 'pointer', fontWeight: 600, marginLeft: 'auto' }}>Installer</button>}
                    </div>
                    {installTarget?.preset === aiC.ideal_preset && (() => {
                      const activeEnabled = getActiveDevicesForRender(profile);
                      const canPedal = canInstallAnn && activeEnabled.some((d) => d.deviceKey === 'ann');
                      const canPlug = canInstallPlug && activeEnabled.some((d) => d.deviceKey === 'plug');
                      if (!canPedal && !canPlug) return null;
                      return (
                        <div style={{ marginTop: 6, background: 'var(--a4)', border: '1px solid var(--a10)', borderRadius: 'var(--r-md)', padding: 10 }}>
                          <div style={{ fontSize: 10, color: 'var(--text-sec)', marginBottom: 8, fontWeight: 600 }}>Installer "{aiC.ideal_preset}" sur :</div>
                          {canPedal && bankInput('ann', 49)}
                          {canPlug && bankInput('plug', 10)}
                          <button onClick={() => setInstallTarget(null)} style={{ fontSize: 9, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>Annuler</button>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
              {getActiveDevicesForRender(profile).some((d) => d.deviceKey === 'ann' || d.deviceKey === 'plug') && (() => {
                const filteredTop3 = (aiC.ideal_top3 || []).filter((p) => {
                  const e = findCatalogEntry(p.name);
                  return !availableSources || !e?.src || availableSources[e.src] !== false;
                });
                if (filteredTop3.length <= 1) return null;
                return (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', color: 'var(--text-tertiary)', marginBottom: 4 }}>Alternatives catalogue</div>
                    {filteredTop3.slice(1).map((p, i) => {
                      const loc = findInBanks(p.name, banksAnn) || findInBanks(p.name, banksPlug);
                      const entry = findCatalogEntry(p.name);
                      const si = getSourceInfo(entry);
                      return (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                            <StatusDot score={p.score} size={6}/>
                            <span style={{ flex: 1, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name} <span style={{ color: 'var(--text-tertiary)' }}>({entry?.amp || p.amp})</span></span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: scoreColor(p.score), flexShrink: 0 }}>{p.score}%</span>
                          </div>
                          <div style={{ fontSize: 9, marginLeft: 14, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                            {loc ? <span style={{ color: 'var(--green)' }}>✓ Installe — Banque {loc.bank}{loc.slot}</span>
                              : <span style={{ color: 'var(--yellow)' }}>⬇ Non installe</span>}
                            {si && <span style={{ color: loc ? 'var(--text-tertiary)' : 'var(--text-sec)' }}>· {si.icon} {si.label}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              {(aiC.settings_preset || aiC.settings_guitar) && (
                <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {aiC.settings_preset && <div style={{ fontSize: 10, background: 'var(--a4)', border: '1px solid var(--a10)', borderRadius: 'var(--r-md)', padding: '5px 8px', color: 'var(--text-sec)' }}><b style={{ color: 'var(--text-muted)' }}>Preset :</b> {aiC.settings_preset}</div>}
                  {aiC.settings_guitar && <div style={{ fontSize: 10, background: 'var(--a4)', border: '1px solid var(--a10)', borderRadius: 'var(--r-md)', padding: '5px 8px', color: 'var(--text-sec)' }}><b style={{ color: 'var(--text-muted)' }}>Guitare :</b> {aiC.settings_guitar}</div>}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* SECTION 4 : Paramétrage */}
      <div style={customSectionStyle}>
        {sectionTitle('🎛', 'Parametrage — mon choix')}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Guitare choisie</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusDot score={chosenGuitarScore} ideal={g && ig.includes(gId)} size={10}/>
            <div style={{ flex: 1 }}><GuitarSelect value={gId} onChange={handleGuitarChange} ig={ig} guitars={guitars}/></div>
          </div>
          {g && chosenGuitarScore && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3, marginLeft: 24 }}>Compatibilite : <b style={{ color: scoreColor(chosenGuitarScore) }}>{chosenGuitarScore}%</b>{chosenGuitarScoreEstimated && <span style={{ marginLeft: 6, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>(estime)</span>}</div>}
          {g && aiC && (() => { const fb = guitarChoiceFeedback(g, aiC, chosenGuitarCot); return fb ? <div style={{ fontSize: 10, color: 'var(--text-sec)', marginTop: 3, marginLeft: 24, lineHeight: 1.4 }}>{fb}</div> : null; })()}
          {g && aiC && (() => { const s = localGuitarSettings(g, aiC); return s ? <div style={{ fontSize: 10, background: 'var(--a4)', border: '1px solid var(--a10)', borderRadius: 'var(--r-md)', padding: '5px 8px', color: 'var(--text-sec)', marginTop: 5, marginLeft: 24 }}><b style={{ color: 'var(--text-muted)' }}>Reglages :</b> {s}</div> : null; })()}
        </div>
        <div style={{ marginBottom: 12, marginLeft: 24 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Mode IA pour ce morceau {song.recoMode ? <span style={{ color: 'var(--accent)' }}>· override</span> : <span style={{ color: 'var(--text-dim)' }}>· profil ({profile?.recoMode || 'balanced'})</span>}</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[
              { id: '', icon: '↻', label: 'Profil' },
              { id: 'balanced', icon: '⚖️', label: 'Équilibré' },
              { id: 'faithful', icon: '🎯', label: 'Fidèle' },
              { id: 'interpretation', icon: '🎨', label: 'Interprétation' },
            ].map(({ id, icon, label }) => {
              const active = (song.recoMode || '') === id;
              return (
                <button key={id || 'profile'}
                  data-testid={`song-reco-mode-${id || 'profile'}`}
                  onClick={() => {
                    onSongDb((p) => p.map((x) => x.id === song.id ? { ...x, recoMode: id || undefined, aiCache: null } : x));
                    setLocalAiResult(null);
                  }}
                  title={id ? `Override : ${label}` : 'Hérite du mode profil. Cliquer invalide le cache IA pour re-fetcher avec le nouveau mode.'}
                  style={{ fontSize: 10, fontWeight: active ? 700 : 500, background: active ? 'var(--accent-bg)' : 'var(--a3)', border: active ? '1px solid var(--accent-border)' : '1px solid var(--a8)', color: active ? 'var(--accent)' : 'var(--text-muted)', borderRadius: 'var(--r-sm)', padding: '3px 8px', cursor: 'pointer' }}
                >{icon} {label}</button>
              );
            })}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 3, fontStyle: 'italic' }}>Changer le mode invalide le cache → re-analyse au prochain ouverture du morceau.</div>
        </div>
        {aiC && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Meilleurs presets installes pour {g?.short || 'cette guitare'}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {getActiveDevicesForRender(profile).map((d) => {
            if (typeof d.RecommendBlock === 'function') {
              return (
                <div key={d.id} style={{ borderTop: '1px solid var(--a8)', marginTop: 6, paddingTop: 6 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: d.deviceColor || 'var(--brass-400)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>{d.icon}</span><span>{d.label}</span>
                  </div>
                  <d.RecommendBlock song={song} guitar={g} profile={profile} allGuitars={guitars} onPatchOverride={onTmpPatchOverride}/>
                </div>
              );
            }
            if (!aiC) return null;
            const banks = d.bankStorageKey === 'banksAnn' ? banksAnn : banksPlug;
            const presetData = aiC[d.presetResultKey];
            return (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <StatusDot score={presetData?.score} ideal={presetData?.label === aiC.ideal_preset} size={10}/>
                <div style={{ flex: 1 }}>
                  <PBlock device={d.label} emoji={d.icon} presetName={presetData?.label} gType={gId ? type : null} banks={banks} availableSources={availableSources} guitarId={gId} noUpgrade finalScore={presetData?.score} breakdown={presetData?.breakdown}/>
                </div>
              </div>
            );
          })}
        </div>
        {/* Suggestion d'amélioration si score < 90% */}
        {aiC && (() => {
          const bestScore = Math.max(aiC.preset_ann?.score || 0, aiC.preset_plug?.score || 0, aiC.ideal_preset_score || 0);
          if (bestScore >= 90) return null;
          const bestBreakdown = aiC.preset_ann?.breakdown || aiC.preset_plug?.breakdown;
          const refAmp = aiC.ref_amp || "l'ampli original";
          let weakest = null; let weakLabel = ''; let weakScore = 100;
          if (bestBreakdown) {
            const dims = [
              { key: 'refAmp', label: 'Ampli', score: bestBreakdown.refAmp?.raw },
              { key: 'gainMatch', label: 'Gain', score: bestBreakdown.gainMatch?.raw },
              { key: 'styleMatch', label: 'Style', score: bestBreakdown.styleMatch?.raw },
              { key: 'pickup', label: 'Micro', score: bestBreakdown.pickup?.raw },
            ];
            dims.forEach((d) => { if (d.score != null && d.score < weakScore) { weakScore = d.score; weakest = d.key; weakLabel = d.label; } });
          }
          const extMatches = [];
          const refLower = (refAmp || '').toLowerCase();
          for (const packName in TSR_PACK_ZIPS) {
            if (packName.toLowerCase().includes(refLower) || refLower.includes(packName.toLowerCase())) {
              extMatches.push({ creator: 'The Studio Rats', url: 'thestudiorats.com', pack: packName });
            }
          }
          (EXTERNAL_PACK_CATALOG || []).forEach((creator) => {
            if (creator.creator === 'The Studio Rats') return;
            creator.packs.forEach((pack) => {
              const match = pack.amps.some((a) => refLower.includes(a) || a.includes(refLower));
              if (match) {
                const already = extMatches.find((e) => e.creator === creator.creator && e.pack === pack.name);
                if (!already) extMatches.push({ creator: creator.creator, url: creator.url, pack: pack.name });
              }
            });
          });
          if (extMatches.length === 0 && AMP_TAXONOMY) {
            const refTax = AMP_TAXONOMY[refAmp];
            if (refTax) {
              for (const pn in TSR_PACK_ZIPS) {
                const pnLower = pn.toLowerCase();
                for (const ampName in AMP_TAXONOMY) {
                  if (pnLower.includes(ampName.toLowerCase().split(' ')[0]) && AMP_TAXONOMY[ampName].family === refTax.family) {
                    const alr = extMatches.find((e) => e.creator === 'The Studio Rats' && e.pack === pn);
                    if (!alr) extMatches.push({ creator: 'The Studio Rats', url: 'thestudiorats.com', pack: pn, family: true });
                    break;
                  }
                }
              }
              (EXTERNAL_PACK_CATALOG || []).forEach((creator) => {
                if (creator.creator === 'The Studio Rats') return;
                creator.packs.forEach((pack) => {
                  pack.amps.forEach((a) => {
                    for (const ampName in AMP_TAXONOMY) {
                      if (ampName.toLowerCase().includes(a) && AMP_TAXONOMY[ampName].family === refTax.family) {
                        const already = extMatches.find((e) => e.creator === creator.creator && e.pack === pack.name);
                        if (!already) extMatches.push({ creator: creator.creator, url: creator.url, pack: pack.name, family: true });
                        return;
                      }
                    }
                  });
                });
              });
            }
          }
          let suggestion = '';
          if (weakest === 'refAmp') suggestion = 'Aucun preset installe ne simule ' + refAmp + '.';
          else if (weakest === 'gainMatch') suggestion = 'Le gain des presets disponibles ne correspond pas au son original.';
          else if (weakest === 'styleMatch') suggestion = 'Le style des presets disponibles ne matche pas bien.';
          else if (weakest === 'pickup') suggestion = 'Les presets ne sont pas optimises pour votre type de micro (' + type + ').';
          else suggestion = "Le meilleur preset installe n'atteint pas 90%.";
          return (
            <div style={{ marginTop: 8, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--yellow)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>Ameliorable — {bestScore}% max</div>
              <div style={{ fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.5, marginBottom: 6 }}>
                {weakest && <span>Point faible : <b>{weakLabel}</b> ({weakScore}%). </span>}
                {suggestion}
              </div>
              {extMatches.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>Packs recommandes a l'achat :</div>
                  {extMatches.map((e, i) => (
                    <div key={i} style={{ fontSize: 10, color: 'var(--text-sec)', marginBottom: 3, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <StatusDot score={e.family ? 65 : 85} size={6}/>
                      <span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{e.pack}</span>
                      <span style={{ color: 'var(--text-dim)' }}>{e.creator}</span>
                      {e.family && <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>[famille similaire]</span>}
                    </div>
                  ))}
                </div>
              )}
              {extMatches.length === 0 && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>Aucun pack connu pour "{refAmp}" dans notre base.</div>}
              <div style={{ marginTop: 6, background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 6, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-sec)', marginBottom: 3 }}>Recherche ToneNET</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>Recherchez <b style={{ color: 'var(--text-bright)' }}>{refAmp}</b> dans le moteur de recherche ToneNET</div>
                <a href="https://tone.net" target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: 'var(--accent)', textDecoration: 'underline' }}>tone.net</a>
              </div>
            </div>
          );
        })()}
      </div>

      {!reloading && !aiC && !localAiErr && <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '10px 0' }}>Aucune analyse IA en cache. Selectionne une guitare pour lancer l'analyse.</div>}
      {localAiErr && !reloading && (
        <div data-testid="song-ai-error" style={{ fontSize: 12, color: 'var(--red)', background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: 'var(--r-md)', padding: '8px 10px', margin: '6px 0', lineHeight: 1.4 }}>
          ⚠️ Analyse IA échouée : <b>{localAiErr}</b>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Vérifie ta clé API dans ⚙️ Paramètres puis re-sélectionne la guitare pour relancer.</div>
        </div>
      )}

      {/* SECTION 6 : Feedback IA */}
      {!reloading && aiC && (
        <div style={{ marginTop: 8 }}>
          {Array.isArray(song.feedback) && song.feedback.length > 0 && (() => {
            const all = song.feedback;
            const showFromIdx = Math.max(0, all.length - 3);
            return (
              <div style={{ background: 'var(--a3)', border: '1px solid var(--a7)', borderRadius: 'var(--r-md)', padding: '6px 10px', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 }}>💬 Tes feedbacks précédents ({all.length})</div>
                  {all.length > 1 && <button
                    data-testid="song-feedback-clear-all"
                    onClick={() => {
                      if (!window.confirm(`Effacer tous les ${all.length} feedbacks pour "${song.title}" ?\n\nL'analyse IA va être recalculée sans tes corrections passées (~8s).`)) return;
                      onSongDb((p) => p.map((x) => x.id === song.id ? { ...x, feedback: [], aiCache: null } : x));
                      setLocalAiResult(null);
                    }}
                    style={{ fontSize: 9, background: 'none', border: '1px solid var(--a10)', color: 'var(--text-dim)', borderRadius: 'var(--r-sm)', padding: '1px 6px', cursor: 'pointer' }}
                    title="Effacer tous les feedbacks pour ce morceau"
                  >Tout effacer</button>}
                </div>
                {all.map((fb, i) => {
                  if (i < showFromIdx) return null;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 10, color: 'var(--text-sec)', lineHeight: 1.4, marginBottom: 2 }}>
                      <span style={{ flex: 1 }}>· <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>{fb.ts ? new Date(fb.ts).toLocaleDateString('fr') : ''}</span> — {fb.text}</span>
                      <button
                        data-testid={`song-feedback-delete-${i}`}
                        onClick={() => {
                          onSongDb((p) => p.map((x) => x.id === song.id ? { ...x, feedback: (x.feedback || []).filter((_, j) => j !== i), aiCache: null } : x));
                          setLocalAiResult(null);
                        }}
                        title="Supprimer ce feedback + recalculer la reco IA sans lui"
                        style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
                      >✕</button>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          {!showFeedback
            ? <button data-testid="song-feedback-open" onClick={() => setShowFeedback(true)} style={{ fontSize: 11, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', color: 'var(--accent)', borderRadius: 'var(--r-md)', padding: '6px 12px', cursor: 'pointer', fontWeight: 600 }}>💬 Donner un feedback à l'IA</button>
            : <FeedbackPanel
                onSubmit={(fb) => {
                  setShowFeedback(false); setReloading(true);
                  const prev = aiC;
                  const effectiveRecoMode = song.recoMode || profile?.recoMode || 'balanced';
                  fetchAI(song, gId, banksAnn, banksPlug, aiProvider, aiKeys, allRigsGuitars || guitars, fb || null, null, effectiveRecoMode, guitarBias)
                    .then((r) => {
                      const pick = mergeBestResults(prev, r);
                      setLocalAiResult(pick);
                      if (onSongDb) onSongDb((p) => p.map((x) => {
                        if (x.id !== song.id) return x;
                        const newFeedback = fb ? [...(x.feedback || []), { text: fb, ts: Date.now() }] : x.feedback;
                        return { ...x, aiCache: updateAiCache(x.aiCache, gId, pick), feedback: newFeedback };
                      }));
                    })
                    .catch((e) => { setLocalAiErr(e?.message || String(e)); })
                    .finally(() => setReloading(false));
                }}
                onCancel={() => setShowFeedback(false)}
              />
          }
        </div>
      )}
      <button onClick={onClose} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, marginTop: 4 }}>Fermer ↑</button>
    </div>
  );
}

export default SongDetailCard;
export { SongDetailCard };

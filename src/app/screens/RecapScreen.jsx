// src/app/screens/RecapScreen.jsx — Phase 7.14 (découpage main.jsx).
//
// Écran de récap de session : pour une liste de morceaux donnée
// (`songs` prop), calcule (a) la ou les guitares à amener (mode "single"
// vs "multi" top 3), (b) le preset reco par morceau et par device, et
// (c) la liste des presets non installés à installer en amont.
//
// L'écran ne fait que de la lecture/calcul. Les mutations (guitar
// choice par-song, preset adoption) sont remontées via `onValidate` qui
// passe le gps + aiR au SynthesisScreen suivant.

import React, { useState, useMemo } from 'react';
import { GUITARS } from '../../core/guitars.js';
import { findGuitarByAIName } from '../../core/scoring/guitar.js';
import { findCatalogEntry } from '../../core/catalog.js';
import { getActiveDevicesForRender } from '../utils/devices-render.js';
import { getIg, getPA, getPP } from '../utils/song-helpers.js';
import {
  getBestResult, enrichAIResult, computeBestPresets,
} from '../utils/ai-helpers.js';
import { findInBanks } from '../utils/preset-helpers.js';
import { CC, TYPE_COLORS, TYPE_LABELS } from '../utils/ui-constants.js';
import { scoreColor } from '../components/score-utils.js';
import Breadcrumb from '../components/Breadcrumb.jsx';
import GuitarSelect from '../components/GuitarSelect.jsx';

function RecapScreen({
  songs, onBack, onNavigate, onValidate,
  songDb, onSongDb,
  banksAnn, banksPlug,
  aiProvider, aiKeys,
  allGuitars, guitarBias, availableSources,
  profile, onTmpPatchOverride,
}) {
  // Phase 2 fix : iterate sur les devices activés pour le rendu compact
  // par morceau et pour la liste des presets manquants.
  const enabledDevices = getActiveDevicesForRender(profile);
  const guitars = allGuitars || GUITARS;
  const [mode, setMode] = useState('single'); // "single" | "multi"
  const [selectedGuitarId, setSelectedGuitarId] = useState(null);

  // Compute top guitars ranked by song affinity
  const rankedGuitars = useMemo(() => {
    const songsByGuitar = {};
    songs.forEach((s) => {
      const ig = getIg(s, guitars);
      let matched = false;
      ig.forEach((gId) => {
        if (!songsByGuitar[gId]) songsByGuitar[gId] = new Set();
        songsByGuitar[gId].add(s.id); matched = true;
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
          const pA = getPA(s, t);
          const pP = getPP(s, t);
          const name = pA?.l || pP?.l;
          if (name) {
            const e = findCatalogEntry(name);
            if (e?.scores?.[t]) typeScores[t] = e.scores[t];
          }
        });
        const bestType = Object.entries(typeScores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'HB';
        const matching = guitars.filter((g) => g.type === bestType);
        if (matching.length) {
          if (!songsByGuitar[matching[0].id]) songsByGuitar[matching[0].id] = new Set();
          songsByGuitar[matching[0].id].add(s.id);
        }
      }
    });
    return Object.entries(songsByGuitar)
      .map(([gId, sIds]) => ({ gId, count: sIds.size, songIds: [...sIds] }))
      .sort((a, b) => b.count - a.count);
  }, [songs, guitars]);

  const topGuitar = rankedGuitars[0] ? guitars.find((g) => g.id === rankedGuitars[0].gId) : null;
  const top3 = rankedGuitars.slice(0, 3).map((r) => ({ ...r, guitar: guitars.find((g) => g.id === r.gId) })).filter((r) => r.guitar);
  const chosenGuitar = guitars.find((g) => g.id === selectedGuitarId) || topGuitar;

  // Assign guitar per song based on mode
  const songGuitarMap = useMemo(() => {
    const map = {};
    if (mode === 'single' && chosenGuitar) {
      songs.forEach((s) => { map[s.id] = chosenGuitar; });
    } else {
      const top3Ids = new Set(top3.map((r) => r.gId));
      songs.forEach((s) => {
        const ig = getIg(s, guitars);
        const aiG = s.aiCache?.result?.ideal_guitar;
        let best = null;
        if (aiG) { const m = findGuitarByAIName(aiG, guitars); if (m && top3Ids.has(m.id)) best = m; }
        if (!best && ig.length) { const m = guitars.find((g) => g.id === ig[0]); if (m && top3Ids.has(m.id)) best = m; }
        if (!best) {
          const ai = s.aiCache?.result;
          const style = ai?.song_style || 'rock';
          let bestScore = 0;
          top3.forEach((r) => {
            const gType = r.guitar.type;
            const b = computeBestPresets(gType, style, banksAnn, banksPlug, r.gId, ai?.ref_amp);
            const sc = Math.max(b.annTop?.score || 0, b.plugTop?.score || 0);
            if (sc > bestScore) { bestScore = sc; best = r.guitar; }
          });
        }
        if (!best && top3.length) best = top3[0].guitar;
        if (!best && guitars.length) best = guitars[0];
        map[s.id] = best;
      });
    }
    return map;
  }, [mode, songs, guitars, chosenGuitar, top3, banksAnn, banksPlug]);

  // Compute preset for each song based on assigned guitar
  const songRows = useMemo(() => songs.map((s) => {
    const g = songGuitarMap[s.id];
    const gType = g?.type || 'HB';
    const gId = g?.id || '';
    const aiCraw = getBestResult(s, gId, s.aiCache?.result) || null;
    let presetAnn = null; let presetPlug = null;
    if (aiCraw) {
      const cleaned = { ...aiCraw, preset_ann: null, preset_plug: null, ideal_preset: null, ideal_preset_score: 0, ideal_top3: null };
      const enriched = enrichAIResult(cleaned, gType, gId, banksAnn, banksPlug);
      presetAnn = enriched.preset_ann || null;
      presetPlug = enriched.preset_plug || null;
    }
    return { song: s, guitar: g, presetAnn, presetPlug };
  }), [songs, songGuitarMap, banksAnn, banksPlug]);

  // Compute missing presets to install (bottom section)
  const missingPresets = useMemo(() => {
    const map = new Map();
    songRows.forEach(({ song, presetAnn, presetPlug }) => {
      const check = (p, device) => {
        if (!p?.label) return;
        const isDeviceEnabled = enabledDevices.some((d) => d.deviceKey === device);
        if (!isDeviceEnabled) return;
        const banks = device === 'ann' ? banksAnn : banksPlug;
        const loc = findInBanks(p.label, banks);
        if (!loc) {
          const key = p.label + '|' + device;
          const existing = map.get(key);
          const entry = findCatalogEntry(p.label);
          if (!existing) map.set(key, { preset: p.label, device, score: p.score || 0, songs: [song.title], pack: entry?.src === 'TSR' ? entry.pack : null, amp: entry?.amp || '' });
          else if (!existing.songs.includes(song.title)) existing.songs.push(song.title);
        }
      };
      check(presetAnn, 'ann');
      check(presetPlug, 'plug');
    });
    return [...map.values()].sort((a, b) => b.songs.length - a.songs.length || b.score - a.score);
  }, [songRows, banksAnn, banksPlug]);

  // Build gps and aiR for onValidate
  const gps = useMemo(() => { const o = {}; songs.forEach((s) => { o[s.id] = songGuitarMap[s.id]?.id || ''; }); return o; }, [songs, songGuitarMap]);
  const aiR = useMemo(() => {
    const o = {};
    songRows.forEach(({ song, presetAnn, presetPlug }) => {
      const ai = song.aiCache?.result;
      if (ai) o[song.id] = { ...ai, preset_ann: presetAnn, preset_plug: presetPlug };
    });
    return o;
  }, [songRows]);

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Accueil', screen: 'list' }, { label: 'Récap' }]} onNavigate={onNavigate}/>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>Récap de session</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{songs.length} morceau{songs.length > 1 ? 'x' : ''}</div>
      </div>

      {/* Choix du mode : 1 guitare unique ou top 3 */}
      <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', marginBottom: 8 }}>Combien de guitares ?</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setMode('single')} style={{ flex: 1, fontSize: 13, fontWeight: mode === 'single' ? 700 : 500, color: mode === 'single' ? 'var(--green)' : 'var(--text-muted)', background: mode === 'single' ? 'var(--green-bg)' : 'var(--a3)', border: mode === 'single' ? '1px solid rgba(74,222,128,0.4)' : '1px solid var(--a7)', borderRadius: 'var(--r-lg)', padding: '10px 12px', cursor: 'pointer', textAlign: 'center' }}>1 seule guitare</button>
          <button onClick={() => setMode('multi')} style={{ flex: 1, fontSize: 13, fontWeight: mode === 'multi' ? 700 : 500, color: mode === 'multi' ? 'var(--accent)' : 'var(--text-muted)', background: mode === 'multi' ? 'var(--accent-soft)' : 'var(--a3)', border: mode === 'multi' ? '1px solid var(--border-accent)' : '1px solid var(--a7)', borderRadius: 'var(--r-lg)', padding: '10px 12px', cursor: 'pointer', textAlign: 'center' }}>Top 3 guitares</button>
        </div>
      </div>

      {/* Recommandation guitare(s) */}
      <div style={{ background: 'var(--a4)', border: '1px solid var(--green-border)', borderRadius: 'var(--r-xl)', padding: 16, marginBottom: 20 }}>
        {mode === 'single' ? (
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>🎸 Guitare pour cette session</div>
            {topGuitar && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 8 }}>Recommandee : {topGuitar.name} ({rankedGuitars[0]?.count || 0}/{songs.length} morceaux)</div>}
            <div style={{ marginBottom: 4 }}>
              <GuitarSelect value={chosenGuitar?.id || ''} onChange={(v) => setSelectedGuitarId(v)} ig={rankedGuitars.map((r) => r.gId)} guitars={guitars}/>
            </div>
            {chosenGuitar && chosenGuitar.id !== topGuitar?.id && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>Choix perso — les presets sont recalcules pour {chosenGuitar.short || chosenGuitar.name} ({chosenGuitar.type})</div>}
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>🎸 Top 3 guitares à prendre</div>
            {top3.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {top3.map(({ gId, count, guitar }, i) => {
                  const rgb = TYPE_COLORS[guitar.type] || '148,163,184';
                  return (
                    <div key={gId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: `rgba(${rgb},0.06)`, border: `1px solid rgba(${rgb},0.15)`, borderRadius: 'var(--r-md)' }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: `rgb(${rgb})`, width: 20, textAlign: 'center' }}>{i + 1}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: `rgb(${rgb})`, flex: 1 }}>{guitar.name}</span>
                      <span style={{ fontSize: 10, color: `rgb(${rgb})`, background: `rgba(${rgb},0.12)`, borderRadius: 'var(--r-sm)', padding: '2px 7px', fontWeight: 600 }}>{TYPE_LABELS[guitar.type] || guitar.type}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{count} morceau{count > 1 ? 'x' : ''}</span>
                    </div>
                  );
                })}
              </div>
            ) : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aucune guitare configurée</div>}
          </div>
        )}
      </div>

      {/* Liste des morceaux avec preset/guitare */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>🎵 Morceaux</div>
        {songRows.map(({ song, guitar, presetAnn, presetPlug }) => {
          const rgb = guitar ? TYPE_COLORS[guitar.type] || '148,163,184' : '148,163,184';
          const perDevice = enabledDevices.map((d) => {
            const banks = d.bankStorageKey === 'banksAnn' ? banksAnn : banksPlug;
            const presetData = d.deviceKey === 'ann' ? presetAnn : presetPlug;
            const loc = presetData?.label ? findInBanks(presetData.label, banks) : null;
            return { d, presetData, loc };
          }).filter((x) => x.presetData?.label);
          return (
            <div key={song.id} style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: '10px 12px', marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{song.artist}</div>
                </div>
                {guitar && <span style={{ fontSize: 10, fontWeight: 600, color: `rgb(${rgb})`, background: `rgba(${rgb},0.1)`, border: `1px solid rgba(${rgb},0.25)`, borderRadius: 'var(--r-md)', padding: '2px 8px', flexShrink: 0, marginLeft: 8 }}>{guitar.short || guitar.name}</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {perDevice.map(({ d, presetData, loc }) => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                    <span style={{ color: d.deviceKey === 'plug' ? 'var(--accent)' : 'var(--green)', fontWeight: 700, flexShrink: 0 }}>{d.icon}</span>
                    <span style={{ color: 'var(--text-bright)', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{presetData.label}</span>
                    {presetData.score && <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: scoreColor(presetData.score), flexShrink: 0 }}>{presetData.score}%</span>}
                    {loc ? <span style={{ fontSize: 9, color: CC[loc.slot], fontWeight: 700, flexShrink: 0 }}>{loc.bank}{loc.slot}</span> : <span style={{ fontSize: 9, color: 'var(--yellow)', flexShrink: 0 }}>non installé</span>}
                  </div>
                ))}
                {enabledDevices.filter((d) => typeof d.RecommendBlock === 'function').map((d) => (
                  <div key={d.id} style={{ borderTop: '1px solid var(--a8)', marginTop: 4, paddingTop: 6 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: d.deviceColor || 'var(--brass-400)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>{d.icon}</span><span>{d.label}</span>
                    </div>
                    <d.RecommendBlock song={song} guitar={guitar} profile={profile} allGuitars={allGuitars} onPatchOverride={onTmpPatchOverride}/>
                  </div>
                ))}
                {perDevice.length === 0 && enabledDevices.filter((d) => typeof d.RecommendBlock === 'function').length === 0 && <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>Pas de cache IA — lance une analyse depuis la fiche du morceau</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Presets manquants à installer */}
      {missingPresets.length > 0 && (
        <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 'var(--r-xl)', padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--yellow)', marginBottom: 4 }}>⬇ Presets à installer</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>{missingPresets.length} preset{missingPresets.length > 1 ? 's' : ''} non installé{missingPresets.length > 1 ? 's' : ''}</div>
          {missingPresets.map((p) => {
            const dev = enabledDevices.find((d) => d.deviceKey === p.device);
            const icon = dev ? dev.icon : (p.device === 'ann' ? '📦' : '🔌');
            const color = p.device === 'ann' ? 'var(--green)' : 'var(--accent)';
            return (
              <div key={p.preset + p.device} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.12)', borderRadius: 'var(--r-md)', marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color, fontWeight: 700, flexShrink: 0 }}>{icon}</span>
                <span style={{ fontSize: 11, color: 'var(--text-bright)', fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.preset}</span>
                {p.score > 0 && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: scoreColor(p.score) }}>{p.score}%</span>}
                {p.pack && <span style={{ fontSize: 9, color: 'var(--yellow)', fontWeight: 600 }}>📦 {p.pack}.zip</span>}
                <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{p.songs.join(', ')}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="bottom-action" style={{ paddingTop: 8 }}>
        <button onClick={() => onValidate(gps, aiR)} style={{ width: '100%', background: 'var(--accent)', border: 'none', color: 'var(--text)', borderRadius: 'var(--r-lg)', padding: '16px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          ✅ Valider et voir le tableau de synthèse →
        </button>
      </div>
    </div>
  );
}

export default RecapScreen;
export { RecapScreen };

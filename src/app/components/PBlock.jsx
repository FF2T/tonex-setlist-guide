// src/app/components/PBlock.jsx — Phase 7.14 (découpage main.jsx).
//
// Preset block card affichant un preset recommandé pour une guitare
// donnée sur un device (Pédale, Plug, etc.) avec :
// - Score final (avec breakdown au clic via ScoreWithBreakdown).
// - Statut d'installation (bank+slot ou "À installer").
// - Suggestion d'upgrade si un meilleur preset existe dans le catalogue.
// - Badge "Source non dispo" si availableSources[entry.src] === false.
//
// ScoreWithBreakdown : popover dropdown avec la décomposition par
// dimension (pickup/gain/refAmp/styleMatch + weight + contribution).
// Co-localisé avec PBlock car utilisé exclusivement ici (et par les
// screens qui rendent PBlock).

import React, { useState, useRef, useEffect } from 'react';
import { scoreColor, scoreLabel, BREAKDOWN_LABELS } from './score-utils.js';
import { findCatalogEntry } from '../../core/catalog.js';
import { getInstallRec } from '../utils/preset-helpers.js';
import { CC, CL } from '../utils/ui-constants.js';

function ScoreWithBreakdown({ score, breakdown, size }) {
  const [open, setOpen] = useState(false);
  const sz = size || 11;
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('click', h, true);
    return () => document.removeEventListener('click', h, true);
  }, [open]);
  if (!breakdown) return <span style={{ fontFamily: 'var(--font-mono)', fontSize: sz, fontWeight: 800, color: scoreColor(score) }}>{score}%</span>;
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <span onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        style={{ fontFamily: 'var(--font-mono)', fontSize: sz, fontWeight: 800, color: scoreColor(score), cursor: 'pointer', textDecoration: 'underline dotted' }}>
        {score}% · {scoreLabel(score).t}
      </span>
      {open && (
        <div style={{ position: 'absolute', bottom: '120%', left: 0, zIndex: 999, background: 'var(--bg-card)', border: '1px solid var(--a12)', borderRadius: 'var(--r-md)', padding: '8px 10px', fontSize: 10, whiteSpace: 'nowrap', boxShadow: 'var(--shadow-md)', minWidth: 160 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Décomposition</div>
          {Object.entries(breakdown).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: v.raw === null ? 'var(--text-dim)' : 'var(--text-sec)', marginBottom: 2 }}>
              <span>{BREAKDOWN_LABELS[k] || k}</span>
              {v.raw !== null
                ? <span><b style={{ color: scoreColor(v.raw) }}>{v.raw}</b> x{v.weight}% = <b>{v.contribution}</b></span>
                : <span style={{ fontStyle: 'italic' }}>—</span>}
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--a8)', marginTop: 4, paddingTop: 4, fontWeight: 700, color: scoreColor(score), textAlign: 'right' }}>Total : {score}%</div>
        </div>
      )}
    </span>
  );
}

function PBlock({ device, emoji, presetName, gType, banks, adapted, gs, bg2, availableSources, guitarId, noUpgrade, finalScore, breakdown }) {
  const rec = presetName && gType ? getInstallRec(presetName, gType, banks || {}, guitarId) : null;
  const entry = findCatalogEntry(presetName);
  const srcAvail = !entry || !availableSources || availableSources[entry.src] !== false;
  const best = noUpgrade ? null : rec?.upgrade;
  const showBest = best && !best.isCurrent && best.installed;
  const displayName = showBest ? best.name : presetName;
  const displayRec = showBest ? { ...rec, score: best.score, installed: true, bank: best.bank, slot: best.slot } : rec;
  const sc = finalScore != null ? finalScore : displayRec?.score;
  const scC = sc != null ? scoreColor(sc) : 'var(--text-tertiary)';
  return (
    <div style={{ background: bg2 || 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: '10px 12px', opacity: srcAvail ? 1 : 0.5 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>{emoji} {device}</span>
        {!srcAvail && <span style={{ fontSize: 9, color: 'var(--red)' }}>Source non dispo</span>}
        {sc != null && (breakdown ? <ScoreWithBreakdown score={sc} breakdown={breakdown}/> : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800, color: scC }} title={scoreLabel(sc).tip}>{sc}% · {scoreLabel(sc).t}</span>)}
      </div>
      {displayRec ? (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-bright)', fontWeight: 600, marginBottom: 4 }}>{displayName}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            {displayRec.installed
              ? <span title={`Slot ${displayRec.slot} — ${CL[displayRec.slot]}`} style={{ background: `${CC[displayRec.slot]}18`, color: CC[displayRec.slot], border: `1px solid ${CC[displayRec.slot]}40`, borderRadius: 'var(--r-sm)', padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>Banque {displayRec.bank}{displayRec.slot}</span>
              : <><span style={{ fontSize: 10, color: 'var(--yellow)', fontWeight: 700 }}>⬇ À installer</span>{entry?.src === 'TSR' && entry.pack && <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>📦 {entry.pack}.zip</span>}</>
            }
            {showBest && <span style={{ fontSize: 9, color: 'var(--green)', fontWeight: 600 }}>↑ meilleur choix</span>}
            {best && best.isCurrent && <span style={{ fontSize: 9, color: 'var(--green)', fontWeight: 600 }}>★ top dispo</span>}
            {adapted && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>✦ adapté {gs}</span>}
          </div>
          {!displayRec.installed && displayRec.replaceBank != null && (
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>
              → Remplace {displayRec.replaceBank}{displayRec.replaceSlot}
              {displayRec.replaceName && <> ({displayRec.replaceName}{displayRec.replaceScore != null && <span style={{ color: scoreColor(displayRec.replaceScore) }}> {displayRec.replaceScore}%</span>})</>}
            </div>
          )}
          {best && !best.isCurrent && !best.installed && (
            <div style={{ marginTop: 5, fontSize: 10, color: 'var(--text-sec)', background: 'var(--a3)', borderRadius: 'var(--r-md)', padding: '5px 8px' }}>
              <span style={{ color: 'var(--green)', fontWeight: 600 }}>↑ Meilleur dispo :</span> {best.name} <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: scoreColor(best.score) }}>{best.score}%</span> <span style={{ color: 'var(--yellow)' }}>⬇ à installer</span>
            </div>
          )}
        </>
      ) : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sélectionne une guitare.</div>}
    </div>
  );
}

export default PBlock;
export { PBlock, ScoreWithBreakdown };

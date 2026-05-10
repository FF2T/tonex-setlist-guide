// src/devices/tonemaster-pro/RecommendBlock.jsx — Phase 3.
// Composant React qui rend la recommandation TMP pour un morceau donné.
//
// Compact (1 ligne) : icon 🎚️ + nom du patch + chain summary + score%.
// Drawer expandable au tap : un sous-bloc par bloc présent dans le
// patch (model + paramètres clés), notes, style/gain, usages.
//
// Props : { song, guitar, profile, allGuitars }.
// Pas de side-effects ni de state global — la recommandation est
// recalculée à la volée via useMemo.

import React, { useMemo, useState } from 'react';
import { recommendTMPPatch } from './scoring.js';
import { TMP_FACTORY_PATCHES, TONEMASTER_PRO_CATALOG } from './catalog.js';
import { getPatchBlocks, RENDER_ORDER } from './chain-model.js';
import { AMP_SCALE_BY_MODEL, DEFAULT_AMP_SCALE } from './whitelist.js';

// Génère un résumé compact de la chaîne d'un patch (ex.
// "Plexi · 4x12 Greenback · +Drive · Spring").
function summarizeChain(patch) {
  if (!patch) return '';
  const parts = [];
  if (patch.amp?.model) {
    // Raccourci : on garde le keyword distinctif du model.
    const m = patch.amp.model;
    const tokens = m.split(/\s+/);
    const last = tokens[tokens.length - 1];
    parts.push(last);
  }
  if (patch.cab?.model) {
    const cabShort = patch.cab.model.replace(/^[0-9]+x[0-9]+\s*/, '').split(/\s+/)[0] || patch.cab.model;
    parts.push(cabShort);
  }
  if (patch.drive?.enabled) parts.push('+Drive');
  if (patch.mod?.enabled) parts.push('+Mod');
  if (patch.delay?.enabled) parts.push('+Delay');
  if (patch.reverb?.enabled) {
    const r = patch.reverb.model;
    parts.push(r === 'Spring' ? 'Spring' : `+${r}`);
  }
  return parts.join(' · ');
}

// Ordre d'affichage préféré des paramètres par type de bloc.
// Aligné sur l'ordre des knobs sur la face avant des pédales/amps
// pour que la lecture suive le geste d'un guitariste qui regarde sa
// chaîne.
const PARAM_ORDER_BY_SLOT = {
  cab: ['mic', 'axis', 'distance', 'low_cut', 'high_cut'],
  amp: ['gain', 'volume_i', 'volume_ii', 'bright', 'treble', 'middle', 'mid', 'bass', 'presence'],
  drive: ['drive', 'tone', 'level', 'presence', 'mix'],
  comp: ['threshold', 'ratio', 'attack', 'release', 'level', 'knee', 'blend'],
  eq: ['low_freq', 'low_gain', 'mid_freq', 'mid_gain', 'hi_gain'],
  delay: ['time', 'feedback', 'mix', 'hi_cut', 'low_cut'],
  reverb: ['mixer', 'dwell', 'tone', 'predelay', 'hi_cut', 'low_cut'],
  mod: ['rate', 'depth', 'mix', 'feedback', 'type'],
  noise_gate: ['threshold', 'attenuation'],
};

// Top paramètres "lisibles" d'un bloc, pour affichage dans le drawer.
// Suit PARAM_ORDER_BY_SLOT, fallback sur les 5 premiers du params si
// le slot n'est pas connu.
function pickTopParams(block, slot) {
  if (!block?.params) return [];
  const entries = Object.entries(block.params);
  const order = PARAM_ORDER_BY_SLOT[slot];
  if (order) {
    const orderedKeys = order.filter((k) => k in block.params);
    const remaining = entries.map(([k]) => k).filter((k) => !orderedKeys.includes(k));
    return [...orderedKeys, ...remaining].map((k) => [k, block.params[k]]);
  }
  return entries.slice(0, 5);
}

// ─── Helpers de formatage ────────────────────────────────────────────

// Cuts Hz/kHz partagés entre cab, delay, reverb (même sémantique :
// extrémités = filtre OFF, sinon valeur explicite Hz ou kHz).
function formatHzCut(kind, v) {
  // kind = 'low_cut' | 'high_cut' | 'hi_cut'
  const isHigh = kind === 'high_cut' || kind === 'hi_cut';
  const label = isHigh ? 'Filtre passe-bas' : 'Filtre passe-haut';
  const n = Number(v);
  if (!Number.isFinite(n)) return `${label} : ${v}`;
  // Extrémités firmware = filtre OFF (20 Hz pour low cut, 20 kHz pour high cut).
  if (!isHigh && n === 20) return `${label} 20 Hz (off)`;
  if (isHigh && n === 20000) return `${label} 20 kHz (off)`;
  if (n >= 1000) return `${label} : ${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)} kHz`;
  return `${label} : ${n} Hz`;
}

// Capitalize first letter — utilisé pour fallback labels.
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// Labels firmware-exact (terminologie qui apparaît physiquement sur
// les pédales TMP / amps). On NE traduit PAS ces noms en français —
// l'utilisateur les retrouve tels quels sur sa chaîne.
const AMP_KNOB_LABELS = {
  gain: 'Gain',
  volume_i: 'Volume I',
  volume_ii: 'Volume II',
  bright: 'Bright',
  treble: 'Treble',
  middle: 'Middle',
  mid: 'Mid',
  bass: 'Bass',
  presence: 'Presence',
};
const DRIVE_KNOB_LABELS = {
  drive: 'Drive', tone: 'Tone', level: 'Level', presence: 'Presence', mix: 'Mix',
};
const COMP_KNOB_LABELS = {
  threshold: 'Threshold', attack: 'Attack', release: 'Release',
  level: 'Level', knee: 'Knee', blend: 'Blend',
};
const REVERB_KNOB_LABELS = { mixer: 'Mixer', dwell: 'Dwell', tone: 'Tone' };
const NOISE_GATE_LABELS = { threshold: 'Threshold', attenuation: 'Attenuation' };

// FIX 3 Phase 3.5 (Phase 3.6 généralisé) — Traduit un param cryptique
// du firmware TMP en libellé lisible. Garde la terminologie EXACTE des
// knobs ("Volume I", "Treble", "Threshold"…) telle qu'elle apparaît
// sur les pédales/amps, et AJOUTE les unités/échelles qui ne sont PAS
// visibles physiquement (".../10", "X ms", "X Hz", "X dB", ...).
//
// Cas "off" / "neutre" : si une valeur correspond au défaut bypass
// (low_cut=20 Hz, high_cut=20 kHz), suffixer "(off)".
//
// Signature : formatBlockParam(blockType, paramKey, value, blockModel?).
// blockModel sert à choisir l'échelle ampli (cf AMP_SCALE_BY_MODEL :
// '59 Bassman et tweeds → /12, sinon /10).
function formatBlockParam(blockType, k, v, blockModel) {
  if (blockType === 'cab') return formatCabParam(k, v);

  if (blockType === 'amp') {
    const scale = (blockModel && AMP_SCALE_BY_MODEL[blockModel]) || DEFAULT_AMP_SCALE;
    const label = AMP_KNOB_LABELS[k] || cap(k);
    return `${label} : ${v}/${scale}`;
  }

  if (blockType === 'drive') {
    const label = DRIVE_KNOB_LABELS[k] || cap(k);
    return `${label} : ${v}/10`;
  }

  if (blockType === 'comp') {
    if (k === 'ratio') return `Ratio : ${v}:1`;
    const label = COMP_KNOB_LABELS[k] || cap(k);
    return `${label} : ${v}/10`;
  }

  if (blockType === 'eq') {
    if (k === 'low_freq' || k === 'mid_freq') {
      const lbl = k === 'low_freq' ? 'Low Freq' : 'Mid Freq';
      const n = Number(v);
      if (Number.isFinite(n) && n >= 1000) return `${lbl} : ${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 2)} kHz`;
      return `${lbl} : ${v} Hz`;
    }
    if (k === 'low_gain' || k === 'mid_gain' || k === 'hi_gain') {
      const lbl = k === 'low_gain' ? 'Low Gain' : k === 'mid_gain' ? 'Mid Gain' : 'Hi Gain';
      const n = Number(v);
      // Convention EQ-5 firmware : low_gain à -12 dB déclenche le mode
      // passe-haut 6 dB/Oct (cf patches Arthur : EQ low_gain=-12).
      if (k === 'low_gain' && Number.isFinite(n) && n <= -12) {
        return `${lbl} : ${n} dB (mode passe-haut 6 dB/Oct)`;
      }
      const sign = Number.isFinite(n) && n > 0 ? '+' : '';
      return `${lbl} : ${sign}${v} dB`;
    }
    return `${cap(k)} : ${v}`;
  }

  if (blockType === 'delay') {
    if (k === 'time') return `Time : ${v} ms`;
    if (k === 'feedback') return `Feedback : ${v} %`;
    if (k === 'mix') return `Mix : ${v} %`;
    if (k === 'low_cut' || k === 'hi_cut' || k === 'high_cut') return formatHzCut(k, v);
    return `${cap(k)} : ${v}`;
  }

  if (blockType === 'reverb') {
    if (k === 'predelay') return `Predelay : ${v} ms`;
    if (k === 'low_cut' || k === 'hi_cut' || k === 'high_cut') return formatHzCut(k, v);
    if (REVERB_KNOB_LABELS[k]) return `${REVERB_KNOB_LABELS[k]} : ${v}/10`;
    return `${cap(k)} : ${v}`;
  }

  if (blockType === 'noise_gate') {
    const label = NOISE_GATE_LABELS[k] || cap(k);
    return `${label} : ${v}/10`;
  }

  if (blockType === 'mod') {
    // Mod : pas de scale fixe (rate Hz, depth %, mix %, type string…).
    if (k === 'rate') return `Rate : ${v} Hz`;
    if (k === 'depth' || k === 'mix' || k === 'feedback') return `${cap(k)} : ${v} %`;
    if (k === 'type') return `Type : ${v}`;
    return `${cap(k)} : ${v}`;
  }

  // Fallback générique.
  return `${k} : ${v}`;
}

// Cab params : labels FR explicites (axis on/off, distance pouces+cm,
// cuts Hz). Garde son helper dédié car la sémantique micro est
// spécifique (axe, distance physique).
function formatCabParam(k, v) {
  if (k === 'mic') return `Micro : ${v}`;
  if (k === 'axis') {
    if (v === 'on' || v === true) return 'Micro en plein cône (axis on)';
    if (v === 'off' || v === false) return 'Micro décalé (off-axis)';
    return `Axe micro : ${v}`;
  }
  if (k === 'distance') {
    const n = Number(v);
    if (!Number.isFinite(n)) return `Distance micro : ${v}`;
    // Arrondi au demi-cm pour rester lisible (3" → 7.5 cm, 6" → 15 cm).
    const cmHalf = Math.round(n * 2.54 * 2) / 2;
    const cmStr = cmHalf % 1 === 0 ? String(cmHalf) : cmHalf.toFixed(1);
    return `Micro à ${n} pouce${n > 1 ? 's' : ''} (~${cmStr} cm)`;
  }
  if (k === 'low_cut' || k === 'high_cut' || k === 'hi_cut') return formatHzCut(k, v);
  return `${k} : ${v}`;
}

function TMPRecommendBlock({ song, guitar, profile, precomputedTopRec, _allGuitars }) {
  const [expanded, setExpanded] = useState(false);
  // Phase 3.10 perf — Deux optimisations :
  // 1) On retire `profile` des deps useMemo : recommendTMPPatch reçoit
  //    le param mais il est marqué `_profile` (inutilisé). Garder profile
  //    dans les deps invalide la cache à chaque changement de référence
  //    profile (Firestore poll, setProfileField, ensureProfilesV4 …),
  //    forçant 129 × recommendTMPPatch sur chaque re-render au lieu d'un
  //    re-render réellement pertinent.
  // 2) Si le caller a précalculé le top rec au niveau de l'écran (un
  //    useMemo unique pour tous les morceaux), on l'utilise tel quel.
  //    Évite les 129 useMemo invalidations indépendantes au premier
  //    rendu de Setlists avec une grosse base de morceaux.
  const recs = useMemo(() => {
    if (precomputedTopRec) return [precomputedTopRec];
    return recommendTMPPatch(TMP_FACTORY_PATCHES, song, guitar, profile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song, guitar, precomputedTopRec]);
  const top = recs[0];
  if (!top) return null;
  const { patch, score, usagesBonus: bonus } = top;
  const chain = summarizeChain(patch);
  const blocks = getPatchBlocks(patch);
  const color = TONEMASTER_PRO_CATALOG.deviceColor;
  const icon = TONEMASTER_PRO_CATALOG.icon;

  return (
    <div
      data-testid="tmp-recommend-block"
      data-tmp-patch-id={patch.id}
      data-device-id="tonemaster-pro"
      style={{
        display: 'flex', flexDirection: 'column',
        background: 'var(--a3)',
        border: '1px solid var(--a8)',
        borderRadius: 'var(--r-md)',
        marginTop: 4,
        overflow: 'hidden',
      }}
    >
      {/* Compact 1-ligne (toujours visible) */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', cursor: 'pointer',
          background: 'transparent', border: 'none',
          width: '100%', textAlign: 'left', fontSize: 11,
        }}
      >
        <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
        <span
          style={{
            color, fontWeight: 700, flexShrink: 0,
            background: `${color}18`, border: `1px solid ${color}40`,
            borderRadius: 'var(--r-sm)', padding: '1px 6px',
          }}
        >
          {patch.name}
        </span>
        <span
          style={{
            color: 'var(--text-sec)', flex: 1, minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {chain}
        </span>
        {bonus > 0 && (
          <span
            style={{
              fontSize: 9, color: 'var(--text-tertiary)', flexShrink: 0,
              fontStyle: 'italic',
            }}
            title="Patch explicitement listé pour ce morceau dans usages"
          >
            ✓ usage
          </span>
        )}
        <span
          style={{
            fontFamily: 'var(--font-mono)', fontWeight: 800, color,
            flexShrink: 0,
          }}
        >
          {score}%
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Drawer expanded */}
      {expanded && (
        <div style={{ padding: '8px 10px 10px', borderTop: '1px solid var(--a6)' }}>
          {patch.notes && (
            <div
              style={{
                fontSize: 10, fontStyle: 'italic',
                color: 'var(--text-sec)', marginBottom: 6,
              }}
            >
              {patch.notes}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
            {blocks.map(({ slot, ...block }) => {
              const params = pickTopParams(block, slot);
              return (
                <div
                  key={slot}
                  data-testid={`tmp-block-${slot}`}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 6,
                    fontSize: 10, lineHeight: 1.4,
                  }}
                >
                  <span
                    style={{
                      color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
                      textTransform: 'uppercase', flexShrink: 0,
                      minWidth: 60, fontSize: 9,
                    }}
                  >
                    {slot}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--text-bright)', fontWeight: 600 }}>
                      {block.model}
                    </div>
                    <div
                      style={{
                        color: 'var(--text-tertiary)', fontSize: 10,
                        marginTop: 2, display: 'flex', flexDirection: 'column',
                        gap: 1,
                      }}
                    >
                      {params.map(([k, v]) => (
                        <div key={k}>{formatBlockParam(slot, k, v, block.model)}</div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div
            style={{
              display: 'flex', gap: 6, flexWrap: 'wrap',
              fontSize: 9, color: 'var(--text-tertiary)',
              borderTop: '1px solid var(--a6)', paddingTop: 6,
            }}
          >
            <span>
              <b style={{ color: 'var(--text-muted)' }}>Style</b> {patch.style}
            </span>
            <span>
              <b style={{ color: 'var(--text-muted)' }}>Gain</b> {patch.gain}
            </span>
            <span>
              <b style={{ color: 'var(--text-muted)' }}>Pickup</b> HB:
              {patch.pickupAffinity?.HB} · SC:{patch.pickupAffinity?.SC} · P90:
              {patch.pickupAffinity?.P90}
            </span>
          </div>
          {/* Phase 3.8 — Conseil de jeu spécifique au morceau courant
              (champ patch.playingTipsBySong[song.id]). Affiché en
              encart visible (pas en italic 9px comme les usages) car
              c'est une info actionnable que le guitariste doit voir
              en jouant. */}
          {song?.id && patch.playingTipsBySong && patch.playingTipsBySong[song.id] && (
            <div
              data-testid="tmp-playing-tip"
              style={{
                marginTop: 6,
                background: `${color}10`,
                border: `1px solid ${color}30`,
                borderRadius: 'var(--r-sm)',
                padding: '5px 8px',
                fontSize: 10,
                color: 'var(--text-sec)',
                lineHeight: 1.4,
              }}
            >
              <span style={{ color, fontWeight: 700, marginRight: 4 }}>💡 Conseil pour ce morceau</span>
              <span>{patch.playingTipsBySong[song.id]}</span>
            </div>
          )}
          {Array.isArray(patch.usages) && patch.usages.length > 0 && (
            <div
              style={{
                fontSize: 9, color: 'var(--text-tertiary)',
                marginTop: 4, fontStyle: 'italic',
              }}
            >
              <b style={{ color: 'var(--text-muted)' }}>Usages</b>{' '}
              {patch.usages.map((u) => u.artist).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Référence à RENDER_ORDER pour s'assurer qu'il est consommé (évite que
// l'import soit lazy-removed par esbuild).
TMPRecommendBlock._RENDER_ORDER = RENDER_ORDER;

export default TMPRecommendBlock;
export {
  summarizeChain, pickTopParams,
  formatCabParam, formatBlockParam, formatHzCut,
  PARAM_ORDER_BY_SLOT,
};

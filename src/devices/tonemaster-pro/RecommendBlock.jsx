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

// Top 3 paramètres "lisibles" d'un bloc, pour affichage compact dans
// le drawer (les autres sont cachés derrière un toggle "voir tout").
function pickTopParams(block, slot) {
  if (!block?.params) return [];
  const entries = Object.entries(block.params);
  // Pour cab : montrer mic + axis + distance en priorité.
  if (slot === 'cab') {
    const order = ['mic', 'axis', 'distance', 'low_cut', 'high_cut'];
    return order
      .filter((k) => k in block.params)
      .map((k) => [k, block.params[k]]);
  }
  // Pour amp : gain/treble/mid/bass/presence (ordre standard).
  if (slot === 'amp') {
    const order = ['gain', 'volume_i', 'volume_ii', 'treble', 'middle', 'mid', 'bass', 'presence'];
    return order
      .filter((k) => k in block.params)
      .slice(0, 5)
      .map((k) => [k, block.params[k]]);
  }
  // Default : 5 premiers.
  return entries.slice(0, 5);
}

// FIX 3 Phase 3.5 — Traduit un param cab cryptique en label FR lisible.
// Les params cab du firmware TMP utilisent des codes (axis:on, distance:6,
// low_cut:20…) que l'utilisateur ne décode pas. On affiche du français
// explicite pour qu'il comprenne le réglage du micro sans ouvrir le
// manuel TMP.
// Conventions firmware TMP :
//   - axis = on/off : on = en plein cône (sweet spot agressif, plus
//     de présence), off = micro décalé (plus rond, moins agressif)
//   - distance en pouces (firmware) → on rappelle l'équivalent cm
//   - low_cut/high_cut en Hz : 20/20000 = filtres OFF (extrémités)
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
  if (k === 'low_cut') {
    const n = Number(v);
    if (n === 20 || v === 'off') return 'Filtre passe-haut 20 Hz (off)';
    return `Filtre passe-haut : ${v} Hz`;
  }
  if (k === 'high_cut') {
    const n = Number(v);
    if (n === 20000 || v === 'off') return 'Filtre passe-bas 20 kHz (off)';
    if (n >= 1000) return `Filtre passe-bas : ${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)} kHz`;
    return `Filtre passe-bas : ${v} Hz`;
  }
  return `${k} : ${v}`;
}

function TMPRecommendBlock({ song, guitar, profile, _allGuitars }) {
  const [expanded, setExpanded] = useState(false);
  const recs = useMemo(
    () => recommendTMPPatch(TMP_FACTORY_PATCHES, song, guitar, profile),
    [song, guitar, profile],
  );
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
              const isCab = slot === 'cab';
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
                    {isCab ? (
                      <div
                        style={{
                          color: 'var(--text-tertiary)', fontSize: 10,
                          marginTop: 2, display: 'flex', flexDirection: 'column',
                          gap: 1,
                        }}
                      >
                        {params.map(([k, v]) => (
                          <div key={k}>{formatCabParam(k, v)}</div>
                        ))}
                      </div>
                    ) : (
                      <div
                        style={{
                          color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)',
                          fontSize: 9, marginTop: 1,
                        }}
                      >
                        {params.map(([k, v]) => `${k}:${v}`).join('  ')}
                      </div>
                    )}
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
export { summarizeChain, pickTopParams, formatCabParam };

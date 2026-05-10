// src/devices/tonemaster-pro/LiveBlock.jsx — Phase 4.
// Composant rendu en plein écran (mode scène) par LiveScreen pour le
// device Tone Master Pro.
//
// Affiche, lisible à 2m sur iPad :
// - Nom du patch recommandé en grand.
// - Scenes du patch en badges horizontaux ; click sélectionne une
//   scene active (state local). Scene active surlignée + badge
//   "Amp Lvl ##" si ampLevelOverride.
// - 4 cards FS1-FS4 avec l'action mappée par le footswitchMap, scene
//   active mise en évidence.

import React, { useMemo, useState } from 'react';
import { recommendTMPPatch } from './scoring.js';
import { TMP_FACTORY_PATCHES, TONEMASTER_PRO_CATALOG } from './catalog.js';
import { applyScene, FS_KEYS } from './chain-model.js';

const TOGGLE_LABEL = {
  drive: 'Drive',
  delay: 'Delay',
  reverb: 'Reverb',
  mod: 'Mod',
  comp: 'Comp',
  noise_gate: 'Noise Gate',
  eq: 'EQ',
};

function fsActionLabel(entry, scenes) {
  if (!entry) return '—';
  if (entry.type === 'scene') {
    const sc = scenes.find((s) => s.id === entry.sceneId);
    return sc ? sc.name : entry.sceneId;
  }
  if (entry.type === 'toggle') return `Toggle ${TOGGLE_LABEL[entry.block] || entry.block}`;
  if (entry.type === 'tap_tempo') return 'Tap Tempo';
  return '—';
}

// Phase 4 — applique les overrides factoryOverrides sur un patch (idem
// RecommendBlock.applyPatchOverrides pour cohérence).
function applyPatchOverrides(patch, overrides) {
  if (!patch || !overrides) return patch;
  const out = { ...patch };
  if (overrides.scenes !== undefined) out.scenes = overrides.scenes;
  if (overrides.footswitchMap !== undefined) out.footswitchMap = overrides.footswitchMap;
  return out;
}

function TMPLiveBlock({ song, guitar, profile, allGuitars, _banksAnn, _banksPlug }) {
  const recs = useMemo(
    () => recommendTMPPatch(TMP_FACTORY_PATCHES, song, guitar, profile),
    [song, guitar, profile],
  );
  const top = recs[0];
  // Phase 4 — applique les overrides du profil (scenes/footswitchMap
  // édités par l'utilisateur) sur le patch factory.
  const overrides = profile?.tmpPatches?.factoryOverrides?.[top?.patch?.id];
  const patch = top ? applyPatchOverrides(top.patch, overrides) : null;
  const scenes = patch?.scenes || [];
  const footswitchMap = patch?.footswitchMap || {};
  const color = TONEMASTER_PRO_CATALOG.deviceColor;
  const icon = TONEMASTER_PRO_CATALOG.icon;

  // Scene active : si le footswitchMap définit FS1 sur une scene, on
  // l'utilise comme défaut "rythme" (FS1 = scene de base par convention
  // CLAUDE.md). Sinon, première scene.
  const defaultSceneId = useMemo(() => {
    if (footswitchMap.fs1?.type === 'scene') return footswitchMap.fs1.sceneId;
    return scenes[0]?.id || null;
  }, [footswitchMap, scenes]);
  const [activeSceneId, setActiveSceneId] = useState(defaultSceneId);
  // Réinitialiser activeSceneId si on change de morceau (donc de patch).
  // useMemo + useState pattern : on track patch.id et reset le state local
  // si différent.
  React.useEffect(() => { setActiveSceneId(defaultSceneId); }, [patch?.id, defaultSceneId]);

  const resolvedPatch = activeSceneId ? applyScene(patch, activeSceneId) : patch;

  if (!patch) {
    return (
      <div
        data-testid="tmp-live-block-empty"
        style={{
          padding: 16, textAlign: 'center',
          color: 'var(--text-dim)', fontStyle: 'italic',
        }}
      >
        Pas de patch TMP recommandé.
      </div>
    );
  }

  return (
    <div
      data-testid="tmp-live-block"
      data-tmp-patch-id={patch.id}
      data-active-scene-id={activeSceneId || ''}
      style={{
        background: 'var(--a3)',
        border: `1px solid ${color}40`,
        borderRadius: 'var(--r-lg)',
        padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
    >
      {/* Header device + patch name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {TONEMASTER_PRO_CATALOG.label}
          </div>
          <div
            style={{
              fontSize: 26, fontWeight: 800, color: 'var(--text-bright)',
              fontFamily: 'var(--font-display)', lineHeight: 1.1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {patch.name}
          </div>
        </div>
        {typeof resolvedPatch?._ampLevel === 'number' && (
          <div
            data-testid="tmp-live-amp-level"
            style={{
              fontFamily: 'var(--font-mono)', fontWeight: 800,
              fontSize: 22, color,
              background: `${color}18`, border: `1px solid ${color}40`,
              borderRadius: 'var(--r-md)', padding: '4px 10px',
            }}
          >
            {resolvedPatch._ampLevel}%
          </div>
        )}
      </div>

      {/* Scenes — badges */}
      {scenes.length > 0 && (
        <div data-testid="tmp-live-scenes">
          <div
            style={{
              fontSize: 9, color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
              letterSpacing: 0.5, marginBottom: 4,
            }}
          >
            Scenes
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {scenes.map((sc) => {
              const active = sc.id === activeSceneId;
              return (
                <button
                  key={sc.id}
                  type="button"
                  data-testid={`tmp-live-scene-${sc.id}`}
                  data-active={active ? 'true' : 'false'}
                  onClick={() => setActiveSceneId(sc.id)}
                  style={{
                    background: active ? color : 'var(--a5)',
                    color: active ? 'var(--tolex-900)' : 'var(--text)',
                    border: `1px solid ${active ? color : 'var(--a8)'}`,
                    borderRadius: 'var(--r-md)',
                    padding: '8px 14px',
                    fontSize: 16, fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: active ? 'var(--shadow-sm)' : 'none',
                  }}
                >
                  {sc.name}
                  {typeof sc.ampLevelOverride === 'number' && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 11, fontWeight: 600,
                        opacity: 0.85,
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {sc.ampLevelOverride}%
                    </span>
                  )}
                  {/* Phase 5 (Item I) — badge "ovr" si la scene a des
                      paramOverrides actifs (utile au guitariste qui
                      veut savoir qu'il y a des changements fins
                      au-delà du simple Amp Level). */}
                  {sc.paramOverrides && Object.keys(sc.paramOverrides).length > 0 && (
                    <span
                      data-testid={`tmp-live-scene-${sc.id}-ovr`}
                      style={{
                        marginLeft: 6,
                        fontSize: 9, fontWeight: 700,
                        opacity: 0.85,
                        background: active ? 'rgba(0,0,0,0.15)' : 'var(--a8)',
                        borderRadius: 'var(--r-sm)',
                        padding: '1px 5px',
                      }}
                      title="paramOverrides actifs sur cette scene"
                    >
                      ovr
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Footswitches — 4 cards */}
      <div data-testid="tmp-live-footswitches">
        <div
          style={{
            fontSize: 9, color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
            letterSpacing: 0.5, marginBottom: 4,
          }}
        >
          Footswitches
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
          }}
        >
          {FS_KEYS.map((k) => {
            const entry = footswitchMap[k];
            const isActive = entry?.type === 'scene' && entry.sceneId === activeSceneId;
            return (
              <div
                key={k}
                data-testid={`tmp-live-fs-${k}`}
                data-active={isActive ? 'true' : 'false'}
                style={{
                  background: isActive ? `${color}25` : 'var(--a5)',
                  border: `1px solid ${isActive ? color : 'var(--a8)'}`,
                  borderRadius: 'var(--r-md)',
                  padding: '10px 8px',
                  textAlign: 'center',
                  display: 'flex', flexDirection: 'column', gap: 4,
                  minHeight: 64,
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800, fontSize: 14,
                    color: isActive ? color : 'var(--text-muted)',
                  }}
                >
                  {k.toUpperCase()}
                </div>
                <div
                  style={{
                    fontSize: 13, fontWeight: 600,
                    color: entry ? 'var(--text-bright)' : 'var(--text-dim)',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {fsActionLabel(entry, scenes)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default TMPLiveBlock;
export { fsActionLabel };

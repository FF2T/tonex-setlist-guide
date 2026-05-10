// src/devices/tonemaster-pro/ScenesEditor.jsx — Phase 4 + Phase 5 (Item I).
// Éditeur compact de Scenes + footswitchMap pour un patch TMP.
//
// Intégré dans le drawer du RecommendBlock TMP. Les modifications sont
// remontées au parent via deux callbacks `onScenesChange` et
// `onFootswitchChange`. Le parent décide où stocker (factoryOverrides
// pour les patches factory, profile.tmpPatches.custom pour les patches
// user-créés).
//
// Mode read-only si aucun callback n'est fourni : l'éditeur affiche
// les scenes/footswitch existants sans permettre d'édition.
//
// Édition supportée Phase 4 + Phase 5 :
// - Renommer une scene (name).
// - Modifier ampLevelOverride (slider 0-100, vide = supprimé).
// - Toggles blocs drive / delay / reverb / mod (blockToggles entries).
// - Ajouter / supprimer une scene.
// - Configurer FS1-FS4 via dropdown :
//     - Scene → un des sceneIds du patch
//     - Toggle Drive/Delay/Reverb/Mod
//     - Tap Tempo
//     - Aucun (reset)
// - **paramOverrides** (Phase 5 Item I) : sous-section collapsable
//   "▼ Paramètres avancés" par scene. Power users la déplient pour
//   ajouter/supprimer des overrides fins (ex. drive.drive=5 dans la
//   scene Solo override le drive du patch parent). Mini-form inline :
//   bloc + paramKey + value. Mode read-only montre les overrides
//   sans permettre d'édition.

import React, { useState } from 'react';
import { TOGGLE_BLOCKS, FS_KEYS } from './chain-model.js';

const TOGGLE_BLOCK_LABELS = {
  drive: 'Drive',
  delay: 'Delay',
  reverb: 'Reverb',
  mod: 'Mod',
  comp: 'Comp',
  noise_gate: 'NG',
  eq: 'EQ',
};

// Génère un id court unique parmi `existingIds`.
function nextSceneId(existingIds) {
  for (let i = 1; i < 100; i++) {
    const candidate = `scene${i}`;
    if (!existingIds.includes(candidate)) return candidate;
  }
  return `scene_${Date.now()}`;
}

function FsOption({ value }) {
  // value = string serialized form ; affichage user-friendly géré dans <option>
  return value;
}

// Sérialise une entrée fs en string pour la comparer aux options.
// Ex: scene:rythme, toggle:drive, tap_tempo, '' (vide).
function serializeFs(entry) {
  if (!entry) return '';
  if (entry.type === 'scene') return `scene:${entry.sceneId}`;
  if (entry.type === 'toggle') return `toggle:${entry.block}`;
  if (entry.type === 'tap_tempo') return 'tap_tempo';
  return '';
}

function deserializeFs(value) {
  if (!value) return undefined;
  if (value.startsWith('scene:')) return { type: 'scene', sceneId: value.slice(6) };
  if (value.startsWith('toggle:')) return { type: 'toggle', block: value.slice(7) };
  if (value === 'tap_tempo') return { type: 'tap_tempo' };
  return undefined;
}

function ScenesEditor({
  patch,
  onScenesChange,
  onFootswitchChange,
  color = 'var(--accent)',
}) {
  const readOnly = typeof onScenesChange !== 'function' && typeof onFootswitchChange !== 'function';
  const scenes = Array.isArray(patch?.scenes) ? patch.scenes : [];
  const footswitchMap = patch?.footswitchMap || {};
  const sceneIds = scenes.map((s) => s.id);

  // Liste des blocs présents dans le patch et toggleables (pour
  // dropdown FS et toggles scene). On filtre les blocs qui ne sont pas
  // dans le patch (inutile de proposer "toggle drive" s'il n'y a pas
  // de drive dans la chaîne).
  const togglablePresent = TOGGLE_BLOCKS.filter((b) => !!patch?.[b]);

  // Phase 5 (Item I) — Liste de TOUS les blocs présents dans le patch
  // (incluant amp et cab, qui sont éligibles aux paramOverrides même
  // s'ils ne sont pas toggleables). Utilisé par l'éditeur de
  // paramOverrides.
  const allBlocksPresent = ['noise_gate', 'comp', 'eq', 'drive', 'amp', 'cab', 'mod', 'delay', 'reverb']
    .filter((b) => !!patch?.[b]);

  // Phase 5 (Item I) — index de la scene actuellement dépliée pour
  // l'éditeur "Paramètres avancés". null = toutes repliées.
  const [expandedAdvIdx, setExpandedAdvIdx] = useState(null);
  // Mini-form state pour "+ Override paramètre" (par scene index).
  const [advForm, setAdvForm] = useState({ block: '', key: '', value: '' });

  // ─── Mutations scenes ────────────────────────────────────────────
  const updateScene = (idx, partial) => {
    if (readOnly) return;
    const next = scenes.map((s, i) => (i === idx ? { ...s, ...partial } : s));
    onScenesChange(next);
  };

  const addScene = () => {
    if (readOnly) return;
    const id = nextSceneId(sceneIds);
    const next = [...scenes, { id, name: `Scene ${scenes.length + 1}` }];
    onScenesChange(next);
  };

  const removeScene = (idx) => {
    if (readOnly) return;
    const removed = scenes[idx];
    const next = scenes.filter((_, i) => i !== idx);
    onScenesChange(next);
    // Nettoyer les FS qui pointaient sur cette scene.
    if (removed && typeof onFootswitchChange === 'function') {
      const fsNext = { ...footswitchMap };
      let changed = false;
      for (const k of FS_KEYS) {
        if (fsNext[k]?.type === 'scene' && fsNext[k].sceneId === removed.id) {
          delete fsNext[k];
          changed = true;
        }
      }
      if (changed) onFootswitchChange(fsNext);
    }
  };

  const toggleSceneBlock = (idx, blockType) => {
    if (readOnly) return;
    const sc = scenes[idx];
    const current = sc.blockToggles?.[blockType];
    // 3-state cycle : undefined → false → true → undefined.
    let nextVal;
    if (current === undefined) nextVal = false;
    else if (current === false) nextVal = true;
    else nextVal = undefined;
    const nextToggles = { ...(sc.blockToggles || {}) };
    if (nextVal === undefined) delete nextToggles[blockType];
    else nextToggles[blockType] = nextVal;
    const partial = { blockToggles: Object.keys(nextToggles).length ? nextToggles : undefined };
    updateScene(idx, partial);
  };

  const setAmpLevel = (idx, raw) => {
    if (readOnly) return;
    const trimmed = String(raw).trim();
    if (trimmed === '') {
      updateScene(idx, { ampLevelOverride: undefined });
      return;
    }
    const n = Math.max(0, Math.min(100, parseInt(trimmed, 10)));
    if (Number.isFinite(n)) updateScene(idx, { ampLevelOverride: n });
  };

  // ─── Phase 5 (Item I) : paramOverrides ──────────────────────────
  const setSceneParamOverride = (idx, blockType, paramKey, rawValue) => {
    if (readOnly) return;
    const sc = scenes[idx];
    if (!sc) return;
    // Convert numeric values automatically. Fallback to string for
    // cab params (mic, axis) qui acceptent string.
    let value = rawValue;
    if (typeof rawValue === 'string') {
      const trimmed = rawValue.trim();
      if (trimmed !== '' && !Number.isNaN(Number(trimmed))) value = Number(trimmed);
    }
    const nextOver = { ...(sc.paramOverrides || {}) };
    nextOver[blockType] = { ...(nextOver[blockType] || {}), [paramKey]: value };
    updateScene(idx, { paramOverrides: nextOver });
  };

  const removeSceneParamOverride = (idx, blockType, paramKey) => {
    if (readOnly) return;
    const sc = scenes[idx];
    if (!sc?.paramOverrides?.[blockType]) return;
    const nextBlock = { ...sc.paramOverrides[blockType] };
    delete nextBlock[paramKey];
    const nextOver = { ...sc.paramOverrides };
    if (Object.keys(nextBlock).length === 0) {
      delete nextOver[blockType];
    } else {
      nextOver[blockType] = nextBlock;
    }
    const partial = {
      paramOverrides: Object.keys(nextOver).length === 0 ? undefined : nextOver,
    };
    updateScene(idx, partial);
  };

  // ─── Mutations footswitchMap ─────────────────────────────────────
  const setFs = (key, value) => {
    if (readOnly || typeof onFootswitchChange !== 'function') return;
    const next = { ...footswitchMap };
    const entry = deserializeFs(value);
    if (entry) next[key] = entry;
    else delete next[key];
    onFootswitchChange(next);
  };

  // ─── Render ──────────────────────────────────────────────────────
  const sectionHeader = (label) => (
    <div
      style={{
        fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
      }}
    >
      {label}
    </div>
  );

  const cellStyle = {
    background: 'var(--a5)',
    border: '1px solid var(--a8)',
    borderRadius: 'var(--r-sm)',
    padding: '4px 6px',
    fontSize: 10,
    color: 'var(--text)',
  };

  // Si rien à montrer (pas de scenes, pas de FS, et read-only) → null.
  if (readOnly && scenes.length === 0 && Object.keys(footswitchMap).length === 0) {
    return null;
  }

  return (
    <div
      data-testid="tmp-scenes-editor"
      style={{
        marginTop: 8,
        borderTop: '1px solid var(--a6)',
        paddingTop: 8,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      <div
        style={{
          fontSize: 11, fontWeight: 700, color,
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <span>🎬</span>
        <span>Scenes &amp; Footswitches</span>
      </div>

      {/* ─── Scenes ──────────────────────────────────────────────── */}
      <div>
        {sectionHeader(`Scenes (${scenes.length})`)}
        {scenes.length === 0 && (
          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>
            Aucune scene définie.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {scenes.map((sc, i) => (
            <div key={sc.id} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div
              data-testid={`tmp-scene-row-${sc.id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--a3)',
                border: '1px solid var(--a6)',
                borderRadius: 'var(--r-sm)',
                padding: 4,
                flexWrap: 'wrap',
              }}
            >
              <input
                type="text"
                value={sc.name}
                onChange={(e) => updateScene(i, { name: e.target.value })}
                disabled={readOnly}
                aria-label={`Nom scene ${sc.id}`}
                style={{ ...cellStyle, width: 90, fontWeight: 600 }}
              />
              <label style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                Amp Lvl
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={sc.ampLevelOverride ?? ''}
                  onChange={(e) => setAmpLevel(i, e.target.value)}
                  disabled={readOnly}
                  aria-label={`Amp Level scene ${sc.id}`}
                  placeholder="—"
                  style={{ ...cellStyle, width: 50, marginLeft: 4 }}
                />
              </label>
              {togglablePresent.length > 0 && (
                <div
                  style={{
                    display: 'flex', gap: 2, alignItems: 'center',
                    fontSize: 9,
                  }}
                >
                  {togglablePresent.map((b) => {
                    const v = sc.blockToggles?.[b];
                    const stateLabel = v === true ? 'ON' : v === false ? 'OFF' : '–';
                    const stateColor = v === true ? 'var(--green)' : v === false ? 'var(--red)' : 'var(--text-dim)';
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => toggleSceneBlock(i, b)}
                        disabled={readOnly}
                        title={`${TOGGLE_BLOCK_LABELS[b] || b} : cliquer pour cycler ${'OFF→ON→hérité'}`}
                        style={{
                          ...cellStyle,
                          padding: '2px 6px',
                          color: stateColor,
                          cursor: readOnly ? 'default' : 'pointer',
                          fontWeight: 700,
                        }}
                      >
                        {TOGGLE_BLOCK_LABELS[b] || b}:{stateLabel}
                      </button>
                    );
                  })}
                </div>
              )}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removeScene(i)}
                  aria-label={`Supprimer scene ${sc.id}`}
                  style={{
                    ...cellStyle,
                    color: 'var(--red)',
                    cursor: 'pointer',
                    border: '1px solid var(--red-border)',
                    background: 'var(--red-bg)',
                    padding: '2px 6px',
                  }}
                >
                  ×
                </button>
              )}
            </div>
            {/* Phase 5 (Item I) — Sous-section "Paramètres avancés"
                collapsable. Power users la déplient pour gérer
                paramOverrides ; cachée par défaut. */}
            {(() => {
              const overrides = sc.paramOverrides || {};
              const overrideEntries = Object.entries(overrides).flatMap(
                ([blockType, kv]) => Object.entries(kv || {}).map(([k, v]) => ({ blockType, k, v })),
              );
              const expanded = expandedAdvIdx === i;
              if (overrideEntries.length === 0 && readOnly) return null;
              return (
                <div data-testid={`tmp-scene-adv-${sc.id}`} style={{ marginTop: 2, marginLeft: 8 }}>
                  <button
                    type="button"
                    data-testid={`tmp-scene-adv-toggle-${sc.id}`}
                    onClick={() => {
                      setExpandedAdvIdx(expanded ? null : i);
                      setAdvForm({ block: '', key: '', value: '' });
                    }}
                    style={{
                      background: 'transparent', border: 'none',
                      color: 'var(--text-muted)', cursor: 'pointer',
                      fontSize: 9, padding: '2px 0', fontFamily: 'var(--font-mono)',
                      textTransform: 'uppercase', letterSpacing: 0.5,
                    }}
                  >
                    {expanded ? '▲' : '▼'} Paramètres avancés
                    {overrideEntries.length > 0 && (
                      <span
                        style={{
                          marginLeft: 6, color, fontWeight: 700,
                          fontFamily: 'var(--font-ui)', textTransform: 'none',
                        }}
                      >
                        ({overrideEntries.length})
                      </span>
                    )}
                  </button>
                  {expanded && (
                    <div
                      style={{
                        background: 'var(--a4)', border: '1px solid var(--a6)',
                        borderRadius: 'var(--r-sm)', padding: 6, marginTop: 4,
                        display: 'flex', flexDirection: 'column', gap: 4,
                      }}
                    >
                      {overrideEntries.length === 0 && (
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>
                          Aucun override paramétré.
                        </div>
                      )}
                      {overrideEntries.map(({ blockType, k, v }) => (
                        <div
                          key={`${blockType}.${k}`}
                          data-testid={`tmp-scene-adv-entry-${sc.id}-${blockType}-${k}`}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            fontSize: 10, fontFamily: 'var(--font-mono)',
                          }}
                        >
                          <span style={{ color: 'var(--text-muted)' }}>{blockType}.{k}</span>
                          <span style={{ color: 'var(--text-bright)', fontWeight: 700 }}>{String(v)}</span>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => removeSceneParamOverride(i, blockType, k)}
                              aria-label={`Supprimer override ${blockType}.${k}`}
                              style={{
                                ...cellStyle,
                                marginLeft: 'auto',
                                color: 'var(--red)', cursor: 'pointer',
                                border: '1px solid var(--red-border)',
                                background: 'var(--red-bg)',
                                padding: '0px 6px', fontSize: 9,
                              }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      {!readOnly && (
                        <div
                          style={{
                            display: 'flex', gap: 4, alignItems: 'center',
                            paddingTop: 4, borderTop: '1px solid var(--a6)',
                          }}
                        >
                          <select
                            data-testid={`tmp-scene-adv-form-block-${sc.id}`}
                            value={advForm.block}
                            onChange={(e) => setAdvForm((f) => ({ ...f, block: e.target.value }))}
                            style={{ ...cellStyle, fontSize: 10 }}
                          >
                            <option value="">— bloc —</option>
                            {allBlocksPresent.map((b) => (
                              <option key={b} value={b}>{TOGGLE_BLOCK_LABELS[b] || b}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            data-testid={`tmp-scene-adv-form-key-${sc.id}`}
                            placeholder="param"
                            value={advForm.key}
                            onChange={(e) => setAdvForm((f) => ({ ...f, key: e.target.value }))}
                            list={advForm.block ? `tmp-adv-keys-${sc.id}-${advForm.block}` : undefined}
                            style={{ ...cellStyle, width: 70, fontSize: 10 }}
                          />
                          {advForm.block && patch?.[advForm.block]?.params && (
                            <datalist id={`tmp-adv-keys-${sc.id}-${advForm.block}`}>
                              {Object.keys(patch[advForm.block].params).map((k) => (
                                <option key={k} value={k} />
                              ))}
                            </datalist>
                          )}
                          <input
                            type="text"
                            data-testid={`tmp-scene-adv-form-value-${sc.id}`}
                            placeholder="valeur"
                            value={advForm.value}
                            onChange={(e) => setAdvForm((f) => ({ ...f, value: e.target.value }))}
                            style={{ ...cellStyle, width: 60, fontSize: 10 }}
                          />
                          <button
                            type="button"
                            data-testid={`tmp-scene-adv-form-add-${sc.id}`}
                            onClick={() => {
                              if (!advForm.block || !advForm.key.trim() || advForm.value === '') return;
                              setSceneParamOverride(i, advForm.block, advForm.key.trim(), advForm.value);
                              setAdvForm({ block: '', key: '', value: '' });
                            }}
                            disabled={!advForm.block || !advForm.key.trim() || advForm.value === ''}
                            style={{
                              ...cellStyle,
                              cursor: (!advForm.block || !advForm.key.trim() || advForm.value === '') ? 'default' : 'pointer',
                              color, fontWeight: 700,
                              opacity: (!advForm.block || !advForm.key.trim() || advForm.value === '') ? 0.4 : 1,
                            }}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
            </div>
          ))}
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={addScene}
            data-testid="tmp-scene-add"
            style={{
              ...cellStyle,
              marginTop: 4,
              cursor: 'pointer',
              fontWeight: 700,
              color,
            }}
          >
            + Ajouter une scene
          </button>
        )}
      </div>

      {/* ─── Footswitches ────────────────────────────────────────── */}
      <div>
        {sectionHeader('Footswitches')}
        <div
          style={{
            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4,
          }}
        >
          {FS_KEYS.map((k) => {
            const value = serializeFs(footswitchMap[k]);
            return (
              <label
                key={k}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 10, color: 'var(--text-sec)',
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color }}>
                  {k.toUpperCase()}
                </span>
                <select
                  value={value}
                  onChange={(e) => setFs(k, e.target.value)}
                  disabled={readOnly}
                  aria-label={`Action ${k}`}
                  style={{ ...cellStyle, flex: 1, minWidth: 0 }}
                >
                  <option value="">— aucun —</option>
                  {sceneIds.length > 0 && (
                    <optgroup label="Scenes">
                      {scenes.map((s) => (
                        <option key={s.id} value={`scene:${s.id}`}>
                          <FsOption value={`Scene ${s.name}`}/>{`Scene ${s.name}`}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {togglablePresent.length > 0 && (
                    <optgroup label="Toggle">
                      {togglablePresent.map((b) => (
                        <option key={b} value={`toggle:${b}`}>
                          Toggle {TOGGLE_BLOCK_LABELS[b] || b}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value="tap_tempo">Tap Tempo</option>
                </select>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ScenesEditor;
export { nextSceneId, serializeFs, deserializeFs };

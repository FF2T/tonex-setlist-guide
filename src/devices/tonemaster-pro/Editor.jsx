// src/devices/tonemaster-pro/Editor.jsx — Phase 7.12.
//
// Editor modal pour patches TMP custom. Permet :
// - Cloner un patch factory (mode 'clone') : l'éditeur ouvre avec un
//   deep clone, le user peut modifier name/notes/style/gain/pickup/amp/cab.
// - Éditer un custom existant (mode 'edit') : idem + bouton delete.
//
// Scope v1 :
// - Champs édités : name, notes, style, gain, pickupAffinity (HB/SC/P90),
//   amp.model + amp.params (jusqu'à 5), cab.model + cab.params (idem).
// - Autres blocs (drive, mod, delay, reverb, comp, noise_gate, eq)
//   préservés mais non éditables dans le form. Affichés en read-only
//   pour info.
// - Scenes / footswitchMap préservés mais non éditables ici (ScenesEditor
//   dédié existant Phase 4 — peut être branché plus tard).
//
// Validation : validatePatch avant save. Errors affichées inline.

import React, { useState, useMemo } from 'react';
import {
  AMP_MODELS, CAB_MODELS, STYLES, GAINS, MODELS_BY_TYPE,
} from './whitelist.js';
import { validatePatch, RENDER_ORDER } from './chain-model.js';

// Deep clone simple — patches sont des plain objects (pas de cycles).
function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

// Génère un id unique pour un nouveau custom.
function genCustomId() {
  return `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

// Crée un patch custom à partir d'un factory : deep clone + nouvel id +
// factory:false + source:'custom' + nom suffixé "(copie)".
function clonePatchAsCustom(factoryPatch) {
  if (!factoryPatch) return null;
  const cloned = deepClone(factoryPatch);
  cloned.id = genCustomId();
  cloned.name = `${factoryPatch.name} (copie)`;
  cloned.factory = false;
  cloned.source = 'custom';
  return cloned;
}

function ParamInput({ paramKey, value, onChange, type }) {
  // Cab autorise des strings (mic, axis). Reste : numeric.
  const isString = (type === 'cab' && (paramKey === 'mic' || paramKey === 'axis'));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <label style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 70, textTransform: 'uppercase', letterSpacing: 0.5 }}>{paramKey}</label>
      <input
        data-testid={`tmp-editor-param-${type}-${paramKey}`}
        type={isString ? 'text' : 'number'}
        step={isString ? undefined : '0.1'}
        value={value ?? ''}
        onChange={(e) => onChange(isString ? e.target.value : (e.target.value === '' ? '' : Number(e.target.value)))}
        style={{ flex: 1, fontSize: 12, padding: '4px 6px', background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-sm)' }}
      />
    </div>
  );
}

function BlockEditor({ slot, block, onChange }) {
  if (!block) return null;
  const models = MODELS_BY_TYPE[slot] || [];
  const paramKeys = Object.keys(block.params || {});
  return (
    <div data-testid={`tmp-editor-block-${slot}`} style={{ marginBottom: 12, background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{slot.replace('_', ' ')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 70, textTransform: 'uppercase', letterSpacing: 0.5 }}>Model</label>
          <select
            data-testid={`tmp-editor-model-${slot}`}
            value={block.model || ''}
            onChange={(e) => onChange({ ...block, model: e.target.value })}
            style={{ flex: 1, fontSize: 12, padding: '4px 6px', background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-sm)' }}
          >
            <option value="">— choisir un modèle —</option>
            {models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 70 }}>Enabled</label>
          <input
            data-testid={`tmp-editor-enabled-${slot}`}
            type="checkbox"
            checked={!!block.enabled}
            onChange={(e) => onChange({ ...block, enabled: e.target.checked })}
          />
        </div>
        {paramKeys.map((k) => (
          <ParamInput
            key={k}
            paramKey={k}
            value={block.params[k]}
            type={slot}
            onChange={(v) => onChange({ ...block, params: { ...block.params, [k]: v } })}
          />
        ))}
      </div>
    </div>
  );
}

function TmpPatchEditor({ patch: initialPatch, onSave, onDelete, onCancel, mode = 'edit' }) {
  const [patch, setPatch] = useState(() => deepClone(initialPatch));
  const [errors, setErrors] = useState([]);
  const set = (field, value) => setPatch((p) => ({ ...p, [field]: value }));
  const setBlock = (slot, value) => setPatch((p) => ({ ...p, [slot]: value }));
  const setPickup = (key, value) => setPatch((p) => ({
    ...p,
    pickupAffinity: { ...(p.pickupAffinity || { HB: 50, SC: 50, P90: 50 }), [key]: Number(value) || 0 },
  }));

  const handleSave = () => {
    const v = validatePatch(patch);
    if (!v.valid) {
      setErrors(v.errors);
      return;
    }
    setErrors([]);
    onSave(patch);
  };

  // Blocs non éditables mais préservés.
  const readOnlyBlocks = useMemo(
    () => RENDER_ORDER.filter((slot) => slot !== 'amp' && slot !== 'cab' && patch[slot]),
    [patch],
  );

  return (
    <div data-testid="tmp-editor-overlay" style={{
      position: 'fixed', inset: 0, background: 'var(--overlay, rgba(0,0,0,0.7))',
      zIndex: 200, overflowY: 'auto', padding: 12,
      WebkitOverflowScrolling: 'touch',
    }}>
      <div style={{
        background: 'var(--surface-card)', maxWidth: 720, margin: '0 auto',
        borderRadius: 'var(--r-xl)', padding: 16,
        border: '1px solid var(--border-strong)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800 }}>
            {mode === 'clone' ? '🆕 Nouveau patch TMP' : '✏️ Éditer patch TMP'}
          </div>
          <button
            data-testid="tmp-editor-cancel"
            onClick={onCancel}
            style={{ background: 'transparent', border: '1px solid var(--a15)', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
          >Annuler</button>
        </div>

        {errors.length > 0 && (
          <div data-testid="tmp-editor-errors" style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', borderRadius: 'var(--r-md)', padding: 10, marginBottom: 12, fontSize: 11 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Erreurs de validation :</div>
            <ul style={{ paddingLeft: 18 }}>
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        {/* Métadonnées */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Métadonnées</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 70 }}>Nom</label>
              <input
                data-testid="tmp-editor-name"
                value={patch.name || ''}
                onChange={(e) => set('name', e.target.value)}
                style={{ flex: 1, fontSize: 12, padding: '6px 8px', background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-sm)' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 70 }}>Notes</label>
              <textarea
                data-testid="tmp-editor-notes"
                value={patch.notes || ''}
                onChange={(e) => set('notes', e.target.value)}
                rows={2}
                style={{ flex: 1, fontSize: 12, padding: '6px 8px', background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-sm)', fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 70 }}>Style</label>
              <select
                data-testid="tmp-editor-style"
                value={patch.style || ''}
                onChange={(e) => set('style', e.target.value)}
                style={{ flex: 1, fontSize: 12, padding: '6px 8px', background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-sm)' }}
              >
                <option value="">—</option>
                {STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 70 }}>Gain</label>
              <select
                data-testid="tmp-editor-gain"
                value={patch.gain || ''}
                onChange={(e) => set('gain', e.target.value)}
                style={{ flex: 1, fontSize: 12, padding: '6px 8px', background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-sm)' }}
              >
                <option value="">—</option>
                {GAINS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 70 }}>Pickups</label>
              <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                {['HB', 'SC', 'P90'].map((type) => (
                  <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{type}</span>
                    <input
                      data-testid={`tmp-editor-pickup-${type}`}
                      type="number"
                      min={0}
                      max={100}
                      value={patch.pickupAffinity?.[type] ?? ''}
                      onChange={(e) => setPickup(type, e.target.value)}
                      style={{ width: 50, fontSize: 11, padding: '4px 6px', background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-sm)' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Blocs éditables : amp + cab */}
        <BlockEditor slot="amp" block={patch.amp} onChange={(b) => setBlock('amp', b)} />
        <BlockEditor slot="cab" block={patch.cab} onChange={(b) => setBlock('cab', b)} />

        {/* Blocs non éditables (préservés) */}
        {readOnlyBlocks.length > 0 && (
          <div data-testid="tmp-editor-readonly-blocks" style={{ marginBottom: 12, background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: 6 }}>
              {readOnlyBlocks.length} bloc{readOnlyBlocks.length > 1 ? 's' : ''} préservé{readOnlyBlocks.length > 1 ? 's' : ''} tel{readOnlyBlocks.length > 1 ? 's' : ''} quel{readOnlyBlocks.length > 1 ? 's' : ''} (non éditable en v1, restera tel quel au save) :
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {readOnlyBlocks.map((slot) => (
                <span key={slot} style={{ fontSize: 10, padding: '2px 6px', background: 'var(--a6)', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)' }}>{slot.replace('_', ' ')} · {patch[slot].model}</span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 16 }}>
          {mode === 'edit' && onDelete && (
            <button
              data-testid="tmp-editor-delete"
              onClick={() => { if (window.confirm(`Supprimer le patch "${patch.name}" ?`)) onDelete(patch.id); }}
              style={{ background: 'var(--wine-400)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >🗑️ Supprimer</button>
          )}
          <div style={{ flex: 1 }}/>
          <button
            data-testid="tmp-editor-save"
            onClick={handleSave}
            style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >💾 Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

export default TmpPatchEditor;
export { TmpPatchEditor, clonePatchAsCustom, genCustomId, deepClone };

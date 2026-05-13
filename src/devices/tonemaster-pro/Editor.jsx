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
import {
  validatePatch, RENDER_ORDER, OPTIONAL_BLOCK_SLOTS, STANDARD_PARAMS,
} from './chain-model.js';
import ScenesEditor from './ScenesEditor.jsx';

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

// Phase 7.13.1 — Crée un patch vide pour le "from scratch". amp et cab
// obligatoires (premier model whitelist + STANDARD_PARAMS à 5). Style
// rock / gain mid / pickupAffinity 50-50-50 (neutre). Aucun bloc
// optionnel — l'utilisateur les ajoute via "Ajouter un bloc".
function buildBlankPatch() {
  return {
    id: genCustomId(),
    name: 'Nouveau patch',
    factory: false,
    source: 'custom',
    notes: '',
    style: 'rock',
    gain: 'mid',
    pickupAffinity: { HB: 50, SC: 50, P90: 50 },
    amp: buildDefaultBlock('amp'),
    cab: buildDefaultBlock('cab'),
  };
}

// Phase 7.13 — Crée un bloc neutre pour un type donné. Utilisé par le
// bouton "+ Ajouter <type>". Premier model de la whitelist + params
// STANDARD_PARAMS initialisés à 5 (valeur centrale lisible).
function buildDefaultBlock(slot) {
  const models = MODELS_BY_TYPE[slot] || [];
  const standardKeys = STANDARD_PARAMS[slot] || [];
  const params = {};
  standardKeys.forEach((k) => {
    // Cab : mic et axis sont des strings (mic name, axis on/off)
    if (slot === 'cab' && k === 'mic') params[k] = 'Dyn SM57';
    else if (slot === 'cab' && k === 'axis') params[k] = 'on';
    else if (slot === 'mod' && k === 'type') params[k] = 'sine';
    else params[k] = 5;
  });
  return {
    model: models[0] || '',
    enabled: true,
    params,
  };
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

function BlockEditor({ slot, block, onChange, onRemove }) {
  if (!block) return null;
  const models = MODELS_BY_TYPE[slot] || [];
  const paramKeys = Object.keys(block.params || {});
  return (
    <div data-testid={`tmp-editor-block-${slot}`} style={{ marginBottom: 12, background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{slot.replace('_', ' ')}</div>
        {onRemove && (
          <button
            data-testid={`tmp-editor-remove-${slot}`}
            onClick={onRemove}
            style={{ fontSize: 10, padding: '2px 6px', background: 'transparent', border: '1px solid var(--a15)', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)', cursor: 'pointer' }}
            title="Supprimer ce bloc du patch"
          >🗑️ Supprimer</button>
        )}
      </div>
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

  // Phase 7.13 — Slots absents (ajoutables). On exclut amp et cab (toujours
  // présents par contrat patch) et les slots déjà présents.
  const addableSlots = useMemo(
    () => OPTIONAL_BLOCK_SLOTS.filter((slot) => !patch[slot]),
    [patch],
  );
  const addBlock = (slot) => setBlock(slot, buildDefaultBlock(slot));
  const removeBlock = (slot) => setPatch((p) => {
    const { [slot]: _drop, ...rest } = p;
    // Si scenes ou footswitchMap référencent ce slot via toggle, on nettoie
    // au minimum les FS qui ciblent le bloc (peu coûteux ; les scenes
    // gardent leurs blockToggles qui deviennent no-op silencieusement).
    if (rest.footswitchMap) {
      const fsm = { ...rest.footswitchMap };
      ['fs1', 'fs2', 'fs3', 'fs4'].forEach((k) => {
        const e = fsm[k];
        if (e && e.type === 'toggle' && e.block === slot) delete fsm[k];
      });
      rest.footswitchMap = fsm;
    }
    return rest;
  });

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

        {/* Phase 7.13 — Blocs éditables (TOUS les présents dans RENDER_ORDER).
            amp et cab obligatoires (pas de remove). Les autres ont un bouton
            🗑️ Supprimer. */}
        {RENDER_ORDER.filter((slot) => patch[slot]).map((slot) => (
          <BlockEditor
            key={slot}
            slot={slot}
            block={patch[slot]}
            onChange={(b) => setBlock(slot, b)}
            onRemove={(slot === 'amp' || slot === 'cab') ? null : () => removeBlock(slot)}
          />
        ))}

        {/* Phase 7.13 — Ajouter un bloc optionnel absent. */}
        {addableSlots.length > 0 && (
          <div data-testid="tmp-editor-add-blocks" style={{ marginBottom: 12, background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Ajouter un bloc</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {addableSlots.map((slot) => (
                <button
                  key={slot}
                  data-testid={`tmp-editor-add-${slot}`}
                  onClick={() => addBlock(slot)}
                  style={{ fontSize: 11, padding: '4px 10px', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', color: 'var(--accent)', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontWeight: 600 }}
                >+ {slot.replace('_', ' ')}</button>
              ))}
            </div>
          </div>
        )}

        {/* Phase 7.13 — Scenes / Footswitch via ScenesEditor (composant Phase 4). */}
        <div data-testid="tmp-editor-scenes-section" style={{ marginTop: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Scenes / Footswitch</div>
          <ScenesEditor
            patch={patch}
            onScenesChange={(scenes) => set('scenes', scenes)}
            onFootswitchChange={(footswitchMap) => set('footswitchMap', footswitchMap)}
          />
        </div>

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
export {
  TmpPatchEditor,
  clonePatchAsCustom,
  buildBlankPatch,
  buildDefaultBlock,
  genCustomId,
  deepClone,
};

// src/app/components/ResolveUnknownsModal.jsx — Phase 7.77.
//
// Modale pour résoudre les presets 🔴 inconnus détectés dans les banks
// installées d'un device. Inspirée de la modale CSV import Phase 7.69.x
// (ExportImportScreen) mais autonome et adaptée au contexte banks live.
//
// Différences vs modale CSV :
//   - skip = "Laisser tel quel" (slot conservé inchangé) — pas "vide".
//   - clear = "Vider le slot" (action explicite séparée).
//   - Pas d'import à confirmer derrière, applique direct aux banks.
//
// Props :
//   - unknowns: string[] (liste des noms inconnus dans les banks)
//   - catalogNames: string[] (datalist pour recherche manuelle)
//   - allowAddCustom: boolean (true si onAddCustomPresets dispo côté caller)
//   - onConfirm: (resolutions, customsToAdd) => void
//     resolutions = { [name]: { action: 'remap'|'clear'|'skip', target? } }
//     customsToAdd = Array<{name, src:'custom', creator, amp, gain, style, channel, scores}>
//   - onCancel: () => void

import React, { useState, useMemo } from 'react';
import { t, tFormat } from '../../i18n/index.js';
import { findCatalogSuggestions, findCatalogEntry, PRESET_CATALOG_MERGED } from '../../core/catalog.js';
import { inferCreator } from '../screens/MyCustomPresetsTab.jsx';
import { inferPresetInfo } from '../utils/infer-preset.js';

// Phase 7.77 — valide la saisie manuelle. Retourne le nom canonique du
// catalog si trouvé (entry non-guessed), sinon null.
function validateManualRemap(typedName) {
  if (!typedName || typeof typedName !== 'string') return null;
  const trimmed = typedName.trim();
  if (!trimmed) return null;
  const entry = findCatalogEntry(trimmed);
  if (!entry || entry.guessed) return null;
  if (PRESET_CATALOG_MERGED[trimmed]) return trimmed;
  // Sinon : retrouve le key dont l'entry === entry trouvé (normalize match).
  for (const [k, v] of Object.entries(PRESET_CATALOG_MERGED)) {
    if (v === entry) return k;
  }
  return trimmed;
}

function ResolveUnknownsModal({ unknowns, catalogNames, allowAddCustom, onConfirm, onCancel }) {
  // Pré-calcul des suggestions fuzzy au mount. Si match ≥ 0.7 → 'remap'
  // default, sinon 'add' si allowAddCustom sinon 'skip'.
  const initialSuggestions = useMemo(() => {
    const out = {};
    unknowns.forEach((name) => {
      const matches = findCatalogSuggestions(name);
      if (matches.length > 0) out[name] = matches[0].name;
    });
    return out;
  }, [unknowns]);

  const initialChoices = useMemo(() => {
    const out = {};
    unknowns.forEach((name) => {
      if (initialSuggestions[name]) out[name] = 'remap';
      else out[name] = allowAddCustom ? 'add' : 'skip';
    });
    return out;
  }, [unknowns, initialSuggestions, allowAddCustom]);

  const [choices, setChoices] = useState(initialChoices);
  const [suggestions] = useState(initialSuggestions);
  const [manualInput, setManualInput] = useState({});

  const handleConfirm = () => {
    const resolutions = {};
    const customsToAdd = [];

    unknowns.forEach((name) => {
      const choice = choices[name] || 'skip';
      if (choice === 'remap' && suggestions[name]) {
        resolutions[name] = { action: 'remap', target: suggestions[name] };
      } else if (choice === 'manual') {
        const validated = validateManualRemap(manualInput[name]);
        if (validated) resolutions[name] = { action: 'remap', target: validated };
        else resolutions[name] = { action: 'skip' }; // manuel invalide → skip silencieux
      } else if (choice === 'add' && allowAddCustom) {
        const info = inferPresetInfo(name) || {};
        customsToAdd.push({
          name,
          src: 'custom',
          creator: inferCreator(name),
          amp: info.amp || 'Custom',
          gain: info.gain || 'mid',
          style: info.style || 'rock',
          channel: '',
          scores: { HB: 75, SC: 75, P90: 75 },
        });
        // L'ajout custom suffit (le preset devient 🔵 perso au prochain render),
        // pas besoin de toucher au slot bank.
        resolutions[name] = { action: 'skip' };
      } else if (choice === 'clear') {
        resolutions[name] = { action: 'clear' };
      } else {
        resolutions[name] = { action: 'skip' };
      }
    });

    onConfirm(resolutions, customsToAdd);
  };

  // Partitionnement en 2 sections selon le choix actuel.
  const toRemap = [];
  const toOther = [];
  unknowns.forEach((name) => {
    const choice = choices[name] || 'skip';
    if (choice === 'remap' && suggestions[name]) toRemap.push(name);
    else if (choice === 'manual' && validateManualRemap(manualInput[name])) toRemap.push(name);
    else toOther.push(name);
  });

  const renderRow = (name) => {
    const choice = choices[name] || 'skip';
    const creator = inferCreator(name);
    const suggestion = suggestions[name];
    return (
      <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 6px', background: 'var(--a4)', borderRadius: 'var(--r-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 11 }}>
            <span style={{ color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block', maxWidth: '100%', whiteSpace: 'nowrap' }}>{name}</span>
            {creator && (
              <span style={{ marginLeft: 6, fontSize: 9, background: 'var(--a7)', color: 'var(--text-muted)', borderRadius: 'var(--r-sm)', padding: '1px 5px' }}>{creator}</span>
            )}
          </div>
          <select
            value={choice}
            onChange={(e) => setChoices((c) => ({ ...c, [name]: e.target.value }))}
            style={{ fontSize: 10, padding: '2px 4px', background: 'var(--bg-elev-1)', color: 'var(--text)', border: '1px solid var(--a10)', borderRadius: 'var(--r-sm)', cursor: 'pointer' }}
          >
            {suggestion && <option value="remap">{t('resolve.action-remap', 'Remapper')}</option>}
            <option value="manual">{t('resolve.action-manual', 'Rechercher dans le catalog')}</option>
            {allowAddCustom && <option value="add">{t('resolve.action-add', 'Ajouter comme custom')}</option>}
            <option value="skip">{t('resolve.action-skip', 'Laisser tel quel')}</option>
            <option value="clear">{t('resolve.action-clear', 'Vider le slot')}</option>
          </select>
        </div>
        {suggestion && choice !== 'manual' && (
          <div style={{ fontSize: 10, color: choice === 'remap' ? 'var(--green)' : 'var(--text-muted)', paddingLeft: 10 }}>
            → <span style={{ fontWeight: choice === 'remap' ? 600 : 400 }}>{suggestion}</span>
          </div>
        )}
        {choice === 'manual' && (() => {
          const typed = manualInput[name] || '';
          const validated = validateManualRemap(typed);
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 10, marginTop: 2 }}>
              <input
                list="resolve-catalog-dl"
                value={typed}
                onChange={(e) => setManualInput((m) => ({ ...m, [name]: e.target.value }))}
                placeholder={t('resolve.manual-placeholder', 'Tape pour rechercher (autocomplete catalog)…')}
                style={{ flex: 1, fontSize: 10, padding: '3px 6px', background: 'var(--bg-elev-1)', color: 'var(--text)', border: '1px solid ' + (typed ? (validated ? 'var(--green)' : 'var(--red)') : 'var(--a10)'), borderRadius: 'var(--r-sm)' }}
              />
              {typed && (
                <span style={{ fontSize: 11, color: validated ? 'var(--green)' : 'var(--red)' }} title={validated ? `→ ${validated}` : t('resolve.manual-invalid', 'Aucun match catalog — sera laissé tel quel')}>
                  {validated ? '✅' : '❌'}
                </span>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998, padding: 16 }} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-elev-1)', borderRadius: 'var(--r-lg)', padding: 18, maxWidth: 720, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--wine-400)', marginBottom: 6 }}>
          🔴 {tFormat('resolve.title', { n: unknowns.length }, 'Résoudre {n} preset(s) inconnu(s)')}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 12 }}>
          {t('resolve.hint', 'Ces presets ne sont pas reconnus dans le catalog Backline (scoring V9 dégradé, pas de pin IA). Choisis pour chacun : remapper vers une entrée catalog existante, rechercher manuellement, ajouter comme custom perso, laisser tel quel, ou vider le slot.')}
        </div>

        {/* Section 1 — à remapper */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>
              🎯 {tFormat('resolve.section-remap', { n: toRemap.length }, 'À remapper vers le catalog ({n})')}
            </div>
            {Object.keys(suggestions).length > 0 && (
              <button
                onClick={() => {
                  const all = { ...choices };
                  Object.keys(suggestions).forEach((n) => { all[n] = 'remap'; });
                  setChoices(all);
                }}
                style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.35)', color: 'var(--green)', borderRadius: 'var(--r-sm)', padding: '3px 8px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
              >
                {tFormat('resolve.all-remap', { n: Object.keys(suggestions).length }, 'Tout remapper auto ({n})')}
              </button>
            )}
          </div>
          {toRemap.length === 0 ? (
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 8px', background: 'var(--a3)', borderRadius: 'var(--r-sm)' }}>
              {t('resolve.section-remap-empty', 'Aucun preset à remapper pour l\'instant.')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto', background: 'var(--a3)', borderRadius: 'var(--r-md)', padding: 6 }}>
              {toRemap.map(renderRow)}
            </div>
          )}
        </div>

        {/* Section 2 — autres (add/skip/clear) */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
              ➕ {tFormat('resolve.section-other', { n: toOther.length }, 'À ajouter / laisser / vider ({n})')}
            </div>
            {allowAddCustom && (
              <button
                onClick={() => {
                  const all = { ...choices };
                  toOther.forEach((n) => { all[n] = 'add'; });
                  setChoices(all);
                }}
                style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', color: 'var(--accent)', borderRadius: 'var(--r-sm)', padding: '3px 8px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
              >
                {t('resolve.all-add', 'Tout ajouter comme custom')}
              </button>
            )}
            <button
              onClick={() => {
                const all = { ...choices };
                toOther.forEach((n) => { all[n] = 'skip'; });
                setChoices(all);
              }}
              style={{ background: 'var(--a5)', border: '1px solid var(--a10)', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)', padding: '3px 8px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
            >
              {t('resolve.all-skip', 'Tout laisser tel quel')}
            </button>
          </div>
          {toOther.length === 0 ? (
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 8px', background: 'var(--a3)', borderRadius: 'var(--r-sm)' }}>
              {t('resolve.section-other-empty', 'Tous les presets ont été remappés vers le catalog.')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto', background: 'var(--a3)', borderRadius: 'var(--r-md)', padding: 6 }}>
              {toOther.map(renderRow)}
            </div>
          )}
        </div>

        {/* Datalist partagée pour autocomplete recherche manuelle */}
        <datalist id="resolve-catalog-dl">
          {catalogNames.map((n) => <option key={n} value={n}/>)}
        </datalist>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, background: 'var(--a7)', border: '1px solid var(--a10)', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '9px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {t('resolve.cancel', 'Annuler')}
          </button>
          <button onClick={handleConfirm} style={{ flex: 2, background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '9px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {t('resolve.confirm', 'Appliquer →')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResolveUnknownsModal;
export { ResolveUnknownsModal, validateManualRemap };

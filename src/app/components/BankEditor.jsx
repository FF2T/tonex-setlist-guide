// src/app/components/BankEditor.jsx — Phase 7.18 (découpage main.jsx).
//
// Éditeur des banks ToneX (Anniversary 50 banks, Plug 10 banks).
// Affiche pour chaque bank ses 3 slots A/B/C, permet de changer un
// preset via PresetSearchModal, de gérer les presets inconnus via
// FuzzyPresetMatch, et de réinitialiser à la config factory.

import React, { useState } from 'react';
import { t } from '../../i18n/index.js';
import { findCatalogEntry } from '../../core/catalog.js';
import { saveUsagesForPreset, removeUsagesOverride } from '../../core/preset-curation.js';
import { CC } from '../utils/ui-constants.js';
import PresetSearchModal from './PresetSearchModal.jsx';
import FuzzyPresetMatch from './FuzzyPresetMatch.jsx';
import CurationDot from './CurationDot.jsx';
import PresetCurationModal from './PresetCurationModal.jsx';
import { PresetDetailInline } from '../screens/PresetBrowser.jsx';

function BankEditor({ banks, onBanks, color, maxBanks, startBank, factoryBanks, factoryBanksByVersion, defaultFactoryVersion, toneNetPresets, onToneNetPresets, profile, onProfiles, activeProfileId, songDb, isAdmin, onSharedUsagesOverrides, slots }) {
  const start = startBank || 0;
  const max = maxBanks || 50;
  // Phase ToneX One — devices à plat (One/One+) passent slots:['A'] →
  // 1 colonne, pas de label de slot. Défaut A/B/C pour les autres.
  const slotList = Array.isArray(slots) && slots.length ? slots : ['A', 'B', 'C'];
  const flat = slotList.length === 1;
  const [confirmReset, setConfirmReset] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(() => {
    if (factoryBanksByVersion && factoryBanksByVersion.length) {
      if (defaultFactoryVersion) return defaultFactoryVersion;
      return factoryBanksByVersion[0].id;
    }
    return null;
  });
  const [selectedPreset, setSelectedPreset] = useState(null); // {bank,slot,name}
  const [editingPreset, setEditingPreset] = useState(null); // {bank,slot}
  const [customInput, setCustomInput] = useState(null); // {bank,slot}
  // Phase 7.79 — modale info/édition usages d'un preset (click sur pastille).
  const [modalPresetName, setModalPresetName] = useState(null);
  const inp = { background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-md)', padding: '5px 8px', fontSize: 11, width: '100%', boxSizing: 'border-box' };
  const edit = (k, f, v) => onBanks((p) => ({ ...p, [k]: { ...(p[k] || { cat: '', A: '', B: '', C: '' }), [f]: v } }));
  const activeFactoryOption = factoryBanksByVersion
    ? factoryBanksByVersion.find((o) => o.id === selectedVersion) || null
    : null;
  const activeFactoryBanks = factoryBanksByVersion
    ? (activeFactoryOption ? activeFactoryOption.banks : null)
    : factoryBanks;
  const activeFactoryEmpty = !activeFactoryBanks || Object.keys(activeFactoryBanks).length === 0;
  const resetFactory = () => {
    if (activeFactoryBanks && !activeFactoryEmpty) {
      onBanks({ ...activeFactoryBanks });
      setConfirmReset(false);
    }
  };
  const allBanks = [];
  for (let i = start; i < start + max; i++) { allBanks.push([String(i), banks[i] || { cat: '', A: '', B: '', C: '' }]); }

  const selInfo = selectedPreset ? findCatalogEntry(selectedPreset.name) : null;

  return (
    <div>
      {(factoryBanks || factoryBanksByVersion) && <div style={{ marginBottom: 12 }}>
        {factoryBanksByVersion && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-sec)' }}>{t('bank-editor.firmware', 'Firmware factory :')}</span>
          <select value={selectedVersion || ''} onChange={(e) => { setSelectedVersion(e.target.value); setConfirmReset(false); }}
            style={{ background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-md)', padding: '4px 8px', fontSize: 12 }}>
            {factoryBanksByVersion.map((opt) => {
              const empty = !opt.banks || Object.keys(opt.banks).length === 0;
              return <option key={opt.id} value={opt.id} disabled={empty}>{opt.label}{empty ? ' — liste à fournir' : ''}</option>;
            })}
          </select>
        </div>}
        {!confirmReset ? <button onClick={() => setConfirmReset(true)} disabled={activeFactoryEmpty}
          style={{ background: activeFactoryEmpty ? 'var(--a7)' : 'var(--yellow-bg)', border: '1px solid ' + (activeFactoryEmpty ? 'var(--a15)' : 'var(--yellow-border)'), color: activeFactoryEmpty ? 'var(--text-dim)' : 'var(--yellow)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: activeFactoryEmpty ? 'not-allowed' : 'pointer' }}
          title={activeFactoryEmpty ? t('bank-editor.reset-empty-hint', 'Liste de presets factory à fournir pour cette version') : ''}>{t('bank-editor.reset-factory', 'Réinitialiser (config usine)')}</button>
          : <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: 'var(--r-lg)', padding: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600, marginBottom: 8 }}>{t('bank-editor.reset-warning', "Revenir à la configuration d'usine ? Toutes tes modifications seront perdues.")}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={resetFactory} style={{ background: 'var(--red)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{t('bank-editor.reset-confirm', 'Oui, réinitialiser')}</button>
              <button onClick={() => setConfirmReset(false)} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>{t('bank-editor.cancel', 'Annuler')}</button>
            </div>
          </div>}
      </div>}

      {editingPreset && <PresetSearchModal toneNetPresets={toneNetPresets} onClose={() => setEditingPreset(null)} onSelect={(name) => {
        edit(editingPreset.bank, editingPreset.slot, name);
        setEditingPreset(null);
      }}/>}

      {allBanks.map(([k, v]) => {
        const empty = !slotList.some((s) => v[s]);
        return <div key={k} style={{ background: empty ? 'transparent' : 'var(--a3)', border: empty ? '1px solid var(--a5)' : '1px solid var(--a7)', borderRadius: 'var(--r-md)', padding: '8px 10px', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color, minWidth: 24 }}>{k}</span>
            {slotList.map((c) => {
              const name = v[c] || '';
              const isSel = selectedPreset && selectedPreset.bank === k && selectedPreset.slot === c;
              const notInDb = name && !findCatalogEntry(name);
              return <div key={c} style={{ flex: 1, minWidth: 0 }}>
                <button onClick={() => { if (!name) { setEditingPreset({ bank: k, slot: c }); setCustomInput(null); } else { setSelectedPreset(isSel ? null : { bank: k, slot: c, name }); setCustomInput(null); } }}
                  style={{ display: 'flex', alignItems: 'center', gap: 3, width: '100%', background: isSel ? 'var(--accent-bg)' : notInDb ? 'var(--yellow-bg)' : 'transparent', border: isSel ? '1px solid var(--accent-border)' : notInDb ? '1px solid var(--yellow-border)' : '1px solid transparent', borderRadius: 'var(--r-sm)', padding: '3px 4px', cursor: 'pointer', textAlign: 'left' }}>
                  {!flat && <span style={{ fontSize: 10, fontWeight: 700, color: CC[c], flexShrink: 0 }}>{c}</span>}
                  {/* Phase 7.70 + 7.79 — Pastille cliquable (CurationDot)
                      ouvre la modale info/édition usages. */}
                  <CurationDot name={name} onClick={(n) => setModalPresetName(n)}/>
                  <span style={{ fontSize: 10, color: name ? 'var(--text-bright)' : 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{name || '—'}</span>
                </button>
              </div>;
            })}
          </div>
          {selectedPreset && selectedPreset.bank === k && <div style={{ marginTop: 6, animation: 'slideDown .2s ease-out' }}>
            {selInfo ? <div>
              <PresetDetailInline
                name={selectedPreset.name} info={selInfo}
                banksAnn={banks} banksPlug={banks}
                isAdmin={isAdmin} songDb={songDb}
                onSaveUsages={(n, u) => saveUsagesForPreset(n, u, {
                  findEntry: findCatalogEntry,
                  activeProfileId,
                  isAdmin,
                  onProfiles,
                  onToneNetPresets,
                  // Phase 7.79.3b — onShared pour router catalogs statiques en mode admin
                  onShared: onSharedUsagesOverrides || undefined,
                })}
                // Phase 7.79.3b — bouton "Restaurer" pour retirer un override cascade
                onRemoveOverride={(n) => removeUsagesOverride(n, {
                  findEntry: findCatalogEntry,
                  activeProfileId,
                  isAdmin,
                  onProfiles,
                  onShared: onSharedUsagesOverrides || undefined,
                })}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={() => { setEditingPreset({ bank: k, slot: selectedPreset.slot }); setSelectedPreset(null); }} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{t('bank-editor.edit', 'Modifier')}</button>
                <button onClick={() => setSelectedPreset(null)} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>{t('bank-editor.close', 'Fermer')}</button>
              </div>
            </div>
              : <FuzzyPresetMatch name={selectedPreset.name} bank={k} slot={selectedPreset.slot} onAccept={(name) => { edit(k, selectedPreset.slot, name); setSelectedPreset(null); }} onSearch={() => { setEditingPreset({ bank: k, slot: selectedPreset.slot }); setSelectedPreset(null); }} onManual={() => { setCustomInput({ bank: k, slot: selectedPreset.slot }); setSelectedPreset(null); }} onClose={() => setSelectedPreset(null)}/>}
          </div>}
          {customInput && customInput.bank === k && <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: CC[customInput.slot] }}>{customInput.slot}</span>
            <input autoFocus value={v[customInput.slot] || ''} onChange={(e) => edit(k, customInput.slot, e.target.value)} style={{ ...inp, flex: 1 }} placeholder={t('bank-editor.custom-name', 'Nom du preset custom')}/>
            <button onClick={() => setCustomInput(null)} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-sm)', padding: '4px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>{t('bank-editor.ok', 'OK')}</button>
          </div>}
        </div>;
      })}

      {/* Phase 7.79 — Modale info/édition usages d'un preset
          (déclenchée par CurationDot dans chaque slot) */}
      {modalPresetName && (
        <PresetCurationModal
          presetName={modalPresetName}
          isAdmin={isAdmin}
          songDb={songDb}
          profile={profile}
          onProfiles={onProfiles}
          activeProfileId={activeProfileId}
          toneNetPresets={toneNetPresets}
          onToneNetPresets={onToneNetPresets}
          onSharedUsagesOverrides={onSharedUsagesOverrides}
          onClose={() => setModalPresetName(null)}
        />
      )}
    </div>
  );
}

export default BankEditor;
export { BankEditor };

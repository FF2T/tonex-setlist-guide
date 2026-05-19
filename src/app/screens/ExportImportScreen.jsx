// src/app/screens/ExportImportScreen.jsx — Phase 7.18 (découpage main.jsx).
//
// Écran ⚙️ Paramètres → Import/Export. Permet :
// - Sauvegarde JSON complète du state (setlists/songDb/presets/banks).
// - Import JSON (replace via onImportState).
// - Export CSV des banks (Anniversary / Plug / les deux).
// - Import CSV avec preview + mode merge/replace.

import React, { useState, useRef, useMemo } from 'react';
import { t, tFormat } from '../../i18n/index.js';
import { CC, CL } from '../utils/ui-constants.js';
import { downloadFile, generateCSV, exportJSON, parseCSV } from '../utils/csv-helpers.js';
import { findCatalogEntry, findCatalogSuggestions, PRESET_CATALOG_MERGED, normalizePresetName } from '../../core/catalog.js';
import Breadcrumb from '../components/Breadcrumb.jsx';
import { inferCreator } from './MyCustomPresetsTab.jsx';
import { inferPresetInfo } from '../utils/infer-preset.js';

// Phase 7.69 — Détection des presets CSV inconnus AVANT l'overwrite.
// Scan importData (ann + plug), retourne la liste des noms qui ne
// sont pas dans PRESET_CATALOG_MERGED. Le user choisira :
//   - "Ajouter comme custom" : push dans profile.customPacks avec
//     metadata par défaut (creator inferé + amp/gain/style inferé)
//   - "Laisser vide" : remplace le nom par "" dans importData
//
// Phase 7.69.2 — `findCatalogEntry` ne retourne JAMAIS null pour
// un nom non-vide : il fallback sur `guessPresetInfo` qui devine
// des metadata depuis le nom et marque l'entry `guessed: true`.
// On considère "inconnu" tout entry qui :
//   - est falsy (théorique, name vide géré en amont)
//   - OU a `guessed: true` (fallback heuristique, pas dans le catalog)
function detectUnknownPresets(importData) {
  const seen = new Set();
  ['ann', 'plug'].forEach((k) => {
    Object.values(importData?.[k] || {}).forEach((bank) => {
      ['A', 'B', 'C'].forEach((slot) => {
        const name = bank?.[slot];
        if (!name || typeof name !== 'string') return;
        const entry = findCatalogEntry(name);
        if (entry && !entry.guessed) return; // connu (catalog static, ToneNET saisi, ou custom)
        seen.add(name);
      });
    });
  });
  return Array.from(seen).sort();
}

function ExportImportScreen({ banksAnn, onBanksAnn, banksPlug, onBanksPlug, onBack, onNavigate, fullState, onImportState, inline, isAdmin = true, onAddCustomPresets }) {
  const [exported, setExported] = useState(null);
  const [importData, setImportData] = useState(null);
  const [importErr, setImportErr] = useState(null);
  const [importMode, setImportMode] = useState('merge');
  const [toast, setToast] = useState(null);
  // Phase 7.69 — Modale presets inconnus.
  // unknownPresets : Array<string> liste des noms à choisir
  // unknownChoices : { [name]: 'add' | 'skip' | 'remap' | 'manual' }
  // unknownSuggestions : { [name]: catalogName } — top match fuzzy via
  // findCatalogSuggestions Phase 7.69.5. Si présent, choix 'remap'
  // disponible et default.
  // unknownManualInput : { [name]: userTypedName } — Phase 7.69.6,
  // valeur saisie par le user quand il choisit 'manual'. Validée à
  // la finalisation via findCatalogEntry (entry non-guessed).
  const [unknownPresets, setUnknownPresets] = useState(null);
  const [unknownChoices, setUnknownChoices] = useState({});
  const [unknownSuggestions, setUnknownSuggestions] = useState({});
  const [unknownManualInput, setUnknownManualInput] = useState({});

  // Phase 7.69.6 — liste des noms du catalog pour datalist autocomplete.
  // Phase 7.69.11 — dédupliqué par normalizePresetName (le catalog contient
  // ~317 doublons normalize-equivalents type "TSR 50-51 Bright" vs
  // "TSR - 50-51 - Bright"). Garde la forme la plus courte = sans
  // séparateurs ` - ` extras. Évite la pollution autocomplete.
  const catalogNames = useMemo(() => {
    const byNorm = new Map();
    for (const k of Object.keys(PRESET_CATALOG_MERGED)) {
      const norm = normalizePresetName(k);
      const existing = byNorm.get(norm);
      if (!existing || k.length < existing.length) byNorm.set(norm, k);
    }
    return Array.from(byNorm.values()).sort();
  }, []);
  const csvRef = useRef(null);
  const jsonRef = useRef(null);
  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const doExportCSV = (banks, name, key) => { try { downloadFile(generateCSV(banks, name), `ToneX_${key}.csv`); setExported(key); setTimeout(() => setExported(null), 2000); } catch (e) {} };
  const doExportAll = () => { try { const c1 = generateCSV(banksAnn, 'ToneX Anniversary'); const c2 = generateCSV(banksPlug, 'ToneX Plug').split('\n').slice(1).join('\n'); downloadFile(c1 + '\n' + c2, 'ToneX_Tous_Presets.csv'); setExported('all'); setTimeout(() => setExported(null), 2000); } catch (e) {} };
  const doExportJSON = () => { exportJSON(fullState); flash(t('export.json-exported', 'Sauvegarde JSON exportée ✅')); };

  const handleCSVFile = (e) => {
    const file = e.target.files[0]; if (!file) return; setImportErr(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const p = parseCSV(ev.target.result);
        if (!p) { setImportErr(t('export.csv-format-error', 'Format non reconnu.')); return; }
        // Phase 7.69 — Détection des presets inconnus AVANT l'overwrite.
        // Si tous les presets du CSV sont déjà dans PRESET_CATALOG_MERGED
        // (catalog statique + customPacks user) → preview directe comme
        // avant. Sinon → modale "Presets inconnus" qui demande au user
        // ce qu'il veut faire de chaque nom non référencé.
        const unknowns = detectUnknownPresets(p);
        if (unknowns.length > 0) {
          // Phase 7.69.5 — pré-calcul top suggestion fuzzy par preset
          // inconnu. Si match catalog ≥0.7 token-set ratio → option
          // 'remap' default. Sinon → 'add' si callback dispo, sinon 'skip'.
          const suggestions = {};
          const choices = {};
          unknowns.forEach((name) => {
            const matches = findCatalogSuggestions(name);
            if (matches.length > 0) {
              suggestions[name] = matches[0].name;
              choices[name] = 'remap';
            } else {
              choices[name] = onAddCustomPresets ? 'add' : 'skip';
            }
          });
          setUnknownSuggestions(suggestions);
          setUnknownChoices(choices);
          setUnknownPresets(unknowns);
          setImportData(p); // garde le data en attente pour finalisation après choix
        } else {
          setImportData(p);
        }
      } catch (err) {
        setImportErr(tFormat('export.csv-parse-error', { msg: err.message }, 'Erreur : {msg}'));
      }
    };
    reader.readAsText(file, 'UTF-8'); e.target.value = '';
  };

  // Phase 7.69 — Applique les choix user de la modale "presets inconnus".
  // Push les "add" dans profile.customPacks via onAddCustomPresets, et
  // remplace les "skip" par "" dans importData. Ferme la modale. La
  // preview banks habituelle s'affiche ensuite pour confirmation finale.
  // Phase 7.69.6 — valide la saisie manuelle d'un remap. Retourne le
  // nom canonique du catalog s'il existe (entry non-guessed) ou null.
  // findCatalogEntry fait déjà la tolérance casse/espaces via normalize.
  const validateManualRemap = (typedName) => {
    if (!typedName || typeof typedName !== 'string') return null;
    const trimmed = typedName.trim();
    if (!trimmed) return null;
    const entry = findCatalogEntry(trimmed);
    if (!entry || entry.guessed) return null;
    // Match clé exacte si possible (cas datalist autocomplete).
    if (PRESET_CATALOG_MERGED[trimmed]) return trimmed;
    // Sinon : retrouve le key dont l'entry === entry trouvé (normalize
    // match). Inefficace mais ne tourne que sur clic finalize.
    for (const [k, v] of Object.entries(PRESET_CATALOG_MERGED)) {
      if (v === entry) return k;
    }
    return trimmed;
  };

  const finalizeUnknownChoices = () => {
    if (!unknownPresets || !importData) return;
    const toAdd = unknownPresets.filter((name) => unknownChoices[name] === 'add');
    const toSkip = unknownPresets.filter((name) => unknownChoices[name] === 'skip');
    const toRemap = unknownPresets.filter((name) =>
      unknownChoices[name] === 'remap' && unknownSuggestions[name],
    );
    // Phase 7.69.6 — Manuel : ne retient que les saisies VALIDÉES
    // (matchent un entry catalog non-guessed). Une saisie invalide ou
    // vide tombe en skip silencieux.
    const manualRemap = {};
    unknownPresets.forEach((name) => {
      if (unknownChoices[name] !== 'manual') return;
      const typed = unknownManualInput[name];
      const validated = validateManualRemap(typed);
      if (validated) manualRemap[name] = validated;
    });
    // 1. Push les "add" comme customs avec defaults raisonnables
    if (toAdd.length > 0 && typeof onAddCustomPresets === 'function') {
      const newPresets = toAdd.map((name) => {
        const info = inferPresetInfo(name) || {};
        return {
          name,
          src: 'custom',
          creator: inferCreator(name),
          amp: info.amp || 'Custom',
          gain: info.gain || 'mid',
          style: info.style || 'rock',
          channel: '',
          scores: { HB: 75, SC: 75, P90: 75 },
        };
      });
      onAddCustomPresets(newPresets);
    }
    // 2. Phase 7.69.5/.6 — Remap (fuzzy suggestion OU saisie manuelle
    //    validée) : remplace les noms par leur catalog match. Skip :
    //    remplace par "". Une seule passe.
    const remapMap = {};
    toRemap.forEach((name) => { remapMap[name] = unknownSuggestions[name]; });
    Object.entries(manualRemap).forEach(([name, target]) => { remapMap[name] = target; });
    // Phase 7.69.6 — Si choix 'manual' MAIS saisie invalide → skip silencieux
    const invalidManual = unknownPresets.filter((name) =>
      unknownChoices[name] === 'manual' && !manualRemap[name],
    );
    if (toSkip.length > 0 || Object.keys(remapMap).length > 0 || invalidManual.length > 0) {
      const skipSet = new Set([...toSkip, ...invalidManual]);
      const nextImportData = { ann: {}, plug: {} };
      ['ann', 'plug'].forEach((k) => {
        Object.entries(importData[k] || {}).forEach(([bank, slots]) => {
          const nextSlots = { ...slots };
          ['A', 'B', 'C'].forEach((slot) => {
            const v = nextSlots[slot];
            if (skipSet.has(v)) nextSlots[slot] = '';
            else if (remapMap[v]) nextSlots[slot] = remapMap[v];
          });
          nextImportData[k][bank] = nextSlots;
        });
      });
      setImportData(nextImportData);
    }
    // 3. Ferme la modale
    setUnknownPresets(null);
    setUnknownChoices({});
    setUnknownSuggestions({});
    setUnknownManualInput({});
  };

  const cancelUnknownModal = () => {
    setUnknownPresets(null);
    setUnknownChoices({});
    setUnknownSuggestions({});
    setUnknownManualInput({});
    setImportData(null);
  };
  const handleJSONFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        onImportState(data);
        flash(t('export.json-imported', 'Import JSON réussi ✅'));
      } catch (err) { setImportErr(t('export.json-invalid', 'Fichier JSON invalide.')); }
    };
    reader.readAsText(file, 'UTF-8'); e.target.value = '';
  };
  const confirmCSV = () => {
    if (!importData) return;
    if (importMode === 'replace') { if (Object.keys(importData.ann).length > 0) onBanksAnn(importData.ann); if (Object.keys(importData.plug).length > 0) onBanksPlug(importData.plug); }
    else { if (Object.keys(importData.ann).length > 0) onBanksAnn((p) => ({ ...p, ...importData.ann })); if (Object.keys(importData.plug).length > 0) onBanksPlug((p) => ({ ...p, ...importData.plug })); }
    setImportData(null); flash(t('export.csv-imported', 'Import CSV réussi ✅'));
  };

  const xBtn = (onClick, key, label, color) => (
    <button onClick={onClick} style={{ background: exported === key ? 'var(--green-border)' : color, border: 'none', color: 'var(--text)', borderRadius: 'var(--r-lg)', padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
      {exported === key ? t('export.ok', '✅ OK') : label}
    </button>
  );
  const th = { padding: '7px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', borderBottom: '2px solid var(--a10)', color: 'var(--text-sec)' };
  const td = { padding: '6px 10px', fontSize: 11, borderBottom: '1px solid var(--a5)', verticalAlign: 'middle' };

  return (
    <div>
      {toast && <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: 'var(--green)', color: 'var(--text)', borderRadius: 'var(--r-lg)', padding: '10px 22px', fontSize: 13, fontWeight: 700, zIndex: 999 }}>✅ {toast}</div>}
      <Breadcrumb crumbs={[{ label: t('common.home', 'Accueil'), screen: 'list' }, { label: t('export.breadcrumb-profile', 'Mon Profil'), screen: 'profile' }, { label: t('export.breadcrumb', 'Import / Export') }]} onNavigate={onNavigate}/>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 20 }}>{t('export.title', '📋 Export / Import')}</div>

      {/* Phase 7.67 — Sauvegarde JSON gated isAdmin uniquement.
          fullState contient TOUS les profils (Sébastien + Bruno + Francisco
          + …) — pas pour un beta-tester non-admin. L'import JSON pareil :
          écraserait l'état global de l'app. */}
      {isAdmin && <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>{t('export.json-section', '💾 Sauvegarde complète (JSON) — admin')}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={doExportJSON} style={{ background: 'var(--green)', border: 'none', color: 'var(--text)', borderRadius: 'var(--r-lg)', padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{t('export.export-json', '⬇ Exporter JSON')}</button>
          <button onClick={() => jsonRef.current?.click()} style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.35)', color: 'var(--green)', borderRadius: 'var(--r-lg)', padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{t('export.import-json', '📂 Importer JSON')}</button>
          <input ref={jsonRef} type="file" accept=".json" onChange={handleJSONFile} style={{ display: 'none' }}/>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{t('export.json-hint', 'Sauvegarde complète : setlists, morceaux, presets, banks. Parfait pour sauvegarder ou transférer entre appareils.')}</div>
      </div>}

      {/* Export CSV */}
      <div style={{ background: 'var(--a3)', border: '1px solid var(--a7)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 12, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>{t('export.csv-export', 'Export CSV (Banks)')}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {xBtn(() => doExportCSV(banksAnn, 'ToneX Anniversary', 'Anniversary'), 'Anniversary', t('export.export-ann', '⬇ Anniversary'), 'var(--brass-300)')}
          {xBtn(() => doExportCSV(banksPlug, 'ToneX Plug', 'Plug'), 'Plug', t('export.export-plug', '⬇ Plug'), 'var(--accent)')}
          {xBtn(doExportAll, 'all', t('export.export-both', '⬇ Les deux'), 'var(--brass-500)')}
        </div>
      </div>

      {/* Import CSV */}
      <div style={{ background: 'var(--a3)', border: '1px solid var(--a7)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 12, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>{t('export.csv-import', 'Import CSV (Banks)')}</div>
        <button onClick={() => csvRef.current?.click()} style={{ background: 'var(--yellow-bg)', border: '1px solid rgba(251,191,36,0.35)', color: 'var(--yellow)', borderRadius: 'var(--r-lg)', padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 8 }}>{t('export.load-csv', '📂 Charger CSV')}</button>
        <input ref={csvRef} type="file" accept=".csv,.txt" onChange={handleCSVFile} style={{ display: 'none' }}/>
        {importErr && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--red)', background: 'rgba(239,68,68,0.1)', borderRadius: 'var(--r-md)', padding: '8px 12px' }}>{importErr}</div>}
        {/* Phase 7.69 — Modale "Presets inconnus détectés".
            S'affiche AVANT la preview banks si le CSV contient des noms
            non référencés dans PRESET_CATALOG_MERGED (catalog statique +
            customs user). Le user choisit pour chaque inconnu :
            - "Ajouter" : push dans profile.customPacks avec defaults
              (creator inferé, amp/gain/style inferé)
            - "Laisser vide" : remplace le nom par "" dans importData
            Boutons groupés "Tout ajouter" / "Tout laisser vide" pour
            traitement batch. */}
        {unknownPresets && unknownPresets.length > 0 && (
          <div style={{ marginTop: 14, background: 'var(--yellow-bg)', border: '1px solid var(--yellow)', borderRadius: 'var(--r-lg)', padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--yellow)', marginBottom: 6 }}>
              ⚠️ {tFormat('export.unknown-title', { n: unknownPresets.length }, '{n} preset(s) inconnu(s) détecté(s)')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 10 }}>
              {onAddCustomPresets
                ? t('export.unknown-hint-remap', 'Ces presets ne matchent pas le catalog. 4 options par ligne : Remapper (si suggestion proposée), Rechercher dans le catalog (autocomplete sur les ~1700 noms existants), Ajouter comme preset perso, ou Laisser le slot vide.')
                : t('export.unknown-hint-noadmin', 'Ces presets ne sont ni dans le catalog ToneX standard, ni dans tes presets persos. Ils seront marqués comme "laisser vide" dans les banks.')}
            </div>
            {/* Boutons groupés batch (Phase 7.69 + 7.69.5) */}
            {onAddCustomPresets && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {Object.keys(unknownSuggestions).length > 0 && (
                  <button
                    onClick={() => {
                      const all = { ...unknownChoices };
                      Object.keys(unknownSuggestions).forEach((n) => { all[n] = 'remap'; });
                      setUnknownChoices(all);
                    }}
                    style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.35)', color: 'var(--green)', borderRadius: 'var(--r-sm)', padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                    title={t('export.unknown-all-remap-hint', 'Remappe tous les presets avec une suggestion catalog vers leur nom officiel')}
                  >
                    {tFormat('export.unknown-all-remap', { n: Object.keys(unknownSuggestions).length }, 'Tout remapper ({n})')}
                  </button>
                )}
                <button
                  onClick={() => {
                    const all = {};
                    unknownPresets.forEach((n) => { all[n] = 'add'; });
                    setUnknownChoices(all);
                  }}
                  style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', color: 'var(--accent)', borderRadius: 'var(--r-sm)', padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                >{t('export.unknown-all-add', 'Tout ajouter')}</button>
                <button
                  onClick={() => {
                    const all = {};
                    unknownPresets.forEach((n) => { all[n] = 'skip'; });
                    setUnknownChoices(all);
                  }}
                  style={{ background: 'var(--a5)', border: '1px solid var(--a10)', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)', padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                >{t('export.unknown-all-skip', 'Tout laisser vide')}</button>
              </div>
            )}
            {/* Liste avec choix individuels */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 280, overflowY: 'auto', marginBottom: 10, background: 'var(--a3)', borderRadius: 'var(--r-md)', padding: 6 }}>
              {unknownPresets.map((name) => {
                const choice = unknownChoices[name] || 'skip';
                const creator = inferCreator(name);
                const suggestion = unknownSuggestions[name];
                return (
                  <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 6px', background: 'var(--a4)', borderRadius: 'var(--r-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0, fontSize: 11 }}>
                        <span style={{ color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block', maxWidth: '100%', whiteSpace: 'nowrap' }}>{name}</span>
                        {creator && (
                          <span style={{ marginLeft: 6, fontSize: 9, background: 'var(--a7)', color: 'var(--text-muted)', borderRadius: 'var(--r-sm)', padding: '1px 5px' }}>{creator}</span>
                        )}
                      </div>
                      {onAddCustomPresets ? (
                        <select
                          value={choice}
                          onChange={(e) => setUnknownChoices((c) => ({ ...c, [name]: e.target.value }))}
                          style={{ fontSize: 10, padding: '2px 4px', background: 'var(--bg-elev-1)', color: 'var(--text)', border: '1px solid var(--a10)', borderRadius: 'var(--r-sm)', cursor: 'pointer' }}
                        >
                          {suggestion && <option value="remap">{t('export.unknown-remap', 'Remapper')}</option>}
                          <option value="manual">{t('export.unknown-manual', 'Rechercher dans le catalog')}</option>
                          <option value="add">{t('export.unknown-add', 'Ajouter')}</option>
                          <option value="skip">{t('export.unknown-skip', 'Laisser vide')}</option>
                        </select>
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('export.unknown-skip', 'Laisser vide')}</span>
                      )}
                    </div>
                    {/* Phase 7.69.5 — Affiche la suggestion en sous-ligne pour
                        montrer la cible du remap. Visible même quand le
                        user choisit "Ajouter" / "Laisser vide" (info latérale). */}
                    {suggestion && choice !== 'manual' && (
                      <div style={{ fontSize: 10, color: choice === 'remap' ? 'var(--green)' : 'var(--text-muted)', paddingLeft: 10 }}>
                        → <span style={{ fontWeight: choice === 'remap' ? 600 : 400 }}>{suggestion}</span>
                      </div>
                    )}
                    {/* Phase 7.69.6 — Saisie manuelle avec datalist autocomplete +
                        validation visuelle ✅/❌ via findCatalogEntry. */}
                    {choice === 'manual' && (() => {
                      const typed = unknownManualInput[name] || '';
                      const validated = validateManualRemap(typed);
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 10, marginTop: 2 }}>
                          <input
                            list="catalog-names-dl"
                            value={typed}
                            onChange={(e) => setUnknownManualInput((m) => ({ ...m, [name]: e.target.value }))}
                            placeholder={t('export.unknown-manual-placeholder', 'Tape pour rechercher (autocomplete catalog)…')}
                            style={{ flex: 1, fontSize: 10, padding: '3px 6px', background: 'var(--bg-elev-1)', color: 'var(--text)', border: '1px solid ' + (typed ? (validated ? 'var(--green)' : 'var(--red)') : 'var(--a10)'), borderRadius: 'var(--r-sm)' }}
                          />
                          {typed && (
                            <span style={{ fontSize: 11, color: validated ? 'var(--green)' : 'var(--red)' }} title={validated ? `→ ${validated}` : t('export.unknown-manual-invalid', 'Aucun match catalog — sera laissé vide')}>
                              {validated ? '✅' : '❌'}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
              {/* Phase 7.69.6 — Datalist partagée (tous noms catalog ~1700).
                  Rendue 1 fois en bas de la liste, partagée par toutes les
                  inputs manuelles via list="catalog-names-dl". */}
              <datalist id="catalog-names-dl">
                {catalogNames.map((n) => <option key={n} value={n}/>)}
              </datalist>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={cancelUnknownModal} style={{ flex: 1, background: 'var(--a7)', border: '1px solid var(--a10)', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '9px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t('export.cancel', 'Annuler import')}</button>
              <button onClick={finalizeUnknownChoices} style={{ flex: 2, background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '9px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{t('export.unknown-continue', 'Continuer →')}</button>
            </div>
          </div>
        )}
        {/* Preview banks (Phase 7.67 / 7.68) — affichée APRÈS résolution
            de la modale presets inconnus Phase 7.69 (unknownPresets vidé). */}
        {importData && !unknownPresets && <div style={{ marginTop: 14, background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', borderRadius: 'var(--r-lg)', padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 10 }}>{t('export.preview', 'Aperçu')}</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            {Object.keys(importData.ann).length > 0 && <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 'var(--r-md)', padding: '6px 12px' }}><div style={{ fontSize: 12, color: 'var(--text-sec)', fontWeight: 700 }}>{t('export.pedale-label', '📦 Pedale')}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tFormat('export.banks-count', { count: Object.keys(importData.ann).length }, '{count} banks')}</div></div>}
            {Object.keys(importData.plug).length > 0 && <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', borderRadius: 'var(--r-md)', padding: '6px 12px' }}><div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>{t('export.plug-label', '🔌 Plug')}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tFormat('export.banks-count', { count: Object.keys(importData.plug).length }, '{count} banks')}</div></div>}
          </div>
          {/* Phase 7.67 — Aperçu détaillé des 5 premières banks pour vérification.
              Détecte aussi les banks > 49 (filtrées au parse mais on signale au user). */}
          {['ann', 'plug'].map((k) => {
            const data = importData[k];
            const keys = Object.keys(data || {}).map(Number).sort((a, b) => a - b);
            if (!keys.length) return null;
            const sample = keys.slice(0, 5);
            const label = k === 'ann' ? t('export.pedale-label-long', '📦 Pedale / Anniversary') : t('export.plug-label-long', '🔌 Plug');
            return (
              <div key={k} style={{ marginBottom: 10, background: 'var(--a3)', border: '1px solid var(--a7)', borderRadius: 'var(--r-md)', padding: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 6 }}>{label} — {t('export.preview-first-banks', '5 premières banks')}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                  <thead><tr><th style={{ textAlign: 'left', padding: '2px 4px', color: 'var(--text-muted)' }}>Bank</th><th style={{ textAlign: 'left', padding: '2px 4px', color: CC.A }}>A</th><th style={{ textAlign: 'left', padding: '2px 4px', color: CC.B }}>B</th><th style={{ textAlign: 'left', padding: '2px 4px', color: CC.C }}>C</th></tr></thead>
                  <tbody>
                    {sample.map((bk) => {
                      const v = data[bk] || {};
                      return (
                        <tr key={bk} style={{ borderTop: '1px solid var(--a5)' }}>
                          <td style={{ padding: '3px 4px', fontWeight: 700, color: 'var(--accent)' }}>{bk}</td>
                          <td style={{ padding: '3px 4px', color: 'var(--text)' }}>{v.A || '—'}</td>
                          <td style={{ padding: '3px 4px', color: 'var(--text)' }}>{v.B || '—'}</td>
                          <td style={{ padding: '3px 4px', color: 'var(--text)' }}>{v.C || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {keys.length > 5 && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{tFormat('export.preview-and-more', { n: keys.length - 5 }, '… et {n} banks de plus')}</div>}
              </div>
            );
          })}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[{ v: 'replace', l: t('export.mode-replace', '🔄 Remplacer (destructif)'), warn: true }, { v: 'merge', l: t('export.mode-merge', '🔀 Fusionner') }].map(({ v, l, warn }) => (
              <button key={v} onClick={() => setImportMode(v)} style={{ flex: 1, background: importMode === v ? (warn ? 'var(--wine-300)' : 'var(--accent-bg)') : 'var(--a5)', border: importMode === v ? `1px solid ${warn ? 'var(--wine-400)' : 'var(--border-accent)'}` : '1px solid var(--a10)', color: importMode === v ? (warn ? 'var(--text-inverse)' : 'var(--accent)') : 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
            ))}
          </div>
          {importMode === 'replace' && (
            <div style={{ marginBottom: 12, background: 'var(--wine-100, rgba(168,33,53,0.15))', border: '1px solid var(--wine-400, #a82135)', borderRadius: 'var(--r-md)', padding: '8px 10px', fontSize: 11, color: 'var(--wine-400, #d04050)' }}>
              ⚠️ {t('export.replace-warning', 'Mode Remplacer : toutes tes banks actuelles seront écrasées par les banks du CSV. Action irréversible.')}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setImportData(null)} style={{ flex: 1, background: 'var(--a7)', border: '1px solid var(--a10)', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '9px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t('export.cancel', 'Annuler')}</button>
            <button
              onClick={() => {
                if (importMode === 'replace' && !window.confirm(t('export.confirm-replace', 'Tu vas REMPLACER toutes tes banks par le contenu du CSV. Confirmer ?'))) return;
                confirmCSV();
              }}
              style={{ flex: 2, background: importMode === 'replace' ? 'var(--wine-400, #a82135)' : 'var(--accent)', border: 'none', color: 'var(--text)', borderRadius: 'var(--r-md)', padding: '9px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >{importMode === 'replace' ? t('export.import-replace', '⚠️ Confirmer le remplacement') : t('export.import', '✅ Importer')}</button>
          </div>
        </div>}
      </div>

      {/* Tableaux banks */}
      {[{ banks: banksAnn, label: 'ToneX Anniversary', color: 'var(--accent)' }, { banks: banksPlug, label: 'ToneX Plug', color: 'var(--accent)' }].map(({ banks, label, color }) => (
        <div key={label} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}><div style={{ width: 4, height: 18, background: color, borderRadius: 'var(--r-xs)' }}/><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{label}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tFormat('export.banks-count', { count: Object.keys(banks).length }, '{count} banks')}</div></div>
          <div style={{ overflowX: 'auto', borderRadius: 'var(--r-lg)', border: '1px solid var(--a8)' }}>
            <table>
              <thead><tr style={{ background: 'var(--a4)' }}><th style={{ ...th, width: 45 }}>{t('export.col-bank', 'Bank')}</th><th style={th}>{t('export.col-category', 'Catégorie')}</th>{['A', 'B', 'C'].map((c) => <th key={c} style={{ ...th, color: CC[c] }}>{c} — {CL[c]}</th>)}</tr></thead>
              <tbody>
                {Object.entries(banks).sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, v], i) => (
                  <tr key={k} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--a3)' }}>
                    <td style={{ ...td, fontWeight: 800, color: color, fontSize: 13 }}>{k}</td>
                    <td style={{ ...td, color: 'var(--text-sec)' }}>{v.cat}</td>
                    {['A', 'B', 'C'].map((c) => <td key={c} style={td}><span style={{ color: 'var(--text-bright)' }}>{v[c]}</span></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ExportImportScreen;
export { ExportImportScreen };

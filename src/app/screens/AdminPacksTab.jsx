// src/app/screens/AdminPacksTab.jsx — Phase 7.69.7
//
// Tab admin "📦 Packs (admin)" — création et gestion de packs de
// presets stockés dans shared.adminPacks (visibles à tous les profils
// via leur toggle Sources existant).
//
// Workflow d'import :
//   1. L'admin colle un listing texte (output de `unzip -l <pack>.zip`,
//      `ls *.txp`, ou liste brute de noms).
//   2. Le parser détecte les noms .txp et propose un nom de pack
//      pré-rempli (depuis "Archive: ..." si format unzip).
//   3. Aperçu : nom du pack + dropdown source (SOURCE_IDS) + tableau
//      des presets parsés avec metadata auto-détectée.
//   4. Dups : presets déjà dans PRESET_CATALOG_MERGED sont marqués
//      avec un warning ⚠️ + checkbox "Skip ce preset".
//   5. Validation → push dans shared.adminPacks → sync Firestore.
//
// Stockage : shared.adminPacks: [{ id, name, source, presets, createdBy, createdAt, lastModified }]
// Sync : LWW par pack id (cf main.jsx applyRemoteData).

import React, { useState, useMemo } from 'react';
import { t, tFormat } from '../../i18n/index.js';
import { parsePackListing } from '../utils/parse-pack-listing.js';
import { detectPresetMetadata, findDuplicates } from '../utils/detect-preset-metadata.js';
import { enrichPackWithAI } from '../utils/enrich-pack-ai.js';
import { getSharedGeminiKey } from '../utils/shared-key.js';
import { PRESET_CATALOG_MERGED, findCatalogEntry } from '../../core/catalog.js';
import { SOURCE_IDS, SOURCE_LABELS } from '../../core/sources.js';

const STYLE_OPTIONS = ['blues', 'rock', 'hard_rock', 'jazz', 'metal', 'pop'];
const GAIN_OPTIONS = ['low', 'mid', 'high'];

function AdminPacksTab({ adminPacks, onAdminPacks, profile, inp, aiKeys, aiProvider }) {
  const [showImport, setShowImport] = useState(false);
  const [listing, setListing] = useState('');
  const [packName, setPackName] = useState('');
  const [source, setSource] = useState('TSR');
  const [parsed, setParsed] = useState(null); // { archiveName, presets: [...metadata], ampContext? }
  const [skipNames, setSkipNames] = useState(new Set());
  const [editKey, setEditKey] = useState(null);
  // Phase 7.69.9 — enrichissement IA optionnel après le parse local.
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiEnriched, setAiEnriched] = useState(false); // flag : a-t-on lancé l'enrichissement IA

  const handleParse = () => {
    const result = parsePackListing(listing);
    if (result.presets.length === 0) {
      alert(t('adminpacks.error-empty', 'Aucun preset détecté dans le listing.'));
      return;
    }
    if (result.archiveName && !packName.trim()) {
      setPackName(result.archiveName);
    }
    const presetsWithMeta = result.presets.map((name) => detectPresetMetadata(name));
    const dups = findDuplicates(result.presets, PRESET_CATALOG_MERGED, findCatalogEntry);
    setParsed({ archiveName: result.archiveName, presets: presetsWithMeta });
    setSkipNames(new Set(dups)); // Skip auto les dups, le user peut décocher
  };

  const updatePresetMeta = (idx, field, value) => {
    setParsed((p) => ({
      ...p,
      presets: p.presets.map((preset, i) => (i === idx ? { ...preset, [field]: value } : preset)),
    }));
  };

  const updatePresetScore = (idx, scoreKey, value) => {
    setParsed((p) => ({
      ...p,
      presets: p.presets.map((preset, i) =>
        i === idx ? { ...preset, scores: { ...preset.scores, [scoreKey]: parseInt(value, 10) || 0 } } : preset,
      ),
    }));
  };

  const toggleSkip = (name) => {
    setSkipNames((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const resetImport = () => {
    setListing('');
    setPackName('');
    setSource('TSR');
    setParsed(null);
    setSkipNames(new Set());
    setShowImport(false);
    setAiLoading(false);
    setAiError(null);
    setAiEnriched(false);
  };

  // Phase 7.69.9 — enrichissement IA. Envoie la liste des noms parsés
  // à Gemini en 1 appel batch. Écrase parsed.presets avec la metadata
  // reçue (amp/gain/style/channel/scores + usages) et stocke ampContext
  // au niveau du pack pour utilisation par PresetBrowser.
  const enrichWithAI = async () => {
    if (!parsed) return;
    const key = aiKeys?.gemini || getSharedGeminiKey() || aiKeys?.anthropic;
    if (!key) {
      setAiError(t('adminpacks.ai-error-key', 'Clé API absente — configure-la dans 🔑 Clé API.'));
      return;
    }
    const provider = (aiKeys?.gemini || getSharedGeminiKey()) ? 'gemini' : 'anthropic';
    setAiLoading(true);
    setAiError(null);
    try {
      const names = parsed.presets.map((p) => p.name);
      const result = await enrichPackWithAI(names, packName.trim() || parsed.archiveName || 'Pack', source, {
        aiKey: key,
        aiProvider: provider,
      });
      // Merge result.presets sur parsed.presets (par nom). Si un preset
      // de result n'est pas trouvé en local, on l'ignore. Si un preset
      // local n'est pas dans result, on garde sa metadata héritée.
      const byName = {};
      result.presets.forEach((p) => { byName[p.name] = p; });
      const merged = parsed.presets.map((p) => {
        const ai = byName[p.name];
        if (!ai) return p;
        // Garde le creator detecté localement (regex) si l'IA ne le set pas
        return {
          ...p,
          ...ai,
          creator: p.creator || ai.creator || '',
        };
      });
      setParsed({ ...parsed, presets: merged, ampContext: result.ampContext });
      setAiEnriched(true);
    } catch (err) {
      setAiError(err.message || 'Erreur IA');
    } finally {
      setAiLoading(false);
    }
  };

  const createPack = () => {
    if (!parsed || !packName.trim()) {
      alert(t('adminpacks.error-name', 'Nom du pack requis.'));
      return;
    }
    const kept = parsed.presets.filter((p) => !skipNames.has(p.name));
    if (kept.length === 0) {
      alert(t('adminpacks.error-no-preset', 'Aucun preset à inclure (tous skippés).'));
      return;
    }
    const newPack = {
      id: `adminpack_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: packName.trim(),
      source,
      presets: kept,
      // Phase 7.69.9 — ampContext généré par l'IA si enrichissement
      // a été lancé. Lu par PresetBrowser pour afficher emoji/refs/desc
      // de chaque ampli du pack (cohérence avec PacksTab Vision IA).
      ampContext: parsed.ampContext || {},
      createdBy: profile?.id || 'unknown',
      createdAt: Date.now(),
      lastModified: Date.now(),
    };
    onAdminPacks((prev) => [...(prev || []), newPack]);
    resetImport();
  };

  const deletePack = (id) => {
    const pack = (adminPacks || []).find((p) => p.id === id);
    if (!pack) return;
    if (!window.confirm(t('adminpacks.confirm-delete', `Supprimer le pack "${pack.name}" (${pack.presets.length} presets) ?`))) return;
    onAdminPacks((prev) => (prev || []).filter((p) => p.id !== id));
  };

  const totalPresets = (adminPacks || []).reduce((acc, p) => acc + (p.presets?.length || 0), 0);

  const sectionStyle = { background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 14, marginBottom: 12 };

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 12 }}>
        {t('adminpacks.intro', 'Packs partagés admin : visibles par TOUS les profils via leur toggle Sources existant (TSR / AA / JS / etc.). Différent de "Mes presets custom" (per-profile).')}
      </div>

      {/* Liste des packs existants */}
      {(adminPacks || []).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            {tFormat('adminpacks.list-summary', { packs: adminPacks.length, presets: totalPresets }, '{packs} pack(s) admin, {presets} preset(s) au total')}
          </div>
          {adminPacks.map((pack) => {
            const isEditing = editKey === pack.id;
            return (
              <div key={pack.id} style={{ ...sectionStyle, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                      {pack.name}
                      <span style={{ marginLeft: 8, fontSize: 10, background: 'var(--a7)', color: 'var(--text-muted)', borderRadius: 'var(--r-sm)', padding: '1px 6px', fontWeight: 500 }}>
                        {pack.source}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      {tFormat('adminpacks.preset-count', { count: pack.presets?.length || 0 }, '{count} preset(s)')}
                      {pack.createdAt && ' · ' + new Date(pack.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button onClick={() => setEditKey(isEditing ? null : pack.id)} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)', padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>
                    {isEditing ? t('adminpacks.close', 'Fermer') : t('adminpacks.view', 'Voir')}
                  </button>
                  <button onClick={() => deletePack(pack.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 12, padding: '2px 6px' }}>✕</button>
                </div>
                {isEditing && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--a7)', maxHeight: 240, overflowY: 'auto' }}>
                    {(pack.presets || []).map((p, idx) => (
                      <div key={idx} style={{ fontSize: 11, padding: '3px 0', borderBottom: '1px solid var(--a5)', display: 'flex', gap: 8 }}>
                        <span style={{ flex: 1, color: 'var(--text)' }}>{p.name}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{p.amp} · {p.gain} · {p.style}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bouton import */}
      {!showImport && (
        <button onClick={() => setShowImport(true)} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          + {t('adminpacks.import-button', 'Importer un pack via listing texte')}
        </button>
      )}

      {/* Modale d'import */}
      {showImport && (
        <div style={sectionStyle}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            {t('adminpacks.import-title', '+ Nouveau pack')}
          </div>

          {!parsed && (
            <>
              <div style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 6 }}>
                {t('adminpacks.listing-hint', 'Colle l\'output de `unzip -l pack.zip`, `ls *.txp`, ou une liste de noms (1 par ligne) :')}
              </div>
              <textarea
                value={listing}
                onChange={(e) => setListing(e.target.value)}
                placeholder={'Archive:  TSR-Bumble-Deluxe-Pack.zip\n   123456  2024-01-15 14:32   TSR Bumble DLX CLN 1.txp\n   234567  2024-01-15 14:32   TSR Bumble DLX Drive 1.txp\n...'}
                style={{ ...inp, width: '100%', minHeight: 140, fontFamily: 'monospace', fontSize: 11, marginBottom: 8 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={resetImport} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                  {t('adminpacks.cancel', 'Annuler')}
                </button>
                <button onClick={handleParse} disabled={!listing.trim()} style={{ background: listing.trim() ? 'var(--accent)' : 'var(--a7)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: listing.trim() ? 'pointer' : 'not-allowed' }}>
                  {t('adminpacks.parse', 'Parser le listing →')}
                </button>
              </div>
            </>
          )}

          {parsed && (
            <>
              {/* Nom + source */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 2 }}>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>{t('adminpacks.field-name', 'Nom du pack')}</label>
                  <input value={packName} onChange={(e) => setPackName(e.target.value)} style={{ ...inp, width: '100%', fontSize: 12 }} placeholder={t('adminpacks.field-name-placeholder', 'Ex: TSR Bumble Deluxe Pack')}/>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>{t('adminpacks.field-source', 'Source (filtrage Sources)')}</label>
                  <select value={source} onChange={(e) => setSource(e.target.value)} style={{ ...inp, width: '100%', fontSize: 12 }}>
                    {SOURCE_IDS.map((s) => (
                      <option key={s} value={s}>{SOURCE_LABELS[s] || s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ flex: 1 }}>
                  {tFormat('adminpacks.preview-summary', { count: parsed.presets.length, skipped: skipNames.size }, '{count} preset(s) détecté(s), {skipped} skippé(s) (déjà dans le catalog)')}
                  {aiEnriched && <span style={{ marginLeft: 6, color: 'var(--green)', fontSize: 10, fontWeight: 600 }}>✨ Enrichi IA</span>}
                </span>
                {/* Phase 7.69.9 — bouton enrichissement IA. Recommandé
                    avant la création pour amp/gain/style/scores/usages
                    précis + ampContext (descriptions amps pour Explorer). */}
                <button
                  onClick={enrichWithAI}
                  disabled={aiLoading}
                  style={{ background: aiEnriched ? 'var(--green-bg)' : 'var(--brass-300)', border: aiEnriched ? '1px solid var(--green-border)' : 'none', color: aiEnriched ? 'var(--green)' : 'var(--tolex-900)', borderRadius: 'var(--r-sm)', padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: aiLoading ? 'wait' : 'pointer' }}
                  title={t('adminpacks.ai-enrich-hint', 'Demander à Gemini d\'inférer amp/gain/style/scores + descriptions amps pour Explorer')}
                >
                  {aiLoading
                    ? '⏳ ' + t('adminpacks.ai-loading', 'Enrichissement…')
                    : aiEnriched
                      ? '✨ ' + t('adminpacks.ai-redo', 'Re-enrichir IA')
                      : '🤖 ' + t('adminpacks.ai-enrich', 'Enrichir avec Gemini')}
                </button>
              </div>
              {aiError && (
                <div style={{ fontSize: 11, color: 'var(--red)', background: 'rgba(239,68,68,0.1)', padding: '4px 8px', borderRadius: 'var(--r-sm)', marginBottom: 6 }}>
                  ⚠️ {aiError}
                </div>
              )}

              {/* Tableau aperçu — édition inline metadata */}
              <div style={{ maxHeight: 320, overflowY: 'auto', background: 'var(--a3)', borderRadius: 'var(--r-md)', padding: 6, marginBottom: 10 }}>
                {parsed.presets.map((p, idx) => {
                  const isSkipped = skipNames.has(p.name);
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 4px', background: isSkipped ? 'rgba(239,68,68,0.05)' : 'var(--a4)', borderRadius: 'var(--r-sm)', marginBottom: 3, opacity: isSkipped ? 0.5 : 1 }}>
                      <input
                        type="checkbox"
                        checked={!isSkipped}
                        onChange={() => toggleSkip(p.name)}
                        style={{ flexShrink: 0 }}
                        title={isSkipped ? t('adminpacks.include', 'Inclure') : t('adminpacks.skip-it', 'Exclure (déjà dans catalog ?)')}
                      />
                      <div style={{ flex: 2, fontSize: 10, color: 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                        {isSkipped && <span style={{ marginLeft: 4, fontSize: 9, color: 'var(--red)' }}>⚠️</span>}
                      </div>
                      <input value={p.amp} onChange={(e) => updatePresetMeta(idx, 'amp', e.target.value)} style={{ ...inp, flex: 1, fontSize: 10, padding: '2px 4px' }} title="Ampli"/>
                      <select value={p.gain} onChange={(e) => updatePresetMeta(idx, 'gain', e.target.value)} style={{ ...inp, fontSize: 10, padding: '2px 4px' }}>
                        {GAIN_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                      <select value={p.style} onChange={(e) => updatePresetMeta(idx, 'style', e.target.value)} style={{ ...inp, fontSize: 10, padding: '2px 4px' }}>
                        {STYLE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <input type="number" min="0" max="100" value={p.scores.HB} onChange={(e) => updatePresetScore(idx, 'HB', e.target.value)} style={{ ...inp, width: 36, fontSize: 10, padding: '2px 4px' }} title="HB"/>
                      <input type="number" min="0" max="100" value={p.scores.SC} onChange={(e) => updatePresetScore(idx, 'SC', e.target.value)} style={{ ...inp, width: 36, fontSize: 10, padding: '2px 4px' }} title="SC"/>
                      <input type="number" min="0" max="100" value={p.scores.P90} onChange={(e) => updatePresetScore(idx, 'P90', e.target.value)} style={{ ...inp, width: 36, fontSize: 10, padding: '2px 4px' }} title="P90"/>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={resetImport} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                  {t('adminpacks.cancel', 'Annuler')}
                </button>
                <button onClick={() => setParsed(null)} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                  {t('adminpacks.back-listing', '← Modifier listing')}
                </button>
                <button onClick={createPack} style={{ flex: 1, background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {tFormat('adminpacks.create', { n: parsed.presets.length - skipNames.size }, 'Créer le pack ({n} presets) ✓')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminPacksTab;
export { AdminPacksTab };

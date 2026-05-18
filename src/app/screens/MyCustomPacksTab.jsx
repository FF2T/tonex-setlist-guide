// src/app/screens/MyCustomPacksTab.jsx — Phase 7.67.
//
// Tab "📦 Mes presets custom" dans Mon Profil, accessible à TOUS
// les profils (admin et non-admin). Permet à un beta-tester
// d'autonomie d'ajouter ses presets custom (TSR, ML, AA, JS, TJ,
// WT, Galtone, ToneNET, custom) avec metadata enrichie (amp,
// gain, style, scores, usages artiste/morceau).
//
// Avant Phase 7.67, seul un admin pouvait éditer
// `profile.customPacks` (via le tab Vision IA admin ou JS console).
// Conséquence : Sébastien devait faire des fix manuels pour
// Bruno (2 fois en 1 jour : banks + 34 usages enrichis).
//
// Architecture :
// - Édite directement `profile.customPacks` du profil actif.
// - Réutilise le composant `inferPresetInfo` (Phase 7.19) pour
//   auto-suggérer amp/style/gain depuis le nom.
// - Réutilise le helper `cleanUsages` (Phase 7.53 ToneNetTab) pour
//   la validation/dedup des usages artiste+songs.
// - Auto-détecte la source via `inferSource` (regex sur le nom).
// - Persiste avec stamp `lastModified` pour LWW Firestore.

import React, { useState, useMemo } from 'react';
import { t } from '../../i18n/index.js';
import { SOURCE_IDS, SOURCE_LABELS } from '../../core/sources.js';
import { PRESET_CATALOG_MERGED } from '../../core/catalog.js';
import { inferPresetInfo } from '../utils/infer-preset.js';
import { cleanUsages } from './ToneNetTab.jsx';

// Auto-détection de la source depuis le nom du preset. Heuristique
// regex sur les patterns courants des pack creators. Côté UI, le
// dropdown est pré-rempli avec cette valeur (le user peut overrider).
export function inferSource(presetName) {
  const n = String(presetName || '').trim();
  if (!n) return 'custom';
  if (/^TSR\s|^TSR-|\bTSR\b/i.test(n)) return 'TSR';
  if (/^AA\s|amalgam/i.test(n)) return 'AA';
  if (/^JS\s|sadites/i.test(n)) return 'JS';
  if (/^TJ\s|junkie/i.test(n)) return 'TJ';
  if (/^ML\s|\bML\b\s*sound/i.test(n)) return 'ML';
  if (/^WT\s|worship/i.test(n)) return 'WT';
  if (/galtone|kirk\s*&\s*james/i.test(n)) return 'Galtone';
  if (/^(CL|DR|HG|LD|BS|DR\d)\s/i.test(n)) return 'Factory';
  return 'custom';
}

// Liste unique des amps présents dans PRESET_CATALOG_MERGED. Sert à
// peupler la datalist auto-suggest du champ "Ampli source".
function getKnownAmps() {
  const set = new Set();
  for (const entry of Object.values(PRESET_CATALOG_MERGED)) {
    if (entry?.amp && typeof entry.amp === 'string') {
      // Skip les "Stomp - X" génériques.
      if (!entry.amp.startsWith('Stomp -')) set.add(entry.amp);
    }
  }
  return Array.from(set).sort();
}

const STYLE_OPTIONS = ['blues', 'rock', 'hard_rock', 'jazz', 'metal', 'pop'];
const GAIN_OPTIONS = ['low', 'mid', 'high'];

function emptyForm() {
  return {
    name: '',
    src: 'custom',
    amp: '',
    gain: 'mid',
    style: 'rock',
    channel: '',
    scoreHB: 75,
    scoreSC: 75,
    scoreP90: 75,
    usages: [],
    pack: '',
    packMode: 'existing', // 'existing' or 'new'
    newPackName: '',
  };
}

function MyCustomPacksTab({ profile, onProfiles, activeProfileId, songDb, inp }) {
  const customPacks = profile?.customPacks || [];
  const [expandedPackIdx, setExpandedPackIdx] = useState(null);
  const [editingPresetKey, setEditingPresetKey] = useState(null); // 'packIdx:presetIdx' or 'new'
  const [form, setForm] = useState(emptyForm());

  const knownAmps = useMemo(() => getKnownAmps(), []);
  const artistList = useMemo(() => {
    const set = new Set();
    (songDb || []).forEach((s) => { if (s.artist) set.add(s.artist); });
    return Array.from(set).sort();
  }, [songDb]);
  const titleList = useMemo(() => {
    const set = new Set();
    (songDb || []).forEach((s) => { if (s.title) set.add(s.title); });
    return Array.from(set).sort();
  }, [songDb]);

  // Met à jour profile.customPacks dans onProfiles avec un updater
  // qui stamp lastModified pour LWW Firestore.
  const writePacks = (newPacks) => {
    onProfiles((p) => {
      const cur = p[activeProfileId];
      if (!cur) return p;
      return {
        ...p,
        [activeProfileId]: { ...cur, customPacks: newPacks, lastModified: Date.now() },
      };
    });
  };

  const startNew = () => {
    setForm({ ...emptyForm(), pack: customPacks[0]?.name || '' });
    setEditingPresetKey('new');
  };

  const startEdit = (packIdx, presetIdx) => {
    const pack = customPacks[packIdx];
    const preset = pack?.presets?.[presetIdx];
    if (!preset) return;
    setForm({
      name: preset.name || '',
      src: preset.src || 'custom',
      amp: preset.amp || '',
      gain: preset.gain || 'mid',
      style: preset.style || 'rock',
      channel: preset.channel || '',
      scoreHB: preset.scores?.HB ?? 75,
      scoreSC: preset.scores?.SC ?? 75,
      scoreP90: preset.scores?.P90 ?? 75,
      usages: (preset.usages || []).map((u) => ({
        artist: u.artist || '',
        songs: Array.isArray(u.songs) ? u.songs.slice() : [],
      })),
      pack: pack.name,
      packMode: 'existing',
      newPackName: '',
    });
    setEditingPresetKey(`${packIdx}:${presetIdx}`);
  };

  const cancel = () => {
    setEditingPresetKey(null);
    setForm(emptyForm());
  };

  // Auto-suggère la source quand le user tape le nom.
  const onNameChange = (newName) => {
    setForm((f) => {
      const next = { ...f, name: newName };
      // Auto-suggère source uniquement si user n'a pas overridé manuellement.
      // Heuristique : si src est encore 'custom' (defaut) ou identique à l'inferSource précédent, on update.
      const inferred = inferSource(newName);
      const prevInferred = inferSource(f.name);
      if (f.src === 'custom' || f.src === prevInferred) {
        next.src = inferred;
      }
      // Auto-suggère amp/gain/style si vide.
      if (!f.amp) {
        const info = inferPresetInfo(newName);
        if (info?.amp) next.amp = info.amp;
        if (info?.style && f.style === 'rock') next.style = info.style;
        if (info?.gain && f.gain === 'mid') next.gain = info.gain;
      }
      return next;
    });
  };

  const addUsage = () => {
    setForm((f) => ({ ...f, usages: [...f.usages, { artist: '', songs: [] }] }));
  };

  const removeUsage = (idx) => {
    setForm((f) => ({ ...f, usages: f.usages.filter((_, i) => i !== idx) }));
  };

  const updateUsageArtist = (idx, artist) => {
    setForm((f) => ({
      ...f,
      usages: f.usages.map((u, i) => (i === idx ? { ...u, artist } : u)),
    }));
  };

  const addSongToUsage = (idx, title) => {
    const t2 = String(title || '').trim();
    if (!t2) return;
    setForm((f) => ({
      ...f,
      usages: f.usages.map((u, i) =>
        i === idx ? { ...u, songs: Array.from(new Set([...u.songs, t2])) } : u,
      ),
    }));
  };

  const removeSongFromUsage = (idx, songIdx) => {
    setForm((f) => ({
      ...f,
      usages: f.usages.map((u, i) =>
        i === idx ? { ...u, songs: u.songs.filter((_, j) => j !== songIdx) } : u,
      ),
    }));
  };

  const save = () => {
    const name = form.name.trim();
    if (!name) { alert(t('mycustompacks.error-name', 'Nom de preset requis.')); return; }
    const targetPackName = form.packMode === 'new'
      ? form.newPackName.trim()
      : form.pack;
    if (!targetPackName) {
      alert(t('mycustompacks.error-pack', 'Choisis un pack existant ou crée un nouveau pack.'));
      return;
    }
    const cleanedUsages = cleanUsages(form.usages);
    const preset = {
      name,
      src: form.src,
      amp: form.amp.trim() || 'Custom',
      gain: form.gain,
      style: form.style,
      channel: form.channel.trim() || '',
      scores: {
        HB: Math.max(0, Math.min(100, parseInt(form.scoreHB, 10) || 75)),
        SC: Math.max(0, Math.min(100, parseInt(form.scoreSC, 10) || 75)),
        P90: Math.max(0, Math.min(100, parseInt(form.scoreP90, 10) || 75)),
      },
    };
    if (cleanedUsages) preset.usages = cleanedUsages;

    let nextPacks;
    if (editingPresetKey === 'new') {
      // Création — ajouter le preset au pack cible
      const existingPackIdx = customPacks.findIndex((p) => p.name === targetPackName);
      if (existingPackIdx >= 0) {
        // Pack existant — append preset (override si même nom)
        nextPacks = customPacks.map((p, i) => {
          if (i !== existingPackIdx) return p;
          const filtered = (p.presets || []).filter((pr) => pr.name !== name);
          return { ...p, presets: [...filtered, preset] };
        });
      } else {
        // Nouveau pack
        nextPacks = [...customPacks, { name: targetPackName, presets: [preset] }];
      }
    } else {
      // Édition
      const [packIdxStr, presetIdxStr] = editingPresetKey.split(':');
      const oldPackIdx = parseInt(packIdxStr, 10);
      const oldPresetIdx = parseInt(presetIdxStr, 10);
      const oldPackName = customPacks[oldPackIdx]?.name;
      if (oldPackName === targetPackName) {
        // Update in-place
        nextPacks = customPacks.map((p, i) => {
          if (i !== oldPackIdx) return p;
          return {
            ...p,
            presets: (p.presets || []).map((pr, j) => (j === oldPresetIdx ? preset : pr)),
          };
        });
      } else {
        // Déplacement vers un autre pack
        nextPacks = customPacks
          .map((p, i) => {
            if (i === oldPackIdx) {
              return { ...p, presets: (p.presets || []).filter((_, j) => j !== oldPresetIdx) };
            }
            return p;
          })
          .filter((p) => (p.presets || []).length > 0); // drop empty packs

        const targetExists = nextPacks.findIndex((p) => p.name === targetPackName);
        if (targetExists >= 0) {
          nextPacks = nextPacks.map((p, i) => {
            if (i !== targetExists) return p;
            return { ...p, presets: [...(p.presets || []), preset] };
          });
        } else {
          nextPacks = [...nextPacks, { name: targetPackName, presets: [preset] }];
        }
      }
    }
    writePacks(nextPacks);
    cancel();
  };

  const deletePreset = (packIdx, presetIdx) => {
    const pack = customPacks[packIdx];
    const preset = pack?.presets?.[presetIdx];
    if (!preset) return;
    if (!window.confirm(t('mycustompacks.confirm-delete', `Supprimer le preset "${preset.name}" ?`))) return;
    const nextPacks = customPacks
      .map((p, i) => {
        if (i !== packIdx) return p;
        return { ...p, presets: (p.presets || []).filter((_, j) => j !== presetIdx) };
      })
      .filter((p) => (p.presets || []).length > 0); // drop empty pack
    writePacks(nextPacks);
  };

  const sectionStyle = { background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 14, marginBottom: 12 };

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 12 }}>
        {t('mycustompacks.intro', 'Documente tes presets custom (TSR, ML, Amalgam, ToneNET, etc.) avec metadata enrichie. Les usages artiste/morceau aident l\'IA à pinner le bon preset pour chaque song.')}
      </div>

      {customPacks.length === 0 && (
        <div style={{ ...sectionStyle, textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📦</div>
          <div style={{ fontSize: 12 }}>{t('mycustompacks.empty', 'Aucun pack custom pour le moment.')}</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>{t('mycustompacks.empty-hint', 'Clique "+ Ajouter un preset" pour commencer.')}</div>
        </div>
      )}

      {customPacks.map((pack, packIdx) => {
        const isExpanded = expandedPackIdx === packIdx;
        return (
          <div key={packIdx} style={sectionStyle}>
            <div
              onClick={() => setExpandedPackIdx(isExpanded ? null : packIdx)}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, marginBottom: isExpanded ? 10 : 0 }}
            >
              <span style={{ fontSize: 14 }}>{isExpanded ? '▼' : '▶'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{pack.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{(pack.presets || []).length} {t('mycustompacks.presets-count', 'preset(s)')}</div>
              </div>
            </div>
            {isExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(pack.presets || []).map((preset, presetIdx) => {
                  const editKey = `${packIdx}:${presetIdx}`;
                  const isEditing = editingPresetKey === editKey;
                  return (
                    <div key={presetIdx}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--a3)', border: '1px solid var(--a6)', borderRadius: 'var(--r-md)', padding: '6px 10px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preset.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            {preset.amp || '—'} · {preset.gain} gain · {preset.style}
                            {Array.isArray(preset.usages) && preset.usages.length > 0 && (
                              <span style={{ marginLeft: 6, color: 'var(--accent)' }} title={preset.usages.map((u) => u.artist).join(', ')}>🎯 {preset.usages.length}</span>
                            )}
                          </div>
                        </div>
                        <button onClick={() => startEdit(packIdx, presetIdx)} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)', padding: '3px 7px', fontSize: 10, cursor: 'pointer' }}>✏️</button>
                        <button onClick={() => deletePreset(packIdx, presetIdx)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 11, padding: '2px 4px' }}>✕</button>
                      </div>
                      {isEditing && (
                        <PresetForm
                          form={form}
                          setForm={setForm}
                          onNameChange={onNameChange}
                          knownAmps={knownAmps}
                          artistList={artistList}
                          titleList={titleList}
                          customPacks={customPacks}
                          addUsage={addUsage}
                          removeUsage={removeUsage}
                          updateUsageArtist={updateUsageArtist}
                          addSongToUsage={addSongToUsage}
                          removeSongFromUsage={removeSongFromUsage}
                          onSave={save}
                          onCancel={cancel}
                          inp={inp}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Bouton "+ Ajouter un preset" + formulaire création */}
      {editingPresetKey === 'new' ? (
        <div style={sectionStyle}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('mycustompacks.new-preset', '+ Nouveau preset')}</div>
          <PresetForm
            form={form}
            setForm={setForm}
            onNameChange={onNameChange}
            knownAmps={knownAmps}
            artistList={artistList}
            titleList={titleList}
            customPacks={customPacks}
            addUsage={addUsage}
            removeUsage={removeUsage}
            updateUsageArtist={updateUsageArtist}
            addSongToUsage={addSongToUsage}
            removeSongFromUsage={removeSongFromUsage}
            onSave={save}
            onCancel={cancel}
            inp={inp}
          />
        </div>
      ) : (
        <button
          onClick={startNew}
          style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}
        >
          + {t('mycustompacks.add-preset', 'Ajouter un preset')}
        </button>
      )}
    </div>
  );
}

// Formulaire CRUD preset, extrait pour partage entre édition existante
// et création new. Tous les handlers sont fournis par le parent
// MyCustomPacksTab pour préserver l'état du form au niveau parent.
function PresetForm({
  form, setForm, onNameChange, knownAmps, artistList, titleList, customPacks,
  addUsage, removeUsage, updateUsageArtist, addSongToUsage, removeSongFromUsage,
  onSave, onCancel, inp,
}) {
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const [songInputByUsage, setSongInputByUsage] = useState({});
  return (
    <div style={{ background: 'var(--a5)', borderRadius: 'var(--r-md)', padding: 12, marginTop: 6, border: '1px solid var(--a8)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Nom */}
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 3, display: 'block' }}>{t('mycustompacks.field-name', 'Nom du preset')}</label>
          <input
            value={form.name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t('mycustompacks.field-name-placeholder', 'Ex: TSR Mars 800SL Cn1&2 HG')}
            style={{ ...inp, width: '100%', fontSize: 12 }}
          />
        </div>

        {/* Source */}
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 3, display: 'block' }}>{t('mycustompacks.field-source', 'Source')}</label>
          <select value={form.src} onChange={(e) => set('src', e.target.value)} style={{ ...inp, width: '100%', fontSize: 12 }}>
            {SOURCE_IDS.map((id) => (
              <option key={id} value={id}>{SOURCE_LABELS[id] || id}</option>
            ))}
          </select>
        </div>

        {/* Ampli + Gain + Style */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: '2 1 200px' }}>
            <label style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 3, display: 'block' }}>{t('mycustompacks.field-amp', 'Ampli source')}</label>
            <input
              list="known-amps"
              value={form.amp}
              onChange={(e) => set('amp', e.target.value)}
              placeholder={t('mycustompacks.field-amp-placeholder', 'Ex: Mesa Boogie Mark V')}
              style={{ ...inp, width: '100%', fontSize: 12 }}
            />
            <datalist id="known-amps">
              {knownAmps.map((a) => <option key={a} value={a}/>)}
            </datalist>
          </div>
          <div style={{ flex: '1 1 90px' }}>
            <label style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 3, display: 'block' }}>{t('mycustompacks.field-gain', 'Gain')}</label>
            <select value={form.gain} onChange={(e) => set('gain', e.target.value)} style={{ ...inp, width: '100%', fontSize: 12 }}>
              {GAIN_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 120px' }}>
            <label style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 3, display: 'block' }}>{t('mycustompacks.field-style', 'Style')}</label>
            <select value={form.style} onChange={(e) => set('style', e.target.value)} style={{ ...inp, width: '100%', fontSize: 12 }}>
              {STYLE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Channel */}
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 3, display: 'block' }}>{t('mycustompacks.field-channel', 'Channel (optionnel)')}</label>
          <input
            value={form.channel}
            onChange={(e) => set('channel', e.target.value)}
            placeholder={t('mycustompacks.field-channel-placeholder', 'Ex: Clean / Drive / Hi-Gain / Lead')}
            style={{ ...inp, width: '100%', fontSize: 12 }}
          />
        </div>

        {/* Scores HB / SC / P90 */}
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 3, display: 'block' }}>{t('mycustompacks.field-scores', 'Scores de compatibilité (0-100)')}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['HB', 'scoreHB'], ['SC', 'scoreSC'], ['P90', 'scoreP90']].map(([label, key]) => (
              <div key={key} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>{label}</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  style={{ ...inp, width: '100%', fontSize: 12, textAlign: 'center' }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Usages */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--text-sec)' }}>{t('mycustompacks.field-usages', 'Usages artiste / morceau (optionnel, recommandé)')}</label>
            <button onClick={addUsage} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)', padding: '3px 8px', fontSize: 10, cursor: 'pointer' }}>+ {t('mycustompacks.add-artist', 'Artiste')}</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {form.usages.map((u, idx) => (
              <div key={idx} style={{ background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-sm)', padding: 8 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                  <input
                    list="artist-list"
                    value={u.artist}
                    onChange={(e) => updateUsageArtist(idx, e.target.value)}
                    placeholder={t('mycustompacks.usage-artist', 'Artiste / groupe')}
                    style={{ ...inp, flex: 1, fontSize: 11 }}
                  />
                  <button onClick={() => removeUsage(idx)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 12, padding: '2px 6px' }}>✕</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                  {u.songs.map((song, j) => (
                    <span key={j} style={{ fontSize: 10, background: 'var(--a6)', borderRadius: 'var(--r-sm)', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {song}
                      <button onClick={() => removeSongFromUsage(idx, j)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 10, padding: 0 }}>×</button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input
                    list="title-list"
                    value={songInputByUsage[idx] || ''}
                    onChange={(e) => setSongInputByUsage((p) => ({ ...p, [idx]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        addSongToUsage(idx, songInputByUsage[idx] || '');
                        setSongInputByUsage((p) => ({ ...p, [idx]: '' }));
                      }
                    }}
                    placeholder={t('mycustompacks.usage-song-add', '+ Morceau (Enter pour ajouter)')}
                    style={{ ...inp, flex: 1, fontSize: 10 }}
                  />
                  <button
                    onClick={() => {
                      addSongToUsage(idx, songInputByUsage[idx] || '');
                      setSongInputByUsage((p) => ({ ...p, [idx]: '' }));
                    }}
                    style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)', padding: '3px 8px', fontSize: 10, cursor: 'pointer' }}
                  >+</button>
                </div>
              </div>
            ))}
            <datalist id="artist-list">
              {artistList.map((a) => <option key={a} value={a}/>)}
            </datalist>
            <datalist id="title-list">
              {titleList.map((t2) => <option key={t2} value={t2}/>)}
            </datalist>
          </div>
        </div>

        {/* Pack target */}
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 3, display: 'block' }}>{t('mycustompacks.field-pack', 'Pack')}</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--text-sec)' }}>
              <input type="radio" checked={form.packMode === 'existing'} onChange={() => set('packMode', 'existing')}/> {t('mycustompacks.pack-existing', 'Pack existant')}
            </label>
            <label style={{ fontSize: 11, color: 'var(--text-sec)' }}>
              <input type="radio" checked={form.packMode === 'new'} onChange={() => set('packMode', 'new')}/> {t('mycustompacks.pack-new', 'Nouveau pack')}
            </label>
          </div>
          {form.packMode === 'existing' ? (
            <select value={form.pack} onChange={(e) => set('pack', e.target.value)} style={{ ...inp, width: '100%', fontSize: 12 }}>
              <option value="">{t('mycustompacks.pack-select', '— Choisir un pack —')}</option>
              {customPacks.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          ) : (
            <input
              value={form.newPackName}
              onChange={(e) => set('newPackName', e.target.value)}
              placeholder={t('mycustompacks.field-newpack-placeholder', 'Ex: Mon pack metal Mesa')}
              style={{ ...inp, width: '100%', fontSize: 12 }}
            />
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onCancel} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>{t('mycustompacks.cancel', 'Annuler')}</button>
          <button onClick={onSave} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{t('mycustompacks.save', 'Sauvegarder')}</button>
        </div>
      </div>
    </div>
  );
}

export default MyCustomPacksTab;
export { MyCustomPacksTab };

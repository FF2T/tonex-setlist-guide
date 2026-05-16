// src/app/screens/ToneNetTab.jsx — Phase 7.19 (découpage main.jsx).
//
// Onglet "🌐 ToneNET" dans MonProfilScreen. Permet d'ajouter
// manuellement les presets téléchargés depuis ToneNET (capture
// communauté). Pré-remplissage auto via inferPresetInfo (amp/gain/
// style inférés depuis le nom).

import React, { useState, useMemo } from 'react';
import { t, tFormat, tPlural } from '../../i18n/index.js';
import { inferPresetInfo } from '../utils/infer-preset.js';

const GAIN_OPTS = ['low', 'mid', 'high'];
const STYLE_OPTS = [
  { v: 'blues', l: 'Blues' },
  { v: 'rock', l: 'Rock' },
  { v: 'hard_rock', l: 'Hard Rock' },
  { v: 'jazz', l: 'Jazz' },
  { v: 'pop', l: 'Pop' },
  { v: 'metal', l: 'Metal' },
];

function suggestStyleFromAmp(ampName) {
  if (!ampName) return null;
  const al = ampName.toLowerCase();
  if (/laney|mesa|rectifier|5150|peavey|engl|diezel|soldano|bogner|friedman/.test(al)) return 'hard_rock';
  if (/fender|princeton|twin|deluxe|bassman|champ/.test(al)) return 'blues';
  if (/vox|ac30|ac15|matchless|budda/.test(al)) return 'rock';
  if (/dumble|two rock|carr/.test(al)) return 'blues';
  if (/roland|jazz/.test(al)) return 'jazz';
  return null;
}

function ToneNetTab({ toneNetPresets, onToneNetPresets, inp, songDb }) {
  const [name, setName] = useState('');
  const [amp, setAmp] = useState('');
  const [gain, setGain] = useState('mid');
  const [style, setStyle] = useState('rock');
  const [channel, setChannel] = useState('');
  const [cab, setCab] = useState('');
  const [comment, setComment] = useState('');
  // Phase 7.53 — Usages artiste/morceau (édition par l'utilisateur).
  // Format : [{artist: string, songs: string[]}]. Songs optionnel.
  // Persisté tel quel sur le preset, recopié dans PRESET_CATALOG_MERGED
  // via useMemo main.jsx → exploité par buildInstalledSlotsSection
  // (prompt IA Phase 7.52.1) et findSlotByUsageMatch (Phase 7.52.5/.6).
  const [usages, setUsages] = useState([]);
  const [showUsages, setShowUsages] = useState(false);
  // Phase 7.53 fix 2 — Drafts des inputs songs uncontrolled. Stocke
  // la valeur en cours par index d'usage. Flush automatique au save
  // pour éviter de perdre le texte tapé non-confirmé par Enter.
  const [songDrafts, setSongDrafts] = useState({});
  const [editId, setEditId] = useState(null);
  const [autoFilled, setAutoFilled] = useState(false);

  // Liste unique de titres pour datalist (autocomplete songs)
  const songTitles = useMemo(() => {
    const set = new Set();
    (songDb || []).forEach((s) => { if (s.title) set.add(s.title); });
    return Array.from(set).sort();
  }, [songDb]);

  // Liste unique d'artistes pour datalist
  const artistList = useMemo(() => {
    const set = new Set();
    (songDb || []).forEach((s) => { if (s.artist) set.add(s.artist); });
    return Array.from(set).sort();
  }, [songDb]);

  const onAmpChange = (val) => {
    setAmp(val);
    const suggested = suggestStyleFromAmp(val);
    if (suggested) setStyle(suggested);
  };
  const resetForm = () => { setName(''); setAmp(''); setGain('mid'); setStyle('rock'); setChannel(''); setCab(''); setComment(''); setUsages([]); setSongDrafts({}); setShowUsages(false); setEditId(null); setAutoFilled(false); };

  // Phase 7.53 fix 2 — Flush des drafts songs dans usages avant
  // sérialisation au save. Retourne la nouvelle valeur SANS muter
  // le state (le caller doit setUsages + setSongDrafts({}) après).
  const flushSongDrafts = () => usages.map((u, idx) => {
    const draft = (songDrafts[idx] || '').trim();
    if (!draft) return u;
    return { ...u, songs: Array.from(new Set([...(u.songs || []), draft])) };
  });
  const onNameChange = (val) => {
    setName(val);
    if (editId) return;
    const info = inferPresetInfo(val);
    if (info) {
      if (info.amp) setAmp(info.amp);
      setGain(info.gain);
      setStyle(info.style);
      if (info.channel) setChannel(info.channel);
      setAutoFilled(true);
    }
  };
  // cf cleanUsages exporté plus bas (extrait pour testabilité Phase 7.53).
  const addPreset = () => {
    if (!name.trim()) return;
    // Phase 7.53.1 — stamp lastModified pour merge LWW per-item Firestore.
    const p = { id: `tn_${Date.now()}`, name: name.trim(), amp: amp.trim() || 'ToneNET', gain, style, channel: channel.trim(), cab: cab.trim(), comment: comment.trim(), scores: { HB: 75, SC: 75, P90: 75 }, lastModified: Date.now() };
    // Phase 7.53 fix 2 — flush des drafts songs avant clean (sinon les
    // titres tapés mais pas validés par Enter sont perdus au save).
    const usagesClean = cleanUsages(flushSongDrafts());
    if (usagesClean) p.usages = usagesClean;
    onToneNetPresets((prev) => [...prev, p]); resetForm();
  };
  const saveEdit = () => {
    if (!name.trim() || !editId) return;
    const flushed = flushSongDrafts();
    onToneNetPresets((prev) => prev.map((p) => {
      if (p.id !== editId) return p;
      // Phase 7.53.1 — stamp lastModified pour LWW
      const next = { ...p, name: name.trim(), amp: amp.trim() || 'ToneNET', gain, style, channel: channel.trim(), cab: cab.trim(), comment: comment.trim(), lastModified: Date.now() };
      const usagesClean = cleanUsages(flushed);
      if (usagesClean) next.usages = usagesClean;
      else delete next.usages;
      return next;
    })); resetForm();
  };
  const startEdit = (p) => {
    setEditId(p.id); setName(p.name); setAmp(p.amp === 'ToneNET' ? '' : p.amp);
    setGain(p.gain); setStyle(p.style); setChannel(p.channel || '');
    setCab(p.cab || ''); setComment(p.comment || '');
    // Phase 7.53 — recharge les usages existants pour édition
    setUsages(Array.isArray(p.usages) ? p.usages.map((u) => ({ artist: u.artist || '', songs: Array.isArray(u.songs) ? [...u.songs] : [] })) : []);
    setShowUsages(Array.isArray(p.usages) && p.usages.length > 0);
    setAutoFilled(false);
  };
  const deletePreset = (id) => onToneNetPresets((prev) => prev.filter((p) => p.id !== id));
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{t('tonenet.title', 'Presets ToneNET')}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 12 }}>{t('tonenet.intro', 'Ajoute les presets que tu as téléchargés depuis ToneNET.')}</div>
      <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--border-accent)', borderRadius: 'var(--r-lg)', padding: 'var(--s-4)', marginBottom: 'var(--s-4)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', color: 'var(--accent)', marginBottom: 'var(--s-3)' }}>{editId ? t('tonenet.edit-preset', 'Modifier le preset') : t('tonenet.add-preset', 'Ajouter un preset')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
          <input placeholder={t('tonenet.preset-name', 'Nom du preset *')} value={name} onChange={(e) => onNameChange(e.target.value)} style={{ ...inp, fontSize: 13 }}/>
          <div style={{ position: 'relative' }}>
            <input placeholder={t('tonenet.amp-model', "Modèle d'ampli (ex: Fender Twin)")} value={amp} onChange={(e) => { onAmpChange(e.target.value); setAutoFilled(false); }} style={{ ...inp, fontSize: 13 }}/>
            {autoFilled && amp && <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{t('tonenet.auto', 'auto')}</span>}
          </div>
          <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
            <select value={gain} onChange={(e) => setGain(e.target.value)} style={{ ...inp, flex: 1, fontSize: 13 }}>
              {GAIN_OPTS.map((g) => <option key={g} value={g}>{g === 'low' ? t('tonenet.gain-low', 'Low gain') : g === 'mid' ? t('tonenet.gain-mid', 'Mid gain') : t('tonenet.gain-high', 'High gain')}</option>)}
            </select>
            <select value={style} onChange={(e) => setStyle(e.target.value)} style={{ ...inp, flex: 1, fontSize: 13 }}>
              {STYLE_OPTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
            <input placeholder={t('tonenet.channel', 'Canal (ex: Ch1, Clean, Lead)')} value={channel} onChange={(e) => setChannel(e.target.value)} style={{ ...inp, flex: 1, fontSize: 12 }}/>
            <input placeholder={t('tonenet.cab', 'Cab (ex: 4x12 Greenback)')} value={cab} onChange={(e) => setCab(e.target.value)} style={{ ...inp, flex: 1, fontSize: 12 }}/>
          </div>
          <input placeholder={t('tonenet.notes', 'Notes (optionnel)')} value={comment} onChange={(e) => setComment(e.target.value)} style={{ ...inp, fontSize: 12 }}/>
          {/* Phase 7.53 — Section Usages artiste/morceau (collapsable) */}
          <datalist id="tonenet-artist-list">
            {artistList.map((a) => <option key={a} value={a}/>)}
          </datalist>
          <datalist id="tonenet-song-list">
            {songTitles.map((s) => <option key={s} value={s}/>)}
          </datalist>
          <button
            type="button"
            onClick={() => setShowUsages((v) => !v)}
            style={{ background: 'transparent', border: '1px dashed var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 'var(--r-md)', padding: '6px 10px', fontSize: 11, cursor: 'pointer', textAlign: 'left' }}
          >
            {showUsages ? '▾' : '▸'} {t('tonenet.usages-toggle', 'Usages artiste / morceau (optionnel)')}
            {usages.length > 0 && <span style={{ marginLeft: 6, color: 'var(--accent)', fontSize: 10 }}>{usages.length}</span>}
          </button>
          {showUsages && (
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-md)', padding: 'var(--s-2)', display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                {t('tonenet.usages-hint', 'Tagger ce preset pour des artistes/morceaux précis fait remonter ce slot en priorité dans la reco IA quand le morceau analysé match.')}
              </div>
              {usages.map((u, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bg-elev-1)', borderRadius: 'var(--r-sm)', padding: 'var(--s-2)' }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input
                      placeholder={t('tonenet.usage-artist', 'Artiste (ex: Black Sabbath)')}
                      list="tonenet-artist-list"
                      value={u.artist}
                      onChange={(e) => {
                        const v = e.target.value;
                        setUsages((prev) => prev.map((x, i) => i === idx ? { ...x, artist: v } : x));
                      }}
                      style={{ ...inp, flex: 1, fontSize: 12 }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setUsages((prev) => prev.filter((_, i) => i !== idx));
                        setSongDrafts({}); // clear pour éviter index-shift
                      }}
                      style={{ background: 'var(--red-bg)', border: 'none', borderRadius: 'var(--r-sm)', padding: '4px 8px', fontSize: 10, color: 'var(--danger)', cursor: 'pointer' }}
                      title={t('tonenet.usage-remove', 'Retirer cet artiste')}
                    >✕</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                    {(u.songs || []).map((song, si) => (
                      <span key={si} style={{ background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 10, padding: '2px 6px', borderRadius: 'var(--r-sm)', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                        {song}
                        <button
                          type="button"
                          onClick={() => setUsages((prev) => prev.map((x, i) => i === idx ? { ...x, songs: x.songs.filter((_, j) => j !== si) } : x))}
                          style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 10, cursor: 'pointer', padding: 0 }}
                        >×</button>
                      </span>
                    ))}
                    <input
                      placeholder={t('tonenet.usage-song-add', '+ Morceau (Enter ou Sauver pour ajouter)')}
                      list="tonenet-song-list"
                      value={songDrafts[idx] || ''}
                      onChange={(e) => setSongDrafts((prev) => ({ ...prev, [idx]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const v = (songDrafts[idx] || '').trim();
                          if (!v) return;
                          setUsages((prev) => prev.map((x, i) => i === idx ? { ...x, songs: Array.from(new Set([...(x.songs || []), v])) } : x));
                          setSongDrafts((prev) => ({ ...prev, [idx]: '' }));
                        }
                      }}
                      style={{ ...inp, flex: 1, minWidth: 120, fontSize: 11 }}
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setUsages((prev) => [...prev, { artist: '', songs: [] }])}
                style={{ background: 'transparent', border: '1px dashed var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 'var(--r-sm)', padding: '6px', fontSize: 11, cursor: 'pointer' }}
              >+ {t('tonenet.usage-add', 'Ajouter un artiste')}</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
            {editId ? <>
              <button onClick={saveEdit} disabled={!name.trim()} style={{ flex: 1, background: name.trim() ? 'var(--accent)' : 'var(--bg-elev-3)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '8px', fontSize: 12, fontWeight: 700, cursor: name.trim() ? 'pointer' : 'not-allowed' }}>{t('tonenet.save', 'Sauver')}</button>
              <button onClick={resetForm} style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}>{t('tonenet.cancel', 'Annuler')}</button>
            </> : <button onClick={addPreset} disabled={!name.trim()} style={{ width: '100%', background: name.trim() ? 'linear-gradient(180deg,var(--brass-200),var(--brass-400))' : 'var(--bg-elev-3)', border: 'none', color: name.trim() ? 'var(--tolex-900)' : 'var(--text-tertiary)', borderRadius: 'var(--r-md)', padding: '8px', fontSize: 12, fontWeight: 700, cursor: name.trim() ? 'pointer' : 'not-allowed', boxShadow: name.trim() ? 'var(--shadow-sm)' : 'none' }}>{t('tonenet.add', '+ Ajouter')}</button>}
          </div>
        </div>
      </div>
      {toneNetPresets.length === 0 ? <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)', fontSize: 12 }}>{t('tonenet.empty', 'Aucun preset ToneNET ajouté')}</div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', marginBottom: 2 }}>{tPlural('tonenet.presets-count', toneNetPresets.length, {}, { one: '1 preset', other: '{count} presets' })}</div>
          {toneNetPresets.map((p) => (
            <div key={p.id} style={{ background: editId === p.id ? 'var(--accent-soft)' : 'var(--bg-elev-1)', border: editId === p.id ? '1px solid var(--border-accent)' : '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: 'var(--s-3) var(--s-4)', display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{p.amp && p.amp !== 'ToneNET' ? p.amp + ' · ' : ''}{p.channel ? p.channel + ' · ' : ''}{p.gain} gain · {STYLE_OPTS.find((s) => s.v === p.style)?.l || p.style}{p.cab ? ' · ' + p.cab : ''}</div>
                {p.comment && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: 1 }}>{p.comment}</div>}
                {Array.isArray(p.usages) && p.usages.length > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 2 }}>
                    🎯 {p.usages.map((u) => u.artist + (u.songs?.length ? ` (${u.songs.length})` : '')).join(' · ')}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button onClick={() => startEdit(p)} style={{ background: 'var(--bg-elev-2)', border: 'none', borderRadius: 'var(--r-sm)', padding: '4px 8px', fontSize: 10, color: 'var(--text-secondary)', cursor: 'pointer' }}>✏️</button>
                <button onClick={() => deletePreset(p.id)} style={{ background: 'var(--red-bg)', border: 'none', borderRadius: 'var(--r-sm)', padding: '4px 8px', fontSize: 10, color: 'var(--danger)', cursor: 'pointer' }}>🗑</button>
              </div>
            </div>
          ))}
        </div>}
    </div>
  );
}

// Phase 7.53 — Sanitize usages avant persist : strip artistes vides,
// dedup songs, garde tableau compact. Si tous les usages sont vides,
// retourne undefined pour ne pas polluer le preset avec usages: [].
// Helper pur exporté pour testabilité Vitest.
export function cleanUsages(raw) {
  const out = (raw || [])
    .map((u) => ({
      artist: String(u?.artist || '').trim(),
      songs: Array.from(new Set((u?.songs || []).map((s) => String(s || '').trim()).filter(Boolean))),
    }))
    .filter((u) => u.artist.length > 0);
  return out.length > 0 ? out : undefined;
}

export default ToneNetTab;
export { ToneNetTab };

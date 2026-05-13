// src/app/screens/ToneNetTab.jsx — Phase 7.19 (découpage main.jsx).
//
// Onglet "🌐 ToneNET" dans MonProfilScreen. Permet d'ajouter
// manuellement les presets téléchargés depuis ToneNET (capture
// communauté). Pré-remplissage auto via inferPresetInfo (amp/gain/
// style inférés depuis le nom).

import React, { useState } from 'react';
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

function ToneNetTab({ toneNetPresets, onToneNetPresets, inp }) {
  const [name, setName] = useState('');
  const [amp, setAmp] = useState('');
  const [gain, setGain] = useState('mid');
  const [style, setStyle] = useState('rock');
  const [channel, setChannel] = useState('');
  const [cab, setCab] = useState('');
  const [comment, setComment] = useState('');
  const [editId, setEditId] = useState(null);
  const [autoFilled, setAutoFilled] = useState(false);

  const onAmpChange = (val) => {
    setAmp(val);
    const suggested = suggestStyleFromAmp(val);
    if (suggested) setStyle(suggested);
  };
  const resetForm = () => { setName(''); setAmp(''); setGain('mid'); setStyle('rock'); setChannel(''); setCab(''); setComment(''); setEditId(null); setAutoFilled(false); };
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
  const addPreset = () => {
    if (!name.trim()) return;
    const p = { id: `tn_${Date.now()}`, name: name.trim(), amp: amp.trim() || 'ToneNET', gain, style, channel: channel.trim(), cab: cab.trim(), comment: comment.trim(), scores: { HB: 75, SC: 75, P90: 75 } };
    onToneNetPresets((prev) => [...prev, p]); resetForm();
  };
  const saveEdit = () => {
    if (!name.trim() || !editId) return;
    onToneNetPresets((prev) => prev.map((p) => p.id === editId ? { ...p, name: name.trim(), amp: amp.trim() || 'ToneNET', gain, style, channel: channel.trim(), cab: cab.trim(), comment: comment.trim() } : p)); resetForm();
  };
  const startEdit = (p) => { setEditId(p.id); setName(p.name); setAmp(p.amp === 'ToneNET' ? '' : p.amp); setGain(p.gain); setStyle(p.style); setChannel(p.channel || ''); setCab(p.cab || ''); setComment(p.comment || ''); setAutoFilled(false); };
  const deletePreset = (id) => onToneNetPresets((prev) => prev.filter((p) => p.id !== id));
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Presets ToneNET</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 12 }}>Ajoute les presets que tu as téléchargés depuis ToneNET.</div>
      <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--border-accent)', borderRadius: 'var(--r-lg)', padding: 'var(--s-4)', marginBottom: 'var(--s-4)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', color: 'var(--accent)', marginBottom: 'var(--s-3)' }}>{editId ? 'Modifier le preset' : 'Ajouter un preset'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
          <input placeholder="Nom du preset *" value={name} onChange={(e) => onNameChange(e.target.value)} style={{ ...inp, fontSize: 13 }}/>
          <div style={{ position: 'relative' }}>
            <input placeholder="Modèle d'ampli (ex: Fender Twin)" value={amp} onChange={(e) => { onAmpChange(e.target.value); setAutoFilled(false); }} style={{ ...inp, fontSize: 13 }}/>
            {autoFilled && amp && <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>auto</span>}
          </div>
          <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
            <select value={gain} onChange={(e) => setGain(e.target.value)} style={{ ...inp, flex: 1, fontSize: 13 }}>
              {GAIN_OPTS.map((g) => <option key={g} value={g}>{g === 'low' ? 'Low gain' : g === 'mid' ? 'Mid gain' : 'High gain'}</option>)}
            </select>
            <select value={style} onChange={(e) => setStyle(e.target.value)} style={{ ...inp, flex: 1, fontSize: 13 }}>
              {STYLE_OPTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
            <input placeholder="Canal (ex: Ch1, Clean, Lead)" value={channel} onChange={(e) => setChannel(e.target.value)} style={{ ...inp, flex: 1, fontSize: 12 }}/>
            <input placeholder="Cab (ex: 4x12 Greenback)" value={cab} onChange={(e) => setCab(e.target.value)} style={{ ...inp, flex: 1, fontSize: 12 }}/>
          </div>
          <input placeholder="Notes (optionnel)" value={comment} onChange={(e) => setComment(e.target.value)} style={{ ...inp, fontSize: 12 }}/>
          <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
            {editId ? <>
              <button onClick={saveEdit} disabled={!name.trim()} style={{ flex: 1, background: name.trim() ? 'var(--accent)' : 'var(--bg-elev-3)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '8px', fontSize: 12, fontWeight: 700, cursor: name.trim() ? 'pointer' : 'not-allowed' }}>Sauver</button>
              <button onClick={resetForm} style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}>Annuler</button>
            </> : <button onClick={addPreset} disabled={!name.trim()} style={{ width: '100%', background: name.trim() ? 'linear-gradient(180deg,var(--brass-200),var(--brass-400))' : 'var(--bg-elev-3)', border: 'none', color: name.trim() ? 'var(--tolex-900)' : 'var(--text-tertiary)', borderRadius: 'var(--r-md)', padding: '8px', fontSize: 12, fontWeight: 700, cursor: name.trim() ? 'pointer' : 'not-allowed', boxShadow: name.trim() ? 'var(--shadow-sm)' : 'none' }}>+ Ajouter</button>}
          </div>
        </div>
      </div>
      {toneNetPresets.length === 0 ? <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)', fontSize: 12 }}>Aucun preset ToneNET ajouté</div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', marginBottom: 2 }}>{toneNetPresets.length} preset{toneNetPresets.length > 1 ? 's' : ''}</div>
          {toneNetPresets.map((p) => (
            <div key={p.id} style={{ background: editId === p.id ? 'var(--accent-soft)' : 'var(--bg-elev-1)', border: editId === p.id ? '1px solid var(--border-accent)' : '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: 'var(--s-3) var(--s-4)', display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{p.amp && p.amp !== 'ToneNET' ? p.amp + ' · ' : ''}{p.channel ? p.channel + ' · ' : ''}{p.gain} gain · {STYLE_OPTS.find((s) => s.v === p.style)?.l || p.style}{p.cab ? ' · ' + p.cab : ''}</div>
                {p.comment && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: 1 }}>{p.comment}</div>}
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

export default ToneNetTab;
export { ToneNetTab };

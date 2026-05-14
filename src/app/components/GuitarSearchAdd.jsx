// src/app/components/GuitarSearchAdd.jsx — Phase 7.18 (découpage main.jsx).
//
// Mini-form pour ajouter une guitare custom à un profil :
// - recherche IA (Gemini) qui propose name/short/type à partir d'une
//   description libre, puis confirmation utilisateur ;
// - saisie manuelle (fallback) si pas de clé API ou pour les cas
//   simples.

import React, { useState } from 'react';
import { t } from '../../i18n/index.js';
import { safeParseJSON } from '../utils/ai-helpers.js';
import { getSharedGeminiKey } from '../utils/shared-key.js';
import { TYPE_COLORS, TYPE_LABELS } from '../utils/ui-constants.js';

function GuitarSearchAdd({ inp, aiKeys, onAdd }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [err, setErr] = useState(null);
  const [manual, setManual] = useState(false);
  const [mName, setMName] = useState('');
  const [mShort, setMShort] = useState('');
  const [mType, setMType] = useState('HB');

  const search = () => {
    if (!query.trim()) return;
    const key = aiKeys?.gemini || aiKeys?.anthropic || getSharedGeminiKey();
    if (!key) { setErr(t('guitar-add.api-key-missing', 'Clé API manquante')); return; }
    setLoading(true); setErr(null); setSuggestion(null);
    const prompt = `L'utilisateur veut ajouter une guitare à son profil. Il a tapé : "${query.trim()}"
Identifie le modèle exact de guitare (marque + modèle + variante si mentionnée).
Détermine le type de micro principal : HB (humbucker), SC (single coil) ou P90.
Propose un nom abrégé court (ex: "Strat 60s", "LP Standard", "Tele 72", "SG 61", "ES-335").
Réponds UNIQUEMENT en JSON (sans markdown) : {"name":"Nom complet (Marque Modèle)","short":"Abrégé court","type":"HB|SC|P90","confidence":"high|medium|low"}`;
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) })
      .then((r) => r.json()).then((d) => { if (d.error) throw new Error(d.error.message); return safeParseJSON(d.candidates?.[0]?.content?.parts?.[0]?.text || ''); })
      .then((s) => setSuggestion(s)).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  };

  const confirm = () => {
    if (suggestion) { onAdd(suggestion.name, suggestion.short, suggestion.type); setSuggestion(null); setQuery(''); }
  };
  const addManual = () => {
    if (mName.trim() && mShort.trim()) { onAdd(mName.trim(), mShort.trim(), mType); setMName(''); setMShort(''); setMType('HB'); setManual(false); }
  };

  return (
    <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-soft)', borderRadius: 'var(--r-lg)', padding: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginBottom: 8 }}>{t('guitar-add.title', '+ Ajouter une guitare')}</div>
      {!manual ? <>
        <div style={{ display: 'flex', gap: 6, marginBottom: suggestion || err ? 8 : 0 }}>
          <input placeholder={t('guitar-add.search-placeholder', 'Ex: telecaster 72, les paul junior...')} value={query} onChange={(e) => { setQuery(e.target.value); setSuggestion(null); }} onKeyDown={(e) => e.key === 'Enter' && search()} style={{ ...inp, flex: 1, fontSize: 11, padding: '6px 10px' }}/>
          <button onClick={search} disabled={!query.trim() || loading} style={{ background: !query.trim() || loading ? 'var(--bg-disabled)' : 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: !query.trim() || loading ? 'not-allowed' : 'pointer' }}>{loading ? '...' : '🔍'}</button>
        </div>
        {err && <div style={{ fontSize: 10, color: 'var(--red)', marginBottom: 6 }}>{err}</div>}
        {suggestion && <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: 'var(--r-md)', padding: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{suggestion.name}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-sec)' }}>{suggestion.short}</span>
            <span style={{ fontSize: 10, color: `rgb(${TYPE_COLORS[suggestion.type] || '99,102,241'})`, background: `rgba(${TYPE_COLORS[suggestion.type] || '99,102,241'},0.15)`, borderRadius: 'var(--r-sm)', padding: '1px 7px', fontWeight: 700 }}>{suggestion.type} — {TYPE_LABELS[suggestion.type]}</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={confirm} style={{ background: 'var(--green)', border: 'none', color: 'var(--bg)', borderRadius: 'var(--r-md)', padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{t('guitar-add.add', 'Ajouter')}</button>
            <button onClick={() => setSuggestion(null)} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>{t('guitar-add.correct', 'Corriger')}</button>
          </div>
        </div>}
        <button onClick={() => setManual(true)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 10, cursor: 'pointer', padding: '6px 0 0', textDecoration: 'underline' }}>{t('guitar-add.manual', 'Saisie manuelle')}</button>
      </> : <>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          <input placeholder={t('guitar-add.full-name', 'Nom complet')} value={mName} onChange={(e) => setMName(e.target.value)} style={{ ...inp, flex: '1 1 120px', fontSize: 11, padding: '5px 8px' }}/>
          <input placeholder={t('guitar-add.short-name', 'Abrégé')} value={mShort} onChange={(e) => setMShort(e.target.value)} style={{ ...inp, flex: '0 1 80px', fontSize: 11, padding: '5px 8px' }}/>
          <select value={mType} onChange={(e) => setMType(e.target.value)} style={{ ...inp, flex: '0 0 60px', fontSize: 11, padding: '5px 4px' }}>
            <option value="HB">HB</option><option value="SC">SC</option><option value="P90">P90</option>
          </select>
          <button onClick={addManual} disabled={!mName.trim() || !mShort.trim()} style={{ background: mName.trim() && mShort.trim() ? 'var(--accent)' : 'var(--bg-disabled)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: mName.trim() && mShort.trim() ? 'pointer' : 'not-allowed' }}>{t('guitar-add.add', 'Ajouter')}</button>
        </div>
        <button onClick={() => setManual(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 10, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>{t('guitar-add.back-to-ai', '← Recherche IA')}</button>
      </>}
    </div>
  );
}

export default GuitarSearchAdd;
export { GuitarSearchAdd };

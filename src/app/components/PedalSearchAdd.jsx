// src/app/components/PedalSearchAdd.jsx — Phase C (pédalier physique).
//
// Mini-form pour ajouter une pédale d'effet custom à un profil. Mirror de
// AmpSearchAdd : recherche IA Gemini (identifie marque/type/vrais potards/refs
// depuis le nom) → confirmation ; fallback saisie manuelle (nom + marque +
// dropdown type). Les potards enrichis alimentent le prompt fetchAI
// (pedalboard_settings 0-10 par morceau).

import React, { useState } from 'react';
import { t } from '../../i18n/index.js';
import { safeParseJSON, sanitizePedalSuggestion } from '../utils/ai-helpers.js';
import { getSharedGeminiKey } from '../utils/shared-key.js';
import { PEDAL_TYPES } from '../../core/pedals.js';

function PedalSearchAdd({ inp, aiKeys, onAdd, disabled }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [err, setErr] = useState(null);
  const [manual, setManual] = useState(false);
  const [mName, setMName] = useState('');
  const [mBrand, setMBrand] = useState('');
  const [mType, setMType] = useState('drive');

  const search = () => {
    if (!query.trim()) return;
    const key = aiKeys?.gemini || aiKeys?.anthropic || getSharedGeminiKey();
    if (!key) { setErr(t('pedal-add.api-key-missing', 'Clé API manquante')); return; }
    setLoading(true); setErr(null); setSuggestion(null);
    const prompt = `L'utilisateur veut ajouter une pédale d'effet guitare physique à son pédalier. Il a tapé : "${query.trim()}"
Identifie le modèle exact (marque + modèle). Le "type" DOIT être l'une de ces valeurs exactes : ${PEDAL_TYPES.join(', ')}.
Réponds UNIQUEMENT en JSON (sans markdown) :
{"name":"Nom complet (Marque Modèle)","brand":"Marque","type":"un type de la liste","knobs":["liste des VRAIS potards en façade, ex: drive, tone, level"],"refs":{"fr":"1 artiste/usage emblématique","en":"same in English","es":"mismo en español"},"confidence":"high|medium|low"}
Les potards doivent correspondre aux VRAIS contrôles de cette pédale (pas génériques).`;
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) })
      .then((r) => r.json()).then((d) => { if (d.error) throw new Error(d.error.message); return safeParseJSON(d.candidates?.[0]?.content?.parts?.[0]?.text || ''); })
      .then((raw) => {
        const clean = sanitizePedalSuggestion(raw, PEDAL_TYPES);
        if (!clean) throw new Error(t('pedal-add.parse-error', "L'IA n'a pas pu identifier cette pédale."));
        setSuggestion(clean);
      })
      .catch((e) => setErr(e.message)).finally(() => setLoading(false));
  };

  const confirm = () => {
    if (suggestion) { onAdd(suggestion); setSuggestion(null); setQuery(''); }
  };
  const addManual = () => {
    if (!mName.trim()) return;
    const p = sanitizePedalSuggestion({ name: mName.trim(), brand: mBrand.trim(), type: mType }, PEDAL_TYPES);
    if (p) { onAdd(p); setMName(''); setMBrand(''); setMType('drive'); setManual(false); }
  };

  return (
    <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-soft)', borderRadius: 'var(--r-lg)', padding: 12, marginTop: 8, opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }} title={disabled ? t('demo.blocked', 'Action désactivée en mode démo') : undefined} aria-disabled={disabled ? 'true' : undefined}>
      <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginBottom: 8 }}>{t('pedal-add.title', '+ Ajouter une pédale')}</div>
      {!manual ? <>
        <div style={{ display: 'flex', gap: 6, marginBottom: suggestion || err ? 8 : 0 }}>
          <input placeholder={t('pedal-add.search-placeholder', 'Ex: Tube Screamer, Big Muff, Carbon Copy...')} value={query} onChange={(e) => { setQuery(e.target.value); setSuggestion(null); }} onKeyDown={(e) => e.key === 'Enter' && search()} style={{ ...inp, flex: 1, fontSize: 12, padding: '6px 10px' }}/>
          <button onClick={search} disabled={!query.trim() || loading} style={{ background: !query.trim() || loading ? 'var(--bg-disabled)' : 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: !query.trim() || loading ? 'not-allowed' : 'pointer' }}>{loading ? '…' : t('pedal-add.search', 'Analyser')}</button>
        </div>
        {err && <div style={{ fontSize: 10, color: 'var(--red)', marginBottom: 6 }}>{err}</div>}
        {suggestion && <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: 'var(--r-md)', padding: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{suggestion.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 4 }}>{suggestion.brand} · {t(`pedal-type.${suggestion.type}`, suggestion.type)}</div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>{t('pedal-add.knobs-label', 'Potards')} : {suggestion.knobs.map((k) => k.replace(/_/g, ' ')).join(' · ')}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={confirm} style={{ background: 'var(--green)', border: 'none', color: 'var(--bg)', borderRadius: 'var(--r-md)', padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{t('pedal-add.add', 'Ajouter')}</button>
            <button onClick={() => setSuggestion(null)} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>{t('pedal-add.correct', 'Corriger')}</button>
          </div>
        </div>}
        <button onClick={() => setManual(true)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 10, cursor: 'pointer', padding: '6px 0 0', textDecoration: 'underline' }}>{t('pedal-add.manual', 'Saisie manuelle')}</button>
      </> : <>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          <input placeholder={t('pedal-add.full-name', 'Nom complet')} value={mName} onChange={(e) => setMName(e.target.value)} style={{ ...inp, flex: '1 1 160px', fontSize: 12, padding: '6px 10px' }}/>
          <input placeholder={t('pedal-add.brand', 'Marque')} value={mBrand} onChange={(e) => setMBrand(e.target.value)} style={{ ...inp, flex: '1 1 90px', fontSize: 12, padding: '6px 10px' }}/>
          <select value={mType} onChange={(e) => setMType(e.target.value)} style={{ ...inp, flex: '0 0 110px', fontSize: 12, padding: '6px 6px' }}>
            {PEDAL_TYPES.map((ty) => <option key={ty} value={ty}>{t(`pedal-type.${ty}`, ty)}</option>)}
          </select>
          <button onClick={addManual} disabled={!mName.trim()} style={{ background: mName.trim() ? 'var(--accent)' : 'var(--bg-disabled)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: mName.trim() ? 'pointer' : 'not-allowed' }}>{t('pedal-add.add', 'Ajouter')}</button>
        </div>
        <button onClick={() => setManual(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 10, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>{t('pedal-add.back-to-ai', '← Recherche IA')}</button>
      </>}
    </div>
  );
}

export default PedalSearchAdd;
export { PedalSearchAdd };

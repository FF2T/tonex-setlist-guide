// src/app/components/AmpSearchAdd.jsx — Phase B.1 (2026-05-28).
//
// Mini-form pour ajouter un ampli traditionnel custom à un profil
// (guitare OU basse, via la prop `instrument`). Mirror de GuitarSearchAdd :
// - recherche IA (Gemini) qui identifie l'ampli et en déduit les vrais
//   potards / canaux / EQ / wattage / marque / refs depuis son nom, puis
//   confirmation utilisateur ;
// - saisie manuelle (fallback) si pas de clé API ou cas simple.
//
// L'enrichissement IA des potards est important : fetchAI sérialise
// `amp.knobs` dans le prompt morceau → des potards précis = des réglages
// "Sur ton ampli" pertinents par morceau (sinon defaults génériques).

import React, { useState } from 'react';
import { t } from '../../i18n/index.js';
import { safeParseJSON, sanitizeAmpSuggestion } from '../utils/ai-helpers.js';
import { getSharedGeminiKey } from '../utils/shared-key.js';

function AmpSearchAdd({ inp, aiKeys, instrument, onAdd, disabled }) {
  const isBass = instrument === 'bass';
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [err, setErr] = useState(null);
  const [manual, setManual] = useState(false);
  const [mName, setMName] = useState('');
  const [mBrand, setMBrand] = useState('');
  const [mWatt, setMWatt] = useState('');

  const search = () => {
    if (!query.trim()) return;
    const key = aiKeys?.gemini || aiKeys?.anthropic || getSharedGeminiKey();
    if (!key) { setErr(t('amp-add.api-key-missing', 'Clé API manquante')); return; }
    setLoading(true); setErr(null); setSuggestion(null);
    const instrLabel = isBass ? 'basse' : 'guitare';
    const knobHint = isBass
      ? 'ex: gain, bass, low_mid, high_mid, treble, master, blend'
      : 'ex: gain, volume_i, volume_ii, treble, middle, bass, presence, master, reverb';
    const prompt = `L'utilisateur veut ajouter un ampli ${instrLabel} traditionnel (physique) à son profil. Il a tapé : "${query.trim()}"
Identifie le modèle exact d'ampli ${instrLabel} (marque + modèle + variante si mentionnée).
Réponds UNIQUEMENT en JSON (sans markdown) :
{"name":"Nom complet (Marque Modèle)","brand":"Marque","wattage":nombre_watts,"channels":["liste des canaux, ex: Clean, Drive"],"knobs":["liste des VRAIS potards en façade, ${knobHint}"],"eq":["bandes EQ principales, ex: Bass, Mid, Treble"],"features":["caractéristiques notables, ex: Reverb, Tremolo, FX loop, DI, Compresseur"],"refs":{"fr":"1 artiste/morceau emblématique de cet ampli","en":"same in English","es":"mismo en español"},"confidence":"high|medium|low"}
Les potards doivent correspondre aux VRAIS contrôles de cet ampli (pas génériques). Wattage = puissance réelle en watts.`;
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) })
      .then((r) => r.json()).then((d) => { if (d.error) throw new Error(d.error.message); return safeParseJSON(d.candidates?.[0]?.content?.parts?.[0]?.text || ''); })
      .then((raw) => {
        const clean = sanitizeAmpSuggestion(raw, instrument);
        if (!clean) throw new Error(t('amp-add.parse-error', "L'IA n'a pas pu identifier cet ampli."));
        clean._confidence = raw?.confidence || null;
        setSuggestion(clean);
      })
      .catch((e) => setErr(e.message)).finally(() => setLoading(false));
  };

  const confirm = () => {
    if (suggestion) {
      const { _confidence, ...amp } = suggestion;
      onAdd(amp); setSuggestion(null); setQuery('');
    }
  };
  const addManual = () => {
    if (!mName.trim()) return;
    const amp = sanitizeAmpSuggestion({ name: mName.trim(), brand: mBrand.trim(), wattage: Number(mWatt) }, instrument);
    if (amp) { onAdd(amp); setMName(''); setMBrand(''); setMWatt(''); setManual(false); }
  };

  const title = isBass
    ? t('amp-add.title-bass', '+ Ajouter un ampli basse')
    : t('amp-add.title-guitar', '+ Ajouter un ampli guitare');
  const placeholder = isBass
    ? t('amp-add.search-placeholder-bass', 'Ex: Ampeg SVT, Hartke HD500, Markbass...')
    : t('amp-add.search-placeholder-guitar', 'Ex: Vox AC30, Orange Rockerverb, JCM800...');

  return (
    <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-soft)', borderRadius: 'var(--r-lg)', padding: 12, marginTop: 8, opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }} title={disabled ? t('demo.blocked', 'Action désactivée en mode démo') : undefined} aria-disabled={disabled ? 'true' : undefined}>
      <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginBottom: 8 }}>{title}</div>
      {!manual ? <>
        <div style={{ display: 'flex', gap: 6, marginBottom: suggestion || err ? 8 : 0 }}>
          <input placeholder={placeholder} value={query} onChange={(e) => { setQuery(e.target.value); setSuggestion(null); }} onKeyDown={(e) => e.key === 'Enter' && search()} style={{ ...inp, flex: 1, fontSize: 12, padding: '6px 10px' }}/>
          <button onClick={search} disabled={!query.trim() || loading} style={{ background: !query.trim() || loading ? 'var(--bg-disabled)' : 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: !query.trim() || loading ? 'not-allowed' : 'pointer' }}>{loading ? '…' : t('amp-add.search', 'Analyser')}</button>
        </div>
        {err && <div style={{ fontSize: 10, color: 'var(--red)', marginBottom: 6 }}>{err}</div>}
        {suggestion && <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: 'var(--r-md)', padding: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{suggestion.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 4 }}>{suggestion.brand} · {suggestion.wattage}W · {suggestion.channels.join(' / ')}</div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>{t('amp-add.knobs-label', 'Potards')} : {suggestion.knobs.map((k) => k.replace(/_/g, ' ')).join(' · ')}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={confirm} style={{ background: 'var(--green)', border: 'none', color: 'var(--bg)', borderRadius: 'var(--r-md)', padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{t('amp-add.add', 'Ajouter')}</button>
            <button onClick={() => setSuggestion(null)} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>{t('amp-add.correct', 'Corriger')}</button>
          </div>
        </div>}
        <button onClick={() => setManual(true)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 10, cursor: 'pointer', padding: '6px 0 0', textDecoration: 'underline' }}>{t('amp-add.manual', 'Saisie manuelle')}</button>
      </> : <>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          <input placeholder={t('amp-add.full-name', 'Nom complet')} value={mName} onChange={(e) => setMName(e.target.value)} style={{ ...inp, flex: '1 1 200px', fontSize: 12, padding: '6px 10px' }}/>
          <input placeholder={t('amp-add.brand', 'Marque')} value={mBrand} onChange={(e) => setMBrand(e.target.value)} style={{ ...inp, flex: '1 1 100px', fontSize: 12, padding: '6px 10px' }}/>
          <input type="number" placeholder="Watt" value={mWatt} onChange={(e) => setMWatt(e.target.value)} min={1} max={2000} style={{ ...inp, flex: '0 0 70px', fontSize: 12, padding: '6px 8px' }}/>
          <button onClick={addManual} disabled={!mName.trim()} style={{ background: mName.trim() ? 'var(--accent)' : 'var(--bg-disabled)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: mName.trim() ? 'pointer' : 'not-allowed' }}>{t('amp-add.add', 'Ajouter')}</button>
        </div>
        <button onClick={() => setManual(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 10, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>{t('amp-add.back-to-ai', '← Recherche IA')}</button>
      </>}
    </div>
  );
}

export default AmpSearchAdd;
export { AmpSearchAdd };

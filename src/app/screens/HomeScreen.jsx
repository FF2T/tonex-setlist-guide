// src/app/screens/HomeScreen.jsx — Phase 7.37 (wrapping i18n).
//
// Écran d'accueil : barre de recherche morceau (SongSearchBar), splash
// + onboarding popups, et carte de résultat IA inline quand un morceau
// est confirmé. SongSearchBar, SplashPopup et OnboardingWizard sont
// co-localisés dans ce fichier car ils ne servent qu'ici.
//
// Phase 7.37 : strings UI wrappées via t('home.*', 'FR fallback'). Le
// prompt IA L84-87 reste FR (changement Phase D — option trilingue).
// Les valeurs comparées à des outputs IA ('Aucun effet') restent FR.

import React, { useState, useEffect, useMemo } from 'react';
import { t, tFormat, useLocale } from '../../i18n/index.js';
import { APP_NAME, APP_TAGLINE } from '../../core/branding.js';
import { getSongInfo } from '../../core/songs.js';
import {
  findGuitarByAIName, findCotEntryForGuitar, localGuitarSongScore,
  localGuitarSettings, matchGuitarName,
} from '../../core/scoring/guitar.js';
import { findCatalogEntry, normalizePresetName } from '../../core/catalog.js';
import { getSourceInfo } from '../../core/sources.js';
import {
  normalizeSongTitle, normalizeArtist, findDuplicateSong,
} from '../utils/song-helpers.js';
import {
  enrichAIResult, mergeBestResults, updateAiCache, safeParseJSON,
  getLocalizedText,
} from '../utils/ai-helpers.js';
import { findInBanks } from '../utils/preset-helpers.js';
import { getActiveDevicesForRender } from '../utils/devices-render.js';
import { fetchAI } from '../utils/fetchAI.js';
import { getSharedGeminiKey } from '../utils/shared-key.js';
import { scoreColor } from '../components/score-utils.js';
import StatusDot from '../components/StatusDot.jsx';
import BacklineIcon from '../components/BacklineIcon.jsx';

// Tags feedback localisés (rebuild à chaque render pour réagir au switch
// de langue). Pas un const top-level car FEEDBACK_TAGS doit suivre la locale.
const getFeedbackTags = () => [
  t('home.fb.tag.too-saturated', 'Son trop saturé'),
  t('home.fb.tag.too-clean', 'Son trop clean'),
  t('home.fb.tag.wrong-amp', 'Mauvais style d\'ampli'),
  t('home.fb.tag.fender', 'Je veux un son Fender'),
  t('home.fb.tag.marshall', 'Je veux un son Marshall'),
  t('home.fb.tag.bad-preset', 'Preset pas adapté au morceau'),
];

// ─── SongSearchBar ───────────────────────────────────────────────────
function SongSearchBar({ onConfirm, aiProvider, aiKeys, songDb, isDemo }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [err, setErr] = useState(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const localSuggestions = useMemo(() => {
    const q = normalizeSongTitle(input);
    const qa = normalizeArtist(input);
    if (!q && !qa) return [];
    if (!songDb || !songDb.length) return [];
    return songDb
      .map((s) => {
        const nt = normalizeSongTitle(s.title);
        const na = normalizeArtist(s.artist);
        let rank = 0;
        if (nt.startsWith(q)) rank = 3;
        else if (nt.includes(q)) rank = 2;
        else if (na.includes(qa)) rank = 1;
        return rank > 0 ? { s, rank } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.rank - a.rank || a.s.title.localeCompare(b.s.title, 'fr'))
      .slice(0, 6)
      .map((x) => x.s);
  }, [input, songDb]);

  const isUnknown = suggestion && ((suggestion.confidence || '').toLowerCase() === 'low'
    || /^inconnu/i.test(suggestion.title || '')
    || /^inconnu/i.test(suggestion.artist || ''));

  const search = () => {
    if (!input.trim()) return;
    const key = aiKeys?.gemini || aiKeys?.anthropic || getSharedGeminiKey();
    const provider = (aiKeys?.gemini || getSharedGeminiKey()) ? 'gemini' : 'anthropic';
    if (!key) { setErr(t('home.search.api-key-missing', 'Clé API manquante — configure-la dans les paramètres.')); return; }
    setShowSuggest(false);
    setLoading(true); setErr(null); setSuggestion(null);
    const prompt = `L'utilisateur veut jouer un morceau de guitare. Il a tapé : "${input.trim()}"
Corrige l'orthographe et identifie le titre exact et l'artiste/groupe.
Si tu n'es pas sûr du tout, mets confidence="low" et title/artist="Inconnu".
Réponds UNIQUEMENT en JSON (sans markdown) : {"title":"Titre exact","artist":"Artiste/Groupe","confidence":"high|medium|low"}`;
    const parse = safeParseJSON;
    const req = provider === 'gemini'
      ? fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) })
        .then((r) => r.json()).then((d) => { if (d.error) throw new Error(d.error.message); return parse(d.candidates?.[0]?.content?.parts?.[0]?.text || ''); })
      : fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 200, messages: [{ role: 'user', content: prompt }] }) })
        .then((r) => r.json()).then((d) => { if (d.error) throw new Error(d.error.message); return parse(d.content?.map((i) => i.text || '').join('') || ''); });
    req.then((s) => setSuggestion(s)).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  };

  const pickLocal = (s) => { onConfirm(s.title, s.artist); setShowSuggest(false); setInput(''); setSuggestion(null); };

  const inp = { background: 'var(--bg-elev-1)', color: 'var(--text-primary)', border: '2px solid var(--border-strong)', borderRadius: 'var(--r-lg)', padding: '16px 18px', fontSize: 17, width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-ui)' };
  // Phase 7.51.3.1 — Mode démo : input + bouton disabled visuellement,
  // pour décourager la saisie. Sinon le visiteur tape, clique OK et
  // reçoit un toast 🔒 sans signal préalable.
  const demoTitle = isDemo ? t('demo.blocked', 'Action désactivée en mode démo') : undefined;
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }} title={demoTitle}>
        <input
          placeholder={t('home.search.placeholder', 'Titre, artiste...')}
          value={input}
          disabled={isDemo}
          onChange={(e) => { setInput(e.target.value); setSuggestion(null); setShowSuggest(true); setHighlight(0); }}
          onFocus={() => setShowSuggest(true)}
          onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
          onKeyDown={(e) => {
            if (showSuggest && localSuggestions.length > 0) {
              if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, localSuggestions.length - 1)); return; }
              if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); return; }
              if (e.key === 'Tab') { e.preventDefault(); pickLocal(localSuggestions[highlight]); return; }
              if (e.key === 'Escape') { setShowSuggest(false); return; }
            }
            if (e.key === 'Enter') search();
          }}
          style={{ ...inp, flex: 1, opacity: isDemo ? 0.5 : 1, cursor: isDemo ? 'not-allowed' : 'text' }}
        />
        <button onClick={search} disabled={isDemo || !input.trim() || loading} style={{ background: isDemo || !input.trim() || loading ? 'var(--bg-elev-3)' : 'linear-gradient(180deg,var(--brass-200),var(--brass-400))', border: 'none', color: 'var(--tolex-900)', borderRadius: 'var(--r-lg)', padding: '0 22px', fontSize: 17, fontWeight: 700, cursor: isDemo || !input.trim() || loading ? 'not-allowed' : 'pointer', flexShrink: 0, boxShadow: 'var(--shadow-sm)', fontFamily: 'var(--font-ui)', opacity: isDemo ? 0.5 : 1 }}>{loading ? '...' : t('home.search.ok', 'OK')}</button>
      </div>
      {showSuggest && localSuggestions.length > 0 && !suggestion && !loading && (
        <div style={{ position: 'absolute', top: '54px', left: 0, right: 0, background: 'var(--bg-elev-1)', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-md)', zIndex: 50, maxHeight: 240, overflowY: 'auto' }}>
          {localSuggestions.map((s, i) => (
            <div key={s.id}
              onMouseDown={(e) => { e.preventDefault(); pickLocal(s); }}
              onMouseEnter={() => setHighlight(i)}
              style={{ padding: '8px 14px', cursor: 'pointer', background: i === highlight ? 'var(--accent-bg)' : 'transparent', borderBottom: i < localSuggestions.length - 1 ? '1px solid var(--a6)' : 'none' }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-sec)' }}>{s.artist}</div>
            </div>
          ))}
        </div>
      )}
      {err && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{err}</div>}
      {suggestion && isUnknown && (
        <div style={{ background: 'var(--yellow-bg,rgba(251,191,36,0.12))', border: '1px solid var(--yellow-border,rgba(251,191,36,0.4))', borderRadius: 'var(--r-lg)', padding: 14, marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--yellow,#f59e0b)', marginBottom: 4 }}>{t('home.search.unknown-title', '⚠️ Morceau non reconnu')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-sec)', marginBottom: 10 }}>{t('home.search.unknown-hint', 'Vérifie l\'orthographe ou ajoute des précisions (artiste, album).')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setSuggestion(null); }} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse,var(--bg))', borderRadius: 'var(--r-md)', padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{t('home.search.correct', 'Corriger')}</button>
            <button onClick={() => { onConfirm(suggestion.title, suggestion.artist); setSuggestion(null); setInput(''); }} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>{t('home.search.force', 'Forcer quand même')}</button>
          </div>
        </div>
      )}
      {suggestion && !isUnknown && (
        <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: 'var(--r-lg)', padding: 14, marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{suggestion.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-sec)', marginBottom: 10 }}>{suggestion.artist}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { onConfirm(suggestion.title, suggestion.artist); setSuggestion(null); setInput(''); }} style={{ background: 'var(--green)', border: 'none', color: 'var(--bg)', borderRadius: 'var(--r-md)', padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{t('home.search.confirm', 'C\'est bon !')}</button>
            <button onClick={() => setSuggestion(null)} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>{t('home.search.refuse', 'Non, corriger')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SplashPopup ─────────────────────────────────────────────────────
function SplashPopup({ onClose }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--r-xl)', padding: '32px 24px', maxWidth: 420, width: '100%', position: 'relative', boxShadow: 'var(--shadow-lg)', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><BacklineIcon size={56} color="var(--brass-300)"/></div>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{APP_NAME}</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>{APP_TAGLINE}</div>
        <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, fontStyle: 'italic', marginBottom: 16, padding: '12px 16px', background: 'var(--accent-bg)', borderRadius: 'var(--r-lg)', border: '1px solid var(--accent-border)' }}>
          {t('home.splash.quote', '"Quel preset charger pour ce morceau, avec cette guitare ?"')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
          {t('home.splash.pain1', 'Tu scrolles, tu testes, tu perds du temps.')}<br/>{t('home.splash.pain2', 'Et tu finis par toujours utiliser les 3 mêmes presets.')}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
          {t('home.splash.promise', 'L\'IA analyse le morceau, raisonne sur le son et recommande le meilleur couple guitare + preset.')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', marginBottom: 20 }}>
          {[
            { n: '1', emoji: '🔍', text: t('home.splash.step1', 'Tape un morceau — l\'IA analyse le profil tonal et l\'ampli original') },
            { n: '2', emoji: '🧠', text: t('home.splash.step2', 'L\'IA raisonne : guitare idéale, ampli cible, preset recommandé') },
            { n: '3', emoji: '🎸', text: t('home.splash.step3', 'Choisis ta guitare — les presets s\'adaptent automatiquement') },
            { n: '4', emoji: '🤘', text: t('home.splash.step4', 'Rock\'n\'roll !') },
          ].map(({ n, emoji, text }) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--a3)', borderRadius: 'var(--r-lg)' }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{emoji}</span>
              <div><span style={{ fontWeight: 700, color: 'var(--accent)', marginRight: 4 }}>{n}.</span><span style={{ fontSize: 12, color: 'var(--text-sec)' }}>{text}</span></div>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ background: 'linear-gradient(180deg,var(--brass-200),var(--brass-400))', border: 'none', color: 'var(--tolex-900)', borderRadius: 'var(--r-lg)', padding: '12px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%', boxShadow: 'var(--shadow-sm)', fontFamily: 'var(--font-ui)' }}>{t('home.splash.cta', 'C\'est parti !')}</button>
      </div>
    </div>
  );
}

// ─── OnboardingWizard ────────────────────────────────────────────────
function OnboardingWizard({ onClose, onProfile }) {
  const [step, setStep] = useState(0);
  const steps = [
    () => (
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}><BacklineIcon size={64} color="var(--brass-300)"/></div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>{APP_NAME}</div>
        <div style={{ fontSize: 15, color: 'var(--text-sec)', lineHeight: 1.6, marginBottom: 24 }}>{APP_TAGLINE} {t('home.onboarding.tagline-extra', '— quel preset charger pour chaque morceau, avec ta guitare.')}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 2, textAlign: 'left', padding: '18px 20px', background: 'var(--a3)', borderRadius: 'var(--r-xl)' }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-sec)', fontSize: 14 }}>{t('home.onboarding.in-3min', 'En 3 minutes tu pourras :')}</div>
          <div>{t('home.onboarding.feat-search', '🔍 Chercher un morceau et obtenir le preset idéal')}</div>
          <div>{t('home.onboarding.feat-reason', '🧠 Voir le raisonnement IA (profil tonal, guitare, ampli)')}</div>
          <div>{t('home.onboarding.feat-setlist', '🎵 Préparer une setlist avec les bons presets')}</div>
          <div>{t('home.onboarding.feat-explore', '🎛️ Explorer les presets par profil sonore')}</div>
        </div>
      </div>
    ),
    () => (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎵</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>{t('home.onboarding.features-title', 'Fonctionnalités')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left', padding: '4px 0' }}>
          {[
            { emoji: '🔍', title: t('home.onboarding.f1-title', 'Recherche intelligente'), desc: t('home.onboarding.f1-desc', 'Tape un morceau — l\'IA analyse le profil tonal, identifie l\'ampli et la guitare d\'origine, et recommande le meilleur couple guitare + preset.') },
            { emoji: '🧠', title: t('home.onboarding.f2-title', 'Raisonnement IA'), desc: t('home.onboarding.f2-desc', 'L\'IA explique son raisonnement en 3 étapes : profil tonal du morceau, scoring des guitares, profil ampli idéal.') },
            { emoji: '🎵', title: t('home.onboarding.f3-title', 'Setlists de session'), desc: t('home.onboarding.f3-desc', 'Crée des setlists par contexte (cours, répétition, scène). Chaque morceau a sa fiche avec recommandation idéale et paramétrage.') },
            { emoji: '🎲', title: t('home.onboarding.f4-title', 'Jammer'), desc: t('home.onboarding.f4-desc', 'Choisis une guitare et un style — top 3 des presets installés et meilleurs du catalogue, avec fiches dépliables.') },
            { emoji: '🎛️', title: t('home.onboarding.f5-title', 'Explorateur de presets'), desc: t('home.onboarding.f5-desc', 'Explore par profil sonore (Clean cristallin, Blues vintage, Crunch 70s, Metal...). Chaque preset a sa fiche avec description, morceaux mythiques et guitares adaptées.') },
            { emoji: '📦', title: t('home.onboarding.f6-title', 'Installation directe'), desc: t('home.onboarding.f6-desc', 'Installe le preset recommandé directement sur ta pédale ou ton plug en choisissant la banque et le slot.') },
            { emoji: '👥', title: t('home.onboarding.f7-title', 'Multi-profils & Sync'), desc: t('home.onboarding.f7-desc', 'Chaque guitariste a son profil. Sync temps réel téléphone - PC via Firestore.') },
          ].map(({ emoji, title, desc }) => (
            <div key={title} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'var(--a3)', borderRadius: 'var(--r-lg)' }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{emoji}</span>
              <div><div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{title}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{desc}</div></div>
            </div>
          ))}
        </div>
      </div>
    ),
    () => (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚙️</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>{t('home.onboarding.config-title', 'Configure ton profil')}</div>
        <div style={{ fontSize: 13, color: 'var(--text-sec)', lineHeight: 1.6, marginBottom: 20 }}>{t('home.onboarding.config-intro', 'Pour des recommandations precises, l\'app a besoin de connaitre :')}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 2.2, textAlign: 'left', padding: '18px 20px', background: 'var(--a3)', borderRadius: 'var(--r-xl)' }}>
          <div><b style={{ color: 'var(--text-sec)' }}>🎸 {t('home.onboarding.config-guitars-label', 'Tes guitares')}</b> {t('home.onboarding.config-guitars-desc', '— pour adapter les recommandations par modèle et type de micro')}</div>
          <div><b style={{ color: 'var(--text-sec)' }}>📱 {t('home.onboarding.config-hardware-label', 'Ton materiel')}</b> {t('home.onboarding.config-hardware-desc', '— pedale ToneX Anniversary et/ou ToneX Plug')}</div>
          <div><b style={{ color: 'var(--text-sec)' }}>📦 {t('home.onboarding.config-sources-label', 'Tes sources')}</b> {t('home.onboarding.config-sources-desc', '— quels packs de presets tu possedes (TSR, ML, Factory...)')}</div>
        </div>
      </div>
    ),
  ];
  const total = steps.length;
  const isLast = step === total - 1;
  const isFirst = step === 0;
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--r-xl)', padding: '32px 24px', maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto', position: 'relative', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', padding: 4 }}>✕</button>
        <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
          {steps.map((_, i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 'var(--r-xs)', background: i <= step ? 'var(--accent)' : 'var(--a8)', transition: 'background .2s' }}/>)}
        </div>
        {steps[step]()}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, gap: 8 }}>
          {isFirst
            ? <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer' }}>{t('home.onboarding.close', 'Fermer')}</button>
            : <button onClick={() => setStep((s) => s - 1)} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t('home.onboarding.back', '← Retour')}</button>}
          {isLast
            ? <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onClose} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-lg)', padding: '12px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('home.onboarding.close', 'Fermer')}</button>
                <button onClick={() => { onClose(); onProfile(); }} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-lg)', padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{t('home.onboarding.go-profile', 'Configurer mon profil →')}</button>
              </div>
            : <button onClick={() => setStep((s) => s + 1)} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{t('home.onboarding.next', 'Suivant →')}</button>}
        </div>
      </div>
    </div>
  );
}

// ─── HomeScreen ──────────────────────────────────────────────────────
function HomeScreen({
  songDb, onSongDb, setlists, allSetlists, onSetlists, mySongIds,
  checked, onChecked, onNext, onSettings, onProfile, onSetlistScreen, onJam, onExplore, onOptimizer,
  banksAnn, banksPlug, aiProvider, aiKeys, allGuitars, guitarBias, availableSources,
  profiles, activeProfileId, onSwitchProfile, onProfiles, customPacks, syncStatus,
  onViewProfile, onLogout, onLive,
}) {
  const visibleSongDb = useMemo(
    () => (mySongIds ? songDb.filter((s) => mySongIds.has(s.id)) : songDb),
    [songDb, mySongIds]
  );
  // Phase 7.51.3.1 — Mode démo : dérive depuis le profil actif.
  const isDemo = profiles?.[activeProfileId]?.isDemo === true;
  // Phase 5.13.8 — perf instrumentation, même pattern que ListScreen.
  if (typeof window !== 'undefined' && window.__TONEX_PERF) {
    if (!window.__homeRenderStart) window.__homeRenderStart = performance.now();
  }
  useEffect(() => {
    if (typeof window !== 'undefined' && window.__TONEX_PERF && window.__homeRenderStart) {
      const dt = performance.now() - window.__homeRenderStart;
      // eslint-disable-next-line no-console
      console.log(`[perf] HomeScreen mount: ${dt.toFixed(1)}ms (${(setlists || []).length} setlists, ${(songDb || []).length} songs)`);
      window.__homeRenderStart = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const locale = useLocale();
  const profileName = (profiles[activeProfileId] || {}).name || t('home.profile-default', 'Profil');
  const profile = profiles[activeProfileId] || {};
  const [splashOpen, setSplashOpen] = useState(() => { if (sessionStorage.getItem('tonex_splash')) return false; sessionStorage.setItem('tonex_splash', '1'); return true; });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [songResult, setSongResult] = useState(null);
  const [songBaseAI, setSongBaseAI] = useState(null);
  const [songLoading, setSongLoading] = useState(false);
  const [songErr, setSongErr] = useState(null);
  const [confirmedSong, setConfirmedSong] = useState(null);
  const [showGuitarPick, setShowGuitarPick] = useState(false);
  const [selectedGuitar, setSelectedGuitar] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showCotSearch, setShowCotSearch] = useState(false);
  const [feedback, setFeedback] = useState('');

  const rerunWithFeedback = () => {
    if (!confirmedSong || !feedback.trim()) return;
    setSongLoading(true); setShowFeedback(false);
    const prev = songResult;
    const gId = selectedGuitar?.id || '';
    const song = { id: `tmp_${Date.now()}`, title: confirmedSong.title, artist: confirmedSong.artist };
    fetchAI(song, gId, banksAnn, banksPlug, aiProvider, aiKeys, allGuitars, feedback.trim(), null, profile?.recoMode || 'balanced', guitarBias)
      .then((r) => {
        const pick = mergeBestResults(prev, r);
        setSongResult(pick); setSongBaseAI(pick); setFeedback('');
      })
      .catch((e) => setSongErr(e.message))
      .finally(() => setSongLoading(false));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {splashOpen && <SplashPopup onClose={() => setSplashOpen(false)}/>}
      {showOnboarding && <OnboardingWizard onClose={() => setShowOnboarding(false)} onProfile={onProfile}/>}

      <div style={{ padding: '8px 0 4px', minHeight: (!songResult && !songLoading) ? 'calc(100vh - 140px)' : 'auto', display: 'flex', flexDirection: 'column', justifyContent: (!songResult && !songLoading) ? 'center' : 'flex-start' }}>
        {songLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16, animation: 'spin 1.5s linear infinite' }}>&#9203;</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{t('home.loading', 'Analyse en cours...')}</div>
            {confirmedSong && <div style={{ fontSize: 14, color: 'var(--text-sec)', marginTop: 8 }}>{confirmedSong.title} — {confirmedSong.artist}</div>}
            <style>{'@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}'}</style>
          </div>
        ) : (
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6, textAlign: 'center' }}>{APP_NAME}</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16, textAlign: 'center' }}>{t('home.title-question', 'Quel morceau veux-tu jouer ?')}</div>

            {typeof onLive === 'function' && (() => {
              const liveSl = (setlists || []).find((s) => s.songIds && s.songIds.length > 0)
                || (allSetlists || []).find((s) => s.songIds && s.songIds.length > 0 && (!s.profileIds || s.profileIds.length === 0));
              if (!liveSl) return null;
              return (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                  <button data-testid="home-screen-live" onClick={() => onLive(liveSl.id)} title={tFormat('home.live-title', { name: liveSl.name }, 'Mode scène plein écran sur "{name}"')} style={{ background: 'linear-gradient(180deg,var(--brass-200),var(--brass-400))', border: 'none', color: 'var(--tolex-900)', borderRadius: 'var(--r-lg)', padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-sm)', fontFamily: 'var(--font-ui)' }}>{tFormat('home.live-button', { name: liveSl.name }, '🎤 Mode scène — {name}')}</button>
                </div>
              );
            })()}

            <div style={{ width: '100%' }}>
              <SongSearchBar songDb={visibleSongDb} aiProvider={aiProvider} aiKeys={aiKeys} isDemo={isDemo} onConfirm={(title, artist) => {
                const existing = findDuplicateSong(songDb, title, artist) || songDb.find((s) => normalizePresetName(s.title) === normalizePresetName(title));
                const canonTitle = existing ? existing.title : title;
                const canonArtist = existing ? existing.artist : artist;
                setConfirmedSong({ title: canonTitle, artist: canonArtist });
                setSongResult(null); setSongBaseAI(null); setSongErr(null); setSelectedGuitar(null);
                if (existing?.aiCache?.result?.cot_step1) {
                  const cachedGId = existing.aiCache.gId || '';
                  const cachedG = allGuitars.find((x) => x.id === cachedGId);
                  const gType = cachedG?.type || 'HB';
                  const r = enrichAIResult({ ...existing.aiCache.result }, gType, cachedGId, banksAnn, banksPlug, undefined, existing);
                  setSongResult(r); setSongBaseAI(r);
                  if (cachedG) setSelectedGuitar(cachedG);
                  else if (r.ideal_guitar) {
                    const m = findGuitarByAIName(r.ideal_guitar, allGuitars);
                    if (m) setSelectedGuitar(m);
                  }
                  return;
                }
                setSongLoading(true);
                const song = { id: `tmp_${Date.now()}`, title: canonTitle, artist: canonArtist };
                fetchAI(song, '', banksAnn, banksPlug, aiProvider, aiKeys, allGuitars, null, null, profile?.recoMode || 'balanced', guitarBias)
                  .then((r) => {
                    setSongResult(r); setSongBaseAI(r);
                    if (r.ideal_guitar) {
                      const m = findGuitarByAIName(r.ideal_guitar, allGuitars);
                      if (m) setSelectedGuitar(m);
                    }
                    if (!existing) {
                      const ns = { id: `c_${Date.now()}`, title: canonTitle, artist: canonArtist, isCustom: true, ig: [], aiCache: updateAiCache(null, '', r) };
                      onSongDb((p) => [...p, ns]);
                    }
                  })
                  .catch((e) => setSongErr(e.message))
                  .finally(() => setSongLoading(false));
              }}/>
            </div>

            {songErr && <div style={{ fontSize: 12, color: 'var(--red)', textAlign: 'center', padding: 10 }}>{songErr}</div>}

            {songResult && confirmedSong && (() => {
              const existing = songDb.find((s) => normalizePresetName(s.title) === normalizePresetName(confirmedSong.title));
              const info = existing ? getSongInfo(existing) : { year: songResult.song_year, album: songResult.song_album, desc: songResult.song_desc, key: songResult.song_key, bpm: songResult.song_bpm };
              const idealGuitarFromCollection = songResult.ideal_guitar ? findGuitarByAIName(songResult.ideal_guitar, allGuitars) : null;
              const idealGuitarCot = idealGuitarFromCollection ? findCotEntryForGuitar(songResult.cot_step2_guitars, idealGuitarFromCollection) : null;
              const idealGuitarObj = idealGuitarCot || songResult.cot_step2_guitars?.[0];
              const idealGuitarScore = idealGuitarCot?.score
                || (idealGuitarFromCollection ? localGuitarSongScore(idealGuitarFromCollection, songResult) : null)
                || idealGuitarObj?.score || null;
              const chosenGuitarCot = selectedGuitar ? findCotEntryForGuitar(songResult.cot_step2_guitars, selectedGuitar) : null;
              const chosenGuitarScore = chosenGuitarCot?.score || (selectedGuitar ? localGuitarSongScore(selectedGuitar, songResult) : idealGuitarScore);
              const chosenGuitarScoreEstimated = !!selectedGuitar && !chosenGuitarCot && chosenGuitarScore != null;
              const sectionStyle = { background: 'var(--a3)', border: '1px solid var(--a7)', borderRadius: 'var(--r-lg)', padding: '10px 12px', marginBottom: 8 };
              const customSectionStyle = { background: 'var(--a5)', border: '1px solid var(--a10)', borderRadius: 'var(--r-lg)', padding: '10px 12px', marginBottom: 8 };
              const sectionTitle = (icon, label) => <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>{icon} {label}</div>;
              return (
                <div style={{ width: '100%', maxWidth: 500, animation: 'slideDown .2s ease-out' }}>
                  <div style={{ background: 'var(--bg-elev-1)', border: '1px solid var(--a7)', borderRadius: 'var(--r-xl)', padding: 14, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ marginBottom: 4 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>{confirmedSong.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-sec)', fontFamily: 'var(--font-mono)' }}>{confirmedSong.artist}{info.year ? ' · ' + info.year : ''}{info.album ? ' · ' + info.album : ''}{info.key ? ' · ' + info.key : ''}{info.bpm ? ' · ' + info.bpm + ' BPM' : ''}</div>
                    </div>

                    {/* Section Infos */}
                    <div style={sectionStyle}>
                      {sectionTitle('📖', t('home.song.info-section', 'Infos morceau'))}
                      {info.desc && <div style={{ fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.5, marginBottom: 6 }}>{getLocalizedText(info.desc, locale)}</div>}
                      {(songResult.ref_guitarist || songResult.ref_guitar || songResult.ref_amp) && (
                        <div style={{ fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.6 }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 10 }}>{songResult.ref_guitarist || t('home.song.ref-default', 'Référence')}</span><br/>
                          {songResult.ref_guitar && <>🎸 {songResult.ref_guitar} · </>}
                          {songResult.ref_amp && <>🔊 {songResult.ref_amp}</>}
                          {songResult.ref_effects && songResult.ref_effects !== 'Aucun effet' && <> · 🎚 {songResult.ref_effects}</>}
                        </div>
                      )}
                    </div>

                    {/* Section Raisonnement */}
                    {(songResult.cot_step1 || songResult.cot_step2_guitars || songResult.cot_step3_amp) && (
                      <div style={sectionStyle}>
                        <div onClick={() => setShowCotSearch((p) => !p)} style={{ cursor: 'pointer', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', display: 'flex', alignItems: 'center', gap: 5, userSelect: 'none' }}>
                          {t('home.song.reasoning', '🧠 Raisonnement IA')} <span style={{ fontSize: 10, marginLeft: 'auto', fontWeight: 400 }}>{showCotSearch ? '▲' : '▼'}</span>
                        </div>
                        {showCotSearch && (
                          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {songResult.cot_step1 && <div style={{ background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 10px' }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>{t('home.song.cot-tonal', 'Profil tonal')}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.4 }}>{getLocalizedText(songResult.cot_step1, locale)}</div>
                            </div>}
                            {songResult.cot_step2_guitars?.length > 0 && <div style={{ background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 10px' }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>{t('home.song.cot-guitars', 'Scoring guitares')}</div>
                              {songResult.cot_step2_guitars.map((gt, i) => <div key={i} style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: i < songResult.cot_step2_guitars.length - 1 ? 4 : 0, display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-bright)', flexShrink: 0 }}>{gt.name}</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: scoreColor(gt.score), flexShrink: 0 }}>{gt.score}%</span>
                                <span style={{ color: 'var(--text-dim)' }}>{getLocalizedText(gt.reason, locale)}</span>
                              </div>)}
                            </div>}
                            {songResult.cot_step3_amp && <div style={{ background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 10px' }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>{t('home.song.cot-amp', 'Profil ampli')}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.4 }}>{getLocalizedText(songResult.cot_step3_amp, locale)}</div>
                            </div>}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Section Recommandation idéale */}
                    <div style={sectionStyle}>
                      {sectionTitle(<StatusDot score={100} ideal={true} size={10}/>, t('home.song.reco-ideal', 'Recommandation idéale'))}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {songResult.ideal_guitar && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                            <StatusDot score={idealGuitarScore} ideal={true}/>
                            <div style={{ flex: 1 }}>{t('home.song.guitar-label', 'Guitare ')}<span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{songResult.ideal_guitar}</span></div>
                            {idealGuitarScore && <b style={{ color: scoreColor(idealGuitarScore), flexShrink: 0 }}>{idealGuitarScore}%</b>}
                          </div>
                        )}
                        {songResult.guitar_reason && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: -2, marginBottom: 2 }}>{getLocalizedText(songResult.guitar_reason, locale)}</div>}
                        {songResult.ideal_preset && (() => {
                          const idealScore = songResult.ideal_preset_score || 0;
                          const loc = findInBanks(songResult.ideal_preset, banksAnn) || findInBanks(songResult.ideal_preset, banksPlug);
                          const entry = findCatalogEntry(songResult.ideal_preset);
                          if (availableSources && entry?.src && availableSources[entry.src] === false) return null;
                          const srcInfo = getSourceInfo(entry);
                          return (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><StatusDot score={idealScore} ideal={true}/><span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{t('home.song.preset-label', 'Preset')}</span> <span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{songResult.ideal_preset}</span></div>
                                {idealScore > 0 && <b style={{ color: scoreColor(idealScore), flexShrink: 0 }}>{idealScore}%</b>}
                              </div>
                              <div style={{ fontSize: 9, marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                {loc
                                  ? <span style={{ color: 'var(--green)' }}>{tFormat('home.song.installed-bank', { bank: loc.bank, slot: loc.slot }, '✓ Installé · Banque {bank}{slot}')}</span>
                                  : <span style={{ color: 'var(--yellow)' }}>{t('home.song.not-installed', '⬇ Non installé')}</span>}
                                {srcInfo && <span style={{ color: loc ? 'var(--text-tertiary)' : 'var(--text-sec)' }}>· {srcInfo.icon} {srcInfo.label}</span>}
                              </div>
                            </div>
                          );
                        })()}
                        {(songResult.settings_preset || songResult.settings_guitar) && (
                          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {songResult.settings_preset && <div style={{ fontSize: 10, background: 'var(--a4)', border: '1px solid var(--a10)', borderRadius: 'var(--r-md)', padding: '5px 8px', color: 'var(--text-sec)' }}><b style={{ color: 'var(--text-muted)' }}>{t('home.song.preset-settings', 'Preset :')}</b> {getLocalizedText(songResult.settings_preset, locale)}</div>}
                            {songResult.settings_guitar && <div style={{ fontSize: 10, background: 'var(--a4)', border: '1px solid var(--a10)', borderRadius: 'var(--r-md)', padding: '5px 8px', color: 'var(--text-sec)' }}><b style={{ color: 'var(--text-muted)' }}>{t('home.song.guitar-settings', 'Guitare :')}</b> {getLocalizedText(songResult.settings_guitar, locale)}</div>}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Section Paramétrage */}
                    <div style={customSectionStyle}>
                      {sectionTitle('🎛', t('home.song.params-title', 'Paramétrage — mon choix'))}
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{t('home.song.guitar-chosen', 'Guitare choisie')}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
                          {(selectedGuitar || songResult.ideal_guitar) && <span style={{ fontSize: 11, background: 'var(--a5)', border: '1px solid var(--a10)', borderRadius: 'var(--r-md)', padding: '4px 10px', color: 'var(--text-bright)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}><StatusDot score={chosenGuitarScore} ideal={!selectedGuitar || matchGuitarName(songResult.cot_step2_guitars?.[0]?.name, selectedGuitar)}/>{selectedGuitar ? `${selectedGuitar.name} (${selectedGuitar.type})` : songResult.ideal_guitar}</span>}
                          <button onClick={() => setShowGuitarPick((p) => !p)} style={{ fontSize: 10, background: 'var(--a5)', border: '1px solid var(--a10)', color: 'var(--text-muted)', borderRadius: 'var(--r-md)', padding: '3px 8px', cursor: 'pointer' }}>{t('home.song.change', 'Changer')}</button>
                        </div>
                        {selectedGuitar && chosenGuitarScore && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>{t('home.song.compat', 'Compatibilité :')} <b style={{ color: scoreColor(chosenGuitarScore) }}>{chosenGuitarScore}%</b>{chosenGuitarScoreEstimated && <span style={{ marginLeft: 6, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>{t('home.song.estimated', '(estimé)')}</span>}</div>}
                        {selectedGuitar && (() => { const s = localGuitarSettings(selectedGuitar, songResult); return s ? <div style={{ fontSize: 10, background: 'var(--a4)', border: '1px solid var(--a10)', borderRadius: 'var(--r-md)', padding: '5px 8px', color: 'var(--text-sec)', marginBottom: 4 }}><b style={{ color: 'var(--text-muted)' }}>{t('home.song.settings', 'Réglages :')}</b> {s}</div> : null; })()}
                        {showGuitarPick && (
                          <div style={{ marginBottom: 8, background: 'var(--a4)', borderRadius: 'var(--r-md)', padding: 10 }}>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {allGuitars.map((g) => <button key={g.id} onClick={() => {
                                setShowGuitarPick(false); setSelectedGuitar(g);
                                const base = songBaseAI || songResult;
                                if (base) setSongResult(enrichAIResult({ ...base }, g.type || 'HB', g.id, banksAnn, banksPlug));
                              }} style={{ fontSize: 10, background: 'var(--a5)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '4px 8px', cursor: 'pointer', color: 'var(--text-sec)' }}>{g.short} ({g.type})</button>)}
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{t('home.song.best-installed', 'Meilleurs presets installés')}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {getActiveDevicesForRender(profile).map((d) => {
                          const presetData = songResult[d.presetResultKey];
                          if (!presetData) return null;
                          return (
                            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 10px', flexWrap: 'wrap' }}>
                              <StatusDot score={presetData.score} ideal={presetData.label === songResult.ideal_preset}/>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, flexShrink: 0 }}>{d.icon} {d.label}</span>
                              <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600, flex: 1 }}>{presetData.label}</span>
                              {presetData.score && <span style={{ fontSize: 10, fontWeight: 700, color: scoreColor(presetData.score) }}>{presetData.score}%</span>}
                              {presetData.bank != null && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{tFormat('home.song.bank', { bank: presetData.bank, slot: presetData.col }, 'Banque {bank}{slot}')}</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Affiner */}
                    {!showFeedback
                      ? <button onClick={() => setShowFeedback(true)} style={{ fontSize: 10, background: 'none', border: '1px solid var(--a10)', color: 'var(--text-dim)', borderRadius: 'var(--r-md)', padding: '3px 8px', cursor: 'pointer' }}>{t('home.song.refine', '🔄 Affiner l\'analyse')}</button>
                      : (
                        <div style={{ marginTop: 4, background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: 10 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 6 }}>{t('home.song.fb-question', 'Qu\'est-ce qui ne va pas ?')}</div>
                          <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
                            {getFeedbackTags().map((s) => <button key={s} onClick={() => setFeedback((p) => p ? p + ', ' + s : s)} style={{ fontSize: 9, background: feedback.includes(s) ? 'var(--accent)' : 'var(--a6)', color: feedback.includes(s) ? 'var(--text-inverse)' : 'var(--text-sec)', border: '1px solid var(--a10)', borderRadius: 'var(--r-sm)', padding: '3px 7px', cursor: 'pointer' }}>{s}</button>)}
                          </div>
                          <input placeholder={t('home.song.fb-input', 'Ou précise ici...')} value={feedback} onChange={(e) => setFeedback(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && feedback.trim() && rerunWithFeedback()} style={{ width: '100%', background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-md)', padding: '8px 10px', fontSize: 12, boxSizing: 'border-box', marginBottom: 6 }}/>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => { if (feedback.trim()) rerunWithFeedback(); }} disabled={!feedback.trim() || songLoading} style={{ background: feedback.trim() ? 'var(--accent)' : 'var(--bg-disabled)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: feedback.trim() ? 'pointer' : 'not-allowed' }}>{songLoading ? t('home.song.loading-short', '⏳ Analyse...') : t('home.song.rerun', '🔄 Relancer')}</button>
                            <button onClick={() => { setShowFeedback(false); setFeedback(''); }} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '6px 10px', fontSize: 11, cursor: 'pointer' }}>{t('home.song.cancel', 'Annuler')}</button>
                          </div>
                        </div>
                      )}

                    {/* Ajouter à une setlist */}
                    {(() => {
                      const song = songDb.find((s) => normalizePresetName(s.title) === normalizePresetName(confirmedSong.title));
                      if (!song) return null;
                      return (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', marginBottom: 6 }}>{t('home.song.add-to-setlist', 'Ajouter à une setlist')}</div>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {setlists.map((sl) => {
                              const inSl = sl.songIds.includes(song.id);
                              return <button key={sl.id} onClick={() => { if (inSl) { onSetlists((p) => p.map((s) => s.id === sl.id ? { ...s, songIds: s.songIds.filter((x) => x !== song.id) } : s)); } else { onSetlists((p) => p.map((s) => s.id === sl.id ? { ...s, songIds: [...s.songIds, song.id] } : s)); } }} style={{ fontSize: 11, fontWeight: 600, color: inSl ? 'var(--green)' : 'var(--text-sec)', background: inSl ? 'rgba(74,222,128,0.15)' : 'var(--a5)', border: inSl ? '1px solid rgba(74,222,128,0.4)' : '1px solid var(--a10)', borderRadius: 'var(--r-md)', padding: '5px 12px', cursor: 'pointer' }}>{inSl ? '✓ ' : ''}{sl.name}</button>;
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    <button onClick={() => { setConfirmedSong(null); setSongResult(null); setSongBaseAI(null); setShowFeedback(false); setFeedback(''); }} style={{ width: '100%', marginTop: 8, background: 'var(--a5)', border: '1px solid var(--a10)', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '8px', fontSize: 12, cursor: 'pointer' }}>{t('home.song.back-home', '← Retour à l\'accueil')}</button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

export default HomeScreen;
export { HomeScreen, SongSearchBar, SplashPopup, OnboardingWizard };

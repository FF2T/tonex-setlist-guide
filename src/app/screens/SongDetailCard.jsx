// src/app/screens/SongDetailCard.jsx — Phase 7.37 (wrapping i18n).
//
// Card de détail morceau dépliée. Affiche 4 sections :
// 1. Infos morceau (year/album/key/bpm éditables + desc + ref guitariste/guitar/amp).
// 2. Raisonnement IA (cot_step1/2/3 collapsible).
// 3. Recommandation idéale (guitar + preset + top 3 catalogue + settings).
// 4. Paramétrage (guitar choisie + mode reco par morceau + presets installés).
// 5. Suggestion d'amélioration (si bestScore<90% : packs à acheter + ToneNET).
// 6. Feedback IA (historique + nouveau feedback → relance fetchAI).
//
// useEffect central : déclenche fetchAI quand pas de cache OU cache stale
// (SCORING_VERSION mismatch), et auto-select ideal_guitar si gId="".
//
// Toutes les mutations remontent via onSongDb / onGuitarChange callbacks.
//
// Phase 7.37 : strings UI wrappées via t('song-detail.*', 'FR fallback').

import React, { useState, useEffect } from 'react';
import { t, tFormat, getLocale, useLocale } from '../../i18n/index.js';
import { GUITARS } from '../../core/guitars.js';
import { SCORING_VERSION } from '../../core/scoring/index.js';
import { bucketizeScore } from '../../core/scoring/compat-buckets.js';
import {
  findGuitarByAIName, findCotEntryForGuitar, localGuitarSongScore,
  localGuitarSettings, guitarChoiceFeedback,
} from '../../core/scoring/guitar.js';
import { findCatalogEntry } from '../../core/catalog.js';
import CurationDot from '../components/CurationDot.jsx';
import PresetCurationModal from '../components/PresetCurationModal.jsx';
import { getSongInfo } from '../../core/songs.js';
import { getSourceInfo } from '../../core/sources.js';
import { AMP_TAXONOMY, EXTERNAL_PACK_CATALOG } from '../../data/data_context.js';
import { TSR_PACK_ZIPS } from '../../data/tsr-packs.js';
import { getIg, getSongHist, getSongBassHist } from '../utils/song-helpers.js';
import { findBass } from '../../core/basses.js';
import { findBassAmp } from '../../core/bass-amps.js';
import { findGuitarAmp } from '../../core/guitar-amps.js';
import { findPedal } from '../../core/pedals.js';
import { getEffectivePlayContext, getAvailableRigs } from '../../core/state.js';
import {
  enrichAIResult, mergeBestResults, updateAiCache, computeRigSnapshot,
  computeAnalysisFingerprint, getBestResult, getLocalizedText, stripSlotPrefix,
} from '../utils/ai-helpers.js';
import { findInBanks } from '../utils/preset-helpers.js';
import { resolveDisplayGuitar, filterCotGuitarsToRig, localizePickup, decapitalizeFirst } from '../utils/display-guitar.js';
import { getActiveDevicesForRender } from '../utils/devices-render.js';
import { fetchAI } from '../utils/fetchAI.js';
import { scoreColor } from '../components/score-utils.js';
import StatusDot from '../components/StatusDot.jsx';
import GuitarSelect from '../components/GuitarSelect.jsx';
import NavIcon from '../components/NavIcon.jsx';
import PBlock from '../components/PBlock.jsx';
import FeedbackPanel from '../components/FeedbackPanel.jsx';
import AIErrorPanel from '../components/AIErrorPanel.jsx';
import { TYPO, WEIGHT, TEXT_1, TEXT_2, TEXT_3, BG_1, BG_2, BORDER_SUBTLE, sectionCard, sectionTitle as sectionTitleStyle } from '../styles/tokens.js';

// Phase 9.8 — Cadre "Réglages micros" : contrôles RÉELS de l'instrument
// sélectionné (sélecteur de micro + volume/tonalité par bouton). Partagé
// guitare ↔ basse (lit cot_step2_*[i].controls de l'instrument choisi → maj
// instantanée au changement de liste, 0 re-fetch). Retourne null si vide.
function PickupControlsCadre({ controls, locale }) {
  if (!controls || typeof controls !== 'object') return null;
  const knobs = Array.isArray(controls.knobs) ? controls.knobs : [];
  if (!controls.selector && knobs.length === 0) return null;
  const why = controls.why ? getLocalizedText(controls.why, locale) : null;
  return (
    <div style={{ background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 10px' }}>
      <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <NavIcon id="sliders" size={14}/>{t('song-detail.pickup-controls', 'Réglages micros')}
      </div>
      {controls.selector && (
        <div style={{ fontSize: 'clamp(12px, 1.35vw, 14px)', color: 'var(--text-sec)', marginBottom: knobs.length ? 6 : 0 }}>
          <b style={{ color: 'var(--text-muted)' }}>{t('song-detail.pickup-selector', 'Sélecteur')}</b> {controls.selector}
        </div>
      )}
      {knobs.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 'clamp(12px, 1.35vw, 14px)', color: 'var(--text-sec)', fontFamily: 'var(--font-mono)' }}>
          {knobs.map((k, i) => (
            <span key={i}><b style={{ color: 'var(--text-muted)' }}>{k.name}</b> {k.value}</span>
          ))}
        </div>
      )}
      {why && <div className="prose-readable" style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.4, fontStyle: 'italic' }}>{why}</div>}
    </div>
  );
}

// Cadre "Réglages effets" en histogramme barres horizontales (Phase 7.83 final5).
// Extrait en composant partagé (vague B) pour réutilisation guitare ↔ basse :
// les blocs FX guitar (aiC.fx_blocks) et bass (bass_recommendation.bass_fx_blocks)
// partagent exactement la même forme (5 blocs Gate/Comp/Mod/Delay/Reverb avec
// enabled + type/mode + sub-params + why trilingue). Retourne null si aucun bloc ON.
function FxBlocksCadre({ fxBlocks, locale, title }) {
  if (!fxBlocks) return null;
  const FX_KEYS = ['noise_gate', 'compressor', 'modulation', 'delay', 'reverb'];
  const FX_LABELS = { noise_gate: 'Gate', compressor: 'Comp', modulation: 'Mod', delay: 'Delay', reverb: 'Reverb' };
  const onBlocks = FX_KEYS.filter((k) => fxBlocks[k]?.enabled === true);
  if (onBlocks.length === 0) return null;
  // Ranges officiels par bloc (manuel TONEX p.22-28). Le `threshold` n'est pas
  // dans FX_BLOCK_RANGES (qui ne couvre que Phase 9.7 N2), ajouté ici pour gate/comp.
  const FX_PARAM_RANGES = {
    noise_gate: {
      threshold: { min: -100, max: 0, unit: 'dB' },
      release:   { min: 5,    max: 500, unit: 'ms' },
      depth:     { min: -100, max: -20, unit: 'dB' },
    },
    compressor: {
      threshold: { min: -40, max: 0,  unit: 'dB' },
      gain:      { min: -30, max: 10, unit: 'dB' },
      attack:    { min: 1,   max: 51, unit: 'ms' },
    },
    modulation: {
      rate:  { min: 0.1, max: 10,  unit: 'Hz' },
      depth: { min: 0,   max: 100, unit: '%' },
      level: { min: 0,   max: 10,  unit: '' },
    },
    delay: {
      time:     { min: 0, max: 1000, unit: 'ms' },
      feedback: { min: 0, max: 100,  unit: '%' },
      mix:      { min: 0, max: 100,  unit: '%' },
    },
    reverb: {
      time:      { min: 0,   max: 10,  unit: '' },
      pre_delay: { min: 0,   max: 500, unit: 'ms' },
      color:     { min: -10, max: 10,  unit: '' },
      mix:       { min: 0,   max: 100, unit: '%' },
    },
  };
  const PARAM_LABELS = {
    threshold: 'Threshold', release: 'Release', depth: 'Depth',
    gain: 'Gain', attack: 'Attack',
    rate: 'Rate', level: 'Level',
    time: 'Time', feedback: 'Feedback', mix: 'Mix',
    pre_delay: 'Pre-delay', color: 'Color',
  };
  const PARAM_ORDER = {
    noise_gate: ['threshold', 'release', 'depth'],
    compressor: ['threshold', 'gain', 'attack'],
    modulation: ['rate', 'depth', 'level'],
    delay: ['time', 'feedback', 'mix'],
    reverb: ['time', 'pre_delay', 'color', 'mix'],
  };
  const renderBar = (label, value, range) => {
    const pct = Math.max(0, Math.min(100, ((value - range.min) / (range.max - range.min)) * 100));
    return (
      <div key={label} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 60px', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <span style={{ fontSize: 'clamp(11px, 1.15vw, 12px)', color: 'var(--text-muted)' }}>{label}</span>
        <div style={{ height: 7, background: 'var(--a5)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)' }}/>
        </div>
        <span style={{ fontSize: 'clamp(11px, 1.15vw, 12px)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-bright)' }}>{value}{range.unit}</span>
      </div>
    );
  };
  return (
    <div style={{ background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 10px' }}>
      <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', display: 'flex', alignItems: 'center', gap: 6 }}><NavIcon id="sliders" size={14}/>{title}</div>
      <div className="reco-multicol">
        {onBlocks.map((k) => {
          const block = fxBlocks[k];
          const whyTxt = block.why ? getLocalizedText(block.why, locale) : null;
          const ranges = FX_PARAM_RANGES[k];
          const params = PARAM_ORDER[k] || [];
          const bars = params.map((p) => {
            const v = block[p];
            if (v == null || !ranges?.[p]) return null;
            return renderBar(PARAM_LABELS[p] || p, v, ranges[p]);
          }).filter(Boolean);
          return (
            <div key={k}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                <b style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 'clamp(11px, 1.25vw, 13px)', textTransform: 'uppercase', letterSpacing: 0.3, flexShrink: 0 }}>{FX_LABELS[k]}{block.type ? ` ${block.type}` : ''}{k === 'delay' && block.mode ? ` ${block.mode}` : ''}</b>
              </div>
              {bars.length > 0 && <div>{bars}</div>}
              {whyTxt && <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', color: 'var(--text-dim)', marginTop: 3, lineHeight: 1.4, fontStyle: 'italic' }}>{whyTxt}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SongDetailCard({ song, banksAnn, banksPlug, onBanksAnn, onBanksPlug, onClose, guitars, allRigsGuitars, availableSources, savedGuitarId, onGuitarChange, savedBassId, onBassChange, aiProvider, aiKeys, onSongDb, onAiCacheUpdate, profile, guitarBias, onTmpPatchOverride, songDb, onProfiles, activeProfileId, toneNetPresets, onToneNetPresets, onSharedUsagesOverrides }) {
  // Phase 7.54 — Helper interne : écrit aiCache via onAiCacheUpdate
  // (profile.aiCache) si disponible, sinon fallback onSongDb (shared).
  // Pour les invalidations (value=null), utilise aussi onAiCacheUpdate
  // (qui supprimera l'entry du profile.aiCache).
  const writeAiCache = (newValue) => {
    if (onAiCacheUpdate) onAiCacheUpdate(song.id, newValue);
    else if (onSongDb) onSongDb((p) => p.map((x) => x.id === song.id ? { ...x, aiCache: newValue } : x));
  };
  const locale = useLocale();
  const ig = getIg(song, guitars);
  const [gId, setGId] = useState(savedGuitarId || ig[0] || '');
  // Vague B — sélection basse (liste déroulante "Ma basse", symétrique à
  // GuitarSelect). '' = pas de choix explicite → fallback ideal_bass / 1ère
  // basse cochée. Pas de re-fetch au changement (cot_step2_basses contient
  // déjà le scoring de toutes les basses du rig).
  const [selectedBassId, setSelectedBassId] = useState(savedBassId || '');
  const [reloading, setReloading] = useState(false);
  const [localAiResult, setLocalAiResult] = useState(null);
  const [localAiErr, setLocalAiErr] = useState(null);
  // Phase 7.79 — modale info/édition usages d'un preset.
  const [curationModalPreset, setCurationModalPreset] = useState(null);
  const isAdmin = !!profile?.isAdmin;
  const [showFeedback, setShowFeedback] = useState(false);
  // S9.8 — zone de texte feedback inline avant bouton "Envoyer".
  const [quickFeedback, setQuickFeedback] = useState('');
  // Phase 7.86 — toggles repli pour Bloc 2 + Bloc 3
  const [showAdvancedMode, setShowAdvancedMode] = useState(false);
  const [showWhyPerKnob, setShowWhyPerKnob] = useState(false);
  const [showTweaks, setShowTweaks] = useState(false);
  const [showFxWhy, setShowFxWhy] = useState(false);
  const [installTarget, setInstallTarget] = useState(null);
  const [installBank, setInstallBank] = useState({ ann: '', plug: '' });
  const [installSlot, setInstallSlot] = useState({ ann: 'A', plug: 'A' });

  const needsRescore = song.aiCache?.sv !== SCORING_VERSION;
  // Phase 7.49 — Ticket 10 : si l'analyse cachée a été faite avec un rig
  // différent (autre profil ou rig évolué depuis), on force un fetchAI
  // complet plutôt que le rescore local. Le rigSnapshot est posé par
  // updateAiCache lors d'un fetchAI réussi (Phase 5.10.2).
  // Phase 7.81 — rigSnapshot scopé au rig du profil actif (pas allRigsGuitars
  // Phase 3.6 union all-rigs). Sinon la modification de myGuitars d'un AUTRE
  // profil (pollution myGuitars cross-profile, Phase 7.74.x) déclenche un
  // rigStale faux positif sur les caches stockés.
  const currentRigSnapshot = computeRigSnapshot(guitars || GUITARS);
  const rigStale = song.aiCache?.rigSnapshot && song.aiCache.rigSnapshot !== currentRigSnapshot;
  // Phase 8.x (2026-05-27) — bassStale : l'aiCache existe mais n'a pas
  // de bass_recommendation alors que l'user a au moins une basse OU un
  // ampli basse coché. Cas typique : aiCache calculé avant le fix Phase
  // 8.7 (v8.14.257) qui demande désormais à Gemini de TOUJOURS retourner
  // un objet bass_recommendation. Force un re-fetch unique au mount
  // pour bénéficier des nouvelles recos basse sur les morceaux historiques.
  // Pas de boucle : après le re-fetch, l'aiCache aura bass_recommendation
  // != null/undefined → bassStale devient false.
  const userHasBassRig = profile?.instruments?.includes('bass')
    && ((profile?.myBasses || []).length > 0
      || (profile?.myBassAmps || []).length > 0);
  // Vague B — bassStale étendu : aiCache pré-vague-B a un bass_recommendation
  // non-null MAIS sans cot_step2_basses (les nouveaux champs scoring/EQ/FX).
  // Force un re-fetch unique pour récupérer la symétrie complète. Pas de boucle :
  // après fetch, cot_step2_basses présent → bassStale false.
  const _br = song.aiCache?.result?.bass_recommendation;
  const bassStale = userHasBassRig
    && song.aiCache?.result?.cot_step1
    && (_br === null
      || _br === undefined
      || (typeof _br === 'object' && _br.cot_step2_basses === undefined));
  // Phase 7.51.2 — mode démo : jamais d'appel fetchAI (cache uniquement).
  const isDemo = profile?.isDemo === true;

  useEffect(() => {
    if (isDemo) return; // Phase 7.51.2 — pas de fetchAI en mode démo.
    if (localAiResult && !needsRescore && !rigStale && !bassStale) return;
    if (song.aiCache?.result?.cot_step1 && gId && !rigStale && !bassStale) {
      const gType = (guitars || GUITARS).find((x) => x.id === gId)?.type || 'HB';
      const cleaned2 = { ...song.aiCache.result, preset_ann: null, preset_plug: null, ideal_preset: null, ideal_preset_score: 0, ideal_top3: null };
      const recalc = enrichAIResult(cleaned2, gType, gId, banksAnn, banksPlug, undefined, song);
      setLocalAiResult(recalc);
      setLocalAiErr(null);
      // Phase 7.54 — Écrit dans profile.aiCache. Phase 9.9 — empreinte profil.
      setTimeout(() => writeAiCache({ ...updateAiCache(song.aiCache, gId, recalc, { fingerprint: computeAnalysisFingerprint(profile) }), sv: SCORING_VERSION }), 0);
      return;
    }
    if (!onSongDb) return;
    setReloading(true);
    setLocalAiErr(null);
    const effectiveRecoMode = song.recoMode || profile?.recoMode || 'balanced';
    const historicalFeedback = Array.isArray(song.feedback) && song.feedback.length > 0
      ? song.feedback.map((f) => f.text).filter(Boolean).join('. ')
      : null;
    // Phase 7.66 — Prompt scopé au rig profil actif (vs allRigsGuitars
    // Phase 3.6). findGuitarByAIName ligne suivante garde allRigsGuitars
    // en fallback pour résoudre les aiCache historiques pré-Phase 7.66
    // qui contiennent un ideal_guitar hors rig actif.
    fetchAI(song, gId, banksAnn, banksPlug, aiProvider, aiKeys, guitars, historicalFeedback, null, effectiveRecoMode, guitarBias, song.outputContext || profile?.outputContext || 'frfr', profile?.preferredStyles || [], (profile?.myBasses || []).map((id) => findBass(id)).filter(Boolean), (profile?.myBassAmps || []).map((id) => findBassAmp(id)).filter(Boolean), (profile?.myGuitarAmps || []).map((id) => findGuitarAmp(id)).filter(Boolean), (profile?.myPedals || []).map((id) => findPedal(id)).filter(Boolean))
      .then((r) => {
        setLocalAiResult(r);
        setLocalAiErr(null);
        // Phase 7.81 — rigSnapshot stocké = rig profil actif (pas union all-rigs).
        const rigSnapshot = computeRigSnapshot(guitars);
        // Phase 7.54 — Écrit dans profile.aiCache. Phase 9.9 — empreinte profil.
        writeAiCache({ ...updateAiCache(song.aiCache, gId, r, { rigSnapshot, fingerprint: computeAnalysisFingerprint(profile) }), sv: SCORING_VERSION });
        if (!gId && r?.ideal_guitar && onGuitarChange) {
          const matched = findGuitarByAIName(r.ideal_guitar, allRigsGuitars || guitars);
          if (matched) {
            setTimeout(() => {
              try { onGuitarChange(matched.id); } catch (e) { /* parent may not provide */ }
            }, 0);
          }
        }
      })
      .catch((e) => { setLocalAiErr(e?.message || String(e)); })
      .finally(() => setReloading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id, gId, needsRescore, rigStale, bassStale, isDemo]);

  const handleGuitarChange = (v) => {
    setGId(v);
    setLocalAiResult(null);
    setLocalAiErr(null);
    if (onGuitarChange) onGuitarChange(song.id, v);
  };
  const g = (guitars || GUITARS).find((x) => x.id === gId);
  const type = g?.type || 'HB';
  const hist = getSongHist(song);
  const aiCraw = localAiResult || (getBestResult(song, gId, song.aiCache?.result) || null);
  const needRescore = !localAiResult && aiCraw && gId && song.aiCache?.gId !== gId;
  const aiC = needRescore ? enrichAIResult({ ...aiCraw, preset_ann: null, preset_plug: null, ideal_preset: null, ideal_preset_score: 0, ideal_top3: null }, type, gId, banksAnn, banksPlug, undefined, song) : aiCraw;
  const songInfo = getSongInfo(song);
  // Phase 7.32 / 7.65 — Restreindre l'ideal_guitar au rig actif. L'aiCache
  // est partagé via Phase 3.6 (union all-rigs) donc ideal_guitar peut
  // nommer une guitare d'un autre profil. Phase 7.65 a factorisé la
  // logique dans `resolveDisplayGuitar` (cf src/app/utils/display-guitar.js),
  // partagée avec ListScreen (vue repliée). Ici on garde le comportement
  // Phase 7.32 strict (fallbackToFirst:false) : si rien dans l'aiCache ne
  // matche le rig, on cache la ligne "Guitare" plutôt que de mentir.
  const _displayGuitar = resolveDisplayGuitar(aiC, guitars, { fallbackToFirst: false });
  const idealGuitarInRigObj = _displayGuitar.guitar;
  const displayIdealGuitarName = idealGuitarInRigObj?.name || null;
  const idealGuitarScore = _displayGuitar.score;
  // idealGuitarObj : utilisé pour ouvrir le détail (cot_step2 entry). Si on
  // a un match rig, on prend son cot entry s'il existe ; sinon premier
  // cot_step2 brut (peut être hors rig — usage interne, pas un display).
  const idealGuitarObj = idealGuitarInRigObj
    ? (findCotEntryForGuitar(aiC?.cot_step2_guitars, idealGuitarInRigObj) || aiC?.cot_step2_guitars?.[0])
    : aiC?.cot_step2_guitars?.[0];
  // Phase 7.32 — Le "Preset" de la Recommandation idéale doit refléter le
  // meilleur preset RÉELLEMENT accessible à l'utilisateur (max de preset_ann,
  // preset_plug, ideal_preset). Avant : on affichait ideal_preset (catalog
  // top) même si preset_ann installé scorait plus haut, ce qui créait des
  // incohérences visuelles (preset_ann 90% en bas, "Preset 89%" en haut).
  const _displayPresetCandidates = [
    aiC?.preset_ann?.label && { type: 'ann', score: aiC.preset_ann.score || 0, label: aiC.preset_ann.label, bank: aiC.preset_ann.bank, col: aiC.preset_ann.col },
    aiC?.preset_plug?.label && { type: 'plug', score: aiC.preset_plug.score || 0, label: aiC.preset_plug.label, bank: aiC.preset_plug.bank, col: aiC.preset_plug.col },
    aiC?.ideal_preset && { type: 'catalog', score: aiC.ideal_preset_score || 0, label: aiC.ideal_preset, bank: null, col: null },
  ].filter(Boolean);
  const displayTopPreset = _displayPresetCandidates.sort((a, b) => b.score - a.score)[0] || null;
  const chosenGuitarCot = findCotEntryForGuitar(aiC?.cot_step2_guitars, g);
  const chosenGuitarScore = chosenGuitarCot?.score || localGuitarSongScore(g, aiC);
  const chosenGuitarScoreEstimated = !chosenGuitarCot && chosenGuitarScore != null;
  // Phase 7.55.7 S6 — Helpers section centralisés (tokens.js).
  // sectionStyle = sectionCard() neutre, customSectionStyle = variante
  // élevée (BG_2 vs BG_1) pour le Bloc 3 "Mon setup". sectionTitle
  // utilise sectionTitleStyle() + marginBottom 8 (vs défaut 6).
  const sectionStyle = sectionCard();
  const customSectionStyle = { ...sectionCard(), background: BG_2 };
  // Phase B — Contexte de jeu (instrument × rig). Filtre la vue morceau pour
  // n'afficher que les blocs pertinents. playsBass = profil multi-instrument.
  // availableRigs = rigs dispos pour l'instrument actif (tonex/tmp/amp).
  const playCtx = getEffectivePlayContext(profile, song);
  const playsBass = Array.isArray(profile?.instruments) && profile.instruments.includes('bass');
  const availableRigs = getAvailableRigs(profile, playCtx.instrument);
  const setPlayField = (field, value) => {
    if (!onSongDb) return;
    onSongDb((p) => p.map((x) => x.id === song.id ? { ...x, [field]: value } : x));
  };
  // Vague 1 retrait emojis (2026-05-27) — icon peut être une string emoji
  // (legacy) ou un JSX element (NavIcon). Le rendering use display:flex
  // pour aligner verticalement quand icon est un SVG.
  const sectionTitle = (icon, label) => <div style={{ ...sectionTitleStyle(), marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>{icon}<span>{label}</span></div>;

  // Scoring guitares — hoisté au scope composant (2026-05-28) pour être rendu
  // sous le dropdown "Ma guitare" (lié au choix) ET réutilisé par l'IIFE
  // Recommandations. cotInRig : cot_step2 filtré strict sur le rig actif
  // (Phase 7.65.1). compatLabelStyle/cleanGuitarName : pills bucket-color.
  const cotInRig = aiC ? filterCotGuitarsToRig(aiC.cot_step2_guitars, guitars) : [];
  // v9.7.24 — padding plus aéré (4px 10px vs 2px 8px) pour que le texte
  // respire mieux dans le cadre. Cohérence : guitares et presets utilisent
  // le même style pill.
  const compatLabelStyle = (score) => {
    const b = bucketizeScore(score);
    return { background: b.color, color: 'var(--text-inverse)', padding: '4px 10px', borderRadius: 'var(--r-sm)', fontWeight: 700, display: 'inline-block' };
  };
  const cleanGuitarName = (n) => (n || '').replace(/\s*\((?:HB|SC|P90)\)\s*$/i, '').trim();
  // Cadre "Scoring guitares" réutilisable (rendu sous le dropdown).
  const scoringGuitaresCadre = cotInRig.length > 0 ? (
    <div style={{ background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 10px', overflow: 'hidden', minWidth: 0 }}>
      <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>{t('song-detail.cot-guitars', 'Scoring guitares')}</div>
      <div className="reco-multicol">
        {cotInRig.map((gt, i) => (
          <div key={i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'clamp(12px, 1.35vw, 14px)' }}>
              {/* v9.7.24 — Sébastien demande le cadre ÉTIRÉ pleine largeur
                  (flex:1 direct) avec texte respirant (padding +
                  compatLabelStyle). Cohérence : guitare = preset visuel. */}
              <span style={{ ...compatLabelStyle(gt.score), flex: 1, wordBreak: 'break-word', minWidth: 0 }}>{(() => {
                // v9.7.22 — nom COMPLET (matched.name).
                const matched = findGuitarByAIName(gt.name, guitars);
                return matched?.name || cleanGuitarName(gt.name);
              })()}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--text-inverse)', background: scoreColor(gt.score), padding: '4px 10px', borderRadius: 'var(--r-sm)', flexShrink: 0, minWidth: 48, textAlign: 'center', fontSize: 'clamp(11px, 1.25vw, 13px)' }}>{gt.score}%</span>
            </div>
            {gt.reason && <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4, overflowWrap: 'break-word', minWidth: 0 }}>{getLocalizedText(gt.reason, locale)}</div>}
          </div>
        ))}
      </div>
    </div>
  ) : null;

  // Cadre "Réglages EQ" (preset ToneX) — hoisté pour être rendu APRÈS le
  // Scoring preset (2026-05-28). why global + tweaks empiriques.
  const ps1 = aiC?.preset_settings_v1;
  const eqSettingsCadre = (ps1 && (ps1.why || (ps1.tweaks && ps1.tweaks.length > 0))) ? (
    <div style={{ background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 10px' }}>
      <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', display: 'flex', alignItems: 'center', gap: 6 }}><NavIcon id="sliders" size={14}/>{t('song-detail.eq-settings-flat', 'Réglages EQ')}</div>
      {ps1.why && (
        <div className="prose-readable" style={{ fontSize: 'clamp(12px, 1.35vw, 14px)', color: 'var(--text-sec)', lineHeight: 1.45, marginBottom: ps1.tweaks?.length ? 6 : 0 }}>
          {getLocalizedText(ps1.why, locale)}
        </div>
      )}
      {Array.isArray(ps1.tweaks) && ps1.tweaks.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 'clamp(11px, 1.15vw, 12px)', fontWeight: 700, color: 'var(--text-dim)', marginBottom: 3, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{t('song-detail.tweaks-label', 'Si ça ne sonne pas tout à fait juste')}</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {ps1.tweaks.map((tw, i) => {
              const symptom = getLocalizedText(tw.symptom, locale);
              if (!symptom || !tw.fix) return null;
              return (
                <li key={i} style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', color: 'var(--text-sec)', lineHeight: 1.5, paddingLeft: 12, position: 'relative', marginBottom: 1 }}>
                  <span style={{ position: 'absolute', left: 0, color: 'var(--accent)' }}>·</span>
                  <i>{t('song-detail.tweaks-if', 'Si')}</i> {symptom} → <b style={{ color: 'var(--text-bright)', fontFamily: 'var(--font-mono)' }}>{String(tw.fix).replace(/_/g, ' ')}</b>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="song-row-detail" style={{ background: 'var(--bg-elev-1)', borderRadius: '0 0 12px 12px', padding: '10px 12px', marginBottom: 8, marginTop: -2, display: 'flex', flexDirection: 'column', gap: 6 }}>

      {/* Phase 7.55.7 S9.3 — Sticky bandeau supprimé. La row playlist
          parente (ListScreen) reste visible au-dessus de la fiche
          dépliée et joue le rôle de header (titre + score absolu +
          guitare + presets + potards/FX). Évite la duplication
          d'infos entre row et fiche dépliée (Sébastien 25/05). */}

      {/* Loading */}
      {reloading && (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 28, marginBottom: 6, animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>&#9203;</div>
          <div style={{ fontSize: 'clamp(12px, 1.35vw, 14px)', color: 'var(--text-muted)' }}>
            {rigStale
              ? t('song-detail.rig-stale-analyzing', 'Analyse précédente faite avec un autre rig — recalcul pour ton matériel…')
              : tFormat('song-detail.analyzing', { guitar: g?.name || t('song-detail.this-guitar', 'cette guitare') }, 'Analyse en cours pour {guitar}...')}
          </div>
        </div>
      )}

      {/* Phase B — Sélecteur "Contexte de jeu" (instrument × rig). Filtre les
          blocs affichés à ce que joue l'utilisateur. Masqué si profil
          mono-instrument ET mono-rig (zéro friction, vue identique à avant).
          Override par morceau via song.playInstrument/playRig (pas de re-fetch
          — filtre d'affichage pur). */}
      {!reloading && (playsBass || availableRigs.length > 1) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '6px 10px' }}>
          <span style={{ fontSize: TYPO.micro, color: TEXT_3, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>{t('play-context.label', 'Je joue')}</span>
          {playsBass && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { id: 'guitar', label: t('play-context.instrument-guitar', 'Guitare'), icon: 'guitar' },
                { id: 'bass', label: t('play-context.instrument-bass', 'Basse'), icon: 'bass' },
              ].map(({ id, label, icon }) => {
                const active = playCtx.instrument === id;
                return (
                  <button key={id} data-testid={`play-instrument-${id}`}
                    onClick={() => setPlayField('playInstrument', id)}
                    title={label}
                    style={{ fontSize: 12, fontFamily: 'var(--font-mono)', lineHeight: 1, padding: '10px 12px', background: active ? 'var(--accent-soft)' : 'transparent', border: `1px solid ${active ? 'var(--border-accent)' : BORDER_SUBTLE}`, color: active ? 'var(--accent)' : TEXT_2, borderRadius: 'var(--r-sm)', cursor: 'pointer', fontWeight: active ? WEIGHT.bold : WEIGHT.medium, minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <NavIcon id={icon} size={14}/>{label}
                  </button>
                );
              })}
            </div>
          )}
          {availableRigs.length > 1 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {availableRigs.map((rig) => {
                const active = playCtx.rig === rig;
                const label = rig === 'tonex' ? t('play-context.rig-tonex', 'ToneX')
                  : rig === 'tmp' ? t('play-context.rig-tmp', 'Tone Master Pro')
                    : t('play-context.rig-amp', 'Ampli');
                const icon = rig === 'tmp' ? 'sliders' : 'amp';
                return (
                  <button key={rig} data-testid={`play-rig-${rig}`}
                    onClick={() => setPlayField('playRig', rig)}
                    title={label}
                    style={{ fontSize: 12, fontFamily: 'var(--font-mono)', lineHeight: 1, padding: '10px 12px', background: active ? 'var(--accent-soft)' : 'transparent', border: `1px solid ${active ? 'var(--border-accent)' : BORDER_SUBTLE}`, color: active ? 'var(--accent)' : TEXT_2, borderRadius: 'var(--r-sm)', cursor: 'pointer', fontWeight: active ? WEIGHT.bold : WEIGHT.medium, minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <NavIcon id={icon} size={14}/>{label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Phase 7.86 — Bloc 3 : 🎸 Mon setup. GuitarSelect + outputContext +
          feedback déplacés dans sticky bandeau en tête de fiche. Mode IA
          replié dans Bloc 2 (toggle "▸ Mode reco avancé"). Ce bloc se
          concentre sur ce que je joue concrètement avec MA guitare choisie
          et MON contexte d'écoute. */}
      {playCtx.instrument === 'guitar' && (
      <div style={customSectionStyle}>
        {sectionTitle(<NavIcon id="guitar" size={16}/>, t('song-detail.setup-block', 'Ma guitare'))}
        {/* Phase 7.55.7 S9.2 — GuitarSelect + outputContext + 💬 feedback
            intégrés en tête du Bloc "Mon setup" (déplacés du sticky pour
            que l'action prioritaire soit visible dans le 1er bloc — choix
            Sébastien). */}
        <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 10, borderBottom: `1px solid ${BORDER_SUBTLE}` }}>
          {/* Phase 7.83 final4 (2026-05-27) — score chiffré pill à gauche
              du select avec fond bucket-color (cohérent avec pattern preset
              et ListScreen vue repliée). Pill bucket "Idéal" séparé retiré
              (redondant avec la couleur du score). Warn alternatives reste
              sous le select si pas idéal. */}
          {/* Vague B (2026-05-28) — homogénéise avec la liste déroulante basse :
              select à gauche (flex:1), indicateur (pill score) à droite. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}><GuitarSelect value={gId} onChange={handleGuitarChange} ig={ig} guitars={guitars} hideStatusText={true} plain={true}/></div>
            {g && chosenGuitarScore != null && (() => {
              const bucket = bucketizeScore(chosenGuitarScore);
              const longLabels = {
                ideal: t('compat.ideal-match-flat', 'Mariage parfait'),
                good: t('compat.good-match-flat', 'Bon match'),
                compromise: t('compat.compromise-flat', 'Compromis'),
              };
              const titleText = `${longLabels[bucket.id]} — ${chosenGuitarScore}%${chosenGuitarScoreEstimated ? ' ' + t('song-detail.estimated', '(estimé)') : ''}`;
              return (
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--text-inverse)', background: bucket.color, padding: '3px 9px', borderRadius: 'var(--r-sm)', textAlign: 'center', fontSize: 'clamp(11px, 1.2vw, 13px)', whiteSpace: 'nowrap', lineHeight: 1.3, flexShrink: 0, minWidth: 44 }} title={titleText}>
                  {chosenGuitarScore}%{chosenGuitarScoreEstimated ? '*' : ''}
                </span>
              );
            })()}
          </div>
          {/* Scoring guitares — sous le dropdown (lié au choix de guitare),
              déplacé depuis Recommandations guitare (2026-05-28). */}
          {scoringGuitaresCadre}
          {g && chosenGuitarScore != null && (() => {
            const isIdeal = ig.includes(gId);
            if (isIdeal || ig.length === 0) return null;
            const alternativesList = ig.map((i) => guitars.find((x) => x.id === i)?.name || GUITARS.find((x) => x.id === i)?.name).filter(Boolean).join(', ');
            if (!alternativesList) return null;
            return (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 2 }}>
                {tFormat('guitar-select.warn', { list: alternativesList }, '⚠️ Idéalement : {list}')}
              </div>
            );
          })()}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }} title={t('song-detail.output-context-label-flat', 'Sortie audio pour ce morceau')}>
            <span style={{ fontSize: TYPO.micro, color: TEXT_3, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>{t('song-detail.output-context-short', 'Sortie')}</span>
            {/* Vague 2 emojis (2026-05-28) — icones emoji ↻📢🎧🎚️ remplacées
                par labels courts texte. Label complet en title HTML au hover. */}
            {[
              { id: '', short: t('song-detail.output-short-profile', 'Profil'), label: t('song-detail.output-context-profile', 'Profil') },
              { id: 'frfr', short: t('song-detail.output-short-frfr', 'FRFR'), label: t('output-context.label.frfr', 'Enceinte FRFR') },
              { id: 'headphone', short: t('song-detail.output-short-headphone', 'Casque'), label: t('output-context.label.headphone', 'Casque') },
              { id: 'pa', short: t('song-detail.output-short-pa', 'Sono'), label: t('output-context.label.pa', 'Sono / Table de mixage') },
            ].map(({ id, short, label }) => {
              const active = (song.outputContext || '') === id;
              return (
                <button key={id || 'profile'}
                  data-testid={`song-output-context-${id || 'profile'}`}
                  onClick={() => {
                    if (isDemo) return;
                    onSongDb((p) => p.map((x) => x.id === song.id ? { ...x, outputContext: id || undefined } : x));
                    writeAiCache(null);
                    setLocalAiResult(null);
                  }}
                  disabled={isDemo}
                  title={isDemo ? t('demo.blocked', 'Action désactivée en mode démo') : (id ? tFormat('song-detail.output-context-tooltip-override', { label }, 'Override : {label}') : t('song-detail.output-context-tooltip-profile', 'Hérite du contexte profil.'))}
                  style={{ fontSize: 12, fontFamily: 'var(--font-mono)', lineHeight: 1, padding: '10px 12px', background: active ? 'var(--accent-soft)' : 'transparent', border: `1px solid ${active ? 'var(--border-accent)' : BORDER_SUBTLE}`, color: active ? 'var(--accent)' : TEXT_2, borderRadius: 'var(--r-sm)', cursor: isDemo ? 'not-allowed' : 'pointer', fontWeight: active ? WEIGHT.bold : WEIGHT.medium, opacity: isDemo ? 0.5 : 1, minHeight: 44, minWidth: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >{short}</button>
              );
            })}
            {/* S9.7 — Bouton feedback retiré du sticky (doublon avec
                'song-feedback-open' en bas de fiche, qui ouvre le formulaire
                complet via setShowFeedback(true)). */}
          </div>
        </div>
        {/* Ligne "Sur ta {guitar} :" retirée (2026-05-28, retour Sébastien) —
            redondante avec le dropdown + le Scoring guitares juste au-dessus. */}
        <div style={{ marginBottom: 8 }}>
          {/* S9.10 — Ligne "Compatibilité : X%" séparée retirée. Le score
              s'affiche désormais en pill à droite du GuitarSelect (cohérence
              avec les pills Scoring guitares / preset). */}
          {g && aiC && (() => {
            // Phase 7.85 — guitarChoiceFeedback retourne désormais un objet
            // structuré (ai|tokens|desc) qu'on compose côté UI. Avant 7.85,
            // les fallbacks pros/cons retournaient des chaînes FR concaténées
            // visibles en EN/ES (Bloqueur 1 audit démo EN).
            // Phase 9.6.2 (2026-05-22) — si la guitare choisie matche
            // cot_step2[0] (la top du scoring), sa reason est déjà rendue
            // dans le Bloc 2 "Scoring guitares". On évite la 3e répétition
            // ici uniquement pour le kind:'ai' (qui vient justement de cot).
            // kind:'tokens' (heuristique pros/cons) et kind:'desc' restent
            // visibles car informations distinctes.
            const fb = guitarChoiceFeedback(g, aiC, chosenGuitarCot);
            if (!fb) return null;
            if (fb.kind === 'ai') {
              const stripTypeSuffix = (s) => (s || '').trim().toLowerCase().replace(/\s*\([^)]*\)\s*$/, '').trim();
              const cotTop = Array.isArray(aiC.cot_step2_guitars) ? aiC.cot_step2_guitars[0] : null;
              const cotTopName = stripTypeSuffix(cotTop?.name);
              const chosenName = stripTypeSuffix(g?.name);
              if (cotTopName && chosenName && cotTopName === chosenName) return null;
            }
            let fbText = null;
            if (fb.kind === 'ai') fbText = getLocalizedText(fb.reason, locale);
            else if (fb.kind === 'tokens') {
              const prosT = (fb.pros || []).map(p => tFormat(p.key, p.params, p.fallback));
              const consT = (fb.cons || []).map(c => tFormat(c.key, c.params, c.fallback));
              const parts = [];
              if (prosT.length) parts.push('✓ ' + prosT.join(', '));
              if (consT.length) parts.push('⚠ ' + consT.join(', '));
              fbText = parts.join(' · ');
            } else if (fb.kind === 'desc') {
              fbText = fb.desc;
            }
            return fbText ? <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', color: 'var(--text-sec)', marginTop: 3, marginLeft: 24, lineHeight: 1.4 }}>{fbText}</div> : null;
          })()}
          {g && aiC && !aiC.playing_hints && (() => {
            // Phase 7.82 — localGuitarSettings retourne un objet structuré ;
            // composition i18n côté UI (Bug #2 "Micro chevalet" en EN).
            // Phase 9.6 (2026-05-22) — gated par !aiC.playing_hints : si l'IA
            // a fourni des playing_hints (Phase 9.5), le bloc "💡 Conseil IA"
            // ci-dessous prend le relais avec des valeurs contextuelles au
            // morceau. Le bloc "Réglages" local n'apparaît plus qu'en
            // fallback pour les aiCache pré-9.5 (ou si l'IA n'a pas
            // retourné playing_hints valide).
            const s = localGuitarSettings(g, aiC);
            if (!s) return null;
            const pickupTxt = t(s.pickupKey, s.pickupFallback);
            const mismatchTxt = s.mismatchKey ? t(s.mismatchKey, s.mismatchFallback) : '';
            const text = `${pickupTxt} · ${t('song-detail.tone-label', 'Tone')} ${s.tone} · ${t('song-detail.volume-label', 'Volume')} ${s.volume}${mismatchTxt}`;
            return <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', background: 'var(--a4)', border: '1px solid var(--a10)', borderRadius: 'var(--r-md)', padding: '5px 8px', color: 'var(--text-sec)', marginTop: 5, marginLeft: 24 }}><b style={{ color: 'var(--text-muted)' }}>{t('song-detail.settings', 'Réglages :')}</b> {text}</div>;
          })()}
          {/* S9.10 — playing_hints (Conseil IA pickup/tone/volume/stereo)
              retiré de Mon Setup et intégré dans le cadre Recommandations
              (Bloc 2) sous "Guitare :" — choix Sébastien : ces hints
              concernent la guitare donc leur place est dans Recommandations
              avec settings_guitar. */}
        </div>
        {/* Phase 7.83 final5 (2026-05-27) — Bloc Mode reco avancé retiré
            de la fiche song : l'utilisateur ne comprenait pas le wording
            (↻ Profil / ⚖️ Équilibré / 🎯 Fidèle / 🎨 Interprétation) sans
            le contexte de Mon Profil → Préférences IA. L'override par
            morceau (song.recoMode) reste fonctionnel côté data — mais
            seul le réglage profil global est exposé dans l'UI. Si une
            poignée de power-users veulent l'override par morceau, on
            réintroduira plus tard avec un wording plus clair. */}
        {/* Phase 7.55.7 S9.4 — Section "Meilleurs presets installés" droppée.
            Doublon avec la row playlist parente (qui affiche déjà les
            presets installés Anniv/Plug via meta-grid devices). Sébastien
            25/05. Seuls les device blocks avec RecommendBlock (TMP) sont
            conservés (pas représentés dans la row). */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {playCtx.rig === 'tmp' && getActiveDevicesForRender(profile).filter((d) => typeof d.RecommendBlock === 'function').map((d) => (
            <div key={d.id} style={{ borderTop: '1px solid var(--a8)', marginTop: 6, paddingTop: 6 }}>
              <div style={{ fontSize: 'clamp(11px, 1.15vw, 12px)', fontWeight: 700, color: d.deviceColor || 'var(--brass-400)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                <NavIcon id={d.iconId || 'amp'} size={11}/><span>{d.label}</span>
              </div>
              <d.RecommendBlock song={song} guitar={g} profile={profile} allGuitars={guitars} onPatchOverride={onTmpPatchOverride}/>
            </div>
          ))}
        </div>
        {/* Suggestion d'amélioration si score < 90% (ToneX uniquement — Phase B) */}
        {aiC && playCtx.rig === 'tonex' && (() => {
          const bestScore = Math.max(aiC.preset_ann?.score || 0, aiC.preset_plug?.score || 0, aiC.ideal_preset_score || 0);
          if (bestScore >= 90) return null;
          const bestBreakdown = aiC.preset_ann?.breakdown || aiC.preset_plug?.breakdown;
          const refAmp = aiC.ref_amp || t('song-detail.original-amp', "l'ampli original");
          let weakest = null; let weakLabel = ''; let weakScore = 100;
          if (bestBreakdown) {
            const dims = [
              { key: 'refAmp', label: t('song-detail.dim-amp', 'Ampli'), score: bestBreakdown.refAmp?.raw },
              { key: 'gainMatch', label: t('song-detail.dim-gain', 'Gain'), score: bestBreakdown.gainMatch?.raw },
              { key: 'styleMatch', label: t('song-detail.dim-style', 'Style'), score: bestBreakdown.styleMatch?.raw },
              { key: 'pickup', label: t('song-detail.dim-pickup', 'Micro'), score: bestBreakdown.pickup?.raw },
            ];
            dims.forEach((d) => { if (d.score != null && d.score < weakScore) { weakScore = d.score; weakest = d.key; weakLabel = d.label; } });
          }
          const extMatches = [];
          const refLower = (refAmp || '').toLowerCase();
          for (const packName in TSR_PACK_ZIPS) {
            if (packName.toLowerCase().includes(refLower) || refLower.includes(packName.toLowerCase())) {
              extMatches.push({ creator: 'The Studio Rats', url: 'thestudiorats.com', pack: packName });
            }
          }
          (EXTERNAL_PACK_CATALOG || []).forEach((creator) => {
            if (creator.creator === 'The Studio Rats') return;
            creator.packs.forEach((pack) => {
              const match = pack.amps.some((a) => refLower.includes(a) || a.includes(refLower));
              if (match) {
                const already = extMatches.find((e) => e.creator === creator.creator && e.pack === pack.name);
                if (!already) extMatches.push({ creator: creator.creator, url: creator.url, pack: pack.name });
              }
            });
          });
          if (extMatches.length === 0 && AMP_TAXONOMY) {
            const refTax = AMP_TAXONOMY[refAmp];
            if (refTax) {
              for (const pn in TSR_PACK_ZIPS) {
                const pnLower = pn.toLowerCase();
                for (const ampName in AMP_TAXONOMY) {
                  if (pnLower.includes(ampName.toLowerCase().split(' ')[0]) && AMP_TAXONOMY[ampName].family === refTax.family) {
                    const alr = extMatches.find((e) => e.creator === 'The Studio Rats' && e.pack === pn);
                    if (!alr) extMatches.push({ creator: 'The Studio Rats', url: 'thestudiorats.com', pack: pn, family: true });
                    break;
                  }
                }
              }
              (EXTERNAL_PACK_CATALOG || []).forEach((creator) => {
                if (creator.creator === 'The Studio Rats') return;
                creator.packs.forEach((pack) => {
                  pack.amps.forEach((a) => {
                    for (const ampName in AMP_TAXONOMY) {
                      if (ampName.toLowerCase().includes(a) && AMP_TAXONOMY[ampName].family === refTax.family) {
                        const already = extMatches.find((e) => e.creator === creator.creator && e.pack === pack.name);
                        if (!already) extMatches.push({ creator: creator.creator, url: creator.url, pack: pack.name, family: true });
                        return;
                      }
                    }
                  });
                });
              });
            }
          }
          let suggestion = '';
          if (weakest === 'refAmp') suggestion = tFormat('song-detail.weak-amp', { ref: refAmp }, 'Aucun preset installé ne simule {ref}.');
          else if (weakest === 'gainMatch') suggestion = t('song-detail.weak-gain', 'Le gain des presets disponibles ne correspond pas au son original.');
          else if (weakest === 'styleMatch') suggestion = t('song-detail.weak-style', 'Le style des presets disponibles ne matche pas bien.');
          else if (weakest === 'pickup') suggestion = tFormat('song-detail.weak-pickup', { type }, 'Les presets ne sont pas optimises pour votre type de micro ({type}).');
          else suggestion = t('song-detail.weak-generic', "Le meilleur preset installé n'atteint pas 90%.");
          return (
            <div style={{ marginTop: 8, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', fontWeight: 700, color: 'var(--yellow)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>{tFormat('song-detail.improvable', { score: bestScore }, 'Ameliorable — {score}% max')}</div>
              <div className="prose-readable" style={{ fontSize: 'clamp(12px, 1.35vw, 14px)', color: 'var(--text-sec)', lineHeight: 1.5, marginBottom: 6 }}>
                {weakest && <span>{tFormat('song-detail.weak-point', { label: weakLabel, score: weakScore }, 'Point faible : ')}<b>{weakLabel}</b> ({weakScore}%). </span>}
                {suggestion}
              </div>
              {extMatches.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>{t('song-detail.recommended-packs', 'Packs recommandés à l\'achat :')}</div>
                  {extMatches.map((e, i) => (
                    <div key={i} style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', color: 'var(--text-sec)', marginBottom: 3, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <StatusDot score={e.family ? 65 : 85} size={6}/>
                      <span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{e.pack}</span>
                      <span style={{ color: 'var(--text-dim)' }}>{e.creator}</span>
                      {e.family && <span style={{ fontSize: 'clamp(11px, 1.15vw, 12px)', color: 'var(--text-dim)' }}>{t('song-detail.family-similar', '[famille similaire]')}</span>}
                    </div>
                  ))}
                </div>
              )}
              {extMatches.length === 0 && <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', color: 'var(--text-dim)', marginBottom: 6 }}>{tFormat('song-detail.no-pack', { ref: refAmp }, 'Aucun pack connu pour "{ref}" dans notre base.')}</div>}
              <div style={{ marginTop: 6, background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 6, padding: '8px 10px' }}>
                <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', fontWeight: 600, color: 'var(--text-sec)', marginBottom: 3 }}>{t('song-detail.tonenet-search', 'Recherche ToneNET')}</div>
                <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', color: 'var(--text-dim)', marginBottom: 4 }}>{tFormat('song-detail.tonenet-instructions', { ref: refAmp }, 'Recherchez {ref} dans le moteur de recherche ToneNET').split(refAmp).map((part, i, arr) => i < arr.length - 1 ? <React.Fragment key={i}>{part}<b style={{ color: 'var(--text-bright)' }}>{refAmp}</b></React.Fragment> : part)}</div>
                <a href="https://tone.net" target="_blank" rel="noopener noreferrer" style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', color: 'var(--accent)', textDecoration: 'underline' }}>tone.net</a>
              </div>
            </div>
          );
        })()}
      </div>
      )}


      {!reloading && aiC && playCtx.instrument === 'guitar' && (() => {
        // Phase 7.65.1 — Filtre strict cot_step2_guitars sur le rig actif
        // (Phase 3.6 union all-rigs au prompt peut amener des guitares
        // d'autres profils, ex. Bruno voyait Strat AM Vintage II 61 hors rig).
        // cotInRig / compatLabelStyle / cleanGuitarName hoistés au scope
        // composant (2026-05-28) — utilisés ici (Guitare idéale, Scoring
        // preset) ET pour le cadre "Scoring guitares" déplacé sous le dropdown.
        return (
        <>
          {/* Phase 7.86 — Bloc 2 : 🎯 Recommandations IA. Fusion ancienne SECTION 2
              (Raisonnement IA pliable) + SECTION 3 (Recommandation idéale).
              Scoring guitares en tête (déplacé de SECTION 2), puis guitare/preset
              idéal, alternatives catalogue, settings_preset prose, et toggle
              Mode reco avancé en bas (replié — Phase 7.3 boutons). */}
          <div style={sectionStyle}>
            {sectionTitle(<NavIcon id="target" size={16}/>, t('song-detail.reco-block', 'Recommandations guitare'))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* S9.8 NOUVEL ORDRE :
                  1. Recommandations (settings_preset + settings_guitar)
                  2. Réglages EQ (renommé Réglages pédale, why + tweaks)
                  3. Réglages effets (renommé Effets activés, avec valeurs sub-params)
                  4. Scoring guitares (descendu après les réglages)
                  5. Scoring preset (descendu) */}

              {/* SECTION 1 — Cadre Recommandations (settings_preset + settings_guitar + playing_hints)
                  S9.10 — playing_hints (Conseil IA pickup/tone/volume/stereo)
                  intégrés sous "Guitare :" comme sous-ligne. Déplacés depuis
                  Mon Setup où ils faisaient double avec settings_guitar. */}
              {(() => {
                const hasGuitarBlock = aiC.settings_guitar || aiC.playing_hints;
                if (!aiC.settings_preset && !hasGuitarBlock) return null;
                // Construit le texte des playing_hints (pickup / tone / volume).
                let phText = null;
                let phStereo = false;
                if (aiC.playing_hints) {
                  const ph = aiC.playing_hints;
                  const parts = [];
                  if (ph.pickup) parts.push(localizePickup(ph.pickup, locale));
                  if (ph.guitar_tone) parts.push(`${t('song-detail.tone-label', 'Tone')} ${ph.guitar_tone}`);
                  if (ph.guitar_volume) parts.push(`${t('song-detail.volume-label', 'Volume')} ${ph.guitar_volume}`);
                  if (parts.length > 0) phText = parts.join(' · ');
                  phStereo = ph.stereo === true;
                }
                return (
                  <div style={{ background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 10px' }}>
                    {/* Phase A — titre "Recommandations" retiré (collision avec
                        la section "Recommandations guitare" + emoji). Le contenu
                        Preset/Guitare reste, sans en-tête redondant. */}
                    {aiC.settings_preset && <div className="prose-readable" style={{ fontSize: 'clamp(12px, 1.35vw, 14px)', color: 'var(--text-sec)', lineHeight: 1.45, marginBottom: hasGuitarBlock ? 6 : 0 }}><b style={{ color: 'var(--text-muted)' }}>{t('song-detail.preset-settings', 'Preset :')}</b> {getLocalizedText(aiC.settings_preset, locale)}</div>}
                    {hasGuitarBlock && (
                      <div className="prose-readable" style={{ fontSize: 'clamp(12px, 1.35vw, 14px)', color: 'var(--text-sec)', lineHeight: 1.45 }}>
                        <b style={{ color: 'var(--text-muted)' }}>{t('song-detail.guitar-settings', 'Guitare :')}</b>
                        {aiC.settings_guitar && <> {getLocalizedText(aiC.settings_guitar, locale)}</>}
                        {(phText || phStereo) && (
                          <div style={{ marginTop: 4, paddingLeft: 12, fontSize: 'clamp(11px, 1.25vw, 13px)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {phText && <span>↳ {phText}</span>}
                            {phStereo && (
                              <span style={{ padding: '1px 5px', borderRadius: 'var(--r-sm)', background: 'var(--brass-bg)', color: 'var(--brass)', fontSize: 'clamp(11px, 1.15vw, 12px)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                                {t('playing-hints.stereo-flat', 'STEREO')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Phase 9.8 — Réglages micros de la guitare SÉLECTIONNÉE
                  (chosenGuitarCot.controls). Maj instantanée au changement de
                  la liste déroulante (g/gId → re-render, 0 re-fetch). */}
              <PickupControlsCadre controls={chosenGuitarCot?.controls} locale={locale}/>

              {/* Réglages EQ + effets déplacés APRÈS Scoring preset (2026-05-28,
                  retour Sébastien : le scoring preset vient avant les réglages).
                  Cf eqSettingsCadre + FxBlocksCadre plus bas. */}
              {/* Cadre "Scoring guitares" déplacé sous le dropdown "Ma guitare"
                  (2026-05-28, lié au choix de guitare). Voir scoringGuitaresCadre. */}
              {/* Guitare idéale (cas family boost Phase 7.64 où idéale ≠ top scoring) */}
              {displayIdealGuitarName && (() => {
                const stripTypeSuffix = (s) => (s || '').trim().toLowerCase().replace(/\s*\([^)]*\)\s*$/, '').trim();
                const cotTop = Array.isArray(aiC.cot_step2_guitars) ? aiC.cot_step2_guitars[0] : null;
                const cotTopName = stripTypeSuffix(cotTop?.name);
                const idealName = stripTypeSuffix(displayIdealGuitarName);
                if (cotTopName && idealName && cotTopName === idealName) return null;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'clamp(12px, 1.35vw, 14px)' }}>
                    {/* v9.7.24 — cadre étiré pleine largeur (flex:1 sur le span
                        cadre vert) avec label "Guitare" devant en flexShrink:0. */}
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{t('song-detail.guitar-label', 'Guitare ')}</span>
                    <span style={{ ...compatLabelStyle(idealGuitarScore || 100), flex: 1, wordBreak: 'break-word', minWidth: 0 }}>{cleanGuitarName(displayIdealGuitarName)}</span>
                    {idealGuitarScore != null && idealGuitarScore > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--text-inverse)', background: scoreColor(idealGuitarScore), padding: '2px 7px', borderRadius: 'var(--r-sm)', flexShrink: 0, minWidth: 44, textAlign: 'center', fontSize: 'clamp(11px, 1.25vw, 13px)' }}>{idealGuitarScore}%</span>}
                  </div>
                );
              })()}
              {/* Phase 9.6 (2026-05-22) — masquer guitar_reason quand il
                  duplique cot_step2_guitars[0].reason. C'est le cas
                  courant : Gemini retourne souvent une reason similaire
                  dans cot_step2[0] (comparatif) et guitar_reason (focus
                  ideal). Cas family boost Phase 7.64 (ideal_guitar ≠
                  cot_step2[0]) → guitar_reason garde sa valeur ajoutée.
                  Phase 9.6.1 (2026-05-22) — normalisation des names :
                  cot_step2[0].name vient parfois avec un suffix type
                  "(HB)" ajouté par Gemini ("Gibson SG Standard Ebony
                  (HB)") alors que displayIdealGuitarName est sans
                  suffix. On strip "(...)" à la fin avant comparison. */}
              {aiC.guitar_reason && (() => {
                const stripTypeSuffix = (s) => (s || '').trim().toLowerCase().replace(/\s*\([^)]*\)\s*$/, '').trim();
                const cotTop = Array.isArray(aiC.cot_step2_guitars) ? aiC.cot_step2_guitars[0] : null;
                const cotTopName = stripTypeSuffix(cotTop?.name);
                const idealName = stripTypeSuffix(displayIdealGuitarName);
                const isDuplicate = cotTopName && idealName && cotTopName === idealName;
                if (isDuplicate) return null;
                return <div className="prose-readable" style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', color: 'var(--text-dim)', marginTop: -2, marginBottom: 2 }}>{getLocalizedText(aiC.guitar_reason, locale)}</div>;
              })()}
              {/* S9.7 — Cadre "Scoring preset" symétrique au cadre "Scoring
                  guitares". Wrap le preset reco top + alternatives catalog.
                  Scores alignés à droite via pill (même style que Scoring
                  guitares). */}
              {playCtx.rig === 'tonex' && (displayTopPreset || (aiC.ideal_top3 && aiC.ideal_top3.length > 1)) && getActiveDevicesForRender(profile).some((d) => d.deviceKey === 'ann' || d.deviceKey === 'plug') && (
              <div style={{ background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 10px' }}>
                <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>{t('song-detail.scoring-preset', 'Scoring preset')}</div>
              {displayTopPreset && (() => {
                const displayPresetName = displayTopPreset.label;
                const idealScore = displayTopPreset.score || 0;
                const locAnn = findInBanks(displayPresetName, banksAnn);
                const locPlug = findInBanks(displayPresetName, banksPlug);
                const loc = locAnn || locPlug;
                const entry = findCatalogEntry(displayPresetName);
                if (availableSources && entry?.src && availableSources[entry.src] === false) return null;
                const canInstallAnn = !locAnn && onBanksAnn;
                const canInstallPlug = !locPlug && onBanksPlug;
                const doInstall = (device) => {
                  const bk = Number(installBank[device]);
                  const sl = installSlot[device];
                  const onBanks = device === 'ann' ? onBanksAnn : onBanksPlug;
                  if (isNaN(bk) || !sl || !onBanks) return;
                  onBanks((p) => ({ ...p, [bk]: { ...(p[bk] || { cat: '', A: '', B: '', C: '' }), [sl]: displayPresetName } }));
                  setInstallTarget(null);
                };
                const bankInput = (device, maxBanks) => {
                  const banks = device === 'ann' ? banksAnn : banksPlug;
                  const bk = installBank[device];
                  const sl = installSlot[device];
                  const currentPreset = bk !== '' && banks[Number(bk)] ? banks[Number(bk)][sl] || t('song-detail.empty', '(vide)') : '';
                  const dev = getActiveDevicesForRender(profile).find((d) => d.deviceKey === device);
                  const deviceLabel = dev ? dev.label : (device === 'ann' ? 'Pédale' : 'Plug');
                  return (
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', color: 'var(--text-sec)', marginBottom: 4, fontWeight: 600 }}>{deviceLabel}</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', color: 'var(--text-muted)' }}>{t('song-detail.bank', 'Banque')}</span>
                        <input type="number" inputMode="numeric" min={device === 'ann' ? 0 : 1} max={maxBanks} value={bk} onChange={(e) => setInstallBank((p) => ({ ...p, [device]: e.target.value }))} style={{ width: 50, fontSize: 'clamp(12px, 1.35vw, 14px)', background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-md)', padding: '4px 6px', textAlign: 'center' }} placeholder={device === 'ann' ? '0-49' : '1-10'}/>
                        <span style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', color: 'var(--text-muted)' }}>{t('song-detail.slot', 'Slot')}</span>
                        <select value={sl} onChange={(e) => setInstallSlot((p) => ({ ...p, [device]: e.target.value }))} style={{ fontSize: 'clamp(12px, 1.35vw, 14px)', background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-md)', padding: '4px 6px' }}>
                          <option value="A">{t('song-detail.slot-a', 'A (Clean)')}</option><option value="B">{t('song-detail.slot-b', 'B (Drive)')}</option><option value="C">{t('song-detail.slot-c', 'C (Lead)')}</option>
                        </select>
                        <button onClick={() => doInstall(device)} disabled={bk === ''} style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', background: bk !== '' ? 'var(--accent)' : 'var(--bg-disabled)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '4px 10px', cursor: bk !== '' ? 'pointer' : 'not-allowed', fontWeight: 700 }}>{t('song-detail.ok', 'OK')}</button>
                      </div>
                      {bk !== '' && currentPreset && <div style={{ fontSize: 'clamp(11px, 1.15vw, 12px)', color: 'var(--text-dim)', marginTop: 2 }}>{tFormat('song-detail.replaces', { preset: currentPreset }, 'Remplace : {preset}')}</div>}
                    </div>
                  );
                };
                return (
                  <div style={{ marginBottom: 6 }}>
                    {/* v9.7.26 — Restructure en 3 LIGNES claires :
                          L1 : cadre vert amp (étiré pleine largeur) + pill score
                          L2 : nom technique preset + pack + CurationDot
                          L3 : état installation + bouton installer
                        Cohérence avec demande Sébastien : homogénéité cadres
                        + hiérarchie verticale lisible. */}
                    {/* Ligne 1 : cadre amp étiré + score */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'clamp(12px, 1.35vw, 14px)' }}>
                      <span style={{ ...compatLabelStyle(idealScore), flex: 1, wordBreak: 'break-word', minWidth: 0 }}>{entry?.amp || displayPresetName}</span>
                      {idealScore > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--text-inverse)', background: scoreColor(idealScore), padding: '4px 10px', borderRadius: 'var(--r-sm)', flexShrink: 0, minWidth: 48, textAlign: 'center', fontSize: 'clamp(11px, 1.25vw, 13px)' }}>{idealScore}%</span>}
                    </div>
                    {/* Ligne 2 : nom tech mono dim + pack + CurationDot */}
                    {(() => {
                      const si = getSourceInfo(entry);
                      const hasTechName = !!entry?.amp;  // le nom tech n'a de sens que si différent de l'amp
                      if (!hasTechName && !si) return null;
                      return (
                        <div style={{ fontSize: 'clamp(11px, 1.15vw, 12px)', marginTop: 3, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {hasTechName && <span style={{ wordBreak: 'break-word' }} title={displayPresetName}>{displayPresetName}</span>}
                          {hasTechName && si && <span>·</span>}
                          {si && <span style={{ wordBreak: 'break-word' }}>{si.label}</span>}
                          <span style={{ marginLeft: 2, flexShrink: 0 }}>
                            <CurationDot name={displayPresetName} onClick={(n) => setCurationModalPreset(n)}/>
                          </span>
                        </div>
                      );
                    })()}
                    {/* Ligne 3 : état installation + bouton installer */}
                    <div style={{ fontSize: 'clamp(11px, 1.15vw, 12px)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {loc ? <span style={{ color: 'var(--green)' }}>{tFormat('song-detail.installed-bank', { bank: loc.bank, slot: loc.slot }, '✓ Installé — Banque {bank}{slot}')}</span>
                        : <span style={{ color: 'var(--yellow)' }}>{t('song-detail.not-installed-flat', 'Non installé')}</span>}
                      {!loc && !installTarget && (canInstallAnn || canInstallPlug) && <button onClick={() => setInstallTarget({ preset: displayPresetName })} style={{ fontSize: 'clamp(11px, 1.15vw, 12px)', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', color: 'var(--accent)', borderRadius: 'var(--r-sm)', padding: '2px 8px', cursor: 'pointer', fontWeight: 600, marginLeft: 'auto' }}>{t('song-detail.install', 'Installer')}</button>}
                    </div>
                    {installTarget?.preset === displayPresetName && (() => {
                      const activeEnabled = getActiveDevicesForRender(profile);
                      const canPedal = canInstallAnn && activeEnabled.some((d) => d.deviceKey === 'ann');
                      const canPlug = canInstallPlug && activeEnabled.some((d) => d.deviceKey === 'plug');
                      if (!canPedal && !canPlug) return null;
                      return (
                        <div style={{ marginTop: 6, background: 'var(--a4)', border: '1px solid var(--a10)', borderRadius: 'var(--r-md)', padding: 10 }}>
                          <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', color: 'var(--text-sec)', marginBottom: 8, fontWeight: 600 }}>{tFormat('song-detail.install-target', { preset: displayPresetName }, 'Installer "{preset}" sur :')}</div>
                          {canPedal && bankInput('ann', 49)}
                          {canPlug && bankInput('plug', 10)}
                          <button onClick={() => setInstallTarget(null)} style={{ fontSize: 'clamp(11px, 1.15vw, 12px)', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>{t('song-detail.cancel', 'Annuler')}</button>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
              {(() => {
                const filteredTop3 = (aiC.ideal_top3 || []).filter((p) => {
                  const e = findCatalogEntry(p.name);
                  return !availableSources || !e?.src || availableSources[e.src] !== false;
                });
                if (filteredTop3.length <= 1) return null;
                return (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 'clamp(11px, 1.15vw, 12px)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', color: 'var(--text-tertiary)', marginBottom: 4 }}>{t('song-detail.alternatives', 'Alternatives catalogue')}</div>
                    {/* Phase 7.83 final7 — grid 2 col max desktop (cf .reco-multicol) */}
                    <div className="reco-multicol">
                      {filteredTop3.slice(1).map((p, i) => {
                        const loc = findInBanks(p.name, banksAnn) || findInBanks(p.name, banksPlug);
                        const entry = findCatalogEntry(p.name);
                        const si = getSourceInfo(entry);
                        return (
                          <div key={i}>
                            {/* v9.7.26 — Restructure en 3 LIGNES (cohérent avec
                                Scoring preset principal) :
                                  L1 : cadre amp étiré + score
                                  L2 : nom tech mono + pack
                                  L3 : état installation */}
                            {(() => {
                              const ampName = entry?.amp || p.amp;
                              return (
                                <>
                                  {/* Ligne 1 : cadre étiré + score */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'clamp(11px, 1.25vw, 13px)' }}>
                                    <span style={{ ...compatLabelStyle(p.score), flex: 1, wordBreak: 'break-word', minWidth: 0 }}>{ampName || p.name}</span>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--text-inverse)', background: scoreColor(p.score), padding: '4px 10px', borderRadius: 'var(--r-sm)', flexShrink: 0, minWidth: 48, textAlign: 'center', fontSize: 'clamp(11px, 1.25vw, 13px)' }}>{p.score}%</span>
                                  </div>
                                  {/* Ligne 2 : nom tech mono + pack */}
                                  {(ampName || si) && (
                                    <div style={{ fontSize: 'clamp(11px, 1.15vw, 12px)', marginTop: 3, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                      {ampName && <span style={{ wordBreak: 'break-word' }} title={p.name}>{p.name}</span>}
                                      {ampName && si && <span>·</span>}
                                      {si && <span style={{ wordBreak: 'break-word' }}>{si.label}</span>}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                            {/* Ligne 3 : état installation */}
                            <div style={{ fontSize: 'clamp(11px, 1.15vw, 12px)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              {loc ? <span style={{ color: 'var(--green)' }}>{tFormat('song-detail.installed-bank', { bank: loc.bank, slot: loc.slot }, '✓ Installé — Banque {bank}{slot}')}</span>
                                : <span style={{ color: 'var(--yellow)' }}>{t('song-detail.not-installed-flat', 'Non installé')}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              </div>
              )}
              {/* Réglages EQ + effets APRÈS le Scoring preset (2026-05-28) :
                  le scoring preset (quelle capture ToneX) vient avant les
                  réglages de cette capture. Phase B — gated rig ToneX. */}
              {playCtx.rig === 'tonex' && (
                // v9.7.11 (audit Cowork P2-A) — Réglages EQ + Réglages effets
                // côte à côte sur iPad ≥720px (les 2 tableaux les plus denses
                // de la fiche, consultés ensemble). Mobile : empilé.
                <div className="ipad-2col">
                  {eqSettingsCadre}
                  <FxBlocksCadre fxBlocks={aiC.fx_blocks} locale={locale} title={t('song-detail.fx-settings-flat', 'Réglages effets')}/>
                </div>
              )}
              {/* Phase A — Cadre "Sur ton ampli" (ampli guitare traditionnel
                  RÉEL, distinct des cadres ToneX EQ/effets/preset). Gated par
                  ampli guitare coché + guitar_amp_settings de l'IA. Phase B —
                  affiché uniquement en contexte rig = Ampli. */}
              {playCtx.rig === 'amp' && (profile?.myGuitarAmps?.length > 0) && aiC.guitar_amp_settings && aiC.guitar_amp_settings.settings && Object.keys(aiC.guitar_amp_settings.settings).length > 0 && (() => {
                const gas = aiC.guitar_amp_settings;
                const whyTxt = gas.why ? getLocalizedText(gas.why, locale) : null;
                return (
                  <div style={{ background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 10px' }}>
                    <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <NavIcon id="amp" size={14}/>{gas.amp ? tFormat('song-detail.guitar-amp-block-named', { amp: gas.amp }, 'Sur ton {amp}') : t('song-detail.guitar-amp-block', 'Sur ton ampli')}
                      {gas.channel ? <span style={{ fontWeight: 400, color: 'var(--text-dim)', textTransform: 'none' }}>· {gas.channel}</span> : null}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 'clamp(12px, 1.35vw, 14px)', color: 'var(--text-sec)', fontFamily: 'var(--font-mono)' }}>
                      {Object.entries(gas.settings).map(([k, v]) => (
                        <span key={k}><b style={{ color: 'var(--text-muted)' }}>{k.replace(/_/g, ' ')}</b> {v}</span>
                      ))}
                    </div>
                    {whyTxt && <div className="prose-readable" style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.4, fontStyle: 'italic' }}>{whyTxt}</div>}
                  </div>
                );
              })()}
              {/* Phase C — Cadre "Sur ton pédalier" : pédales à activer +
                  réglages, gated rig = Ampli + pédales cochées + reco IA. */}
              {playCtx.rig === 'amp' && (profile?.myPedals?.length > 0) && Array.isArray(aiC.pedalboard_settings) && aiC.pedalboard_settings.length > 0 && (
                <div style={{ background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 10px' }}>
                  <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <NavIcon id="sliders" size={14}/>{t('song-detail.pedalboard-block', 'Sur ton pédalier')}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {aiC.pedalboard_settings.map((p, i) => {
                      const whyTxt = p.why ? getLocalizedText(p.why, locale) : null;
                      const entries = p.settings && typeof p.settings === 'object' ? Object.entries(p.settings) : [];
                      return (
                        <div key={i}>
                          <div style={{ fontSize: 'clamp(12px, 1.35vw, 14px)', fontWeight: 600, color: 'var(--text)' }}>{p.pedal}</div>
                          {entries.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 'clamp(11px, 1.25vw, 13px)', color: 'var(--text-sec)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                              {entries.map(([k, v]) => (
                                <span key={k}><b style={{ color: 'var(--text-muted)' }}>{k.replace(/_/g, ' ')}</b> {v}</span>
                              ))}
                            </div>
                          )}
                          {whyTxt && <div className="prose-readable" style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4, fontStyle: 'italic' }}>{whyTxt}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
        );
      })()}


      {!reloading && !aiC && !localAiErr && <div style={{ fontSize: 'clamp(12px, 1.35vw, 14px)', color: 'var(--text-dim)', padding: '10px 0' }}>{t('song-detail.no-cache', 'Aucune analyse IA en cache. Selectionne une guitare pour lancer l\'analyse.')}</div>}
      {/* Phase 7.55.7 S7 — AIErrorPanel classifie l'erreur Gemini et
          affiche un message user-friendly trilingue stylé. Le data-testid
          reste pour les tests existants. */}
      {localAiErr && !reloading && (
        <div data-testid="song-ai-error">
          <AIErrorPanel error={localAiErr}/>
        </div>
      )}

      {/* SECTION 6 : Feedback IA */}
      {!reloading && aiC && (
        <div style={{ marginTop: 8 }}>
          {Array.isArray(song.feedback) && song.feedback.length > 0 && (() => {
            const all = song.feedback;
            const showFromIdx = Math.max(0, all.length - 3);
            return (
              <div style={{ background: 'var(--a3)', border: '1px solid var(--a7)', borderRadius: 'var(--r-md)', padding: '6px 10px', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ fontSize: 'clamp(11px, 1.15vw, 12px)', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 }}>{tFormat('song-detail.feedback-history-flat', { count: all.length }, 'Tes feedbacks précédents ({count})')}</div>
                  {all.length > 1 && <button
                    data-testid="song-feedback-clear-all"
                    onClick={() => {
                      if (isDemo) return;
                      if (!window.confirm(tFormat('song-detail.feedback-clear-confirm', { count: all.length, title: song.title }, 'Effacer tous les {count} feedbacks pour "{title}" ?\n\nL\'analyse IA va être recalculée sans tes corrections passées (~8s).'))) return;
                      // Phase 7.54 — feedback dans song (shared), aiCache dans profile
                      onSongDb((p) => p.map((x) => x.id === song.id ? { ...x, feedback: [] } : x));
                      writeAiCache(null);
                      setLocalAiResult(null);
                    }}
                    disabled={isDemo}
                    style={{ fontSize: 'clamp(11px, 1.15vw, 12px)', background: 'none', border: '1px solid var(--a10)', color: 'var(--text-dim)', borderRadius: 'var(--r-sm)', padding: '1px 6px', cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.5 : 1 }}
                    title={isDemo ? t('demo.blocked', 'Action désactivée en mode démo') : t('song-detail.feedback-clear-tooltip', 'Effacer tous les feedbacks pour ce morceau')}
                  >{t('song-detail.feedback-clear-all', 'Tout effacer')}</button>}
                </div>
                {all.map((fb, i) => {
                  if (i < showFromIdx) return null;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 'clamp(11px, 1.25vw, 13px)', color: 'var(--text-sec)', lineHeight: 1.4, marginBottom: 2 }}>
                      <span style={{ flex: 1 }}>· <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>{fb.ts ? new Date(fb.ts).toLocaleDateString(getLocale()) : ''}</span> — {fb.text}</span>
                      <button
                        data-testid={`song-feedback-delete-${i}`}
                        onClick={() => {
                          if (isDemo) return;
                          // Phase 7.54 — feedback dans song (shared), aiCache dans profile
                          onSongDb((p) => p.map((x) => x.id === song.id ? { ...x, feedback: (x.feedback || []).filter((_, j) => j !== i) } : x));
                          writeAiCache(null);
                          setLocalAiResult(null);
                        }}
                        disabled={isDemo}
                        title={isDemo ? t('demo.blocked', 'Action désactivée en mode démo') : t('song-detail.feedback-delete-tooltip', 'Supprimer ce feedback + recalculer la reco IA sans lui')}
                        style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 'clamp(12px, 1.35vw, 14px)', cursor: isDemo ? 'not-allowed' : 'pointer', padding: '0 2px', lineHeight: 1, opacity: isDemo ? 0.5 : 1 }}
                      >✕</button>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          {/* S9.8 — Mini-form inline : zone de texte AVANT bouton Envoyer.
              Remplace l'ancien toggle [bouton "Donner feedback"] → [FeedbackPanel
              modal]. Plus rapide à utiliser, pas besoin de cliquer pour révéler
              la textarea. Le FeedbackPanel reste importable si besoin futur. */}
          <div>
            <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>{t('song-detail.give-feedback-flat', 'Donner un feedback à l\'IA')}</div>
            {/* Phase 7.85 — Layout column + bouton alignSelf:flex-end pour
                éviter le chevauchement textarea/bouton observé Cowork B03 P0
                (toutes résolutions). Plus robuste qu'un flex-row + flexWrap
                qui pouvait causer des layouts dégénérés. minHeight 44 sur le
                bouton pour cible touch iOS HIG. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <textarea
                value={quickFeedback}
                onChange={(e) => setQuickFeedback(e.target.value)}
                placeholder={t('song-detail.feedback-placeholder', 'Ex : Préfère la Tele sur ce morceau, ou Mid 6 plutôt que 7…')}
                rows={2}
                disabled={reloading || isDemo}
                title={isDemo ? t('demo.blocked', 'Action désactivée en mode démo') : undefined}
                style={{ width: '100%', fontSize: 'clamp(12px, 1.35vw, 14px)', padding: '6px 8px', background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a10)', borderRadius: 'var(--r-md)', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.4, boxSizing: 'border-box', opacity: isDemo ? 0.5 : 1, cursor: isDemo ? 'not-allowed' : 'text' }}
              />
              <button
                data-testid="song-feedback-open"
                onClick={() => {
                  if (isDemo) return;
                  const fb = quickFeedback.trim();
                  if (!fb) return;
                  setReloading(true);
                  const prev = aiC;
                  const effectiveRecoMode = song.recoMode || profile?.recoMode || 'balanced';
                  fetchAI(song, gId, banksAnn, banksPlug, aiProvider, aiKeys, guitars, fb, null, effectiveRecoMode, guitarBias, song.outputContext || profile?.outputContext || 'frfr', profile?.preferredStyles || [], (profile?.myBasses || []).map((id) => findBass(id)).filter(Boolean), (profile?.myBassAmps || []).map((id) => findBassAmp(id)).filter(Boolean), (profile?.myGuitarAmps || []).map((id) => findGuitarAmp(id)).filter(Boolean), (profile?.myPedals || []).map((id) => findPedal(id)).filter(Boolean))
                    .then((r) => {
                      const pick = mergeBestResults(prev, r);
                      setLocalAiResult(pick);
                      if (onSongDb) onSongDb((p) => p.map((x) => x.id !== song.id ? x : { ...x, feedback: [...(x.feedback || []), { text: fb, ts: Date.now() }] }));
                      writeAiCache(updateAiCache(song.aiCache, gId, pick));
                      setQuickFeedback('');
                    })
                    .catch((e) => { setLocalAiErr(e?.message || String(e)); })
                    .finally(() => setReloading(false));
                }}
                disabled={!quickFeedback.trim() || reloading || isDemo}
                title={isDemo ? t('demo.blocked', 'Action désactivée en mode démo') : undefined}
                style={{ alignSelf: 'flex-end', fontSize: 'clamp(12px, 1.35vw, 14px)', background: quickFeedback.trim() && !reloading && !isDemo ? 'var(--accent)' : 'var(--bg-disabled)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '8px 16px', cursor: quickFeedback.trim() && !reloading && !isDemo ? 'pointer' : 'not-allowed', fontWeight: 700, minHeight: 44, opacity: isDemo ? 0.5 : 1 }}
              >{t('song-detail.feedback-send', 'Envoyer')}</button>
            </div>
          </div>
        </div>
      )}
      {/* S9.10 — Bouton Fermer déplacé en fin de fiche (après Infos morceau)
          pour cohérence : tu remontes en fin de lecture, pas au milieu. */}

      {/* Phase 7.79 — Modale info/édition usages d'un preset (déclenchée
          par CurationDot ligne 308). */}
      {curationModalPreset && (
        <PresetCurationModal
          presetName={curationModalPreset}
          isAdmin={isAdmin}
          songDb={songDb}
          profile={profile}
          onProfiles={onProfiles}
          activeProfileId={activeProfileId}
          toneNetPresets={toneNetPresets}
          onToneNetPresets={onToneNetPresets}
          onSharedUsagesOverrides={onSharedUsagesOverrides}
          onClose={() => setCurationModalPreset(null)}
        />
      )}

      {/* Phase 8.3 + Phase B — Section Basse. Gated par :
          - profile.instruments inclut 'bass' (basse = instrument à part
            entière, parfois unique)
          - ET contexte de jeu = basse (playCtx.instrument === 'bass')
          - ET aiCache.bass_recommendation présent (le prompt le retourne
            TOUJOURS pour CHAQUE morceau analysé — pas seulement les lignes
            de basse "notables", retour Sébastien 2026-05-29). bassStale
            re-fetch les morceaux analysés avant Phase 8.7. */}
      {(() => {
        const hasBassInstrument = Array.isArray(profile?.instruments)
          && profile.instruments.includes('bass');
        if (!hasBassInstrument) return null;
        // Phase B — section basse affichée seulement si l'instrument actif
        // du contexte de jeu est la basse.
        if (playCtx.instrument !== 'bass') return null;
        const bassHist = getSongBassHist(song);
        const bassReco = aiC?.bass_recommendation;
        if (!bassHist && !bassReco) return null;
        // Resolve basses + ampli reco depuis id (helpers Phase 8.1)
        const userBasses = (profile?.myBasses || [])
          .map((id) => findBass(id))
          .filter(Boolean);
        const userBassAmps = (profile?.myBassAmps || [])
          .map((id) => findBassAmp(id))
          .filter(Boolean);
        // ideal_bass de l'IA : peut être un name complet (match against
        // BASSES catalog) ou juste un nom indicatif. Resolve via findBass
        // par name si possible.
        let idealBassObj = null;
        if (bassReco?.ideal_bass) {
          // Try match by name (case-insensitive substring)
          const n = String(bassReco.ideal_bass).toLowerCase();
          idealBassObj = userBasses.find(
            (b) => String(b.name).toLowerCase().includes(n)
              || n.includes(String(b.name).toLowerCase())
          ) || null;
        }
        const ampSettings = bassReco?.amp_settings;
        const hasAmpSettings = ampSettings
          && typeof ampSettings === 'object'
          && Object.keys(ampSettings).length > 0;
        const settingsBass = bassReco?.settings_bass
          ? getLocalizedText(bassReco.settings_bass, locale)
          : null;
        const bassReason = bassReco?.bass_reason
          ? getLocalizedText(bassReco.bass_reason, locale)
          : null;
        // Vague B — champs scoring/EQ/FX basse (symétrie bloc guitare).
        // ⚠ Déclarés AVANT effectiveBassId/selectedBassScore qui les consomment
        // (sinon TDZ "Cannot access before initialization" au render — invisible
        // aux tests/build, runtime-only ; cf piège Phase 7.79.3b / docs/CASCADE.md).
        const cotBasses = Array.isArray(bassReco?.cot_step2_basses) ? bassReco.cot_step2_basses : [];
        // stripSlotPrefix au render : couvre les aiCache déjà validés (flag
        // _bassFieldsValidated posé avant l'ajout du strip) qui gardent un nom
        // préfixé "40B ..." → sinon findInBanks rate + "Non installé" trompeur.
        const bassAlts = (Array.isArray(bassReco?.bass_alternatives) ? bassReco.bass_alternatives : [])
          .map((a) => ({ ...a, name: stripSlotPrefix(a.name) }));
        const bassEq = bassReco?.bass_preset_settings_v1;
        const bassFx = bassReco?.bass_fx_blocks;
        // Style pill libellé coloré par bucket (mirror compatLabelStyle guitare).
        const bassCompatStyle = (score) => {
          const b = bucketizeScore(score);
          return { background: b.color, color: 'var(--text-inverse)', padding: '2px 8px', borderRadius: 'var(--r-sm)', fontWeight: 700, display: 'inline-block' };
        };
        // Vague A bass restructure (2026-05-27) — basse idéale élue :
        // priorité au choix user (selectedBassId, persisté setlist.basses),
        // sinon basse idéale IA si elle matche le rig, sinon 1ère basse cochée.
        const effectiveBassId = selectedBassId || idealBassObj?.id || userBasses[0]?.id || '';
        const selectedBass = userBasses.find((b) => b.id === effectiveBassId)
          || idealBassObj || userBasses[0] || null;
        // L'étoile ★ marque la basse idéale IA (uniquement si c'est elle qui est sélectionnée).
        const selectedIsIdeal = idealBassObj && selectedBass && selectedBass.id === idealBassObj.id;
        // Score de la basse sélectionnée (depuis cot_step2_basses) pour pill à
        // droite, symétrique au pill score guitare. Match par nom (case-insensitive).
        // cot entry de la basse sélectionnée → score + controls. Match robuste
        // via findCotEntryForGuitar (tokenization matchGuitarName, name-generic),
        // au lieu d'un includes() fragile (sinon un léger écart de nom entre la
        // basse du rig et l'entrée cot_step2_basses ratait le match → controls
        // disparaissent au changement de basse).
        const selectedBassCot = findCotEntryForGuitar(cotBasses, selectedBass);
        const selectedBassScore = selectedBassCot && typeof selectedBassCot.score === 'number' ? selectedBassCot.score : null;
        // Phase 9.8 — réglages micros de la basse sélectionnée (maj instantanée).
        const selectedBassControls = selectedBassCot?.controls || null;
        const handleBassChange = (v) => {
          setSelectedBassId(v);
          if (onBassChange) onBassChange(song.id, v);
        };
        return (
          <>
            {/* Section "Ma basse" — analogue à "Ma guitare" (liste déroulante
                de sélection symétrique à GuitarSelect, vague B). */}
            <div style={sectionStyle}>
              {sectionTitle(<NavIcon id="bass" size={16}/>, t('song-detail.bass-block', 'Ma basse'))}
              {userBasses.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <select
                    value={effectiveBassId}
                    onChange={(e) => handleBassChange(e.target.value)}
                    style={{ flex: 1, minWidth: 0, fontSize: 'clamp(12px, 1.35vw, 14px)', background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-md)', padding: '8px 10px', fontWeight: 600 }}
                  >
                    {userBasses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.type}, {b.brand}){idealBassObj && b.id === idealBassObj.id ? ` ${t('song-detail.bass-ideal-suffix', '— idéale')}` : ''}
                      </option>
                    ))}
                  </select>
                  {/* Indicateur à droite, homogène avec la guitare : pill score si
                      la basse sélectionnée est notée (cot_step2_basses), sinon ★ si idéale. */}
                  {selectedBassScore != null ? (
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--text-inverse)', background: bucketizeScore(selectedBassScore).color, padding: '3px 9px', borderRadius: 'var(--r-sm)', textAlign: 'center', fontSize: 'clamp(11px, 1.2vw, 13px)', whiteSpace: 'nowrap', lineHeight: 1.3, flexShrink: 0, minWidth: 44 }} title={`${selectedBassScore}%`}>{selectedBassScore}%</span>
                  ) : (selectedIsIdeal && <span style={{ color: 'var(--accent)', fontSize: 'clamp(12px, 1.35vw, 14px)', flexShrink: 0 }} title={t('song-detail.bass-ideal', 'Basse idéale')}>★</span>)}
                </div>
              ) : (
                <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                  {bassReco?.ideal_bass
                    ? tFormat('song-detail.bass-ideal-out-of-rig', { name: bassReco.ideal_bass }, 'Basse idéale (hors collection) : {name}')
                    : t('song-detail.bass-no-rig', 'Aucune basse cochée — active "Je joue aussi la basse" dans Mon profil → Mes basses.')}
                </div>
              )}
              {/* Scoring basses — sous le dropdown (lié au choix), déplacé depuis
                  Recommandations basse (2026-05-28, mirror de la guitare). */}
              {cotBasses.length > 0 && (
                <div style={{ background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 10px', marginTop: 8 }}>
                  <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>{t('song-detail.bass-cot', 'Scoring basses')}</div>
                  <div className="reco-multicol">
                    {cotBasses.map((bt, i) => (
                      <div key={i}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 'clamp(12px, 1.35vw, 14px)' }}>
                          <span style={{ ...bassCompatStyle(bt.score), flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{bt.name}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--text-inverse)', background: scoreColor(bt.score), padding: '2px 7px', borderRadius: 'var(--r-sm)', flexShrink: 0, minWidth: 44, textAlign: 'center', fontSize: 'clamp(11px, 1.25vw, 13px)' }}>{bt.score}%</span>
                        </div>
                        {bt.reason && <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4 }}>{getLocalizedText(bt.reason, locale)}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Vague A bass restructure (2026-05-28) — Référence originale
                  bass historique déplacée dans 'Infos morceau' bas de page,
                  pour symétrie avec la référence guitariste qui y est déjà. */}
            </div>
            {/* Section "Recommandations basse" — analogue à "Recommandations guitare" */}
            {bassReco && (
              <div style={sectionStyle}>
                {sectionTitle(<NavIcon id="target" size={16}/>, t('song-detail.bass-reco-block', 'Recommandations basse'))}
                {bassReason && (
                  <div className="prose-readable" style={{ fontSize: 'clamp(12px, 1.35vw, 14px)', color: 'var(--text-sec)', lineHeight: 1.45, marginBottom: 8 }}>
                    {bassReason}
                  </div>
                )}
                {/* Phase 9.8 — Réglages micros de la basse SÉLECTIONNÉE
                    (selectedBassControls). Maj instantanée au changement de liste. */}
                {selectedBassControls && (
                  <div style={{ marginBottom: 8 }}>
                    <PickupControlsCadre controls={selectedBassControls} locale={locale}/>
                  </div>
                )}
                {/* Vague B — Cadres symétriques au bloc guitare. Chacun gated par
                    présence du champ (rétro-compat aiCache pré-vague-B).
                    Scoring basses déplacé sous le dropdown "Ma basse" (2026-05-28). */}
                {/* Phase B — blocs ToneX basse (Scoring preset + EQ + effets)
                    gated par rig = ToneX. */}
                {playCtx.rig === 'tonex' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                  {/* Cadre Scoring preset basse (bass_alternatives, mirror Scoring preset) */}
                  {bassAlts.length > 0 && getActiveDevicesForRender(profile).some((d) => d.deviceKey === 'ann' || d.deviceKey === 'plug') && (
                    <div style={{ background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 10px' }}>
                      <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>{t('song-detail.bass-scoring-preset', 'Scoring preset basse')}</div>
                      {(() => {
                        const top = bassAlts[0];
                        const loc = findInBanks(top.name, banksAnn) || findInBanks(top.name, banksPlug);
                        return (
                          <div style={{ marginBottom: bassAlts.length > 1 ? 6 : 0 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 'clamp(12px, 1.35vw, 14px)' }}>
                              <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ ...bassCompatStyle(top.score), wordBreak: 'break-word' }}>{top.amp || top.name}</span>
                                {top.amp && <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 'clamp(11px, 1.15vw, 12px)', wordBreak: 'break-word' }} title={top.name}>{top.name}</span>}
                              </span>
                              {top.score > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--text-inverse)', background: scoreColor(top.score), padding: '2px 7px', borderRadius: 'var(--r-sm)', flexShrink: 0, minWidth: 44, textAlign: 'center', fontSize: 'clamp(11px, 1.25vw, 13px)' }}>{top.score}%</span>}
                            </div>
                            <div style={{ fontSize: 'clamp(11px, 1.15vw, 12px)', marginTop: 2 }}>
                              {loc ? <span style={{ color: 'var(--green)' }}>{tFormat('song-detail.installed-bank', { bank: loc.bank, slot: loc.slot }, '✓ Installé — Banque {bank}{slot}')}</span>
                                : <span style={{ color: 'var(--yellow)' }}>{t('song-detail.not-installed-flat', 'Non installé')}</span>}
                            </div>
                          </div>
                        );
                      })()}
                      {bassAlts.length > 1 && (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ fontSize: 'clamp(11px, 1.15vw, 12px)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', color: 'var(--text-tertiary)', marginBottom: 4 }}>{t('song-detail.bass-alternatives', 'Alternatives catalogue')}</div>
                          <div className="reco-multicol">
                            {bassAlts.slice(1).map((alt, i) => {
                              const loc = findInBanks(alt.name, banksAnn) || findInBanks(alt.name, banksPlug);
                              return (
                                <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 'clamp(11px, 1.25vw, 13px)' }}>
                                  <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--text-sec)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{alt.amp || alt.name}</span>
                                    {alt.amp && <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 'clamp(11px, 1.15vw, 12px)' }} title={alt.name}>{alt.name}</span>}
                                    {loc && <span style={{ color: 'var(--green)', fontSize: 'clamp(11px, 1.15vw, 12px)', flexShrink: 0 }}>✓</span>}
                                  </span>
                                  {alt.score > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-inverse)', background: scoreColor(alt.score), padding: '1px 6px', borderRadius: 'var(--r-sm)', flexShrink: 0, minWidth: 40, textAlign: 'center', fontSize: 'clamp(11px, 1.15vw, 12px)' }}>{alt.score}%</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Bloc "Sur ta ToneX" retiré (2026-05-28) : redondant avec
                      "Scoring preset basse" ci-dessus qui affiche déjà la capture
                      top + bank/slot installé + score (raccord avec le bloc guitare,
                      qui n'a pas de bloc ToneX séparé). */}
                  {/* Cadre Réglages EQ basse (bass_preset_settings_v1) — why + boutons PRESET.
                      Contrairement à la guitare (table chiffrée dropée S9.5 car redondante
                      avec la vue repliée), la basse n'a PAS de vue repliée → on affiche les
                      valeurs des boutons PRESET (0-10). Gated par capture_name (bassEq null sinon).
                      v9.7.11 (audit Cowork P2-A) — wrap dans ipad-2col avec FxBlocksCadre :
                      EQ basse + Effets basse côte à côte sur iPad ≥720px. */}
                  <div className="ipad-2col">
                    {bassEq && (bassEq.why || bassEq.main) && (
                      <div style={{ background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 10px' }}>
                        <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', display: 'flex', alignItems: 'center', gap: 6 }}><NavIcon id="sliders" size={14}/>{t('song-detail.bass-eq-settings', 'Réglages EQ basse')}</div>
                        {bassEq.why && (
                          <div className="prose-readable" style={{ fontSize: 'clamp(12px, 1.35vw, 14px)', color: 'var(--text-sec)', lineHeight: 1.45, marginBottom: bassEq.main ? 6 : 0 }}>{getLocalizedText(bassEq.why, locale)}</div>
                        )}
                        {bassEq.main && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 'clamp(12px, 1.35vw, 14px)', color: 'var(--text-sec)', fontFamily: 'var(--font-mono)' }}>
                            {['gain', 'bass', 'mid', 'treble', 'volume'].map((k) => {
                              const knob = bassEq.main[k];
                              const v = knob && typeof knob === 'object' ? knob.value : knob;
                              if (v == null) return null;
                              return <span key={k}><b style={{ color: 'var(--text-muted)' }}>{k}</b> {v}</span>;
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Cadre Réglages effets basse (bass_fx_blocks) — réutilise FxBlocksCadre */}
                    <FxBlocksCadre fxBlocks={bassFx} locale={locale} title={t('song-detail.bass-fx-settings', 'Réglages effets basse')}/>
                  </div>
                </div>
                )}
                {/* Mode ampli traditionnel : amp_settings 0-10 (Phase B — rig Ampli) */}
                {playCtx.rig === 'amp' && userBassAmps.length > 0 && hasAmpSettings && (
                  <div style={{ background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 10px', marginBottom: 6 }}>
                    <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>
                      {tFormat('song-detail.bass-amp-settings', { amp: userBassAmps[0].short }, 'Sur ton {amp}')}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 'clamp(12px, 1.35vw, 14px)', color: 'var(--text-sec)', fontFamily: 'var(--font-mono)' }}>
                      {Object.entries(ampSettings).map(([k, v]) => (
                        <span key={k}><b style={{ color: 'var(--text-muted)' }}>{k.replace(/_/g, ' ')}</b>: {v}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Conseils de jeu basse (settings_bass prose) */}
                {settingsBass && (
                  <div className="prose-readable" style={{ fontSize: 'clamp(12px, 1.35vw, 14px)', color: 'var(--text-sec)', lineHeight: 1.45 }}>
                    <b style={{ color: 'var(--text-muted)' }}>{t('song-detail.bass-playing-tips', 'Jeu :')}</b>{' '}
                    {settingsBass}
                  </div>
                )}
              </div>
            )}
          </>
        );
      })()}

      {/* Phase 7.55.7 S9.2 — Bloc Infos morceau déplacé EN BAS de la
          fiche (choix Sébastien 25/05). Le contexte/référence vient
          après les actions (Mon Setup + Recos IA + Feedback). */}
      <div style={sectionStyle}>
        {sectionTitle(<NavIcon id="info" size={16}/>, t('song-detail.info-section', 'Infos morceau'))}
        {(songInfo.year || songInfo.album || songInfo.key || songInfo.bpm) && <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', color: 'var(--text-muted)', marginBottom: 4 }}>{songInfo.year}{songInfo.album ? ' · ' + songInfo.album : ''}{songInfo.key ? ' · ' + songInfo.key : ''}{songInfo.bpm ? ' · ' + songInfo.bpm + ' BPM' : ''}</div>}
        {songInfo.desc && <div className="prose-readable" style={{ fontSize: 'clamp(12px, 1.35vw, 14px)', color: 'var(--text-sec)', lineHeight: 1.5, marginBottom: 6 }}>{getLocalizedText(songInfo.desc, locale)}</div>}
        {/* Référence guitare (depuis aiC ou fallback hist seed). Phase B —
            affichée seulement en contexte instrument = guitare. */}
        {playCtx.instrument === 'guitar' && aiC && (aiC.ref_guitarist || aiC.ref_guitar || aiC.ref_amp) && (
          <div style={{ fontSize: 'clamp(12px, 1.35vw, 14px)', color: 'var(--text-sec)', lineHeight: 1.6 }}>
            <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 'clamp(11px, 1.25vw, 13px)' }}>{aiC.ref_guitarist || t('song-detail.ref-default', 'Référence')}</span><br/>
            {aiC.ref_guitar && <>{aiC.ref_guitar} · </>}
            {aiC.ref_amp && <>{aiC.ref_amp}</>}
            {aiC.ref_effects && aiC.ref_effects !== 'Aucun effet' && <> · {aiC.ref_effects}</>}
          </div>
        )}
        {playCtx.instrument === 'guitar' && hist && !aiC && (
          <div style={{ fontSize: 'clamp(12px, 1.35vw, 14px)', color: 'var(--text-sec)', lineHeight: 1.6 }}>
            <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 'clamp(11px, 1.25vw, 13px)' }}>{hist.guitarist}</span><br/>
            {hist.guitar} · {hist.amp}{(() => { const fx = getLocalizedText(hist.effects, locale); return fx ? ' · ' + fx : ''; })()}
          </div>
        )}
        {/* Vague A bass restructure (2026-05-28) — Référence basse symétrique
            (bassiste + basse + ampli + effets), depuis aiC.bass_recommendation
            (ref_bassist/ref_bass_guitar/ref_bass_amp) ou fallback bassHist seed
            (SONG_HISTORY[songId].bass). Affichée seulement si user bass-actif
            (profile.instruments inclut 'bass') ET ≥1 source d'info. */}
        {(() => {
          // Phase B — référence basse affichée seulement en contexte
          // instrument = basse (getEffectivePlayContext garantit que 'bass'
          // implique un profil bass-actif).
          if (playCtx.instrument !== 'bass') return null;
          const bassReco = aiC?.bass_recommendation;
          const bassHistSeed = getSongBassHist(song);
          const refBassist = bassReco?.ref_bassist || bassHistSeed?.bassist;
          const refBassGuitar = bassReco?.ref_bass_guitar || bassHistSeed?.bass_guitar;
          const refBassAmp = bassReco?.ref_bass_amp || bassHistSeed?.bass_amp;
          // Vague B — ref_bass_effects top-level (IA) prioritaire, fallback seed.
          const refBassFx = bassReco?.ref_bass_effects
            || (bassHistSeed?.effects ? getLocalizedText(bassHistSeed.effects, locale) : null);
          if (!refBassist && !refBassGuitar && !refBassAmp) return null;
          return (
            <div style={{ fontSize: 'clamp(12px, 1.35vw, 14px)', color: 'var(--text-sec)', lineHeight: 1.6, marginTop: 6 }}>
              <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 'clamp(11px, 1.25vw, 13px)' }}>{refBassist || t('song-detail.ref-bass-default', 'Bassiste')}</span><br/>
              {refBassGuitar && <>{refBassGuitar}{(refBassAmp || refBassFx) ? ' · ' : ''}</>}
              {refBassAmp && <>{refBassAmp}</>}
              {refBassFx && refBassFx !== 'Aucun effet' && !/no effect|ningún efecto/i.test(refBassFx) && <> · {refBassFx}</>}
            </div>
          );
        })()}
        {aiC?.cot_step1 && (
          <div style={{ marginTop: 8, background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 10px' }}>
            <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>{t('song-detail.cot-tonal', 'Profil tonal')}</div>
            <div className="prose-readable" style={{ fontSize: 'clamp(12px, 1.35vw, 14px)', color: 'var(--text-sec)', lineHeight: 1.4 }}>{getLocalizedText(aiC.cot_step1, locale)}</div>
          </div>
        )}
        {aiC?.cot_step3_amp && (
          <div style={{ marginTop: 8, background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 10px' }}>
            <div style={{ fontSize: 'clamp(11px, 1.25vw, 13px)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>{t('song-detail.cot-amp', 'Profil ampli')}</div>
            <div className="prose-readable" style={{ fontSize: 'clamp(12px, 1.35vw, 14px)', color: 'var(--text-sec)', lineHeight: 1.4 }}>{getLocalizedText(aiC.cot_step3_amp, locale)}</div>
          </div>
        )}
      </div>
      {/* S9.10 — Bouton Fermer en fin de fiche après Infos morceau.
          Phase 7.85 — padding vertical 8px + minHeight 44 pour cible
          touch iOS HIG (rapport Cowork B07 : 1212×16px = bande fine
          cliquable mais inconfortable). maxWidth auto-fit pour éviter
          que le clic prenne toute la largeur (pas critique mais propre). */}
      <button onClick={onClose} style={{ fontSize: 'clamp(12px, 1.35vw, 14px)', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: '8px 16px', marginTop: 8, minHeight: 44, alignSelf: 'center' }}>{t('song-detail.close', 'Fermer ↑')}</button>
    </div>
  );
}

export default SongDetailCard;
export { SongDetailCard };

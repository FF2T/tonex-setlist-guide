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
import { getIg, getSongHist } from '../utils/song-helpers.js';
import {
  enrichAIResult, mergeBestResults, updateAiCache, computeRigSnapshot,
  getBestResult, getLocalizedText,
} from '../utils/ai-helpers.js';
import { findInBanks } from '../utils/preset-helpers.js';
import { resolveDisplayGuitar, filterCotGuitarsToRig, localizePickup, decapitalizeFirst } from '../utils/display-guitar.js';
import { getActiveDevicesForRender } from '../utils/devices-render.js';
import { fetchAI } from '../utils/fetchAI.js';
import { scoreColor } from '../components/score-utils.js';
import StatusDot from '../components/StatusDot.jsx';
import GuitarSelect from '../components/GuitarSelect.jsx';
import PBlock from '../components/PBlock.jsx';
import FeedbackPanel from '../components/FeedbackPanel.jsx';

function SongDetailCard({ song, banksAnn, banksPlug, onBanksAnn, onBanksPlug, onClose, guitars, allRigsGuitars, availableSources, savedGuitarId, onGuitarChange, aiProvider, aiKeys, onSongDb, onAiCacheUpdate, profile, guitarBias, onTmpPatchOverride, songDb, onProfiles, activeProfileId, toneNetPresets, onToneNetPresets, onSharedUsagesOverrides }) {
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
  const [reloading, setReloading] = useState(false);
  const [localAiResult, setLocalAiResult] = useState(null);
  const [localAiErr, setLocalAiErr] = useState(null);
  // Phase 7.79 — modale info/édition usages d'un preset.
  const [curationModalPreset, setCurationModalPreset] = useState(null);
  const isAdmin = !!profile?.isAdmin;
  const [showFeedback, setShowFeedback] = useState(false);
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
  // Phase 7.51.2 — mode démo : jamais d'appel fetchAI (cache uniquement).
  const isDemo = profile?.isDemo === true;

  useEffect(() => {
    if (isDemo) return; // Phase 7.51.2 — pas de fetchAI en mode démo.
    if (localAiResult && !needsRescore && !rigStale) return;
    if (song.aiCache?.result?.cot_step1 && gId && !rigStale) {
      const gType = (guitars || GUITARS).find((x) => x.id === gId)?.type || 'HB';
      const cleaned2 = { ...song.aiCache.result, preset_ann: null, preset_plug: null, ideal_preset: null, ideal_preset_score: 0, ideal_top3: null };
      const recalc = enrichAIResult(cleaned2, gType, gId, banksAnn, banksPlug, undefined, song);
      setLocalAiResult(recalc);
      setLocalAiErr(null);
      // Phase 7.54 — Écrit dans profile.aiCache
      setTimeout(() => writeAiCache({ ...updateAiCache(song.aiCache, gId, recalc), sv: SCORING_VERSION }), 0);
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
    fetchAI(song, gId, banksAnn, banksPlug, aiProvider, aiKeys, guitars, historicalFeedback, null, effectiveRecoMode, guitarBias, song.outputContext || profile?.outputContext || 'frfr', profile?.preferredStyles || [])
      .then((r) => {
        setLocalAiResult(r);
        setLocalAiErr(null);
        // Phase 7.81 — rigSnapshot stocké = rig profil actif (pas union all-rigs).
        const rigSnapshot = computeRigSnapshot(guitars);
        // Phase 7.54 — Écrit dans profile.aiCache
        writeAiCache({ ...updateAiCache(song.aiCache, gId, r, { rigSnapshot }), sv: SCORING_VERSION });
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
  }, [song.id, gId, needsRescore, rigStale, isDemo]);

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
  const sectionStyle = { background: 'var(--a3)', border: '1px solid var(--a7)', borderRadius: 'var(--r-lg)', padding: '10px 12px', marginBottom: 8 };
  const customSectionStyle = { background: 'var(--a5)', border: '1px solid var(--a10)', borderRadius: 'var(--r-lg)', padding: '10px 12px', marginBottom: 8 };
  const sectionTitle = (icon, label) => <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>{icon} {label}</div>;

  return (
    <div className="song-row-detail" style={{ background: 'var(--bg-elev-1)', borderRadius: '0 0 12px 12px', padding: '10px 12px', marginBottom: 8, marginTop: -2, display: 'flex', flexDirection: 'column', gap: 6 }}>

      {/* Phase 7.86 — Bandeau sticky en tête : guitare choisie + sortie
          audio + feedback. Reste visible en haut quand on scroll dans la
          fiche dépliée. Influence les 3 blocs ci-dessous (recos IA + mon
          setup adaptatifs). */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-elev-1)', borderRadius: 'var(--r-md)', border: '1px solid var(--a8)', padding: '8px 10px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 180 }}>
          <StatusDot score={chosenGuitarScore} ideal={g && ig.includes(gId)} size={10}/>
          <div style={{ flex: 1 }}><GuitarSelect value={gId} onChange={handleGuitarChange} ig={ig} guitars={guitars}/></div>
        </div>
        {/* Sortie audio override per-morceau — Phase 10. Hint compact, 4 boutons. */}
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }} title={t('song-detail.output-context-label', '🔌 Sortie audio pour ce morceau')}>
          {[
            { id: '', icon: '↻', label: t('song-detail.output-context-profile', 'Profil') },
            { id: 'frfr', icon: '📢', label: t('output-context.label.frfr', 'Enceinte FRFR') },
            { id: 'headphone', icon: '🎧', label: t('output-context.label.headphone', 'Casque') },
            { id: 'pa', icon: '🎚️', label: t('output-context.label.pa', 'Sono / Table de mixage') },
          ].map(({ id, icon, label }) => {
            const active = (song.outputContext || '') === id;
            return (
              <button key={id || 'profile'}
                data-testid={`song-output-context-${id || 'profile'}`}
                onClick={() => {
                  onSongDb((p) => p.map((x) => x.id === song.id ? { ...x, outputContext: id || undefined } : x));
                  writeAiCache(null);
                  setLocalAiResult(null);
                }}
                title={id ? tFormat('song-detail.output-context-tooltip-override', { label }, 'Override : {label}') : t('song-detail.output-context-tooltip-profile', 'Hérite du contexte profil.')}
                style={{ fontSize: 11, lineHeight: 1, padding: '4px 6px', background: active ? 'var(--accent-bg)' : 'var(--a3)', border: active ? '1px solid var(--accent-border)' : '1px solid var(--a8)', color: active ? 'var(--accent)' : 'var(--text-muted)', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontWeight: active ? 700 : 500 }}
              >{icon}</button>
            );
          })}
        </div>
        {/* Feedback bouton — scrolle vers la section feedback IA en bas */}
        {aiC && (
          <button
            onClick={() => setShowFeedback((p) => !p)}
            data-testid="sticky-feedback-toggle"
            title={t('song-detail.sticky-feedback-tooltip', 'Donner un feedback à l\'IA sur ce morceau')}
            style={{ fontSize: 11, padding: '5px 8px', background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-sm)', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}
          >💬</button>
        )}
      </div>

      {/* Phase 7.86 — Bloc 1 : 📚 Infos morceau (factuel + profil tonal IA + profil ampli IA) */}
      <div style={sectionStyle}>
        {sectionTitle('📚', t('song-detail.info-section', 'Infos morceau'))}
        {(songInfo.year || songInfo.album || songInfo.key || songInfo.bpm) && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{songInfo.year}{songInfo.album ? ' · ' + songInfo.album : ''}{songInfo.key ? ' · ' + songInfo.key : ''}{songInfo.bpm ? ' · ' + songInfo.bpm + ' BPM' : ''}</div>}
        {/* Phase 7.57 — Éditeur BPM/tonalité retiré.
            L'IA Gemini retourne désormais `song_bpm` et `song_key` fiables
            dans aiCache.result. Les valeurs sont affichées en read-only
            ligne ci-dessus (songInfo.year/album/key/bpm via getSongInfo).
            Les champs `song.bpm` et `song.key` restent dans le data model
            (rétro-compat avec setlists existantes + LiveScreen Phase 4).
            Si besoin d'éditer manuellement à l'avenir, réafficher ce bloc.
        */}
        {songInfo.desc && <div style={{ fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.5, marginBottom: 6 }}>{getLocalizedText(songInfo.desc, locale)}</div>}
        {aiC && (aiC.ref_guitarist || aiC.ref_guitar || aiC.ref_amp) && (
          <div style={{ fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.6 }}>
            <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 10 }}>{aiC.ref_guitarist || t('song-detail.ref-default', 'Référence')}</span><br/>
            {aiC.ref_guitar && <>🎸 {aiC.ref_guitar} · </>}
            {aiC.ref_amp && <>🔊 {aiC.ref_amp}</>}
            {aiC.ref_effects && aiC.ref_effects !== 'Aucun effet' && <> · 🎚 {aiC.ref_effects}</>}
          </div>
        )}
        {hist && !aiC && (
          <div style={{ fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.6 }}>
            <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 10 }}>{hist.guitarist}</span><br/>
            🎸 {hist.guitar} · 🔊 {hist.amp}{(() => { const fx = getLocalizedText(hist.effects, locale); return fx ? ' · 🎚 ' + fx : ''; })()}
          </div>
        )}
        {/* Phase 7.86 — Bloc 1 — profil tonal + profil ampli IA déplacés
            ici (auparavant dans SECTION 2 "Raisonnement IA" pliable). */}
        {aiC?.cot_step1 && (
          <div style={{ marginTop: 8, background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 10px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>{t('song-detail.cot-tonal', 'Profil tonal')}</div>
            <div style={{ fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.4 }}>{getLocalizedText(aiC.cot_step1, locale)}</div>
          </div>
        )}
        {aiC?.cot_step3_amp && (
          <div style={{ marginTop: 8, background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 10px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>{t('song-detail.cot-amp', 'Profil ampli')}</div>
            <div style={{ fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.4 }}>{getLocalizedText(aiC.cot_step3_amp, locale)}</div>
          </div>
        )}
      </div>

      {/* Loading */}
      {reloading && (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 28, marginBottom: 6, animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>&#9203;</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {rigStale
              ? t('song-detail.rig-stale-analyzing', 'Analyse précédente faite avec un autre rig — recalcul pour ton matériel…')
              : tFormat('song-detail.analyzing', { guitar: g?.short || t('song-detail.this-guitar', 'cette guitare') }, 'Analyse en cours pour {guitar}...')}
          </div>
        </div>
      )}

      {!reloading && aiC && (() => {
        // Phase 7.65.1 — Filtre strict cot_step2_guitars sur le rig actif
        // (Phase 3.6 union all-rigs au prompt peut amener des guitares
        // d'autres profils, ex. Bruno voyait Strat AM Vintage II 61 hors rig).
        const cotInRig = filterCotGuitarsToRig(aiC.cot_step2_guitars, guitars);
        return (
        <>
          {/* Phase 7.86 — Bloc 2 : 🎯 Recommandations IA. Fusion ancienne SECTION 2
              (Raisonnement IA pliable) + SECTION 3 (Recommandation idéale).
              Scoring guitares en tête (déplacé de SECTION 2), puis guitare/preset
              idéal, alternatives catalogue, settings_preset prose, et toggle
              Mode reco avancé en bas (replié — Phase 7.3 boutons). */}
          <div style={sectionStyle}>
            {sectionTitle('🎯', t('song-detail.reco-block', 'Recommandations IA'))}
            {/* Scoring guitares — déplacé de SECTION 2 vers tête de Bloc 2 */}
            {cotInRig.length > 0 && (
              <div style={{ background: 'var(--a3)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 10px', marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>{t('song-detail.cot-guitars', 'Scoring guitares')}</div>
                {cotInRig.map((gt, i) => (
                  <div key={i} style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: i < cotInRig.length - 1 ? 4 : 0, display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-bright)', flexShrink: 0 }}>{gt.name}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: scoreColor(gt.score), flexShrink: 0 }}>{gt.score}%</span>
                    <span style={{ color: 'var(--text-dim)' }}>{getLocalizedText(gt.reason, locale)}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {displayIdealGuitarName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  <StatusDot score={idealGuitarScore} ideal={true}/>
                  <div style={{ flex: 1 }}>{t('song-detail.guitar-label', 'Guitare ')}<span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{displayIdealGuitarName}</span></div>
                  {idealGuitarScore && <b style={{ color: scoreColor(idealGuitarScore), flexShrink: 0 }}>{idealGuitarScore}%</b>}
                </div>
              )}
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
                return <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: -2, marginBottom: 2 }}>{getLocalizedText(aiC.guitar_reason, locale)}</div>;
              })()}
              {displayTopPreset && getActiveDevicesForRender(profile).some((d) => d.deviceKey === 'ann' || d.deviceKey === 'plug') && (() => {
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
                  const deviceLabel = dev ? `${dev.icon} ${dev.label}` : (device === 'ann' ? '📦 Pedale' : '🔌 Plug');
                  return (
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-sec)', marginBottom: 4, fontWeight: 600 }}>{deviceLabel}</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('song-detail.bank', 'Banque')}</span>
                        <input type="number" inputMode="numeric" min={device === 'ann' ? 0 : 1} max={maxBanks} value={bk} onChange={(e) => setInstallBank((p) => ({ ...p, [device]: e.target.value }))} style={{ width: 50, fontSize: 11, background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-md)', padding: '4px 6px', textAlign: 'center' }} placeholder={device === 'ann' ? '0-49' : '1-10'}/>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('song-detail.slot', 'Slot')}</span>
                        <select value={sl} onChange={(e) => setInstallSlot((p) => ({ ...p, [device]: e.target.value }))} style={{ fontSize: 11, background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-md)', padding: '4px 6px' }}>
                          <option value="A">{t('song-detail.slot-a', 'A (Clean)')}</option><option value="B">{t('song-detail.slot-b', 'B (Drive)')}</option><option value="C">{t('song-detail.slot-c', 'C (Lead)')}</option>
                        </select>
                        <button onClick={() => doInstall(device)} disabled={bk === ''} style={{ fontSize: 10, background: bk !== '' ? 'var(--accent)' : 'var(--bg-disabled)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '4px 10px', cursor: bk !== '' ? 'pointer' : 'not-allowed', fontWeight: 700 }}>{t('song-detail.ok', 'OK')}</button>
                      </div>
                      {bk !== '' && currentPreset && <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>{tFormat('song-detail.replaces', { preset: currentPreset }, 'Remplace : {preset}')}</div>}
                    </div>
                  );
                };
                return (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                      <StatusDot score={idealScore} ideal={true}/>
                      <div style={{ flex: 1 }}>{t('song-detail.preset-label', 'Preset')} <span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{displayPresetName}</span>
                        {/* Phase 7.70.1 + 7.79 — Pastille curation cliquable */}
                        <span style={{ marginLeft: 6 }}>
                          <CurationDot name={displayPresetName} onClick={(n) => setCurationModalPreset(n)}/>
                        </span>
                      </div>
                      {idealScore > 0 && <b style={{ color: scoreColor(idealScore), flexShrink: 0 }}>{idealScore}%</b>}
                    </div>
                    <div style={{ fontSize: 9, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {loc ? <span style={{ color: 'var(--green)' }}>{tFormat('song-detail.installed-bank', { bank: loc.bank, slot: loc.slot }, '✓ Installé — Banque {bank}{slot}')}</span>
                        : <span style={{ color: 'var(--yellow)' }}>{t('song-detail.not-installed', '⬇ Non installé')}</span>}
                      {(() => { const si = getSourceInfo(entry); return si ? <span style={{ color: loc ? 'var(--text-tertiary)' : 'var(--text-sec)' }}>· {si.icon} {si.label}</span> : null; })()}
                      {!loc && !installTarget && (canInstallAnn || canInstallPlug) && <button onClick={() => setInstallTarget({ preset: displayPresetName })} style={{ fontSize: 9, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', color: 'var(--accent)', borderRadius: 'var(--r-sm)', padding: '2px 8px', cursor: 'pointer', fontWeight: 600, marginLeft: 'auto' }}>{t('song-detail.install', 'Installer')}</button>}
                    </div>
                    {installTarget?.preset === displayPresetName && (() => {
                      const activeEnabled = getActiveDevicesForRender(profile);
                      const canPedal = canInstallAnn && activeEnabled.some((d) => d.deviceKey === 'ann');
                      const canPlug = canInstallPlug && activeEnabled.some((d) => d.deviceKey === 'plug');
                      if (!canPedal && !canPlug) return null;
                      return (
                        <div style={{ marginTop: 6, background: 'var(--a4)', border: '1px solid var(--a10)', borderRadius: 'var(--r-md)', padding: 10 }}>
                          <div style={{ fontSize: 10, color: 'var(--text-sec)', marginBottom: 8, fontWeight: 600 }}>{tFormat('song-detail.install-target', { preset: displayPresetName }, 'Installer "{preset}" sur :')}</div>
                          {canPedal && bankInput('ann', 49)}
                          {canPlug && bankInput('plug', 10)}
                          <button onClick={() => setInstallTarget(null)} style={{ fontSize: 9, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>{t('song-detail.cancel', 'Annuler')}</button>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
              {getActiveDevicesForRender(profile).some((d) => d.deviceKey === 'ann' || d.deviceKey === 'plug') && (() => {
                const filteredTop3 = (aiC.ideal_top3 || []).filter((p) => {
                  const e = findCatalogEntry(p.name);
                  return !availableSources || !e?.src || availableSources[e.src] !== false;
                });
                if (filteredTop3.length <= 1) return null;
                return (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', color: 'var(--text-tertiary)', marginBottom: 4 }}>{t('song-detail.alternatives', 'Alternatives catalogue')}</div>
                    {filteredTop3.slice(1).map((p, i) => {
                      const loc = findInBanks(p.name, banksAnn) || findInBanks(p.name, banksPlug);
                      const entry = findCatalogEntry(p.name);
                      const si = getSourceInfo(entry);
                      return (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                            <StatusDot score={p.score} size={6}/>
                            <span style={{ flex: 1, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name} <span style={{ color: 'var(--text-tertiary)' }}>({entry?.amp || p.amp})</span></span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: scoreColor(p.score), flexShrink: 0 }}>{p.score}%</span>
                          </div>
                          <div style={{ fontSize: 9, marginLeft: 14, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                            {loc ? <span style={{ color: 'var(--green)' }}>{tFormat('song-detail.installed-bank', { bank: loc.bank, slot: loc.slot }, '✓ Installé — Banque {bank}{slot}')}</span>
                              : <span style={{ color: 'var(--yellow)' }}>{t('song-detail.not-installed', '⬇ Non installé')}</span>}
                            {si && <span style={{ color: loc ? 'var(--text-tertiary)' : 'var(--text-sec)' }}>· {si.icon} {si.label}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              {/* Phase 9.1 + 7.86 — Sous-section "Réglages pédale" : table
                  des 5 main + 5 alt knobs. Nouveau format Phase 7.86 :
                  chaque knob = { value, why } trilingue. Le why per-knob
                  est replié par défaut (toggle "▸ Pourquoi ces valeurs ?")
                  pour préserver la densité ; le why global reste visible.
                  Rétro-compat aiCache Phase 9.1-10 : knob=number toléré
                  côté clampPresetSettings, coerce vers {value}. */}
              {aiC.preset_settings_v1 && (() => {
                const ps = aiC.preset_settings_v1;
                const main = ps.main || {};
                const alt = ps.alt || {};
                // Phase 7.86 — accès tolérant ancien/nouveau format
                const getVal = (knob) => {
                  if (knob === null || knob === undefined) return null;
                  if (typeof knob === 'number') return knob;
                  if (typeof knob === 'object' && typeof knob.value === 'number') return knob.value;
                  return null;
                };
                const getWhy = (knob) => {
                  if (knob && typeof knob === 'object' && knob.why && typeof knob.why === 'object') return knob.why;
                  return null;
                };
                const fmtNum = (v, decimals = 1) => typeof v === 'number' ? v.toFixed(decimals).replace(/\.0$/, '') : '—';
                const fmtUnit = (v, unit) => typeof v === 'number' ? `${v.toFixed(unit === '%' ? 0 : 1).replace(/\.0$/, '')}${unit}` : '—';
                const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 10, padding: '2px 0' };
                const labelStyle = { color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' };
                const valueStyle = { color: 'var(--text-bright)', fontFamily: 'var(--font-mono)', fontWeight: 700 };
                const whyRowStyle = { fontSize: 9, color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.4, marginLeft: 8, marginBottom: 4 };
                const renderKnobRow = ([key, label, suffix, unit], group) => {
                  const knob = group[key];
                  const val = getVal(knob);
                  if (val === null) return null;
                  const why = getWhy(knob);
                  const whyTxt = why ? getLocalizedText(why, locale) : null;
                  return (
                    <React.Fragment key={key}>
                      <div style={rowStyle}>
                        <span style={labelStyle}>{label}</span>
                        <span style={valueStyle}>{unit ? fmtUnit(val, unit) : `${fmtNum(val)}${suffix}`}</span>
                      </div>
                      {showWhyPerKnob && whyTxt && <div style={whyRowStyle}>↳ {whyTxt}</div>}
                    </React.Fragment>
                  );
                };
                // Phase 7.86 — détecter si au moins un why per-knob existe pour
                // afficher le toggle "▸ Pourquoi ces valeurs ?". Sinon (aiCache
                // pré-7.86), pas de toggle (rien à révéler).
                const hasAnyWhyPerKnob = [...Object.values(main), ...Object.values(alt)].some((k) => getWhy(k));
                return (
                  <div style={{ marginTop: 6, background: 'var(--a4)', border: '1px solid var(--a10)', borderRadius: 'var(--r-md)', padding: '8px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)' }}>{t('preset-settings.title', '🎛️ Réglages pédale')} <span style={{ fontWeight: 400, fontSize: 9, color: 'var(--text-dim)' }}>{t('preset-settings.subtitle', '(suggérés par l\'IA)')}</span></div>
                      {typeof ps.cab_enabled === 'boolean' && (
                        <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 'var(--r-sm)', background: ps.cab_enabled ? 'var(--green-bg)' : 'var(--yellow-bg)', color: ps.cab_enabled ? 'var(--green)' : 'var(--yellow)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                          {ps.cab_enabled ? t('preset-settings.cab-on', 'CAB ON') : t('preset-settings.cab-off', 'CAB OFF')}
                        </span>
                      )}
                    </div>
                    {/* Phase 9.7.1 — note "point de départ" : la capture
                        TONEX contient déjà figés les réglages physiques
                        de l'ampli original. Les valeurs ci-dessous sont
                        des post-capture additifs, à affiner à l'oreille
                        via les tweaks. */}
                    <div style={{ fontSize: 9, color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.4, marginBottom: 5 }}>
                      {t('preset-settings.starting-point', 'Point de départ — la capture intègre déjà les réglages physiques de l\'ampli original. Affine à l\'oreille avec les ajustements ci-dessous.')}
                    </div>
                    {Object.keys(main).length > 0 && (
                      <>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)', fontStyle: 'italic', marginTop: 4, marginBottom: 2 }}>{t('preset-settings.section-main', 'Boutons principaux')}</div>
                        {[
                          ['gain', 'Gain', '/10', ''],
                          ['bass', 'Bass', '/10', ''],
                          ['mid', 'Mid', '/10', ''],
                          ['treble', 'Treble', '/10', ''],
                          ['volume', 'Volume', '/10', ''],
                        ].map((spec) => renderKnobRow(spec, main))}
                      </>
                    )}
                    {Object.keys(alt).length > 0 && (() => {
                      // Phase 9.7 — si fx_blocks présent, on filtre les ALT
                      // knobs pour ne garder que presence/depth (EQ avancé) :
                      // gate_threshold, comp_threshold et reverb_mix sont
                      // déplacés dans la section Effets sous leur bloc
                      // respectif. Sinon (aiCache pré-9.7), comportement
                      // Phase 9.1 inchangé (5 ALT en bloc).
                      const hasFxBlocks = !!aiC.fx_blocks;
                      const altSpecs = hasFxBlocks
                        ? [
                            ['presence', 'Presence', '/10', ''],
                            ['depth', 'Depth', '/10', ''],
                          ]
                        : [
                            ['presence', 'Presence', '/10', ''],
                            ['depth', 'Depth', '/10', ''],
                            ['reverb_mix', 'Reverb mix', '', '%'],
                            ['comp_threshold', 'Comp threshold', '', 'dB'],
                            ['gate_threshold', 'Gate threshold', '', 'dB'],
                          ];
                      const sectionLabel = hasFxBlocks
                        ? t('preset-settings.section-eq-advanced', 'EQ avancé')
                        : t('preset-settings.section-alt', 'Boutons ALT (mode avancé)');
                      return (
                        <>
                          <div style={{ fontSize: 9, color: 'var(--text-dim)', fontStyle: 'italic', marginTop: 5, marginBottom: 2 }}>{sectionLabel}</div>
                          {altSpecs.map((spec) => renderKnobRow(spec, alt))}
                        </>
                      );
                    })()}
                    {ps.why && (() => {
                      const whyTxt = getLocalizedText(ps.why, locale);
                      return whyTxt ? <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-sec)', fontStyle: 'italic', lineHeight: 1.4 }}>{whyTxt}</div> : null;
                    })()}
                    {hasAnyWhyPerKnob && (
                      <button
                        onClick={() => setShowWhyPerKnob((p) => !p)}
                        data-testid="preset-settings-why-toggle"
                        style={{ marginTop: 6, fontSize: 10, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontWeight: 600, textAlign: 'left', width: '100%' }}
                      >
                        {showWhyPerKnob
                          ? t('preset-settings.why-per-knob-hide', '▲ Masquer les explications par paramètre')
                          : t('preset-settings.why-per-knob-show', '▸ Pourquoi ces valeurs ?')}
                      </button>
                    )}
                    {/* Phase 9.4 — Section "🔧 Si ça ne sonne pas tout à fait
                        juste..." repliée par défaut. Liste compacte des
                        tweaks empiriques post-écoute spécifiques au morceau
                        (6-8 entrées générées par l'IA selon style/gain/
                        contexte). Skip si tweaks absent ou vide. */}
                    {Array.isArray(ps.tweaks) && ps.tweaks.length > 0 && (
                      <>
                        <button
                          onClick={() => setShowTweaks((p) => !p)}
                          data-testid="preset-settings-tweaks-toggle"
                          style={{ marginTop: 6, fontSize: 10, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontWeight: 600, textAlign: 'left', width: '100%' }}
                        >
                          {showTweaks
                            ? tFormat('tweaks.toggle-hide', { count: ps.tweaks.length }, '▲ Masquer les ajustements ({count})')
                            : tFormat('tweaks.toggle-show', { count: ps.tweaks.length }, '🔧 Si ça ne sonne pas tout à fait juste... ({count})')}
                        </button>
                        {showTweaks && (
                          <div data-testid="preset-settings-tweaks-list" style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {ps.tweaks.map((tweak, idx) => {
                              const symptomTxt = getLocalizedText(tweak.symptom, locale);
                              if (!symptomTxt || !tweak.fix) return null;
                              // Phase 9.5.2 — decapitalize 1ère lettre du
                              // symptom : Gemini capitalize chaque symptom
                              // ("Trop de distorsion") → juxtaposé avec
                              // "Si " ça donne "Si Trop" (FR incorrect).
                              // Acronymes (FRFR, EQ) préservés.
                              const symptomDisplayed = decapitalizeFirst(symptomTxt);
                              // Phase 9.6.2 — Gemini copie parfois le nom
                              // de variable JSON avec underscore dans le
                              // fix ("Reverb_mix +5" au lieu de "Reverb
                              // mix +5"). On remplace les "_" par des
                              // espaces dans le format human-friendly.
                              const fixDisplayed = String(tweak.fix).replace(/_/g, ' ');
                              return (
                                <div key={idx} style={{ fontSize: 10, lineHeight: 1.4, padding: '3px 6px', background: 'var(--a2)', borderRadius: 'var(--r-sm)' }}>
                                  <span style={{ color: 'var(--text-muted)' }}>{t('tweaks.if', 'Si')} </span>
                                  <span style={{ color: 'var(--text-sec)', fontStyle: 'italic' }}>{symptomDisplayed}</span>
                                  <span style={{ color: 'var(--text-muted)' }}> → </span>
                                  <span style={{ color: 'var(--text-bright)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fixDisplayed}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                    {/* Phase 9.2 — Section "🎚 FX Blocks" sous les tweaks.
                        5 lignes compactes ON/OFF + type pour les blocs
                        effets du preset TONEX (noise_gate, compressor,
                        modulation, delay, reverb). Toggle "Pourquoi ces
                        FX ?" pour révéler les why per-block. Skip si
                        fx_blocks absent (aiCache pré-9.2). */}
                    {aiC.fx_blocks && (() => {
                      const fx = aiC.fx_blocks;
                      const blocks = [
                        ['noise_gate', t('fx-blocks.noise-gate', 'Noise Gate')],
                        ['compressor', t('fx-blocks.compressor', 'Compressor')],
                        ['modulation', t('fx-blocks.modulation', 'Modulation')],
                        ['delay', t('fx-blocks.delay', 'Delay')],
                        ['reverb', t('fx-blocks.reverb', 'Reverb')],
                      ];
                      const present = blocks.filter(([key]) => fx[key]);
                      if (present.length === 0) return null;
                      const hasAnyWhy = present.some(([key]) => fx[key].why);
                      // Phase 9.7 — récupère les valeurs depuis alt
                      // (threshold gate/comp, mix reverb) pour les
                      // afficher SOUS leur bloc respectif quand enabled.
                      // Format d'un knob alt {value, why?} → on prend
                      // juste .value, le why per-knob reste accessible
                      // via le toggle "Pourquoi ces valeurs ?" Phase 7.86.
                      const altVal = (k) => {
                        const knob = alt[k];
                        if (knob === null || knob === undefined) return null;
                        if (typeof knob === 'number') return knob;
                        if (typeof knob === 'object' && typeof knob.value === 'number') return knob.value;
                        return null;
                      };
                      const fmt = (n, decimals = 1) => typeof n === 'number' ? n.toFixed(decimals).replace(/\.0$/, '') : null;
                      // Phase 9.7 — Construit la liste de sub-params à
                      // afficher pour un bloc donné. Combine threshold
                      // depuis alt (Phase 9.1) et sub-params depuis
                      // fx_blocks (Phase 9.7). Format: { label, value }.
                      const subParamsFor = (key, block) => {
                        if (!block.enabled) return [];
                        const out = [];
                        if (key === 'noise_gate') {
                          const thr = altVal('gate_threshold');
                          if (thr !== null) out.push({ label: t('fx-params.threshold', 'Threshold'), value: `${fmt(thr, 0)}dB` });
                          if (typeof block.release === 'number') out.push({ label: t('fx-params.release', 'Release'), value: `${fmt(block.release, 0)}ms` });
                          if (typeof block.depth === 'number') out.push({ label: t('fx-params.depth', 'Depth'), value: `${fmt(block.depth, 0)}dB` });
                        } else if (key === 'compressor') {
                          const thr = altVal('comp_threshold');
                          if (thr !== null) out.push({ label: t('fx-params.threshold', 'Threshold'), value: `${fmt(thr, 0)}dB` });
                          if (typeof block.gain === 'number') out.push({ label: t('fx-params.gain', 'Gain'), value: `${fmt(block.gain, 1)}dB` });
                          if (typeof block.attack === 'number') out.push({ label: t('fx-params.attack', 'Attack'), value: `${fmt(block.attack, 1)}ms` });
                        } else if (key === 'delay') {
                          if (block.mode) out.push({ label: t('fx-params.mode', 'Mode'), value: block.mode });
                          if (typeof block.time === 'number') out.push({ label: t('fx-params.time', 'Time'), value: `${fmt(block.time, 0)}ms` });
                          if (typeof block.feedback === 'number') out.push({ label: t('fx-params.feedback', 'Feedback'), value: `${fmt(block.feedback, 0)}%` });
                          if (typeof block.mix === 'number') out.push({ label: t('fx-params.mix', 'Mix'), value: `${fmt(block.mix, 0)}%` });
                        } else if (key === 'reverb') {
                          if (typeof block.time === 'number') out.push({ label: t('fx-params.time', 'Time'), value: fmt(block.time, 1) });
                          if (typeof block.pre_delay === 'number') out.push({ label: t('fx-params.pre-delay', 'Pre-delay'), value: `${fmt(block.pre_delay, 0)}ms` });
                          if (typeof block.color === 'number') out.push({ label: t('fx-params.color', 'Color'), value: fmt(block.color, 1) });
                          // Reverb mix vient de alt.reverb_mix (Phase 9.1)
                          // en priorité, fallback block.mix (Phase 9.7).
                          const mix = altVal('reverb_mix');
                          const mixVal = mix !== null ? mix : (typeof block.mix === 'number' ? block.mix : null);
                          if (mixVal !== null) out.push({ label: t('fx-params.mix', 'Mix'), value: `${fmt(mixVal, 0)}%` });
                        }
                        return out;
                      };
                      return (
                        <div data-testid="preset-settings-fx-blocks" style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--a10)' }}>
                          <div style={{ fontSize: 9, color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: 3 }}>{t('fx-blocks.section-title', '🎚 Effets')}</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {present.map(([key, label]) => {
                              const block = fx[key];
                              const onLabel = block.enabled ? t('fx-blocks.on', 'ON') : t('fx-blocks.off', 'OFF');
                              const bgColor = block.enabled ? 'var(--green-bg)' : 'var(--a4)';
                              const textColor = block.enabled ? 'var(--green)' : 'var(--text-dim)';
                              const whyTxt = block.why ? getLocalizedText(block.why, locale) : null;
                              const subParams = subParamsFor(key, block);
                              return (
                                <div key={key}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, padding: '2px 0' }}>
                                    <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{label}</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      {block.enabled && block.type && (
                                        <span style={{ fontSize: 9, color: 'var(--text-dim)', fontStyle: 'italic' }}>{block.type}</span>
                                      )}
                                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 'var(--r-sm)', background: bgColor, color: textColor, fontWeight: 700, fontFamily: 'var(--font-mono)', minWidth: 28, textAlign: 'center' }}>{onLabel}</span>
                                    </span>
                                  </div>
                                  {/* Phase 9.7 — sub-params alignés sous
                                      le bloc si enabled. Format compact
                                      "Threshold -56dB · Release 140ms · Depth -75dB". */}
                                  {subParams.length > 0 && (
                                    <div style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', lineHeight: 1.5, marginLeft: 8, marginBottom: 2 }}>
                                      {subParams.map((sp, i) => (
                                        <span key={i}>
                                          {i > 0 && <span> · </span>}
                                          {sp.label} <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>{sp.value}</span>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {showFxWhy && whyTxt && (
                                    <div style={{ fontSize: 9, color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.4, marginLeft: 8, marginBottom: 3 }}>↳ {whyTxt}</div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {hasAnyWhy && (
                            <button
                              onClick={() => setShowFxWhy((p) => !p)}
                              data-testid="preset-settings-fx-why-toggle"
                              style={{ marginTop: 4, fontSize: 10, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontWeight: 600, textAlign: 'left', width: '100%' }}
                            >
                              {showFxWhy
                                ? t('fx-blocks.why-hide', '▲ Masquer les explications')
                                : t('fx-blocks.why-show', '▸ Pourquoi ces FX ?')}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
              {(aiC.settings_preset || aiC.settings_guitar) && (
                <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {aiC.settings_preset && <div style={{ fontSize: 10, background: 'var(--a4)', border: '1px solid var(--a10)', borderRadius: 'var(--r-md)', padding: '5px 8px', color: 'var(--text-sec)' }}><b style={{ color: 'var(--text-muted)' }}>{t('song-detail.preset-settings', 'Preset :')}</b> {getLocalizedText(aiC.settings_preset, locale)}</div>}
                  {aiC.settings_guitar && <div style={{ fontSize: 10, background: 'var(--a4)', border: '1px solid var(--a10)', borderRadius: 'var(--r-md)', padding: '5px 8px', color: 'var(--text-sec)' }}><b style={{ color: 'var(--text-muted)' }}>{t('song-detail.guitar-settings', 'Guitare :')}</b> {getLocalizedText(aiC.settings_guitar, locale)}</div>}
                </div>
              )}
            </div>
          </div>
        </>
        );
      })()}

      {/* Phase 7.86 — Bloc 3 : 🎸 Mon setup. GuitarSelect + outputContext +
          feedback déplacés dans sticky bandeau en tête de fiche. Mode IA
          replié dans Bloc 2 (toggle "▸ Mode reco avancé"). Ce bloc se
          concentre sur ce que je joue concrètement avec MA guitare choisie
          et MON contexte d'écoute. */}
      <div style={customSectionStyle}>
        {sectionTitle('🎸', t('song-detail.setup-block', 'Mon setup'))}
        {/* Rappel guitare choisie (utile si le sticky est scrollé hors vue
            sur fiche longue). Cliquable pour scroll-to-top retour sticky. */}
        {g && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontStyle: 'italic' }}>
            {tFormat('song-detail.setup-on-guitar', { guitar: g.name }, 'Sur ta {guitar} :')}
          </div>
        )}
        <div style={{ marginBottom: 8 }}>
          {g && chosenGuitarScore && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 3 }}>{t('song-detail.compat', 'Compatibilité :')} <b style={{ color: scoreColor(chosenGuitarScore) }}>{chosenGuitarScore}%</b>{chosenGuitarScoreEstimated && <>{' '}<span style={{ marginLeft: 6, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>{t('song-detail.estimated', '(estimé)')}</span></>}</div>}
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
            return fbText ? <div style={{ fontSize: 10, color: 'var(--text-sec)', marginTop: 3, marginLeft: 24, lineHeight: 1.4 }}>{fbText}</div> : null;
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
            return <div style={{ fontSize: 10, background: 'var(--a4)', border: '1px solid var(--a10)', borderRadius: 'var(--r-md)', padding: '5px 8px', color: 'var(--text-sec)', marginTop: 5, marginLeft: 24 }}><b style={{ color: 'var(--text-muted)' }}>{t('song-detail.settings', 'Réglages :')}</b> {text}</div>;
          })()}
          {/* Phase 9.5 — playing_hints structurés (pickup / volume / tone /
              stereo) générés par l'IA, complémentaires à localGuitarSettings
              ci-dessus qui sont des valeurs heuristiques locales. Affiche un
              second bloc "💡 Conseil IA" si présent. Skip si absent (aiCache
              pré-9.5 → rendu inchangé). */}
          {aiC && aiC.playing_hints && (() => {
            const ph = aiC.playing_hints;
            const parts = [];
            // Phase 9.5.1 — pickup localisé en FR/ES (jargon universel EN
            // sinon affiché brut "Bridge" à côté du bloc Réglages déjà
            // traduit "Micro chevalet" — incohérence visuelle).
            if (ph.pickup) parts.push(localizePickup(ph.pickup, locale));
            if (ph.guitar_tone) parts.push(`${t('song-detail.tone-label', 'Tone')} ${ph.guitar_tone}`);
            if (ph.guitar_volume) parts.push(`${t('song-detail.volume-label', 'Volume')} ${ph.guitar_volume}`);
            if (parts.length === 0 && !ph.stereo) return null;
            const text = parts.join(' · ');
            return (
              <div style={{ fontSize: 10, background: 'var(--a4)', border: '1px solid var(--a10)', borderRadius: 'var(--r-md)', padding: '5px 8px', color: 'var(--text-sec)', marginTop: 3, marginLeft: 24 }}>
                <b style={{ color: 'var(--text-muted)' }}>{t('playing-hints.ai-advice', '💡 Conseil IA :')}</b> {text}
                {ph.stereo === true && (
                  <span style={{ marginLeft: 6, padding: '1px 5px', borderRadius: 'var(--r-sm)', background: 'var(--brass-bg)', color: 'var(--brass)', fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {t('playing-hints.stereo', '🎚️ STEREO')}
                  </span>
                )}
              </div>
            );
          })()}
        </div>
        {/* Phase 7.86 — Bloc Mode reco avancé : repli sous toggle.
            Préserve la fonctionnalité Phase 7.3 (override recoMode par
            morceau : balanced / faithful / interpretation) mais cachée
            par défaut pour désencombrer l'UI débutant. Power-users peuvent
            déplier pour ajuster. Bloc outputContext supprimé (déplacé
            dans sticky bandeau en tête de fiche). */}
        <div style={{ marginBottom: 8 }}>
          <button
            onClick={() => setShowAdvancedMode((p) => !p)}
            data-testid="advanced-mode-toggle"
            style={{ fontSize: 10, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontWeight: 600, textAlign: 'left' }}
          >
            {showAdvancedMode
              ? t('song-detail.advanced-mode-hide', '▲ Masquer le mode reco avancé')
              : t('song-detail.advanced-mode-show', '▸ Mode reco avancé')}
            {song.recoMode && <span style={{ marginLeft: 6, color: 'var(--text-dim)', fontWeight: 400 }}>{tFormat('song-detail.advanced-mode-active', { mode: song.recoMode }, '· {mode} actif')}</span>}
          </button>
          {showAdvancedMode && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{t('song-detail.mode-label', 'Mode IA pour ce morceau')} {song.recoMode ? <span style={{ color: 'var(--accent)' }}>{t('song-detail.mode-override', '· override')}</span> : <span style={{ color: 'var(--text-dim)' }}>{tFormat('song-detail.mode-inherited', { mode: profile?.recoMode || 'balanced' }, '· profil ({mode})')}</span>}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[
                  { id: '', icon: '↻', label: t('song-detail.mode-profile', 'Profil') },
                  { id: 'balanced', icon: '⚖️', label: t('song-detail.mode-balanced', 'Équilibré') },
                  { id: 'faithful', icon: '🎯', label: t('song-detail.mode-faithful', 'Fidèle') },
                  { id: 'interpretation', icon: '🎨', label: t('song-detail.mode-interpretation', 'Interprétation') },
                ].map(({ id, icon, label }) => {
                  const active = (song.recoMode || '') === id;
                  return (
                    <button key={id || 'profile'}
                      data-testid={`song-reco-mode-${id || 'profile'}`}
                      onClick={() => {
                        onSongDb((p) => p.map((x) => x.id === song.id ? { ...x, recoMode: id || undefined } : x));
                        writeAiCache(null);
                        setLocalAiResult(null);
                      }}
                      title={id ? tFormat('song-detail.mode-tooltip-override', { label }, 'Override : {label}') : t('song-detail.mode-tooltip-profile', 'Hérite du mode profil. Cliquer invalide le cache IA pour re-fetcher avec le nouveau mode.')}
                      style={{ fontSize: 10, fontWeight: active ? 700 : 500, background: active ? 'var(--accent-bg)' : 'var(--a3)', border: active ? '1px solid var(--accent-border)' : '1px solid var(--a8)', color: active ? 'var(--accent)' : 'var(--text-muted)', borderRadius: 'var(--r-sm)', padding: '3px 8px', cursor: 'pointer' }}
                    >{icon} {label}</button>
                  );
                })}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 3, fontStyle: 'italic' }}>{t('song-detail.mode-hint', 'Changer le mode invalide le cache → re-analyse au prochain ouverture du morceau.')}</div>
            </div>
          )}
        </div>
        {aiC && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{tFormat('song-detail.best-installed-for', { guitar: g?.short || t('song-detail.this-guitar', 'cette guitare') }, 'Meilleurs presets installes pour {guitar}')}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {getActiveDevicesForRender(profile).map((d) => {
            if (typeof d.RecommendBlock === 'function') {
              return (
                <div key={d.id} style={{ borderTop: '1px solid var(--a8)', marginTop: 6, paddingTop: 6 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: d.deviceColor || 'var(--brass-400)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>{d.icon}</span><span>{d.label}</span>
                  </div>
                  <d.RecommendBlock song={song} guitar={g} profile={profile} allGuitars={guitars} onPatchOverride={onTmpPatchOverride}/>
                </div>
              );
            }
            if (!aiC) return null;
            const banks = d.bankStorageKey === 'banksAnn' ? banksAnn : banksPlug;
            const presetData = aiC[d.presetResultKey];
            return (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <StatusDot score={presetData?.score} ideal={presetData?.label === aiC.ideal_preset} size={10}/>
                {/* Phase 7.55.7 fix bug Cowork iPhone — min-width: 0 obligatoire
                    sur flex:1 enfant pour laisser PBlock shrink correctement.
                    Sans ça : sur viewport étroit (iPhone 375-430), le nom de
                    preset long s'effondrait en colonne verticale (1 char/ligne,
                    span 17×248px). */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <PBlock device={d.label} emoji={d.icon} presetName={presetData?.label} gType={gId ? type : null} banks={banks} availableSources={availableSources} guitarId={gId} noUpgrade finalScore={presetData?.score} breakdown={presetData?.breakdown}/>
                </div>
              </div>
            );
          })}
        </div>
        {/* Suggestion d'amélioration si score < 90% */}
        {aiC && (() => {
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
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--yellow)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>{tFormat('song-detail.improvable', { score: bestScore }, 'Ameliorable — {score}% max')}</div>
              <div style={{ fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.5, marginBottom: 6 }}>
                {weakest && <span>{tFormat('song-detail.weak-point', { label: weakLabel, score: weakScore }, 'Point faible : ')}<b>{weakLabel}</b> ({weakScore}%). </span>}
                {suggestion}
              </div>
              {extMatches.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>{t('song-detail.recommended-packs', 'Packs recommandés à l\'achat :')}</div>
                  {extMatches.map((e, i) => (
                    <div key={i} style={{ fontSize: 10, color: 'var(--text-sec)', marginBottom: 3, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <StatusDot score={e.family ? 65 : 85} size={6}/>
                      <span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{e.pack}</span>
                      <span style={{ color: 'var(--text-dim)' }}>{e.creator}</span>
                      {e.family && <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{t('song-detail.family-similar', '[famille similaire]')}</span>}
                    </div>
                  ))}
                </div>
              )}
              {extMatches.length === 0 && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>{tFormat('song-detail.no-pack', { ref: refAmp }, 'Aucun pack connu pour "{ref}" dans notre base.')}</div>}
              <div style={{ marginTop: 6, background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 6, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-sec)', marginBottom: 3 }}>{t('song-detail.tonenet-search', 'Recherche ToneNET')}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>{tFormat('song-detail.tonenet-instructions', { ref: refAmp }, 'Recherchez {ref} dans le moteur de recherche ToneNET').split(refAmp).map((part, i, arr) => i < arr.length - 1 ? <React.Fragment key={i}>{part}<b style={{ color: 'var(--text-bright)' }}>{refAmp}</b></React.Fragment> : part)}</div>
                <a href="https://tone.net" target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: 'var(--accent)', textDecoration: 'underline' }}>tone.net</a>
              </div>
            </div>
          );
        })()}
      </div>

      {!reloading && !aiC && !localAiErr && <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '10px 0' }}>{t('song-detail.no-cache', 'Aucune analyse IA en cache. Selectionne une guitare pour lancer l\'analyse.')}</div>}
      {localAiErr && !reloading && (
        <div data-testid="song-ai-error" style={{ fontSize: 12, color: 'var(--red)', background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: 'var(--r-md)', padding: '8px 10px', margin: '6px 0', lineHeight: 1.4 }}>
          {t('song-detail.ai-error-prefix', '⚠️ Analyse IA échouée :')} <b>{localAiErr}</b>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{t('song-detail.ai-error-hint', 'Vérifie ta clé API dans ⚙️ Paramètres puis re-sélectionne la guitare pour relancer.')}</div>
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
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 }}>{tFormat('song-detail.feedback-history', { count: all.length }, '💬 Tes feedbacks précédents ({count})')}</div>
                  {all.length > 1 && <button
                    data-testid="song-feedback-clear-all"
                    onClick={() => {
                      if (!window.confirm(tFormat('song-detail.feedback-clear-confirm', { count: all.length, title: song.title }, 'Effacer tous les {count} feedbacks pour "{title}" ?\n\nL\'analyse IA va être recalculée sans tes corrections passées (~8s).'))) return;
                      // Phase 7.54 — feedback dans song (shared), aiCache dans profile
                      onSongDb((p) => p.map((x) => x.id === song.id ? { ...x, feedback: [] } : x));
                      writeAiCache(null);
                      setLocalAiResult(null);
                    }}
                    style={{ fontSize: 9, background: 'none', border: '1px solid var(--a10)', color: 'var(--text-dim)', borderRadius: 'var(--r-sm)', padding: '1px 6px', cursor: 'pointer' }}
                    title={t('song-detail.feedback-clear-tooltip', 'Effacer tous les feedbacks pour ce morceau')}
                  >{t('song-detail.feedback-clear-all', 'Tout effacer')}</button>}
                </div>
                {all.map((fb, i) => {
                  if (i < showFromIdx) return null;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 10, color: 'var(--text-sec)', lineHeight: 1.4, marginBottom: 2 }}>
                      <span style={{ flex: 1 }}>· <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>{fb.ts ? new Date(fb.ts).toLocaleDateString(getLocale()) : ''}</span> — {fb.text}</span>
                      <button
                        data-testid={`song-feedback-delete-${i}`}
                        onClick={() => {
                          // Phase 7.54 — feedback dans song (shared), aiCache dans profile
                          onSongDb((p) => p.map((x) => x.id === song.id ? { ...x, feedback: (x.feedback || []).filter((_, j) => j !== i) } : x));
                          writeAiCache(null);
                          setLocalAiResult(null);
                        }}
                        title={t('song-detail.feedback-delete-tooltip', 'Supprimer ce feedback + recalculer la reco IA sans lui')}
                        style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
                      >✕</button>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          {!showFeedback
            ? <button data-testid="song-feedback-open" onClick={() => setShowFeedback(true)} style={{ fontSize: 11, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', color: 'var(--accent)', borderRadius: 'var(--r-md)', padding: '6px 12px', cursor: 'pointer', fontWeight: 600 }}>{t('song-detail.give-feedback', '💬 Donner un feedback à l\'IA')}</button>
            : <FeedbackPanel
                onSubmit={(fb) => {
                  setShowFeedback(false); setReloading(true);
                  const prev = aiC;
                  const effectiveRecoMode = song.recoMode || profile?.recoMode || 'balanced';
                  // Phase 7.66 — Prompt scopé au rig profil actif.
                  fetchAI(song, gId, banksAnn, banksPlug, aiProvider, aiKeys, guitars, fb || null, null, effectiveRecoMode, guitarBias, song.outputContext || profile?.outputContext || 'frfr', profile?.preferredStyles || [])
                    .then((r) => {
                      const pick = mergeBestResults(prev, r);
                      setLocalAiResult(pick);
                      // Phase 7.54 — feedback dans song (shared), aiCache dans profile.
                      if (fb && onSongDb) {
                        onSongDb((p) => p.map((x) => x.id !== song.id ? x : { ...x, feedback: [...(x.feedback || []), { text: fb, ts: Date.now() }] }));
                      }
                      writeAiCache(updateAiCache(song.aiCache, gId, pick));
                    })
                    .catch((e) => { setLocalAiErr(e?.message || String(e)); })
                    .finally(() => setReloading(false));
                }}
                onCancel={() => setShowFeedback(false)}
              />
          }
        </div>
      )}
      <button onClick={onClose} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, marginTop: 4 }}>{t('song-detail.close', 'Fermer ↑')}</button>

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
    </div>
  );
}

export default SongDetailCard;
export { SongDetailCard };

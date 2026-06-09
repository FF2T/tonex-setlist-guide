// src/app/screens/EvaluatePurchaseScreen.jsx
//
// Évaluateur d'achat de presets/packs. On colle le listing d'un pack
// envisagé, Backline note chaque preset contre le répertoire analysé et
// rend un verdict mené par les MORCEAUX débloqués (pas par le nombre de
// presets). Logique pure + testée dans src/core/purchase-eval.js.
//
// Perf (P6) : la baseline (meilleur installé recalculé brut par morceau)
// est le coût dominant → le pass est déféré + chunké après mount, avec
// progression. Dédup par nom de preset unique côté baseline (helper).
// Diagnostic distribution derrière window.__TONEX_PERF (P4).
//
// No-emoji UI (règle 2026-05-27) : tags = pastilles colorées + libellés.

import React, { useState, useMemo } from 'react';
import { t, tFormat } from '../../i18n/index.js';
import NavIcon from '../components/NavIcon.jsx';
import Breadcrumb from '../components/Breadcrumb.jsx';
import { parsePackListing } from '../utils/parse-pack-listing.js';
import { detectPresetMetadata } from '../utils/detect-preset-metadata.js';
import { enrichPackWithAI } from '../utils/enrich-pack-ai.js';
import { findCatalogEntry } from '../../core/catalog.js';
import { bucketizeScore } from '../../core/scoring/compat-buckets.js';
import { getSharedGeminiKey } from '../utils/shared-key.js';
import { evaluatePack, currentBestInstalled, DEFAULT_EVAL_OPTS } from '../../core/purchase-eval.js';

const SOURCE_OPTIONS = ['', 'TSR', 'AA', 'JS', 'TJ', 'ML', 'WT', 'Galtone', 'ToneNET'];

const TAG_META = {
  fill:      { color: 'var(--green)',          label: 'Comble un manque', order: 0 },
  upgrade:   { color: 'var(--yellow)',         label: 'Améliore',         order: 1 },
  duplicate: { color: 'var(--text-tertiary)',  label: 'Doublon',          order: 2 },
  off:       { color: 'var(--text-dim)',       label: 'Hors répertoire',  order: 3 },
  bass:      { color: 'var(--brass-300)',      label: 'Capture basse',    order: 4 },
};
const CONF_LABEL = { catalog: 'catalogue', ai: 'IA', guessed: 'estimé' };

// Construit le contexte de scoring d'un morceau depuis son aiCache.
function songCtx(song) {
  const r = song?.aiCache?.result || {};
  return {
    song_style: r.song_style ?? null,
    target_gain: r.target_gain ?? null,
    ref_amp: r.ref_amp ?? null,
    artist: song.artist || '',
    title: song.title || '',
    ref_guitarist: r.ref_guitarist || '',
  };
}

const CHUNK = 8; // morceaux par tick pour le pass baseline déféré

export default function EvaluatePurchaseScreen({
  songDb = [], setlists = [], allGuitars = [],
  banksAnn = {}, banksPlug = {}, banksOne = {}, banksOnePlus = {},
  profile = {}, aiKeys = {}, aiProvider = 'gemini', onNavigate,
}) {
  const [rawText, setRawText] = useState('');
  const [packName, setPackName] = useState('');
  const [source, setSource] = useState('');
  const [scopeId, setScopeId] = useState(''); // '' = tout le répertoire
  const [result, setResult] = useState(null); // { presets, unlockedSongs, improvedSongs, summary }
  const [computing, setComputing] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState('');
  const [expanded, setExpanded] = useState(null);

  const enabledDevices = profile.enabledDevices || [];
  const banksByDevice = useMemo(() => ({ ann: banksAnn, plug: banksPlug, one: banksOne, onePlus: banksOnePlus }), [banksAnn, banksPlug, banksOne, banksOnePlus]);

  const aiKey = aiProvider === 'anthropic'
    ? (aiKeys?.anthropic || '')
    : (aiKeys?.gemini || getSharedGeminiKey() || '');

  // Morceaux analysés (aiCache.result présent), filtrés au scope éventuel.
  const scopeSongIds = useMemo(() => {
    if (!scopeId) return null;
    const sl = setlists.find((s) => s.id === scopeId);
    return sl ? new Set(sl.songIds || []) : new Set();
  }, [scopeId, setlists]);

  const repertoireSongs = useMemo(() => {
    return songDb.filter((s) => {
      if (scopeSongIds && !scopeSongIds.has(s.id)) return false;
      return !!s?.aiCache?.result;
    });
  }, [songDb, scopeSongIds]);

  const notAnalyzedCount = useMemo(() => {
    const inScope = scopeSongIds ? songDb.filter((s) => scopeSongIds.has(s.id)) : songDb;
    return inScope.filter((s) => !s?.aiCache?.result).length;
  }, [songDb, scopeSongIds]);

  // Parse le listing → candidats résolus { name, entry, confidence }.
  function resolveCandidates(aiPresets) {
    const { presets } = parsePackListing(rawText);
    const aiByName = new Map((aiPresets || []).map((p) => [p.name, p]));
    return presets.map((name) => {
      const ai = aiByName.get(name);
      if (ai) return { name, entry: { ...ai, src: 'ai' }, confidence: 'ai' };
      const entry = findCatalogEntry(name);
      if (entry && !entry.guessed) return { name, entry, confidence: 'catalog' };
      const meta = detectPresetMetadata(name);
      return { name, entry: { amp: meta.amp, gain: meta.gain, style: meta.style, scores: meta.scores, src: 'guessed' }, confidence: 'guessed' };
    });
  }

  // Pass différé + chunké : baseline (dominant) puis evaluatePack.
  function runEvaluation(aiPresets) {
    const candidates = resolveCandidates(aiPresets);
    if (!candidates.length) { setResult(null); return; }
    const songs = repertoireSongs;
    if (!songs.length) {
      setResult(evaluatePack(candidates, [], DEFAULT_EVAL_OPTS));
      return;
    }
    setComputing(true);
    setProgress(0);
    setResult(null);
    const repertoire = [];
    let i = 0;
    const step = () => {
      const end = Math.min(i + CHUNK, songs.length);
      for (; i < end; i++) {
        const s = songs[i];
        const ctx = songCtx(s);
        const slSong = scopeId ? setlists.find((x) => x.id === scopeId) : null;
        const gid = (slSong?.guitars?.[s.id]) || s?.aiCache?.gId || null;
        const cb = currentBestInstalled(ctx, banksByDevice, enabledDevices, gid, DEFAULT_EVAL_OPTS);
        repertoire.push({ songId: s.id, title: s.title, artist: s.artist, ctx, guitarId: gid, currentBest: cb ? cb.score : null });
      }
      setProgress(songs.length ? i / songs.length : 1);
      if (i < songs.length) { setTimeout(step, 0); return; }
      const evald = evaluatePack(candidates, repertoire, DEFAULT_EVAL_OPTS);
      if (typeof window !== 'undefined' && window.__TONEX_PERF) {
        const baseVals = repertoire.map((r) => r.currentBest).filter((v) => v != null);
        const candVals = evald.presets.map((p) => p.bestScore).filter((v) => v != null);
        // eslint-disable-next-line no-console
        console.log('[purchase-eval] baseline n=%d min=%d max=%d | candidat best min=%d max=%d | unlocked=%d', baseVals.length, Math.min(...baseVals), Math.max(...baseVals), Math.min(...candVals), Math.max(...candVals), evald.summary.unlockedCount);
      }
      setResult(evald);
      setComputing(false);
      setProgress(1);
    };
    setTimeout(step, 0);
  }

  async function refineWithAI() {
    const { presets, archiveName } = parsePackListing(rawText);
    if (!presets.length) { setAiErr('Colle d\'abord une liste de presets.'); return; }
    if (!aiKey) { setAiErr('Aucune clé API disponible.'); return; }
    setAiBusy(true); setAiErr('');
    try {
      const out = await enrichPackWithAI(presets, packName || archiveName || 'Pack', source || 'Inconnu', { aiKey, aiProvider });
      runEvaluation(out.presets || []);
    } catch (e) {
      setAiErr(String(e?.message || e));
    } finally {
      setAiBusy(false);
    }
  }

  function onTextChange(v) {
    setRawText(v);
    if (!packName) {
      const { archiveName } = parsePackListing(v);
      if (archiveName) setPackName(archiveName);
    }
  }

  const presetsSorted = useMemo(() => {
    if (!result) return [];
    return [...result.presets].sort((a, b) => {
      const oa = TAG_META[a.tag]?.order ?? 9, ob = TAG_META[b.tag]?.order ?? 9;
      if (oa !== ob) return oa - ob;
      return (b.bestScore ?? -1) - (a.bestScore ?? -1);
    });
  }, [result]);

  // ---- styles ----
  const card = { background: 'var(--bg-elev-1)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: 14, marginBottom: 14 };
  const sectionTitle = (icon, txt) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
      <NavIcon id={icon} size={16}/>{txt}
    </div>
  );
  const Dot = ({ c }) => <span style={{ width: 9, height: 9, borderRadius: 999, background: c, display: 'inline-block', flexShrink: 0 }}/>;

  return (
    <div className="page-root">
      <Breadcrumb crumbs={[{ label: t('nav.home', 'Accueil'), screen: 'list' }, { label: t('evaluate.title', 'Évaluer un achat') }]} onNavigate={(s) => onNavigate && onNavigate(s)}/>

      <div style={card}>
        {sectionTitle('package', t('evaluate.heading', 'Évaluer un achat de presets'))}
        <div style={{ fontSize: 12, color: 'var(--text-sec)', marginBottom: 10 }}>
          {t('evaluate.intro', 'Colle la liste des presets d\'un pack que tu envisages (unzip -l, ls, ou un nom par ligne). Backline les note contre ton répertoire analysé et te dit si ça vaut le coup.')}
        </div>
        <textarea
          value={rawText}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={t('evaluate.placeholder', 'Colle ici le listing du pack…')}
          rows={6}
          style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-mono, monospace)', fontSize: 12, padding: 8, background: 'var(--bg-elev-0, var(--bg-elev-1))', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-sm)' }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'center' }}>
          <input value={packName} onChange={(e) => setPackName(e.target.value)} placeholder={t('evaluate.pack-name', 'Nom du pack')} style={{ flex: '1 1 160px', minWidth: 120, padding: 8, background: 'var(--bg-elev-0, var(--bg-elev-1))', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-sm)', fontSize: 13 }}/>
          <select value={source} onChange={(e) => setSource(e.target.value)} style={{ padding: 8, background: 'var(--bg-elev-0, var(--bg-elev-1))', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-sm)', fontSize: 13 }}>
            {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s || t('evaluate.source-any', 'Source ?')}</option>)}
          </select>
          <select value={scopeId} onChange={(e) => setScopeId(e.target.value)} style={{ padding: 8, background: 'var(--bg-elev-0, var(--bg-elev-1))', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-sm)', fontSize: 13 }}>
            <option value="">{t('evaluate.scope-all', 'Tout mon répertoire')}</option>
            {setlists.map((sl) => <option key={sl.id} value={sl.id}>{sl.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' }}>
          <button onClick={() => runEvaluation(null)} disabled={computing || !rawText.trim()} style={{ padding: '10px 16px', minHeight: 44, background: 'var(--accent)', color: 'var(--text-inverse)', border: 'none', borderRadius: 'var(--r-sm)', fontWeight: 700, fontSize: 13, cursor: computing ? 'wait' : 'pointer', opacity: !rawText.trim() ? 0.5 : 1 }}>
            {computing ? tFormat('evaluate.computing', { pct: Math.round(progress * 100) }, '{pct}% …') : t('evaluate.run', 'Évaluer')}
          </button>
          <button onClick={refineWithAI} disabled={aiBusy || computing || !rawText.trim() || !aiKey} title={!aiKey ? t('evaluate.no-key', 'Aucune clé API') : ''} style={{ padding: '10px 16px', minHeight: 44, background: 'var(--a5)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-sm)', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: (!rawText.trim() || !aiKey) ? 0.5 : 1 }}>
            {aiBusy ? t('evaluate.ai-busy', 'Analyse IA…') : t('evaluate.ai-refine', 'Affiner avec l\'IA')}
          </button>
        </div>
        {aiErr && <div style={{ color: 'var(--wine-300, #e11d48)', fontSize: 12, marginTop: 6 }}>{aiErr}</div>}
        {computing && (
          <div style={{ height: 4, background: 'var(--a8)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round(progress * 100)}%`, background: 'var(--accent)', transition: 'width 0.2s' }}/>
          </div>
        )}
      </div>

      {result && (() => {
        const { summary, unlockedSongs, improvedSongs } = result;
        const tone = summary.verdict.tone;
        const toneColor = tone === 'positive' ? 'var(--green)' : tone === 'nuanced' ? 'var(--yellow)' : 'var(--text-tertiary)';
        const verdictText = tone === 'positive'
          ? tFormat('evaluate.verdict-positive', { n: summary.unlockedCount, k: summary.useful }, 'Ça vaut le coup — débloque {n} morceau(x) avec {k} preset(s) pertinent(s).')
          : tone === 'nuanced'
            ? tFormat('evaluate.verdict-nuanced', { n: summary.improvedCount }, 'Intérêt limité — n\'ouvre rien de neuf mais améliore {n} morceau(x).')
            : t('evaluate.verdict-negative', 'Peu d\'intérêt — tu as déjà l\'équivalent pour ton répertoire.');
        return (
          <div style={{ ...card, borderColor: toneColor }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Dot c={toneColor}/>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{verdictText}</span>
            </div>
            {summary.preliminary && (
              <div style={{ fontSize: 12, color: 'var(--yellow)', marginBottom: 8 }}>
                {t('evaluate.preliminary', 'Verdict préliminaire — la majorité des presets est estimée au jugé. Clique « Affiner avec l\'IA » pour fiabiliser.')}
              </div>
            )}
            {unlockedSongs.length > 0 && (
              <div style={{ fontSize: 12, marginBottom: 6 }}>
                <b>{t('evaluate.unlocked', 'Morceaux débloqués')} :</b> {unlockedSongs.map((u) => `${u.title} (${u.artist})`).join(' · ')}
              </div>
            )}
            {improvedSongs.length > 0 && (
              <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--text-sec)' }}>
                <b>{t('evaluate.improved', 'Améliorés')} :</b> {improvedSongs.map((u) => u.title).join(' · ')}
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
              {summary.guitarCount} {t('evaluate.presets-scored', 'presets notés')}
              {summary.bassCount > 0 && ` · ${tFormat('evaluate.bass-excluded', { n: summary.bassCount }, '{n} capture(s) basse exclue(s)')}`}
              {notAnalyzedCount > 0 && ` · ${tFormat('evaluate.not-analyzed', { n: notAnalyzedCount }, '{n} morceau(x) non analysé(s), exclus')}`}
              {summary.uncoveredUncomputed > 0 && ` · ${tFormat('evaluate.uncovered', { n: summary.uncoveredUncomputed }, '{n} morceau(x) non couvert(s) (non calculé)')}`}
            </div>
          </div>
        );
      })()}

      {result && presetsSorted.length > 0 && (
        <div style={card}>
          {sectionTitle('list', t('evaluate.by-preset', 'Détail par preset'))}
          {presetsSorted.map((p, idx) => {
            const tm = TAG_META[p.tag] || TAG_META.duplicate;
            const bk = p.bestScore != null ? bucketizeScore(p.bestScore) : null;
            const isOpen = expanded === idx;
            const realHelps = (p.helps || []).filter((h) => h.relation === 'fill' || h.relation === 'upgrade');
            return (
              <div key={idx} style={{ borderTop: idx ? '1px solid var(--a8)' : 'none', padding: '8px 0' }}>
                <div onClick={() => realHelps.length && setExpanded(isOpen ? null : idx)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: realHelps.length ? 'pointer' : 'default' }}>
                  <Dot c={tm.color}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, overflowWrap: 'anywhere' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {p.entry?.amp || '—'} · {p.entry?.gain || '?'} · {p.entry?.style || '?'} · <span style={{ opacity: 0.8 }}>{CONF_LABEL[p.confidence] || p.confidence}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: tm.color, fontWeight: 600, whiteSpace: 'nowrap' }}>{tm.label}</span>
                  {p.bestScore != null && (
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: 'var(--text-inverse)', background: bk.color, borderRadius: 4, padding: '2px 7px', minWidth: 40, textAlign: 'center' }}>{p.bestScore}</span>
                  )}
                </div>
                {isOpen && realHelps.length > 0 && (
                  <div style={{ marginTop: 8, marginLeft: 17, fontSize: 11 }}>
                    {realHelps.sort((a, b) => b.score - a.score).map((h, hi) => (
                      <div key={hi} style={{ display: 'flex', gap: 8, padding: '2px 0', color: 'var(--text-sec)' }}>
                        <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{h.title} <span style={{ opacity: 0.7 }}>· {h.artist}</span></span>
                        <span style={{ whiteSpace: 'nowrap' }}>
                          {h.currentBest == null ? t('evaluate.no-install', 'rien') : h.currentBest} → <b style={{ color: 'var(--text)' }}>{h.score}</b>
                          {h.delta != null && <span style={{ color: h.delta > 0 ? 'var(--green)' : 'var(--text-tertiary)' }}> ({h.delta > 0 ? '+' : ''}{h.delta})</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

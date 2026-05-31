// src/app/screens/LiveScreen.jsx — Phase 4.
// Mode scène plein écran. Affiche un morceau à la fois ; navigation
// gauche/droite (swipe + boutons) entre les morceaux d'une setlist.
//
// Pour chaque device activé du profil qui expose `device.LiveBlock`,
// rend ce composant. Sinon, affiche un fallback minimal.
//
// Props :
//   songs            : tableau de morceaux ordonnés (résolu depuis la
//                      setlist par le parent).
//   profile, allGuitars, banksAnn, banksPlug, availableSources :
//                      contexte utilisateur transmis aux LiveBlocks.
//   enabledDevices   : tableau de devices déjà filtré par le parent
//                      (équivalent getEnabledDevices(profile)).
//   onExit           : callback "← Sortir" (revient à l'écran d'origine).
//   getGuitarForSong : fonction (song) → guitar (depuis savedGuitars
//                      de la setlist).
//   onTmpPatchOverride : callback Phase 4 pour autoriser l'édition
//                       éventuelle depuis un LiveBlock (TMP).

import React, { useEffect, useRef, useState } from 'react';
import { t, tFormat, getLocale } from '../../i18n/index.js';
import { getSongInfo, SONG_HISTORY } from '../../core/songs.js';
import { getEffectivePlayContext, getAvailableRigs } from '../../core/state.js';
import { getLocalizedText } from '../utils/ai-helpers.js';
import NavIcon from '../components/NavIcon.jsx';

// Phase 4.6 — Mapping pickup playing_hints (Phase 9.5) vers labels
// trilingues pour lecture rapide en scène. Universal pickup names
// (Bridge/Neck/Middle/Position 2-4) → localisés FR/EN/ES.
function localizePickupLive(raw, locale) {
  if (!raw) return null;
  const v = String(raw).toLowerCase().trim();
  const fr = locale === 'fr' || (!locale && getLocale() === 'fr');
  const es = locale === 'es' || (!locale && getLocale() === 'es');
  if (v.includes('bridge') && !v.includes('neck')) return fr ? 'Micro chevalet' : es ? 'Pastilla puente' : 'Bridge';
  if (v.includes('neck') && !v.includes('bridge')) return fr ? 'Micro manche' : es ? 'Pastilla mástil' : 'Neck';
  if (v.includes('middle') || v.includes('position 3')) return fr ? 'Micro intermédiaire' : es ? 'Pastilla central' : 'Middle';
  if (v.includes('position 4') || v.includes('middle+bridge')) return fr ? 'Position 4 (intermédiaire+chevalet)' : es ? 'Posición 4' : 'Position 4 (Middle+Bridge)';
  if (v.includes('position 2') || v.includes('middle+neck')) return fr ? 'Position 2 (manche+intermédiaire)' : es ? 'Posición 2' : 'Position 2 (Middle+Neck)';
  if (v.includes('bridge+neck') || v.includes('all')) return fr ? 'Tous micros' : es ? 'Todas las pastillas' : 'All pickups';
  return raw; // fallback : valeur brute
}

const SWIPE_MIN_DISTANCE = 50; // px
const SWIPE_MAX_VERTICAL = 80; // px (ignore si swipe trop vertical)

function useWakeLock(enabled) {
  const lockRef = useRef(null);
  // Phase 7.55.7 — état actif pour afficher l'indicateur 🔒 dans le header.
  const [isLocked, setIsLocked] = useState(false);
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const acquire = async () => {
      try {
        if (typeof navigator !== 'undefined'
            && navigator.wakeLock
            && typeof navigator.wakeLock.request === 'function') {
          const lock = await navigator.wakeLock.request('screen');
          if (cancelled) {
            try { await lock.release(); } catch (_e) { /* ignore */ }
            return;
          }
          lockRef.current = lock;
          setIsLocked(true);
          // Safari iOS / certains browsers émettent un event 'release'
          // quand le lock est révoqué (background, low battery, etc.)
          if (lock && typeof lock.addEventListener === 'function') {
            lock.addEventListener('release', () => setIsLocked(false));
          }
        }
      } catch (_e) {
        // Silencieux : Wake Lock optionnel, fallback = rien.
      }
    };
    acquire();
    // Reacquérir après visibilitychange (Safari iOS release le lock
    // quand l'utilisateur change d'onglet → on le re-prend au retour).
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        acquire();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    return () => {
      cancelled = true;
      setIsLocked(false);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
      if (lockRef.current) {
        try { lockRef.current.release(); } catch (_e) { /* ignore */ }
        lockRef.current = null;
      }
    };
  }, [enabled]);
  return isLocked;
}

function LiveScreen({
  songs,
  profile,
  allGuitars,
  banksAnn,
  banksPlug,
  availableSources,
  enabledDevices,
  onExit,
  getGuitarForSong,
  onTmpPatchOverride,
  initialIndex = 0,
}) {
  const total = Array.isArray(songs) ? songs.length : 0;
  const [index, setIndex] = useState(() => {
    const i = Math.max(0, Math.min(total - 1, initialIndex || 0));
    return Number.isFinite(i) ? i : 0;
  });
  // Si la setlist change (ajout/suppression), on clamp l'index.
  useEffect(() => {
    if (index >= total && total > 0) setIndex(total - 1);
  }, [total, index]);

  const wakeLockActive = useWakeLock(true);

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(total - 1, i + 1));

  // Swipe handling.
  const touchStart = useRef(null);
  const onTouchStart = (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e) => {
    if (!touchStart.current) return;
    const t = e.changedTouches?.[0];
    if (!t) return;
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dy) > SWIPE_MAX_VERTICAL) return; // swipe vertical → ignore
    if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return;
    if (dx < 0) goNext();
    else goPrev();
  };

  // Clavier (utile en preview desktop).
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'Escape' && typeof onExit === 'function') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, onExit]);

  if (total === 0) {
    return (
      <div
        data-testid="live-screen-empty"
        style={{
          padding: 32, textAlign: 'center', color: 'var(--text-dim)',
        }}
      >
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center', color: 'var(--brass-300)' }}><NavIcon id="live" size={48}/></div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          Setlist vide
        </div>
        <div style={{ fontSize: 13, marginBottom: 16 }}>
          Ajoute des morceaux à la setlist avant de lancer le mode scène.
        </div>
        <button
          type="button"
          onClick={onExit}
          style={{
            background: 'var(--a5)', border: '1px solid var(--a8)',
            borderRadius: 'var(--r-md)', padding: '10px 18px',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            color: 'var(--text-bright)',
          }}
        >
          {t('live.exit', '← Sortir')}
        </button>
      </div>
    );
  }

  const song = songs[index];
  const info = song ? getSongInfo(song) : null;
  const hist = song ? (SONG_HISTORY[song.id] || null) : null;
  const guitar = song && typeof getGuitarForSong === 'function'
    ? getGuitarForSong(song)
    : null;
  const devices = Array.isArray(enabledDevices) ? enabledDevices : [];
  // Phase B/C — contexte de jeu (instrument × rig) du morceau courant : filtre
  // les sections affichées en scène, comme la fiche dépliée SongDetailCard.
  const playCtx = song ? getEffectivePlayContext(profile, song) : { instrument: 'guitar', rig: 'tonex' };
  const playsBass = Array.isArray(profile?.instruments) && profile.instruments.includes('bass');
  const availableRigs = getAvailableRigs(profile, playCtx.instrument);
  const showContextBadge = playsBass || availableRigs.length > 1;
  const aiC = song?.aiCache?.result || null;
  const liveLocale = getLocale();

  return (
    <div
      data-testid="live-screen"
      data-song-index={index}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'var(--bg-base)',
        display: 'flex', flexDirection: 'column',
        // Phase 7.55.7 — padding responsive iPad : plus de respiration latérale
        padding: 'clamp(12px, 1.8vw, 24px) clamp(16px, 2.5vw, 32px) clamp(16px, 2.2vw, 28px)',
        overflowY: 'auto',
      }}
    >
      {/* Header — bouton sortir + indicateur wake lock + compteur */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 'clamp(8px, 1vw, 16px)',
          gap: 12,
        }}
      >
        <button
          type="button"
          data-testid="live-screen-exit"
          onClick={onExit}
          style={{
            background: 'var(--a5)', border: '1px solid var(--a8)',
            borderRadius: 'var(--r-md)',
            // v9.7.9 (audit Cowork P1-C iPad) — minHeight forcé 44px iOS HIG
            // (au 640 CSS px : padding clamp réduit à 10+10=20 → btn 38px).
            padding: 'clamp(10px, 1.4vw, 14px) clamp(14px, 2vw, 22px)',
            minWidth: 'clamp(80px, 12vw, 140px)',
            minHeight: 'clamp(44px, 5vw, 56px)',
            fontSize: 'clamp(14px, 1.6vw, 18px)',
            fontWeight: 700, cursor: 'pointer',
            color: 'var(--text-bright)',
            whiteSpace: 'nowrap',
          }}
        >
          {t('live.exit', '← Sortir')}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Phase 7.55.7 — indicateur Wake Lock actif : 🔒 visible quand
              navigator.wakeLock a accordé un lock screen-on. Rassure le
              user en scène que son écran ne va pas s'éteindre. Silencieux
              si API pas dispo. */}
          {wakeLockActive && (
            <div
              data-testid="live-screen-wakelock"
              title={t('live.wakelock-active', 'Écran maintenu allumé')}
              style={{
                color: 'var(--green)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              {/* v9.7.9 (audit Cowork) — emoji 🔒 → NavIcon (règle no-emoji UI). */}
              <NavIcon id="lock" size={20}/>
            </div>
          )}
          <div
            style={{
              fontFamily: 'var(--font-mono)', fontWeight: 700,
              fontSize: 'clamp(13px, 1.8vw, 19px)',
              color: 'var(--text-muted)',
            }}
          >
            {index + 1} / {total}
          </div>
        </div>
      </div>

      {/* Title block — gros titre + BPM/key + history. Phase 7.55.7 :
          caps poussés pour lecture iPad scène (72-80pt en paysage iPad). */}
      <div style={{ marginBottom: 'clamp(12px, 1.5vw, 20px)' }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            // v9.7.9 (audit Cowork P1-H iPad) — bump 7vw→8vw + max 72→96
            // pour vraie lecture scène à 1m sur iPad Pro 13" portrait
            // (1024 CSS px = 82px, vs 72px avant).
            fontSize: 'clamp(32px, 8vw, 96px)',
            fontWeight: 800, lineHeight: 1.05,
            color: 'var(--text-primary)',
            marginBottom: 'clamp(4px, 0.6vw, 8px)',
          }}
          data-testid="live-screen-title"
        >
          {song?.title || '—'}
        </div>
        <div
          style={{
            fontSize: 'clamp(14px, 2.8vw, 28px)',
            color: 'var(--text-sec)',
            marginBottom: 'clamp(6px, 0.8vw, 10px)',
            fontWeight: 500,
          }}
        >
          {song?.artist || ''}
        </div>
        {(info?.bpm || info?.key) && (
          <div
            data-testid="live-screen-bpm-key"
            style={{
              display: 'flex', gap: 'clamp(12px, 1.8vw, 20px)', alignItems: 'center',
              fontSize: 'clamp(13px, 2.2vw, 22px)',
              color: 'var(--text-muted)',
              marginBottom: 'clamp(6px, 0.8vw, 10px)',
            }}
          >
            {info.bpm && (
              <span>
                <b style={{ color: 'var(--text-bright)' }}>{info.bpm}</b> {t('live.bpm', 'BPM')}
              </span>
            )}
            {info.key && (
              <span>
                <b style={{ color: 'var(--text-bright)' }}>{info.key}</b>
              </span>
            )}
          </div>
        )}
        {hist && (
          <div
            style={{
              fontSize: 'clamp(11px, 1.4vw, 15px)',
              color: 'var(--text-tertiary)',
              fontStyle: 'italic', lineHeight: 1.5,
            }}
          >
            {hist.guitarist} · {hist.guitar} · {hist.amp}
          </div>
        )}
        {/* Phase B/C — badge contexte de jeu (read-only) : instrument · rig
            du morceau courant. Masqué si profil mono (1 instrument + 1 rig). */}
        {showContextBadge && (
          <div
            data-testid="live-screen-context-badge"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              marginTop: 'clamp(6px, 0.8vw, 10px)',
              fontSize: 'clamp(11px, 1.5vw, 16px)', fontWeight: 700,
              color: 'var(--accent)',
              background: 'var(--accent-soft)', border: '1px solid var(--accent-border)',
              borderRadius: 'var(--r-md)', padding: '4px 12px',
              fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.5,
            }}
          >
            <NavIcon id={playCtx.instrument === 'bass' ? 'bass' : 'guitar'} size={16}/>
            <span>{playCtx.instrument === 'bass' ? t('play-context.instrument-bass', 'Basse') : t('play-context.instrument-guitar', 'Guitare')}</span>
            <span style={{ color: 'var(--text-dim)' }}>·</span>
            <NavIcon id={playCtx.rig === 'tmp' ? 'sliders' : 'amp'} size={16}/>
            <span>{playCtx.rig === 'tonex' ? t('play-context.rig-tonex', 'ToneX') : playCtx.rig === 'tmp' ? t('play-context.rig-tmp', 'Tone Master Pro') : t('play-context.rig-amp', 'Ampli')}</span>
          </div>
        )}
      </div>

      {/* Phase 4.6 — Section guitare device-agnostic (playing_hints Phase 9.5)
          Affichée entre Title block et Devices pour lecture rapide en scène.
          Skip silencieux si aiCache absent ou playing_hints absent.
          Phase B — gated par contexte de jeu instrument = guitare. */}
      {playCtx.instrument === 'guitar' && (() => {
        const playingHints = song?.aiCache?.result?.playing_hints;
        if (!playingHints || typeof playingHints !== 'object') return null;
        const { pickup, guitar_volume, guitar_tone, stereo } = playingHints;
        if (!pickup && !guitar_volume && !guitar_tone && !stereo) return null;
        const locale = getLocale();
        const pickupLoc = localizePickupLive(pickup, locale);
        const guitarLabel = guitar?.name || t('live.your-guitar', 'ta guitare');
        return (
          <div
            data-testid="live-screen-guitar-hints"
            style={{
              background: 'var(--a3)',
              border: '1px solid var(--accent-border)',
              borderRadius: 'var(--r-lg)',
              padding: '12px 14px',
              marginBottom: 12,
              display: 'flex', flexDirection: 'column', gap: 4,
            }}
          >
            <div
              style={{
                fontSize: 9, fontWeight: 700, color: 'var(--accent)',
                fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {tFormat('live.guitar-section', { guitar: guitarLabel }, 'Sur ta {guitar}')}
            </div>
            <div
              style={{
                // Phase 7.55.7 — cap poussé à 26px pour lecture scène iPad
                fontSize: 'clamp(15px, 2.8vw, 26px)',
                fontWeight: 700, color: 'var(--text-bright)',
                lineHeight: 1.4,
                display: 'flex', flexWrap: 'wrap',
                gap: '4px 14px', alignItems: 'baseline',
              }}
            >
              {pickupLoc && <span>{pickupLoc}</span>}
              {guitar_volume && (
                <span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{t('live.volume', 'Volume')}</span>{' '}
                  <b>{guitar_volume}</b>
                </span>
              )}
              {guitar_tone && (
                <span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{t('live.tone', 'Tone')}</span>{' '}
                  <b>{guitar_tone}</b>
                </span>
              )}
              {stereo === true && (
                <span
                  style={{
                    fontSize: 10, fontWeight: 800, color: 'var(--brass-300)',
                    background: 'rgba(218,165,32,0.15)',
                    border: '1px solid rgba(218,165,32,0.4)',
                    borderRadius: 'var(--r-sm)',
                    padding: '2px 6px',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: 0.5,
                  }}
                >
                  STEREO
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Phase B/C — Section basse (instrument = basse) : basse idéale + jeu. */}
      {playCtx.instrument === 'bass' && aiC?.bass_recommendation && (() => {
        const br = aiC.bass_recommendation;
        const settingsBass = br.settings_bass ? getLocalizedText(br.settings_bass, liveLocale) : null;
        if (!br.ideal_bass && !settingsBass) return null;
        return (
          <div data-testid="live-screen-bass" style={{ background: 'var(--a3)', border: '1px solid var(--accent-border)', borderRadius: 'var(--r-lg)', padding: '12px 14px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('live.bass-section', 'Basse')}</div>
            {br.ideal_bass && <div style={{ fontSize: 'clamp(15px, 2.8vw, 26px)', fontWeight: 700, color: 'var(--text-bright)', lineHeight: 1.3 }}>{br.ideal_bass}</div>}
            {settingsBass && <div style={{ fontSize: 'clamp(12px, 1.8vw, 17px)', color: 'var(--text-sec)', lineHeight: 1.4 }}>{settingsBass}</div>}
          </div>
        );
      })()}

      {/* Phase B/C — Cadre "Sur ton ampli" (rig = Ampli) : potards 0-10 de
          l'ampli réel (guitar_amp_settings guitare OU bass amp_settings). */}
      {playCtx.rig === 'amp' && (() => {
        let settings = null; let ampName = null;
        if (playCtx.instrument === 'bass') {
          settings = aiC?.bass_recommendation?.amp_settings;
        } else {
          settings = aiC?.guitar_amp_settings?.settings;
          ampName = aiC?.guitar_amp_settings?.amp;
        }
        if (!settings || typeof settings !== 'object') return null;
        const entries = Object.entries(settings).filter(([, v]) => v != null);
        if (entries.length === 0) return null;
        return (
          <div data-testid="live-screen-amp" style={{ background: 'var(--a3)', border: '1px solid var(--accent-border)', borderRadius: 'var(--r-lg)', padding: '12px 14px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('live.amp-section', 'Sur ton ampli')}{ampName ? ' · ' + ampName : ''}</div>
            <div style={{ fontSize: 'clamp(14px, 2.4vw, 22px)', fontWeight: 700, color: 'var(--text-bright)', lineHeight: 1.4, display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontFamily: 'var(--font-mono)' }}>
              {entries.map(([k, v]) => (
                <span key={k}><span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase' }}>{k.replace(/_/g, ' ')}</span> <b>{v}</b></span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Phase C — Cadre "Sur ton pédalier" (rig = Ampli, guitare). */}
      {playCtx.rig === 'amp' && playCtx.instrument === 'guitar' && Array.isArray(aiC?.pedalboard_settings) && aiC.pedalboard_settings.length > 0 && (
        <div data-testid="live-screen-pedalboard" style={{ background: 'var(--a3)', border: '1px solid var(--accent-border)', borderRadius: 'var(--r-lg)', padding: '12px 14px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('live.pedalboard-section', 'Sur ton pédalier')}</div>
          {aiC.pedalboard_settings.map((p, i) => {
            const entries = p.settings && typeof p.settings === 'object' ? Object.entries(p.settings).filter(([, v]) => v != null) : [];
            return (
              <div key={i} style={{ fontSize: 'clamp(13px, 2vw, 19px)', color: 'var(--text-bright)', lineHeight: 1.4 }}>
                <b>{p.pedal}</b>
                {entries.length > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(11px, 1.5vw, 15px)', color: 'var(--text-sec)' }}>{entries.map(([k, v]) => ` · ${k.replace(/_/g, ' ')} ${v}`).join('')}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Devices — 1 LiveBlock par device activé */}
      <div
        style={{
          flex: 1,
          display: 'flex', flexDirection: 'column', gap: 12,
          marginBottom: 12,
        }}
        data-testid="live-screen-devices"
      >
        {devices.filter((d) => {
          // Phase B/C — gate les LiveBlocks device par le rig du contexte de jeu.
          // ToneX (deviceKey ann/plug) → rig tonex ; TMP → rig tmp ; rig amp →
          // aucun device (les cadres ampli/pédalier prennent le relais).
          const isToneX = d.deviceKey === 'ann' || d.deviceKey === 'plug';
          const isTmp = d.id === 'tonemaster-pro' || typeof d.RecommendBlock === 'function';
          if (isToneX) return playCtx.rig === 'tonex';
          if (isTmp) return playCtx.rig === 'tmp';
          return true;
        }).map((d) => {
          if (typeof d.LiveBlock === 'function') {
            const Comp = d.LiveBlock;
            return (
              <Comp
                key={d.id}
                song={song}
                guitar={guitar}
                profile={profile}
                allGuitars={allGuitars}
                banksAnn={banksAnn}
                banksPlug={banksPlug}
                availableSources={availableSources}
                onPatchOverride={onTmpPatchOverride}
              />
            );
          }
          return (
            <div
              key={d.id}
              data-testid={`live-screen-fallback-${d.id}`}
              style={{
                background: 'var(--a3)',
                border: '1px solid var(--a8)',
                borderRadius: 'var(--r-lg)',
                padding: '12px 16px',
                fontSize: 12, color: 'var(--text-muted)',
                fontStyle: 'italic',
              }}
            >
              <span style={{ marginRight: 6, display: 'inline-flex', verticalAlign: 'middle' }}><NavIcon id={d.iconId || 'amp'} size={14}/></span>
              {tFormat('live.no-live-mode', { label: d.label }, '{label} — pas de mode live disponible.')}
            </div>
          );
        })}
      </div>

      {/* Footer nav — boutons prev/next */}
      <div
        style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
          paddingTop: 8,
          borderTop: '1px solid var(--a6)',
        }}
      >
        <button
          type="button"
          data-testid="live-screen-prev"
          onClick={goPrev}
          disabled={index === 0}
          style={{
            background: index === 0 ? 'var(--a4)' : 'var(--a5)',
            border: '1px solid var(--a8)',
            borderRadius: 'var(--r-md)',
            padding: '14px',
            fontSize: 16, fontWeight: 700,
            cursor: index === 0 ? 'default' : 'pointer',
            color: index === 0 ? 'var(--text-dim)' : 'var(--text-bright)',
          }}
        >
          {t('live.previous', '← Précédent')}
        </button>
        <button
          type="button"
          data-testid="live-screen-next"
          onClick={goNext}
          disabled={index >= total - 1}
          style={{
            background: index >= total - 1 ? 'var(--a4)' : 'var(--a5)',
            border: '1px solid var(--a8)',
            borderRadius: 'var(--r-md)',
            padding: '14px',
            fontSize: 16, fontWeight: 700,
            cursor: index >= total - 1 ? 'default' : 'pointer',
            color: index >= total - 1 ? 'var(--text-dim)' : 'var(--text-bright)',
          }}
        >
          {t('live.next', 'Suivant →')}
        </button>
      </div>
    </div>
  );
}

export default LiveScreen;
export { useWakeLock };

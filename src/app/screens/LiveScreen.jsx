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
import { getSongInfo, SONG_HISTORY } from '../../core/songs.js';

const SWIPE_MIN_DISTANCE = 50; // px
const SWIPE_MAX_VERTICAL = 80; // px (ignore si swipe trop vertical)

function useWakeLock(enabled) {
  const lockRef = useRef(null);
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
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
      if (lockRef.current) {
        try { lockRef.current.release(); } catch (_e) { /* ignore */ }
        lockRef.current = null;
      }
    };
  }, [enabled]);
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

  useWakeLock(true);

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
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎤</div>
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
          ← Sortir
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
        padding: '12px 16px 16px',
        overflowY: 'auto',
      }}
    >
      {/* Header — bouton sortir + compteur */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <button
          type="button"
          data-testid="live-screen-exit"
          onClick={onExit}
          style={{
            background: 'var(--a5)', border: '1px solid var(--a8)',
            borderRadius: 'var(--r-md)', padding: '6px 12px',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            color: 'var(--text-bright)',
          }}
        >
          ← Sortir
        </button>
        <div
          style={{
            fontFamily: 'var(--font-mono)', fontWeight: 700,
            fontSize: 13, color: 'var(--text-muted)',
          }}
        >
          {index + 1} / {total}
        </div>
      </div>

      {/* Title block — gros titre + BPM/key + history */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px, 6vw, 48px)',
            fontWeight: 800, lineHeight: 1.05,
            color: 'var(--text-primary)',
            marginBottom: 4,
          }}
          data-testid="live-screen-title"
        >
          {song?.title || '—'}
        </div>
        <div
          style={{
            fontSize: 'clamp(14px, 2.5vw, 18px)',
            color: 'var(--text-sec)', marginBottom: 6,
          }}
        >
          {song?.artist || ''}
        </div>
        {(info?.bpm || info?.key) && (
          <div
            data-testid="live-screen-bpm-key"
            style={{
              display: 'flex', gap: 12, alignItems: 'center',
              fontSize: 'clamp(13px, 2vw, 16px)',
              color: 'var(--text-muted)',
              marginBottom: 6,
            }}
          >
            {info.bpm && (
              <span>
                <b style={{ color: 'var(--text-bright)' }}>{info.bpm}</b> BPM
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
              fontSize: 11, color: 'var(--text-tertiary)',
              fontStyle: 'italic', lineHeight: 1.5,
            }}
          >
            {hist.guitarist} · 🎸 {hist.guitar} · 🔊 {hist.amp}
          </div>
        )}
      </div>

      {/* Devices — 1 LiveBlock par device activé */}
      <div
        style={{
          flex: 1,
          display: 'flex', flexDirection: 'column', gap: 12,
          marginBottom: 12,
        }}
        data-testid="live-screen-devices"
      >
        {devices.map((d) => {
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
              <span style={{ marginRight: 6 }}>{d.icon}</span>
              {d.label} — pas de mode live disponible.
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
          ← Précédent
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
          Suivant →
        </button>
      </div>
    </div>
  );
}

export default LiveScreen;
export { useWakeLock };

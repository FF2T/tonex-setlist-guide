// src/app/components/DemoBanner.jsx — Phase 7.51.3 + 7.55.5.
//
// Bandeau persistant affiché en haut de tous les écrans en mode démo,
// SAUF LiveScreen (mode scène plein écran où le clutter UI doit être
// minimal — la nature démo y est implicite vu que rien ne se sauvegarde).
//
// Non dismissible : le visiteur doit garder en permanence le contexte
// "mode démo" pour comprendre que les actions de write sont bloquées
// (cf. ToastDemoBlocked Phase 7.51.2).
//
// Phase 7.55.5 — Lien Tally qualif au lieu de mailto (target='_blank').
// Pré-rempli avec source=demo_banner pour distinguer les demandes depuis
// le mode démo des autres canaux (futur Phase 7.44 formulaire public).
// Fallback automatique sur mailto si TALLY_DEMO_REQUEST_URL pas encore
// configuré côté branding.js.

import React from 'react';
import { t, useLocale, getLocale } from '../../i18n/index.js';
import { buildDemoRequestUrl } from '../../core/branding.js';

function DemoBanner({ onExit }) {
  useLocale(); // re-render au switch de langue
  const text = t('demo.banner-text', 'Tu testes Backline en mode démo.');
  const linkLabel = t('demo.banner-link', 'Pour avoir ton propre profil avec ton matériel, demande un accès');
  const exitLabel = t('demo.banner-exit', 'Quitter');

  // Phase 7.55-B — Sortie explicite : reload sans ?demo=1 + (optionnel)
  // clear sessionStorage du flag mode démo. Restaure ProfilePicker pour
  // que le visiteur choisisse un autre profil ou s'en aille.
  const handleExit = (e) => {
    e.preventDefault();
    if (typeof onExit === 'function') {
      onExit();
      return;
    }
    // Fallback : reload propre sans paramètres
    try { sessionStorage.removeItem('tonex_active_profile'); } catch {}
    const url = new URL(window.location.href);
    url.searchParams.delete('demo');
    window.location.href = url.toString();
  };

  return (
    <div
      role="banner"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'linear-gradient(90deg, var(--brass-100) 0%, var(--brass-200) 100%)',
        color: 'var(--tolex-900)',
        padding: '8px 16px',
        fontSize: 12,
        fontWeight: 600,
        textAlign: 'center',
        borderBottom: '1px solid var(--brass-400)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        lineHeight: 1.4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        flexWrap: 'wrap',
      }}
    >
      <span aria-hidden="true">🎸</span>
      <span>{text}</span>
      <span style={{ opacity: 0.6 }}>·</span>
      <a
        href={buildDemoRequestUrl({ source: 'demo_banner', locale: getLocale() })}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: 'var(--tolex-900)',
          textDecoration: 'underline',
          fontWeight: 700,
        }}
      >{linkLabel}</a>
      <button
        type="button"
        onClick={handleExit}
        // Phase 7.55.7 fix Cowork — cible touch 36px (vs 21px)
        style={{
          marginLeft: 'auto',
          background: 'rgba(0,0,0,0.08)',
          border: '1px solid var(--brass-400)',
          color: 'var(--tolex-900)',
          padding: '7px 14px',
          minHeight: 36,
          borderRadius: 'var(--r-sm, 6px)',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
        }}
        title={t('demo.banner-exit-title', 'Sortir du mode démo')}
      >✕ {exitLabel}</button>
    </div>
  );
}

export default DemoBanner;
export { DemoBanner };

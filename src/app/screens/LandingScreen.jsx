// src/app/screens/LandingScreen.jsx — Phase 7.60.
//
// Landing publique servie aux first-time visitors (aucun trusted device
// sur cet appareil et pas de session active). Hero pitch + 3 features
// statiques + 2 CTAs (mode démo + demande accès beta via Tally) + lien
// discret "J'ai déjà un compte" → ProfilePickerScreen legacy.
//
// MVP V1 : 3 features illustrées par cards statiques (emoji + texte).
// V2 prévue : remplacement par GIF/MP4 enregistrés via OBS sur la démo
// curée.
//
// Pour Sébastien admin et les autres profils déjà trusted sur leurs
// devices, cet écran n'apparaît JAMAIS (`Object.keys(loadTrusted())
// .length > 0` → comportement legacy direct sur ProfilePicker).

import React, { useEffect } from 'react';
import { t, useLocale } from '../../i18n/index.js';
import { APP_NAME, TALLY_FORM_ID_BY_LOCALE } from '../../core/branding.js';
import BacklineIcon from '../components/BacklineIcon.jsx';

// Formulaire Tally "demande accès beta" — affiché en popup modale
// par-dessus la landing via le script embed officiel Tally. Le script
// est chargé paresseusement au mount de LandingScreen (donc jamais pour
// les profils trusted qui ne voient pas cette page).
//
// Phase 7.60.1 — un formulaire par locale (FR + EN). Si la locale
// courante n'a pas de form mappé, fallback FR (Sébastien comprend
// les 3 langues côté réponse, donc pas critique).
// ES suit FR pour l'instant (les hispanophones bilingues FR sont
// rares, basculer sur EN serait pire). Si demande explicite, ajouter
// un form ES et un mapping ici.
//
// Pour switcher sur un simple lien externe target="_blank" (zéro JS
// externe, mais sortie de mybackline.app), remplacer le <button
// data-tally-open=...> par <a href={`https://tally.so/r/${formId}`}
// target="_blank" rel="noopener noreferrer"> et retirer le useEffect
// d'injection du script.
//
// Phase 7.55.5 — TALLY_FORM_ID_BY_LOCALE centralisé dans core/branding.js
// pour partager avec DemoBanner. Import en tête du fichier.
const TALLY_EMBED_SRC = 'https://tally.so/widgets/embed.js';

function FeatureCard({ icon, title, body }) {
  return (
    <div style={{
      background: 'var(--a4)',
      border: '1px solid var(--a10)',
      borderRadius: 'var(--r-xl)',
      padding: '20px 16px',
      textAlign: 'left',
    }}>
      <div style={{ fontSize: 28, marginBottom: 10 }} aria-hidden="true">{icon}</div>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 14,
        fontWeight: 800,
        color: 'var(--text-primary)',
        marginBottom: 6,
      }}>{title}</div>
      <div style={{
        fontSize: 13,
        color: 'var(--text-sec)',
        lineHeight: 1.45,
      }}>{body}</div>
    </div>
  );
}

function LandingScreen({ onDemoEnter, onShowPicker, appVersion }) {
  const locale = useLocale(); // re-render au switch de langue
  const tallyFormId = TALLY_FORM_ID_BY_LOCALE[locale] || TALLY_FORM_ID_BY_LOCALE.fr;

  // Charge le script Tally embed au mount (une seule fois). Si le script
  // est déjà présent (navigation interne, hot reload), on no-op. Tally
  // attache son listener global qui scanne les boutons [data-tally-open].
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.querySelector(`script[src="${TALLY_EMBED_SRC}"]`)) return;
    const s = document.createElement('script');
    s.src = TALLY_EMBED_SRC;
    s.async = true;
    document.body.appendChild(s);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '40px 20px 24px',
      boxSizing: 'border-box',
    }}>
      {/* Hero */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <BacklineIcon size={64} color="var(--brass-300)" />
      </div>
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'clamp(26px, 6vw, 40px)',
        fontWeight: 800,
        color: 'var(--text-primary)',
        margin: 0,
        textAlign: 'center',
        letterSpacing: '-0.01em',
        lineHeight: 1.15,
      }}>{t('landing.h1', `${APP_NAME} — le copilote de ta ToneX`)}</h1>
      <p style={{
        fontSize: 'clamp(14px, 2.5vw, 17px)',
        color: 'var(--text-sec)',
        marginTop: 14,
        marginBottom: 32,
        textAlign: 'center',
        maxWidth: 640,
        lineHeight: 1.5,
      }}>{t('landing.subtitle', "Quel preset, quelle guitare, quels réglages — pour chaque morceau. L'IA fait le tri dans tes packs.")}</p>

      {/* Features (3 cards) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 14,
        width: '100%',
        maxWidth: 880,
        marginBottom: 36,
      }}>
        <FeatureCard
          icon="🔍"
          title={t('landing.feature-1-title', 'Tu cherches un morceau')}
          body={t('landing.feature-1-body', "Tape le titre. L'IA identifie le rig original (guitariste, ampli, pédales d'époque).")}
        />
        <FeatureCard
          icon="🎯"
          title={t('landing.feature-2-title', "L'IA propose une reco")}
          body={t('landing.feature-2-body', 'Le bon preset dans tes banks (numéro + slot A/B/C), la bonne guitare de ton rig.')}
        />
        <FeatureCard
          icon="🎛️"
          title={t('landing.feature-3-title', 'Tu joues, elle assiste')}
          body={t('landing.feature-3-body', "Conseils de jeu, choix de micro, ajustements de tone. Mode scène plein écran.")}
        />
      </div>

      {/* CTAs */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        maxWidth: 400,
        marginBottom: 24,
      }}>
        <button
          onClick={onDemoEnter}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, var(--brass-200) 0%, var(--copper-400) 100%)',
            border: '2px solid var(--brass-400)',
            color: 'var(--tolex-900)',
            padding: '14px 20px',
            borderRadius: 'var(--r-xl)',
            fontSize: 15,
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: 'var(--shadow-md)',
          }}
        >{t('landing.cta-demo', '🎸 Essayer en mode démo (sans compte)')}</button>
        <button
          type="button"
          data-tally-open={tallyFormId}
          data-tally-layout="modal"
          data-tally-width="500"
          data-tally-emoji-text="🎸"
          data-tally-emoji-animation="wave"
          style={{
            width: '100%',
            background: 'var(--a4)',
            border: '1px solid var(--a15)',
            color: 'var(--text-primary)',
            padding: '13px 20px',
            borderRadius: 'var(--r-xl)',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            textAlign: 'center',
            boxSizing: 'border-box',
          }}
        >{t('landing.cta-beta', '✉️ Demander un accès beta')}</button>
        <button
          onClick={onShowPicker}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-sec)',
            fontSize: 12,
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: 8,
            marginTop: 4,
          }}
        >{t('landing.has-account', "J'ai déjà un compte")}</button>
      </div>

      {/* Footer micro */}
      <div style={{
        marginTop: 'auto',
        paddingTop: 32,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
      }}>
        <a
          href="mailto:contact@mybackline.app?subject=Backline%20pour%20studios%20de%20captures"
          style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            textDecoration: 'underline',
          }}
        >{t('landing.studios-link', 'Vous éditez des packs ? Contactez-nous')}</a>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>v{appVersion}</span>
      </div>
    </div>
  );
}

export default LandingScreen;
export { LandingScreen };

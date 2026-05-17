// src/app/screens/ThanksScreen.jsx — Phase 7.60.
//
// Page de remerciement affichée après soumission du formulaire Tally
// "demande accès beta". Tally redirige vers https://mybackline.app/?thanks=1
// après submit ; main.jsx détecte le param au boot, set `_thanksRequested`,
// l'auto-login useEffect bascule sur screen='thanks' et nettoie l'URL.
//
// Le visiteur n'est PAS automatiquement remis sur la landing : il doit
// cliquer explicitement (bouton "Retour à l'accueil") OU lancer la démo
// pour patienter en attendant que Sébastien lui crée son profil.
//
// Trilingue FR/EN/ES via i18n.

import React from 'react';
import { t, useLocale } from '../../i18n/index.js';
import BacklineIcon from '../components/BacklineIcon.jsx';

function ThanksScreen({ onDemoEnter, onBackHome, appVersion }) {
  useLocale();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px 24px',
      boxSizing: 'border-box',
      textAlign: 'center',
    }}>
      {/* Icône check + titre */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <BacklineIcon size={64} color="var(--brass-300)" />
      </div>
      <div style={{
        fontSize: 48,
        marginBottom: 8,
        lineHeight: 1,
      }} aria-hidden="true">🎸</div>
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'clamp(28px, 5vw, 36px)',
        fontWeight: 800,
        color: 'var(--text-primary)',
        margin: '0 0 16px',
        letterSpacing: '-0.01em',
      }}>{t('thanks.h1', 'Merci !')}</h1>

      <p style={{
        fontSize: 'clamp(14px, 2.5vw, 17px)',
        color: 'var(--text-sec)',
        margin: '0 auto 14px',
        maxWidth: 560,
        lineHeight: 1.5,
      }}>{t('thanks.body-main', 'Nous allons te créer un profil Backline pré-configuré avec tes guitares et ta setlist. Tu recevras tes identifiants par email sous 48h.')}</p>

      <p style={{
        fontSize: 13,
        color: 'var(--text-muted)',
        margin: '0 auto 36px',
        maxWidth: 540,
        lineHeight: 1.5,
        fontStyle: 'italic',
      }}>{t('thanks.body-spam', "Rien reçu d'ici 3 jours ? Jette un œil dans tes spams, ou réponds à un de mes posts Reddit.")}</p>

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
        >{t('thanks.cta-demo', '🎸 Tester la démo en attendant')}</button>
        <button
          onClick={onBackHome}
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
        >{t('thanks.cta-back', "Retour à l'accueil")}</button>
      </div>

      <div style={{
        marginTop: 'auto',
        paddingTop: 24,
      }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>v{appVersion}</span>
      </div>
    </div>
  );
}

export default ThanksScreen;
export { ThanksScreen };

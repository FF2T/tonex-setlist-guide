// src/app/components/AIErrorPanel.jsx — Phase 7.55.7 S7.
//
// Panneau d'affichage stylé pour les erreurs IA (Gemini / Anthropic).
// Utilise getAIErrorMessage() pour classifier + message trilingue,
// et tokens.js (TYPO, TEXT, BG) pour la charte Backline.
//
// Layout :
//   ┌─────────────────────────────────────────┐
//   │ {icon}  {TITLE en uppercase mono}       │
//   │ {body — 1-2 phrases}                    │
//   │ ─────                                    │
//   │ • {hint 1}                              │
//   │ • {hint 2}                              │
//   │ [En savoir plus →]   ▾ Détails technique│
//   │ (rawMessage caché, révélé sur expand)   │
//   └─────────────────────────────────────────┘
//
// Style sémantique error : border-left rouge accent, fond léger.

import React, { useState } from 'react';
import { getAIErrorMessage } from '../utils/ai-error-helper.js';
import { useLocale, getLocale, t } from '../../i18n/index.js';
import { TYPO, WEIGHT, TEXT_1, TEXT_2, TEXT_3 } from '../styles/tokens.js';

function AIErrorPanel({ error, compact = false }) {
  useLocale(); // re-render au switch de langue
  const [showDetails, setShowDetails] = useState(false);
  if (!error) return null;

  const info = getAIErrorMessage(error, getLocale());

  // Container : style "alerte" Backline avec accent rouge à gauche.
  const containerStyle = {
    background: 'var(--red-bg)',
    border: '1px solid var(--red-border)',
    borderLeft: '3px solid var(--red)',
    borderRadius: 'var(--r-md)',
    padding: compact ? '8px 10px' : '12px 14px',
    marginTop: 8,
    marginBottom: 8,
    fontSize: TYPO.body,
    color: TEXT_1,
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    fontSize: TYPO.body,
    fontWeight: WEIGHT.bold,
    color: TEXT_1,
  };

  const bodyStyle = {
    fontSize: compact ? TYPO.meta : TYPO.body,
    color: TEXT_2,
    lineHeight: 1.5,
    marginBottom: info.hints && info.hints.length > 0 ? 8 : 0,
  };

  const hintStyle = {
    fontSize: TYPO.meta,
    color: TEXT_2,
    lineHeight: 1.4,
    marginBottom: 3,
    paddingLeft: 14,
    position: 'relative',
  };

  const learnMoreStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: TYPO.meta,
    color: 'var(--accent)',
    textDecoration: 'underline',
    marginTop: 6,
    marginRight: 12,
  };

  const detailsToggleStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: TYPO.micro,
    color: TEXT_3,
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    marginTop: 6,
    textDecoration: 'underline dotted',
  };

  const rawStyle = {
    marginTop: 6,
    padding: 8,
    background: 'var(--bg-elev-1)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-sm)',
    fontFamily: 'var(--font-mono)',
    fontSize: TYPO.micro,
    color: TEXT_3,
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
    maxHeight: 160,
    overflow: 'auto',
  };

  return (
    <div role="alert" style={containerStyle} data-ai-error-kind={info.kind}>
      <div style={headerStyle}>
        <span aria-hidden="true" style={{ fontSize: TYPO.emph }}>{info.icon}</span>
        <span>{info.title}</span>
      </div>
      <div style={bodyStyle}>{info.body}</div>
      {info.hints && info.hints.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {info.hints.map((hint, i) => (
            <li key={i} style={hintStyle}>
              <span style={{ position: 'absolute', left: 0, color: 'var(--accent)' }}>•</span>
              {hint}
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        {info.learnMoreUrl && (
          <a
            href={info.learnMoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={learnMoreStyle}
          >
            {info.learnMoreLabel || t('ai-error.learn-more', 'En savoir plus')} →
          </a>
        )}
        {info.rawMessage && (
          <button
            type="button"
            onClick={() => setShowDetails((p) => !p)}
            style={detailsToggleStyle}
            aria-expanded={showDetails}
          >
            {showDetails
              ? t('ai-error.hide-details', '▴ Masquer le détail technique')
              : t('ai-error.show-details', '▾ Détail technique')}
          </button>
        )}
      </div>
      {showDetails && info.rawMessage && (
        <div style={rawStyle}>{info.rawMessage}</div>
      )}
    </div>
  );
}

export default AIErrorPanel;
export { AIErrorPanel };

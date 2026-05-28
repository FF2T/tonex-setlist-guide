// src/app/components/GuitarSelect.jsx — Phase 7.14 (découpage main.jsx).
//
// Composant <select> de guitare avec indicateur d'optimalité :
// - Si la valeur sélectionnée est dans `ig` (top picks IA) → bordure
//   verte + message "✓ Choix optimal".
// - Si une autre guitare que les top picks est choisie → bordure jaune
//   + message "⚠️ Idéalement : <noms des top picks>".
// - Sinon bordure neutre.
//
// Utilisé par RecapScreen, SongDetailCard, etc. — partout où l'utilisateur
// peut choisir une guitare pour un contexte précis (un morceau, une
// session).

import React from 'react';
import { GUITARS } from '../../core/guitars.js';
import { t, tFormat, useLocale } from '../../i18n/index.js';

// Phase 7.83 résidu cleanup (2026-05-27) — prop `hideStatusText` permet
// au caller de gérer lui-même les messages "Choix optimal" / "Idéalement"
// (cas SongDetailCard qui les remplace par un pill bucket Phase 7.83 +
// suggestion alternatives unifiés sous le select). Default false →
// comportement legacy préservé pour les autres call sites (RecapScreen).
// Phase vague B (2026-05-28) — prop `plain` : style sobre homogène avec la
// liste déroulante basse (bordure neutre, fontSize clamp responsive,
// fontWeight 600, pas de variation verte/jaune de bordure). Activé par
// SongDetailCard "Ma guitare" (le score s'affiche déjà en pill bucket à
// côté + le warning "Idéalement" est géré par le caller). RecapScreen garde
// le style legacy (plain=false) avec bordure verte/jaune + status text.
function GuitarSelect({ value, onChange, ig = [], guitars = GUITARS, hideStatusText = false, plain = false }) {
  useLocale();
  const g = guitars.find((x) => x.id === value);
  const ideal = value && ig.includes(value);
  const warn = value && ig.length > 0 && !ideal;
  const selectStyle = plain
    ? {
        width: '100%',
        background: 'var(--bg-card)',
        color: 'var(--text)',
        border: '1px solid var(--a15)',
        borderRadius: 'var(--r-md)',
        padding: '8px 10px',
        fontSize: 'clamp(12px, 1.35vw, 14px)',
        fontWeight: 600,
        cursor: 'pointer',
      }
    : {
        width: '100%',
        background: 'var(--bg-card)',
        color: 'var(--text)',
        border: `1px solid ${ideal ? 'rgba(74,222,128,0.5)' : warn ? 'rgba(251,191,36,0.5)' : 'var(--a15)'}`,
        borderRadius: 'var(--r-md)',
        padding: '8px 10px',
        fontSize: 13,
        cursor: 'pointer',
        marginBottom: 4,
      };
  return (
    <div>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={selectStyle}
      >
        <option value="">{t('guitar-select.placeholder', '— Choisir une guitare —')}</option>
        {guitars.map((x) => (
          <option key={x.id} value={x.id}>{ig.includes(x.id) ? '★ ' : ''}{x.name}</option>
        ))}
      </select>
      {!hideStatusText && ideal && <div style={{ fontSize: 11, color: 'var(--green)' }}>{t('guitar-select.ideal', '✓ Choix optimal')}</div>}
      {!hideStatusText && warn && g && (
        <div style={{ fontSize: 11, color: 'var(--yellow)' }}>
          {tFormat('guitar-select.warn', { list: ig.map((i) => guitars.find((x) => x.id === i)?.short || GUITARS.find((x) => x.id === i)?.short).filter(Boolean).join(', ') }, '⚠️ Idéalement : {list}')}
        </div>
      )}
    </div>
  );
}

export default GuitarSelect;
export { GuitarSelect };

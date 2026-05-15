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

function GuitarSelect({ value, onChange, ig = [], guitars = GUITARS }) {
  useLocale();
  const g = guitars.find((x) => x.id === value);
  const ideal = value && ig.includes(value);
  const warn = value && ig.length > 0 && !ideal;
  return (
    <div>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          background: 'var(--bg-card)',
          color: 'var(--text)',
          border: `1px solid ${ideal ? 'rgba(74,222,128,0.5)' : warn ? 'rgba(251,191,36,0.5)' : 'var(--a15)'}`,
          borderRadius: 'var(--r-md)',
          padding: '8px 10px',
          fontSize: 13,
          cursor: 'pointer',
          marginBottom: 4,
        }}
      >
        <option value="">{t('guitar-select.placeholder', '— Choisir une guitare —')}</option>
        {guitars.map((x) => (
          <option key={x.id} value={x.id}>{ig.includes(x.id) ? '★ ' : ''}{x.name} ({x.type})</option>
        ))}
      </select>
      {ideal && <div style={{ fontSize: 11, color: 'var(--green)' }}>{t('guitar-select.ideal', '✓ Choix optimal')}</div>}
      {warn && g && (
        <div style={{ fontSize: 11, color: 'var(--yellow)' }}>
          {tFormat('guitar-select.warn', { list: ig.map((i) => guitars.find((x) => x.id === i)?.short || GUITARS.find((x) => x.id === i)?.short).filter(Boolean).join(', ') }, '⚠️ Idéalement : {list}')}
        </div>
      )}
    </div>
  );
}

export default GuitarSelect;
export { GuitarSelect };

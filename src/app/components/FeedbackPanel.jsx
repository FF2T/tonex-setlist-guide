// src/app/components/FeedbackPanel.jsx — Phase 7.14 (découpage main.jsx).
//
// Panneau de feedback IA : 6 tags rapides ("Son trop saturé", "Je veux
// un son Fender", etc.) + champ texte libre + boutons Relancer/Annuler.
// onSubmit(text) appelé au clic Relancer ou Enter. Utilisé par
// SongDetailCard pour affiner l'analyse IA. HomeScreen a sa propre UI
// inline (mêmes tags, layout adapté à sa card).
//
// Phase 7.37 (wrapping i18n) : tags rebuild à chaque render pour suivre
// la locale active.

import React, { useState } from 'react';
import { t } from '../../i18n/index.js';

const getFeedbackTags = () => [
  t('feedback.tag.too-saturated', 'Son trop saturé'),
  t('feedback.tag.too-clean', 'Son trop clean'),
  t('feedback.tag.wrong-amp', 'Mauvais style d\'ampli'),
  t('feedback.tag.fender', 'Je veux un son Fender'),
  t('feedback.tag.marshall', 'Je veux un son Marshall'),
  t('feedback.tag.bad-preset', 'Preset pas adapté au morceau'),
];

// Legacy export pour rétrocompat (HomeScreen / SongDetailCard tests).
// Statique en FR — la version dynamique est getFeedbackTags().
const FEEDBACK_TAGS = [
  'Son trop saturé',
  'Son trop clean',
  'Mauvais style d\'ampli',
  'Je veux un son Fender',
  'Je veux un son Marshall',
  'Preset pas adapté au morceau',
];

function FeedbackPanel({ onSubmit, onCancel }) {
  const [text, setText] = useState('');
  const tags = getFeedbackTags();
  return (
    <div style={{ background: 'var(--a4)', borderRadius: 'var(--r-md)', padding: 10, marginTop: 6 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
        {t('feedback.question', "Qu'est-ce qui ne va pas ?")} <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{t('feedback.optional', '(optionnel)')}</span>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
        {tags.map((s) => (
          <button key={s} onClick={() => setText((p) => p ? p + ', ' + s : s)} style={{ fontSize: 9, background: text.includes(s) ? 'var(--accent)' : 'var(--a6)', color: text.includes(s) ? 'var(--text-inverse)' : 'var(--text-sec)', border: '1px solid var(--a10)', borderRadius: 'var(--r-sm)', padding: '3px 7px', cursor: 'pointer' }}>{s}</button>
        ))}
      </div>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('feedback.placeholder', 'Ex: je cherche un son plus clean, type Fender...')} style={{ width: '100%', fontSize: 11, background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a10)', borderRadius: 'var(--r-md)', padding: '6px 8px', marginBottom: 6, boxSizing: 'border-box' }} onKeyDown={(e) => e.key === 'Enter' && onSubmit(text)}/>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => onSubmit(text)} style={{ fontSize: 11, background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '5px 12px', cursor: 'pointer', fontWeight: 600 }}>{t('feedback.rerun', '🔄 Relancer')}</button>
        <button onClick={onCancel} style={{ fontSize: 11, background: 'none', border: '1px solid var(--a10)', color: 'var(--text-muted)', borderRadius: 'var(--r-md)', padding: '5px 12px', cursor: 'pointer' }}>{t('feedback.cancel', 'Annuler')}</button>
      </div>
    </div>
  );
}

export default FeedbackPanel;
export { FeedbackPanel, FEEDBACK_TAGS, getFeedbackTags };

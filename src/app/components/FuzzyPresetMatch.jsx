// src/app/components/FuzzyPresetMatch.jsx — Phase 7.18 (découpage main.jsx).
//
// Affichage de suggestions approchantes pour un preset dont le nom
// saisi ne matche pas le catalogue. Co-localise le helper `fuzzyMatch`
// (scoring par mots) utilisé uniquement par ce composant.

import React, { useMemo } from 'react';
import { t } from '../../i18n/index.js';
import { PRESET_CATALOG_MERGED, normalizePresetName } from '../../core/catalog.js';
import { SOURCE_LABELS } from '../../core/sources.js';

function fuzzyMatch(query, catalog) {
  const norm = normalizePresetName(query);
  const words = norm.split(' ').filter((w) => w.length > 1);
  return Object.entries(catalog).map(([name, info]) => {
    const nn = normalizePresetName(name);
    let score = 0;
    words.forEach((w) => { if (nn.includes(w)) score += w.length; });
    if (nn.startsWith(words[0] || '')) score += 5;
    return { name, info, score };
  }).filter((r) => r.score > 3).sort((a, b) => b.score - a.score).slice(0, 5);
}

function FuzzyPresetMatch({ name, bank, slot, onAccept, onSearch, onManual, onClose }) {
  const suggestions = useMemo(() => fuzzyMatch(name, PRESET_CATALOG_MERGED), [name]);
  return (
    <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{t('fuzzy.not-found', 'Preset non trouvé :')} <b style={{ color: 'var(--text)' }}>{name}</b></div>
      {suggestions.length > 0 && <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>{t('fuzzy.suggestions', 'Presets approchants :')}</div>
        {suggestions.map((s) => (
          <button key={s.name} onClick={() => onAccept(s.name)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: 'var(--r-md)', padding: '6px 8px', marginBottom: 3, cursor: 'pointer' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{s.name}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{s.info.amp} · {SOURCE_LABELS[s.info.src] || s.info.src}</div>
          </button>
        ))}
      </div>}
      {suggestions.length === 0 && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8 }}>{t('fuzzy.no-match', 'Aucun preset approchant trouvé.')}</div>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onSearch} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{t('fuzzy.search', 'Rechercher')}</button>
        <button onClick={onManual} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>{t('fuzzy.manual', 'Saisie manuelle')}</button>
        <button onClick={onClose} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>{t('fuzzy.close', 'Fermer')}</button>
      </div>
    </div>
  );
}

export default FuzzyPresetMatch;
export { FuzzyPresetMatch, fuzzyMatch };

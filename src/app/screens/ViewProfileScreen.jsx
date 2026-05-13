// src/app/screens/ViewProfileScreen.jsx — Phase 7.17 (découpage main.jsx).
//
// Écran lecture-seule de la config d'un autre profil (matériel,
// guitares, banques Pédale/Plug). Accédé via le sélecteur de profils
// dans le header quand on est en multi-profils.
//
// Phase 7.17 : fix d'un bug pré-existant pendant l'extraction. Les
// références `d.pedale`, `d.anniversary`, `d.plug` héritées de Phase 5
// Item E (drop `profile.devices`) n'ont jamais été migrées vers
// `enabled.has('tonex-X')` — crash silencieux si le screen était
// ouvert. Corrigé ici.

import React from 'react';
import { GUITARS } from '../../core/guitars.js';
import { CC } from '../utils/ui-constants.js';
import Breadcrumb from '../components/Breadcrumb.jsx';

function ViewProfileScreen({ profile, onBack, onNavigate }) {
  if (!profile) return null;
  const enabled = new Set(profile.enabledDevices || []);
  const hasPedalStd = enabled.has('tonex-pedal');
  const hasAnniversary = enabled.has('tonex-anniversary');
  const hasPedale = hasPedalStd || hasAnniversary;
  const hasPlug = enabled.has('tonex-plug');
  const edits = profile.editedGuitars || {};
  const guitars = GUITARS.filter((g) => (profile.myGuitars || []).includes(g.id)).map((g) => ({ ...g, ...(edits[g.id] || {}) }));
  const customG = profile.customGuitars || [];
  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Accueil', screen: 'list' }, { label: 'Config de ' + profile.name }]} onNavigate={onNavigate}/>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>👁 {profile.name}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Configuration en lecture seule</div>

      {/* Matériel */}
      <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Matériel</div>
        <div style={{ fontSize: 11, color: 'var(--text-sec)' }}>
          {hasPedalStd && !hasAnniversary && 'Pédale ToneX Standard'}
          {hasAnniversary && 'Pédale ToneX Anniversary'}
          {hasPedale && hasPlug && ' + '}{hasPlug && 'ToneX Plug'}
          {!hasPedale && !hasPlug && 'Aucun appareil configuré'}
        </div>
      </div>

      {/* Guitares */}
      <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Guitares ({guitars.length + customG.length})</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {guitars.map((g) => <span key={g.id} style={{ fontSize: 10, background: 'var(--a5)', borderRadius: 'var(--r-sm)', padding: '2px 8px', color: 'var(--text-sec)' }}>{g.short} ({g.type})</span>)}
          {customG.map((g) => <span key={g.id} style={{ fontSize: 10, background: 'var(--a6)', borderRadius: 'var(--r-sm)', padding: '2px 8px', color: 'var(--text-bright)' }}>{g.short} ({g.type})</span>)}
        </div>
      </div>

      {/* Banques Pédale */}
      {hasPedale && (
        <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Banques Pédale (50)</div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {Object.entries(profile.banksAnn || {}).sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, v]) => (
              v.A || v.B || v.C
                ? (
                  <div key={k} style={{ fontSize: 10, color: 'var(--text-sec)', marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-muted)', minWidth: 20, display: 'inline-block' }}>{k}</span>
                    <span style={{ color: CC.A }}>A:</span>{v.A || '—'} <span style={{ color: CC.B }}>B:</span>{v.B || '—'} <span style={{ color: CC.C }}>C:</span>{v.C || '—'}
                  </div>
                )
                : null
            ))}
          </div>
        </div>
      )}

      {/* Banques Plug */}
      {hasPlug && (
        <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Banques Plug (10)</div>
          {Object.entries(profile.banksPlug || {}).sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, v]) => (
            v.A || v.B || v.C
              ? (
                <div key={k} style={{ fontSize: 10, color: 'var(--text-sec)', marginBottom: 2 }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-muted)', minWidth: 20, display: 'inline-block' }}>{k}</span>
                  <span style={{ color: CC.A }}>A:</span>{v.A || '—'} <span style={{ color: CC.B }}>B:</span>{v.B || '—'} <span style={{ color: CC.C }}>C:</span>{v.C || '—'}
                </div>
              )
              : null
          ))}
        </div>
      )}

      <button onClick={onBack} style={{ width: '100%', background: 'var(--a5)', border: '1px solid var(--a10)', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '10px', fontSize: 13, cursor: 'pointer', marginTop: 8 }}>Retour</button>
    </div>
  );
}

export default ViewProfileScreen;
export { ViewProfileScreen };

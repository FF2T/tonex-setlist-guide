// src/app/screens/MesAppareilsTab.jsx — Phase 7.19 (découpage main.jsx).
//
// Onglet "📱 Mes appareils" dans MonProfilScreen. Lit le registry des
// devices (tonex-pedal, tonex-anniversary, tonex-plug, tonemaster-pro)
// et permet d'activer/désactiver chacun pour le profil courant. Le
// scoring/Recap n'affiche que les devices activés. Garde-fou : au
// moins un device doit rester coché.

import React from 'react';
import { getAllDevices } from '../../devices/registry.js';

function MesAppareilsTab({ profile, profiles, onProfiles, activeProfileId }) {
  const allDevices = getAllDevices();
  const enabled = new Set(profile.enabledDevices || []);
  const toggleDevice = (id) => {
    const next = new Set(enabled);
    if (next.has(id)) {
      if (next.size <= 1) return;
      next.delete(id);
    } else {
      next.add(id);
    }
    const arr = allDevices.filter((d) => next.has(d.id)).map((d) => d.id);
    onProfiles((p) => ({
      ...p,
      [activeProfileId]: {
        ...p[activeProfileId],
        enabledDevices: arr,
      },
    }));
  };
  return (
    <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Mes appareils audio</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>Coche les appareils que tu utilises. Les blocs Recap et Synthèse n'afficheront que ceux-ci. Au moins un appareil doit rester coché.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {allDevices.map((d) => {
          const on = enabled.has(d.id);
          return (
            <button
              key={d.id}
              onClick={() => toggleDevice(d.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: on ? 'var(--green-bg)' : 'var(--a3)',
                border: on ? '1px solid var(--green-border)' : '1px solid var(--a8)',
                borderRadius: 'var(--r-md)', padding: '12px 14px',
                cursor: 'pointer', textAlign: 'left', width: '100%',
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: 'var(--r-sm)',
                border: on ? '2px solid var(--green)' : '2px solid var(--text-muted)',
                background: on ? 'var(--green)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {on && <span style={{ color: 'var(--bg)', fontSize: 10, fontWeight: 900 }}>✓</span>}
              </div>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{d.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: on ? 'var(--text)' : 'var(--text-sec)' }}>{d.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{d.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default MesAppareilsTab;
export { MesAppareilsTab };

// src/devices/_shared/ToneXLiveBlock.jsx — Phase 4.
// Composant LiveBlock partagé entre tonex-pedal, tonex-anniversary et
// tonex-plug. Le device fournit sa metadata (label, icon, deviceColor,
// bankStorageKey, presetResultKey) ; on extrait le preset recommandé
// depuis aiC[presetResultKey] et la position dans les banks.
//
// Affichage :
// - Nom du preset recommandé en grand.
// - Position (Bank N, Slot X) en badge.
// - 3 cards A/B/C de la bank courante, slot recommandé surligné.
// - Texte d'aide : "Footswitch bank up/down sur ton {label} pour
//   changer de bank".
//
// Si pas de preset recommandé (aiCache absent) → message d'attente.
// Si preset trouvé mais pas localisable dans les banks (preset à
// installer) → message "non installé" + nom du preset.

import React from 'react';

// Cherche un preset par nom dans une structure { [bankNumber]: { A, B, C } }.
function findPresetLocation(name, banks) {
  if (!name || !banks) return null;
  for (const [k, bank] of Object.entries(banks)) {
    for (const slot of ['A', 'B', 'C']) {
      if (bank[slot] === name) return { bank: Number(k), slot, bankObj: bank };
    }
  }
  return null;
}

function makeToneXLiveBlock(device) {
  function ToneXLiveBlock({ song, _guitar, _profile, banksAnn, banksPlug }) {
    const banks = device.bankStorageKey === 'banksAnn' ? banksAnn : banksPlug;
    const aiC = song?.aiCache?.result;
    const presetData = aiC?.[device.presetResultKey];
    const presetName = presetData?.label || null;
    const score = presetData?.score || null;
    const loc = presetName ? findPresetLocation(presetName, banks) : null;
    const color = device.deviceColor || 'var(--accent)';
    const icon = device.icon;

    if (!presetName) {
      return (
        <div
          data-testid={`tonex-live-block-empty-${device.id}`}
          data-device-id={device.id}
          style={{
            background: 'var(--a3)',
            border: `1px solid ${color}30`,
            borderRadius: 'var(--r-lg)',
            padding: '14px 16px',
            color: 'var(--text-dim)',
            fontStyle: 'italic',
            display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <span style={{ fontSize: 22 }}>{icon}</span>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {device.label}
            </div>
            <div>Pas de preset déterminé pour ce morceau.</div>
          </div>
        </div>
      );
    }

    return (
      <div
        data-testid={`tonex-live-block-${device.id}`}
        data-device-id={device.id}
        data-preset-bank={loc?.bank ?? ''}
        data-preset-slot={loc?.slot ?? ''}
        style={{
          background: 'var(--a3)',
          border: `1px solid ${color}40`,
          borderRadius: 'var(--r-lg)',
          padding: '14px 16px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>{icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {device.label}
            </div>
            <div
              style={{
                fontSize: 22, fontWeight: 800, color: 'var(--text-bright)',
                fontFamily: 'var(--font-display)', lineHeight: 1.15,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {presetName}
            </div>
          </div>
          {loc && (
            <div
              data-testid={`tonex-live-position-${device.id}`}
              style={{
                fontFamily: 'var(--font-mono)', fontWeight: 800,
                fontSize: 18, color,
                background: `${color}18`, border: `1px solid ${color}40`,
                borderRadius: 'var(--r-md)', padding: '4px 10px',
                whiteSpace: 'nowrap',
              }}
            >
              Bank {loc.bank}{loc.slot}
            </div>
          )}
          {!loc && (
            <div
              data-testid={`tonex-live-not-installed-${device.id}`}
              style={{
                fontFamily: 'var(--font-mono)', fontWeight: 700,
                fontSize: 12, color: 'var(--yellow)',
                background: 'var(--yellow-bg)',
                border: '1px solid var(--yellow-border)',
                borderRadius: 'var(--r-md)', padding: '4px 10px',
              }}
            >
              non installé
            </div>
          )}
          {score && (
            <div
              style={{
                fontFamily: 'var(--font-mono)', fontWeight: 800,
                fontSize: 18, color,
              }}
            >
              {score}%
            </div>
          )}
        </div>

        {/* 3 slots A/B/C de la bank courante (si preset localisé) */}
        {loc && (
          <div data-testid={`tonex-live-slots-${device.id}`}>
            <div
              style={{
                fontSize: 9, color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
                letterSpacing: 0.5, marginBottom: 4,
              }}
            >
              Bank {loc.bank}
            </div>
            <div
              style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
              }}
            >
              {['A', 'B', 'C'].map((slot) => {
                const isReco = slot === loc.slot;
                const slotName = loc.bankObj?.[slot] || '—';
                return (
                  <div
                    key={slot}
                    data-testid={`tonex-live-slot-${device.id}-${slot}`}
                    data-active={isReco ? 'true' : 'false'}
                    style={{
                      background: isReco ? `${color}25` : 'var(--a5)',
                      border: `1px solid ${isReco ? color : 'var(--a8)'}`,
                      borderRadius: 'var(--r-md)',
                      padding: '8px 10px',
                      display: 'flex', flexDirection: 'column', gap: 2,
                      minHeight: 56,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)', fontWeight: 800,
                        fontSize: 14,
                        color: isReco ? color : 'var(--text-muted)',
                      }}
                    >
                      {slot}
                    </div>
                    <div
                      style={{
                        fontSize: 11, fontWeight: 600,
                        color: slotName === '—' ? 'var(--text-dim)' : 'var(--text-bright)',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {slotName}
                    </div>
                  </div>
                );
              })}
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 10, color: 'var(--text-muted)',
                fontStyle: 'italic',
              }}
            >
              Footswitch bank up/down sur ton {device.label} pour changer de bank.
            </div>
          </div>
        )}
      </div>
    );
  }
  ToneXLiveBlock.displayName = `ToneXLiveBlock(${device.id})`;
  return ToneXLiveBlock;
}

export default makeToneXLiveBlock;
export { findPresetLocation };

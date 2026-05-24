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
import { t, tFormat } from '../../i18n/index.js';

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
            <div>{t('tonex-live.no-preset', 'Pas de preset déterminé pour ce morceau.')}</div>
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

        {/* Phase 4.6 — Réglages pédale (Phase 9.1 preset_settings_v1).
            Affichage compact des 5 boutons principaux + 5 ALT + cab on/off.
            Skip silencieux si preset_settings_v1 absent (aiCache pré-9.1). */}
        {aiC?.preset_settings_v1 && typeof aiC.preset_settings_v1 === 'object' && (() => {
          const ps = aiC.preset_settings_v1;
          const main = ps.main || {};
          const alt = ps.alt || {};
          const getValue = (knob) => {
            if (typeof knob === 'number') return knob;
            if (knob && typeof knob === 'object' && typeof knob.value === 'number') return knob.value;
            return null;
          };
          const formatVal = (v, suffix) => v != null ? `${v}${suffix || ''}` : null;
          const mainEntries = [
            ['Gain', formatVal(getValue(main.gain))],
            ['Bass', formatVal(getValue(main.bass))],
            ['Mid', formatVal(getValue(main.mid))],
            ['Treble', formatVal(getValue(main.treble))],
            ['Volume', formatVal(getValue(main.volume))],
          ].filter(([, v]) => v != null);
          const altEntries = [
            ['Presence', formatVal(getValue(alt.presence))],
            ['Depth', formatVal(getValue(alt.depth))],
            ['Reverb mix', formatVal(getValue(alt.reverb_mix), '%')],
            ['Comp', formatVal(getValue(alt.comp_threshold), 'dB')],
            ['Gate', formatVal(getValue(alt.gate_threshold), 'dB')],
          ].filter(([, v]) => v != null);
          if (mainEntries.length === 0 && altEntries.length === 0) return null;
          const cabEnabled = ps.cab_enabled !== false;
          return (
            <div
              data-testid={`tonex-live-settings-${device.id}`}
              style={{
                background: 'var(--a5)', borderRadius: 'var(--r-md)',
                padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4,
              }}
            >
              <div
                style={{
                  fontSize: 9, color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  display: 'flex', justifyContent: 'space-between',
                }}
              >
                <span>🎛️ {t('live.pedal-settings', 'Réglages pédale')}</span>
                <span style={{ color: cabEnabled ? 'var(--green)' : 'var(--yellow)' }}>
                  CAB {cabEnabled ? 'ON' : 'OFF'}
                </span>
              </div>
              {mainEntries.length > 0 && (
                <div
                  style={{
                    fontSize: 'clamp(12px, 1.8vw, 14px)',
                    color: 'var(--text-bright)', lineHeight: 1.5,
                    display: 'flex', flexWrap: 'wrap', gap: '2px 12px',
                  }}
                >
                  {mainEntries.map(([label, val]) => (
                    <span key={label}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</span>{' '}
                      <b>{val}</b>
                    </span>
                  ))}
                </div>
              )}
              {altEntries.length > 0 && (
                <div
                  style={{
                    fontSize: 'clamp(11px, 1.6vw, 13px)',
                    color: 'var(--text-sec)', lineHeight: 1.5,
                    display: 'flex', flexWrap: 'wrap', gap: '2px 10px',
                  }}
                >
                  {altEntries.map(([label, val]) => (
                    <span key={label}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{label}</span>{' '}
                      {val}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Phase 4.6 — FX blocks (Phase 9.2 / 9.7).
            5 blocs ON/OFF compacts pour décision rapide en scène. Sub-params
            visibles seulement si bloc enabled, format court "Type · key value".
            Skip silencieux si fx_blocks absent. */}
        {aiC?.fx_blocks && typeof aiC.fx_blocks === 'object' && (() => {
          const fx = aiC.fx_blocks;
          const blockKeys = ['noise_gate', 'compressor', 'modulation', 'delay', 'reverb'];
          const blockLabels = {
            noise_gate: 'Gate',
            compressor: 'Comp',
            modulation: 'Mod',
            delay: 'Delay',
            reverb: 'Reverb',
          };
          const blocks = blockKeys
            .map((k) => ({ key: k, label: blockLabels[k], block: fx[k] }))
            .filter((b) => b.block && typeof b.block === 'object');
          if (blocks.length === 0) return null;
          return (
            <div
              data-testid={`tonex-live-fx-${device.id}`}
              style={{
                background: 'var(--a5)', borderRadius: 'var(--r-md)',
                padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4,
              }}
            >
              <div
                style={{
                  fontSize: 9, color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                🎚 {t('live.fx-section', 'Effets')}
              </div>
              <div
                style={{
                  fontSize: 'clamp(11px, 1.6vw, 13px)',
                  color: 'var(--text-bright)', lineHeight: 1.6,
                  display: 'flex', flexWrap: 'wrap', gap: '4px 14px',
                }}
              >
                {blocks.map(({ key, label, block }) => {
                  const on = block.enabled === true;
                  const typeStr = on && block.type ? ` · ${block.type}` : '';
                  return (
                    <span
                      key={key}
                      style={{
                        color: on ? 'var(--text-bright)' : 'var(--text-dim)',
                        fontWeight: on ? 700 : 500,
                      }}
                    >
                      {label}{' '}
                      <span
                        style={{
                          fontSize: 9, fontFamily: 'var(--font-mono)',
                          color: on ? 'var(--green)' : 'var(--text-tertiary)',
                          letterSpacing: 0.5,
                        }}
                      >
                        {on ? 'ON' : 'OFF'}
                      </span>
                      {typeStr && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>{typeStr}</span>}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    );
  }
  ToneXLiveBlock.displayName = `ToneXLiveBlock(${device.id})`;
  return ToneXLiveBlock;
}

export default makeToneXLiveBlock;
export { findPresetLocation };

// Tests d'intégration registry × profil utilisateur (Phase 2 étape 4).
// Vérifient que les valeurs migrées par migrateV2toV3 produisent les
// devices attendus quand on appelle getEnabledDevices(profile).

import { describe, test, expect } from 'vitest';
import { getEnabledDevices } from './registry.js';
import { migrateV2toV3 } from '../core/state.js';

// Side-effect imports : enregistrent les 4 devices (Phase 3 inclut TMP).
import './tonex-pedal/index.js';
import './tonex-anniversary/index.js';
import './tonex-plug/index.js';
import './tonemaster-pro/index.js';

describe('intégration profil → registry', () => {
  test('profil avec un seul device (tonex-anniversary) → 1 device retourné', () => {
    const profile = { enabledDevices: ['tonex-anniversary'] };
    const out = getEnabledDevices(profile);
    expect(out.length).toBe(1);
    expect(out[0].id).toBe('tonex-anniversary');
    expect(out[0].isPresetSourceCompatible('Anniversary')).toBe(true);
    expect(out[0].isPresetSourceCompatible('PlugFactory')).toBe(false);
  });

  test('profil enabledDevices=[] → 0 devices (caller doit gérer)', () => {
    expect(getEnabledDevices({ enabledDevices: [] })).toEqual([]);
  });

  test('profil v2 brut sans enabledDevices → fallback defaultEnabled (Pedal + Plug)', () => {
    // Cas où le state n'a pas encore été migré v2→v3 quand on appelle
    // getEnabledDevices.
    const out = getEnabledDevices({});
    const ids = out.map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(['tonex-pedal', 'tonex-plug']));
    expect(ids).not.toContain('tonex-anniversary');
  });

  test('profil migré v2→v3 (Sébastien legacy = anniversary+plug)', () => {
    const v2 = {
      version: 2,
      profiles: { sebastien: { devices: { pedale: false, anniversary: true, plug: true } } },
    };
    const v3 = migrateV2toV3(v2);
    const out = getEnabledDevices(v3.profiles.sebastien);
    expect(out.map((d) => d.id)).toEqual(['tonex-anniversary', 'tonex-plug']);
  });

  test('profil migré v2→v3 (utilisateur standard = pedal+plug)', () => {
    const v2 = {
      version: 2,
      profiles: { user: { devices: { pedale: true, anniversary: false, plug: true } } },
    };
    const v3 = migrateV2toV3(v2);
    const out = getEnabledDevices(v3.profiles.user);
    expect(out.map((d) => d.id)).toEqual(['tonex-pedal', 'tonex-plug']);
  });

  test("le device tonex-anniversary expose bien 'preset_ann' comme presetResultKey (clé partagée avec tonex-pedal)", () => {
    const out = getEnabledDevices({ enabledDevices: ['tonex-anniversary'] });
    expect(out[0].presetResultKey).toBe('preset_ann');
    expect(out[0].bankStorageKey).toBe('banksAnn');
  });

  test("le device tonex-plug expose 'preset_plug' et 'banksPlug'", () => {
    const out = getEnabledDevices({ enabledDevices: ['tonex-plug'] });
    expect(out[0].presetResultKey).toBe('preset_plug');
    expect(out[0].bankStorageKey).toBe('banksPlug');
  });
});

describe("Phase 3 régression : SongDetailCard gate sections ToneX-only", () => {
  // Vérifie le test logique utilisé par SongDetailCard pour gater les
  // sections "Recommandation idéale" + "Alternatives catalogue" (qui
  // lisent aiCache.preset_ann/_plug et PRESET_CATALOG_FULL ToneX).
  // Si aucun device avec deviceKey 'ann' ou 'plug' n'est activé, ces
  // sections doivent être masquées.
  const hasAnyToneXDevice = (profile) =>
    getEnabledDevices(profile).some((d) => d.deviceKey === 'ann' || d.deviceKey === 'plug');

  test("profil avec uniquement TMP (enabledDevices=['tonemaster-pro']) → false (pas de ToneX)", () => {
    expect(hasAnyToneXDevice({ enabledDevices: ['tonemaster-pro'] })).toBe(false);
  });

  test("profil avec tonex-pedal seul → true", () => {
    expect(hasAnyToneXDevice({ enabledDevices: ['tonex-pedal'] })).toBe(true);
  });

  test("profil avec tonex-anniversary seul → true (deviceKey='ann')", () => {
    expect(hasAnyToneXDevice({ enabledDevices: ['tonex-anniversary'] })).toBe(true);
  });

  test("profil avec tonex-plug seul → true", () => {
    expect(hasAnyToneXDevice({ enabledDevices: ['tonex-plug'] })).toBe(true);
  });

  test("profil avec TMP + tonex-pedal → true (au moins un ToneX)", () => {
    expect(hasAnyToneXDevice({ enabledDevices: ['tonemaster-pro', 'tonex-pedal'] })).toBe(true);
  });

  test("le device tonemaster-pro expose deviceKey='tmp' (différencié des ToneX)", () => {
    const tmp = getEnabledDevices({ enabledDevices: ['tonemaster-pro'] });
    expect(tmp[0].deviceKey).toBe('tmp');
    expect(['ann', 'plug']).not.toContain(tmp[0].deviceKey);
  });
});

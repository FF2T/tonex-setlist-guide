// src/app/screens/MyCustomPresetsTab.test.js — Phase 7.69
//
// Tests sur les helpers purs `inferCreator` (heuristique regex pour
// auto-suggérer la provenance d'un preset depuis son nom) et
// `flattenPresets` (concatène profile.customPacks[].presets en
// liste plate avec metadata d'origine).
//
// Le composant React MyCustomPresetsTab n'a pas de tests d'intégration
// dédiés (couvert par le smoke test admin manuel post-déploiement).

import { describe, it, expect } from 'vitest';
import { inferCreator, flattenPresets, CREATOR_OPTIONS, DEFAULT_PACK_NAME } from './MyCustomPresetsTab.jsx';

describe('inferCreator (Phase 7.69)', () => {
  describe('TSR — Studio Rats', () => {
    it('match prefix "TSR " avec espace', () => {
      expect(inferCreator('TSR Mars 800SL Cn1&2 HG')).toBe('TSR');
      expect(inferCreator('TSR D13 Best Tweed Ever Clean')).toBe('TSR');
    });
    it('match prefix "TSR-" avec tiret', () => {
      expect(inferCreator('TSR-Rectified-Modern-1')).toBe('TSR');
    });
  });

  describe('AA / JS / TJ / ML / WT', () => {
    it('match prefix AA + amalgam keyword', () => {
      expect(inferCreator('AA MRSH JT50')).toBe('AA');
      expect(inferCreator('Amalgam Audio Marshall Plexi')).toBe('AA');
    });
    it('match prefix JS + sadites keyword', () => {
      expect(inferCreator('JS Wrecked Z Push 1')).toBe('JS');
      expect(inferCreator('Jason Sadites Brit Silver')).toBe('JS');
    });
    it('match prefix TJ + junkie keyword', () => {
      expect(inferCreator('TJ 74 Purple Plexi')).toBe('TJ');
      expect(inferCreator('Tone Junkie TV Pack')).toBe('TJ');
    });
    it('match prefix ML', () => {
      expect(inferCreator('ML FMAN HBE Lead')).toBe('ML');
      expect(inferCreator('ML Sound Lab Essential')).toBe('ML');
    });
    it('match prefix WT + worship keyword', () => {
      expect(inferCreator('WT Mars Super100 Br 5')).toBe('WT');
      expect(inferCreator('Worship Tutorials Vox')).toBe('WT');
    });
  });

  describe('Galtone', () => {
    it('match galtone keyword (case-insensitive)', () => {
      expect(inferCreator('GALTONE Premium Pack')).toBe('Galtone');
      expect(inferCreator('My galtone capture')).toBe('Galtone');
    });
    it('match "Kirk & James" (signature Galtone Metallica)', () => {
      expect(inferCreator('Kirk & James - Gasoline v2')).toBe('Galtone');
    });
  });

  describe('Pas de fallback Factory/custom (Phase 7.69)', () => {
    // Différence vs inferSource Phase 7.67 : on ne renvoie pas
    // "Factory" pour les patterns CL/DR/HG (ces presets sont
    // Factory ToneX, pas des presets persos saisis par user).
    // Et pas de fallback "custom" — on laisse vide pour que le
    // user choisisse explicitement "Custom maison" ou "Autre".
    it('nom libre sans pattern → vide', () => {
      expect(inferCreator('Mon preset personnel')).toBe('');
      expect(inferCreator('Blink-182 Mesa Boggie')).toBe('');
    });
    it('chaîne vide / falsy → vide', () => {
      expect(inferCreator('')).toBe('');
      expect(inferCreator(null)).toBe('');
      expect(inferCreator(undefined)).toBe('');
    });
    it('chaîne whitespace → vide', () => {
      expect(inferCreator('   ')).toBe('');
    });
    it('pattern Factory pas reconnu (laissé au user)', () => {
      // CL/DR/HG/LD/BS prefix sont factory ToneX — pas des presets persos.
      // Le user qui saisirait "DR 800" comme preset perso choisirait
      // probablement "Autre" ou laisserait vide.
      expect(inferCreator('CL DMBL')).toBe('');
      expect(inferCreator('DR 800')).toBe('');
    });
  });

  describe('Priorité de match', () => {
    it('"TSR" gagne sur autres au milieu', () => {
      expect(inferCreator('Custom TSR pack')).toBe('TSR');
    });
    it('Préfixe AA gagne sur autres', () => {
      expect(inferCreator('AA Mars 1959')).toBe('AA');
    });
  });
});

describe('CREATOR_OPTIONS (Phase 7.69)', () => {
  it('liste fermée contient 11 entries (10 + vide)', () => {
    expect(CREATOR_OPTIONS.length).toBe(11);
  });
  it('inclut TSR, ML, AA, JS, TJ, WT, Galtone, ToneNET, Maison, Autre + entrée vide', () => {
    const values = CREATOR_OPTIONS.map((o) => o.value);
    expect(values).toContain('');
    expect(values).toContain('TSR');
    expect(values).toContain('ML');
    expect(values).toContain('AA');
    expect(values).toContain('JS');
    expect(values).toContain('TJ');
    expect(values).toContain('WT');
    expect(values).toContain('Galtone');
    expect(values).toContain('ToneNET');
    expect(values).toContain('Maison');
    expect(values).toContain('Autre');
  });
});

describe('flattenPresets (Phase 7.69)', () => {
  it('concatène les presets de tous les packs en liste plate', () => {
    const customPacks = [
      { name: 'Pack 1', presets: [{ name: 'B preset' }, { name: 'A preset' }] },
      { name: 'Pack 2', presets: [{ name: 'C preset' }] },
    ];
    const list = flattenPresets(customPacks);
    expect(list).toHaveLength(3);
    // Tri alpha par nom du preset
    expect(list[0].preset.name).toBe('A preset');
    expect(list[1].preset.name).toBe('B preset');
    expect(list[2].preset.name).toBe('C preset');
  });

  it('préserve packIdx + presetIdx + packName pour retrouver l\'origine', () => {
    const customPacks = [
      { name: 'Pack A', presets: [{ name: 'P1' }, { name: 'P2' }] },
      { name: 'Pack B', presets: [{ name: 'P3' }] },
    ];
    const list = flattenPresets(customPacks);
    const p2 = list.find((x) => x.preset.name === 'P2');
    expect(p2.packIdx).toBe(0);
    expect(p2.presetIdx).toBe(1);
    expect(p2.packName).toBe('Pack A');
    const p3 = list.find((x) => x.preset.name === 'P3');
    expect(p3.packIdx).toBe(1);
    expect(p3.presetIdx).toBe(0);
  });

  it('pack vide ou absent → ignoré', () => {
    expect(flattenPresets(null)).toEqual([]);
    expect(flattenPresets(undefined)).toEqual([]);
    expect(flattenPresets([])).toEqual([]);
    expect(flattenPresets([{ name: 'Empty', presets: [] }])).toEqual([]);
    expect(flattenPresets([{ name: 'No presets array' }])).toEqual([]);
  });

  it('preset sans name → inclus avec name=""', () => {
    const list = flattenPresets([{ name: 'P1', presets: [{ name: '' }, { name: 'A' }] }]);
    expect(list).toHaveLength(2);
    // localeCompare : "" trie avant "A"
    expect(list[0].preset.name).toBe('');
  });
});

describe('DEFAULT_PACK_NAME (Phase 7.69)', () => {
  it('vaut "Mes presets" (pack technique invisible côté UI)', () => {
    expect(DEFAULT_PACK_NAME).toBe('Mes presets');
  });
});

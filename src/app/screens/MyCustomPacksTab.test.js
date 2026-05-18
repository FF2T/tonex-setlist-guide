// src/app/screens/MyCustomPacksTab.test.js — Phase 7.67
//
// Tests sur le helper pur `inferSource` qui suggère la source
// (TSR/AA/JS/TJ/ML/WT/Galtone/Factory/custom) depuis le nom du
// preset. Sert au pré-remplissage du dropdown source quand le user
// crée un nouveau preset via le tab "📦 Mes presets custom".

import { describe, it, expect } from 'vitest';
import { inferSource } from './MyCustomPacksTab.jsx';

describe('inferSource (Phase 7.67)', () => {
  describe('TSR — Studio Rats packs', () => {
    it('match prefix "TSR " avec espace', () => {
      expect(inferSource('TSR Mars 800SL Cn1&2 HG')).toBe('TSR');
      expect(inferSource('TSR D13 Best Tweed Ever Clean')).toBe('TSR');
    });
    it('match prefix "TSR-" avec tiret', () => {
      expect(inferSource('TSR-Rectified-Modern-1')).toBe('TSR');
    });
    it('match mot \"TSR\" en milieu de chaîne', () => {
      expect(inferSource('Mon TSR favori')).toBe('TSR');
    });
  });

  describe('AA — Amalgam Audio', () => {
    it('match prefix AA + amalgam keyword', () => {
      expect(inferSource('AA MRSH JT50')).toBe('AA');
      expect(inferSource('Amalgam Audio Marshall Plexi')).toBe('AA');
    });
  });

  describe('JS — Jason Sadites', () => {
    it('match prefix JS', () => {
      expect(inferSource('JS Wrecked Z Push 1')).toBe('JS');
    });
    it('match sadites keyword', () => {
      expect(inferSource('Jason Sadites Brit Silver')).toBe('JS');
    });
  });

  describe('TJ — Tone Junkie TV', () => {
    it('match prefix TJ', () => {
      expect(inferSource('TJ 74 Purple Plexi')).toBe('TJ');
    });
    it('match junkie keyword', () => {
      expect(inferSource('Tone Junkie TV Pack')).toBe('TJ');
    });
  });

  describe('ML — ML Sound Lab', () => {
    it('match prefix ML', () => {
      expect(inferSource('ML FMAN HBE Lead')).toBe('ML');
    });
    it('match ML Sound Lab keyword', () => {
      expect(inferSource('ML Sound Lab Essential')).toBe('ML');
    });
  });

  describe('WT — Worship Tutorials', () => {
    it('match prefix WT', () => {
      expect(inferSource('WT Mars Super100 Br 5')).toBe('WT');
    });
    it('match worship keyword', () => {
      expect(inferSource('Worship Tutorials Vox')).toBe('WT');
    });
  });

  describe('Galtone', () => {
    it('match galtone keyword (case-insensitive)', () => {
      expect(inferSource('GALTONE Premium Pack')).toBe('Galtone');
      expect(inferSource('My galtone capture')).toBe('Galtone');
    });
    it("match \"Kirk & James\" (signature Galtone Metallica)", () => {
      expect(inferSource('Kirk & James - Gasoline v2')).toBe('Galtone');
    });
  });

  describe('Factory — pattern preset name ToneX', () => {
    it('match CL/DR/HG/LD prefix', () => {
      expect(inferSource('CL DMBL')).toBe('Factory');
      expect(inferSource('DR PLEXI')).toBe('Factory');
      expect(inferSource('HG 800')).toBe('Factory');
      expect(inferSource('LD 5051')).toBe('Factory');
    });
    it('match BS prefix (bass factory)', () => {
      expect(inferSource('BS B15')).toBe('Factory');
      expect(inferSource('BS XULTR')).toBe('Factory');
    });
    it('match DR1/DR2 prefix avec numéro', () => {
      expect(inferSource('DR1 DMBL')).toBe('Factory');
      expect(inferSource('DR2 TWIN')).toBe('Factory');
    });
  });

  describe('custom — fallback', () => {
    it('nom libre sans pattern → custom', () => {
      expect(inferSource('Mon preset personnel')).toBe('custom');
      expect(inferSource('Blink-182 Mesa Boggie')).toBe('custom');
    });
    it('chaîne vide / falsy → custom', () => {
      expect(inferSource('')).toBe('custom');
      expect(inferSource(null)).toBe('custom');
      expect(inferSource(undefined)).toBe('custom');
    });
    it('chaîne whitespace → custom', () => {
      expect(inferSource('   ')).toBe('custom');
    });
  });

  describe('Priorité de match', () => {
    it("\"TSR\" gagne sur \"custom\" même au milieu", () => {
      expect(inferSource('Custom TSR pack')).toBe('TSR');
    });
    it('Préfixe AA gagne sur autres mots-clés', () => {
      expect(inferSource('AA Mars 1959')).toBe('AA');
    });
  });
});

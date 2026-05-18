// src/core/scoring/guitar-family.test.js — Phase 7.64 + extension Phase 7.61
//
// Couvre :
// - getGuitarFamily : reconnaissance de la famille depuis un name libre
//   (ref_guitar IA, cot_step2_guitars[i].name, ou g.name du catalog).
// - matchGuitarName Phase 7.61 : tokenize-set + expand abbreviations +
//   stoplist. Rétro-compat aiCache historique avec anciens noms.

import { describe, it, expect } from 'vitest';
import { getGuitarFamily, matchGuitarName } from './guitar.js';

describe('Phase 7.64 — getGuitarFamily', () => {
  describe('Fender families', () => {
    it('Stratocaster → stratocaster', () => {
      expect(getGuitarFamily('Fender Stratocaster American Vintage II 1961')).toBe('stratocaster');
      expect(getGuitarFamily('Fender Stratocaster')).toBe('stratocaster');
      expect(getGuitarFamily('Squier Classic Vibe Stratocaster')).toBe('stratocaster');
      expect(getGuitarFamily('Eric Clapton Signature Stratocaster')).toBe('stratocaster');
    });

    it('Strat (abréviation) → stratocaster', () => {
      expect(getGuitarFamily('Strat 61')).toBe('stratocaster');
      expect(getGuitarFamily('Strat AM Vintage II 61')).toBe('stratocaster'); // legacy
    });

    it('Telecaster → telecaster', () => {
      expect(getGuitarFamily('Fender Telecaster American Vintage II 1963')).toBe('telecaster');
      expect(getGuitarFamily('Fender Telecaster American Ultra')).toBe('telecaster');
      expect(getGuitarFamily('Sire Larry Carlton T7 (Telecaster)')).toBe('telecaster');
    });

    it('Tele (abréviation) → telecaster', () => {
      expect(getGuitarFamily('Tele 63')).toBe('telecaster');
      expect(getGuitarFamily('Tele Ultra')).toBe('telecaster');
    });

    it('Jazzmaster → jazzmaster (priorité avant jaguar/mustang)', () => {
      expect(getGuitarFamily('Fender American Vintage II 1966 Jazzmaster')).toBe('jazzmaster');
      expect(getGuitarFamily('Jazzmaster')).toBe('jazzmaster');
    });

    it('Jaguar / Mustang', () => {
      expect(getGuitarFamily('Fender Jaguar')).toBe('jaguar');
      expect(getGuitarFamily('Fender Mustang')).toBe('mustang');
    });
  });

  describe('Gibson families', () => {
    it('Les Paul → les_paul', () => {
      expect(getGuitarFamily("Gibson Les Paul Standard '60s")).toBe('les_paul');
      expect(getGuitarFamily("Gibson Les Paul Standard '50s P-90")).toBe('les_paul');
      expect(getGuitarFamily('Les Paul Standard 60')).toBe('les_paul'); // legacy
    });

    it('LP (abréviation) → les_paul', () => {
      // Note : "LP 60" tokenisé sans expand donnerait juste "lp" + "60",
      // getGuitarFamily utilise \blp\b directement sur la chaîne complète.
      expect(getGuitarFamily('LP 60')).toBe('les_paul');
      expect(getGuitarFamily('LP P90')).toBe('les_paul');
    });

    it('SG → sg', () => {
      expect(getGuitarFamily("Gibson SG Standard '61")).toBe('sg');
      expect(getGuitarFamily('Gibson SG Standard Ebony')).toBe('sg');
      expect(getGuitarFamily('SG 61')).toBe('sg');
    });

    it('ES-335/339/345/175/etc. → es335', () => {
      expect(getGuitarFamily('Gibson ES-335')).toBe('es335');
      expect(getGuitarFamily('Gibson ES 335')).toBe('es335');
      expect(getGuitarFamily('Epiphone ES-339')).toBe('es335');
      expect(getGuitarFamily('Gibson ES-175')).toBe('es335');
    });

    it('Flying V / Explorer / Firebird', () => {
      expect(getGuitarFamily('Gibson Flying V')).toBe('flying_v');
      expect(getGuitarFamily('Gibson Explorer')).toBe('explorer');
      expect(getGuitarFamily('Gibson Firebird')).toBe('firebird');
    });
  });

  describe('Autres familles', () => {
    it('PRS', () => {
      expect(getGuitarFamily('PRS Custom 24')).toBe('prs');
      expect(getGuitarFamily('Paul Reed Smith McCarty')).toBe('prs');
    });

    it('Superstrat (Ibanez/Jackson/Charvel/ESP-style)', () => {
      expect(getGuitarFamily('Ibanez RG superstrat')).toBe('superstrat');
    });
  });

  describe('Other / fallback', () => {
    it('Customs sans family identifiable → other', () => {
      expect(getGuitarFamily('Schecter C-1 Platinum')).toBe('other');
      expect(getGuitarFamily('Ibanez Gio miKro GRGM21')).toBe('other');
      expect(getGuitarFamily('Custom Build')).toBe('other');
    });

    it('null/undefined/non-string → other', () => {
      expect(getGuitarFamily(null)).toBe('other');
      expect(getGuitarFamily(undefined)).toBe('other');
      expect(getGuitarFamily('')).toBe('other');
      expect(getGuitarFamily(123)).toBe('other');
    });
  });

  describe('Scénario bug Francisco — Get Lucky', () => {
    // Francisco a Sire Larry Carlton T7 (Telecaster) + Squier Classic Vibe
    // Stratocaster. L'IA dit ref_guitar="Fender Stratocaster" (Nile Rodgers
    // Hitmaker Strat 1959-60). Famille ref = stratocaster. Doit matcher
    // Squier Strat, pas Sire T7 Tele.
    it('ref_guitar Fender Stratocaster → famille stratocaster', () => {
      expect(getGuitarFamily('Fender Stratocaster')).toBe('stratocaster');
    });

    it('Squier Classic Vibe Stratocaster → stratocaster (match ref)', () => {
      expect(getGuitarFamily('Squier Classic Vibe Stratocaster')).toBe('stratocaster');
    });

    it('Sire Larry Carlton T7 (Telecaster) → telecaster (PAS match ref)', () => {
      expect(getGuitarFamily('Sire Larry Carlton T7 (Telecaster)')).toBe('telecaster');
    });
  });

  describe('Scénario Stairway to Heaven (Jimmy Page) → les_paul', () => {
    it('ref_guitar Gibson Les Paul → les_paul', () => {
      expect(getGuitarFamily('Gibson Les Paul')).toBe('les_paul');
      expect(getGuitarFamily('Gibson Les Paul Standard')).toBe('les_paul');
    });
  });

  describe('Scénario Brown Sugar (Keith Richards) → telecaster', () => {
    it('ref_guitar Fender Telecaster → telecaster', () => {
      expect(getGuitarFamily('Fender Telecaster')).toBe('telecaster');
    });
  });
});

describe('Phase 7.61 — matchGuitarName tokenize-set extension', () => {
  // Rétro-compat aiCache historique : anciens noms abrégés doivent matcher
  // les nouveaux noms complets (rename Phase 7.61).

  const STRAT61 = { id: 'strat61', name: 'Fender Stratocaster American Vintage II 1961', short: 'Strat 61', type: 'SC' };
  const LP60 = { id: 'lp60', name: "Gibson Les Paul Standard '60s", short: 'LP 60', type: 'HB' };
  const SG61 = { id: 'sg61', name: "Gibson SG Standard '61", short: 'SG 61', type: 'HB' };
  const ES335 = { id: 'es335', name: 'Gibson ES-335', short: 'ES-335', type: 'HB' };
  const TELE63 = { id: 'tele63', name: 'Fender Telecaster American Vintage II 1963', short: 'Tele 63', type: 'SC' };
  const SCHECTER = { id: 'schecter_c1', name: 'Schecter C-1 Platinum', short: 'Schecter C1', type: 'HB' };

  describe('Match exact (legacy path)', () => {
    it('même name exact', () => {
      expect(matchGuitarName('Fender Stratocaster American Vintage II 1961', STRAT61)).toBe(true);
    });
    it('match short', () => {
      expect(matchGuitarName('Strat 61', STRAT61)).toBe(true);
    });
    it('match exact short Schecter', () => {
      expect(matchGuitarName('Schecter C1', SCHECTER)).toBe(true);
    });
  });

  describe('Match substring (legacy path)', () => {
    it('"Schecter" inclus dans g.name "Schecter C-1 Platinum"', () => {
      expect(matchGuitarName('Schecter', SCHECTER)).toBe(true);
    });
    it('"Gibson ES-335" exact', () => {
      expect(matchGuitarName('Gibson ES-335', ES335)).toBe(true);
    });
  });

  describe('Match tokenize-set Phase 7.61 (rétro-compat aiCache)', () => {
    it('"Strat AM Vintage II 61" (ancien name) match "Fender Stratocaster American Vintage II 1961"', () => {
      // tokens needle après stoplist : "strat", "61" (am/vintage/ii filtered)
      // tokens haystack après stoplist : "stratocaster", "1961"
      // "strat" matche "stratocaster" via substring ≥4
      // "61" matche "1961" via numeric suffix
      expect(matchGuitarName('Strat AM Vintage II 61', STRAT61)).toBe(true);
    });

    it('"LP 60" (legacy) match "Gibson Les Paul Standard \'60s"', () => {
      // expand abbreviations : "LP" → "les paul"
      // needle tokens : "les", "paul", "60"
      // haystack tokens : "les", "paul", "60s"
      // "60" matche "60s" via numeric prefix égal
      expect(matchGuitarName('LP 60', LP60)).toBe(true);
    });

    it('"Les Paul Standard 60" (ancien name complet) match nouveau', () => {
      expect(matchGuitarName('Les Paul Standard 60', LP60)).toBe(true);
    });

    it('"SG Standard 61" (ancien) match "Gibson SG Standard \'61"', () => {
      expect(matchGuitarName('SG Standard 61', SG61)).toBe(true);
    });

    it('"Telecaster AM Vintage II 63" match "Fender Telecaster American Vintage II 1963"', () => {
      expect(matchGuitarName('Telecaster AM Vintage II 63', TELE63)).toBe(true);
    });

    it('"Tele" générique match Telecaster nouveau nom (substring tele.length=4)', () => {
      // "tele".length=4, telecaster.includes("tele") → match
      expect(matchGuitarName('Tele', TELE63)).toBe(true);
    });

    it('"Strat" générique match Stratocaster nouveau nom', () => {
      expect(matchGuitarName('Strat', STRAT61)).toBe(true);
    });
  });

  describe('Match négatif (différentes familles)', () => {
    it('"Strat" ne match PAS Telecaster', () => {
      expect(matchGuitarName('Strat', TELE63)).toBe(false);
    });
    it('"Les Paul" ne match PAS Stratocaster', () => {
      expect(matchGuitarName('Les Paul', STRAT61)).toBe(false);
    });
    it('"SG" ne match PAS ES-335', () => {
      expect(matchGuitarName('SG', ES335)).toBe(false);
    });
    it('"Schecter" ne match PAS Stratocaster', () => {
      expect(matchGuitarName('Schecter', STRAT61)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('falsy inputs → false', () => {
      expect(matchGuitarName(null, STRAT61)).toBe(false);
      expect(matchGuitarName('', STRAT61)).toBe(false);
      expect(matchGuitarName('Strat', null)).toBe(false);
      expect(matchGuitarName('Strat', { name: '', short: '' })).toBe(false);
    });

    it('name avec espace multiple → normalisé', () => {
      expect(matchGuitarName('Strat   61', STRAT61)).toBe(true);
    });
  });
});

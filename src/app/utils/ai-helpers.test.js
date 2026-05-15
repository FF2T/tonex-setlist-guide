// src/app/utils/ai-helpers.test.js — Phase 7.39 (Option D trilingue).
//
// Tests sur getLocalizedText. Couvre :
// - format legacy string (aiCache pré-7.39 ou seed FR)
// - format trilingue {fr, en, es} (nouveau prompt)
// - fallback cascade locale → fr → en → es → ''
// - inputs falsy/edge cases

import { describe, it, expect } from 'vitest';
import { getLocalizedText, findSlotByUsageMatch } from './ai-helpers.js';

describe('getLocalizedText', () => {
  describe('legacy string format', () => {
    it('retourne la string telle quelle quelle que soit la locale', () => {
      expect(getLocalizedText('Bonjour', 'fr')).toBe('Bonjour');
      expect(getLocalizedText('Bonjour', 'en')).toBe('Bonjour');
      expect(getLocalizedText('Bonjour', 'es')).toBe('Bonjour');
    });

    it('string vide retournée telle quelle (pas de fallback)', () => {
      expect(getLocalizedText('', 'fr')).toBe('');
    });
  });

  describe('trilingual object format', () => {
    const trilingual = {
      fr: 'Bonjour',
      en: 'Hello',
      es: 'Hola',
    };

    it('pioche la bonne locale', () => {
      expect(getLocalizedText(trilingual, 'fr')).toBe('Bonjour');
      expect(getLocalizedText(trilingual, 'en')).toBe('Hello');
      expect(getLocalizedText(trilingual, 'es')).toBe('Hola');
    });

    it('fallback sur fr si locale inconnue', () => {
      expect(getLocalizedText(trilingual, 'de')).toBe('Bonjour');
      expect(getLocalizedText(trilingual, '')).toBe('Bonjour');
    });

    it('fallback cascade si locale manquante dans l\'objet', () => {
      expect(getLocalizedText({ fr: 'Bonjour', en: 'Hello' }, 'es')).toBe('Bonjour');
      expect(getLocalizedText({ en: 'Hello', es: 'Hola' }, 'fr')).toBe('Hello');
      expect(getLocalizedText({ es: 'Hola' }, 'fr')).toBe('Hola');
    });

    it('skip les valeurs vides et cascade', () => {
      expect(getLocalizedText({ fr: '', en: 'Hello', es: 'Hola' }, 'fr')).toBe('Hello');
      expect(getLocalizedText({ fr: '   ', en: 'Hello' }, 'fr')).toBe('Hello');
    });

    it('retourne empty string si tous les champs manquent ou sont vides', () => {
      expect(getLocalizedText({}, 'fr')).toBe('');
      expect(getLocalizedText({ fr: '', en: '', es: '' }, 'fr')).toBe('');
    });

    it('ignore les champs non-string (objets imbriqués, numbers)', () => {
      expect(getLocalizedText({ fr: 42, en: 'Hello' }, 'fr')).toBe('Hello');
      expect(getLocalizedText({ fr: null, en: 'Hello' }, 'fr')).toBe('Hello');
    });
  });

  describe('falsy and edge cases', () => {
    it('null/undefined → empty string', () => {
      expect(getLocalizedText(null, 'fr')).toBe('');
      expect(getLocalizedText(undefined, 'fr')).toBe('');
    });

    it('number → coerce en string', () => {
      expect(getLocalizedText(42, 'fr')).toBe('42');
    });

    it('locale par défaut = fr si absente', () => {
      expect(getLocalizedText({ fr: 'Bonjour', en: 'Hello' })).toBe('Bonjour');
    });
  });

  describe('use cases concrets', () => {
    it('cot_step1 trilingue cas Bruno (EN)', () => {
      const cot = {
        fr: 'Le morceau est un punk énergique de Blink-182.',
        en: 'The song is an energetic Blink-182 punk track.',
        es: 'La canción es un punk enérgico de Blink-182.',
      };
      expect(getLocalizedText(cot, 'en')).toBe('The song is an energetic Blink-182 punk track.');
    });

    it('cot_step2_guitars[].reason cas legacy FR (avant fetch trilingue)', () => {
      const legacyReason = 'Humbuckers adaptés au son saturé du morceau.';
      expect(getLocalizedText(legacyReason, 'en')).toBe('Humbuckers adaptés au son saturé du morceau.');
    });

    it('song_desc seed FR (INIT_SONG_DB_META) reste FR pour tous', () => {
      // Les descriptions seed dans core/songs.js sont en FR pur. Phase D
      // n'affecte que les nouveaux fetch IA. Le helper renvoie la string FR
      // legacy pour toutes les locales, comportement attendu.
      const seedDesc = 'Morceau emblématique du blues rock 70s.';
      expect(getLocalizedText(seedDesc, 'es')).toBe('Morceau emblématique du blues rock 70s.');
    });
  });
});

describe('findSlotByUsageMatch — Phase 7.52.5', () => {
  // Banks de test : slot 8A contient AA MRSH SB100 (usages Cream:
  // White Room, Sunshine of Your Love), slot 4C contient AA MRSH JT50
  // (usages AC/DC: HtH, BiB, TNT, You Shook Me, Hells Bells, Whole
  // Lotta Rosie). Les entrées sont dans le catalog Phase 7.52 statique,
  // donc findCatalogEntry les résout.
  const banks = {
    4: { A: '', B: '', C: 'AA MRSH JT50 I Drive BAL SCH CAB' },
    8: { A: 'AA MRSH SB100 I Edge WRM CAB', B: '', C: '' },
    20: { A: '', B: '', C: 'Foo Inconnu' }, // catalog null → ignoré
  };

  it('match parfait titre + artiste → score 100', () => {
    const m = findSlotByUsageMatch(banks, 'Cream', 'White Room');
    expect(m).toBeTruthy();
    expect(m.bank).toBe(8);
    expect(m.col).toBe('A');
    expect(m.label).toBe('AA MRSH SB100 I Edge WRM CAB');
    expect(m.score).toBe(100);
  });

  it('match titre Sunshine of Your Love → SB100 toujours', () => {
    const m = findSlotByUsageMatch(banks, 'Cream', 'Sunshine of Your Love');
    expect(m?.label).toBe('AA MRSH SB100 I Edge WRM CAB');
    expect(m?.score).toBe(100);
  });

  it("match artiste seul (titre absent des songs) → score 50", () => {
    // AA MRSH JT50 a usages AC/DC + ces 6 songs. Pour un AC/DC inconnu
    // dans la liste, score artist match = 50.
    const m = findSlotByUsageMatch(banks, 'AC/DC', 'Some Unknown AC/DC Song');
    expect(m?.label).toBe('AA MRSH JT50 I Drive BAL SCH CAB');
    expect(m?.score).toBe(50);
  });

  it("match titre Highway to Hell → score 100 (titre dans la liste)", () => {
    const m = findSlotByUsageMatch(banks, 'AC/DC', 'Highway to Hell');
    expect(m?.label).toBe('AA MRSH JT50 I Drive BAL SCH CAB');
    expect(m?.score).toBe(100);
  });

  it('artiste pas dans usages → null', () => {
    const m = findSlotByUsageMatch(banks, 'Pink Floyd', 'Shine On You Crazy Diamond');
    expect(m).toBeNull();
  });

  it('banks vides → null', () => {
    expect(findSlotByUsageMatch({}, 'Cream', 'White Room')).toBeNull();
    expect(findSlotByUsageMatch(null, 'Cream', 'White Room')).toBeNull();
  });

  it('case-insensitive sur artiste et titre', () => {
    const m1 = findSlotByUsageMatch(banks, 'cream', 'WHITE ROOM');
    expect(m1?.score).toBe(100);
    const m2 = findSlotByUsageMatch(banks, 'AC/dc', 'highway to hell');
    expect(m2?.score).toBe(100);
  });

  it('artiste ET titre vides → null', () => {
    expect(findSlotByUsageMatch(banks, '', '')).toBeNull();
    expect(findSlotByUsageMatch(banks, null, null)).toBeNull();
  });
});

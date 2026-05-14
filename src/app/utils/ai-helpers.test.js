// src/app/utils/ai-helpers.test.js — Phase 7.39 (Option D trilingue).
//
// Tests sur getLocalizedText. Couvre :
// - format legacy string (aiCache pré-7.39 ou seed FR)
// - format trilingue {fr, en, es} (nouveau prompt)
// - fallback cascade locale → fr → en → es → ''
// - inputs falsy/edge cases

import { describe, it, expect } from 'vitest';
import { getLocalizedText } from './ai-helpers.js';

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

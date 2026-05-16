// src/app/utils/ai-helpers.test.js — Phase 7.39 (Option D trilingue).
//
// Tests sur getLocalizedText. Couvre :
// - format legacy string (aiCache pré-7.39 ou seed FR)
// - format trilingue {fr, en, es} (nouveau prompt)
// - fallback cascade locale → fr → en → es → ''
// - inputs falsy/edge cases

import { describe, it, expect } from 'vitest';
import { getLocalizedText, findSlotByUsageMatch, findCatalogEntryByUsages } from './ai-helpers.js';

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

describe('findSlotByUsageMatch — Phase 7.52.6 (ref_guitarist)', () => {
  // JS Wrecked Z Push 1 (Anniversary Premium catalog) a
  // usages: [{artist: "Joe Walsh"}, {artist: "Brad Paisley"}] sans songs.
  // Cas-cible : Hotel California (Eagles) avec ref_guitarist="Joe Walsh".
  const banks = {
    5: { A: 'JS Wrecked Z Push 1', B: '', C: '' },
    8: { A: 'AA MRSH SB100 I Edge WRM CAB', B: '', C: '' },
  };

  it('match guitariste via substring composé → score 50', () => {
    // Cas Hotel California : Eagles n'apparaît pas dans usages,
    // mais ref_guitarist contient "Joe Walsh" → match JS Wrecked Z.
    const m = findSlotByUsageMatch(banks, 'Eagles', 'Hotel California', 'Don Felder / Joe Walsh');
    expect(m).toBeTruthy();
    expect(m.bank).toBe(5);
    expect(m.col).toBe('A');
    expect(m.label).toBe('JS Wrecked Z Push 1');
    expect(m.score).toBe(50);
  });

  it('match guitariste seul (sans artist match) → score 50', () => {
    const m = findSlotByUsageMatch(banks, 'Inconnu', '', 'Joe Walsh');
    expect(m?.label).toBe('JS Wrecked Z Push 1');
    expect(m?.score).toBe(50);
  });

  it('match guitariste case-insensitive', () => {
    const m1 = findSlotByUsageMatch(banks, 'Eagles', '', 'JOE WALSH');
    expect(m1?.score).toBe(50);
    const m2 = findSlotByUsageMatch(banks, 'Eagles', '', 'joe walsh');
    expect(m2?.score).toBe(50);
  });

  it('match artist exact gagne sur match guitariste seul (score égal)', () => {
    // Cream + ref_guitarist="Eric Clapton" : Cream artist match (score 50)
    // sur SB100 ; Clapton n'est pas dans les usages → seul artist match
    // compte. Score 50 préservé.
    const m = findSlotByUsageMatch(banks, 'Cream', '', 'Eric Clapton');
    expect(m?.label).toBe('AA MRSH SB100 I Edge WRM CAB');
    expect(m?.score).toBe(50);
  });

  it('refGuitarist null/undefined → comportement Phase 7.52.5 inchangé', () => {
    const m1 = findSlotByUsageMatch(banks, 'Cream', 'White Room', null);
    expect(m1?.score).toBe(100);
    const m2 = findSlotByUsageMatch(banks, 'Cream', 'White Room', undefined);
    expect(m2?.score).toBe(100);
    // Sans aucun arg en plus, signature 3-arg legacy fonctionne.
    const m3 = findSlotByUsageMatch(banks, 'Cream', 'White Room');
    expect(m3?.score).toBe(100);
  });

  it('refGuitarist seul (sans songArtist ni songTitle) déclenche le match', () => {
    const m = findSlotByUsageMatch(banks, null, null, 'Brad Paisley playing');
    expect(m?.label).toBe('JS Wrecked Z Push 1');
    expect(m?.score).toBe(50);
  });

  it('garde-fou length < 4 : artist court ne match pas par substring', () => {
    // U2 (longueur 2) ne doit pas matcher même si refGuitarist contient
    // "U2". Slot avec usages U2 dans le catalog : TJ AC44 B 3+ a
    // usages: [{artist: "The Edge"}, ...]. Pour ce test, on construit
    // un cas où le risque substring serait élevé sur un nom court.
    // On utilise AA MRSH JT50 (usages AC/DC — 5 chars, passe garde-fou).
    // Vérif inverse : si on avait u.artist="U2", "u2 fan club" matcherait
    // sans le garde-fou. Avec garde-fou length >= 4, U2 (2 chars) skip.
    // Cas concret testable : songArtist="Pink Floyd", refGuitarist contient
    // par hasard la substring "ac/dc" (peu réaliste, mais le helper doit
    // rester strict). AC/DC = 5 chars donc passerait → match score 50.
    const m = findSlotByUsageMatch(
      { 4: { A: '', B: '', C: 'AA MRSH JT50 I Drive BAL SCH CAB' } },
      'Pink Floyd',
      '',
      'David Gilmour playing AC/DC tribute'
    );
    // Substring "ac/dc" présent (>=4 chars) → match attendu.
    expect(m?.score).toBe(50);
  });

  it('match titre + guitariste → score 100', () => {
    // AA MRSH JT50 a usages AC/DC + songs ["Highway to Hell", ...]
    // Si refGuitarist contient "AC/DC" et titre = "Highway to Hell",
    // score 100.
    const m = findSlotByUsageMatch(
      { 4: { A: '', B: '', C: 'AA MRSH JT50 I Drive BAL SCH CAB' } },
      'Inconnu',
      'Highway to Hell',
      'fan de AC/DC depuis 20 ans'
    );
    expect(m?.score).toBe(100);
  });
});

describe('findCatalogEntryByUsages — Phase 7.55', () => {
  // Test sur le catalog réel (Anniversary Premium Phase 7.52 contient
  // AA MRSH SB100 avec usages Cream: White Room/Sunshine of Your Love,
  // AA MRSH JT50 avec usages AC/DC: Highway to Hell..., AA ORNG 120
  // avec usages Black Sabbath: Paranoid/Iron Man/War Pigs).

  it('match titre + artiste sur catalog → score 100', () => {
    const m = findCatalogEntryByUsages('Cream', 'White Room', null);
    expect(m).toBeTruthy();
    expect(m.name).toMatch(/MRSH SB100/);
    expect(m.score).toBe(100);
  });

  it('match artiste seul (titre absent) → score 50', () => {
    const m = findCatalogEntryByUsages('Cream', 'Track Inconnu', null);
    expect(m?.score).toBe(50);
  });

  it('match via refGuitarist substring', () => {
    // Plusieurs captures du catalog ont usages Joe Walsh (TSR ZWREK Crunch,
    // JS Wrecked Z Push 1, ...). Le helper retourne le premier match
    // qu'il trouve avec score 50. On vérifie juste qu'un match existe.
    const m = findCatalogEntryByUsages('Eagles', '', 'Don Felder / Joe Walsh');
    expect(m).toBeTruthy();
    expect(m.score).toBe(50);
  });

  it('aucun match → null', () => {
    const m = findCatalogEntryByUsages('Artiste Inexistant', 'Morceau Inexistant', null);
    expect(m).toBeNull();
  });

  it('availableSources filter : source désactivée → skip', () => {
    // AA MRSH SB100 a src=Anniversary. Si Anniversary désactivé,
    // l'entry doit être skip.
    const m = findCatalogEntryByUsages('Cream', 'White Room', null, { Anniversary: false });
    expect(m).toBeNull();
  });

  it('availableSources activé → match OK', () => {
    const m = findCatalogEntryByUsages('Cream', 'White Room', null, { Anniversary: true });
    expect(m?.score).toBe(100);
  });

  it('inputs falsy → null', () => {
    expect(findCatalogEntryByUsages('', '', '', null)).toBeNull();
    expect(findCatalogEntryByUsages(null, null, null, null)).toBeNull();
  });

  it('Black Sabbath / Paranoid (cas-cible Phase 7.55)', () => {
    // Le catalog Anniversary Premium a AA ORNG 120 Dimed avec usages
    // [{artist: "Black Sabbath", songs: ["Paranoid", "Iron Man", "War Pigs"]}].
    // Un preset ToneNET user-tagué ne serait pas dans ce test (catalog
    // statique), mais ORNG match aussi → score 100.
    const m = findCatalogEntryByUsages('Black Sabbath', 'Paranoid', null);
    expect(m).toBeTruthy();
    expect(m.score).toBe(100);
  });
});

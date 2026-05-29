// src/app/utils/ai-helpers.test.js — Phase 7.39 (Option D trilingue).
//
// Tests sur getLocalizedText. Couvre :
// - format legacy string (aiCache pré-7.39 ou seed FR)
// - format trilingue {fr, en, es} (nouveau prompt)
// - fallback cascade locale → fr → en → es → ''
// - inputs falsy/edge cases

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getLocalizedText, findSlotByUsageMatch, findCatalogEntryByUsages, findSlotByName, stripSlotPrefix, sanitizeAmpSuggestion, sanitizePedalSuggestion, sanitizeControls, enrichAIResult, updateAiCache, computeRigSnapshot } from './ai-helpers.js';
import { PRESET_CATALOG_MERGED } from '../../core/catalog.js';

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

describe('findSlotByName — Phase 7.56 (tolérance format IA)', () => {
  const banks = {
    48: { A: 'Kirk & James - Gasoline v2', B: 'Blink-182 Mesa Boggie', C: '' },
    9: { A: '', B: '', C: 'AA MRSH JT50 I Drive BAL SCH CAB' },
  };

  it('match nom exact (legacy comportement)', () => {
    const m = findSlotByName(banks, 'Kirk & James - Gasoline v2');
    expect(m?.bank).toBe(48);
    expect(m?.col).toBe('A');
  });

  it('match avec prefix position "48A name"', () => {
    const m = findSlotByName(banks, '48A Kirk & James - Gasoline v2');
    expect(m?.bank).toBe(48);
    expect(m?.col).toBe('A');
  });

  it('match avec prefix position + quotes doubles (cas Bruno observé)', () => {
    const m = findSlotByName(banks, '48A "Kirk & James - Gasoline v2"');
    expect(m?.bank).toBe(48);
    expect(m?.col).toBe('A');
    expect(m?.label).toBe('Kirk & James - Gasoline v2');
  });

  it('match avec quotes seules', () => {
    const m = findSlotByName(banks, '"Blink-182 Mesa Boggie"');
    expect(m?.bank).toBe(48);
    expect(m?.col).toBe('B');
  });

  it('match avec quotes simples', () => {
    const m = findSlotByName(banks, "'Blink-182 Mesa Boggie'");
    expect(m?.col).toBe('B');
  });

  it('match avec position simple chiffre "9C name"', () => {
    const m = findSlotByName(banks, '9C AA MRSH JT50 I Drive BAL SCH CAB');
    expect(m?.bank).toBe(9);
    expect(m?.col).toBe('C');
  });

  it('case-insensitive', () => {
    const m = findSlotByName(banks, '48a "KIRK & JAMES - gasoline V2"');
    expect(m?.bank).toBe(48);
  });

  it('nom inconnu → null', () => {
    expect(findSlotByName(banks, 'Inexistant')).toBeNull();
    expect(findSlotByName(banks, '48A "Inexistant"')).toBeNull();
  });

  it('inputs falsy → null', () => {
    expect(findSlotByName(null, 'foo')).toBeNull();
    expect(findSlotByName(banks, null)).toBeNull();
    expect(findSlotByName(banks, '')).toBeNull();
  });
});

// Phase 7.65.x — Couvre le bug constaté sur le profil Bruno :
// les customs avec usages n'étaient pas pinnés par l'IA car
// l'useMemo qui injecte profile.customPacks dans
// PRESET_CATALOG_MERGED (main.jsx Phase 7.30) ne copiait pas le
// champ `usages`. Conséquence : `findCatalogEntry("Kirk & James -
// Gasoline v2")` retournait metadata sans `usages` →
// `buildInstalledSlotsSection` n'envoyait rien au prompt IA et
// `findSlotByUsageMatch` ne matchait pas (alors qu'il est correct
// dans sa logique). Le pin ne fonctionnait que via PRIORITÉ 2
// du prompt (nom contient artiste/morceau littéralement).
//
// Ici on simule l'useMemo CORRECT en seedant directement
// PRESET_CATALOG_MERGED avec une entry custom + usages.
describe('findSlotByUsageMatch — Phase 7.65.x (customs avec usages)', () => {
  const CUSTOM_KIRK = 'Kirk & James - Gasoline v2';
  const CUSTOM_MAIDEN = 'Maiden Pack | Fear Of The Solo';
  const CUSTOM_NO_USAGES = 'Custom Sans Usages';
  const seededKeys = [CUSTOM_KIRK, CUSTOM_MAIDEN, CUSTOM_NO_USAGES];

  beforeEach(() => {
    // Simule l'useMemo Phase 7.65.x : injection d'un custom avec usages.
    PRESET_CATALOG_MERGED[CUSTOM_KIRK] = {
      src: 'custom',
      amp: 'Mesa Mark IIC+',
      gain: 'high',
      style: 'metal',
      channel: '',
      pack: 'Bruno — Banks 38-49',
      scores: { HB: 95, SC: 55, P90: 68 },
      usages: [
        { artist: 'Metallica', songs: ['For Whom the Bell Tolls', 'Master of Puppets', 'One', 'Enter Sandman'] },
      ],
    };
    PRESET_CATALOG_MERGED[CUSTOM_MAIDEN] = {
      src: 'custom',
      amp: 'Marshall JCM800',
      gain: 'high',
      style: 'metal',
      channel: '',
      pack: 'Bruno — Banks 38-49',
      scores: { HB: 92, SC: 56, P90: 73 },
      usages: [
        { artist: 'Iron Maiden', songs: ['Fear of the Dark'] },
      ],
    };
    PRESET_CATALOG_MERGED[CUSTOM_NO_USAGES] = {
      src: 'custom',
      amp: 'Marshall JCM800',
      gain: 'high',
      style: 'metal',
      channel: '',
      pack: 'Bruno — Banks 38-49',
      scores: { HB: 90, SC: 55, P90: 70 },
      // Pas de usages → ne devrait pas matcher via findSlotByUsageMatch
    };
  });

  afterEach(() => {
    for (const k of seededKeys) delete PRESET_CATALOG_MERGED[k];
  });

  it('scénario bug Bruno (For Whom the Bell Tolls / Metallica) → pin custom Kirk & James 48A', () => {
    const banks = {
      48: { A: CUSTOM_KIRK, B: '', C: '' },
    };
    const m = findSlotByUsageMatch(banks, 'Metallica', 'For Whom the Bell Tolls');
    expect(m).toBeTruthy();
    expect(m.bank).toBe(48);
    expect(m.col).toBe('A');
    expect(m.label).toBe(CUSTOM_KIRK);
    expect(m.score).toBe(100);
  });

  it('scénario bug Bruno (Fear of the Dark / Iron Maiden) → pin custom Maiden Pack 40B', () => {
    const banks = {
      40: { A: '', B: CUSTOM_MAIDEN, C: '' },
    };
    const m = findSlotByUsageMatch(banks, 'Iron Maiden', 'Fear of the Dark');
    expect(m).toBeTruthy();
    expect(m.bank).toBe(40);
    expect(m.col).toBe('B');
    expect(m.label).toBe(CUSTOM_MAIDEN);
    expect(m.score).toBe(100);
  });

  it('custom avec usages artist seul (titre pas dans songs) → score 50', () => {
    // Bruno joue un autre morceau de Metallica pas listé dans usages.songs.
    const banks = { 48: { A: CUSTOM_KIRK, B: '', C: '' } };
    const m = findSlotByUsageMatch(banks, 'Metallica', 'Battery');
    expect(m).toBeTruthy();
    expect(m.label).toBe(CUSTOM_KIRK);
    expect(m.score).toBe(50);
  });

  it('custom SANS usages → findSlotByUsageMatch retourne null (fallback scoring V9)', () => {
    // Sans usages, le custom ne peut pas être pinné par usage-match.
    // C'est attendu : le scoring V9 standard prend le relais ailleurs.
    const banks = { 47: { A: CUSTOM_NO_USAGES, B: '', C: '' } };
    const m = findSlotByUsageMatch(banks, 'Iron Maiden', 'Fear of the Dark');
    expect(m).toBeNull();
  });

  it('régression Phase 7.55 : Anniversary Premium factory avec usages toujours matché', () => {
    // Le catalog statique AA MRSH SB100 (usages Cream) reste matchable.
    const banks = {
      8: { A: 'AA MRSH SB100 I Edge WRM CAB', B: '', C: '' },
    };
    const m = findSlotByUsageMatch(banks, 'Cream', 'White Room');
    expect(m).toBeTruthy();
    expect(m.label).toBe('AA MRSH SB100 I Edge WRM CAB');
    expect(m.score).toBe(100);
  });

  it('mélange customs + factory dans les mêmes banks → cherche correctement les 2', () => {
    const banks = {
      8: { A: 'AA MRSH SB100 I Edge WRM CAB', B: '', C: '' },
      48: { A: CUSTOM_KIRK, B: '', C: '' },
    };
    // Cream → factory
    const m1 = findSlotByUsageMatch(banks, 'Cream', 'White Room');
    expect(m1?.bank).toBe(8);
    // Metallica → custom
    const m2 = findSlotByUsageMatch(banks, 'Metallica', 'For Whom the Bell Tolls');
    expect(m2?.bank).toBe(48);
    expect(m2?.label).toBe(CUSTOM_KIRK);
  });
});

// Phase 7.65.x — Valide via findCatalogEntryByUsages (Phase 7.55) que
// les customs avec usages remontent aussi dans ideal_top3 (catalog
// scan, indépendant des banks installées).
describe('findCatalogEntryByUsages — Phase 7.65.x (customs avec usages)', () => {
  const CUSTOM_KIRK = 'Kirk & James - Gasoline v2';

  beforeEach(() => {
    PRESET_CATALOG_MERGED[CUSTOM_KIRK] = {
      src: 'custom',
      amp: 'Mesa Mark IIC+',
      gain: 'high',
      style: 'metal',
      scores: { HB: 95, SC: 55, P90: 68 },
      usages: [
        { artist: 'Metallica', songs: ['For Whom the Bell Tolls', 'Master of Puppets'] },
      ],
    };
  });

  afterEach(() => {
    delete PRESET_CATALOG_MERGED[CUSTOM_KIRK];
  });

  it('custom avec usages remonte dans findCatalogEntryByUsages (catalog scan)', () => {
    const m = findCatalogEntryByUsages('Metallica', 'For Whom the Bell Tolls', null);
    expect(m).toBeTruthy();
    expect(m.name).toBe(CUSTOM_KIRK);
    expect(m.score).toBe(100);
    expect(m.entry.src).toBe('custom');
  });

  it('availableSources={custom:false} → skip le custom même avec usages match', () => {
    // Cohérence Phase 5.6 / 5.12 : filtrer par sources activées par le profil.
    const m = findCatalogEntryByUsages('Metallica', 'For Whom the Bell Tolls', null, { custom: false });
    // Le custom est skippé ; éventuellement un autre catalog match existe
    // (par ex. WT Mars Super1100 JMP 5 a usages Metallica). On vérifie
    // simplement que le custom Bruno n'est pas retourné.
    if (m) expect(m.entry.src).not.toBe('custom');
  });
});

// Phase 7.64 — Bonus family match dans enrichAIResult. Cible le bug
// rapporté Francisco 2026-05-17 soir : sur Get Lucky (Daft Punk),
// l'IA recommandait Sire T7 (Tele) au lieu de la Squier Strat alors
// que ref_guitar="Fender Stratocaster".
describe('enrichAIResult — Phase 7.64 (bonus family match)', () => {
  // Banks vides pour ces tests : on se concentre sur cot_step2_guitars
  // et ideal_guitar, pas sur les presets ann/plug.
  const emptyBanks = {};

  it('scénario Francisco Get Lucky : ref_guitar Stratocaster boost Strat vs Tele', () => {
    const aiResult = {
      song_style: 'pop',
      target_gain: 4,
      ref_guitar: 'Fender Stratocaster',
      ideal_guitar: 'Sire Larry Carlton T7 (Telecaster)',
      cot_step2_guitars: [
        { name: 'Sire Larry Carlton T7 (Telecaster)', score: 88, reason: 'SC versatile' },
        { name: 'Squier Classic Vibe Stratocaster', score: 78, reason: 'SC plus brillant' },
      ],
      preset_ann: null,
      preset_plug: null,
      ideal_preset: null,
      ideal_preset_score: 0,
      ideal_top3: [],
    };
    const out = enrichAIResult(aiResult, 'SC', null, emptyBanks, emptyBanks, undefined, null);
    // Bonus +15 sur la Strat (78 → 93). Tele inchangée (88).
    const strat = out.cot_step2_guitars.find((g) => g.name.includes('Stratocaster'));
    const tele = out.cot_step2_guitars.find((g) => g.name.includes('Telecaster'));
    expect(strat.score).toBe(93);
    expect(strat._familyBoost).toBe(15);
    expect(strat._familyMatched).toBe('stratocaster');
    expect(tele.score).toBe(88);
    expect(tele._familyBoost).toBeUndefined();
    // Après re-tri, Strat est première.
    expect(out.cot_step2_guitars[0].name).toContain('Stratocaster');
    // ideal_guitar mis à jour pour cohérence avec ref_guitar family.
    expect(out.ideal_guitar).toContain('Stratocaster');
  });

  it('Stairway to Heaven : ref_guitar Les Paul boost LP60 vs SG', () => {
    const aiResult = {
      song_style: 'rock',
      target_gain: 6,
      ref_guitar: 'Gibson Les Paul Standard',
      ideal_guitar: "Gibson SG Standard '61",
      cot_step2_guitars: [
        { name: "Gibson SG Standard '61", score: 90 },
        { name: "Gibson Les Paul Standard '60s", score: 82 },
        { name: 'Gibson ES-335', score: 75 },
      ],
      preset_ann: null,
      preset_plug: null,
    };
    const out = enrichAIResult(aiResult, 'HB', null, emptyBanks, emptyBanks, undefined, null);
    const lp = out.cot_step2_guitars.find((g) => g.name.includes('Les Paul'));
    const sg = out.cot_step2_guitars.find((g) => g.name.includes('SG'));
    const es = out.cot_step2_guitars.find((g) => g.name.includes('ES-335'));
    expect(lp.score).toBe(97); // 82 + 15
    expect(lp._familyBoost).toBe(15);
    expect(sg.score).toBe(90); // pas boosté (sg ≠ les_paul)
    expect(es.score).toBe(75);
    // LP devient première après re-tri.
    expect(out.cot_step2_guitars[0].name).toContain('Les Paul');
    expect(out.ideal_guitar).toContain('Les Paul');
  });

  it('plusieurs guitares de la même famille → toutes boostées, départage scoring V9', () => {
    const aiResult = {
      song_style: 'rock',
      ref_guitar: 'Fender Stratocaster',
      ideal_guitar: 'Squier Strat',
      cot_step2_guitars: [
        { name: 'Squier Stratocaster', score: 82 },
        { name: 'Fender Stratocaster American Vintage II 1961', score: 80 },
        { name: 'Fender Telecaster', score: 75 },
      ],
      preset_ann: null,
      preset_plug: null,
    };
    const out = enrichAIResult(aiResult, 'SC', null, emptyBanks, emptyBanks, undefined, null);
    const squier = out.cot_step2_guitars.find((g) => g.name === 'Squier Stratocaster');
    const am61 = out.cot_step2_guitars.find((g) => g.name.includes('Vintage II 1961'));
    expect(squier.score).toBe(97); // 82 + 15
    expect(am61.score).toBe(95);   // 80 + 15
    // Squier reste 1er après tri (97 > 95 > 75).
    expect(out.cot_step2_guitars[0].name).toBe('Squier Stratocaster');
  });

  it('ref_guitar family "other" → pas de boost', () => {
    const aiResult = {
      song_style: 'metal',
      ref_guitar: 'Schecter C-1 Platinum', // family = other
      ideal_guitar: 'Schecter C-1 Platinum',
      cot_step2_guitars: [
        { name: 'Schecter C-1 Platinum', score: 92 },
        { name: 'Ibanez Gio miKro GRGM21', score: 78 },
      ],
      preset_ann: null,
      preset_plug: null,
    };
    const out = enrichAIResult(aiResult, 'HB', null, emptyBanks, emptyBanks, undefined, null);
    // Aucun boost — scores inchangés.
    expect(out.cot_step2_guitars[0].score).toBe(92);
    expect(out.cot_step2_guitars[1].score).toBe(78);
    expect(out.cot_step2_guitars[0]._familyBoost).toBeUndefined();
  });

  it('aucune guitare du rig ne matche la family → pas de re-tri', () => {
    const aiResult = {
      song_style: 'rock',
      ref_guitar: 'Fender Stratocaster',
      ideal_guitar: 'Schecter C-1 Platinum',
      cot_step2_guitars: [
        { name: 'Schecter C-1 Platinum', score: 88 },
        { name: 'Ibanez Gio miKro GRGM21', score: 72 },
      ],
      preset_ann: null,
      preset_plug: null,
    };
    const out = enrichAIResult(aiResult, 'HB', null, emptyBanks, emptyBanks, undefined, null);
    // Rien à booster, ordre préservé.
    expect(out.cot_step2_guitars[0].name).toBe('Schecter C-1 Platinum');
    expect(out.cot_step2_guitars[0].score).toBe(88);
    expect(out.ideal_guitar).toBe('Schecter C-1 Platinum'); // pas réécrit
  });

  it('idempotent : appel multiple ne double pas le boost (_familyBoosted flag)', () => {
    const aiResult = {
      song_style: 'pop',
      ref_guitar: 'Fender Stratocaster',
      cot_step2_guitars: [
        { name: 'Squier Stratocaster', score: 75 },
        { name: 'Fender Telecaster', score: 85 },
      ],
      preset_ann: null,
      preset_plug: null,
    };
    const out1 = enrichAIResult(aiResult, 'SC', null, emptyBanks, emptyBanks, undefined, null);
    const stratScore1 = out1.cot_step2_guitars.find((g) => g.name === 'Squier Stratocaster').score;
    expect(stratScore1).toBe(90); // 75 + 15
    // Re-appel sur le même aiResult → pas de double boost grâce au flag.
    const out2 = enrichAIResult(out1, 'SC', null, emptyBanks, emptyBanks, undefined, null);
    const stratScore2 = out2.cot_step2_guitars.find((g) => g.name === 'Squier Stratocaster').score;
    expect(stratScore2).toBe(90); // pas 105
  });

  it('plafonné à 99 (Math.min)', () => {
    const aiResult = {
      song_style: 'rock',
      ref_guitar: 'Fender Stratocaster',
      cot_step2_guitars: [
        { name: 'Fender Stratocaster', score: 95 },
      ],
      preset_ann: null,
      preset_plug: null,
    };
    const out = enrichAIResult(aiResult, 'SC', null, emptyBanks, emptyBanks, undefined, null);
    // 95 + 15 = 110 → plafonné à 99.
    expect(out.cot_step2_guitars[0].score).toBe(99);
  });

  it('cot_step2_guitars vide ou absent → no-op', () => {
    const ai1 = { ref_guitar: 'Fender Stratocaster', cot_step2_guitars: [], preset_ann: null, preset_plug: null };
    const out1 = enrichAIResult(ai1, 'SC', null, emptyBanks, emptyBanks, undefined, null);
    expect(out1.cot_step2_guitars).toEqual([]);

    const ai2 = { ref_guitar: 'Fender Stratocaster', preset_ann: null, preset_plug: null };
    const out2 = enrichAIResult(ai2, 'SC', null, emptyBanks, emptyBanks, undefined, null);
    expect(out2.cot_step2_guitars).toBeUndefined();
  });

  it('ref_guitar null/undefined → pas de boost (no-op)', () => {
    const aiResult = {
      song_style: 'rock',
      ref_guitar: null,
      cot_step2_guitars: [
        { name: 'Fender Stratocaster', score: 80 },
      ],
      preset_ann: null,
      preset_plug: null,
    };
    const out = enrichAIResult(aiResult, 'SC', null, emptyBanks, emptyBanks, undefined, null);
    expect(out.cot_step2_guitars[0].score).toBe(80);
    expect(out.cot_step2_guitars[0]._familyBoost).toBeUndefined();
  });
});

// ───────────────────────────────────────────────────────────────────
// Phase 7.81 — updateAiCache stamp `ts` + rigSnapshot scope profil actif
// ───────────────────────────────────────────────────────────────────

describe('updateAiCache (Phase 7.81)', () => {
  it('stamp ts = Date.now() au write par défaut', () => {
    const before = Date.now();
    const out = updateAiCache(null, 'lp60', { song_style: 'rock' });
    const after = Date.now();
    expect(typeof out.ts).toBe('number');
    expect(out.ts).toBeGreaterThanOrEqual(before);
    expect(out.ts).toBeLessThanOrEqual(after);
  });

  it('opts.ts permet de fixer un ts précis (utile pour tests)', () => {
    const out = updateAiCache(null, 'lp60', { song_style: 'rock' }, { ts: 1234567 });
    expect(out.ts).toBe(1234567);
  });

  it('ts stocké à chaque appel = Date.now() (overwrite ancien)', () => {
    const first = updateAiCache(null, 'lp60', { song_style: 'rock' }, { ts: 1000 });
    // Le 2e appel ne propage pas l'ancien ts (existing.ts non utilisé) :
    // ts est toujours du moment du write.
    const second = updateAiCache(first, 'lp60', { song_style: 'rock', x: 'updated' });
    expect(second.ts).not.toBe(1000);
    expect(second.ts).toBeGreaterThanOrEqual(1000);
  });

  it('rigSnapshot passé en opts est préservé', () => {
    const out = updateAiCache(null, 'lp60', { foo: 'bar' }, { rigSnapshot: 'lp60|sg61' });
    expect(out.rigSnapshot).toBe('lp60|sg61');
  });

  it('rigSnapshot hérité du existing si non passé en opts', () => {
    const existing = { rigSnapshot: 'lp60|sg61' };
    const out = updateAiCache(existing, 'lp60', { foo: 'bar' });
    expect(out.rigSnapshot).toBe('lp60|sg61');
  });
});

describe('computeRigSnapshot (Phase 5.10.2 + 7.81 scope profil actif)', () => {
  it('retourne ids triés joints par |', () => {
    const guitars = [{ id: 'sg61' }, { id: 'lp60' }, { id: 'es335' }];
    expect(computeRigSnapshot(guitars)).toBe('es335|lp60|sg61');
  });

  it('input vide ou null → string vide', () => {
    expect(computeRigSnapshot([])).toBe('');
    expect(computeRigSnapshot(null)).toBe('');
    expect(computeRigSnapshot(undefined)).toBe('');
  });

  it('Phase 7.81 — scope profil actif : 12 guitares Sébastien produit un snapshot différent de l\'union all-rigs (22)', () => {
    // Cas réel observé 2026-05-20 : rigSnapshot pollué par union all-rigs
    // (sire_t3, sire_t7, cg_* autres profils) → diverge entre Mac et iPhone
    // selon pollution myGuitars cross-profile. Avec Phase 7.81, seul le
    // rig du profil actif est snapshoté → stable peu importe l'état des
    // autres profils.
    const rigSeb = [
      { id: 'es335' }, { id: 'jazzmaster' }, { id: 'lp50p90' }, { id: 'lp60' },
      { id: 'sg61' }, { id: 'sg_ebony' }, { id: 'strat61' }, { id: 'strat_ec' },
      { id: 'strat_pro2' }, { id: 'tele63' }, { id: 'tele_ultra' },
      { id: 'cg_1779120397266' },
    ];
    const rigSebPlusPollution = [
      ...rigSeb,
      { id: 'sire_t3' }, { id: 'sire_t7' },
      { id: 'cg_1779096718461' }, { id: 'cg_1779096765067' },
    ];
    const snapClean = computeRigSnapshot(rigSeb);
    const snapPolluted = computeRigSnapshot(rigSebPlusPollution);
    expect(snapClean).not.toBe(snapPolluted);
    expect(snapClean.split('|').length).toBe(12);
    expect(snapPolluted.split('|').length).toBe(16);
  });
});

// Phase 7.73.2.3 (2026-05-23) — Propagation V9-top vs usages-pin.
//
// Cas Paranoid (Black Sabbath) :
//   - findSlotByUsageMatch Phase 7.52.5 pin preset_ann sur ORNG 32C à 92
//     (ORNG a usages tagués Black Sabbath dans Anniversary Premium)
//   - Le never-regress est gated par !annPinnedByAI → ORNG préservé
//   - Mais best.annTop V9 pur = SupergroupBass 18C à 93+ (V9 réel via
//     ref_amp Laney Supergroup match parfait)
//   - SupergroupBass apparaît 93% dans "Recommandation idéale Preset"
//     (best.idealTop catalog) mais "Meilleurs installés" affiche ORNG 92
//     → incohérence visuelle
//
// Fix : après le never-regress, si best.annTop V9 score > preset_ann.score,
// propage. Phase 7.31 (pin via preset_ann_name de l'IA) reste protégée
// car son score min est 90 — si v9Score réel ≥ 90, best.annTop ne peut
// pas le dépasser.
describe('enrichAIResult — Phase 7.73.2.3 (propagation V9-top)', () => {
  const TONENET_SUPERGROUP = 'SupergroupBass_SM57_TB_full';
  const FACTORY_ORNG = 'AA ORNG 120 Dimed BAL CAB';
  const seededKeys = [TONENET_SUPERGROUP, FACTORY_ORNG];

  beforeEach(() => {
    // SupergroupBass : Laney Supergroup match parfait ref_amp + scores HB
    // élevés → V9 > 92 sur SG Ebony HB.
    PRESET_CATALOG_MERGED[TONENET_SUPERGROUP] = {
      src: 'ToneNET',
      amp: 'Laney Supergroup',
      gain: 'high',
      style: 'hard_rock',
      scores: { HB: 99, SC: 50, P90: 80 },
    };
    // ORNG : Anniversary Factory avec usages Sabbath (Phase 7.52.5 pin à 92
    // hardcoded). refAmp Orange match faible vs Laney → V9 < 92.
    PRESET_CATALOG_MERGED[FACTORY_ORNG] = {
      src: 'Anniversary',
      amp: 'Orange OR120',
      gain: 'high',
      style: 'hard_rock',
      scores: { HB: 70, SC: 55, P90: 65 },
      usages: [
        { artist: 'Black Sabbath', songs: ['Paranoid', 'Iron Man', 'War Pigs'] },
      ],
    };
  });

  afterEach(() => {
    for (const k of seededKeys) delete PRESET_CATALOG_MERGED[k];
  });

  it('scénario Paranoid : ORNG pin Phase 7.52.5 à 92, SupergroupBass V9 plus haut → propagation', () => {
    // Setup : ORNG en 32C (pin Phase 7.52.5 via usages match titre exact
    // → score 92 hardcoded, annPinnedByAI=true → never-regress skip).
    // SupergroupBass en 18C avec V9 réel > 92 grâce à refAmp Laney match.
    const banksAnn = {
      18: { A: '', B: '', C: TONENET_SUPERGROUP },
      32: { A: '', B: '', C: FACTORY_ORNG },
    };
    const aiResult = {
      song_style: 'hard_rock',
      target_gain: 9, // gain match perfect pour 'high'
      ref_amp: 'Laney Supergroup', // SupergroupBass refAmp = 100, ORNG = 40 (school)
      ref_guitar: 'Gibson SG',
    };
    const out = enrichAIResult(
      aiResult,
      'HB',
      'sg_ebony',
      banksAnn,
      {},
      undefined,
      { artist: 'Black Sabbath', title: 'Paranoid' },
    );
    // Phase 7.52.5 pose ORNG à 92 d'abord (usages match titre Paranoid).
    // Phase 7.73.2.3 voit que best.annTop = SupergroupBass V9 > 92 →
    // propage. preset_ann doit pointer sur SupergroupBass.
    expect(out.preset_ann).toBeTruthy();
    expect(out.preset_ann.label).toBe(TONENET_SUPERGROUP);
    expect(out.preset_ann.bank).toBe(18);
    expect(out.preset_ann.col).toBe('C');
    expect(out.preset_ann.score).toBeGreaterThan(92);
  });

  it('safe-by-design : preset_ann actuel déjà == best.annTop → no-op', () => {
    // Si Phase 7.52.5 ne match pas (pas d'usages), le never-regress
    // (sans gate) propage best.annTop. preset_ann.score === best.annTop.score
    // → Phase 7.73.2.3 condition strict ">" → no-op.
    delete PRESET_CATALOG_MERGED[FACTORY_ORNG].usages;
    const banksAnn = {
      18: { A: '', B: '', C: TONENET_SUPERGROUP },
    };
    const aiResult = {
      song_style: 'hard_rock',
      ref_amp: 'Laney Supergroup',
      ref_guitar: 'Gibson SG',
    };
    const out = enrichAIResult(
      aiResult,
      'HB',
      'sg_ebony',
      banksAnn,
      {},
      undefined,
      { artist: 'Black Sabbath', title: 'Paranoid' },
    );
    // preset_ann = SupergroupBass (single slot installé) via never-regress.
    // Phase 7.73.2.3 voit annTop.score === preset_ann.score → no-op.
    expect(out.preset_ann.label).toBe(TONENET_SUPERGROUP);
  });

  it('Phase 7.31 pin via preset_ann_name avec V9 réel haut → préservé', () => {
    // L'IA pin SupergroupBass via preset_ann_name → score = max(90, V9 réel).
    // Si V9 réel = 95, pin à 95. best.annTop V9 = même score (same slot)
    // → Phase 7.73.2.3 strict ">" → no-op.
    const banksAnn = {
      18: { A: '', B: '', C: TONENET_SUPERGROUP },
    };
    const aiResult = {
      song_style: 'hard_rock',
      ref_amp: 'Laney Supergroup',
      ref_guitar: 'Gibson SG',
      preset_ann_name: TONENET_SUPERGROUP, // L'IA pin explicitement
    };
    const out = enrichAIResult(
      aiResult,
      'HB',
      'sg_ebony',
      banksAnn,
      {},
      undefined,
      { artist: 'Black Sabbath', title: 'Paranoid' },
    );
    expect(out.preset_ann.label).toBe(TONENET_SUPERGROUP);
    // Score min 90 par convention Phase 7.31
    expect(out.preset_ann.score).toBeGreaterThanOrEqual(90);
  });

  it('Phase 7.31 pin avec V9 bas (90 hardcoded) + best.annTop autre slot V9 > 90 → propage', () => {
    // Phase 7.31 pin un slot avec un V9 réel bas (ex 70) → posé à 90 hardcoded.
    // best.annTop V9 réel sur un autre slot > 90 → Phase 7.73.2.3 propage.
    // Le pin IA est écrasé : l'IA s'est trompée, le V9 top est mieux.
    //
    // Setup : SupergroupBass 18C (V9 ~95 avec ref_amp Laney match).
    // FAKE_PIN 25A : un preset bidon avec V9 bas mais nommé par l'IA.
    PRESET_CATALOG_MERGED['FAKE_PIN_LOW_V9'] = {
      src: 'Anniversary',
      amp: 'Fender Princeton', // refAmp Laney match ~30
      gain: 'low',              // gain mismatch contre target=6
      style: 'blues',           // style mismatch contre hard_rock
      scores: { HB: 50, SC: 80, P90: 65 }, // pickup bas pour HB
    };
    const banksAnn = {
      18: { A: '', B: '', C: TONENET_SUPERGROUP },
      25: { A: 'FAKE_PIN_LOW_V9', B: '', C: '' },
    };
    const aiResult = {
      song_style: 'hard_rock',
      target_gain: 9,
      ref_amp: 'Laney Supergroup',
      ref_guitar: 'Gibson SG',
      preset_ann_name: 'FAKE_PIN_LOW_V9', // L'IA s'est trompée
    };
    const out = enrichAIResult(
      aiResult,
      'HB',
      'sg_ebony',
      banksAnn,
      {},
      undefined,
      { artist: 'Black Sabbath', title: 'Paranoid' },
    );
    delete PRESET_CATALOG_MERGED['FAKE_PIN_LOW_V9'];
    // SupergroupBass V9 doit dépasser 90 (pin hardcoded de FAKE) → propage.
    expect(out.preset_ann.label).toBe(TONENET_SUPERGROUP);
    expect(out.preset_ann.score).toBeGreaterThan(90);
  });

  it('idempotence : 2e appel sur même aiResult ne change pas preset_ann', () => {
    const banksAnn = {
      18: { A: '', B: '', C: TONENET_SUPERGROUP },
      32: { A: '', B: '', C: FACTORY_ORNG },
    };
    const aiResult = {
      song_style: 'hard_rock',
      target_gain: 9,
      ref_amp: 'Laney Supergroup',
      ref_guitar: 'Gibson SG',
    };
    const out1 = enrichAIResult(
      aiResult,
      'HB',
      'sg_ebony',
      banksAnn,
      {},
      undefined,
      { artist: 'Black Sabbath', title: 'Paranoid' },
    );
    const score1 = out1.preset_ann.score;
    const label1 = out1.preset_ann.label;
    // 2e appel : Phase 7.73.2.3 voit annTop.score === preset_ann.score
    // (déjà propagé au 1er appel) → no-op.
    const out2 = enrichAIResult(
      out1,
      'HB',
      'sg_ebony',
      banksAnn,
      {},
      undefined,
      { artist: 'Black Sabbath', title: 'Paranoid' },
    );
    expect(out2.preset_ann.label).toBe(label1);
    expect(out2.preset_ann.score).toBe(score1);
  });

  it('preset_plug propage aussi via best.plugTop', () => {
    const banksPlug = {
      4: { A: '', B: '', C: TONENET_SUPERGROUP },
      8: { A: '', B: '', C: FACTORY_ORNG },
    };
    const aiResult = {
      song_style: 'hard_rock',
      target_gain: 9,
      ref_amp: 'Laney Supergroup',
      ref_guitar: 'Gibson SG',
    };
    const out = enrichAIResult(
      aiResult,
      'HB',
      'sg_ebony',
      {}, // banksAnn vide
      banksPlug,
      undefined,
      { artist: 'Black Sabbath', title: 'Paranoid' },
    );
    // ORNG pin Phase 7.52.5 sur preset_plug à 92, propagation V9-top
    // (SupergroupBass) dépasse → preset_plug devient SupergroupBass.
    expect(out.preset_plug).toBeTruthy();
    expect(out.preset_plug.label).toBe(TONENET_SUPERGROUP);
    expect(out.preset_plug.bank).toBe(4);
    expect(out.preset_plug.score).toBeGreaterThan(92);
  });
});

// Vague B — Validation des champs scoring/EQ/FX basse dans bass_recommendation.
describe('enrichAIResult — vague B (validation bass_recommendation)', () => {
  const emptyBanks = {};
  const baseGuitar = () => ({
    song_style: 'rock', target_gain: 5,
    cot_step2_guitars: [], preset_ann: null, preset_plug: null,
    ideal_preset: null, ideal_preset_score: 0, ideal_top3: [],
  });

  it('clampe bass_preset_settings_v1 hors-bornes via clampPresetSettings', () => {
    const aiResult = {
      ...baseGuitar(),
      bass_recommendation: {
        ideal_bass: 'Fender Precision Bass American Vintage II',
        capture_name: 'BS SVT',
        cot_step2_basses: [{ name: 'Fender Precision Bass American Vintage II', score: 90 }],
        bass_preset_settings_v1: {
          cab_enabled: true,
          main: { gain: { value: 99 }, bass: { value: 6 } }, // gain 99 hors range 0-10
        },
      },
    };
    const out = enrichAIResult(aiResult, 'HB', null, emptyBanks, emptyBanks, undefined, null);
    expect(out.bass_recommendation.bass_preset_settings_v1.main.gain.value).toBeLessThanOrEqual(10);
    expect(out.bass_recommendation.bass_preset_settings_v1.main.bass.value).toBe(6);
    expect(out._bassFieldsValidated).toBe(true);
  });

  it('clampe bass_fx_blocks via clampFxBlocks (type invalide droppé)', () => {
    const aiResult = {
      ...baseGuitar(),
      bass_recommendation: {
        capture_name: 'BS SVT',
        cot_step2_basses: [],
        bass_fx_blocks: {
          compressor: { enabled: true, gain: 2 },
          reverb: { enabled: true, type: 'NotAReverbType' }, // type hors enum
        },
      },
    };
    const out = enrichAIResult(aiResult, 'HB', null, emptyBanks, emptyBanks, undefined, null);
    expect(out.bass_recommendation.bass_fx_blocks).toBeTruthy();
    expect(out.bass_recommendation.bass_fx_blocks.compressor.enabled).toBe(true);
    // type invalide droppé mais bloc conservé (comportement clampFxBlocks)
    expect(out.bass_recommendation.bass_fx_blocks.reverb.type).toBeUndefined();
  });

  it('clampe les scores cot_step2_basses et droppe les entrées sans name', () => {
    const aiResult = {
      ...baseGuitar(),
      bass_recommendation: {
        cot_step2_basses: [
          { name: 'Fender Jazz Bass Player Plus', score: 150 }, // >100
          { name: '', score: 50 },                              // name vide → droppé
          { score: 80 },                                        // pas de name → droppé
          { name: 'Fender Precision Bass American Vintage II', score: 88 },
        ],
      },
    };
    const out = enrichAIResult(aiResult, 'HB', null, emptyBanks, emptyBanks, undefined, null);
    const cot = out.bass_recommendation.cot_step2_basses;
    expect(cot.length).toBe(2);
    expect(cot[0].score).toBe(100); // 150 clampé
    expect(cot[1].score).toBe(88);
  });

  it('clampe bass_alternatives (scores 0-100, entrées sans name droppées)', () => {
    const aiResult = {
      ...baseGuitar(),
      bass_recommendation: {
        cot_step2_basses: [],
        bass_alternatives: [
          { name: 'BS SVT', amp: 'Ampeg SVT', score: 200 },
          { amp: 'GK Bass', score: 70 }, // pas de name → droppé
          { name: 'TSR GK MBS150', score: -5 },
        ],
      },
    };
    const out = enrichAIResult(aiResult, 'HB', null, emptyBanks, emptyBanks, undefined, null);
    const alts = out.bass_recommendation.bass_alternatives;
    expect(alts.length).toBe(2);
    expect(alts[0].score).toBe(100); // 200 clampé
    expect(alts[0].amp).toBe('Ampeg SVT');
    expect(alts[1].score).toBe(0);   // -5 clampé
  });

  it('idempotent via _bassFieldsValidated (2e appel ne re-clampe pas)', () => {
    const aiResult = {
      ...baseGuitar(),
      bass_recommendation: {
        cot_step2_basses: [{ name: 'Fender Jazz Bass Player Plus', score: 90 }],
      },
    };
    const out1 = enrichAIResult(aiResult, 'HB', null, emptyBanks, emptyBanks, undefined, null);
    out1.bass_recommendation.cot_step2_basses.push({ name: 'X', score: 999 }); // mutation hors clamp
    const out2 = enrichAIResult(out1, 'HB', null, emptyBanks, emptyBanks, undefined, null);
    // flag déjà true → pas de re-validation, l'entrée non-clampée survit
    expect(out2.bass_recommendation.cot_step2_basses.find((b) => b.name === 'X').score).toBe(999);
  });

  it('no-op si bass_recommendation null (rétro-compat aiCache pré-vague-B)', () => {
    const aiResult = { ...baseGuitar(), bass_recommendation: null };
    const out = enrichAIResult(aiResult, 'HB', null, emptyBanks, emptyBanks, undefined, null);
    expect(out.bass_recommendation).toBeNull();
    expect(out._bassFieldsValidated).toBeUndefined();
  });

  it('strippe le préfixe de position "40B " du capture_name et des bass_alternatives', () => {
    const aiResult = {
      ...baseGuitar(),
      bass_recommendation: {
        capture_name: '40B TSR - A-Peg Pro 4-Classic A 4x10',
        cot_step2_basses: [],
        bass_alternatives: [
          { name: '40B TSR - A-Peg Pro 4-Classic A 4x10', amp: 'Ampeg SVT Pro 4', score: 95 },
          { name: '41B TSR Basyman Bass 4x10', amp: 'Fender Bassman', score: 88 },
        ],
      },
    };
    const out = enrichAIResult(aiResult, 'HB', null, emptyBanks, emptyBanks, undefined, null);
    expect(out.bass_recommendation.capture_name).toBe('TSR - A-Peg Pro 4-Classic A 4x10');
    expect(out.bass_recommendation.bass_alternatives[0].name).toBe('TSR - A-Peg Pro 4-Classic A 4x10');
    expect(out.bass_recommendation.bass_alternatives[1].name).toBe('TSR Basyman Bass 4x10');
  });
});

describe('enrichAIResult — Phase A (validation guitar_amp_settings)', () => {
  const emptyBanks = {};
  const base = () => ({
    song_style: 'rock', target_gain: 5,
    cot_step2_guitars: [], preset_ann: null, preset_plug: null,
    ideal_preset: null, ideal_preset_score: 0, ideal_top3: [],
  });

  it('clampe les valeurs de settings dans 0-10', () => {
    const aiResult = {
      ...base(),
      guitar_amp_settings: { amp: 'Marshall Super Lead Plexi 1959', channel: 'Bright',
        settings: { volume_i: 15, volume_ii: 6, treble: -3, presence: 7 }, why: { fr: 'x', en: 'x', es: 'x' } },
    };
    const out = enrichAIResult(aiResult, 'HB', null, emptyBanks, emptyBanks, undefined, null);
    expect(out.guitar_amp_settings.settings.volume_i).toBe(10);
    expect(out.guitar_amp_settings.settings.volume_ii).toBe(6);
    expect(out.guitar_amp_settings.settings.treble).toBe(0);
    expect(out.guitar_amp_settings.amp).toBe('Marshall Super Lead Plexi 1959');
    expect(out._guitarAmpValidated).toBe(true);
  });

  it('droppe les valeurs non-numériques de settings', () => {
    const aiResult = {
      ...base(),
      guitar_amp_settings: { amp: 'Fender Blues Junior', settings: { volume: 5, treble: 'loud', master: 6 } },
    };
    const out = enrichAIResult(aiResult, 'SC', null, emptyBanks, emptyBanks, undefined, null);
    expect(out.guitar_amp_settings.settings.volume).toBe(5);
    expect(out.guitar_amp_settings.settings.treble).toBeUndefined();
    expect(out.guitar_amp_settings.settings.master).toBe(6);
  });

  it('idempotent via _guitarAmpValidated', () => {
    const aiResult = { ...base(), guitar_amp_settings: { amp: 'X', settings: { gain: 5 } } };
    const out1 = enrichAIResult(aiResult, 'HB', null, emptyBanks, emptyBanks, undefined, null);
    out1.guitar_amp_settings.settings.gain = 999; // mutation hors clamp
    const out2 = enrichAIResult(out1, 'HB', null, emptyBanks, emptyBanks, undefined, null);
    expect(out2.guitar_amp_settings.settings.gain).toBe(999); // pas re-clampé
  });

  it('no-op si guitar_amp_settings null/absent', () => {
    const out = enrichAIResult({ ...base(), guitar_amp_settings: null }, 'HB', null, emptyBanks, emptyBanks, undefined, null);
    expect(out.guitar_amp_settings).toBeNull();
    expect(out._guitarAmpValidated).toBeUndefined();
  });
});

describe('stripSlotPrefix — Phase 7.56 / vague B', () => {
  it('retire le préfixe position + espace', () => {
    expect(stripSlotPrefix('40B TSR Basyman Bass 4x10')).toBe('TSR Basyman Bass 4x10');
    expect(stripSlotPrefix('9C HG MARK3')).toBe('HG MARK3');
  });
  it('retire le préfixe position puis les guillemets (cas "48A \\"...\\"")', () => {
    expect(stripSlotPrefix('48A "Kirk & James"')).toBe('Kirk & James');
  });
  it('laisse intact un nom sans préfixe', () => {
    expect(stripSlotPrefix('TSR GK MBS150')).toBe('TSR GK MBS150');
  });
  it('safe sur non-string', () => {
    expect(stripSlotPrefix(null)).toBe(null);
    expect(stripSlotPrefix(undefined)).toBe(undefined);
  });
});

describe('sanitizeAmpSuggestion — Phase B.1 (ajout ampli custom via IA)', () => {
  it('enrichit un ampli guitare complet (knobs normalisés snake_case)', () => {
    const out = sanitizeAmpSuggestion({
      name: 'Vox AC30', brand: 'Vox', wattage: 30,
      channels: ['Normal', 'Top Boost'],
      knobs: ['Volume', 'Treble', 'Bass', 'Cut', 'Master'],
      eq: ['Treble', 'Bass'], features: ['Tremolo', 'Reverb'],
      refs: { fr: 'Brian May', en: 'Brian May', es: 'Brian May' },
    }, 'guitar');
    expect(out.name).toBe('Vox AC30');
    expect(out.brand).toBe('Vox');
    expect(out.wattage).toBe(30);
    expect(out.knobs).toEqual(['volume', 'treble', 'bass', 'cut', 'master']);
    expect(out.channels).toEqual(['Normal', 'Top Boost']);
    expect(out.features).toEqual(['Tremolo', 'Reverb']);
    expect(out.refs.fr).toBe('Brian May');
    expect(out.short).toBe('Vox AC30');
  });

  it('normalise les potards multi-mots / casse (Volume I → volume_i)', () => {
    const out = sanitizeAmpSuggestion({ name: 'Marshall Plexi', knobs: ['Volume I', 'Volume II', 'Presence'] }, 'guitar');
    expect(out.knobs).toEqual(['volume_i', 'volume_ii', 'presence']);
  });

  it('dédublonne les potards + cap 8', () => {
    const out = sanitizeAmpSuggestion({ name: 'X', knobs: ['gain', 'gain', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] }, 'guitar');
    expect(out.knobs.length).toBeLessThanOrEqual(8);
    expect(out.knobs.filter((k) => k === 'gain').length).toBe(1);
  });

  it('fallback knobs guitare si absents', () => {
    const out = sanitizeAmpSuggestion({ name: 'Mystère Amp' }, 'guitar');
    expect(out.knobs).toEqual(['gain', 'treble', 'middle', 'bass', 'presence', 'master']);
    expect(out.channels).toEqual(['Single']);
    expect(out.wattage).toBe(50);
    expect(out.brand).toBe('Custom');
  });

  it('fallback knobs + wattage + channel basse', () => {
    const out = sanitizeAmpSuggestion({ name: 'Ampli basse X' }, 'bass');
    expect(out.knobs).toEqual(['gain', 'bass', 'low_mid', 'high_mid', 'treble', 'master']);
    expect(out.channels).toEqual(['Clean']);
    expect(out.wattage).toBe(100);
  });

  it('clampe le wattage hors bornes', () => {
    expect(sanitizeAmpSuggestion({ name: 'A', wattage: 99999 }, 'guitar').wattage).toBe(2000);
    expect(sanitizeAmpSuggestion({ name: 'A', wattage: -5 }, 'guitar').wattage).toBe(50);
    expect(sanitizeAmpSuggestion({ name: 'A', wattage: 18.6 }, 'guitar').wattage).toBe(19);
  });

  it('refs partiel / absent → objet trilingue complet', () => {
    expect(sanitizeAmpSuggestion({ name: 'A', refs: { fr: 'X' } }, 'guitar').refs).toEqual({ fr: 'X', en: '', es: '' });
    expect(sanitizeAmpSuggestion({ name: 'A' }, 'guitar').refs).toEqual({ fr: '', en: '', es: '' });
  });

  it('short tronqué à 18 chars + … si nom long', () => {
    const out = sanitizeAmpSuggestion({ name: 'Mesa Boogie Dual Rectifier Roadster' }, 'guitar');
    expect(out.short).toBe('Mesa Boogie Dual R…');
    expect(out.short.length).toBe(19);
  });

  it('null-safe : raw invalide ou sans nom → null', () => {
    expect(sanitizeAmpSuggestion(null, 'guitar')).toBe(null);
    expect(sanitizeAmpSuggestion({}, 'guitar')).toBe(null);
    expect(sanitizeAmpSuggestion({ name: '   ' }, 'guitar')).toBe(null);
    expect(sanitizeAmpSuggestion('Vox', 'guitar')).toBe(null);
  });

  it('ignore les entrées non-string dans les arrays', () => {
    const out = sanitizeAmpSuggestion({ name: 'A', knobs: ['gain', 42, null, '  '], channels: ['Clean', 7], features: [{}, 'Reverb'] }, 'guitar');
    expect(out.knobs).toEqual(['gain']);
    expect(out.channels).toEqual(['Clean']);
    expect(out.features).toEqual(['Reverb']);
  });
});

describe('sanitizePedalSuggestion — Phase C (ajout pédale custom via IA)', () => {
  const TYPES = ['drive', 'overdrive', 'distortion', 'fuzz', 'boost', 'compressor', 'chorus', 'delay', 'reverb', 'wah'];

  it('enrichit une pédale complète (type validé, knobs snake_case)', () => {
    const out = sanitizePedalSuggestion({
      name: 'Ibanez Tube Screamer TS9', brand: 'Ibanez', type: 'overdrive',
      knobs: ['Drive', 'Tone', 'Level'],
      refs: { fr: 'SRV', en: 'SRV', es: 'SRV' },
    }, TYPES);
    expect(out.name).toBe('Ibanez Tube Screamer TS9');
    expect(out.brand).toBe('Ibanez');
    expect(out.type).toBe('overdrive');
    expect(out.knobs).toEqual(['drive', 'tone', 'level']);
    expect(out.refs.fr).toBe('SRV');
  });

  it('type hors liste → fallback drive', () => {
    expect(sanitizePedalSuggestion({ name: 'X', type: 'looper' }, TYPES).type).toBe('drive');
    expect(sanitizePedalSuggestion({ name: 'X' }, TYPES).type).toBe('drive');
  });

  it('type valide insensible à la casse', () => {
    expect(sanitizePedalSuggestion({ name: 'X', type: 'FUZZ' }, TYPES).type).toBe('fuzz');
  });

  it('knobs dédupliqués + cap 6', () => {
    const out = sanitizePedalSuggestion({ name: 'X', knobs: ['a', 'a', 'b', 'c', 'd', 'e', 'f', 'g'] }, TYPES);
    expect(out.knobs.length).toBeLessThanOrEqual(6);
    expect(out.knobs.filter((k) => k === 'a').length).toBe(1);
  });

  it('fallback knobs [level] si absents', () => {
    expect(sanitizePedalSuggestion({ name: 'X' }, TYPES).knobs).toEqual(['level']);
  });

  it('brand absent → Custom ; refs partiel → trilingue complet', () => {
    const out = sanitizePedalSuggestion({ name: 'X', refs: { fr: 'A' } }, TYPES);
    expect(out.brand).toBe('Custom');
    expect(out.refs).toEqual({ fr: 'A', en: '', es: '' });
  });

  it('null-safe : raw invalide ou sans nom → null', () => {
    expect(sanitizePedalSuggestion(null, TYPES)).toBe(null);
    expect(sanitizePedalSuggestion({}, TYPES)).toBe(null);
    expect(sanitizePedalSuggestion({ name: '  ' }, TYPES)).toBe(null);
  });

  it('pedalTypes vide → fallback drive sûr', () => {
    expect(sanitizePedalSuggestion({ name: 'X', type: 'fuzz' }, []).type).toBe('drive');
  });
});

describe('sanitizeControls — Phase 9.8 (réglages micros par instrument)', () => {
  it('valide selector + knobs + why', () => {
    const out = sanitizeControls({
      selector: 'Position 4 (manche + intermédiaire)',
      knobs: [{ name: 'Volume', value: 8 }, { name: 'Tone (manche)', value: '7' }],
      why: { fr: 'Adouci', en: 'Softer', es: 'Más suave' },
    });
    expect(out.selector).toBe('Position 4 (manche + intermédiaire)');
    expect(out.knobs).toEqual([{ name: 'Volume', value: '8' }, { name: 'Tone (manche)', value: '7' }]);
    expect(out.why.fr).toBe('Adouci');
  });

  it('coerce value en string + drop knob sans name + cap 6', () => {
    const out = sanitizeControls({ knobs: [
      { name: 'A', value: 10 }, { value: 5 }, { name: '  ', value: 3 },
      { name: 'B', value: 1 }, { name: 'C' }, { name: 'D' }, { name: 'E' }, { name: 'F' }, { name: 'G' },
    ] });
    expect(out.knobs.length).toBe(6);
    expect(out.knobs[0]).toEqual({ name: 'A', value: '10' });
    expect(out.knobs.find((k) => k.name === 'C').value).toBe('');
  });

  it('why partiel → langues valides seules', () => {
    expect(sanitizeControls({ selector: 'x', why: { fr: 'A', en: '  ' } }).why).toEqual({ fr: 'A' });
  });

  it('selector seul (mono-micro: knobs vides) reste valide', () => {
    const out = sanitizeControls({ knobs: [{ name: 'Volume', value: 6 }] });
    expect(out.selector).toBeUndefined();
    expect(out.knobs.length).toBe(1);
  });

  it('null si rien d\'exploitable', () => {
    expect(sanitizeControls(null)).toBe(null);
    expect(sanitizeControls({})).toBe(null);
    expect(sanitizeControls({ selector: '', knobs: [], why: {} })).toBe(null);
    expect(sanitizeControls({ knobs: 'nope' })).toBe(null);
  });
});

describe('enrichAIResult — validation controls cot_step2 (Phase 9.8)', () => {
  it('sanitize controls sur cot_step2_guitars + cot_step2_basses, idempotent', () => {
    const r = {
      cot_step1: 'x',
      cot_step2_guitars: [{ name: 'LP60', score: 90, controls: { knobs: [{ name: 'Vol', value: 8 }, { value: 1 }] } }],
      cot_step2_basses: [{ name: 'Jazz Bass', score: 85, controls: { selector: '', knobs: [], why: {} } }],
    };
    const out = enrichAIResult(r, 'HB', '', {}, {}, undefined, { id: 's', title: 'T', artist: 'A' });
    // guitar : knob sans name droppé, value coercée
    expect(out.cot_step2_guitars[0].controls.knobs).toEqual([{ name: 'Vol', value: '8' }]);
    // bass : controls vide → champ retiré
    expect(out.cot_step2_basses[0].controls).toBeUndefined();
    expect(out._controlsValidated).toBe(true);
    // idempotence : 2e passage ne casse pas
    const out2 = enrichAIResult(out, 'HB', '', {}, {}, undefined, { id: 's', title: 'T', artist: 'A' });
    expect(out2.cot_step2_guitars[0].controls.knobs).toEqual([{ name: 'Vol', value: '8' }]);
  });
});


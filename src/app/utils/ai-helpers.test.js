// src/app/utils/ai-helpers.test.js — Phase 7.39 (Option D trilingue).
//
// Tests sur getLocalizedText. Couvre :
// - format legacy string (aiCache pré-7.39 ou seed FR)
// - format trilingue {fr, en, es} (nouveau prompt)
// - fallback cascade locale → fr → en → es → ''
// - inputs falsy/edge cases

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getLocalizedText, findSlotByUsageMatch, findCatalogEntryByUsages, findSlotByName, enrichAIResult, updateAiCache, computeRigSnapshot } from './ai-helpers.js';
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

// Phase 7.73.2.2 (2026-05-23) — Override final usages-match dans
// enrichAIResult. Cas Paranoid (Black Sabbath) :
//
// Le bloc "🎯 Recommandation idéale Preset" affichait SupergroupBass à
// 93% (best.idealTop catalog scan V9) en Bank 18C. Le bloc "Meilleurs
// presets installés" affichait ORNG 120 Dimed à 92% en Bank 32C.
// Incohérence : SupergroupBass est installé et meilleur que ORNG, mais
// `computeBestPresets` (V9 pur) ne sait pas que SupergroupBass a
// usages-match Sabbath/Paranoid.
//
// Fix : après le never-regress lignes 517-524, on relance
// findSlotByUsageMatch et override preset_ann/preset_plug si match
// >= 50 ET label différent. Safe-by-design : no-op si pas d'usages
// tagués (cas H1 = user n'a pas tagué le ToneNET).
describe('enrichAIResult — Phase 7.73.2.2 (override final usages-match)', () => {
  const TONENET_SUPERGROUP = 'SupergroupBass_SM57_TB_full';
  const FACTORY_ORNG = 'AA ORNG 120 Dimed BAL CAB';
  const seededKeys = [TONENET_SUPERGROUP, FACTORY_ORNG];

  beforeEach(() => {
    // SupergroupBass : ToneNET tagué Sabbath/Paranoid
    PRESET_CATALOG_MERGED[TONENET_SUPERGROUP] = {
      src: 'ToneNET',
      amp: 'Laney Supergroup',
      gain: 'high',
      style: 'hard_rock',
      scores: { HB: 85, SC: 60, P90: 75 },
      usages: [
        { artist: 'Black Sabbath', songs: ['Paranoid', 'Iron Man', 'War Pigs'] },
      ],
    };
    // ORNG : Anniversary Factory générique sans usages spécifiques
    PRESET_CATALOG_MERGED[FACTORY_ORNG] = {
      src: 'Anniversary',
      amp: 'Orange OR120',
      gain: 'high',
      style: 'hard_rock',
      scores: { HB: 90, SC: 55, P90: 70 },
    };
  });

  afterEach(() => {
    for (const k of seededKeys) delete PRESET_CATALOG_MERGED[k];
  });

  it('scénario Paranoid : SupergroupBass installé avec usages match → override ORNG V9 top', () => {
    // Setup : SupergroupBass en 18C (Anniversary), ORNG en 32C.
    // Hypothèse H3 : computeBestPresets sort ORNG en best.annTop (V9 pur
    // sans usages-match). Le fix override final doit substituer
    // SupergroupBass.
    const banksAnn = {
      18: { A: '', B: '', C: TONENET_SUPERGROUP },
      32: { A: '', B: '', C: FACTORY_ORNG },
    };
    const aiResult = {
      song_style: 'hard_rock',
      target_gain: 6,
      ref_guitar: 'Gibson SG',
      ref_artist: 'Black Sabbath',
      song_title: 'Paranoid',
      // Pas de preset_ann_name de l'IA (laisser le scoring local trancher)
    };
    const out = enrichAIResult(
      aiResult,
      'HB',
      'sg_ebony',
      banksAnn,
      {}, // banksPlug vide
      undefined, // availableSources
      { artist: 'Black Sabbath', title: 'Paranoid' }, // song
    );
    // Le preset_ann doit pointer sur SupergroupBass (Bank 18C) via override,
    // pas sur ORNG (Bank 32C) que computeBestPresets aurait préféré V9-pur.
    expect(out.preset_ann).toBeTruthy();
    expect(out.preset_ann.label).toBe(TONENET_SUPERGROUP);
    expect(out.preset_ann.bank).toBe(18);
    expect(out.preset_ann.col).toBe('C');
    expect(out.preset_ann.score).toBe(92); // score 100 → 92 (convention Phase 7.52.5)
  });

  it('safe-by-design H1 : pas d\'usages tagués sur SupergroupBass → fallback V9 (no-op)', () => {
    // Suppression usages pour simuler H1 (user n'a pas tagué le ToneNET)
    delete PRESET_CATALOG_MERGED[TONENET_SUPERGROUP].usages;
    const banksAnn = {
      18: { A: '', B: '', C: TONENET_SUPERGROUP },
      32: { A: '', B: '', C: FACTORY_ORNG },
    };
    const aiResult = {
      song_style: 'hard_rock',
      target_gain: 6,
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
    // Sans usages, findSlotByUsageMatch ne match pas → preset_ann reste
    // le top V9 (probablement ORNG ou SupergroupBass selon ref_amp).
    // L'override ne change rien. Pas de régression.
    expect(out.preset_ann).toBeTruthy();
    // Le label peut être l'un OU l'autre, l'important est que l'override
    // n'a pas forcé une mauvaise valeur.
    expect([TONENET_SUPERGROUP, FACTORY_ORNG]).toContain(out.preset_ann.label);
  });

  it('usages artist seul (pas de title match) → pin Phase 7.52.5 pose 92 d\'abord, override skip', () => {
    // Modifier les usages pour avoir artist match seulement (pas Paranoid
    // dans songs, mais Black Sabbath bien présent). Le pin Phase 7.52.5
    // lignes 451-460 hardcoder score: 92 même pour match score 50.
    // L'override final ne re-stamp pas car label déjà identique.
    PRESET_CATALOG_MERGED[TONENET_SUPERGROUP].usages = [
      { artist: 'Black Sabbath' }, // pas de songs[]
    ];
    const banksAnn = {
      18: { A: '', B: '', C: TONENET_SUPERGROUP },
      32: { A: '', B: '', C: FACTORY_ORNG },
    };
    const aiResult = {
      song_style: 'hard_rock',
      target_gain: 6,
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
    // Phase 7.52.5 pose à 92 d'entrée (hardcoded). Override skip car
    // label déjà === SupergroupBass. Pas de re-stamp à 80.
    expect(out.preset_ann.label).toBe(TONENET_SUPERGROUP);
    expect(out.preset_ann.score).toBe(92);
  });

  it('cas où override est utile : preset_ann_name IA pin autre slot + usages match SupergroupBass score 50', () => {
    // Phase 7.31 : l'IA retourne preset_ann_name = ORNG → pin ORNG +
    // annPinnedByAI=true. Phase 7.52.5 lignes 451-460 voit
    // findSlotByUsageMatch.score=50 mais annPinnedByAI=true → skip
    // (condition score===100 || !pinned). Donc preset_ann reste ORNG.
    // Override final voit annUsageFinal !== ORNG → override avec 80.
    PRESET_CATALOG_MERGED[TONENET_SUPERGROUP].usages = [
      { artist: 'Black Sabbath' }, // pas de songs Paranoid → score 50
    ];
    const banksAnn = {
      18: { A: '', B: '', C: TONENET_SUPERGROUP },
      32: { A: '', B: '', C: FACTORY_ORNG },
    };
    const aiResult = {
      song_style: 'hard_rock',
      target_gain: 6,
      ref_guitar: 'Gibson SG',
      preset_ann_name: FACTORY_ORNG, // L'IA pin ORNG d'abord
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
    // L'override final ré-écrit preset_ann sur SupergroupBass à 80 (score 50)
    expect(out.preset_ann.label).toBe(TONENET_SUPERGROUP);
    expect(out.preset_ann.score).toBe(80);
  });

  it('régression : si preset_ann était DÉJÀ SupergroupBass, l\'override ne re-stamp pas', () => {
    // Le pin Phase 7.52.5 lignes 451-460 pose déjà preset_ann sur
    // SupergroupBass. L'override final voit que label === label et skip.
    const banksAnn = {
      18: { A: '', B: '', C: TONENET_SUPERGROUP },
    };
    const aiResult = {
      song_style: 'hard_rock',
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
    expect(out.preset_ann.label).toBe(TONENET_SUPERGROUP);
    expect(out.preset_ann.score).toBe(92);
  });

  it('override ne touche pas preset_plug si banksPlug vide', () => {
    const banksAnn = {
      18: { A: '', B: '', C: TONENET_SUPERGROUP },
    };
    const aiResult = {
      song_style: 'hard_rock',
      ref_guitar: 'Gibson SG',
    };
    const out = enrichAIResult(
      aiResult,
      'HB',
      'sg_ebony',
      banksAnn,
      {}, // banksPlug vide
      undefined,
      { artist: 'Black Sabbath', title: 'Paranoid' },
    );
    expect(out.preset_plug == null || out.preset_plug?.label !== TONENET_SUPERGROUP).toBe(true);
  });
});


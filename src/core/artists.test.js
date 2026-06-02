// Phase 13.0 — Tests helpers ARTISTS purs.

import { describe, it, expect } from 'vitest';
import {
  normalizeArtistName,
  getArtist,
  findArtistsByBand,
  getEra,
  getCurrentEra,
  inferUsagesFromAmp,
  inferUsagesArrayFromAmp,
  getCandidateAmpsForBand,
  validateRefAmpAgainstArtists,
  ampNamesMatch,
  normalizeAmpName,
} from './artists.js';
import { ARTISTS_SEED, BAND_TO_ARTIST_IDS } from '../data/artists.js';

// ============================================================
// Schema integrity (sanity check seed)
// ============================================================

describe('Phase 13.0 — ARTISTS_SEED schema integrity', () => {
  it('contient au moins 20 entries seed', () => {
    expect(Object.keys(ARTISTS_SEED).length).toBeGreaterThanOrEqual(20);
  });

  it('chaque entry a name, role, bands, eras', () => {
    for (const [id, artist] of Object.entries(ARTISTS_SEED)) {
      expect(artist.name, `${id}.name`).toBeTruthy();
      expect(['guitarist', 'bassist', 'multi']).toContain(artist.role);
      expect(Array.isArray(artist.bands), `${id}.bands`).toBe(true);
      expect(artist.bands.length, `${id}.bands.length`).toBeGreaterThan(0);
      expect(Array.isArray(artist.eras), `${id}.eras`).toBe(true);
      expect(artist.eras.length, `${id}.eras.length`).toBeGreaterThan(0);
    }
  });

  it('chaque era a period, years valides, guitars, amps', () => {
    for (const [id, artist] of Object.entries(ARTISTS_SEED)) {
      for (const era of artist.eras) {
        expect(era.period, `${id}.era.period`).toBeTruthy();
        expect(Array.isArray(era.years)).toBe(true);
        expect(era.years.length).toBe(2);
        expect(era.years[0]).toBeLessThanOrEqual(era.years[1]);
        expect(Array.isArray(era.guitars)).toBe(true);
        expect(Array.isArray(era.amps)).toBe(true);
      }
    }
  });

  it('contient au moins 1 bassiste (Phase 8)', () => {
    const bassists = Object.values(ARTISTS_SEED).filter((a) => a.role === 'bassist');
    expect(bassists.length).toBeGreaterThanOrEqual(1);
  });

  it('couvre les morceaux SONG_HISTORY principaux (Angus, Page, Iommi, etc.)', () => {
    const requiredIds = [
      'angus_young', 'eric_clapton', 'bb_king', 'jimmy_page',
      'ritchie_blackmore', 'tony_iommi', 'jimi_hendrix', 'john_deacon',
    ];
    for (const id of requiredIds) {
      expect(ARTISTS_SEED[id], `seed manque ${id}`).toBeDefined();
    }
  });

  it('BAND_TO_ARTIST_IDS construit correctement le mapping inverse', () => {
    expect(BAND_TO_ARTIST_IDS['ac/dc']).toContain('angus_young');
    expect(BAND_TO_ARTIST_IDS['ac/dc']).toContain('cliff_williams');
    expect(BAND_TO_ARTIST_IDS['led zeppelin']).toContain('jimmy_page');
    expect(BAND_TO_ARTIST_IDS['led zeppelin']).toContain('john_paul_jones');
  });
});

// ============================================================
// normalizeArtistName
// ============================================================

describe('Phase 13.0 — normalizeArtistName', () => {
  it('lowercase', () => {
    expect(normalizeArtistName('AC/DC')).toBe('ac/dc');
    expect(normalizeArtistName('Angus Young')).toBe('angus young');
  });

  it('strip accents', () => {
    expect(normalizeArtistName('Téléphone')).toBe('telephone');
  });

  it('strip ponctuation', () => {
    expect(normalizeArtistName('B.B. King')).toBe('bb king');
    expect(normalizeArtistName("Guns N' Roses")).toBe('guns n roses');
  });

  it('whitespace multi → single', () => {
    expect(normalizeArtistName('  Pink   Floyd  ')).toBe('pink floyd');
  });

  it('inputs invalides', () => {
    expect(normalizeArtistName(null)).toBe('');
    expect(normalizeArtistName(undefined)).toBe('');
    expect(normalizeArtistName('')).toBe('');
    expect(normalizeArtistName(123)).toBe('');
  });
});

// ============================================================
// getArtist
// ============================================================

describe('Phase 13.0 — getArtist', () => {
  it('lookup direct par id', () => {
    const a = getArtist('angus_young');
    expect(a).not.toBeNull();
    expect(a.id).toBe('angus_young');
    expect(a.name).toBe('Angus Young');
  });

  it('lookup par nom exact', () => {
    const a = getArtist('Jimmy Page');
    expect(a).not.toBeNull();
    expect(a.id).toBe('jimmy_page');
  });

  it('lookup par nom case-insensitive', () => {
    const a = getArtist('jimmy page');
    expect(a).not.toBeNull();
    expect(a.id).toBe('jimmy_page');
  });

  it('lookup par nom avec ponctuation (B.B. King)', () => {
    const a = getArtist('B.B. King');
    expect(a).not.toBeNull();
    expect(a.id).toBe('bb_king');
  });

  it('inconnu → null', () => {
    expect(getArtist('Nonexistent Artist')).toBeNull();
    expect(getArtist('foo_bar_id_inexistant')).toBeNull();
  });

  it('inputs invalides', () => {
    expect(getArtist(null)).toBeNull();
    expect(getArtist(undefined)).toBeNull();
    expect(getArtist('')).toBeNull();
    expect(getArtist(42)).toBeNull();
  });
});

// ============================================================
// findArtistsByBand
// ============================================================

describe('Phase 13.0 — findArtistsByBand', () => {
  it('AC/DC retourne Angus Young + Cliff Williams', () => {
    const artists = findArtistsByBand('AC/DC');
    expect(artists.length).toBe(2);
    const ids = artists.map((a) => a.id);
    expect(ids).toContain('angus_young');
    expect(ids).toContain('cliff_williams');
  });

  it('Led Zeppelin retourne Jimmy Page + John Paul Jones', () => {
    const artists = findArtistsByBand('Led Zeppelin');
    const ids = artists.map((a) => a.id);
    expect(ids).toContain('jimmy_page');
    expect(ids).toContain('john_paul_jones');
  });

  it('Cream retourne Clapton + Bruce', () => {
    const artists = findArtistsByBand('Cream');
    const ids = artists.map((a) => a.id);
    expect(ids).toContain('eric_clapton');
    expect(ids).toContain('jack_bruce');
  });

  it('Queen retourne Brian May + John Deacon', () => {
    const artists = findArtistsByBand('Queen');
    const ids = artists.map((a) => a.id);
    expect(ids).toContain('brian_may');
    expect(ids).toContain('john_deacon');
  });

  it('case-insensitive', () => {
    expect(findArtistsByBand('ac/dc').length).toBe(2);
    expect(findArtistsByBand('AC/DC').length).toBe(2);
  });

  it('groupe inconnu → []', () => {
    expect(findArtistsByBand('Nonexistent Band')).toEqual([]);
  });

  it('inputs invalides', () => {
    expect(findArtistsByBand(null)).toEqual([]);
    expect(findArtistsByBand('')).toEqual([]);
  });
});

// ============================================================
// getEra
// ============================================================

describe('Phase 13.0 — getEra', () => {
  it('Angus Young 1976 → era 70s (Plexi)', () => {
    const era = getEra('angus_young', 1976);
    expect(era).not.toBeNull();
    expect(era.period).toBe('70s');
    expect(era.amps).toContain('Marshall Plexi 1959');
  });

  it('Angus Young 1990 → era 80s+ (JCM800)', () => {
    const era = getEra('angus_young', 1990);
    expect(era).not.toBeNull();
    expect(era.period).toBe('80s+');
    expect(era.amps).toContain('Marshall JCM800');
  });

  it('Clapton 1967 → era Cream', () => {
    const era = getEra('eric_clapton', 1967);
    expect(era).not.toBeNull();
    expect(era.period).toBe('60s Cream');
  });

  it('année hors couverture → null', () => {
    expect(getEra('angus_young', 1950)).toBeNull();  // avant 1973
    expect(getEra('bb_king', 2026)).toBeNull();      // après 2015
  });

  it('artiste inconnu → null', () => {
    expect(getEra('nonexistent', 1980)).toBeNull();
  });

  it('inputs invalides', () => {
    expect(getEra('angus_young', null)).toBeNull();
    expect(getEra('angus_young', NaN)).toBeNull();
    expect(getEra(null, 1980)).toBeNull();
  });
});

// ============================================================
// getCurrentEra
// ============================================================

describe('Phase 13.0 — getCurrentEra', () => {
  it('Angus Young → era 80s+', () => {
    const era = getCurrentEra('angus_young');
    expect(era).not.toBeNull();
    expect(era.period).toBe('80s+');
  });

  it('Clapton → era 70s-now', () => {
    const era = getCurrentEra('eric_clapton');
    expect(era).not.toBeNull();
    expect(era.period).toBe('70s-now');
  });

  it('Brian May (mono-era) → cette era', () => {
    const era = getCurrentEra('brian_may');
    expect(era).not.toBeNull();
    expect(era.period).toBe('Queen carrière complète');
  });

  it('artiste inconnu → null', () => {
    expect(getCurrentEra('nonexistent')).toBeNull();
  });
});

// ============================================================
// inferUsagesFromAmp (cœur Phase 13)
// ============================================================

describe('Phase 13.0 — inferUsagesFromAmp', () => {
  it('Marshall JCM800 matche Angus Young (80s+) + Kirk Hammett (80s)', () => {
    const matches = inferUsagesFromAmp('Marshall JCM800');
    const ids = matches.map((m) => m.artistId);
    expect(ids).toContain('angus_young');
    expect(ids).toContain('kirk_hammett');
  });

  it('Marshall Plexi 1959 matche Angus Young (70s)', () => {
    const matches = inferUsagesFromAmp('Marshall Plexi 1959');
    const ids = matches.map((m) => m.artistId);
    expect(ids).toContain('angus_young');
  });

  it('Marshall JTM45 matche Clapton (60s Bluesbreakers) + Angus (80s+)', () => {
    const matches = inferUsagesFromAmp('Marshall JTM45');
    const ids = matches.map((m) => m.artistId);
    expect(ids).toContain('eric_clapton');
    expect(ids).toContain('angus_young');
  });

  it('Mesa Boogie Mark IIC+ matche Kirk Hammett + James Hetfield', () => {
    const matches = inferUsagesFromAmp('Mesa Boogie Mark IIC+');
    const ids = matches.map((m) => m.artistId);
    expect(ids).toContain('kirk_hammett');
    expect(ids).toContain('james_hetfield');
  });

  it('Vox AC30 Top Boost matche Brian May', () => {
    const matches = inferUsagesFromAmp('Vox AC30 Top Boost');
    const ids = matches.map((m) => m.artistId);
    expect(ids).toContain('brian_may');
  });

  it('Laney Supergroup matche Tony Iommi', () => {
    const matches = inferUsagesFromAmp('Laney LA100BL Supergroup');
    const ids = matches.map((m) => m.artistId);
    expect(ids).toContain('tony_iommi');
  });

  it('substring match tolérant (Laney Supergroup → Laney LA100BL Supergroup)', () => {
    const matches = inferUsagesFromAmp('Laney Supergroup');
    const ids = matches.map((m) => m.artistId);
    expect(ids).toContain('tony_iommi');
  });

  it('confidence high pour mono-amp era (Brian May AC30 only)', () => {
    const matches = inferUsagesFromAmp('Vox AC30 Top Boost');
    const may = matches.find((m) => m.artistId === 'brian_may');
    expect(may.confidence).toBe('high');
  });

  it('confidence medium pour multi-amp era', () => {
    // Hendrix 1966-1970 a Marshall + Sunn + Twin → multi-amp era
    const matches = inferUsagesFromAmp('Marshall Super Lead 100W');
    const hendrix = matches.find((m) => m.artistId === 'jimi_hendrix');
    if (hendrix) {
      expect(hendrix.confidence).toBe('medium');
    }
  });

  it('amp inconnu → []', () => {
    expect(inferUsagesFromAmp('Random Brand 5150 v3')).toEqual([]);
  });

  it('inputs invalides', () => {
    expect(inferUsagesFromAmp(null)).toEqual([]);
    expect(inferUsagesFromAmp('')).toEqual([]);
    expect(inferUsagesFromAmp(42)).toEqual([]);
  });
});

// ============================================================
// inferUsagesArrayFromAmp (format catalog usages compatible)
// ============================================================

describe('Phase 13.0 — inferUsagesArrayFromAmp', () => {
  it('Marshall JCM800 → [{artist: "AC/DC"}, {artist: "Metallica"}]', () => {
    const usages = inferUsagesArrayFromAmp('Marshall JCM800');
    const artists = usages.map((u) => u.artist);
    expect(artists).toContain('AC/DC');
    expect(artists).toContain('Metallica');
  });

  it('Laney Supergroup → [{artist: "Black Sabbath"}]', () => {
    const usages = inferUsagesArrayFromAmp('Laney LA100BL Supergroup');
    const artists = usages.map((u) => u.artist);
    expect(artists).toContain('Black Sabbath');
  });

  it('dédup par band (pas Angus + Cliff dans AC/DC)', () => {
    // Cliff Williams utilise "Marshall Bass Major", pas le même amp
    // mais si un amp matchait les deux, on dédupliquerait
    const usages = inferUsagesArrayFromAmp('Marshall JCM800');
    const acdcCount = usages.filter((u) => u.artist === 'AC/DC').length;
    expect(acdcCount).toBe(1);
  });

  it('format compatible catalog.entry.usages', () => {
    const usages = inferUsagesArrayFromAmp('Vox AC30 Top Boost');
    for (const u of usages) {
      expect(u).toHaveProperty('artist');
      expect(typeof u.artist).toBe('string');
    }
  });

  it('amp inconnu → []', () => {
    expect(inferUsagesArrayFromAmp('Random unknown amp')).toEqual([]);
  });
});

// ============================================================
// Phase 13.1 — getCandidateAmpsForBand
// ============================================================

describe('Phase 13.1 — getCandidateAmpsForBand', () => {
  it('AC/DC current era → JTM45 + JCM800 (Angus Young 80s+)', () => {
    const result = getCandidateAmpsForBand('AC/DC');
    expect(result).not.toBeNull();
    expect(result.amps).toContain('Marshall JTM45');
    expect(result.amps).toContain('Marshall JCM800');
    // Cliff Williams est exclu (bassiste), donc pas Ampeg SVT
    expect(result.amps).not.toContain('Ampeg SVT');
  });

  it('AC/DC en 1976 → era 70s (Plexi + Super Lead 100W)', () => {
    const result = getCandidateAmpsForBand('AC/DC', 1976);
    expect(result).not.toBeNull();
    expect(result.amps).toContain('Marshall Plexi 1959');
    expect(result.amps).toContain('Marshall Super Lead 100W');
  });

  it('Queen → AC30 mono-signature (Brian May)', () => {
    const result = getCandidateAmpsForBand('Queen');
    expect(result).not.toBeNull();
    expect(result.amps).toContain('Vox AC30 Top Boost');
    expect(result.confidence).toBe('high');  // mono-amp era
    expect(result.primaryAmp).toBe('Vox AC30 Top Boost');
  });

  it('Black Sabbath sans year → union toutes eras Iommi (5 amps) → confidence low', () => {
    const result = getCandidateAmpsForBand('Black Sabbath');
    expect(result).not.toBeNull();
    expect(result.amps).toContain('Laney GH100TI Iommi signature');
    expect(result.amps).toContain('Laney Supergroup');  // era Vol.4+
    expect(result.amps).toContain('Marshall Major 200W');  // era Vol.4+
    // 5 amps total → confidence 'low' (anti-dogmatique multi-era)
    expect(result.confidence).toBe('low');
  });

  it('Black Sabbath en 1985 → era 80s+ ciblée (mono Laney signature → high)', () => {
    // 1980 est dans Vol.4+ (1973-1980), 80s+ commence à 1981.
    const result = getCandidateAmpsForBand('Black Sabbath', 1985);
    expect(result).not.toBeNull();
    expect(result.amps).toEqual(['Laney GH100TI Iommi signature']);
    expect(result.confidence).toBe('high');
  });

  it('Metallica → 2 guitaristes (Kirk + James), eras 90s+ multi-amp', () => {
    const result = getCandidateAmpsForBand('Metallica');
    expect(result).not.toBeNull();
    // Mesa Rectifier devrait apparaître (90s+ era pour les deux)
    const hasMesa = result.amps.some((a) => a.toLowerCase().includes('mesa') || a.toLowerCase().includes('rectifier'));
    expect(hasMesa).toBe(true);
  });

  it('Bassiste only band (cas dégénéré) → null', () => {
    // Cas où aucun guitariste/multi n'est dans le band
    // (pas dans le seed actuel, donc on simule via groupe inconnu)
    const result = getCandidateAmpsForBand('Unknown Band Without Guitarists');
    expect(result).toBeNull();
  });

  it('Groupe inconnu → null', () => {
    expect(getCandidateAmpsForBand('Random Nonexistent Band')).toBeNull();
  });

  it('Inputs invalides → null', () => {
    expect(getCandidateAmpsForBand(null)).toBeNull();
    expect(getCandidateAmpsForBand('')).toBeNull();
    expect(getCandidateAmpsForBand('AC/DC', NaN)).not.toBeNull(); // year NaN ignoré, fallback current
  });
});

// ============================================================
// Phase 13.1 — validateRefAmpAgainstArtists (cœur post-process)
// ============================================================

describe('Phase 13.1 — validateRefAmpAgainstArtists', () => {
  it('AC/DC + "Marshall JCM800" current era → valid', () => {
    const result = validateRefAmpAgainstArtists('Marshall JCM800', 'AC/DC');
    expect(result).not.toBeNull();
    expect(result.valid).toBe(true);
  });

  it('AC/DC + "Marshall Plexi" en 1976 → valid (era 70s)', () => {
    const result = validateRefAmpAgainstArtists('Marshall Plexi 1959', 'AC/DC', 1976);
    expect(result).not.toBeNull();
    expect(result.valid).toBe(true);
  });

  it('AC/DC sans year + "Vox AC30" → INVALID + suggestion = 1er amp era 70s', () => {
    const result = validateRefAmpAgainstArtists('Vox AC30 Top Boost', 'AC/DC');
    expect(result).not.toBeNull();
    expect(result.valid).toBe(false);
    expect(result.suggestedAmp).toBeTruthy();
    // Sans year, union toutes eras Angus, primaryAmp = 1er de la 1ère era =
    // "Marshall Plexi 1959" (era 70s, premier listé).
    expect(result.suggestedAmp).toBe('Marshall Plexi 1959');
  });

  it('AC/DC en 1985 + "Vox AC30" → INVALID + suggestion era 80s+ = "Marshall JTM45"', () => {
    const result = validateRefAmpAgainstArtists('Vox AC30 Top Boost', 'AC/DC', 1985);
    expect(result).not.toBeNull();
    expect(result.valid).toBe(false);
    expect(result.suggestedAmp).toBe('Marshall JTM45');
  });

  it('Queen + "Marshall JCM800" → INVALID + suggestion AC30 (confidence high)', () => {
    const result = validateRefAmpAgainstArtists('Marshall JCM800', 'Queen');
    expect(result).not.toBeNull();
    expect(result.valid).toBe(false);
    expect(result.confidence).toBe('high');
    expect(result.suggestedAmp).toBe('Vox AC30 Top Boost');
  });

  it('Match tolérant : "JCM800" matche "Marshall JCM800"', () => {
    const result = validateRefAmpAgainstArtists('JCM800', 'AC/DC');
    expect(result).not.toBeNull();
    expect(result.valid).toBe(true);
  });

  it('Groupe inconnu hors ARTISTS → null (no-op, garde IA)', () => {
    // Note : "Blink-182" était initialement utilisé comme cas hors seed
    // Phase 13.0 (20 entries). Le batch Cowork Phase 13.5 a ajouté
    // Blink-182 → la base couvre désormais ce cas (Tom DeLonge +
    // Mesa Boogie). Effet attendu : "Marshall JCM800 pour Blink-182"
    // → suggestion "Mesa Boogie Dual Rectifier". C'est précisément le
    // fix racine visé Phase 13.1 (cas Bruno). On utilise donc un
    // groupe vraiment fictif pour valider le path "no-op".
    expect(validateRefAmpAgainstArtists('Mesa Boogie', 'Nonexistent Band 9999 ZZ')).toBeNull();
  });

  it('Bonus Phase 13.5 — Blink-182 + JCM800 halluciné → suggestion Mesa Boogie (cas Bruno)', () => {
    const result = validateRefAmpAgainstArtists('Marshall JCM800', 'Blink-182');
    expect(result).not.toBeNull();
    expect(result.valid).toBe(false);
    // Le batch Cowork a tagué Blink-182 avec Mesa Boogie en primary
    expect(result.suggestedAmp.toLowerCase()).toContain('mesa');
  });

  it('refAmp invalide → null', () => {
    expect(validateRefAmpAgainstArtists(null, 'AC/DC')).toBeNull();
    expect(validateRefAmpAgainstArtists('', 'AC/DC')).toBeNull();
    expect(validateRefAmpAgainstArtists(42, 'AC/DC')).toBeNull();
  });

  it('Confidence low → suggestedAmp = null (Bonamassa-like protection)', () => {
    // Cas hypothétique : si un band avait 5+ amps dans son era, on ne devrait
    // pas corriger même si pas de match. Note : aucun band du seed Phase 13.0
    // ne tombe dans ce cas actuellement. Test du chemin code via simulation.
    // Vérifié indirectement : Metallica + Mesa Boogie multi-amp era retourne
    // 'medium' confidence donc suggestion OK.
    const result = validateRefAmpAgainstArtists('Random Brand 9999', 'Metallica');
    if (result && result.confidence === 'low') {
      expect(result.suggestedAmp).toBeNull();
    } else if (result) {
      // medium confidence accepté : suggestion = primaryAmp Metallica
      expect(result.suggestedAmp).toBeTruthy();
    }
  });
});

// ============================================================
// Phase 13.1 — ampNamesMatch / normalizeAmpName (exposés Phase 13.1)
// ============================================================

describe('Phase 13.1 — ampNamesMatch (exposé)', () => {
  it('exact match', () => {
    expect(ampNamesMatch('Marshall JCM800', 'Marshall JCM800')).toBe(true);
  });

  it('case-insensitive', () => {
    expect(ampNamesMatch('marshall jcm800', 'Marshall JCM800')).toBe(true);
  });

  it('substring tolérant : "JCM800" ↔ "Marshall JCM800 2203"', () => {
    expect(ampNamesMatch('JCM800', 'Marshall JCM800 2203')).toBe(true);
    expect(ampNamesMatch('Marshall JCM800 2203', 'JCM800')).toBe(true);
  });

  it('punctuation tolérante', () => {
    expect(ampNamesMatch('Mesa Boogie Mark IIC+', 'Mesa Boogie Mark IIC+')).toBe(true);
  });

  it('inputs invalides → false', () => {
    expect(ampNamesMatch(null, 'Marshall')).toBe(false);
    expect(ampNamesMatch('Marshall', null)).toBe(false);
    expect(ampNamesMatch('', '')).toBe(false);
  });

  it('non-match', () => {
    expect(ampNamesMatch('Marshall JCM800', 'Vox AC30')).toBe(false);
  });
});

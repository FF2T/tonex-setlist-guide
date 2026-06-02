// Phase 13.0 (2026-06-02) — Base ARTISTS seed test (~20 artistes).
//
// Source de vérité primitive guitariste/bassiste → groupe(s) + setup
// historique de référence par éra. Sert de fondation à la curation
// automatique des `usages` du catalog, au scoring V9 family-match
// côté ampli (Phase 13.2), et au prompt IA enrichi (Phase 13.1).
//
// Schema documenté dans CLAUDE.md "Phase 13" + types en commentaire
// au-dessus de chaque entry pour faciliter la maintenance.
//
// Couverture initiale (Phase 13.0) :
//   - 14 guitaristes essentiels SONG_HISTORY + bonus beta
//   - 6 bassistes principaux pour Phase 8 basse first-class
//
// Phase 13.5 étendra à ~400 artistes via Cowork batch par décennie.

/**
 * @typedef {Object} ArtistEra
 * @property {string} period - Label humain ("60s", "70s", "80s+")
 * @property {number[]} years - [start, end] (end = 2026 = "now")
 * @property {string[]} guitars - Modèles guitare/basse (catalog brand+modèle)
 * @property {string[]} amps - Modèles ampli (compatibles refAmp scoring V9)
 * @property {string[]} [pedals] - Pédales signature (optionnel)
 */

/**
 * @typedef {Object} Artist
 * @property {string} name
 * @property {'guitarist' | 'bassist' | 'multi'} role
 * @property {string[]} bands
 * @property {ArtistEra[]} eras
 * @property {string} [notes]
 * @property {string[]} [sources]
 */

/** @type {Object<string, Artist>} */
export const ARTISTS_SEED = {
  // ============================================================
  // GUITARISTES (14 entries — figures clés SONG_HISTORY + bonus)
  // ============================================================

  angus_young: {
    name: "Angus Young",
    role: "guitarist",
    bands: ["AC/DC"],
    eras: [
      {
        period: "70s",
        years: [1973, 1979],
        guitars: ["Gibson SG Standard"],
        amps: ["Marshall Plexi 1959", "Marshall Super Lead 100W"],
        pedals: ["Schaffer Vega Diversity System"],
      },
      {
        period: "80s+",
        years: [1980, 2026],
        guitars: ["Gibson SG Standard"],
        amps: ["Marshall JTM45", "Marshall JCM800"],
        pedals: ["Schaffer Replica"],
      },
    ],
    notes: "Setup signature reconnaissable : SG + Marshall + Schaffer wireless.",
    sources: ["https://en.wikipedia.org/wiki/Angus_Young"],
  },

  eric_clapton: {
    name: "Eric Clapton",
    role: "guitarist",
    bands: ["Cream", "The Yardbirds", "John Mayall & the Bluesbreakers", "Derek and the Dominos", "solo"],
    eras: [
      {
        period: "60s Bluesbreakers",
        years: [1965, 1966],
        guitars: ["Gibson Les Paul Standard '59"],
        amps: ["Marshall JTM45"],
        pedals: [],
      },
      {
        period: "60s Cream",
        years: [1966, 1968],
        guitars: ["Gibson SG Standard", "Gibson ES-335", "Gibson Les Paul"],
        amps: ["Marshall Super Lead 100W", "Marshall Super Bass 100"],
        pedals: ["Vox Wah"],
      },
      {
        period: "70s-now",
        years: [1970, 2026],
        guitars: ["Fender Stratocaster (Blackie)", "Fender Stratocaster Custom Shop"],
        amps: ["Fender Twin Reverb", "Fender Tweed Champ", "Fender Vibro-King"],
        pedals: ["Dunlop Cry Baby Wah", "Boss CS-3"],
      },
    ],
    notes: "Transition emblématique LP+Marshall (Bluesbreakers) → SG (Cream) → Strat (post-Cream). Le 'Beano' tone est référence absolue.",
    sources: ["https://en.wikipedia.org/wiki/Eric_Clapton"],
  },

  bb_king: {
    name: "B.B. King",
    role: "guitarist",
    bands: ["solo"],
    eras: [
      {
        period: "carrière complète",
        years: [1949, 2015],
        guitars: ["Gibson ES-355 (Lucille)", "Gibson ES-345"],
        amps: ["Fender Twin Reverb", "Lab Series L5", "Gibson Lab Series"],
        pedals: [],
      },
    ],
    notes: "Lucille (ES-355) + clean Fender Twin = template du blues moderne. Vibrato signature.",
    sources: ["https://en.wikipedia.org/wiki/B.B._King"],
  },

  mark_knopfler: {
    name: "Mark Knopfler",
    role: "guitarist",
    bands: ["Dire Straits", "solo"],
    eras: [
      {
        period: "Dire Straits 70s-80s",
        years: [1977, 1985],
        guitars: ["Fender Stratocaster '61", "Schecter Stratocaster"],
        amps: ["Fender Vibrolux Reverb", "Music Man HD-130"],
        pedals: ["MXR Analog Delay"],
      },
      {
        period: "Money for Nothing era",
        years: [1985, 1992],
        guitars: ["Gibson Les Paul Standard '59"],
        amps: ["Laney AOR", "Marshall"],
        pedals: ["Wah", "Tube Driver"],
      },
      {
        period: "solo",
        years: [1995, 2026],
        guitars: ["Pensa-Suhr R Custom", "Gibson Les Paul Goldtop"],
        amps: ["Soldano SLO-100", "Fender '57 Twin Reverb"],
        pedals: ["TC Electronic", "Strymon"],
      },
    ],
    notes: "Fingerstyle signature (pas de médiator). Strat clean → LP cranked pour Money for Nothing.",
    sources: ["https://en.wikipedia.org/wiki/Mark_Knopfler"],
  },

  jimmy_page: {
    name: "Jimmy Page",
    role: "guitarist",
    bands: ["Led Zeppelin", "The Yardbirds", "solo"],
    eras: [
      {
        period: "Yardbirds 60s",
        years: [1966, 1968],
        guitars: ["Fender Telecaster '59 (dragon)"],
        amps: ["Vox AC30", "Supro Coronado"],
        pedals: ["Sola Sound Tone Bender"],
      },
      {
        period: "Led Zep early (I-II)",
        years: [1968, 1970],
        guitars: ["Fender Telecaster", "Gibson Les Paul Standard '59 (#1)"],
        amps: ["Supro 1690T", "Marshall Super Lead 100W"],
        pedals: ["Sola Sound Tone Bender"],
      },
      {
        period: "Led Zep classic (III-IV-Houses)",
        years: [1970, 1975],
        guitars: ["Gibson Les Paul Standard '59 (#1, #2)", "Gibson EDS-1275 doubleneck"],
        amps: ["Marshall Super Lead 100W (modded by Hiwatt)", "Hiwatt Custom 100"],
        pedals: ["Maestro Echoplex EP-3"],
      },
    ],
    notes: "LP + Marshall = template hard rock 70s. Tele restée pour First Album solos. Échoplex sur les leads.",
    sources: ["https://en.wikipedia.org/wiki/Jimmy_Page"],
  },

  ritchie_blackmore: {
    name: "Ritchie Blackmore",
    role: "guitarist",
    bands: ["Deep Purple", "Rainbow", "Blackmore's Night"],
    eras: [
      {
        period: "Deep Purple Mk II (70-73)",
        years: [1970, 1973],
        guitars: ["Fender Stratocaster (1970s)"],
        amps: ["Marshall Major 200W", "Marshall Super Lead 100W"],
        pedals: ["AIWA TP-1011 tape recorder (preamp boost)"],
      },
      {
        period: "Deep Purple Mk III + Rainbow",
        years: [1974, 1984],
        guitars: ["Fender Stratocaster scalloped"],
        amps: ["Marshall Super Lead Major 200W"],
        pedals: ["Hornby Skewes Treble Booster"],
      },
    ],
    notes: "Strat scalopée + Marshall cranked. Smoke on the Water riff (G5-Bb5-C5).",
    sources: ["https://en.wikipedia.org/wiki/Ritchie_Blackmore"],
  },

  brian_may: {
    name: "Brian May",
    role: "guitarist",
    bands: ["Queen", "solo"],
    eras: [
      {
        period: "Queen carrière complète",
        years: [1970, 2026],
        guitars: ["Red Special (homemade)"],
        amps: ["Vox AC30 Top Boost"],
        pedals: ["Dallas Rangemaster Treble Booster", "Foxx Foot Phaser"],
      },
    ],
    notes: "Setup mono-signature unique : Red Special homemade + AC30 + treble booster. Son inimitable.",
    sources: ["https://en.wikipedia.org/wiki/Brian_May"],
  },

  tony_iommi: {
    name: "Tony Iommi",
    role: "guitarist",
    bands: ["Black Sabbath", "Heaven & Hell", "solo"],
    eras: [
      {
        period: "Black Sabbath early (Paranoid era)",
        years: [1969, 1973],
        guitars: ["Gibson SG Special (1965, modded)", "Gibson SG Monkey"],
        amps: ["Laney LA100BL Supergroup", "Laney LM-100"],
        pedals: ["Dallas Rangemaster Treble Booster", "Tycobrahe Octavia"],
      },
      {
        period: "Black Sabbath Vol.4+ (mid-70s)",
        years: [1973, 1980],
        guitars: ["Gibson SG Special", "Jaydee Custom SG"],
        amps: ["Laney Supergroup", "Marshall Major 200W"],
        pedals: ["Rangemaster"],
      },
      {
        period: "Sabbath 80s+",
        years: [1981, 2026],
        guitars: ["Jaydee Old Boy SG signature"],
        amps: ["Laney GH100TI Iommi signature"],
        pedals: ["Boss CE-5 Chorus", "Tycobrahe Octavia"],
      },
    ],
    notes: "Tuning bas (C#/D standard accordage) à partir de Master of Reality. Treble Booster + Laney = fondation du metal.",
    sources: ["https://en.wikipedia.org/wiki/Tony_Iommi"],
  },

  jimi_hendrix: {
    name: "Jimi Hendrix",
    role: "guitarist",
    bands: ["The Jimi Hendrix Experience", "Band of Gypsys", "solo"],
    eras: [
      {
        period: "1966-1970",
        years: [1966, 1970],
        guitars: ["Fender Stratocaster (1968 Olympic White)", "Gibson Flying V", "Gibson SG Custom"],
        amps: ["Marshall Super Lead 100W (modded)", "Sunn Coliseum", "Fender Twin Reverb"],
        pedals: ["Dallas Arbiter Fuzz Face", "Vox Cry Baby Wah", "Roger Mayer Octavia", "Univibe"],
      },
    ],
    notes: "Strat (jouée à l'envers, cordes inversées droitier) + Marshall cranked + Fuzz Face + Univibe = matrice du rock guitar moderne.",
    sources: ["https://en.wikipedia.org/wiki/Jimi_Hendrix"],
  },

  david_gilmour: {
    name: "David Gilmour",
    role: "guitarist",
    bands: ["Pink Floyd", "solo"],
    eras: [
      {
        period: "Pink Floyd 70s (DSOTM, Wish You Were Here, Animals)",
        years: [1970, 1979],
        guitars: ["Fender Stratocaster 1969 'The Black Strat'"],
        amps: ["Hiwatt Custom 100 DR103", "Fender Twin Reverb"],
        pedals: ["Big Muff Pi", "MXR Phase 90", "Electric Mistress", "Binson Echorec"],
      },
      {
        period: "Pink Floyd 80s+",
        years: [1980, 2026],
        guitars: ["Fender Stratocaster 'The Black Strat'", "Fender Stratocaster Custom Shop signature"],
        amps: ["Hiwatt Custom 100", "Fender Bassman"],
        pedals: ["Big Muff Pi", "TC Electronic 2290 delay", "Pete Cornish boards"],
      },
    ],
    notes: "Strat + Big Muff + Hiwatt + delay = signature Wish You Were Here / Comfortably Numb solos.",
    sources: ["https://en.wikipedia.org/wiki/David_Gilmour"],
  },

  stevie_ray_vaughan: {
    name: "Stevie Ray Vaughan",
    role: "guitarist",
    bands: ["Double Trouble", "solo"],
    eras: [
      {
        period: "carrière (1983-1990)",
        years: [1983, 1990],
        guitars: ["Fender Stratocaster 'Number One' (1962/1963 body, 1959 neck)"],
        amps: ["Fender Vibroverb '64", "Marshall JTM45 Super Lead", "Dumble Steel String Singer"],
        pedals: ["Ibanez Tube Screamer TS-808/TS-9", "Vox Wah", "Fuzz Face"],
      },
    ],
    notes: "Strat + TS-808 + Fender/Dumble = template blues moderne. Cordes très lourdes (.013-.058).",
    sources: ["https://en.wikipedia.org/wiki/Stevie_Ray_Vaughan"],
  },

  kirk_hammett: {
    name: "Kirk Hammett",
    role: "guitarist",
    bands: ["Metallica", "Exodus (early)"],
    eras: [
      {
        period: "Metallica 80s",
        years: [1983, 1991],
        guitars: ["ESP MX-220 (Mummy)", "Gibson Les Paul Custom Black Beauty", "Jackson Randy Rhoads"],
        amps: ["Marshall JCM800 2203", "Mesa Boogie Mark IIC+"],
        pedals: ["Ibanez Tube Screamer TS-9", "Boss DD-3"],
      },
      {
        period: "Metallica 90s+",
        years: [1991, 2026],
        guitars: ["ESP KH-2", "ESP KH-3", "Gibson Les Paul Custom"],
        amps: ["Mesa Boogie Triple Rectifier", "Mesa Boogie Mark IV", "Diezel VH4"],
        pedals: ["Dunlop Cry Baby Wah signature", "MXR Phase 90"],
      },
    ],
    notes: "Mark IIC+ + Tube Screamer = signature Master of Puppets era. Plus tard Triple Rectifier pour Black Album.",
    sources: ["https://en.wikipedia.org/wiki/Kirk_Hammett"],
  },

  james_hetfield: {
    name: "James Hetfield",
    role: "guitarist",
    bands: ["Metallica"],
    eras: [
      {
        period: "Metallica 80s",
        years: [1981, 1991],
        guitars: ["Gibson Explorer '76 (white)", "ESP MX-250", "Jackson King V"],
        amps: ["Mesa Boogie Mark IIC+", "Marshall JCM800"],
        pedals: ["Boss SD-1"],
      },
      {
        period: "Metallica 90s+",
        years: [1991, 2026],
        guitars: ["ESP Truckster", "ESP Snakebyte signature", "Gibson Explorer custom"],
        amps: ["Mesa Boogie Triple Rectifier", "Diezel VH4", "Mesa Mark V"],
        pedals: ["Boss SD-1", "TC Electronic G-Major"],
      },
    ],
    notes: "Mark IIC+ rhythm tight era 80s. Triple Recto + Diezel pour le mur de son moderne.",
    sources: ["https://en.wikipedia.org/wiki/James_Hetfield"],
  },

  joe_walsh: {
    name: "Joe Walsh",
    role: "guitarist",
    bands: ["Eagles", "James Gang", "solo"],
    eras: [
      {
        period: "James Gang + early solo",
        years: [1969, 1975],
        guitars: ["Gibson Les Paul Standard"],
        amps: ["Fender Tweed Twin", "Hiwatt Custom 100"],
        pedals: ["Vox Cry Baby Wah", "MXR Phase 90"],
      },
      {
        period: "Eagles (Hotel California era)",
        years: [1975, 1980],
        guitars: ["Gibson Les Paul Standard '60", "Telecaster Fender custom"],
        amps: ["Fender Tweed Deluxe", "Marshall Super Lead 100W"],
        pedals: ["MXR Phase 100", "EH Electric Mistress"],
      },
    ],
    notes: "Hotel California co-écrit avec Don Felder. LP + Twin/Deluxe = signature warm rock.",
    sources: ["https://en.wikipedia.org/wiki/Joe_Walsh"],
  },

  // ============================================================
  // BASSISTES (6 entries — Phase 8 first-class)
  // ============================================================

  cliff_williams: {
    name: "Cliff Williams",
    role: "bassist",
    bands: ["AC/DC"],
    eras: [
      {
        period: "AC/DC 1977-2024",
        years: [1977, 2024],
        guitars: ["Fender Precision Bass", "Music Man StingRay"],
        amps: ["Marshall Bass Major", "Ampeg SVT"],
        pedals: [],
      },
    ],
    notes: "Solid root-note rock bass. Fender Precision + Ampeg/Marshall.",
    sources: ["https://en.wikipedia.org/wiki/Cliff_Williams"],
  },

  jack_bruce: {
    name: "Jack Bruce",
    role: "bassist",
    bands: ["Cream", "John Mayall & the Bluesbreakers", "solo"],
    eras: [
      {
        period: "Cream era",
        years: [1966, 1968],
        guitars: ["Fender VI 6-string bass", "Gibson EB-3"],
        amps: ["Marshall Super Bass 100"],
        pedals: ["Vox Wah"],
      },
    ],
    notes: "Sunshine of Your Love riff bass écrit par Bruce. EB-3 cranked Marshall = son Cream.",
    sources: ["https://en.wikipedia.org/wiki/Jack_Bruce"],
  },

  john_paul_jones: {
    name: "John Paul Jones",
    role: "bassist",
    bands: ["Led Zeppelin"],
    eras: [
      {
        period: "Led Zep complète",
        years: [1968, 1980],
        guitars: ["Fender Jazz Bass 1962", "Fender Precision Bass", "Alembic Series I 8-string"],
        amps: ["Acoustic 360", "Ampeg SVT"],
        pedals: [],
      },
    ],
    notes: "Jazz Bass + Acoustic 360 = signature Whole Lotta Love / Black Dog.",
    sources: ["https://en.wikipedia.org/wiki/John_Paul_Jones_(musician)"],
  },

  john_deacon: {
    name: "John Deacon",
    role: "bassist",
    bands: ["Queen"],
    eras: [
      {
        period: "Queen 70s-90s",
        years: [1971, 1997],
        guitars: ["Fender Precision Bass (1976)"],
        amps: ["Acoustic 470", "Sunn"],
        pedals: ["EH Big Muff (Another One Bites the Dust)"],
      },
    ],
    notes: "Under Pressure intro 4-note bass = un des riffs les plus reconnaissables. Precision Bass picked.",
    sources: ["https://en.wikipedia.org/wiki/John_Deacon"],
  },

  roger_glover: {
    name: "Roger Glover",
    role: "bassist",
    bands: ["Deep Purple", "Rainbow"],
    eras: [
      {
        period: "Deep Purple Mk II-III",
        years: [1969, 1976],
        guitars: ["Rickenbacker 4001", "Fender Jazz Bass"],
        amps: ["Marshall Super Bass", "Ampeg SVT"],
        pedals: [],
      },
    ],
    notes: "Smoke on the Water groove bass (root-note tight). Rickenbacker + Marshall.",
    sources: ["https://en.wikipedia.org/wiki/Roger_Glover"],
  },

  geezer_butler: {
    name: "Geezer Butler",
    role: "bassist",
    bands: ["Black Sabbath", "Heaven & Hell"],
    eras: [
      {
        period: "Black Sabbath 70s",
        years: [1969, 1980],
        guitars: ["Fender Precision Bass", "Vox Phantom IV bass"],
        amps: ["Laney Klipp", "Acoustic 270"],
        pedals: ["Dallas Rangemaster (briefly)", "Wah"],
      },
      {
        period: "Sabbath/Heaven & Hell 80s+",
        years: [1981, 2026],
        guitars: ["Spector NS-2", "Lakland Geezer Butler signature"],
        amps: ["Ampeg SVT", "Hartke"],
        pedals: ["Boss CEB-3 Bass Chorus"],
      },
    ],
    notes: "Paranoid + Iron Man + War Pigs : Precision Bass + Laney Klipp downtuned avec Iommi.",
    sources: ["https://en.wikipedia.org/wiki/Geezer_Butler"],
  },
};

/**
 * Mapping inverse band → [artistIds] pour lookup rapide.
 * Construit au load module pour O(1) lookup.
 * @type {Object<string, string[]>}
 */
export const BAND_TO_ARTIST_IDS = (() => {
  const map = {};
  for (const [id, artist] of Object.entries(ARTISTS_SEED)) {
    for (const band of artist.bands || []) {
      const key = band.toLowerCase().trim();
      if (!map[key]) map[key] = [];
      map[key].push(id);
    }
  }
  return map;
})();

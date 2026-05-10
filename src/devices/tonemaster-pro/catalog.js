// src/devices/tonemaster-pro/catalog.js — Phase 3.
// Catalog factory de patches Tone Master Pro v1 (~20 patches).
//
// 3 patches Arthur (RECOPIÉS AU CARACTÈRE PRÈS depuis CLAUDE.md
// section "Patches TMP de référence — Arthur") :
//   - rock_preset : Plexi + Super Drive + 4x12 Greenback + Spring (slot 211/213)
//   - clean_preset : EQ + Studio Comp + Twin Reverb + 2x12 Twin D120 + Spring (slot 210)
//   - flipper_patch : Bassman + 4x10 Bassman Tweed + Spring (slot 202)
//
// 4 patches dédiés aux morceaux orphelins du seed (non couverts par Arthur) :
// stairway, money for nothing, romeo & juliet, hoochie coochie man.
//
// 13 patches "famille" avec champ `usages: [{artist, songs?}]` listant les
// cibles types pour le scoring + le browsing utilisateur.
//
// Tous les patches : `factory: true`. Source 'arthur' / 'orphan' / 'generated'
// pour traçabilité.

// ─── Constantes utilitaires ─────────────────────────────────────────
// Patterns extraits CLAUDE.md "Patterns extraits des patches Arthur" :
// - Spring Reverb {mixer:3, dwell:7, tone:6} = défaut universel.
// - SM57 axis-on à 6" pour crunch/rock.
// - R121 off-axis à 3" pour clean/blues.
// - low_cut/high_cut 20/20000 = pas de cut au cab.

const SPRING_REVERB_DEFAULT = {
  model: 'Spring',
  enabled: true,
  params: { mixer: 3, dwell: 7, tone: 6, predelay: 0, hi_cut: 8000, low_cut: 100 },
};

const SM57_AXIS_ON_6 = {
  mic: 'Dyn SM57', axis: 'on', distance: 6, low_cut: 20, high_cut: 20000,
};

const R121_OFF_AXIS_3 = {
  mic: 'Ribbon R121', axis: 'off', distance: 3, low_cut: 20, high_cut: 20000,
};

// ─── Patches Arthur (3, EXACTS depuis CLAUDE.md) ────────────────────

// Patch 1 — "Rock Preset" (slot Arthur 211/213)
// Usages : AC/DC (TNT, Thunderstruck, Highway to Hell, Back in Black,
// Hells Bells, You Shook Me All Night Long), Cream "White Room",
// Deep Purple "Smoke on the Water"
//
// VALEURS CORRIGÉES Phase 3.8 suite retour utilisateur du 10 mai 2026.
// Les screenshots iPad d'origine (Phase 3) étaient mal lus — Plexi
// volume_i/ii en réalité à fond, drive bien plus discret, treble plus
// poussé, bass à zéro. Valeurs validées en direct par Arthur.
const ROCK_PRESET = {
  id: 'rock_preset',
  name: 'Rock Preset',
  factory: true,
  source: 'arthur',
  notes: "Patch réel d'Arthur (slot 211/213). Plexi cranked (Volume I+II 10/10) + Super Drive en boost discret + 4x12 Greenback + Spring + Digital Delay léger. Scene Solo (FS2) : Amp Level 70%→100% pour les solos AC/DC.",
  // Phase 4 — Scenes Rythme/Solo modélisant le footswitch solo
  // d'Arthur. Spec exacte CLAUDE.md "Patch Arthur Rock Preset —
  // Scenes pré-renseignées".
  scenes: [
    { id: 'rythme', name: 'Rythme', ampLevelOverride: 70 },
    { id: 'solo', name: 'Solo', ampLevelOverride: 100 },
  ],
  footswitchMap: {
    fs1: { type: 'scene', sceneId: 'rythme' },
    fs2: { type: 'scene', sceneId: 'solo' },
  },
  usages: [
    { artist: 'AC/DC', songs: ['Highway to Hell', 'You Shook Me All Night Long', 'Thunderstruck', 'TNT', 'Back in Black', 'Hells Bells'] },
    { artist: 'Cream', songs: ['White Room'] },
    { artist: 'Deep Purple', songs: ['Smoke on the Water'] },
  ],
  // Phase 3.8 — Conseils de jeu spécifiques à un morceau (id du
  // INIT_SONG_DB_META). Affichés en bas du drawer sous "💡 Conseil
  // pour ce morceau" si song.id matche une clé.
  playingTipsBySong: {
    cream_wr: "Sur ce morceau : micro manche + tonalité à 0 pour adoucir le drive.",
  },
  noise_gate: {
    model: 'Noise Reducer', enabled: true,
    params: { threshold: 10, attenuation: 10 },
  },
  drive: {
    model: 'Super Drive', enabled: true,
    params: { drive: 2.5, level: 3, tone: 8 },
  },
  amp: {
    model: 'British Plexi', enabled: true,
    params: { volume_i: 10, volume_ii: 10, treble: 8.5, middle: 5, bass: 0, presence: 5 },
    // amp_level: 70% rythmique → 100% via footswitch solo (cf notes).
  },
  cab: {
    model: '4x12 British Plexi Greenback', enabled: true,
    params: { ...SM57_AXIS_ON_6 },
  },
  delay: {
    model: 'Digital Delay', enabled: true,
    params: { time: 350, feedback: 25, mix: 15, hi_cut: 6000, low_cut: 100 },
  },
  reverb: {
    model: 'Spring', enabled: true,
    params: { mixer: 2.5, dwell: 8, tone: 6, predelay: 0, hi_cut: 8000, low_cut: 100 },
  },
  style: 'hard_rock',
  gain: 'mid',
  pickupAffinity: { HB: 95, SC: 70, P90: 80 },
};

// Patch 2 — "Clean Preset" (slot Arthur 210)
// Usages : BB King "The Thrill is Gone" (Arthur joue avec son Epiphone
// ES-339, pas la SG)
const CLEAN_PRESET = {
  id: 'clean_preset',
  name: 'Clean Preset',
  factory: true,
  source: 'arthur',
  notes: "Patch réel d'Arthur (slot 210). EQ + Studio Comp + Twin Reverb + 2x12 Twin D120 (Ribbon R121) + Spring. Joué sur Epiphone ES-339.",
  usages: [
    { artist: 'B.B. King', songs: ['The Thrill is Gone'] },
  ],
  // low_gain -12 = low cut 6dB/Oct depuis 98Hz
  eq: {
    model: 'EQ-5 Parametric', enabled: true,
    params: { low_freq: 98, low_gain: -12, mid_freq: 2000, mid_gain: 2, hi_gain: -3 },
  },
  comp: {
    model: 'Studio Compressor', enabled: true,
    params: { threshold: 5, ratio: 5, attack: 5, release: 5, level: 5 },
  },
  amp: {
    model: "Fender '65 Twin Reverb", enabled: true,
    params: { gain: 4, treble: 4, mid: 6, bass: 7, presence: 5 },
    // amp_level: 70%, bright switch OFF, gate amp OFF
  },
  cab: {
    model: '2x12 Twin D120', enabled: true,
    params: { ...R121_OFF_AXIS_3 },
  },
  reverb: { ...SPRING_REVERB_DEFAULT },
  style: 'blues',
  gain: 'low',
  pickupAffinity: { HB: 90, SC: 75, P90: 85 },
};

// Patch 3 — "Flipper" (slot Arthur 202)
// Usages : Téléphone "Flipper"
const FLIPPER_PATCH = {
  id: 'flipper_patch',
  name: 'Flipper',
  factory: true,
  source: 'arthur',
  notes: "Patch réel d'Arthur (slot 202). Bassman cranked (scale 1-12) + 4x10 Bassman Tweed + Spring. Pas de drive, pas de FX modulation — chaîne minimaliste.",
  usages: [
    { artist: 'Téléphone', songs: ['Flipper'] },
  ],
  amp: {
    model: "Fender '59 Bassman", enabled: true,
    params: { gain: 6, treble: 7, mid: 7, bass: 8, presence: 6 },
    // amp_level: 70%, gate amp MAX, scale du Bassman 1-12 (pas 0-10)
  },
  cab: {
    model: "4x10 '59 Bassman Tweed", enabled: true,
    params: { ...SM57_AXIS_ON_6 },
  },
  reverb: { ...SPRING_REVERB_DEFAULT },
  style: 'rock',
  gain: 'mid',
  pickupAffinity: { HB: 90, SC: 80, P90: 85 },
};

// ─── Patches orphelins (4) — morceaux du seed non couverts par Arthur ──

const STAIRWAY_PATCH = {
  id: 'stairway_patch',
  name: 'Page Heavy — Stairway Solo',
  factory: true,
  source: 'orphan',
  notes: "Pour Stairway to Heaven (solo Jimmy Page). Hiwatt Custom 100 absent de la whitelist v1, on approxime via British 800 (JCM800) en gain mid. Tube Screamer pour booster les leads.",
  usages: [
    { artist: 'Led Zeppelin', songs: ['Stairway to Heaven', 'Black Dog', 'Whole Lotta Love'] },
  ],
  drive: {
    model: 'Tube Screamer', enabled: true,
    params: { drive: 4, tone: 6, level: 7 },
  },
  amp: {
    model: 'British 800', enabled: true,
    params: { gain: 6, treble: 6, mid: 6, bass: 5, presence: 6 },
  },
  cab: {
    model: '4x12 British 800 G12T', enabled: true,
    params: { ...SM57_AXIS_ON_6 },
  },
  delay: {
    model: 'Tape Echo', enabled: true,
    params: { time: 420, feedback: 30, mix: 20, hi_cut: 5000, low_cut: 100 },
  },
  reverb: { ...SPRING_REVERB_DEFAULT },
  style: 'rock',
  gain: 'mid',
  pickupAffinity: { HB: 95, SC: 65, P90: 75 },
};

const MONEY_PATCH = {
  id: 'money_patch',
  name: 'Knopfler Twang',
  factory: true,
  source: 'orphan',
  notes: "Pour Money for Nothing (Mark Knopfler, Mesa Mark II). Marksman CH1 + Chorus pour le swirl Dimension D + jeu en doigts.",
  usages: [
    { artist: 'Dire Straits', songs: ['Money for Nothing', 'Sultans of Swing'] },
    { artist: 'Mark Knopfler', songs: ['Walk of Life'] },
  ],
  amp: {
    model: 'Marksman CH1', enabled: true,
    params: { gain: 5, treble: 6, mid: 7, bass: 5, presence: 5 },
  },
  cab: {
    model: "1x12 '57 Deluxe Alnico Blue", enabled: true,
    params: { ...SM57_AXIS_ON_6 },
  },
  mod: {
    model: 'Chorus', enabled: true,
    params: { rate: 3, depth: 4, mix: 35, feedback: 0 },
  },
  delay: {
    model: 'Analog Delay', enabled: true,
    params: { time: 280, feedback: 15, mix: 12, hi_cut: 4500, low_cut: 100 },
  },
  reverb: { ...SPRING_REVERB_DEFAULT },
  style: 'rock',
  gain: 'mid',
  pickupAffinity: { HB: 85, SC: 75, P90: 70 },
};

const ROMEO_PATCH = {
  id: 'romeo_patch',
  name: 'National Steel Approximation',
  factory: true,
  source: 'orphan',
  notes: "Pour Romeo & Juliet (Knopfler sur National Steel). Music Man HD130 absent, on approxime via Vibro-King clean en finger-picking + 1x12 Bassbreaker pour le côté tweed boisé.",
  usages: [
    { artist: 'Dire Straits', songs: ['Romeo & Juliet', 'Brothers in Arms'] },
  ],
  amp: {
    model: 'Fender Vibro-King', enabled: true,
    params: { gain: 3, treble: 5, mid: 6, bass: 6, presence: 4 },
  },
  cab: {
    model: '1x12 Bassbreaker', enabled: true,
    params: { ...R121_OFF_AXIS_3 },
  },
  delay: {
    model: 'Analog Delay', enabled: true,
    params: { time: 320, feedback: 18, mix: 10, hi_cut: 4500, low_cut: 100 },
  },
  reverb: { ...SPRING_REVERB_DEFAULT, params: { ...SPRING_REVERB_DEFAULT.params, mixer: 4 } },
  style: 'blues',
  gain: 'low',
  pickupAffinity: { HB: 75, SC: 90, P90: 80 },
};

const MUDDY_PATCH = {
  id: 'muddy_patch',
  name: 'Chicago Blues — Muddy',
  factory: true,
  source: 'orphan',
  notes: "Pour Hoochie Coochie Man (Muddy Waters sur Tele modifiée + Super Reverb). Son sec, peu de gain, mic dynamique axis-on pour le grain blues. Pas de drive externe — l'overdrive vient de l'amp poussé.",
  usages: [
    { artist: 'Muddy Waters', songs: ['Hoochie Coochie Man', 'Mannish Boy', 'Got My Mojo Working'] },
  ],
  amp: {
    model: "Fender '65 Super Reverb", enabled: true,
    params: { gain: 5, treble: 6, mid: 5, bass: 7, presence: 5 },
  },
  cab: {
    model: "1x10 '62 Princeton C10R", enabled: true,
    params: { ...SM57_AXIS_ON_6 },
  },
  reverb: { ...SPRING_REVERB_DEFAULT },
  style: 'blues',
  gain: 'low',
  pickupAffinity: { HB: 85, SC: 80, P90: 95 },
};

// ─── Patches famille (13) — contexte musical clair + champ usages ───

const BRITISH_JANGLE_CLEAN = {
  id: 'british_jangle_clean',
  name: 'British Jangle Clean — Beatles/Kinks-style',
  factory: true,
  source: 'generated',
  notes: 'Vox AC30 chime + Chorus subtil. Idéal pour arpèges clean brillants, jeu medi-pleins.',
  usages: [
    { artist: 'The Beatles' },
    { artist: 'The Kinks' },
    { artist: 'R.E.M.' },
    { artist: 'The Smiths' },
  ],
  amp: {
    model: 'UK 30 Brilliant', enabled: true,
    params: { gain: 4, treble: 7, mid: 5, bass: 5, presence: 7 },
  },
  cab: {
    model: '4x12 British 800 G12T', enabled: true,
    params: { ...R121_OFF_AXIS_3 },
  },
  mod: {
    model: 'Chorus', enabled: true,
    params: { rate: 2, depth: 3, mix: 25, feedback: 0 },
  },
  reverb: { ...SPRING_REVERB_DEFAULT },
  style: 'pop',
  gain: 'low',
  pickupAffinity: { HB: 70, SC: 90, P90: 75 },
};

const BLUESBREAKER_CRUNCH = {
  id: 'bluesbreaker_crunch',
  name: 'Bluesbreaker Crunch — Clapton-style',
  factory: true,
  source: 'generated',
  notes: 'Marshall Bluesbreaker 1962 + 4x12 Greenback + Tube Screamer en boost léger. Le son de Clapton sur Beano (1966).',
  usages: [
    { artist: 'Eric Clapton', songs: ['Hideaway (Bluesbreakers)', 'All Your Love'] },
    { artist: 'Cream', songs: ['Crossroads'] },
    { artist: 'Gary Moore' },
  ],
  drive: {
    model: 'Tube Screamer', enabled: true,
    params: { drive: 3, tone: 6, level: 7 },
  },
  amp: {
    model: 'Brit Breaker', enabled: true,
    params: { gain: 6, treble: 6, mid: 7, bass: 5, presence: 5 },
  },
  cab: {
    model: '4x12 Brit Breaker', enabled: true,
    params: { ...SM57_AXIS_ON_6 },
  },
  reverb: { ...SPRING_REVERB_DEFAULT },
  style: 'blues',
  gain: 'mid',
  pickupAffinity: { HB: 95, SC: 70, P90: 85 },
};

const TEXAN_STRAT = {
  id: 'texan_strat',
  name: 'Texan Strat Blues — SRV-style',
  factory: true,
  source: 'generated',
  notes: 'Bassman cranked + Klon en boost transparent. Le son de SRV/Jimmie Vaughan : single coil, gros volume, dynamique.',
  usages: [
    { artist: 'Stevie Ray Vaughan', songs: ['Pride and Joy', 'Texas Flood'] },
    { artist: 'Jimmie Vaughan' },
    { artist: 'ZZ Top' },
  ],
  drive: {
    model: 'Klon', enabled: true,
    params: { drive: 4, tone: 5, level: 8 },
  },
  amp: {
    model: "Fender '59 Bassman", enabled: true,
    params: { gain: 7, treble: 7, mid: 6, bass: 7, presence: 5 },
  },
  cab: {
    model: "4x10 '59 Bassman Tweed", enabled: true,
    params: { ...SM57_AXIS_ON_6 },
  },
  reverb: { ...SPRING_REVERB_DEFAULT },
  style: 'blues',
  gain: 'mid',
  pickupAffinity: { HB: 75, SC: 95, P90: 80 },
};

const COUNTRY_CHICKEN_PICKIN = {
  id: 'country_chicken_pickin',
  name: 'Chicken Pickin Country',
  factory: true,
  source: 'generated',
  notes: 'Tweed Deluxe clair + Spring discret. Twang country pour hybrid picking, bends derrière le sillet.',
  usages: [
    { artist: 'Brad Paisley' },
    { artist: 'Brent Mason' },
    { artist: 'Albert Lee' },
    { artist: 'Vince Gill' },
  ],
  amp: {
    model: "Fender '57 Deluxe", enabled: true,
    params: { gain: 4, treble: 7, mid: 5, bass: 5, presence: 6 },
  },
  cab: {
    model: "1x12 '57 Deluxe", enabled: true,
    params: { ...SM57_AXIS_ON_6 },
  },
  reverb: { ...SPRING_REVERB_DEFAULT, params: { ...SPRING_REVERB_DEFAULT.params, mixer: 2 } },
  style: 'pop',
  gain: 'low',
  pickupAffinity: { HB: 70, SC: 95, P90: 75 },
};

const MESA_MODERN_METAL = {
  id: 'mesa_modern_metal',
  name: 'Mesa Modern Metal — Mark IV-style',
  factory: true,
  source: 'generated',
  notes: 'Mesa Mark CH1 + 4x12 EVH 5150 + Big Muff en sustainer. Métal moderne, mid scoopés, attaque chirurgicale.',
  usages: [
    { artist: 'Metallica', songs: ['Master of Puppets', 'One'] },
    { artist: 'Dream Theater' },
    { artist: 'John Petrucci' },
  ],
  noise_gate: {
    model: 'Noise Reducer', enabled: true,
    params: { threshold: 6, attenuation: 8 },
  },
  drive: {
    model: 'Big Muff', enabled: true,
    params: { drive: 5, tone: 6, level: 7 },
  },
  amp: {
    model: 'Marksman CH1', enabled: true,
    params: { gain: 8, treble: 7, mid: 4, bass: 6, presence: 7 },
  },
  cab: {
    model: '4x12 EVH 5150', enabled: true,
    params: { ...SM57_AXIS_ON_6 },
  },
  reverb: { ...SPRING_REVERB_DEFAULT, params: { ...SPRING_REVERB_DEFAULT.params, mixer: 2 } },
  style: 'metal',
  gain: 'high',
  pickupAffinity: { HB: 95, SC: 50, P90: 65 },
};

const EVH_BROWN_SOUND = {
  id: 'evh_brown_sound',
  name: 'EVH Brown Sound — Van Halen-style',
  factory: true,
  source: 'generated',
  notes: '5150 en mode hard rock + Phaser MXR signature. Le brown sound emblématique : gain élevé mais articulé.',
  usages: [
    { artist: 'Van Halen', songs: ['Eruption', 'Panama', 'Ain\'t Talkin\' \'Bout Love'] },
    { artist: 'Eddie Van Halen' },
  ],
  amp: {
    model: 'EVH 5150 6L6 Blue', enabled: true,
    params: { gain: 7, treble: 6, mid: 5, bass: 5, presence: 6 },
  },
  cab: {
    model: '4x12 EVH 5150', enabled: true,
    params: { ...SM57_AXIS_ON_6 },
  },
  mod: {
    model: 'Phaser', enabled: true,
    params: { rate: 4, depth: 5, mix: 30, feedback: 4 },
  },
  delay: {
    model: 'Tape Echo', enabled: true,
    params: { time: 220, feedback: 20, mix: 15, hi_cut: 5500, low_cut: 100 },
  },
  reverb: { ...SPRING_REVERB_DEFAULT },
  style: 'hard_rock',
  gain: 'high',
  pickupAffinity: { HB: 95, SC: 60, P90: 70 },
};

const DUMBLE_SMOOTH = {
  id: 'dumble_smooth',
  name: 'Dumble Smooth — Robben Ford-style',
  factory: true,
  source: 'generated',
  notes: 'Twin Reverb boosted via Klon — approximation Dumble ODS dans la whitelist v1. Smooth, vocal, jazzy-blues.',
  usages: [
    { artist: 'Robben Ford' },
    { artist: 'Larry Carlton' },
    { artist: 'Eric Johnson' },
    { artist: 'John Mayer', songs: ['Gravity'] },
  ],
  drive: {
    model: 'Klon', enabled: true,
    params: { drive: 5, tone: 5, level: 7 },
  },
  amp: {
    model: "Fender '65 Twin Reverb", enabled: true,
    params: { gain: 5, treble: 5, mid: 7, bass: 6, presence: 5 },
  },
  cab: {
    model: '2x12 Twin D120', enabled: true,
    params: { ...R121_OFF_AXIS_3 },
  },
  reverb: { ...SPRING_REVERB_DEFAULT, params: { ...SPRING_REVERB_DEFAULT.params, mixer: 4 } },
  style: 'blues',
  gain: 'low',
  pickupAffinity: { HB: 90, SC: 85, P90: 90 },
};

const BOUTIQUE_INDIE_CLEAN = {
  id: 'boutique_indie_clean',
  name: 'Boutique Indie Clean — Wilco/Bon Iver-style',
  factory: true,
  source: 'generated',
  notes: 'Deluxe Reverb Blonde + reverb baignée. Clean tones doux, riches en harmoniques, parfait pour arpèges indie.',
  usages: [
    { artist: 'Wilco' },
    { artist: 'The National' },
    { artist: 'Bon Iver' },
    { artist: 'Nels Cline' },
  ],
  amp: {
    model: "Fender '65 Deluxe Reverb Blonde NBC", enabled: true,
    params: { gain: 4, treble: 6, mid: 6, bass: 6, presence: 5 },
  },
  cab: {
    model: "1x12 '65 Deluxe Creamback", enabled: true,
    params: { ...R121_OFF_AXIS_3 },
  },
  delay: {
    model: 'Analog Delay', enabled: true,
    params: { time: 380, feedback: 22, mix: 18, hi_cut: 4500, low_cut: 100 },
  },
  reverb: { ...SPRING_REVERB_DEFAULT, params: { ...SPRING_REVERB_DEFAULT.params, mixer: 5 } },
  style: 'pop',
  gain: 'low',
  pickupAffinity: { HB: 85, SC: 90, P90: 85 },
};

const BRITISH_DOOM = {
  id: 'british_doom',
  name: 'British Doom — Sabbath-style',
  factory: true,
  source: 'generated',
  notes: 'Soldano SLO 100 + 4x12 G12T + Univibe pour le grain stoner. Wall of sound, tempo lent, gain massif.',
  usages: [
    { artist: 'Black Sabbath', songs: ['Iron Man', 'War Pigs', 'Paranoid'] },
    { artist: 'Sleep' },
    { artist: 'Electric Wizard' },
    { artist: 'Sleep' },
  ],
  amp: {
    model: 'Solo 100 Overdrive', enabled: true,
    params: { gain: 8, treble: 5, mid: 6, bass: 7, presence: 5 },
  },
  cab: {
    model: '4x12 British 800 G12T', enabled: true,
    params: { ...SM57_AXIS_ON_6 },
  },
  mod: {
    model: 'Univibe', enabled: true,
    params: { rate: 3, depth: 6, mix: 30, feedback: 0 },
  },
  reverb: { ...SPRING_REVERB_DEFAULT },
  style: 'metal',
  gain: 'high',
  pickupAffinity: { HB: 95, SC: 55, P90: 75 },
};

const JAZZ_ARCHTOP_CLEAN = {
  id: 'jazz_archtop_clean',
  name: 'Jazz Archtop Clean — Wes/Metheny-style',
  factory: true,
  source: 'generated',
  notes: 'Roland JC-120 clean cristallin + cab petit (Blues Junior). Idéal sur archtop avec micros HB neck.',
  usages: [
    { artist: 'Wes Montgomery' },
    { artist: 'Pat Metheny' },
    { artist: 'Joe Pass' },
    { artist: 'George Benson' },
  ],
  amp: {
    model: 'JC Clean', enabled: true,
    params: { gain: 3, treble: 5, mid: 5, bass: 6, presence: 4 },
  },
  cab: {
    model: '1x12 Blues Junior C12N', enabled: true,
    params: { ...R121_OFF_AXIS_3 },
  },
  reverb: { ...SPRING_REVERB_DEFAULT, params: { ...SPRING_REVERB_DEFAULT.params, mixer: 4 } },
  style: 'jazz',
  gain: 'low',
  pickupAffinity: { HB: 95, SC: 60, P90: 80 },
};

const FUNK_STRAT_CHICKEN = {
  id: 'funk_strat_chicken',
  name: 'Funk Strat — Nile Rodgers-style',
  factory: true,
  source: 'generated',
  notes: 'Princeton Reverb + Tremolo subtil. Single coil pos. 2/4 quack, jeu staccato style Chic / Cory Wong.',
  usages: [
    { artist: 'Nile Rodgers' },
    { artist: 'Cory Wong' },
    { artist: 'John Mayer', songs: ['Wildfire', 'I Don\'t Trust Myself'] },
    { artist: 'Vulfpeck' },
  ],
  amp: {
    model: "Fender '65 Princeton Reverb", enabled: true,
    params: { gain: 4, treble: 6, mid: 5, bass: 5, presence: 5 },
  },
  cab: {
    model: "1x12 '65 Deluxe C12K", enabled: true,
    params: { ...R121_OFF_AXIS_3 },
  },
  mod: {
    model: 'Tremolo', enabled: true,
    params: { rate: 5, depth: 4, mix: 50, feedback: 0 },
  },
  reverb: { ...SPRING_REVERB_DEFAULT, params: { ...SPRING_REVERB_DEFAULT.params, mixer: 3 } },
  style: 'pop',
  gain: 'low',
  pickupAffinity: { HB: 60, SC: 95, P90: 70 },
};

const ORANGE_STONER_GRIT = {
  id: 'orange_stoner_grit',
  name: 'Orange Stoner Grit — QOTSA-style',
  factory: true,
  source: 'generated',
  notes: 'Orange Rockerverb + Big Muff + Tape Echo. Fuzzy stoner, low end massif, modulation lente.',
  usages: [
    { artist: 'Queens of the Stone Age', songs: ['No One Knows', 'Little Sister'] },
    { artist: 'Mastodon' },
    { artist: 'Kyuss' },
    { artist: 'Earthless' },
  ],
  drive: {
    model: 'Big Muff', enabled: true,
    params: { drive: 6, tone: 5, level: 7 },
  },
  amp: {
    model: 'Tangerine RV53', enabled: true,
    params: { gain: 6, treble: 6, mid: 7, bass: 7, presence: 5 },
  },
  cab: {
    model: '4x12 British 800 G12T', enabled: true,
    params: { ...SM57_AXIS_ON_6 },
  },
  delay: {
    model: 'Tape Echo', enabled: true,
    params: { time: 480, feedback: 35, mix: 18, hi_cut: 4000, low_cut: 100 },
  },
  reverb: { ...SPRING_REVERB_DEFAULT, params: { ...SPRING_REVERB_DEFAULT.params, mixer: 4 } },
  style: 'hard_rock',
  gain: 'mid',
  pickupAffinity: { HB: 90, SC: 70, P90: 85 },
};

const AMBIENT_POST_ROCK = {
  id: 'ambient_post_rock',
  name: 'Ambient Post-Rock — Sigur Rós-style',
  factory: true,
  source: 'generated',
  notes: 'Twin Reverb clean + Shimmer + Tape Echo long. Cathedrales sonores, drones, build-ups post-rock.',
  usages: [
    { artist: 'Sigur Rós' },
    { artist: 'Explosions in the Sky' },
    { artist: 'This Will Destroy You' },
    { artist: 'Mogwai' },
  ],
  amp: {
    model: "Fender '65 Twin Reverb", enabled: true,
    params: { gain: 3, treble: 5, mid: 5, bass: 6, presence: 4 },
  },
  cab: {
    model: "2x12 '65 Twin C12K", enabled: true,
    params: { ...R121_OFF_AXIS_3 },
  },
  delay: {
    model: 'Tape Echo', enabled: true,
    params: { time: 600, feedback: 45, mix: 30, hi_cut: 4500, low_cut: 100 },
  },
  reverb: {
    model: 'Shimmer', enabled: true,
    params: { decay: 8, mix: 50, hi_cut: 6000, low_cut: 100, predelay: 20 },
  },
  style: 'pop',
  gain: 'low',
  pickupAffinity: { HB: 85, SC: 90, P90: 80 },
};

// ─── Aggregate factory list ─────────────────────────────────────────

const TMP_FACTORY_PATCHES = [
  // Arthur (3)
  ROCK_PRESET,
  CLEAN_PRESET,
  FLIPPER_PATCH,
  // Orphelins seed (4)
  STAIRWAY_PATCH,
  MONEY_PATCH,
  ROMEO_PATCH,
  MUDDY_PATCH,
  // Famille (13)
  BRITISH_JANGLE_CLEAN,
  BLUESBREAKER_CRUNCH,
  TEXAN_STRAT,
  COUNTRY_CHICKEN_PICKIN,
  MESA_MODERN_METAL,
  EVH_BROWN_SOUND,
  DUMBLE_SMOOTH,
  BOUTIQUE_INDIE_CLEAN,
  BRITISH_DOOM,
  JAZZ_ARCHTOP_CLEAN,
  FUNK_STRAT_CHICKEN,
  ORANGE_STONER_GRIT,
  AMBIENT_POST_ROCK,
];

// ─── Helpers ────────────────────────────────────────────────────────

function findPatchById(id) {
  return TMP_FACTORY_PATCHES.find((p) => p.id === id) || null;
}

function getFactoryPatches() {
  return TMP_FACTORY_PATCHES;
}

// ─── Device catalog metadata (consommé par registerDevice) ──────────

const TONEMASTER_PRO_CATALOG = {
  id: 'tonemaster-pro',
  label: 'Tone Master Pro',
  icon: '🎚️',
  description: 'Tone Master Pro — chaîne de 9 blocs, ~20 patches factory.',
  initBanks: {},      // pas de banks au sens ToneX
  factoryBanks: {},   // idem
  maxBanks: 99,       // limite firmware TMP (slots 1-99)
  slots: [],          // pas de slots A/B/C
  excludedSources: [],
  bankStorageKey: 'tmpPatches',
  presetResultKey: 'preset_tmp',
  defaultEnabled: false,
  requiresPro: true,
  deviceKey: 'tmp',
  deviceColor: 'var(--brass-400)',
};

function isPresetSourceCompatible(_src) {
  // Phase 3 v1 : TMP n'a pas de contrainte de source (les patches sont
  // construits in-app, pas importés depuis des sources tierces).
  return true;
}

export {
  TMP_FACTORY_PATCHES,
  ROCK_PRESET, CLEAN_PRESET, FLIPPER_PATCH,
  STAIRWAY_PATCH, MONEY_PATCH, ROMEO_PATCH, MUDDY_PATCH,
  BRITISH_JANGLE_CLEAN, BLUESBREAKER_CRUNCH, TEXAN_STRAT,
  COUNTRY_CHICKEN_PICKIN, MESA_MODERN_METAL, EVH_BROWN_SOUND,
  DUMBLE_SMOOTH, BOUTIQUE_INDIE_CLEAN, BRITISH_DOOM,
  JAZZ_ARCHTOP_CLEAN, FUNK_STRAT_CHICKEN, ORANGE_STONER_GRIT,
  AMBIENT_POST_ROCK,
  SPRING_REVERB_DEFAULT, SM57_AXIS_ON_6, R121_OFF_AXIS_3,
  findPatchById, getFactoryPatches,
  TONEMASTER_PRO_CATALOG, isPresetSourceCompatible,
};

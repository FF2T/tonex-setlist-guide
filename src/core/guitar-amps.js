// src/core/guitar-amps.js — Phase A (amplis guitare traditionnels).
//
// Catalog statique d'amplis guitare TRADITIONNELS (= matériel physique
// non-ToneX). Distinct des captures ToneX et des patches Tone Master Pro.
// Permet à Backline de recommander des réglages de potards pour les
// guitaristes qui jouent sur un ampli réel (Marshall Plexi, Blues Junior…).
//
// Modèle data strictement parallèle à `core/bass-amps.js` (Phase 8.1) :
// `{id, name, short, brand, wattage, channels, knobs, eq, features, refs}`.
// Le champ `knobs` liste les VRAIS potards de l'ampli (noms affichés à l'UI
// + guide pour le prompt fetchAI qui renvoie guitar_amp_settings 0-10).
//
// Custom user extensible via `profile.customGuitarAmps` (form ProfileTab).

const GUITAR_AMPS = [
  {
    id: "marshall_plexi",
    name: "Marshall Super Lead Plexi 1959",
    short: "Marshall Plexi",
    brand: "Marshall",
    wattage: 100,
    channels: ["Normal", "Bright"],
    knobs: ["volume_i", "volume_ii", "treble", "mid", "bass", "presence"],
    eq: ["Treble", "Mid", "Bass", "Presence"],
    features: ["2 canaux jumpables", "Crunch British 60s/70s", "Pas de master volume"],
    refs: {
      fr: "Tête à lampes 100W, le crunch British par excellence (Hendrix, Page, Angus Young, Clapton Bluesbreakers). 2 canaux Normal/Bright souvent jumpés au câble. Pas de master → le volume crée la saturation. Presence pour l'aigu/agressivité.",
      en: "100W tube head, the quintessential British crunch (Hendrix, Page, Angus Young, Clapton Bluesbreakers). Normal/Bright channels often jumped with a cable. No master → volume drives the saturation. Presence shapes treble/bite.",
      es: "Cabezal a válvulas 100W, el crunch British por excelencia (Hendrix, Page, Angus Young, Clapton Bluesbreakers). Canales Normal/Bright a menudo puenteados. Sin master → el volumen genera la saturación. Presence para el agudo/mordiente."
    }
  },
  {
    id: "fender_blues_junior",
    name: "Fender Blues Junior",
    short: "Blues Junior",
    brand: "Fender",
    wattage: 15,
    channels: ["Single"],
    knobs: ["volume", "treble", "bass", "middle", "master", "reverb"],
    eq: ["Treble", "Bass", "Middle"],
    features: ["Fat switch (boost mids)", "Reverb à ressort", "Combo 1x12 léger"],
    refs: {
      fr: "Combo 15W 1x12 à lampes. Clean Fender chaleureux + léger breakup quand on pousse. Switch Fat pour un boost de médiums. Reverb à ressort intégrée. Idéal blues/rock à volume de salon ou petit club.",
      en: "15W 1x12 tube combo. Warm Fender clean + light breakup when pushed. Fat switch for a mid boost. Built-in spring reverb. Great for blues/rock at bedroom or small-club volume.",
      es: "Combo 15W 1x12 a válvulas. Clean Fender cálido + breakup ligero al subir. Switch Fat para realce de medios. Reverb de muelles integrada. Ideal blues/rock a volumen de salón o club pequeño."
    }
  },
  {
    id: "fender_deluxe_reverb",
    name: "Fender '65 Deluxe Reverb",
    short: "Deluxe Reverb",
    brand: "Fender",
    wattage: 22,
    channels: ["Normal", "Vibrato"],
    knobs: ["volume", "treble", "bass", "reverb", "speed", "intensity"],
    eq: ["Treble", "Bass"],
    features: ["Reverb + trémolo (Vibrato)", "Clean blackface", "Combo 1x12"],
    refs: {
      fr: "Combo 22W 1x12 blackface. Le clean Fender de référence (studio, country, blues, indie). Reverb à ressort + trémolo sur le canal Vibrato. Breakup musical autour de 5-6. Headroom limité — sature vite à fort volume.",
      en: "22W 1x12 blackface combo. The reference Fender clean (studio, country, blues, indie). Spring reverb + tremolo on the Vibrato channel. Musical breakup around 5-6. Limited headroom — breaks up at higher volumes.",
      es: "Combo 22W 1x12 blackface. El clean Fender de referencia (estudio, country, blues, indie). Reverb de muelles + trémolo en el canal Vibrato. Breakup musical sobre 5-6. Headroom limitado — satura a volumen alto."
    }
  },
  {
    id: "fender_twin_reverb",
    name: "Fender '65 Twin Reverb",
    short: "Twin Reverb",
    brand: "Fender",
    wattage: 85,
    channels: ["Normal", "Vibrato"],
    knobs: ["volume", "treble", "middle", "bass", "reverb", "speed", "intensity"],
    eq: ["Treble", "Middle", "Bass"],
    features: ["Énorme headroom clean", "Reverb + trémolo", "Combo 2x12"],
    refs: {
      fr: "Combo 85W 2x12 blackface. Le clean le plus puissant et brillant de Fender — headroom quasi illimité (jazz, funk, pédales devant). Reverb + trémolo. Reste clean même fort. Pédales overdrive/fuzz très flatteuses dessus.",
      en: "85W 2x12 blackface combo. Fender's loudest, brightest clean — nearly unlimited headroom (jazz, funk, pedal platform). Reverb + tremolo. Stays clean even loud. A flattering platform for overdrive/fuzz pedals.",
      es: "Combo 85W 2x12 blackface. El clean más potente y brillante de Fender — headroom casi ilimitado (jazz, funk, plataforma de pedales). Reverb + trémolo. Limpio incluso a volumen alto. Plataforma ideal para overdrive/fuzz."
    }
  },
  {
    id: "vox_ac30",
    name: "Vox AC30 Top Boost",
    short: "Vox AC30",
    brand: "Vox",
    wattage: 30,
    channels: ["Normal", "Top Boost"],
    knobs: ["volume", "treble", "bass", "cut", "tone_cut", "master"],
    eq: ["Treble", "Bass", "Cut"],
    features: ["Chime British", "Top Boost", "Combo 2x12 Celestion"],
    refs: {
      fr: "Combo 30W 2x12 à lampes EL84. Le chime British scintillant (Beatles, Queen/Brian May, The Edge/U2, Radiohead). Canal Top Boost pour aigu + médiums riches. Le potard Cut roule les aigus. Breakup chaleureux et compressé.",
      en: "30W 2x12 EL84 tube combo. The shimmering British chime (Beatles, Queen/Brian May, The Edge/U2, Radiohead). Top Boost channel for rich treble + mids. The Cut knob rolls off highs. Warm, compressed breakup.",
      es: "Combo 30W 2x12 a válvulas EL84. El chime British brillante (Beatles, Queen/Brian May, The Edge/U2, Radiohead). Canal Top Boost para agudo + medios ricos. El potenciómetro Cut atenúa los agudos. Breakup cálido y comprimido."
    }
  },
  {
    id: "marshall_jcm800",
    name: "Marshall JCM800 2203",
    short: "JCM800",
    brand: "Marshall",
    wattage: 100,
    channels: ["Single (Master Volume)"],
    knobs: ["preamp", "master", "treble", "middle", "bass", "presence"],
    eq: ["Treble", "Middle", "Bass", "Presence"],
    features: ["Master Volume", "High gain 80s", "Mono canal"],
    refs: {
      fr: "Tête à lampes 100W master volume. Le hard rock/metal 80s (Slash, Zakk Wylde, Iron Maiden, AC/DC live). Gain plus serré et agressif que le Plexi grâce au master. Preamp pousse la saturation, master gère le volume. Presence/médiums = mordant.",
      en: "100W master-volume tube head. The 80s hard rock/metal voice (Slash, Zakk Wylde, Iron Maiden, AC/DC live). Tighter, more aggressive gain than the Plexi thanks to the master. Preamp drives saturation, master sets volume. Presence/mids = bite.",
      es: "Cabezal a válvulas 100W con master volume. El hard rock/metal de los 80 (Slash, Zakk Wylde, Iron Maiden, AC/DC en vivo). Ganancia más apretada y agresiva que el Plexi gracias al master. Preamp empuja la saturación, master ajusta el volumen. Presence/medios = mordiente."
    }
  },
  {
    id: "mesa_dual_rectifier",
    name: "Mesa Boogie Dual Rectifier",
    short: "Dual Rectifier",
    brand: "Mesa Boogie",
    wattage: 100,
    channels: ["Clean", "Vintage", "Modern"],
    knobs: ["gain", "treble", "middle", "bass", "presence", "master"],
    eq: ["Treble", "Middle", "Bass", "Presence"],
    features: ["High gain moderne", "3 canaux", "Saturation grasse"],
    refs: {
      fr: "Tête à lampes 100W high gain moderne (Metallica, Tool, nu-metal, prog). 3 canaux dont Modern très saturé et grave-lourd. Idéal drop tunings et palm muting serré. Gros low end, médiums scoopables. Très différent des Marshall (plus dark/compressé).",
      en: "100W modern high-gain tube head (Metallica, Tool, nu-metal, prog). 3 channels incl. a very saturated, bass-heavy Modern. Great for drop tunings and tight palm muting. Big low end, scoopable mids. Very different from Marshalls (darker/more compressed).",
      es: "Cabezal a válvulas 100W high gain moderno (Metallica, Tool, nu-metal, prog). 3 canales incl. un Modern muy saturado y grave. Ideal drop tunings y palm muting apretado. Gran low end, medios scoopables. Muy distinto de los Marshall (más oscuro/comprimido)."
    }
  },
];

const GUITAR_AMP_BRANDS = [...new Set(GUITAR_AMPS.map(a => a.brand))];

function findGuitarAmp(id) {
  const a = GUITAR_AMPS.find(x => x.id === id);
  if (a) return a;
  if (typeof window !== 'undefined' && window.__allGuitarAmps) {
    const ca = window.__allGuitarAmps.find(x => x.id === id);
    if (ca) return ca;
  }
  return null;
}

export { GUITAR_AMPS, GUITAR_AMP_BRANDS, findGuitarAmp };

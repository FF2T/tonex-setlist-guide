// src/core/bass-amps.js — Phase 8.1 (basse).
//
// Catalog statique d'amplis basse TRADITIONNELS (= matériel physique
// non-ToneX). Distinct des captures ToneX. Permet à Backline de
// recommander des réglages d'ampli physique pour les bassistes qui
// utilisent un Rumble 100, Ampeg SVT, etc.
//
// Modèle data parallèle au futur ampli traditionnel guitare (Phase 13,
// non implémenté ici) : pattern générique `{id, name, brand, wattage,
// channels, eq, features, refs}` qui pourra être réutilisé.
//
// Phase 8.1 — 4 amplis basse iconiques :
//   - Fender Rumble 100 (Sébastien — son ampli principal basse)
//   - Ampeg SVT-VR (vintage rock 70s)
//   - Markbass Little Mark III (moderne léger jazz/fusion)
//   - Aguilar Tone Hammer 500 (boutique haut de gamme)
//
// Custom user extensible via `profile.customBassAmps` (Phase 8.x future).

const BASS_AMPS = [
  {
    id: "rumble_100",
    name: "Fender Rumble 100",
    short: "Rumble 100",
    brand: "Fender",
    wattage: 100,
    channels: ["Clean"],
    eq: ["Bass", "Low Mid", "High Mid", "Treble"],
    features: ["Overdrive", "Bright", "Contour", "Vintage", "Aux In", "Headphone Out"],
    refs: {
      fr: "Combo basse 100W léger (~10 kg). Channel Clean + Overdrive intégré + 3 voicings (Bright, Contour, Vintage). EQ 4 bandes paramétrique. Polyvalent pour répétition et petits live.",
      en: "Lightweight 100W bass combo (~10 kg). Clean channel + built-in overdrive + 3 voicings (Bright, Contour, Vintage). 4-band parametric EQ. Versatile for rehearsals and small gigs.",
      es: "Combo de bajo 100W ligero (~10 kg). Canal Clean + overdrive integrado + 3 voicings (Bright, Contour, Vintage). EQ paramétrico de 4 bandas. Versátil para ensayos y conciertos pequeños."
    }
  },
  {
    id: "ampeg_svt_vr",
    name: "Ampeg SVT-VR",
    short: "Ampeg SVT-VR",
    brand: "Ampeg",
    wattage: 300,
    channels: ["Normal", "Bright"],
    eq: ["Bass", "Mid (5 freq)", "Treble", "Ultra Low", "Ultra High"],
    features: ["8x 6550 tubes", "Vintage 70s rock", "Big iron"],
    refs: {
      fr: "Tête à lampes 300W vintage 70s. 8 lampes 6550, son massif et chaud — le standard rock classique (Led Zeppelin, Rolling Stones, Stevie Wonder). Channels Normal/Bright + Ultra Low/High pour pousser les extrêmes du spectre.",
      en: "300W vintage 70s tube head. 8x 6550 tubes, massive warm tone — the classic rock standard (Led Zeppelin, Rolling Stones, Stevie Wonder). Normal/Bright channels + Ultra Low/High to push spectrum extremes.",
      es: "Cabezal a válvulas 300W vintage 70s. 8 válvulas 6550, sonido masivo y cálido — el estándar rock clásico (Led Zeppelin, Rolling Stones, Stevie Wonder). Canales Normal/Bright + Ultra Low/High para reforzar extremos del espectro."
    }
  },
  {
    id: "markbass_little_mark_iii",
    name: "Markbass Little Mark III",
    short: "Little Mark III",
    brand: "Markbass",
    wattage: 500,
    channels: ["Clean"],
    eq: ["Bass", "Low Mid", "High Mid", "Treble"],
    features: ["VLE (Vintage Loudspeaker Emulator)", "VPF (Variable Pre-Filter)", "Light (~3 kg)"],
    refs: {
      fr: "Tête solid-state 500W ultra-légère (~3 kg). Standard jazz/fusion moderne. VLE + VPF pour assombrir ou scooper le son en un bouton. Son clair et défini, peu de coloration.",
      en: "500W solid-state head, ultra-light (~3 kg). Modern jazz/fusion standard. VLE + VPF for one-knob darkening/scooping. Clean and defined tone, minimal coloration.",
      es: "Cabezal de estado sólido 500W ultraligero (~3 kg). Estándar moderno jazz/fusión. VLE + VPF para oscurecer/scoopear con un solo botón. Sonido claro y definido, poca coloración."
    }
  },
  {
    id: "aguilar_tone_hammer_500",
    name: "Aguilar Tone Hammer 500",
    short: "Tone Hammer 500",
    brand: "Aguilar",
    wattage: 500,
    channels: ["Clean"],
    eq: ["Bass", "Mid (semi-paramétrique freq)", "Treble", "Drive"],
    features: ["AGS circuit (saturation)", "Light (~1.8 kg)"],
    refs: {
      fr: "Tête solid-state 500W ultra-portable (~1.8 kg). Boutique moderne. AGS (Adaptive Gain Shaping) pour saturation analogique chaude. EQ 3 bandes avec mid semi-paramétrique (fréquence sélectionnable).",
      en: "500W solid-state head, ultra-portable (~1.8 kg). Modern boutique. AGS (Adaptive Gain Shaping) for warm analog saturation. 3-band EQ with semi-parametric mid (selectable frequency).",
      es: "Cabezal de estado sólido 500W ultraportátil (~1.8 kg). Boutique moderna. AGS (Adaptive Gain Shaping) para saturación analógica cálida. EQ 3 bandas con medio semiparamétrico (frecuencia seleccionable)."
    }
  },
];

const BASS_AMP_BRANDS = [...new Set(BASS_AMPS.map(a => a.brand))];

function findBassAmp(id) {
  const a = BASS_AMPS.find(x => x.id === id);
  if (a) return a;
  if (typeof window !== 'undefined' && window.__allBassAmps) {
    const ca = window.__allBassAmps.find(x => x.id === id);
    if (ca) return ca;
  }
  return null;
}

export { BASS_AMPS, BASS_AMP_BRANDS, findBassAmp };

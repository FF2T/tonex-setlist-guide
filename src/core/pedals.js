// src/core/pedals.js — Phase C (pédalier physique).
//
// Catalog statique de pédales d'effet TRADITIONNELLES (matériel physique
// analogique, hors ToneX). Permet à Backline de recommander quelles pédales
// activer + leurs réglages de potards 0-10 par morceau (champ IA
// `pedalboard_settings`), quand l'utilisateur joue sur ampli (rig = Ampli).
//
// Modèle data parallèle à `core/guitar-amps.js` mais centré pédale :
// `{id, name, short, brand, type, knobs, refs}`.
// - `type` ∈ PEDAL_TYPES (drive/fuzz/chorus/delay/reverb/comp/wah/…).
// - `knobs` : VRAIS potards de la pédale (noms snake_case affichés à l'UI +
//   guide pour le prompt fetchAI qui renvoie les réglages 0-10).
//
// Custom user extensible via `profile.customPedals` (form ProfileTab +
// recherche IA PedalSearchAdd).

const PEDAL_TYPES = [
  'drive', 'overdrive', 'distortion', 'fuzz', 'boost', 'compressor',
  'eq', 'chorus', 'phaser', 'flanger', 'tremolo', 'vibrato',
  'delay', 'reverb', 'wah', 'octave', 'pitch',
];

const PEDALS = [
  {
    id: 'ts808', name: 'Ibanez Tube Screamer TS808', short: 'Tube Screamer',
    brand: 'Ibanez', type: 'overdrive', knobs: ['drive', 'tone', 'level'],
    refs: {
      fr: "L'overdrive le plus célèbre. Pousse les médiums et resserre les basses — parfait en boost devant un ampli crunch (SRV, blues, classic rock). Drive bas + level haut = boost transparent.",
      en: 'The most famous overdrive. Pushes mids and tightens lows — perfect as a boost in front of a cranked amp (SRV, blues, classic rock). Low drive + high level = transparent boost.',
      es: 'El overdrive más famoso. Realza medios y aprieta graves — perfecto como boost ante un ampli crunch (SRV, blues, classic rock). Drive bajo + level alto = boost transparente.',
    },
  },
  {
    id: 'klon_centaur', name: 'Klon Centaur', short: 'Klon',
    brand: 'Klon', type: 'overdrive', knobs: ['gain', 'treble', 'output'],
    refs: {
      fr: "Overdrive transparent légendaire (et son clone 'KTR'). Garde le son de l'ampli, ajoute du gain et de l'aigu. Excellent en boost propre ou léger crunch.",
      en: "Legendary transparent overdrive (and its 'KTR' clone). Preserves the amp tone, adds gain and treble. Excellent as a clean boost or light crunch.",
      es: "Overdrive transparente legendario (y su clon 'KTR'). Conserva el tono del ampli, añade ganancia y agudos. Excelente como boost limpio o crunch ligero.",
    },
  },
  {
    id: 'bd2_blues_driver', name: 'Boss BD-2 Blues Driver', short: 'Blues Driver',
    brand: 'Boss', type: 'overdrive', knobs: ['gain', 'tone', 'level'],
    refs: {
      fr: 'Overdrive dynamique et réactif au toucher, son légèrement vintage/grunge. Du clean au crunch bien saturé selon le gain. Très répandu (blues, rock, indie).',
      en: 'Dynamic, touch-sensitive overdrive with a slightly vintage/grungy voice. From clean to well-saturated crunch depending on gain. Very widespread (blues, rock, indie).',
      es: 'Overdrive dinámico y sensible al toque, con voz ligeramente vintage/grunge. Del clean al crunch saturado según la ganancia. Muy extendido (blues, rock, indie).',
    },
  },
  {
    id: 'proco_rat', name: 'ProCo Rat', short: 'Rat',
    brand: 'ProCo', type: 'distortion', knobs: ['distortion', 'filter', 'volume'],
    refs: {
      fr: "Distorsion polyvalente et agressive (le Filter coupe l'aigu en le tournant). Du léger crunch à la disto liquide (Gilmour, Thom Yorke, Jeff Beck). Filter à fond à gauche = max d'aigu.",
      en: 'Versatile, aggressive distortion (the Filter is a reversed tone — cuts treble clockwise). From light crunch to liquid distortion (Gilmour, Thom Yorke, Jeff Beck).',
      es: 'Distorsión versátil y agresiva (el Filter recorta agudos al girarlo). Del crunch ligero a la distorsión líquida (Gilmour, Thom Yorke, Jeff Beck).',
    },
  },
  {
    id: 'boss_ds1', name: 'Boss DS-1 Distortion', short: 'DS-1',
    brand: 'Boss', type: 'distortion', knobs: ['tone', 'level', 'dist'],
    refs: {
      fr: 'Distorsion orange iconique, brillante et tranchante. Punk, hard rock, lead 80s (Kurt Cobain, Joe Satriani en boost). Tone élevé = mordant.',
      en: 'Iconic orange distortion, bright and cutting. Punk, hard rock, 80s leads (Kurt Cobain, Satriani as a boost). High tone = bite.',
      es: 'Distorsión naranja icónica, brillante y cortante. Punk, hard rock, leads 80s (Kurt Cobain, Satriani como boost). Tone alto = mordiente.',
    },
  },
  {
    id: 'big_muff', name: 'Electro-Harmonix Big Muff Pi', short: 'Big Muff',
    brand: 'Electro-Harmonix', type: 'fuzz', knobs: ['volume', 'tone', 'sustain'],
    refs: {
      fr: 'Fuzz épais et soutenu, mur de son (Gilmour, Smashing Pumpkins, White Stripes). Sustain à fond pour les leads chantants. Tone creusé = scooped, monté = nasillard.',
      en: 'Thick, sustained fuzz — wall of sound (Gilmour, Smashing Pumpkins, White Stripes). Max sustain for singing leads. Tone low = scooped, high = nasal.',
      es: 'Fuzz grueso y sostenido, muro de sonido (Gilmour, Smashing Pumpkins, White Stripes). Sustain al máximo para leads cantarines. Tone bajo = scooped.',
    },
  },
  {
    id: 'fuzz_face', name: 'Dunlop Fuzz Face', short: 'Fuzz Face',
    brand: 'Dunlop', type: 'fuzz', knobs: ['fuzz', 'volume'],
    refs: {
      fr: "Fuzz vintage germanium/silicium (Hendrix, Gilmour). Très réactif au volume de la guitare : on baisse le volume guitare pour nettoyer. À placer en premier dans la chaîne.",
      en: 'Vintage germanium/silicon fuzz (Hendrix, Gilmour). Very reactive to guitar volume: roll back the guitar volume to clean up. Place first in the chain.',
      es: 'Fuzz vintage germanio/silicio (Hendrix, Gilmour). Muy reactivo al volumen de la guitarra: baja el volumen para limpiar. Colócalo primero en la cadena.',
    },
  },
  {
    id: 'mxr_micro_amp', name: 'MXR Micro Amp', short: 'Micro Amp',
    brand: 'MXR', type: 'boost', knobs: ['gain'],
    refs: {
      fr: 'Boost de gain propre à un seul potard. Pousse l\'ampli en saturation ou augmente le volume des solos sans colorer le son.',
      en: 'Clean single-knob gain boost. Pushes the amp into saturation or lifts solo volume without coloring the tone.',
      es: 'Boost de ganancia limpio de un solo potenciómetro. Empuja el ampli a la saturación o sube el volumen de los solos sin colorear.',
    },
  },
  {
    id: 'mxr_dyna_comp', name: 'MXR Dyna Comp', short: 'Dyna Comp',
    brand: 'MXR', type: 'compressor', knobs: ['output', 'sensitivity'],
    refs: {
      fr: 'Compresseur classique : sustain et attaque régulière (country, funk, clean Nashville). Sensitivity élevé = compression marquée. Output pour compenser le volume.',
      en: 'Classic compressor: sustain and even attack (country, funk, Nashville clean). High sensitivity = heavy compression. Output to make up volume.',
      es: 'Compresor clásico: sustain y ataque uniforme (country, funk, clean Nashville). Sensitivity alto = compresión marcada. Output para compensar el volumen.',
    },
  },
  {
    id: 'boss_ce2_chorus', name: 'Boss CE-2 Chorus', short: 'CE-2 Chorus',
    brand: 'Boss', type: 'chorus', knobs: ['rate', 'depth'],
    refs: {
      fr: 'Chorus analogique chaud, son 80s (The Police, clean shimmer). Rate lent + depth modéré = épaisseur ; rate rapide = effet rotary léger.',
      en: 'Warm analog chorus, 80s tone (The Police, clean shimmer). Slow rate + moderate depth = thickness; fast rate = light rotary effect.',
      es: 'Chorus analógico cálido, sonido 80s (The Police, shimmer limpio). Rate lento + depth moderado = grosor; rate rápido = efecto rotary ligero.',
    },
  },
  {
    id: 'mxr_phase90', name: 'MXR Phase 90', short: 'Phase 90',
    brand: 'MXR', type: 'phaser', knobs: ['speed'],
    refs: {
      fr: 'Phaser orange à un potard (Van Halen, Gilmour). Speed lent = ondulation, rapide = effet vibrant. Mythique sur les rythmiques funk et le rock 70s.',
      en: 'Single-knob orange phaser (Van Halen, Gilmour). Slow speed = sweep, fast = warble. Iconic on funk rhythms and 70s rock.',
      es: 'Phaser naranja de un potenciómetro (Van Halen, Gilmour). Speed lento = barrido, rápido = vibrato. Icónico en ritmos funk y rock 70s.',
    },
  },
  {
    id: 'boss_tr2_tremolo', name: 'Boss TR-2 Tremolo', short: 'TR-2 Tremolo',
    brand: 'Boss', type: 'tremolo', knobs: ['rate', 'wave', 'depth'],
    refs: {
      fr: 'Trémolo (modulation de volume) — surf, vintage, ambient. Rate = vitesse, Depth = profondeur, Wave = forme (doux à choppé).',
      en: 'Tremolo (volume modulation) — surf, vintage, ambient. Rate = speed, Depth = intensity, Wave = shape (smooth to choppy).',
      es: 'Trémolo (modulación de volumen) — surf, vintage, ambient. Rate = velocidad, Depth = profundidad, Wave = forma (suave a choppy).',
    },
  },
  {
    id: 'boss_dd3_delay', name: 'Boss DD-3 Digital Delay', short: 'DD-3 Delay',
    brand: 'Boss', type: 'delay', knobs: ['e_level', 'f_back', 'd_time'],
    refs: {
      fr: 'Delay numérique propre et standard. E.Level = volume des répétitions, F.Back = nombre de répétitions, D.Time = temps. Slapback court (rockabilly) à delays longs (ambient).',
      en: 'Clean, standard digital delay. E.Level = repeat volume, F.Back = number of repeats, D.Time = time. Short slapback (rockabilly) to long delays (ambient).',
      es: 'Delay digital limpio y estándar. E.Level = volumen de repeticiones, F.Back = número de repeticiones, D.Time = tiempo. Slapback corto (rockabilly) a delays largos (ambient).',
    },
  },
  {
    id: 'mxr_carbon_copy', name: 'MXR Carbon Copy', short: 'Carbon Copy',
    brand: 'MXR', type: 'delay', knobs: ['mix', 'regen', 'delay'],
    refs: {
      fr: "Delay analogique chaud et sombre (bucket-brigade). Répétitions qui se dégradent musicalement. Regen = feedback, Mix = niveau. Idéal pour de l'épaisseur discrète.",
      en: 'Warm, dark analog (bucket-brigade) delay. Repeats degrade musically. Regen = feedback, Mix = level. Great for subtle thickening.',
      es: 'Delay analógico cálido y oscuro (bucket-brigade). Las repeticiones se degradan musicalmente. Regen = feedback, Mix = nivel. Ideal para grosor sutil.',
    },
  },
  {
    id: 'ehx_holy_grail', name: 'Electro-Harmonix Holy Grail Reverb', short: 'Holy Grail',
    brand: 'Electro-Harmonix', type: 'reverb', knobs: ['blend', 'mode'],
    refs: {
      fr: 'Reverb simple et efficace (modes Spring/Hall/Flerb). Blend = quantité. Du ressort surf au hall ambient. Pour ajouter de l\'espace sans saturer le mix.',
      en: 'Simple, effective reverb (Spring/Hall/Flerb modes). Blend = amount. From surf spring to ambient hall. Adds space without cluttering the mix.',
      es: 'Reverb simple y eficaz (modos Spring/Hall/Flerb). Blend = cantidad. Del muelle surf al hall ambient. Añade espacio sin saturar la mezcla.',
    },
  },
  {
    id: 'dunlop_cry_baby', name: 'Dunlop Cry Baby Wah', short: 'Cry Baby',
    brand: 'Dunlop', type: 'wah', knobs: ['position'],
    refs: {
      fr: 'Pédale wah-wah au pied (Hendrix, Clapton, funk). Pas de potard — le balayage se fait à la pédale. Position = ouverture de la fréquence (talon = grave, pointe = aigu).',
      en: 'Foot-rocker wah-wah (Hendrix, Clapton, funk). No knob — the sweep is done with the treadle. Position = frequency opening (heel = low, toe = high).',
      es: 'Pedal wah-wah de pie (Hendrix, Clapton, funk). Sin potenciómetro — el barrido se hace con el pedal. Position = apertura de frecuencia (talón = grave, punta = agudo).',
    },
  },
  {
    id: 'ehx_pog_octave', name: 'Electro-Harmonix POG (Octave)', short: 'POG Octave',
    brand: 'Electro-Harmonix', type: 'octave', knobs: ['dry', 'sub_octave', 'octave_up'],
    refs: {
      fr: 'Générateur d\'octaves polyphonique : ajoute une octave grave et/ou aiguë au signal sec. Sons orgue/12 cordes, nappes (Jack White, ambient).',
      en: 'Polyphonic octave generator: adds a sub and/or upper octave to the dry signal. Organ/12-string tones, pads (Jack White, ambient).',
      es: 'Generador de octavas polifónico: añade una octava grave y/o aguda a la señal seca. Sonidos órgano/12 cuerdas, pads (Jack White, ambient).',
    },
  },
];

// Marques uniques (ordre d'apparition), pour grouper l'UI.
const PEDAL_BRANDS = [...new Set(PEDALS.map((p) => p.brand))];

// Résout une pédale par id : catalog statique d'abord, puis customs user
// (window.__allPedals posé par main.jsx). Mirror de findGuitarAmp.
function findPedal(id) {
  const base = PEDALS.find((p) => p.id === id);
  if (base) return base;
  if (typeof window !== 'undefined' && window.__allPedals) {
    const cp = window.__allPedals.find((x) => x.id === id);
    if (cp) return cp;
  }
  return null;
}

export { PEDALS, PEDAL_TYPES, PEDAL_BRANDS, findPedal };

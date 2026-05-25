// src/app/utils/setlist-row-extras.js — Phase 7.55.7 S4 (S4-3).
//
// Helper pur pour la row repliée Setlists desktop (variante A maquette
// validée Sébastien 25/05). Lit aiCache.preset_settings_v1.main (potards
// Phase 9.1) + aiCache.fx_blocks (Phase 9.2) et retourne un objet
// formaté pour affichage compact ("G6 B4 M7 T5 V6" + ["Gate","Verb"]).
//
// Affichage gated CSS @media (min-width: 1024px) — sur mobile/tablette
// la row reste multi-ligne legacy. Sur desktop, on exploite la largeur
// disponible pour afficher les infos potards/FX sans déplier.
//
// Gère deux formats :
//   - Phase 7.86 nested : main.gain = { value: 6.2, why: {...} }
//   - Legacy pre-7.86  : main.gain = 6.2 (number direct)
// Acceptable au render car les caches existants peuvent contenir l'un
// ou l'autre selon leur date de fetch.

function getKnobValue(knob) {
  if (knob == null) return null;
  if (typeof knob === 'number') return Number.isFinite(knob) ? knob : null;
  if (typeof knob === 'object' && typeof knob.value === 'number' && Number.isFinite(knob.value)) {
    return knob.value;
  }
  return null;
}

// Formatage compact pour affichage row : G6, G6.2, V10 (entiers sans
// virgule, décimaux à 1 chiffre). Évite "G6.0" peu lisible.
function formatPotardValue(v) {
  if (v == null) return null;
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

const FX_LABELS = {
  noise_gate: 'Gate',
  compressor: 'Comp',
  modulation: 'Mod',
  delay: 'Delay',
  reverb: 'Verb',
};

const FX_ORDER = ['noise_gate', 'compressor', 'modulation', 'delay', 'reverb'];

export function formatRowPotardsFX(aiC) {
  if (!aiC || typeof aiC !== 'object') return null;
  const ps = aiC.preset_settings_v1;
  const fx = aiC.fx_blocks;
  let potards = null;
  if (ps && typeof ps === 'object' && ps.main && typeof ps.main === 'object') {
    const g = getKnobValue(ps.main.gain);
    const b = getKnobValue(ps.main.bass);
    const m = getKnobValue(ps.main.mid);
    const tr = getKnobValue(ps.main.treble);
    const v = getKnobValue(ps.main.volume);
    const parts = [];
    if (g != null) parts.push('G' + formatPotardValue(g));
    if (b != null) parts.push('B' + formatPotardValue(b));
    if (m != null) parts.push('M' + formatPotardValue(m));
    if (tr != null) parts.push('T' + formatPotardValue(tr));
    if (v != null) parts.push('V' + formatPotardValue(v));
    if (parts.length > 0) potards = parts.join(' ');
  }
  const fxOn = [];
  if (fx && typeof fx === 'object') {
    for (const key of FX_ORDER) {
      const block = fx[key];
      if (block && block.enabled === true && FX_LABELS[key]) {
        fxOn.push(FX_LABELS[key]);
      }
    }
  }
  if (!potards && fxOn.length === 0) return null;
  return { potards, fxOn };
}

export { getKnobValue, formatPotardValue, FX_LABELS };

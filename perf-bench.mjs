// Benchmark synthétique perf SetlistsScreen Phase 3.10.
// Mesure le coût des opérations clés (recommendTMPPatch ×129, pickTopGuitar ×129)
// AVEC et SANS la mémoization Phase 3.10 pour quantifier le gain.

import { TMP_FACTORY_PATCHES } from './src/devices/tonemaster-pro/catalog.js';
import { recommendTMPPatch } from './src/devices/tonemaster-pro/scoring.js';
import { pickTopGuitar } from './src/core/scoring/guitar.js';

const GUITARS = [
  { id: 'lp60', name: 'Les Paul Standard 60', type: 'HB' },
  { id: 'sg61', name: 'SG Standard 61', type: 'HB' },
  { id: 'es335', name: 'ES-335', type: 'HB' },
  { id: 'strat61', name: 'Strat 61', type: 'SC' },
  { id: 'tele63', name: 'Tele 63', type: 'SC' },
  { id: 'jazzmaster', name: 'Jazzmaster', type: 'SC' },
  { id: 'arthur_es339', name: 'Epiphone ES-339', type: 'HB' },
];

// Génère 129 morceaux fictifs avec aiCache simulé.
const SONGS = Array.from({ length: 129 }, (_, i) => ({
  id: `song_${i}`,
  title: `Song ${i}`,
  artist: i % 3 === 0 ? 'AC/DC' : i % 3 === 1 ? 'B.B. King' : 'Cream',
  aiCache: {
    result: {
      ref_amp: i % 2 === 0 ? 'Marshall Plexi' : 'Fender Twin Reverb',
      ref_effects: i % 2 === 0 ? 'Aucun effet' : 'Spring reverb',
      song_style: ['blues', 'rock', 'hard_rock', 'jazz'][i % 4],
      target_gain: (i % 10),
      pickup_preference: i % 2 === 0 ? 'HB' : 'SC',
      cot_step2_guitars: [
        { name: 'SG Standard 61', score: 88 },
        { name: 'Les Paul Standard 60', score: 82 },
      ],
      ideal_guitar: 'SG Standard 61',
    },
  },
}));

function bench(label, fn, iterations = 5) {
  // Warmup
  fn();
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  console.log(`${label.padEnd(60)} avg=${avg.toFixed(2)}ms  min=${min.toFixed(2)}ms  max=${max.toFixed(2)}ms`);
  return avg;
}

console.log('\n=== Phase 3.10 perf benchmark — 129 morceaux × ~7 guitares ===\n');

// AVANT (simule ancien comportement) : 129 useMemo isolés invalidés
// par changement de profile reference → recalcul à chaque render.
// SIMULATION : on appelle recommendTMPPatch pour chaque morceau dans
// une boucle plate, sans cache central.
console.log('--- AVANT Phase 3.10 (129 useMemo isolés, profile dans deps invalide chaque render) ---');
const tBefore = bench('  recommendTMPPatch ×129 (1 render)', () => {
  for (const s of SONGS) {
    const g = GUITARS[Math.floor(Math.random() * GUITARS.length)];
    recommendTMPPatch(TMP_FACTORY_PATCHES, s, g, /* profile */ {});
  }
});
const tBeforePick = bench('  pickTopGuitar ×129 (getIg dans la map row)', () => {
  for (const s of SONGS) {
    pickTopGuitar(s.aiCache.result, GUITARS, s);
  }
});
const tBeforeTotal = tBefore + tBeforePick;
console.log(`  TOTAL un render Setlists: ${tBeforeTotal.toFixed(2)}ms\n`);

// APRÈS Phase 3.10 : useMemo central → recalcul une seule fois,
// reuse pour les renders suivants.
console.log('--- APRÈS Phase 3.10 (useMemo central, recalcul UNIQUE par changement de songs/guitars) ---');
let tmpCache = null;
let pickCache = null;
const tAfterFirst = bench('  Premier render — useMemo miss', () => {
  tmpCache = new Map();
  pickCache = new Map();
  for (const s of SONGS) {
    const g = GUITARS[Math.floor(Math.random() * GUITARS.length)];
    const recs = recommendTMPPatch(TMP_FACTORY_PATCHES, s, g, {});
    tmpCache.set(s.id, recs[0]);
    pickCache.set(s.id, pickTopGuitar(s.aiCache.result, GUITARS, s));
  }
});
const tAfterReuse = bench('  Renders suivants — useMemo hit (lookup Map)', () => {
  for (const s of SONGS) {
    tmpCache.get(s.id);
    pickCache.get(s.id);
  }
});
console.log(`  Premier render Setlists: ${tAfterFirst.toFixed(2)}ms`);
console.log(`  Re-renders (toggle expand, sort, etc.): ${tAfterReuse.toFixed(2)}ms\n`);

console.log('=== Résumé ===');
console.log(`  Premier render        AVANT ${tBeforeTotal.toFixed(2)}ms → APRÈS ${tAfterFirst.toFixed(2)}ms`);
console.log(`  Re-render (cache hit) AVANT ${tBeforeTotal.toFixed(2)}ms → APRÈS ${tAfterReuse.toFixed(2)}ms (gain ${(tBeforeTotal / Math.max(0.01, tAfterReuse)).toFixed(0)}×)`);

#!/usr/bin/env node
// Génère PRESET_CATALOG complet depuis les fichiers .txp dans les packs TSR et ML
const {execSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = path.join(
  '/Users/sebastien/Library/CloudStorage/GoogleDrive-sebastien.chemin@gmail.com/Mon Drive/Documents GDrive/Musique/Guitare/TONEX/AMP'
);
const TSR_DIR = path.join(BASE, 'TSR TONE MODELS');
const ML_DIR  = path.join(BASE, 'ML-Sound-Lab-Capture-Pack-ESSENTIALS/ToneX');

// ── Règles amp par préfixe/contenu de nom ────────────────────────────────────
const AMP_RULES = [
  // TSR packs (format "TSR - Amp Name - Variant" ou "TSR Amp Name Variant")
  [/mars\s*800sl|800sl/i,      'Marshall SL800',          'hard_rock'],
  [/mars\s*slt60|slt60/i,      'Marshall SLT60',          'hard_rock'],
  [/mars\s*900|mars\s*900|jcm.?900|mar\s*900/i,'Marshall JCM900','hard_rock'],
  [/mars\s*800(?!sl)|mar\s*800(?!sl)/i,'Marshall JCM800',  'hard_rock'],
  [/jtm/i,                     'Marshall JTM45',          'rock'],
  [/plexi|dual.?singer|dual.?palis|tripple.?drive/i,'Marshall Plexi','hard_rock'],
  [/stevie\s*g/i,              'Two Rock Stevie G',       'blues'],
  [/two\s*rok\s*bloom|bloomfield/i,'Two Rock Bloomfield',  'blues'],
  [/bumble\s*dlx|bumble\s*deluxe|bumble\s*drive/i,'Dumble Deluxe','blues'],
  [/swamp\s*thing/i,           'Dumble Deluxe',           'blues'],
  [/super\s*s(?:\s|$)/i,       'Fender Super',            'clean'],
  [/fender\s*twin|twin\s*clean|twin\s*blues|fender\s*twin\s*big/i,'Fender Twin Silverface','blues'],
  [/fndr\s*consert|fender\s*concert/i,'Fender Concert',   'clean'],
  [/dlux\s*verb|dlux.verb/i,   'Fender Deluxe Reverb',    'blues'],
  [/fender\s*bassman/i,        'Fender Tweed Bassman',    'blues'],
  [/d13\s*amp39/i,             'D13 AMP39',               'rock'],
  [/d13(?!\s*amp)/i,           'D13 RG7',                 'blues'],
  [/tsr20/i,                   'TSR20',                   'hard_rock'],
  [/slodano\s*gp|gp77/i,       'Soldano GP77',            'hard_rock'],
  [/slodano/i,                 'Soldano SLO-100',         'hard_rock'],
  [/slow\s*drive|slow\s*100/i, 'Soldano SLO-100',         'hard_rock'],
  [/friedman\s*be|freeman\s*be|freeman|be\s*de/i,'Friedman BE-100','hard_rock'],
  [/buxom\s*betty/i,           'Friedman Buxom Betty',    'hard_rock'],
  [/bogy\s*gfinger|bogner\s*gfinger/i,'Bogner G-Finger',  'hard_rock'],
  [/bogy\s*helio|bogner\s*helio/i,'Bogner Helioclipse',   'hard_rock'],
  [/bogner\s*xtc|bogner\s*ecstasy|bogy\s*xtc/i,'Bogner Ecstasy','hard_rock'],
  [/rectified|rect(?:i)?(?:\s|$)/i,'Mesa Boogie Rectifier','metal'],
  [/mboogie\s*iic|mesa.*iic|iic\+/i,'Mesa Mark IIC+',    'metal'],
  [/socks\s*dc30|dc30/i,       'Matchless DC30',          'rock'],
  [/matchbox(?:\s|$)|matchbox\s*hc15|matchbox\s*inde(?!p)/i,'Matchless HC15','rock'],
  [/matchless\s*inde|inde\s*35/i,'Matchless Independence 35','rock'],
  [/jimi\s*h\s*20/i,           'Jimi H20',                'rock'],
  [/high\s*what|hg\s*100/i,    'Hiwatt HG100',            'hard_rock'],
  [/hokk\s*wiz/i,              'Hiwatt Wizard',           'hard_rock'],
  [/cat\s*cub/i,               'Fender Champ',            'blues'],
  [/indi\s*35/i,               'Independence 35',         'rock'],
  [/diesel\s*humbert/i,        'Diesel Humbert',          'hard_rock'],
  [/talon\s*50/i,              'Talon 50',                'rock'],
  [/vmp.?1/i,                  'VMP-1',                   'blues'],
  [/sons\s*amp/i,              'Sons Amplification',      'rock'],
  [/silver\s*j/i,              'Silver J',                'hard_rock'],
  [/electro\s*dime/i,          'Electro Dime',            'rock'],
  [/rouge\s*plate/i,           'Rouge Plate D50',         'clean'],
  [/reinguard|reinguard.t.?36/i,'Reinguard T-36',         'rock'],
  [/cornfield\s*harle|cornfield/i,'Cornfield Harle',      'rock'],
  [/bing\s*19t|bing\s*normal|bing\s*aggress|bing\s*high|bing\s*low/i,'Chandler 19T','rock'],
  [/british\s*chime/i,         'Vox AC30',                'rock'],
  [/british\s*rock/i,          'Marshall JTM45',          'rock'],
  [/budda\s*v20/i,             'Budda V20',               'blues'],
  [/ironlung/i,                'Ironlung',                'hard_rock'],
  [/zwrek/i,                   'ZWREK',                   'rock'],
  [/tws\s*2864/i,              'TWS 2864-S',              'rock'],
  [/amp\s*nation\s*wod/i,      'Amp Nation WOD',          'hard_rock'],
  [/amp\s*nation\s*odr|ampnation\s*odr/i,'Amp Nation ODR','blues'],
  [/50.51/i,                   'Fender 5051 Tweed',       'blues'],
  [/jc(?:\s|$)|roland\s*jc/i, 'Roland JC-120',           'clean'],
  [/a.peg|svt/i,               'Ampeg SVT Pro 4',         'clean'],
  [/gk\s*mbs/i,                'GK MB150',                'clean'],
  [/basyman|d.glaze/i,         'Ampeg Bass',              'clean'],
  // ML pack rules
  [/ml.*fman\s*be(?!.*hbe)|ml.*be\s*plexi|ml.*be\s*drive/i,'Friedman BE-100','hard_rock'],
  [/ml.*fman\s*hbe/i,          'Friedman HBE',            'hard_rock'],
  [/ml.*fndr\s*deluxe/i,       'Fender Deluxe',           'blues'],
  [/ml.*jazz\s*120/i,          'Roland JC-120',           'clean'],
  [/ml.*mars\s*800/i,          'Marshall 800',            'hard_rock'],
  [/ml.*mega\s*mk4/i,          'Mesa Mark IV',            'metal'],
  [/ml.*mega\s*rec/i,          'Mesa Rectifier',          'metal'],
  [/ml.*orng/i,                'Orange Rockerverb',       'hard_rock'],
  [/ml.*peav/i,                'Peavey 5150',             'metal'],
  [/ml.*vx30/i,                'Vox AC30',                'rock'],
  // factory presets (without prefix)
  [/cornford/i,                'Cornford HellCat',        'rock'],
  [/chandler\s*gav/i,          'Chandler GAV19T',         'rock'],
  [/jcm\s*800(?!\s*sl)/i,      'Marshall JCM800',         'hard_rock'],
  [/synergy.*dumble|dumble.*pre/i,'Dumble ODS',           'blues'],
  [/mboogie\s*iic|tube\s*king/i,'Mesa Mark IIC+',         'metal'],
  [/bogner\s*xtc/i,            'Bogner Ecstasy',          'hard_rock'],
  [/diesel/i,                  'Diesel Humbert',          'hard_rock'],
  // Generic TSR non-amp pedal packs (effects only)
  [/candyman|guv.?nor|guvnor|guv(?:'nor)?/i, null, null],
  [/blues\s*driver|blues\s*breaker|bd.?02|bb(?:\s|$)/i, null, null],
  [/jackhammer|jack\s*hammer/i, null, null],
  [/fuzz.?face|fuzzy.?face|fuzzy\s*mooch/i, null, null],
  [/big\s*muff|bmuff/i, null, null],
  [/tube\s*screamer|ts.?808/i, null, null],
  [/rat\s*fuzz|rodent/i, null, null],
  [/eagle\s*claw/i, null, null],
  [/klon|klone/i, null, null],
  [/revv/i, null, null],
  [/sparky/i, null, null],
  [/real\s*tube\s*od|vintage\s*drive|max\s*od|od.?808|amp\s*\w+\s*gain/i, null, null],
  [/drive\s*pedal/i, null, null],
];

function inferAmp(name) {
  for (const [re, amp, style] of AMP_RULES) {
    if (re.test(name)) return {amp, style};
  }
  return {amp: null, style: null};
}

function inferGain(name) {
  const n = name.toLowerCase();
  if (/full\s*beans|full\s*gain|high\s*gain|hgain|hg\d|lead\s*\d|full\s*drive|beans|fb(?:\s|$)|gain\s*\d|scoop|pushed|od\s*\d|od-\d|dist.?\d|crunch|dirty|dimed|grit\s*\d|breakup\s*\d/i.test(n)) return 'high';
  if (/\bclean\b|cln\b|clean\s*\d|bright\s*clean|warm|rhythm|rhy\b|mellow/i.test(n)) return 'low';
  if (/drive|drive\s*\d|od(?:\s|$)|crunch|jumped|grit(?:\s|$)|boost|mid\s*gain|l?\s*gain\s*\d/i.test(n)) return 'mid';
  return 'mid';
}

function inferScores(amp, style, gain, name) {
  // Base scores by style
  const bases = {
    hard_rock: {HB: 88, SC: 62, P90: 76},
    rock:      {HB: 82, SC: 74, P90: 82},
    blues:     {HB: 80, SC: 90, P90: 87},
    clean:     {HB: 65, SC: 93, P90: 85},
    metal:     {HB: 90, SC: 55, P90: 68},
  };
  const s = Object.assign({}, bases[style] || {HB: 78, SC: 78, P90: 78});
  // Adjust by gain
  if (gain === 'high') { s.HB += 4; s.SC -= 6; s.P90 -= 3; }
  if (gain === 'low')  { s.HB -= 4; s.SC += 4; s.P90 += 2; }
  // Cap
  for (const k of ['HB','SC','P90']) s[k] = Math.min(97, Math.max(50, s[k]));
  return s;
}

// ── Collect all preset names ─────────────────────────────────────────────────
const presets = new Map(); // name → {src, amp, style, gain, scores}

// Normalise "TSR - AmpName - Variant" → "TSR AmpName Variant" (pour correspondre aux noms de banks)
function normName(name) {
  return name.trim()
    .replace(/^TSR\s*-\s+/, 'TSR ')   // "TSR - Mars" → "TSR Mars"
    .replace(/\s+-\s+/g, ' ')          // " - " intérieur → " "
    .replace(/\s{2,}/g, ' ')           // doubles espaces
    .trim();
}

function addPreset(name, src) {
  name = normName(name);
  if (!name || presets.has(name)) return;
  const {amp, style} = inferAmp(name);
  if (!amp) return; // skip pure pedal/effect presets without an amp model
  const gain = inferGain(name);
  const scores = inferScores(amp, style, gain, name);
  presets.set(name, {src, amp, gain, style: style || 'rock', scores});
}

// ML presets (already extracted)
if (fs.existsSync(ML_DIR)) {
  fs.readdirSync(ML_DIR).filter(f => f.endsWith('.txp')).forEach(f => {
    addPreset(f.replace(/\.txp$/, ''), 'ML');
  });
}

// TSR presets from zips
const zipFiles = fs.readdirSync(TSR_DIR).filter(f => f.endsWith('.zip'));
for (const z of zipFiles) {
  try {
    const out = execSync(`unzip -l "${path.join(TSR_DIR, z)}"`, {encoding:'utf8', stdio:['pipe','pipe','ignore']});
    const lines = out.split('\n').filter(l => l.includes('.txp') && !l.includes('__MACOSX'));
    for (const l of lines) {
      const m = l.match(/\/([^/]+\.txp)$/);
      if (m) addPreset(m[1].replace(/\.txp$/, ''), 'TSR');
    }
  } catch(e) {}
}

// TSR presets already extracted (Bass Pack 1 etc.)
const extractedDirs = fs.readdirSync(TSR_DIR, {withFileTypes:true})
  .filter(d => d.isDirectory()).map(d => d.name);
for (const dir of extractedDirs) {
  const dirPath = path.join(TSR_DIR, dir);
  try {
    fs.readdirSync(dirPath).filter(f => f.endsWith('.txp')).forEach(f => {
      addPreset(f.replace(/\.txp$/, ''), 'TSR');
    });
  } catch(e) {}
}

// ── Output JS ────────────────────────────────────────────────────────────────
const lines = ['const PRESET_CATALOG_FULL = {'];

// Sort by source then name
const sorted = [...presets.entries()].sort(([a,ai],[b,bi]) => {
  if (ai.src !== bi.src) return ai.src < bi.src ? -1 : 1;
  return a < b ? -1 : 1;
});

let lastSrc = null;
let lastAmp = null;
for (const [name, info] of sorted) {
  if (info.src !== lastSrc) {
    lines.push(`  // ── ${info.src} ──────────────────────────────────────────────────`);
    lastSrc = info.src;
    lastAmp = null;
  }
  if (info.amp !== lastAmp) {
    lines.push(`  // ${info.amp}`);
    lastAmp = info.amp;
  }
  const escaped = name.replace(/"/g, '\\"');
  const sc = info.scores;
  lines.push(`  "${escaped}": {src:"${info.src}",amp:"${info.amp}",gain:"${info.gain}",style:"${info.style}",scores:{HB:${sc.HB},SC:${sc.SC},P90:${sc.P90}}},`);
}

lines.push('};');
lines.push(`// ${presets.size} presets total`);

const output = lines.join('\n');
fs.writeFileSync(path.join(__dirname, 'preset_catalog_full.js'), output, 'utf8');
console.log(`✅ ${presets.size} presets generated → preset_catalog_full.js`);

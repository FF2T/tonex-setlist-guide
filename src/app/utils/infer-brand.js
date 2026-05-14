// src/app/utils/infer-brand.js — Phase 7.29.10.
//
// Devine la marque d'une guitare à partir de son nom complet ou abrégé.
// Cherche d'abord un nom de marque explicite dans la chaîne, puis
// fallback sur une heuristique modèle → marque (Telecaster → Fender,
// Les Paul → Gibson, etc.) pour les cas où l'IA n'a pas mis la marque.

const BRAND_KEYWORDS = [
  'Gibson', 'Fender', 'Epiphone', 'PRS', 'Ibanez', 'ESP', 'Jackson',
  'Schecter', 'Gretsch', 'Squier', 'Yamaha', 'Taylor', 'Martin',
  'Rickenbacker', 'Guild', 'Music Man', 'Reverend', 'G&L', 'Eastman',
  'Charvel', 'Kramer', 'BC Rich', 'Dean', 'Hagstrom', 'Eastwood',
];

const MODEL_TO_BRAND = [
  { brand: 'Fender', patterns: /\b(strat|stratocaster|tele|telecaster|jazzmaster|jaguar|mustang|jazz\s*bass|precision|p[\s-]?bass|j[\s-]?bass|bassman|cyclone|toronado|duo[\s-]?sonic|bronco|musicmaster)\b/i },
  { brand: 'Gibson', patterns: /\b(les\s*paul|lp\b|sg\b|es-?\d{2,3}|flying\s*v|explorer|firebird|thunderbird|hummingbird|j-?45|j-?200|country\s*western|melody\s*maker)\b/i },
  { brand: 'Epiphone', patterns: /\b(casino|sheraton|riviera|wilshire|coronet|dot\b|inspired\s*by)\b/i },
  { brand: 'Yamaha', patterns: /\b(pacifica|revstar)\b/i },
  { brand: 'Gretsch', patterns: /\b(white\s*falcon|duo\s*jet|country\s*gentleman|chet\s*atkins|penguin|6120|nashville|electromatic)\b/i },
  { brand: 'PRS', patterns: /\b(custom\s*2[24]|hollowbody|tremonti|mccarty|silver\s*sky|se\s*standard)\b/i },
  { brand: 'Rickenbacker', patterns: /\b(33[0-9]|360|620|4001|4003)\b/i },
];

function inferBrand(name) {
  if (!name) return 'Mes guitares';
  const n = String(name).toLowerCase();
  for (const b of BRAND_KEYWORDS) {
    if (n.includes(b.toLowerCase())) return b;
  }
  for (const { brand, patterns } of MODEL_TO_BRAND) {
    if (patterns.test(n)) return brand;
  }
  return 'Mes guitares';
}

export { inferBrand, BRAND_KEYWORDS };

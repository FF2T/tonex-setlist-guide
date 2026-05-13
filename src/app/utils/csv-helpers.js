// src/app/utils/csv-helpers.js — Phase 7.18 (découpage main.jsx).
//
// Helpers d'export/import CSV pour les banks ToneX et export JSON de
// l'état complet. Extrait depuis main.jsx (verbatim).

import { CL } from './ui-constants.js';

export function exportJSON(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `backline_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

export function generateCSV(banks, deviceName) {
  const rows = [['Pédale', 'Bank', 'Catégorie', 'Slot', 'Type', 'Preset']];
  Object.entries(banks).sort((a, b) => Number(a[0]) - Number(b[0])).forEach(([k, v]) => {
    ['A', 'B', 'C'].forEach((c) => { rows.push([deviceName, k, v.cat, c, CL[c], v[c] || '']); });
  });
  return rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

export function downloadFile(content, filename, type = 'text/csv;charset=utf-8;') {
  try {
    const bom = type.includes('csv') ? '﻿' : '';
    const blob = new Blob([bom + content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  } catch (e) { console.error(e); }
}

export function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;
  const sep = lines[0].includes(';') ? ';' : ',';
  const parseLine = (line) => {
    const res = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (ch === sep && !inQ) { res.push(cur.trim()); cur = ''; } else cur += ch;
    }
    res.push(cur.trim()); return res;
  };
  const header = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/["""]/g, '').trim());
  const iDevice = header.findIndex((h) => h.includes('pédale') || h.includes('pedale'));
  const iBank = header.findIndex((h) => h === 'bank' || h.includes('bank'));
  const iCat = header.findIndex((h) => h.includes('catég') || h.includes('categ') || h.includes('cat'));
  const iSlot = header.findIndex((h) => h === 'slot');
  const iPreset = header.findIndex((h) => h === 'preset');
  const iA = header.findIndex((h) => h.startsWith('preset a'));
  const iB = header.findIndex((h) => h.startsWith('preset b'));
  const iC = header.findIndex((h) => h.startsWith('preset c'));
  const isWide = iA >= 0 && iB >= 0 && iC >= 0;
  if (iBank === -1) return null;
  if (!isWide && (iSlot === -1 || iPreset === -1)) return null;
  const ann = {}, plug = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]); if (cols.length < 2) continue;
    const bank = parseInt(cols[iBank]); if (isNaN(bank)) continue;
    const cat = iCat >= 0 ? cols[iCat] || '' : '';
    const device = (iDevice >= 0 ? cols[iDevice] || '' : '').toLowerCase();
    const target = device.includes('plug') ? plug : ann;
    if (isWide) {
      const pA = iA >= 0 ? cols[iA] || '' : '', pB = iB >= 0 ? cols[iB] || '' : '', pC = iC >= 0 ? cols[iC] || '' : '';
      if (!target[bank]) target[bank] = { cat, A: '', B: '', C: '' };
      if (cat) target[bank].cat = cat; if (pA) target[bank].A = pA; if (pB) target[bank].B = pB; if (pC) target[bank].C = pC;
    } else {
      const slot = (cols[iSlot] || '').toUpperCase(), preset = cols[iPreset] || '';
      if (!['A', 'B', 'C'].includes(slot)) continue;
      if (!target[bank]) target[bank] = { cat, A: '', B: '', C: '' };
      if (cat && !target[bank].cat) target[bank].cat = cat;
      target[bank][slot] = preset;
    }
  }
  return { ann, plug };
}

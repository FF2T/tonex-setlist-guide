// src/app/screens/SetlistPdfExport.js — Phase 5 (Item K).
// Génération d'un PDF feuille A4 par morceau d'une setlist.
//
// Mise en page (chaque page) :
//   Header : titre du morceau (24pt) + artiste sous-ligne.
//   Métadonnées : BPM · key · année · album.
//   Référence (SONG_HISTORY) : guitariste · guitare · ampli · effets.
//   Guitare reco : nom + score (%).
//   Patches par device activé (1 ligne par device) :
//     - ToneX (Pedal/Anniversary/Plug) : nom du preset + Bank N+slot.
//     - TMP : nom du patch + chaîne compacte (Plexi · Greenback · +Drive…).
//   Notes éventuelles (1-2 lignes).
//
// Style sobre N&B : titres bold, séparateurs filets gris, pas de
// couleur (imprimable). Marges 18mm.
//
// Test surface : la fonction est isolée et testable. Les rendus PDF
// fins (positions exactes des chaînes) ne sont pas testés ; on
// vérifie juste qu'aucune erreur n'est levée et que les méthodes
// jsPDF clés sont appelées.

import { jsPDF } from 'jspdf';
import { getLocale } from '../../i18n/index.js';
import { getLocalizedText } from '../utils/ai-helpers.js';
import { getSongInfo, SONG_HISTORY } from '../../core/songs.js';
import { getEnabledDevices } from '../../devices/registry.js';
import { recommendTMPPatch } from '../../devices/tonemaster-pro/scoring.js';
import { TMP_FACTORY_PATCHES } from '../../devices/tonemaster-pro/catalog.js';

// Marges et tailles en millimètres.
const MARGIN_X = 18;
const MARGIN_TOP = 22;
const PAGE_W = 210;

// Cherche un preset par nom dans une structure { [bankN]: { A,B,C } }.
function findPresetLocation(name, banks) {
  if (!name || !banks) return null;
  for (const [k, bank] of Object.entries(banks)) {
    for (const slot of ['A', 'B', 'C']) {
      if (bank[slot] === name) return { bank: Number(k), slot };
    }
  }
  return null;
}

// Génère un résumé compact d'un patch TMP (réimplémenté ici plutôt
// qu'importé depuis RecommendBlock.jsx pour ne pas tirer un module
// React dans le code PDF).
function summarizeTMPChain(patch) {
  if (!patch) return '';
  const parts = [];
  if (patch.amp?.model) parts.push(patch.amp.model.split(/\s+/).pop());
  if (patch.cab?.model) {
    // Ex. "4x12 British Plexi Greenback" → "Greenback" (le speaker
    // est le keyword distinctif pour un guitariste).
    const tokens = patch.cab.model.split(/\s+/);
    parts.push(tokens[tokens.length - 1] || patch.cab.model);
  }
  if (patch.drive?.enabled) parts.push('+Drive');
  if (patch.delay?.enabled) parts.push('+Delay');
  if (patch.reverb?.enabled) parts.push('+Reverb');
  return parts.join(' · ');
}

// Trim un texte pour qu'il ne dépasse pas la largeur dispo (approx).
function truncate(s, max) {
  if (!s) return '';
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

// Une page PDF par morceau. Retourne le doc enrichi.
function renderSongPage(doc, song, ctx) {
  const { profile, banksAnn, banksPlug } = ctx;
  const info = getSongInfo(song);
  const hist = SONG_HISTORY[song.id] || null;
  const enabledDevices = getEnabledDevices(profile);

  let y = MARGIN_TOP;

  // Title — 24pt.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text(truncate(song.title || '—', 40), MARGIN_X, y);
  y += 9;

  // Artist — 14pt.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.text(truncate(song.artist || '', 60), MARGIN_X, y);
  y += 8;

  // BPM/key/year/album — 11pt grey.
  const meta = [
    info.bpm ? `${info.bpm} BPM` : null,
    info.key ? info.key : null,
    info.year ? String(info.year) : null,
    info.album ? truncate(info.album, 35) : null,
  ].filter(Boolean).join(' · ');
  if (meta) {
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(meta, MARGIN_X, y);
    doc.setTextColor(0);
    y += 8;
  }

  // Séparateur.
  doc.setDrawColor(180);
  doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
  y += 6;

  // Référence (SONG_HISTORY).
  if (hist) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Référence originale', MARGIN_X, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(truncate(hist.guitarist || '', 50), MARGIN_X, y);
    y += 5;
    if (hist.guitar) { doc.text('Guitare : ' + truncate(hist.guitar, 60), MARGIN_X, y); y += 5; }
    if (hist.amp) { doc.text('Ampli : ' + truncate(hist.amp, 60), MARGIN_X, y); y += 5; }
    const fx = getLocalizedText(hist.effects, getLocale());
    if (fx && !/^aucun effet$|^no effect$|^ningún efecto$/i.test(fx.split(' —')[0].trim())) {
      doc.text('Effets : ' + truncate(fx, 60), MARGIN_X, y); y += 5;
    }
    y += 4;
    doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
    y += 6;
  }

  // Guitare reco depuis aiCache.
  const aiC = song.aiCache?.result;
  if (aiC?.ideal_guitar) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Guitare recommandée', MARGIN_X, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const gScore = aiC.cot_step2_guitars?.[0]?.score;
    doc.text(
      truncate(aiC.ideal_guitar, 50) + (gScore ? `  (${gScore}%)` : ''),
      MARGIN_X, y,
    );
    y += 7;
  }

  // Patches par device activé.
  if (enabledDevices.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Patches recommandés', MARGIN_X, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    for (const d of enabledDevices) {
      if (typeof d.LiveBlock === 'function' && d.id !== 'tonemaster-pro') {
        // Device ToneX (Pedal/Anniversary/Plug) : preset reco depuis aiCache.
        const presetData = aiC?.[d.presetResultKey];
        const presetName = presetData?.label;
        if (presetName) {
          const banks = d.bankStorageKey === 'banksAnn' ? banksAnn : banksPlug;
          const loc = findPresetLocation(presetName, banks);
          const locStr = loc ? `Bank ${loc.bank}${loc.slot}` : 'non installé';
          doc.text(
            `${d.label}  ·  ${truncate(presetName, 45)}  (${locStr})`,
            MARGIN_X, y,
          );
          y += 5;
        }
      } else if (d.id === 'tonemaster-pro') {
        // TMP : recommandation via scoring.
        const recs = recommendTMPPatch(TMP_FACTORY_PATCHES, song, null, profile);
        const top = recs && recs[0];
        if (top) {
          const chain = summarizeTMPChain(top.patch);
          doc.text(
            `${d.label}  ·  ${truncate(top.patch.name, 30)}  (${truncate(chain, 50)})`,
            MARGIN_X, y,
          );
          y += 5;
        }
      }
    }
    y += 2;
  }

  // Notes du morceau (si description seed).
  const descLocalized = getLocalizedText(info.desc, getLocale());
  if (descLocalized) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(80);
    const lines = doc.splitTextToSize(descLocalized, PAGE_W - 2 * MARGIN_X);
    doc.text(lines.slice(0, 4), MARGIN_X, y);
    doc.setTextColor(0);
  }

  return doc;
}

// API publique : génère un PDF Blob téléchargeable depuis une setlist.
//
// Param :
//   setlist : { name, songIds[] }
//   songs   : tableau de morceaux (déjà résolus depuis songIds, dans l'ordre)
//   ctx     : { profile, banksAnn, banksPlug }
//
// Retourne le doc jsPDF (caller appelle .save() ou .output()).
function exportSetlistPdf(setlist, songs, ctx) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const list = Array.isArray(songs) ? songs.filter(Boolean) : [];

  if (list.length === 0) {
    // Page d'erreur minimaliste.
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(setlist?.name || 'Setlist vide', MARGIN_X, MARGIN_TOP);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text('Aucun morceau dans la setlist.', MARGIN_X, MARGIN_TOP + 12);
    return doc;
  }

  // Page de garde.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text(setlist?.name || 'Setlist', MARGIN_X, MARGIN_TOP);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(
    `${list.length} morceau${list.length > 1 ? 'x' : ''}  ·  généré ${new Date().toLocaleDateString('fr-FR')}`,
    MARGIN_X, MARGIN_TOP + 10,
  );
  doc.setTextColor(0);

  // Sommaire (max 30 morceaux pour ne pas déborder).
  let y = MARGIN_TOP + 22;
  doc.setFontSize(11);
  list.slice(0, 30).forEach((s, i) => {
    doc.text(
      `${i + 1}. ${truncate((s.title || '—') + '  —  ' + (s.artist || ''), 65)}`,
      MARGIN_X + 4, y,
    );
    y += 6;
    if (y > 270) return;
  });

  // Une page par morceau.
  list.forEach((song) => {
    doc.addPage();
    try {
      renderSongPage(doc, song, ctx);
    } catch (e) {
      // Defensive : si un morceau rend mal (ex. SONG_HISTORY corrupt),
      // on log et on continue plutôt que de bloquer tout l'export.
      // eslint-disable-next-line no-console
      console.warn('PDF render fail for', song?.id, e);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(song?.title || '(morceau)', MARGIN_X, MARGIN_TOP);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.text('(rendu PDF échoué pour ce morceau)', MARGIN_X, MARGIN_TOP + 10);
    }
  });

  return doc;
}

export {
  exportSetlistPdf,
  // exposés pour test :
  findPresetLocation,
  summarizeTMPChain,
  truncate,
};

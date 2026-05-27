// src/app/components/NavIcon.jsx — Phase 1, étape 5.
// Icônes SVG utilisées dans la barre de nav (mobile + desktop) +
// icônes de section / bouton flat outline (vague 1 retrait emojis 2026-05-27).
// Style cohérent : outline, stroke currentColor, strokeWidth 1.8, viewBox 24×24.
//
// ⚠️ RÈGLE PROJET — PAS D'EMOJIS DANS L'UI.
// Tout nouveau besoin d'icône passe par ce fichier (étendre avec un
// nouvel `if(id==="monid")`). Voir section "Iconographie" de CLAUDE.md
// pour le contexte, le tableau des icônes disponibles, et les exceptions
// tolérées (prompts IA, docs markdown, données seed historiques).

import React from 'react';

function NavIcon({id,size}){
  var s=size||20;var st={width:s,height:s,fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round",strokeLinejoin:"round"};
  if(id==="list") return <svg style={st} viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
  if(id==="setlists") return <svg style={st} viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>;
  if(id==="explore") return <svg style={st} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
  if(id==="jam") return <svg style={st} viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 8l-4 4-4-4"/><path d="M8 16l4-4 4 4"/></svg>;
  if(id==="optimizer") return <svg style={st} viewBox="0 0 24 24"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>;
  // Vague 1 — retrait emojis. Engrenage admin.
  if(id==="admin") return <svg style={st} viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
  // Micro live (mode scène).
  if(id==="live") return <svg style={st} viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
  // Cible (recommandations IA).
  if(id==="target") return <svg style={st} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
  // Guitare flat simplifiée (mon setup).
  if(id==="guitar") return <svg style={st} viewBox="0 0 24 24"><path d="M19 2l3 3-4 1-1 4-3 3-6 6a3 3 0 1 1-4-4l6-6 3-3 4-1 1-3z"/><circle cx="9" cy="15" r="1.5"/></svg>;
  // Sliders / EQ (réglages effets / paramétrage).
  if(id==="sliders") return <svg style={st} viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="14" cy="6" r="2" fill="currentColor"/><circle cx="9" cy="12" r="2" fill="currentColor"/><circle cx="16" cy="18" r="2" fill="currentColor"/></svg>;
  // Basse (corps allongé + tête 4 chevilles stylisée).
  if(id==="bass") return <svg style={st} viewBox="0 0 24 24"><path d="M20 2l2 2-3 1-1 4-4 3-7 7a3 3 0 1 1-4-4l7-7 4-3 1-4 3-1-2-2"/><circle cx="9" cy="15" r="1.5"/></svg>;
  // Info (i dans cercle).
  if(id==="info") return <svg style={st} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="11"/><circle cx="12" cy="8" r="1" fill="currentColor"/></svg>;
  return null;
}

export default NavIcon;

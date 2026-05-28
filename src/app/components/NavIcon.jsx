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
  // Vague 2 retrait emojis (tabs MonProfil + Admin + Mes appareils).
  // User (personne unique — Mon compte).
  if(id==="user") return <svg style={st} viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
  // Users (plusieurs personnes — Profils admin).
  if(id==="users") return <svg style={st} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
  // Eye (vue Tous presets users admin).
  if(id==="eye") return <svg style={st} viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
  // Globe (ToneNET).
  if(id==="globe") return <svg style={st} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
  // Wrench (Maintenance).
  if(id==="wrench") return <svg style={st} viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>;
  // Key (Clé API).
  if(id==="key") return <svg style={st} viewBox="0 0 24 24"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>;
  // Lock (Mot de passe).
  if(id==="lock") return <svg style={st} viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
  // Device (smartphone — Mes appareils).
  if(id==="device") return <svg style={st} viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>;
  // Package (Mes sources / Mes presets custom).
  if(id==="package") return <svg style={st} viewBox="0 0 24 24"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
  // Pen / edit (boutons rename/édition).
  if(id==="pen") return <svg style={st} viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>;
  // Trash (boutons suppression).
  if(id==="trash") return <svg style={st} viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>;
  // Broom / clear (vider une setlist).
  if(id==="broom") return <svg style={st} viewBox="0 0 24 24"><path d="M19.36 2.72l1.42 1.42-5.72 5.71"/><path d="M14.85 8.66l-3.18 3.19a2 2 0 0 0-.58 1.41V18l-3 3 5.5-5.5 5-5"/><line x1="11" y1="13" x2="15" y2="9"/></svg>;
  // Doc / PDF (export setlist).
  if(id==="doc") return <svg style={st} viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
  // Amp / combo (devices ToneX : Pédale / Anniversary / Plug).
  // Cabinet rectangulaire + grille HP (gros cercle) + petits réglages.
  if(id==="amp") return <svg style={st} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="13" r="4"/><circle cx="18" cy="8" r="0.8" fill="currentColor"/><circle cx="18" cy="13" r="0.8" fill="currentColor"/></svg>;
  return null;
}

export default NavIcon;

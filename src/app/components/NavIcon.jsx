// src/app/components/NavIcon.jsx — Phase 1, étape 5.
// Icônes SVG utilisées dans la barre de nav (mobile + desktop).
// Extrait verbatim.

import React from 'react';

function NavIcon({id,size}){
  var s=size||20;var st={width:s,height:s,fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round",strokeLinejoin:"round"};
  if(id==="list") return <svg style={st} viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
  if(id==="setlists") return <svg style={st} viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>;
  if(id==="explore") return <svg style={st} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
  if(id==="jam") return <svg style={st} viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 8l-4 4-4-4"/><path d="M8 16l4-4 4 4"/></svg>;
  if(id==="optimizer") return <svg style={st} viewBox="0 0 24 24"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>;
  return null;
}

export default NavIcon;

// src/app/components/Row.jsx — Phase 1, étape 5.
// Layout helper : icône + contenu en flex-row. Extrait verbatim.

import React from 'react';

function Row({icon,children}) {
  return <div style={{display:"flex",gap:10,alignItems:"flex-start"}}><span style={{fontSize:14,flexShrink:0,width:22,marginTop:1}}>{icon}</span><div style={{flex:1}}>{children}</div></div>;
}

export default Row;

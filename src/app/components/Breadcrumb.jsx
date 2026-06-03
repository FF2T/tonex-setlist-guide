// src/app/components/Breadcrumb.jsx — Phase 1, étape 5.
// Fil d'Ariane : crumbs = [{label, screen}, ..., {label}]. Le dernier
// est l'écran courant (non cliquable). Extrait verbatim.

import React from 'react';

function Breadcrumb({crumbs,onNavigate}){
  // v9.7.31 — Cowork audit P1 : lien crumb 47×16px sur iPad, chevron 10px.
  // Padding 10×8 + minHeight 44 sur le bouton crumb (Apple HIG tactile).
  // Chevron bumpé à 14px pour cohérence et meilleure lisibilité.
  return(
    <nav className="breadcrumb-nav" style={{display:"flex",alignItems:"center",gap:0,marginBottom:16,flexWrap:"wrap",fontSize:13}}>
      {crumbs.map((c,i)=>{
        const isLast=i===crumbs.length-1;
        return <React.Fragment key={i}>
          {i>0&&<span style={{color:"var(--text-tertiary)",margin:"0 4px",fontSize:14}}>›</span>}
          {isLast
            ?<span style={{color:"var(--text-sec)",fontWeight:700,padding:"10px 4px"}}>{c.label}</span>
            :<button onClick={()=>onNavigate(c.screen)} style={{background:"none",border:"none",color:"var(--accent)",cursor:"pointer",fontWeight:600,padding:"10px 8px",fontSize:13,textDecoration:"none",minHeight:44,minWidth:44,display:"inline-flex",alignItems:"center"}}>{c.label}</button>
          }
        </React.Fragment>;
      })}
    </nav>
  );
}

export default Breadcrumb;

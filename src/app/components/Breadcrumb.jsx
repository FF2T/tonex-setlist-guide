// src/app/components/Breadcrumb.jsx — Phase 1, étape 5.
// Fil d'Ariane : crumbs = [{label, screen}, ..., {label}]. Le dernier
// est l'écran courant (non cliquable). Extrait verbatim.

import React from 'react';

function Breadcrumb({crumbs,onNavigate}){
  return(
    <nav className="breadcrumb-nav" style={{display:"flex",alignItems:"center",gap:0,marginBottom:16,flexWrap:"wrap",fontSize:13}}>
      {crumbs.map((c,i)=>{
        const isLast=i===crumbs.length-1;
        return <React.Fragment key={i}>
          {i>0&&<span style={{color:"var(--text-tertiary)",margin:"0 6px",fontSize:10}}>›</span>}
          {isLast
            ?<span style={{color:"var(--text-sec)",fontWeight:700}}>{c.label}</span>
            :<button onClick={()=>onNavigate(c.screen)} style={{background:"none",border:"none",color:"var(--accent)",cursor:"pointer",fontWeight:600,padding:0,fontSize:13,textDecoration:"none"}}>{c.label}</button>
          }
        </React.Fragment>;
      })}
    </nav>
  );
}

export default Breadcrumb;

// src/app/screens/ProfileTab.jsx — Phase 7.19 (découpage main.jsx).
//
// Onglet "🎸 Mes guitares" (section="guitars") et "📦 Mes sources"
// (section="sources") dans MonProfilScreen. Gère :
// - check/uncheck des guitares standard du catalogue
// - édition (name/short/type) des guitares standard via editedGuitars
// - ajout/édition/suppression des guitares custom
// - toggle des sources de presets (verrouillé si matériel cohérent)
//
// La section "devices" de l'ancien ProfileTab a été déplacée vers
// MesAppareilsTab Phase 2.
//
// Phase 7.28 — `createProfile` dead code supprimé (création gérée par
// ProfilesAdmin). ADMIN_PIN local n'a plus de raison d'exister.

import React, { useState } from 'react';
import { GUITARS, GUITAR_BRANDS } from '../../core/guitars.js';
import { SOURCE_LABELS, SOURCE_DESCRIPTIONS, SOURCE_INFO } from '../../core/sources.js';
import GuitarSearchAdd from '../components/GuitarSearchAdd.jsx';
import { resizeImageToDataUrl } from '../utils/image-resize.js';
import defaultGuitarSvg from '../../assets/default.svg';

function ProfileTab({ profile, profiles, onProfiles, activeProfileId, inp, section, aiKeys, customGuitars, onCustomGuitars }) {
  const isAdmin = profile?.isAdmin === true;
  const [editName, setEditName] = useState(profile.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingGuitarId, setEditingGuitarId] = useState(null);
  const [editGName, setEditGName] = useState('');
  const [editGShort, setEditGShort] = useState('');
  const [editGType, setEditGType] = useState('HB');
  const [editGImage, setEditGImage] = useState(null);
  const [imgErr, setImgErr] = useState(null);

  const updateProfile = (field, value) => onProfiles((p) => ({ ...p, [activeProfileId]: { ...p[activeProfileId], [field]: typeof value === 'function' ? value(p[activeProfileId][field]) : value, lastModified: Date.now() } }));

  const toggleGuitar = (id) => {
    updateProfile('myGuitars', (prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };
  const toggleSource = (key) => {
    updateProfile('availableSources', (prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const addCustomGuitar = (cg) => {
    onCustomGuitars((prev) => [...(prev || []), cg]);
    updateProfile('myGuitars', (prev) => [...prev, cg.id]);
  };
  const removeCustomGuitar = (id) => {
    onCustomGuitars((prev) => (prev || []).filter((g) => g.id !== id));
    onProfiles((p) => { const n = { ...p }; for (const pid in n) { n[pid] = { ...n[pid], myGuitars: (n[pid].myGuitars || []).filter((x) => x !== id) }; } return n; });
  };
  const startEditGuitar = (g, isCustom) => {
    const edits = profile.editedGuitars || {};
    const orig = isCustom ? g : ({ ...GUITARS.find((x) => x.id === g.id), ...(edits[g.id] || {}) });
    setEditingGuitarId(g.id); setEditGName(orig.name); setEditGShort(orig.short); setEditGType(orig.type);
    setEditGImage(isCustom ? (orig.image || null) : null);
    setImgErr(null);
  };
  const onImageUpload = async (file) => {
    setImgErr(null);
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file, 240, 0.85);
      setEditGImage(dataUrl);
    } catch (e) {
      setImgErr(e.message || 'Erreur lors du chargement');
    }
  };
  const saveEditGuitar = () => {
    if (!editGName.trim() || !editGShort.trim()) { setEditingGuitarId(null); return; }
    const isCustom = editingGuitarId?.startsWith('cg_');
    if (isCustom) {
      onCustomGuitars((prev) => (prev || []).map((g) => g.id === editingGuitarId ? { ...g, name: editGName.trim(), short: editGShort.trim(), type: editGType, image: editGImage || null } : g));
    } else {
      updateProfile('editedGuitars', (prev) => ({ ...(prev || {}), [editingGuitarId]: { name: editGName.trim(), short: editGShort.trim(), type: editGType } }));
    }
    setEditingGuitarId(null);
  };
  const resetGuitar = (id) => {
    updateProfile('editedGuitars', (prev) => { const n = { ...(prev || {}) }; delete n[id]; return n; });
    setEditingGuitarId(null);
  };
  const deleteProfile = () => {
    if (Object.keys(profiles).length <= 1) return;
    const remaining = { ...profiles }; delete remaining[activeProfileId];
    onProfiles(remaining);
    setConfirmDelete(false);
  };
  const saveName = () => {
    if (!editName.trim()) return;
    updateProfile('name', editName.trim());
  };

  const s = section || 'guitars';
  return (
    <div>
      {s === 'guitars' && <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Mes guitares</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>Coche les guitares que tu possèdes.</div>
        {(() => {
          const customs = customGuitars || [];
          const allBrands = [...GUITAR_BRANDS];
          const customByBrand = {};
          customs.forEach((g) => {
            const brand = g.brand || 'Mes guitares';
            if (!customByBrand[brand]) customByBrand[brand] = [];
            customByBrand[brand].push(g);
            if (!allBrands.includes(brand)) allBrands.push(brand);
          });
          return <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
            {allBrands.map((brand) => {
              const standardGuitars = GUITARS.filter((g) => g.brand === brand);
              const customBrandGuitars = customByBrand[brand] || [];
              if (!standardGuitars.length && !customBrandGuitars.length) return null;
              return <div key={brand}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-sec)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', marginBottom: 6, paddingLeft: 2 }}>{brand}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {standardGuitars.map((g) => {
                    const sel = profile.myGuitars.includes(g.id);
                    const edits = profile.editedGuitars || {};
                    const display = { ...g, ...(edits[g.id] || {}) };
                    const isEdited = !!edits[g.id];
                    const isEditing = editingGuitarId === g.id;
                    return <div key={g.id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: sel ? 'var(--accent-soft)' : 'var(--a3)', border: sel ? '1px solid var(--accent-border)' : '1px solid var(--a6)', borderRadius: 'var(--r-md)', padding: '8px 12px', cursor: 'pointer' }} onClick={() => toggleGuitar(g.id)}>
                        <div style={{ width: 18, height: 18, borderRadius: 'var(--r-sm)', border: sel ? '2px solid var(--accent)' : '2px solid var(--text-muted)', background: sel ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{sel && <span style={{ color: 'var(--text-inverse)', fontSize: 10, fontWeight: 900 }}>✓</span>}</div>
                        <div style={{ flex: 1 }}><span style={{ fontSize: 12, fontWeight: 600, color: sel ? 'var(--text)' : 'var(--text-muted)' }}>{display.short}</span><span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 6 }}>{display.name}</span>{isEdited && <span style={{ fontSize: 9, color: 'var(--copper-400)', marginLeft: 4 }}>modifié</span>}</div>
                        <span style={{ fontSize: 10, color: 'var(--text-dim)', marginRight: 4 }}>{display.type}</span>
                        {sel && <button onClick={(e) => { e.stopPropagation(); startEditGuitar(display, false); }} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)', padding: '3px 7px', fontSize: 10, cursor: 'pointer' }}>✏️</button>}
                      </div>
                      {isEditing && <div style={{ background: 'var(--a5)', borderRadius: '0 0 8px 8px', padding: '10px 12px', marginTop: -1, border: '1px solid var(--a8)', borderTop: 'none' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                          <input placeholder="Nom" value={editGName} onChange={(e) => setEditGName(e.target.value)} style={{ ...inp, flex: '1 1 140px', fontSize: 11, padding: '5px 8px' }}/>
                          <input placeholder="Abrégé" value={editGShort} onChange={(e) => setEditGShort(e.target.value)} style={{ ...inp, flex: '0 1 80px', fontSize: 11, padding: '5px 8px' }}/>
                          <select value={editGType} onChange={(e) => setEditGType(e.target.value)} style={{ ...inp, flex: '0 0 55px', fontSize: 11, padding: '5px 4px' }}><option value="HB">HB</option><option value="SC">SC</option><option value="P90">P90</option></select>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={saveEditGuitar} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Sauver</button>
                          {isEdited && <button onClick={() => resetGuitar(g.id)} style={{ background: 'var(--yellow-bg)', border: '1px solid var(--yellow-border)', color: 'var(--yellow)', borderRadius: 'var(--r-md)', padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>Réinitialiser</button>}
                          <button onClick={() => setEditingGuitarId(null)} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>Annuler</button>
                        </div>
                      </div>}
                    </div>;
                  })}
                  {customBrandGuitars.map((g) => {
                    const isEditing = editingGuitarId === g.id;
                    const sel = profile.myGuitars.includes(g.id);
                    return <div key={g.id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: sel ? 'var(--accent-soft)' : 'var(--a3)', border: sel ? '1px solid var(--accent-border)' : '1px solid var(--a6)', borderRadius: 'var(--r-md)', padding: '8px 12px', cursor: 'pointer' }} onClick={() => toggleGuitar(g.id)}>
                        <div style={{ width: 18, height: 18, borderRadius: 'var(--r-sm)', border: sel ? '2px solid var(--accent)' : '2px solid var(--text-muted)', background: sel ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{sel && <span style={{ color: 'var(--text-inverse)', fontSize: 10, fontWeight: 900 }}>✓</span>}</div>
                        <img src={g.image || defaultGuitarSvg} alt="" style={{ width: 36, height: 28, objectFit: 'contain', flexShrink: 0, opacity: g.image ? 1 : 0.5, color: 'var(--text-muted)' }}/>
                        <div style={{ flex: 1 }}><span style={{ fontSize: 12, fontWeight: 600, color: sel ? 'var(--text)' : 'var(--text-muted)' }}>{g.short}</span><span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 6 }}>{g.name}</span></div>
                        <span style={{ fontSize: 10, color: 'var(--text-dim)', marginRight: 4 }}>{g.type}</span>
                        {isAdmin && sel && <button onClick={(e) => { e.stopPropagation(); startEditGuitar(g, true); }} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)', padding: '3px 7px', fontSize: 10, cursor: 'pointer' }}>✏️</button>}
                        {isAdmin && <button onClick={(e) => { e.stopPropagation(); removeCustomGuitar(g.id); }} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 11, padding: '2px 4px' }}>✕</button>}
                      </div>
                      {isEditing && <div style={{ background: 'var(--a5)', borderRadius: '0 0 8px 8px', padding: '10px 12px', marginTop: -1, border: '1px solid var(--a8)', borderTop: 'none' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                          <input placeholder="Nom" value={editGName} onChange={(e) => setEditGName(e.target.value)} style={{ ...inp, flex: '1 1 140px', fontSize: 11, padding: '5px 8px' }}/>
                          <input placeholder="Abrégé" value={editGShort} onChange={(e) => setEditGShort(e.target.value)} style={{ ...inp, flex: '0 1 80px', fontSize: 11, padding: '5px 8px' }}/>
                          <select value={editGType} onChange={(e) => setEditGType(e.target.value)} style={{ ...inp, flex: '0 0 55px', fontSize: 11, padding: '5px 4px' }}><option value="HB">HB</option><option value="SC">SC</option><option value="P90">P90</option></select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <img src={editGImage || defaultGuitarSvg} alt="" style={{ width: 48, height: 36, objectFit: 'contain', border: '1px solid var(--a8)', borderRadius: 'var(--r-sm)', background: 'var(--a3)', padding: 2, opacity: editGImage ? 1 : 0.5, color: 'var(--text-muted)' }}/>
                          <label style={{ background: 'var(--a7)', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)', padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>
                            📷 {editGImage ? "Changer l'image" : 'Ajouter une image'}
                            <input type="file" accept="image/*" onChange={(e) => onImageUpload(e.target.files?.[0])} style={{ display: 'none' }}/>
                          </label>
                          {editGImage && <button onClick={() => setEditGImage(null)} style={{ background: 'var(--a5)', border: 'none', color: 'var(--text-muted)', borderRadius: 'var(--r-sm)', padding: '5px 8px', fontSize: 10, cursor: 'pointer' }}>Retirer</button>}
                        </div>
                        {imgErr && <div style={{ fontSize: 10, color: 'var(--red)', marginBottom: 6 }}>{imgErr}</div>}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={saveEditGuitar} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Sauver</button>
                          <button onClick={() => setEditingGuitarId(null)} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>Annuler</button>
                        </div>
                      </div>}
                    </div>;
                  })}
                </div>
              </div>;
            })}
          </div>;
        })()}
        {isAdmin && <GuitarSearchAdd inp={inp} aiKeys={aiKeys} onAdd={(name, short, type) => {
          const knownBrands = ['Gibson', 'Fender', 'Epiphone', 'PRS', 'Ibanez', 'ESP', 'Jackson', 'Schecter', 'Gretsch', 'Squier', 'Yamaha', 'Taylor', 'Martin'];
          const firstWord = name.split(' ')[0];
          const brand = knownBrands.find((b) => b.toLowerCase() === firstWord.toLowerCase()) || 'Mes guitares';
          addCustomGuitar({ id: `cg_${Date.now()}`, name, short, type, brand });
        }}/>}
      </div>}

      {s === 'sources' && <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Mes sources de presets</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>Coche uniquement les packs et matériels ToneX que tu possèdes réellement. Les recommandations seront filtrées en conséquence.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Object.entries(SOURCE_LABELS).map(([key, label]) => {
            const enabled = new Set(profile.enabledDevices || []);
            const locked = (key === 'Anniversary' && enabled.has('tonex-anniversary'))
              || (key === 'Factory' && enabled.has('tonex-pedal'))
              || (key === 'PlugFactory' && enabled.has('tonex-plug'));
            const on = locked || profile.availableSources?.[key] !== false;
            const desc = SOURCE_DESCRIPTIONS[key] || '';
            const icon = SOURCE_INFO[key]?.icon || '📁';
            return <button key={key} onClick={() => { if (!locked) toggleSource(key); }} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: on ? 'var(--green-bg)' : 'var(--a3)', border: on ? '1px solid var(--green-border)' : '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '10px 14px', cursor: locked ? 'default' : 'pointer', textAlign: 'left', opacity: locked ? 0.85 : 1 }}>
              <div style={{ width: 18, height: 18, borderRadius: 'var(--r-sm)', border: on ? '2px solid var(--green)' : '2px solid var(--text-muted)', background: on ? 'var(--green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>{on && <span style={{ color: 'var(--bg)', fontSize: 10, fontWeight: 900 }}>✓</span>}</div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ fontSize: 12, color: on ? 'var(--text)' : 'var(--text-muted)', fontWeight: on ? 700 : 500, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span>{icon}</span>
                  <span>{label}</span>
                  {locked && <span style={{ fontSize: 9, color: 'var(--text-dim)', background: 'var(--a6)', borderRadius: 'var(--r-sm)', padding: '1px 6px', fontWeight: 600 }}>verrouillé (matériel coché)</span>}
                </div>
                {desc && <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.4 }}>{desc}</div>}
              </div>
            </button>;
          })}
        </div>
      </div>}
    </div>
  );
}

export default ProfileTab;
export { ProfileTab };

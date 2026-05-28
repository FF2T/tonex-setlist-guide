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
import { t } from '../../i18n/index.js';
import NavIcon from '../components/NavIcon.jsx';
import Button from '../components/Button.jsx';
import { GUITARS, GUITAR_BRANDS } from '../../core/guitars.js';
import { BASSES, BASS_BRANDS } from '../../core/basses.js';
import { BASS_AMPS, BASS_AMP_BRANDS } from '../../core/bass-amps.js';
import { GUITAR_AMPS, GUITAR_AMP_BRANDS } from '../../core/guitar-amps.js';
import { SOURCE_LABELS, SOURCE_DESCRIPTIONS, SOURCE_INFO, SOURCE_REQUIRES_DEVICE } from '../../core/sources.js';
import { FACTORY_BANKS_PEDALE_V1 } from '../../devices/tonex-pedal/index.js';
import GuitarSearchAdd from '../components/GuitarSearchAdd.jsx';
import { resizeImageToDataUrl } from '../utils/image-resize.js';
import { inferBrand, BRAND_KEYWORDS } from '../utils/infer-brand.js';
import defaultGuitarSvg from '../../assets/default.svg';

function ProfileTab({ profile, profiles, onProfiles, activeProfileId, inp, section, aiKeys, customGuitars, onCustomGuitars }) {
  const isAdmin = profile?.isAdmin === true;
  const isDemo = profile?.isDemo === true;
  const demoTitle = isDemo ? t('demo.blocked', 'Action désactivée en mode démo') : undefined;
  const [editName, setEditName] = useState(profile.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingGuitarId, setEditingGuitarId] = useState(null);
  const [editGName, setEditGName] = useState('');
  const [editGShort, setEditGShort] = useState('');
  const [editGType, setEditGType] = useState('HB');
  const [editGImage, setEditGImage] = useState(null);
  const [editGBrand, setEditGBrand] = useState('');
  const [imgErr, setImgErr] = useState(null);
  // Phase 8.7 — state forms ajout custom basses + amplis basse
  const [newBassName, setNewBassName] = useState('');
  const [newBassBrand, setNewBassBrand] = useState('');
  const [newBassType, setNewBassType] = useState('PJ');
  const [newAmpName, setNewAmpName] = useState('');
  const [newAmpBrand, setNewAmpBrand] = useState('');
  const [newAmpWattage, setNewAmpWattage] = useState('');
  // Phase A — state form ajout custom ampli guitare
  const [newGAmpName, setNewGAmpName] = useState('');
  const [newGAmpBrand, setNewGAmpBrand] = useState('');
  const [newGAmpWattage, setNewGAmpWattage] = useState('');

  const updateProfile = (field, value) => onProfiles((p) => {
    const cur = p[activeProfileId];
    if (!cur) return p;
    const resolved = typeof value === 'function' ? value(cur[field]) : value;
    const now = Date.now();
    const next = { ...cur, [field]: resolved, lastModified: now };
    // Phase 7.74.10 — stamps dédiés des champs LWW sensibles
    if (field === 'availableSources') next.availableSourcesModified = now;
    else if (field === 'enabledDevices') next.enabledDevicesModified = now;
    else if (field === 'language') next.languageModified = now;
    else if (field === 'banksAnn' || field === 'banksPlug') next.banksModified = now;
    return { ...p, [activeProfileId]: next };
  });

  const toggleGuitar = (id) => {
    updateProfile('myGuitars', (prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };
  const toggleSource = (key) => {
    updateProfile('availableSources', (prev) => ({ ...prev, [key]: !prev[key] }));
  };
  // Phase 8.6 — Helpers basse (parallèles guitare)
  const toggleBass = (id) => {
    updateProfile('myBasses', (prev) => (prev || []).includes(id) ? prev.filter((x) => x !== id) : [...(prev || []), id]);
  };
  const toggleBassAmp = (id) => {
    updateProfile('myBassAmps', (prev) => (prev || []).includes(id) ? prev.filter((x) => x !== id) : [...(prev || []), id]);
  };
  const toggleBassInstrument = () => {
    updateProfile('instruments', (prev) => {
      const list = Array.isArray(prev) ? prev : ['guitar'];
      if (list.includes('bass')) {
        return list.filter((x) => x !== 'bass');
      }
      return [...list, 'bass'];
    });
  };
  // Phase 8.7 — Helpers add/remove customs basse
  const addCustomBass = () => {
    if (!newBassName.trim()) return;
    const name = newBassName.trim();
    const brand = newBassBrand.trim() || 'Custom';
    const cb = {
      id: `cbass_${Date.now()}`,
      name,
      short: name.length > 20 ? name.slice(0, 18) + '…' : name,
      type: newBassType,
      brand,
    };
    updateProfile('customBasses', (prev) => [...(prev || []), cb]);
    updateProfile('myBasses', (prev) => [...(prev || []), cb.id]);
    setNewBassName(''); setNewBassBrand(''); setNewBassType('PJ');
  };
  const removeCustomBass = (id) => {
    updateProfile('customBasses', (prev) => (prev || []).filter((b) => b.id !== id));
    updateProfile('myBasses', (prev) => (prev || []).filter((x) => x !== id));
  };
  const addCustomBassAmp = () => {
    if (!newAmpName.trim()) return;
    const name = newAmpName.trim();
    const brand = newAmpBrand.trim() || 'Custom';
    const wattage = Number(newAmpWattage) || 100;
    const ca = {
      id: `camp_${Date.now()}`,
      name,
      short: name.length > 20 ? name.slice(0, 18) + '…' : name,
      brand,
      wattage,
      channels: ['Clean'],
      eq: ['Bass', 'Mid', 'Treble'],
      features: [],
      refs: { fr: '', en: '', es: '' },
    };
    updateProfile('customBassAmps', (prev) => [...(prev || []), ca]);
    updateProfile('myBassAmps', (prev) => [...(prev || []), ca.id]);
    setNewAmpName(''); setNewAmpBrand(''); setNewAmpWattage('');
  };
  const removeCustomBassAmp = (id) => {
    updateProfile('customBassAmps', (prev) => (prev || []).filter((a) => a.id !== id));
    updateProfile('myBassAmps', (prev) => (prev || []).filter((x) => x !== id));
  };
  // Phase A — Helpers amplis guitare traditionnels (parallèles aux amplis basse)
  const toggleGuitarAmp = (id) => {
    updateProfile('myGuitarAmps', (prev) => (prev || []).includes(id) ? prev.filter((x) => x !== id) : [...(prev || []), id]);
  };
  const addCustomGuitarAmp = () => {
    if (!newGAmpName.trim()) return;
    const name = newGAmpName.trim();
    const brand = newGAmpBrand.trim() || 'Custom';
    const wattage = Number(newGAmpWattage) || 50;
    const ca = {
      id: `cgamp_${Date.now()}`,
      name,
      short: name.length > 20 ? name.slice(0, 18) + '…' : name,
      brand,
      wattage,
      channels: ['Single'],
      knobs: ['gain', 'treble', 'middle', 'bass', 'presence', 'master'],
      eq: ['Treble', 'Middle', 'Bass', 'Presence'],
      features: [],
      refs: { fr: '', en: '', es: '' },
    };
    updateProfile('customGuitarAmps', (prev) => [...(prev || []), ca]);
    updateProfile('myGuitarAmps', (prev) => [...(prev || []), ca.id]);
    setNewGAmpName(''); setNewGAmpBrand(''); setNewGAmpWattage('');
  };
  const removeCustomGuitarAmp = (id) => {
    updateProfile('customGuitarAmps', (prev) => (prev || []).filter((a) => a.id !== id));
    updateProfile('myGuitarAmps', (prev) => (prev || []).filter((x) => x !== id));
  };
  const addCustomGuitar = (cg) => {
    onCustomGuitars((prev) => [...(prev || []), cg]);
    updateProfile('myGuitars', (prev) => [...prev, cg.id]);
  };
  const removeCustomGuitar = (id) => {
    onCustomGuitars((prev) => (prev || []).filter((g) => g.id !== id));
    // Phase 7.74 — Stamp lastModified sur les profils QUI AVAIENT
    // effectivement la guitare (sinon on stampait gratuitement tous
    // les profils et on saturait Firestore + risque de conflits LWW
    // multi-profil).
    onProfiles((p) => {
      const n = {};
      const ts = Date.now();
      for (const pid in p) {
        const cur = p[pid];
        const hadIt = (cur.myGuitars || []).includes(id);
        if (hadIt) {
          n[pid] = { ...cur, myGuitars: cur.myGuitars.filter((x) => x !== id), lastModified: ts };
        } else {
          n[pid] = cur; // pas de mutation, pas de stamp inutile
        }
      }
      return n;
    });
  };
  const startEditGuitar = (g, isCustom) => {
    const edits = profile.editedGuitars || {};
    const orig = isCustom ? g : ({ ...GUITARS.find((x) => x.id === g.id), ...(edits[g.id] || {}) });
    setEditingGuitarId(g.id); setEditGName(orig.name); setEditGShort(orig.short); setEditGType(orig.type);
    setEditGImage(isCustom ? (orig.image || null) : null);
    setEditGBrand(isCustom ? (orig.brand || inferBrand(orig.name) || 'Mes guitares') : '');
    setImgErr(null);
  };
  const onImageUpload = async (file) => {
    setImgErr(null);
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file, 240, 0.85);
      setEditGImage(dataUrl);
    } catch (e) {
      setImgErr(e.message || t('profile-tab.image-error', 'Erreur lors du chargement'));
    }
  };
  const saveEditGuitar = () => {
    if (!editGName.trim() || !editGShort.trim()) { setEditingGuitarId(null); return; }
    const isCustom = editingGuitarId?.startsWith('cg_');
    if (isCustom) {
      onCustomGuitars((prev) => (prev || []).map((g) => g.id === editingGuitarId ? { ...g, name: editGName.trim(), short: editGShort.trim(), type: editGType, image: editGImage || null, brand: editGBrand || 'Mes guitares' } : g));
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
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('profile-tab.my-guitars', 'Mes guitares')}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>{t('profile-tab.my-guitars-hint', 'Coche les guitares que tu possèdes.')}</div>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: sel ? 'var(--accent-soft)' : 'var(--a3)', border: sel ? '1px solid var(--accent-border)' : '1px solid var(--a6)', borderRadius: 'var(--r-md)', padding: '8px 12px', cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.6 : 1 }} onClick={() => { if (!isDemo) toggleGuitar(g.id); }} title={demoTitle}>
                        <div style={{ width: 18, height: 18, borderRadius: 'var(--r-sm)', border: sel ? '2px solid var(--accent)' : '2px solid var(--text-muted)', background: sel ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{sel && <span style={{ color: 'var(--text-inverse)', fontSize: 10, fontWeight: 900 }}>✓</span>}</div>
                        {/* Phase 7.85 — Inversion nom complet (gros) / nom court (petit)
                            sur demande Sébastien v8.14.240. Le nom complet est l'info
                            principale ("Fender Stratocaster American Vintage II 1961"),
                            le short ("Strat AVII 61") devient secondaire. */}
                        <div style={{ flex: 1 }}><span style={{ fontSize: 12, fontWeight: 600, color: sel ? 'var(--text)' : 'var(--text-muted)' }}>{display.name}</span><span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 6 }}>{display.short}</span>{isEdited && <span style={{ fontSize: 9, color: 'var(--copper-400)', marginLeft: 4 }}>{t('profile-tab.modified', 'modifié')}</span>}</div>
                        <span style={{ fontSize: 10, color: 'var(--text-dim)', marginRight: 4 }}>{display.type}</span>
                        {sel && <button onClick={(e) => { e.stopPropagation(); if (!isDemo) startEditGuitar(display, false); }} disabled={isDemo} title={demoTitle} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)', padding: '3px 7px', fontSize: 10, cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.5 : 1, display: 'inline-flex', alignItems: 'center' }}><NavIcon id="pen" size={12}/></button>}
                      </div>
                      {isEditing && <div style={{ background: 'var(--a5)', borderRadius: '0 0 8px 8px', padding: '10px 12px', marginTop: -1, border: '1px solid var(--a8)', borderTop: 'none' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                          <input placeholder={t('profile-tab.edit-name', 'Nom')} value={editGName} onChange={(e) => setEditGName(e.target.value)} style={{ ...inp, flex: '1 1 140px', fontSize: 11, padding: '5px 8px' }}/>
                          <input placeholder={t('profile-tab.edit-short', 'Abrégé')} value={editGShort} onChange={(e) => setEditGShort(e.target.value)} style={{ ...inp, flex: '0 1 80px', fontSize: 11, padding: '5px 8px' }}/>
                          <select value={editGType} onChange={(e) => setEditGType(e.target.value)} style={{ ...inp, flex: '0 0 55px', fontSize: 11, padding: '5px 4px' }}><option value="HB">HB</option><option value="SC">SC</option><option value="P90">P90</option></select>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button variant="primary" size="sm" onClick={saveEditGuitar}>{t('profile-tab.save', 'Sauver')}</Button>
                          {isEdited && <Button variant="secondary" size="sm" onClick={() => resetGuitar(g.id)} style={{ background: 'var(--yellow-bg)', border: '1px solid var(--yellow-border)', color: 'var(--yellow)' }}>{t('profile-tab.reset', 'Réinitialiser')}</Button>}
                          <Button variant="secondary" size="sm" onClick={() => setEditingGuitarId(null)}>{t('profile-tab.cancel', 'Annuler')}</Button>
                        </div>
                      </div>}
                    </div>;
                  })}
                  {customBrandGuitars.map((g) => {
                    const isEditing = editingGuitarId === g.id;
                    const sel = profile.myGuitars.includes(g.id);
                    return <div key={g.id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: sel ? 'var(--accent-soft)' : 'var(--a3)', border: sel ? '1px solid var(--accent-border)' : '1px solid var(--a6)', borderRadius: 'var(--r-md)', padding: '8px 12px', cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.6 : 1 }} onClick={() => { if (!isDemo) toggleGuitar(g.id); }} title={demoTitle}>
                        <div style={{ width: 18, height: 18, borderRadius: 'var(--r-sm)', border: sel ? '2px solid var(--accent)' : '2px solid var(--text-muted)', background: sel ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{sel && <span style={{ color: 'var(--text-inverse)', fontSize: 10, fontWeight: 900 }}>✓</span>}</div>
                        <div style={{ flex: 1 }}><span style={{ fontSize: 12, fontWeight: 600, color: sel ? 'var(--text)' : 'var(--text-muted)' }}>{g.name}</span><span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 6 }}>{g.short}</span></div>
                        <span style={{ fontSize: 10, color: 'var(--text-dim)', marginRight: 4 }}>{g.type}</span>
                        {/* Phase 7.67 — Édition custom guitars ouverte aux non-admins.
                            Les customGuitars sont per-profile (profile.customGuitars),
                            donc pas de risque cross-profil. */}
                        {sel && <button onClick={(e) => { e.stopPropagation(); if (!isDemo) startEditGuitar(g, true); }} disabled={isDemo} title={demoTitle} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)', padding: '3px 7px', fontSize: 10, cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.5 : 1, display: 'inline-flex', alignItems: 'center' }}><NavIcon id="pen" size={12}/></button>}
                        <button onClick={(e) => { e.stopPropagation(); if (!isDemo) removeCustomGuitar(g.id); }} disabled={isDemo} title={demoTitle} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: isDemo ? 'not-allowed' : 'pointer', fontSize: 11, padding: '2px 4px', opacity: isDemo ? 0.5 : 1 }}>✕</button>
                      </div>
                      {isEditing && <div style={{ background: 'var(--a5)', borderRadius: '0 0 8px 8px', padding: '10px 12px', marginTop: -1, border: '1px solid var(--a8)', borderTop: 'none' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                          <input placeholder={t('profile-tab.edit-name', 'Nom')} value={editGName} onChange={(e) => setEditGName(e.target.value)} style={{ ...inp, flex: '1 1 140px', fontSize: 11, padding: '5px 8px' }}/>
                          <input placeholder={t('profile-tab.edit-short', 'Abrégé')} value={editGShort} onChange={(e) => setEditGShort(e.target.value)} style={{ ...inp, flex: '0 1 80px', fontSize: 11, padding: '5px 8px' }}/>
                          <select value={editGType} onChange={(e) => setEditGType(e.target.value)} style={{ ...inp, flex: '0 0 55px', fontSize: 11, padding: '5px 4px' }}><option value="HB">HB</option><option value="SC">SC</option><option value="P90">P90</option></select>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-sec)' }}>{t('profile-tab.brand', 'Marque :')}</span>
                          <select value={editGBrand} onChange={(e) => setEditGBrand(e.target.value)} style={{ ...inp, flex: 1, fontSize: 11, padding: '5px 8px' }}>
                            {[...BRAND_KEYWORDS, 'Mes guitares'].filter((b, i, a) => a.indexOf(b) === i).map((b) => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <img src={editGImage || defaultGuitarSvg} alt="" style={{ width: 48, height: 36, objectFit: 'contain', border: '1px solid var(--a8)', borderRadius: 'var(--r-sm)', background: 'var(--a3)', padding: 2, opacity: editGImage ? 1 : 0.5, color: 'var(--text-muted)' }}/>
                          <label style={{ background: 'var(--a7)', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)', padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>
                            {editGImage ? t('profile-tab.change-image', "Changer l'image") : t('profile-tab.add-image', 'Ajouter une image')}
                            <input type="file" accept="image/*" onChange={(e) => onImageUpload(e.target.files?.[0])} style={{ display: 'none' }}/>
                          </label>
                          {editGImage && <Button variant="ghost" size="sm" onClick={() => setEditGImage(null)}>{t('profile-tab.remove-image', 'Retirer')}</Button>}
                        </div>
                        {imgErr && <div style={{ fontSize: 10, color: 'var(--red)', marginBottom: 6 }}>{imgErr}</div>}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button variant="primary" size="sm" onClick={saveEditGuitar}>{t('profile-tab.save', 'Sauver')}</Button>
                          <Button variant="secondary" size="sm" onClick={() => setEditingGuitarId(null)}>{t('profile-tab.cancel', 'Annuler')}</Button>
                        </div>
                      </div>}
                    </div>;
                  })}
                </div>
              </div>;
            })}
          </div>;
        })()}
        {/* Phase 7.67 — Ajout de custom guitars ouvert aux non-admins
            (un beta-tester peut ajouter sa Schecter / Sire / Ibanez Gio
            via la recherche IA Gemini sans solliciter l'admin). */}
        <GuitarSearchAdd inp={inp} aiKeys={aiKeys} disabled={isDemo} onAdd={(name, short, type) => {
          addCustomGuitar({ id: `cg_${Date.now()}`, name, short, type, brand: inferBrand(name) });
        }}/>

        {/* Phase A — Mes amplis guitare traditionnels (mirror amplis basse).
            Matériel physique non-ToneX (Marshall Plexi, Blues Junior…) pour
            lequel l'IA proposera des réglages de potards 0-10 par morceau. */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--a8)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}><NavIcon id="amp" size={15}/>{t('profile-tab.my-guitar-amps', 'Mes amplis guitare traditionnels')}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>{t('profile-tab.my-guitar-amps-hint', 'Coche les amplis guitare physiques que tu possèdes (en plus du ToneX). Backline proposera des réglages adaptés à ton matériel.')}</div>
          {GUITAR_AMP_BRANDS.map((brand) => {
            const brandAmps = GUITAR_AMPS.filter((a) => a.brand === brand);
            if (brandAmps.length === 0) return null;
            return (
              <div key={brand} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>{brand}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {brandAmps.map((a) => {
                    const sel = (profile.myGuitarAmps || []).includes(a.id);
                    return (
                      <div key={a.id} onClick={() => { if (!isDemo) toggleGuitarAmp(a.id); }} title={demoTitle} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: sel ? 'var(--accent-soft)' : 'var(--a3)', border: sel ? '1px solid var(--accent-border)' : '1px solid var(--a6)', borderRadius: 'var(--r-md)', padding: '8px 12px', cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.6 : 1 }}>
                        <div style={{ width: 18, height: 18, borderRadius: 'var(--r-sm)', border: sel ? '2px solid var(--accent)' : '2px solid var(--text-muted)', background: sel ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{sel && <span style={{ color: 'var(--text-inverse)', fontSize: 10, fontWeight: 900 }}>✓</span>}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: sel ? 'var(--text)' : 'var(--text-muted)' }}>{a.name} <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 400 }}>· {a.wattage}W</span></div>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4 }}>{a.features?.join(' · ') || ''}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {(profile?.customGuitarAmps || []).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>{t('profile-tab.custom-guitar-amps-section', 'Mes amplis guitare custom')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(profile.customGuitarAmps || []).map((a) => {
                  const sel = (profile.myGuitarAmps || []).includes(a.id);
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: sel ? 'var(--accent-soft)' : 'var(--a3)', border: sel ? '1px solid var(--accent-border)' : '1px solid var(--a6)', borderRadius: 'var(--r-md)', padding: '8px 12px' }}>
                      <div onClick={() => { if (!isDemo) toggleGuitarAmp(a.id); }} title={demoTitle} style={{ width: 18, height: 18, borderRadius: 'var(--r-sm)', border: sel ? '2px solid var(--accent)' : '2px solid var(--text-muted)', background: sel ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, cursor: isDemo ? 'not-allowed' : 'pointer' }}>{sel && <span style={{ color: 'var(--text-inverse)', fontSize: 10, fontWeight: 900 }}>✓</span>}</div>
                      <div style={{ flex: 1, minWidth: 0, cursor: isDemo ? 'not-allowed' : 'pointer' }} onClick={() => { if (!isDemo) toggleGuitarAmp(a.id); }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: sel ? 'var(--text)' : 'var(--text-muted)' }}>{a.name} <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 400 }}>· {a.brand} · {a.wattage}W</span></div>
                      </div>
                      <button onClick={() => { if (!isDemo) removeCustomGuitarAmp(a.id); }} disabled={isDemo} title={demoTitle} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: isDemo ? 'not-allowed' : 'pointer', fontSize: 12, padding: '2px 4px', minHeight: 28, minWidth: 28, opacity: isDemo ? 0.5 : 1 }}>✕</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ background: 'var(--a3)', border: '1px dashed var(--a8)', borderRadius: 'var(--r-md)', padding: 10, marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>{t('profile-tab.add-custom-guitar-amp', 'Ajouter un ampli guitare hors catalog')}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              <input placeholder={t('profile-tab.add-guitar-amp-name-placeholder', 'Nom (ex. Orange Rockerverb)')} value={newGAmpName} onChange={(e) => setNewGAmpName(e.target.value)} disabled={isDemo} style={{ ...inp, flex: '1 1 200px', fontSize: 12, padding: '6px 10px' }}/>
              <input placeholder={t('profile-tab.add-amp-brand-placeholder', 'Marque')} value={newGAmpBrand} onChange={(e) => setNewGAmpBrand(e.target.value)} disabled={isDemo} style={{ ...inp, flex: '1 1 100px', fontSize: 12, padding: '6px 10px' }}/>
              <input type="number" placeholder="Watt" value={newGAmpWattage} onChange={(e) => setNewGAmpWattage(e.target.value)} disabled={isDemo} min={1} max={2000} style={{ ...inp, flex: '0 0 70px', fontSize: 12, padding: '6px 8px' }}/>
            </div>
            <Button variant="primary" disabled={isDemo || !newGAmpName.trim()} title={demoTitle} onClick={() => { if (!isDemo) addCustomGuitarAmp(); }}>{t('profile-tab.add-amp-submit', 'Ajouter')}</Button>
          </div>
        </div>
      </div>}

      {/* Phase 8.6 — Tab "🎻 Mes basses" : toggle "Activer la basse" +
          liste basses cochables + liste amplis basse cochables. Gated
          comme les autres tabs (visible si !isDemo). */}
      {s === 'basses' && <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 16 }}>
        {(() => {
          const instruments = Array.isArray(profile?.instruments) ? profile.instruments : ['guitar'];
          const bassActive = instruments.includes('bass');
          const myBasses = profile?.myBasses || [];
          const myBassAmps = profile?.myBassAmps || [];
          return (
            <>
              {/* Section 1 — Toggle activation basse */}
              <div style={{ marginBottom: bassActive ? 20 : 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('profile-tab.bass-activate', 'Active la basse')}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>{t('profile-tab.bass-activate-hint-flat', 'Active si tu joues aussi la basse (multi-instrument). Une section dédiée "Basse" apparaît dans la fiche song dépliée pour les morceaux ayant une ligne de basse notable.')}</div>
                <div onClick={() => { if (!isDemo) toggleBassInstrument(); }} title={demoTitle} style={{ display: 'flex', alignItems: 'center', gap: 10, background: bassActive ? 'var(--accent-soft)' : 'var(--a3)', border: bassActive ? '1px solid var(--accent-border)' : '1px solid var(--a6)', borderRadius: 'var(--r-md)', padding: '10px 14px', cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.6 : 1 }}>
                  <div style={{ width: 18, height: 18, borderRadius: 'var(--r-sm)', border: bassActive ? '2px solid var(--accent)' : '2px solid var(--text-muted)', background: bassActive ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{bassActive && <span style={{ color: 'var(--text-inverse)', fontSize: 10, fontWeight: 900 }}>✓</span>}</div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: bassActive ? 'var(--text)' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><NavIcon id="bass" size={15}/>{t('profile-tab.bass-toggle-label-flat', 'Je joue aussi la basse')}</span>
                </div>
              </div>

              {/* Section 2 — Liste basses cochables (seulement si activé) */}
              {bassActive && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('profile-tab.my-basses', 'Mes basses')}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>{t('profile-tab.my-basses-hint', 'Coche les basses que tu possèdes. Backline les utilisera pour recommander un instrument adapté au morceau.')}</div>
                  {BASS_BRANDS.map((brand) => {
                    const brandBasses = BASSES.filter((b) => b.brand === brand);
                    if (brandBasses.length === 0) return null;
                    return (
                      <div key={brand} style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>{brand}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {brandBasses.map((b) => {
                            const sel = myBasses.includes(b.id);
                            return (
                              <div key={b.id} onClick={() => { if (!isDemo) toggleBass(b.id); }} title={demoTitle} style={{ display: 'flex', alignItems: 'center', gap: 8, background: sel ? 'var(--accent-soft)' : 'var(--a3)', border: sel ? '1px solid var(--accent-border)' : '1px solid var(--a6)', borderRadius: 'var(--r-md)', padding: '8px 12px', cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.6 : 1 }}>
                                <div style={{ width: 18, height: 18, borderRadius: 'var(--r-sm)', border: sel ? '2px solid var(--accent)' : '2px solid var(--text-muted)', background: sel ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{sel && <span style={{ color: 'var(--text-inverse)', fontSize: 10, fontWeight: 900 }}>✓</span>}</div>
                                <div style={{ flex: 1 }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: sel ? 'var(--text)' : 'var(--text-muted)' }}>{b.name}</span>
                                  <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 6 }}>{b.short}</span>
                                </div>
                                <span style={{ fontSize: 10, color: 'var(--text-dim)', marginRight: 4 }}>{b.type}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {/* Phase 8.7 — Custom basses (hors catalog) */}
                  {(profile?.customBasses || []).length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>{t('profile-tab.custom-basses-section', 'Mes basses custom')}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {(profile.customBasses || []).map((b) => {
                          const sel = myBasses.includes(b.id);
                          return (
                            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: sel ? 'var(--accent-soft)' : 'var(--a3)', border: sel ? '1px solid var(--accent-border)' : '1px solid var(--a6)', borderRadius: 'var(--r-md)', padding: '8px 12px' }}>
                              <div onClick={() => { if (!isDemo) toggleBass(b.id); }} title={demoTitle} style={{ width: 18, height: 18, borderRadius: 'var(--r-sm)', border: sel ? '2px solid var(--accent)' : '2px solid var(--text-muted)', background: sel ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: isDemo ? 'not-allowed' : 'pointer' }}>{sel && <span style={{ color: 'var(--text-inverse)', fontSize: 10, fontWeight: 900 }}>✓</span>}</div>
                              <div style={{ flex: 1, cursor: isDemo ? 'not-allowed' : 'pointer' }} onClick={() => { if (!isDemo) toggleBass(b.id); }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: sel ? 'var(--text)' : 'var(--text-muted)' }}>{b.name}</span>
                                <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 6 }}>{b.brand}</span>
                              </div>
                              <span style={{ fontSize: 10, color: 'var(--text-dim)', marginRight: 4 }}>{b.type}</span>
                              <button onClick={() => { if (!isDemo) removeCustomBass(b.id); }} disabled={isDemo} title={demoTitle} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: isDemo ? 'not-allowed' : 'pointer', fontSize: 12, padding: '2px 4px', minHeight: 28, minWidth: 28, opacity: isDemo ? 0.5 : 1 }}>✕</button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* Phase 8.7 — Form ajout custom basse */}
                  <div style={{ background: 'var(--a3)', border: '1px dashed var(--a8)', borderRadius: 'var(--r-md)', padding: 10, marginTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>{t('profile-tab.add-custom-bass', '➕ Ajouter une basse hors catalog')}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                      <input placeholder={t('profile-tab.add-bass-name-placeholder', 'Nom (ex. Sterling SUB Ray4)')} value={newBassName} onChange={(e) => setNewBassName(e.target.value)} disabled={isDemo} style={{ ...inp, flex: '1 1 200px', fontSize: 12, padding: '6px 10px' }}/>
                      <input placeholder={t('profile-tab.add-bass-brand-placeholder', 'Marque')} value={newBassBrand} onChange={(e) => setNewBassBrand(e.target.value)} disabled={isDemo} style={{ ...inp, flex: '1 1 100px', fontSize: 12, padding: '6px 10px' }}/>
                      <select value={newBassType} onChange={(e) => setNewBassType(e.target.value)} disabled={isDemo} style={{ ...inp, flex: '0 0 80px', fontSize: 12, padding: '6px 6px' }}>
                        <option value="SC">SC</option>
                        <option value="PJ">PJ</option>
                        <option value="HB">HB</option>
                        <option value="MM">MM</option>
                      </select>
                    </div>
                    <Button variant="primary" disabled={isDemo || !newBassName.trim()} title={demoTitle} onClick={() => { if (!isDemo) addCustomBass(); }}>{t('profile-tab.add-bass-submit', 'Ajouter')}</Button>
                  </div>
                </div>
              )}

              {/* Section 3 — Liste amplis basse cochables (seulement si activé) */}
              {bassActive && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('profile-tab.my-bass-amps', 'Mes amplis basse traditionnels')}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>{t('profile-tab.my-bass-amps-hint', 'Coche les amplis basse physiques que tu possèdes (en plus du ToneX). Backline proposera des réglages adaptés à ton matériel.')}</div>
                  {BASS_AMP_BRANDS.map((brand) => {
                    const brandAmps = BASS_AMPS.filter((a) => a.brand === brand);
                    if (brandAmps.length === 0) return null;
                    return (
                      <div key={brand} style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>{brand}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {brandAmps.map((a) => {
                            const sel = myBassAmps.includes(a.id);
                            return (
                              <div key={a.id} onClick={() => { if (!isDemo) toggleBassAmp(a.id); }} title={demoTitle} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: sel ? 'var(--accent-soft)' : 'var(--a3)', border: sel ? '1px solid var(--accent-border)' : '1px solid var(--a6)', borderRadius: 'var(--r-md)', padding: '8px 12px', cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.6 : 1 }}>
                                <div style={{ width: 18, height: 18, borderRadius: 'var(--r-sm)', border: sel ? '2px solid var(--accent)' : '2px solid var(--text-muted)', background: sel ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{sel && <span style={{ color: 'var(--text-inverse)', fontSize: 10, fontWeight: 900 }}>✓</span>}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: sel ? 'var(--text)' : 'var(--text-muted)' }}>{a.name} <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 400 }}>· {a.wattage}W</span></div>
                                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4 }}>{a.features?.join(' · ') || ''}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {/* Phase 8.7 — Custom amplis basse (hors catalog) */}
                  {(profile?.customBassAmps || []).length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>{t('profile-tab.custom-bass-amps-section', 'Mes amplis basse custom')}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {(profile.customBassAmps || []).map((a) => {
                          const sel = myBassAmps.includes(a.id);
                          return (
                            <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: sel ? 'var(--accent-soft)' : 'var(--a3)', border: sel ? '1px solid var(--accent-border)' : '1px solid var(--a6)', borderRadius: 'var(--r-md)', padding: '8px 12px' }}>
                              <div onClick={() => { if (!isDemo) toggleBassAmp(a.id); }} title={demoTitle} style={{ width: 18, height: 18, borderRadius: 'var(--r-sm)', border: sel ? '2px solid var(--accent)' : '2px solid var(--text-muted)', background: sel ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, cursor: isDemo ? 'not-allowed' : 'pointer' }}>{sel && <span style={{ color: 'var(--text-inverse)', fontSize: 10, fontWeight: 900 }}>✓</span>}</div>
                              <div style={{ flex: 1, minWidth: 0, cursor: isDemo ? 'not-allowed' : 'pointer' }} onClick={() => { if (!isDemo) toggleBassAmp(a.id); }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: sel ? 'var(--text)' : 'var(--text-muted)' }}>{a.name} <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 400 }}>· {a.brand} · {a.wattage}W</span></div>
                              </div>
                              <button onClick={() => { if (!isDemo) removeCustomBassAmp(a.id); }} disabled={isDemo} title={demoTitle} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: isDemo ? 'not-allowed' : 'pointer', fontSize: 12, padding: '2px 4px', minHeight: 28, minWidth: 28, opacity: isDemo ? 0.5 : 1 }}>✕</button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* Phase 8.7 — Form ajout custom ampli basse */}
                  <div style={{ background: 'var(--a3)', border: '1px dashed var(--a8)', borderRadius: 'var(--r-md)', padding: 10, marginTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>{t('profile-tab.add-custom-amp-flat', 'Ajouter un ampli basse hors catalog')}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                      <input placeholder={t('profile-tab.add-amp-name-placeholder', 'Nom (ex. Hartke HD500)')} value={newAmpName} onChange={(e) => setNewAmpName(e.target.value)} disabled={isDemo} style={{ ...inp, flex: '1 1 200px', fontSize: 12, padding: '6px 10px' }}/>
                      <input placeholder={t('profile-tab.add-amp-brand-placeholder', 'Marque')} value={newAmpBrand} onChange={(e) => setNewAmpBrand(e.target.value)} disabled={isDemo} style={{ ...inp, flex: '1 1 100px', fontSize: 12, padding: '6px 10px' }}/>
                      <input type="number" placeholder="Watt" value={newAmpWattage} onChange={(e) => setNewAmpWattage(e.target.value)} disabled={isDemo} min={1} max={2000} style={{ ...inp, flex: '0 0 70px', fontSize: 12, padding: '6px 8px' }}/>
                    </div>
                    <Button variant="primary" disabled={isDemo || !newAmpName.trim()} title={demoTitle} onClick={() => { if (!isDemo) addCustomBassAmp(); }}>{t('profile-tab.add-amp-submit', 'Ajouter')}</Button>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>}

      {s === 'sources' && <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('profile-tab.my-sources', 'Mes sources de presets')}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>{t('profile-tab.my-sources-hint', 'Coche uniquement les packs et matériels ToneX que tu possèdes réellement. Les recommandations seront filtrées en conséquence.')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(() => {
            const factoryV1Empty = !FACTORY_BANKS_PEDALE_V1 || Object.keys(FACTORY_BANKS_PEDALE_V1).length === 0;
            const customEmpty = !profile.customPacks || profile.customPacks.length === 0;
            return Object.entries(SOURCE_LABELS).map(([key, label]) => {
              const enabled = new Set(profile.enabledDevices || []);
              // Phase 7.74.10 — si la source dépend d'un device et que
              // ce device n'est pas activé, la source devient grisée +
              // non-cliquable + force-affichée OFF (peu importe la
              // valeur stockée).
              const requiredDevice = SOURCE_REQUIRES_DEVICE[key];
              const deviceMissing = !!(requiredDevice && !enabled.has(requiredDevice));
              const locked = !deviceMissing && (
                (key === 'Anniversary' && enabled.has('tonex-anniversary'))
                || (key === 'Factory' && enabled.has('tonex-pedal'))
                || (key === 'PlugFactory' && enabled.has('tonex-plug'))
              );
              // Phase 7.50 (B-UX-01) : source désactivable si son contenu est vide.
              // Phase 7.74.10 : extension — device non activé bloque aussi.
              const unavailable = (key === 'FactoryV1' && factoryV1Empty)
                || (key === 'custom' && customEmpty)
                || deviceMissing;
              const on = !unavailable && (locked || profile.availableSources?.[key] !== false);
              const desc = SOURCE_DESCRIPTIONS[key] || '';
              const icon = SOURCE_INFO[key]?.icon || '📁';
              // Phase 7.74.10 — label dynamique selon raison d'indisponibilité.
              const unavailableLabel = deviceMissing
                ? t('profile-tab.device-required', 'matériel non activé')
                : (key === 'FactoryV1'
                    ? t('profile-tab.empty-list', 'liste à fournir')
                    : t('profile-tab.empty-custom', 'aucun pack custom'));
              return <button key={key} onClick={() => { if (!locked && !unavailable && !isDemo) toggleSource(key); }}
                disabled={unavailable || isDemo}
                title={isDemo ? demoTitle : undefined}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: on ? 'var(--green-bg)' : 'var(--a3)', border: on ? '1px solid var(--green-border)' : '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '10px 14px', cursor: isDemo ? 'not-allowed' : (unavailable ? 'not-allowed' : (locked ? 'default' : 'pointer')), textAlign: 'left', opacity: isDemo ? 0.5 : (unavailable ? 0.5 : (locked ? 0.85 : 1)) }}>
                <div style={{ width: 18, height: 18, borderRadius: 'var(--r-sm)', border: on ? '2px solid var(--green)' : '2px solid var(--text-muted)', background: on ? 'var(--green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>{on && <span style={{ color: 'var(--bg)', fontSize: 10, fontWeight: 900 }}>✓</span>}</div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ fontSize: 12, color: on ? 'var(--text)' : 'var(--text-muted)', fontWeight: on ? 700 : 500, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span>{icon}</span>
                    <span>{label}</span>
                    {locked && <span style={{ fontSize: 9, color: 'var(--text-dim)', background: 'var(--a6)', borderRadius: 'var(--r-sm)', padding: '1px 6px', fontWeight: 600 }}>{t('profile-tab.locked', 'verrouillé (matériel coché)')}</span>}
                    {unavailable && <span style={{ fontSize: 9, color: 'var(--text-dim)', background: 'var(--a6)', borderRadius: 'var(--r-sm)', padding: '1px 6px', fontWeight: 600 }}>{unavailableLabel}</span>}
                  </div>
                  {desc && <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.4 }}>{desc}</div>}
                </div>
              </button>;
            });
          })()}
        </div>
      </div>}
    </div>
  );
}

export default ProfileTab;
export { ProfileTab };

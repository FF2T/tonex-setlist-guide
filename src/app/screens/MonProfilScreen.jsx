// src/app/screens/MonProfilScreen.jsx — Phase 7.19 (découpage main.jsx).
//
// Écran 👤 Mon profil — tabs visibles selon admin/non-admin et les
// devices activés du profil. Wrap tous les onglets-tabs (ProfileTab,
// MesAppareilsTab, ToneNetTab, BankEditor, TmpBrowser, etc.).
//
// MaintenanceTab reste dans main.jsx pour l'instant — passé via prop
// `MaintenanceTabComponent` pour éviter une dépendance circulaire le
// temps de la séparation.

import React, { useState } from 'react';
import { SUPPORTED_LOCALES, setLocale, useLocale } from '../../i18n/index.js';
import { findDuplicateSong } from '../utils/song-helpers.js';
import { updateAiCache } from '../utils/ai-helpers.js';
import { fetchAI } from '../utils/fetchAI.js';
import { setSharedGeminiKey } from '../utils/shared-key.js';
import { hashPassword, verifyPassword, isPasswordLegacy } from '../../core/crypto-utils.js';
import Breadcrumb from '../components/Breadcrumb.jsx';
import BankEditor from '../components/BankEditor.jsx';
import ProfileTab from './ProfileTab.jsx';
import MesAppareilsTab from './MesAppareilsTab.jsx';
import ToneNetTab from './ToneNetTab.jsx';
import ProfilesAdmin from './ProfilesAdmin.jsx';
import PacksTab from './PacksTab.jsx';
import ExportImportScreen from './ExportImportScreen.jsx';
import { InlineRenameInput } from './ListScreen.jsx';
import TmpBrowser from '../../devices/tonemaster-pro/Browser.jsx';
import { FACTORY_BANKS_PEDALE } from '../../devices/tonex-pedal/index.js';
import { FACTORY_BANKS_ANNIVERSARY } from '../../devices/tonex-anniversary/index.js';
import { FACTORY_BANKS_PLUG } from '../../devices/tonex-plug/index.js';

function MonProfilScreen({
  songDb, onSongDb, setlists, allSetlists, onSetlists, onDeletedSetlistIds,
  banksAnn, onBanksAnn, banksPlug, onBanksPlug,
  onBack, onNavigate,
  aiProvider, onAiProvider, aiKeys, onAiKeys, theme, onTheme,
  profile, profiles, onProfiles, activeProfileId,
  allGuitars, allRigsGuitars, guitarBias,
  initTab, customGuitars, onCustomGuitars,
  toneNetPresets, onToneNetPresets,
  fullState, onImportState, onLogout,
  MaintenanceTabComponent, onSaveSharedKey,
}) {
  const locale = useLocale();
  const [tab, setTab] = useState(initTab || 'profile');
  const [newSlName, setNewSlName] = useState('');
  const [editSlId, setEditSlId] = useState(null);
  const [editSlName, setEditSlName] = useState('');
  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongArtist, setNewSongArtist] = useState('');
  const [newSongSlIds, setNewSongSlIds] = useState([]);
  const toggleNewSongSl = (id) => setNewSongSlIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const [expandedSongId, setExpandedSongId] = useState(null);
  const toggleSongInSetlist = (songId, slId) => onSetlists((p) => p.map((sl) => sl.id !== slId ? sl : { ...sl, songIds: sl.songIds.includes(songId) ? sl.songIds.filter((x) => x !== songId) : [...sl.songIds, songId] }));
  const inp = { background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-md)', padding: '6px 10px', fontSize: 12, boxSizing: 'border-box' };
  const tabBtn = (id, label) => (
    <button onClick={() => setTab(id)} style={{ background: tab === id ? 'var(--accent-bg)' : 'var(--a5)', border: tab === id ? '1px solid var(--border-accent)' : '1px solid var(--a8)', color: tab === id ? 'var(--accent)' : 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
  );
  const createSetlist = () => { if (!newSlName.trim()) return; onSetlists((p) => [...p, { id: `sl_${Date.now()}`, name: newSlName.trim(), songIds: [], profileIds: [activeProfileId] }]); setNewSlName(''); };
  const deleteSetlist = (id) => {
    const sl = setlists.find((s) => s.id === id);
    if (!sl) return;
    const n = sl.songIds.length;
    if (!window.confirm(`Supprimer la setlist "${sl.name}" ?${n > 0 ? '\nElle contient ' + n + ' morceau' + (n > 1 ? 'x' : '') + ' (les morceaux ne sont pas supprimés de la base).' : ''}`)) return;
    onSetlists((p) => p.filter((s) => s.id !== id));
  };
  const renameSetlist = (id, name) => onSetlists((p) => p.map((s) => s.id === id ? { ...s, name } : s));
  const addSongToDb = () => {
    if (!newSongTitle.trim()) return;
    const title = newSongTitle.trim();
    const artist = newSongArtist.trim() || 'Artiste inconnu';
    const dup = findDuplicateSong(songDb, title, artist);
    if (dup) {
      const slCount = newSongSlIds.length;
      const msg = `"${dup.title}" (${dup.artist}) est déjà dans la base.${slCount > 0 ? '\n\nVoulez-vous l\'ajouter ' + (slCount > 1 ? 'aux setlists sélectionnées' : 'à la setlist sélectionnée') + ' ?' : ''}`;
      if (slCount > 0) {
        if (window.confirm(msg)) {
          onSetlists((p) => p.map((sl) => newSongSlIds.includes(sl.id) && !sl.songIds.includes(dup.id) ? { ...sl, songIds: [...sl.songIds, dup.id] } : sl));
        }
      } else {
        window.alert(msg);
      }
      setNewSongTitle(''); setNewSongArtist(''); setNewSongSlIds([]);
      return;
    }
    const ns = { id: `c_${Date.now()}`, title, artist, isCustom: true, ig: [], aiCache: null };
    onSongDb((p) => [...p, ns]);
    if (newSongSlIds.length > 0) onSetlists((p) => p.map((sl) => newSongSlIds.includes(sl.id) ? { ...sl, songIds: [...sl.songIds, ns.id] } : sl));
    fetchAI(ns, '', banksAnn, banksPlug, aiProvider, aiKeys, allGuitars, null, null, profile?.recoMode || 'balanced', guitarBias)
      .then((r) => onSongDb((p) => p.map((x) => x.id === ns.id ? { ...x, aiCache: updateAiCache(x.aiCache, '', r) } : x)))
      .catch(() => {});
    setNewSongTitle(''); setNewSongArtist(''); setNewSongSlIds([]);
  };
  const deleteSongFromDb = (id) => {
    const s = songDb.find((x) => x.id === id);
    if (!s) return;
    if (!window.confirm(`Supprimer "${s.title}" (${s.artist}) de la base ?\nLe morceau sera retiré de toutes les setlists.`)) return;
    onSongDb((p) => p.filter((x) => x.id !== id)); onSetlists((p) => p.map((sl) => ({ ...sl, songIds: sl.songIds.filter((x) => x !== id) })));
  };

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Accueil', screen: 'list' }, { label: 'Mon profil' }]} onNavigate={onNavigate}/>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>👤 Mon profil</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabBtn('profile', '🎸 Guitares')}
        {tabBtn('devices', '📱 Mes appareils')}
        {tabBtn('sources', '📦 Sources')}
        {profile.isAdmin && tabBtn('tonenet', '🌐 ToneNET')}
        {(() => { const en = new Set(profile.enabledDevices || []); return <>
          {en.has('tonex-pedal') && tabBtn('pedale', '🎛 Pedale ToneX')}
          {en.has('tonex-anniversary') && tabBtn('ann', '🎛 ToneX Ann.')}
          {en.has('tonex-plug') && tabBtn('plug', '🔌 ToneX Plug')}
          {en.has('tonemaster-pro') && tabBtn('tmp', '🎚️ Patches TMP')}
        </>; })()}
        {tabBtn('display', '🎨 Affichage')}
        {tabBtn('reco', '🎯 Préférences IA')}
        {tabBtn('password', '🔐 Mot de passe')}
        {profile.isAdmin && tabBtn('ia', '🔑 Cle API')}
        {profile.isAdmin && tabBtn('maintenance', '🔧 Maintenance')}
        {profile.isAdmin && tabBtn('export', '📋 Export / Import')}
        {profile.isAdmin && tabBtn('admin_profiles', '👥 Profils')}
      </div>
      {tab === 'profile' && <ProfileTab profile={profile} profiles={profiles} onProfiles={onProfiles} activeProfileId={activeProfileId} inp={inp} section="guitars" aiKeys={aiKeys} customGuitars={customGuitars} onCustomGuitars={onCustomGuitars}/>}
      {tab === 'devices' && <MesAppareilsTab profile={profile} profiles={profiles} onProfiles={onProfiles} activeProfileId={activeProfileId}/>}
      {tab === 'sources' && <ProfileTab profile={profile} profiles={profiles} onProfiles={onProfiles} activeProfileId={activeProfileId} inp={inp} section="sources"/>}
      {profile.isAdmin && tab === 'tonenet' && <ToneNetTab toneNetPresets={toneNetPresets} onToneNetPresets={onToneNetPresets} inp={inp}/>}
      {tab === 'setlists' && <div>
        <div style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 12 }}>{setlists.length} setlist{setlists.length > 1 ? 's' : ''}</div>
        {setlists.map((sl) => (
          <div key={sl.id} style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 14, marginBottom: 12 }}>
            {editSlId === sl.id ? (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <InlineRenameInput initialName={sl.name} onSave={(name) => { renameSetlist(sl.id, name); setEditSlId(null); }} onCancel={() => setEditSlId(null)} inp={inp}/>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{sl.name}</div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sl.songIds.length} morceaux</span>
                <button onClick={() => { setEditSlId(sl.id); setEditSlName(sl.name); }} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>✏️</button>
                {setlists.length > 1 && <button onClick={() => deleteSetlist(sl.id)} style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', borderRadius: 'var(--r-md)', padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>🗑</button>}
              </div>
            )}
          </div>
        ))}
        <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-soft)', borderRadius: 'var(--r-lg)', padding: 14, marginTop: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginBottom: 8 }}>+ Nouvelle setlist</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input placeholder="Nom de la setlist" value={newSlName} onChange={(e) => setNewSlName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createSetlist()} style={{ ...inp, flex: 1 }}/>
            <button onClick={createSetlist} disabled={!newSlName.trim()} style={{ background: newSlName.trim() ? 'var(--accent)' : 'var(--bg-elev-3)', border: 'none', color: 'var(--text)', borderRadius: 'var(--r-md)', padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: newSlName.trim() ? 'pointer' : 'not-allowed' }}>Créer</button>
          </div>
        </div>
      </div>}
      {tab === 'songs' && <div>
        <div style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 12 }}>{songDb.length} morceaux dans la base</div>
        {songDb.map((s) => {
          const expanded = expandedSongId === s.id;
          return (
            <div key={s.id} style={{ background: 'var(--a3)', border: '1px solid var(--a6)', borderRadius: 'var(--r-lg)', marginBottom: 6, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px' }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.title}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.artist}{s.isCustom ? ' · ✨IA' : ''}</div></div>
                <button onClick={() => setExpandedSongId(expanded ? null : s.id)} style={{ background: expanded ? 'var(--accent-soft)' : 'var(--a7)', border: expanded ? '1px solid var(--accent-border)' : '1px solid var(--a10)', color: expanded ? 'var(--accent)' : 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>Setlists</button>
                <button onClick={() => deleteSongFromDb(s.id)} style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', borderRadius: 'var(--r-md)', padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Supprimer</button>
              </div>
              {expanded && <div style={{ padding: '8px 12px 10px', borderTop: '1px solid var(--a5)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {setlists.map((sl) => { const inSl = sl.songIds.includes(s.id); return (
                  <button key={sl.id} onClick={() => toggleSongInSetlist(s.id, sl.id)} style={{ background: inSl ? 'var(--green-border)' : 'var(--a5)', border: inSl ? '1px solid rgba(74,222,128,0.4)' : '1px solid var(--a10)', color: inSl ? 'var(--green)' : 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{inSl ? '✓ ' : ''}{sl.name}</button>
                ); })}
              </div>}
            </div>
          ); })}

        <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-soft)', borderRadius: 'var(--r-lg)', padding: 14, marginTop: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginBottom: 10 }}>+ Ajouter un morceau</div>
          <input placeholder="Titre *" value={newSongTitle} onChange={(e) => setNewSongTitle(e.target.value)} style={{ ...inp, width: '100%', marginBottom: 7 }}/>
          <input placeholder="Artiste" value={newSongArtist} onChange={(e) => setNewSongArtist(e.target.value)} style={{ ...inp, width: '100%', marginBottom: 10 }}/>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Ajouter aussi à :</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {setlists.map((sl) => { const sel = newSongSlIds.includes(sl.id); return (
              <button key={sl.id} onClick={() => toggleNewSongSl(sl.id)} style={{ background: sel ? 'var(--accent-bg)' : 'var(--a5)', border: sel ? '1px solid var(--border-accent)' : '1px solid var(--a10)', color: sel ? 'var(--accent)' : 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{sl.name}</button>
            ); })}
          </div>
          <button onClick={addSongToDb} disabled={!newSongTitle.trim()} style={{ width: '100%', background: newSongTitle.trim() ? 'var(--accent)' : 'var(--bg-elev-3)', color: 'var(--text)', border: 'none', borderRadius: 'var(--r-md)', padding: '9px', fontSize: 13, fontWeight: 600, cursor: newSongTitle.trim() ? 'pointer' : 'not-allowed' }}>Ajouter à la base</button>
        </div>
      </div>}
      {tab === 'display' && <div>
        <div style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 16 }}>Apparence de l'application.</div>
        <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Thème</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ v: 'dark', l: '🌙 Sombre', desc: 'Fond sombre' }, { v: 'light', l: '☀️ Clair', desc: 'Fond clair' }].map(({ v, l, desc }) => (
              <button key={v} onClick={() => onTheme(v)} style={{ flex: 1, background: theme === v ? 'var(--accent-bg)' : 'var(--a5)', border: theme === v ? '1px solid var(--border-accent)' : '1px solid var(--a10)', color: theme === v ? 'var(--accent)' : 'var(--text-sec)', borderRadius: 'var(--r-lg)', padding: '14px 8px', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{v === 'dark' ? '🌙' : '☀️'}</div>
                <div>{l.split(' ')[1]}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Langue</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.5 }}>L'interface est encore majoritairement en français. Les traductions sont en cours de déploiement progressif.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {SUPPORTED_LOCALES.map(({ id, label, flag }) => {
              const active = locale === id;
              return <button
                key={id}
                data-testid={`locale-${id}`}
                onClick={() => { setLocale(id); }}
                style={{ flex: 1, background: active ? 'var(--accent-bg)' : 'var(--a5)', border: active ? '1px solid var(--border-accent)' : '1px solid var(--a10)', color: active ? 'var(--accent)' : 'var(--text-sec)', borderRadius: 'var(--r-lg)', padding: '14px 8px', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'center' }}
              >
                <div style={{ fontSize: 22, marginBottom: 4 }}>{flag}</div>
                <div>{label}</div>
              </button>;
            })}
          </div>
        </div>
      </div>}
      {tab === 'pedale' && <BankEditor banks={banksAnn} onBanks={onBanksAnn} color="var(--accent)" maxBanks={50} factoryBanks={FACTORY_BANKS_PEDALE} toneNetPresets={toneNetPresets}/>}
      {tab === 'ann' && <BankEditor banks={banksAnn} onBanks={onBanksAnn} color="var(--accent)" maxBanks={50} factoryBanks={FACTORY_BANKS_ANNIVERSARY} toneNetPresets={toneNetPresets}/>}
      {tab === 'plug' && <BankEditor banks={banksPlug} onBanks={onBanksPlug} color="var(--accent)" maxBanks={10} startBank={1} factoryBanks={FACTORY_BANKS_PLUG} toneNetPresets={toneNetPresets}/>}
      {tab === 'tmp' && <TmpBrowser profile={profile} onUpdateCustoms={(customs) => {
        onProfiles((p) => {
          const cur = p[activeProfileId]; if (!cur) return p;
          const prevTmp = cur.tmpPatches || { custom: [], factoryOverrides: {} };
          return { ...p, [activeProfileId]: { ...cur, tmpPatches: { ...prevTmp, custom: customs }, lastModified: Date.now() } };
        });
      }}/>}
      {tab === 'password' && <PasswordTab profile={profile} onProfiles={onProfiles} activeProfileId={activeProfileId} inp={inp}/>}
      {tab === 'reco' && <div>
        <div style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 12 }}>Comment l'IA propose les recommandations.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {[
            { id: 'balanced', icon: '⚖️', label: 'Équilibré (défaut)', desc: 'Mélange fidélité au morceau original et versatilité du rig. Comportement actuel.' },
            { id: 'faithful', icon: '🎯', label: 'Fidèle à l\'original', desc: 'L\'IA privilégie la guitare/ampli/effets exacts utilisés sur l\'enregistrement original. Reco proche du son du disque.' },
            { id: 'interpretation', icon: '🎨', label: 'Interprétation libre', desc: 'L\'IA privilégie les guitares versatiles (ES-335, SG, Strat) qui couvrent bien le style, même si ce n\'est pas l\'instrument original. Pratique si tu as un rig limité.' },
          ].map(({ id, icon, label, desc }) => {
            const active = (profile.recoMode || 'balanced') === id;
            return <button
              key={id}
              data-testid={`reco-mode-${id}`}
              onClick={() => {
                onProfiles((p) => ({ ...p, [activeProfileId]: { ...p[activeProfileId], recoMode: id, lastModified: Date.now() } }));
              }}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: active ? 'var(--accent-bg)' : 'var(--a3)', border: active ? '1px solid var(--accent-border)' : '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '12px 14px', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ width: 18, height: 18, borderRadius: '50%', border: active ? '2px solid var(--accent)' : '2px solid var(--text-muted)', background: active ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>{active && <span style={{ color: 'var(--bg)', fontSize: 11, fontWeight: 900 }}>✓</span>}</div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 13, color: active ? 'var(--text)' : 'var(--text-muted)', fontWeight: active ? 700 : 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{icon}</span>
                  <span>{label}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>{desc}</div>
              </div>
            </button>;
          })}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.5, marginBottom: 16 }}>Ce mode est passé en input à chaque appel IA. Les morceaux déjà analysés gardent leur cache jusqu'à invalidation.</div>
        {(() => {
          const BIAS_STYLES = [
            { id: 'blues', label: 'Blues' },
            { id: 'rock', label: 'Rock' },
            { id: 'hard_rock', label: 'Hard rock' },
            { id: 'jazz', label: 'Jazz' },
            { id: 'metal', label: 'Metal' },
            { id: 'pop', label: 'Pop' },
          ];
          const manualMap = (profile.guitarBias && typeof profile.guitarBias === 'object') ? profile.guitarBias : {};
          const manualCount = Object.values(manualMap).filter(Boolean).length;
          const writeOverride = (style, guitarId) => {
            onProfiles((p) => {
              const cur = p[activeProfileId]; if (!cur) return p;
              const nextBias = { ...(cur.guitarBias || {}) };
              if (guitarId) nextBias[style] = guitarId; else delete nextBias[style];
              return { ...p, [activeProfileId]: { ...cur, guitarBias: nextBias, lastModified: Date.now() } };
            });
          };
          const resetAllManual = () => {
            if (!window.confirm(`Effacer ${manualCount} override${manualCount > 1 ? 's' : ''} manuel${manualCount > 1 ? 's' : ''} ?\n\nLe bias retombera sur les valeurs auto-dérivées de tes feedbacks.`)) return;
            onProfiles((p) => {
              const cur = p[activeProfileId]; if (!cur) return p;
              return { ...p, [activeProfileId]: { ...cur, guitarBias: {}, lastModified: Date.now() } };
            });
          };
          return <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Préférences guitare/style</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4 }}>L'IA apprend tes préférences depuis tes feedbacks (📊 auto, dès 3 morceaux feedbackés). Tu peux forcer un choix manuel (🎯 manuel — gagne sur l'auto). Soft hint dans le prompt, l'IA reste libre.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {BIAS_STYLES.map(({ id, label }) => {
                const effective = guitarBias && guitarBias[id];
                const manualId = manualMap[id] || '';
                return <div key={id} data-testid={`bias-row-${id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'var(--a6)', borderRadius: 'var(--r-md)', padding: '6px 10px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5, minWidth: 70 }}>{label}</span>
                    {effective
                      ? <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 'var(--r-sm)', background: effective.source === 'manual' ? 'var(--accent-bg)' : 'var(--a8)', color: effective.source === 'manual' ? 'var(--accent)' : 'var(--text-sec)', fontWeight: 600 }}>
                        {effective.source === 'manual' ? '🎯 manuel' : `📊 auto · ${effective.count} fb`}
                      </span>
                      : <span style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>aucune</span>
                    }
                    {effective && <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 500 }}>→ {effective.guitarName}</span>}
                  </div>
                  <select
                    data-testid={`bias-override-${id}`}
                    value={manualId}
                    onChange={(e) => writeOverride(id, e.target.value)}
                    style={{ background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-sm)', padding: '4px 6px', fontSize: 11, minWidth: 140 }}
                  >
                    <option value="">— Pas d'override —</option>
                    {(allGuitars || []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>;
              })}
            </div>
            {manualCount > 0 && <button
              data-testid="bias-reset-manual"
              onClick={resetAllManual}
              style={{ marginTop: 10, fontSize: 11, background: 'transparent', border: '1px solid var(--a15)', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '6px 10px', cursor: 'pointer' }}
            >Réinitialiser les {manualCount} override{manualCount > 1 ? 's' : ''} manuel{manualCount > 1 ? 's' : ''}</button>}
          </div>;
        })()}
        {/* Phase 7.33 — Bouton scoped accessible à TOUS les profils
            (admin + non-admin). Invalide uniquement les caches IA des
            morceaux dans les setlists du profil actif. Évite à un beta-
            testeur d'avoir à demander à l'admin de wiper son cache. */}
        {(() => {
          const mySongIds = new Set();
          (setlists || []).forEach((sl) => (sl.songIds || []).forEach((id) => mySongIds.add(id)));
          const myCount = (songDb || []).filter((s) => mySongIds.has(s.id) && s.aiCache).length;
          return (
            <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 14, marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Réinitialiser mes analyses IA</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4 }}>Invalide les caches IA UNIQUEMENT pour les morceaux de tes setlists ({myCount} morceau{myCount > 1 ? 'x' : ''} concerné{myCount > 1 ? 's' : ''}). Pratique pour forcer une ré-analyse après un changement de banks, de sources ou de mode reco. Au prochain ouverture (ou via "🤖 Analyser/MAJ" en Setlists), une nouvelle analyse sera lancée.</div>
              <button
                data-testid="reco-invalidate-mine"
                disabled={myCount === 0}
                onClick={() => {
                  if (!myCount) { window.alert('Aucun cache IA à invalider sur tes morceaux.'); return; }
                  if (!window.confirm(`Invalider ${myCount} cache${myCount > 1 ? 's' : ''} IA sur tes morceaux ?\n\nMode actuel : ${profile.recoMode || 'balanced'}.\n\nLes morceaux passeront en ⏳ et seront re-analysés à la demande.\n\nCela consomme du quota Gemini quand les re-analyses tournent (~8s par morceau).`)) return;
                  onSongDb((p) => p.map((s) => (mySongIds.has(s.id) && s.aiCache) ? { ...s, aiCache: null } : s));
                  window.alert(`✓ ${myCount} cache${myCount > 1 ? 's' : ''} invalidé${myCount > 1 ? 's' : ''}. Va dans Setlists et clique "🤖 Analyser/MAJ".`);
                }}
                style={{ background: myCount === 0 ? 'var(--bg-disabled)' : 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 11, fontWeight: 700, cursor: myCount === 0 ? 'not-allowed' : 'pointer', opacity: myCount === 0 ? 0.5 : 1 }}
              >🔄 Réinitialiser mes analyses ({myCount})</button>
            </div>
          );
        })()}
        {profile.isAdmin && <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Appliquer le mode à toute la base (admin)</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4 }}>Invalide TOUS les caches IA — y compris les morceaux des autres profils. À utiliser après un changement structurel (prompt, scoring) qui affecte tous les profils.</div>
          <button
            data-testid="reco-invalidate-all"
            onClick={() => {
              const n = (songDb || []).filter((s) => s.aiCache).length;
              if (!n) { window.alert('Aucun cache IA à invalider.'); return; }
              if (!window.confirm(`Invalider ${n} cache${n > 1 ? 's' : ''} IA (TOUS profils) ?\n\nMode actuel : ${profile.recoMode || 'balanced'}.\n\nLes morceaux passeront en ⏳ et seront re-analysés à la demande (ouverture ou bouton "⏳ Analyser/MAJ" en setlists).\n\nCela consomme du quota Gemini quand les re-analyses tournent (~8s par morceau).`)) return;
              onSongDb((p) => p.map((s) => s.aiCache ? { ...s, aiCache: null } : s));
              window.alert(`✓ ${n} caches invalidés. Reviens dans Setlists et clique "⏳ Analyser/MAJ".`);
            }}
            style={{ background: 'var(--wine-400)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '8px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
          >🗑 Invalider tous les caches IA</button>
        </div>}
      </div>}
      {profile.isAdmin && tab === 'ia' && <div>
        <div style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 12 }}>Configuration de la cle API pour l'IA.</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 700 }}>Modele actif :</span>
          <span style={{ color: 'var(--green)', fontWeight: 600 }}>{aiProvider === 'gemini' ? 'gemini-3-flash-preview' : 'claude-haiku-4-5'}</span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Cle Gemini</div>
        <input type="password" placeholder="AIza..." value={aiKeys.gemini} onChange={(e) => onAiKeys((p) => ({ ...p, gemini: e.target.value }))} style={{ ...inp, width: '100%', marginBottom: 8, fontFamily: 'monospace' }}/>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          <button
            data-testid="profile-share-gemini-key"
            onClick={() => {
              if (!aiKeys.gemini) { window.alert('Configure d\'abord une clé Gemini.'); return; }
              if (!window.confirm('Partager ta clé Gemini avec tous les profils ?\n\n• La clé est stockée dans Firestore (config/apikeys.gemini)\n• Tous les devices (Mac, iPhone, iPad) la téléchargent au boot\n• Les profils sans clé personnelle l\'utiliseront en fallback\n• Les appels IA seront facturés sur ton quota Google\n\nGemini a un free tier généreux (1500 req/jour) qui suffit largement.')) return;
              if (!onSaveSharedKey) { window.alert('saveSharedKey indisponible.'); return; }
              onSaveSharedKey(aiKeys.gemini).then(() => {
                setSharedGeminiKey(aiKeys.gemini);
                window.alert('✓ Clé partagée. Les autres profils l\'utiliseront au prochain reload.');
              }).catch((e) => {
                console.error('[saveSharedKey] failed:', e);
                window.alert('Échec du partage. Vérifie ta console pour le détail.');
              });
            }}
            disabled={!aiKeys.gemini}
            style={{ background: aiKeys.gemini ? 'var(--green)' : 'var(--bg-disabled)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: aiKeys.gemini ? 'pointer' : 'not-allowed' }}
          >🔑 Partager la clé (tous les profils)</button>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', alignSelf: 'center' }}>aistudio.google.com → Get API key</span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Cle Anthropic (fallback)</div>
        <input type="password" placeholder="sk-ant-..." value={aiKeys.anthropic} onChange={(e) => onAiKeys((p) => ({ ...p, anthropic: e.target.value }))} style={{ ...inp, width: '100%', fontFamily: 'monospace' }}/>
      </div>}
      {profile.isAdmin && tab === 'maintenance' && MaintenanceTabComponent && <MaintenanceTabComponent songDb={songDb} onSongDb={onSongDb} setlists={allSetlists} onSetlists={onSetlists} onDeletedSetlistIds={onDeletedSetlistIds} banksAnn={banksAnn} banksPlug={banksPlug} aiProvider={aiProvider} aiKeys={aiKeys} profile={profile} guitarBias={guitarBias}/>}
      {profile.isAdmin && tab === 'export' && <ExportImportScreen banksAnn={banksAnn} onBanksAnn={onBanksAnn} banksPlug={banksPlug} onBanksPlug={onBanksPlug} onBack={() => setTab('profile')} onNavigate={onNavigate} fullState={fullState} onImportState={onImportState} inline={true}/>}
      {profile.isAdmin && tab === 'admin_profiles' && <ProfilesAdmin profiles={profiles} onProfiles={onProfiles}/>}
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--a8)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => { if (typeof window.setShowOnboarding === 'function') window.setShowOnboarding(true); else { const e = new CustomEvent('showOnboarding'); window.dispatchEvent(e); } }} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Aide</button>
        <button onClick={() => { location.reload(true); }} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Mise a jour</button>
        {onLogout && <button onClick={onLogout} style={{ background: 'var(--a5)', border: '1px solid var(--a10)', color: 'var(--text-muted)', borderRadius: 'var(--r-md)', padding: '8px 16px', fontSize: 12, cursor: 'pointer', marginLeft: 'auto' }}>Se deconnecter</button>}
      </div>
    </div>
  );
}

// Phase 7.35 — Onglet "🔐 Mot de passe" accessible à TOUS les profils
// (admin et non-admin). Permet à chacun de changer SON PROPRE mot de
// passe sans dépendre de l'admin. Flow :
// 1. Saisir mot de passe actuel (vérification via verifyPassword).
// 2. Saisir nouveau mot de passe + confirmation (matche obligatoire).
// 3. Hash via hashPassword (SHA-256 + salt) avant stockage.
// L'admin reste libre de changer le password de n'importe quel profil
// via l'onglet "👥 Profils" (ProfilesAdmin).
function PasswordTab({ profile, onProfiles, activeProfileId, inp }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const hasPassword = !!profile?.password;

  const onSubmit = async () => {
    setErr(''); setSuccess(false);
    if (hasPassword) {
      if (!current) { setErr('Saisis ton mot de passe actuel pour confirmer.'); return; }
    }
    if (!next || next.length < 4) { setErr('Le nouveau mot de passe doit faire au moins 4 caractères.'); return; }
    if (next !== confirm) { setErr('Les deux saisies du nouveau mot de passe ne correspondent pas.'); return; }
    setSubmitting(true);
    try {
      if (hasPassword) {
        const ok = isPasswordLegacy(profile.password)
          ? profile.password === current
          : await verifyPassword(current, profile.password);
        if (!ok) { setErr('Mot de passe actuel incorrect.'); setSubmitting(false); return; }
      }
      const hashed = await hashPassword(next);
      onProfiles((p) => ({ ...p, [activeProfileId]: { ...p[activeProfileId], password: hashed, lastModified: Date.now() } }));
      setCurrent(''); setNext(''); setConfirm('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (e) {
      setErr('Erreur : ' + (e?.message || String(e)));
    }
    setSubmitting(false);
  };

  return <div>
    <div style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 12 }}>Change le mot de passe de TON profil ({profile.name}). Il te sera redemandé au prochain login sur un nouvel appareil.</div>
    <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 16, maxWidth: 480 }}>
      {hasPassword && <>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Mot de passe actuel</div>
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Mot de passe actuel" autoComplete="current-password" style={{ ...inp, width: '100%', marginBottom: 12 }}/>
      </>}
      {!hasPassword && <div style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '6px 10px', marginBottom: 12 }}>Ton profil n'a pas encore de mot de passe — saisis-en un nouveau.</div>}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Nouveau mot de passe</div>
      <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="4 caractères minimum" autoComplete="new-password" style={{ ...inp, width: '100%', marginBottom: 12 }}/>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Confirme le nouveau mot de passe</div>
      <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Resaisis le nouveau mot de passe" autoComplete="new-password" style={{ ...inp, width: '100%', marginBottom: 12 }}/>
      {err && <div style={{ fontSize: 11, color: 'var(--wine-400)', background: 'var(--a4)', border: '1px solid var(--wine-400)', borderRadius: 'var(--r-md)', padding: '6px 10px', marginBottom: 12 }}>{err}</div>}
      {success && <div style={{ fontSize: 11, color: 'var(--green)', background: 'var(--a4)', border: '1px solid var(--green)', borderRadius: 'var(--r-md)', padding: '6px 10px', marginBottom: 12 }}>✓ Mot de passe mis à jour avec succès.</div>}
      <button
        data-testid="password-change-submit"
        disabled={submitting}
        onClick={onSubmit}
        style={{ background: submitting ? 'var(--bg-disabled)' : 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}
      >{submitting ? 'En cours…' : 'Enregistrer le nouveau mot de passe'}</button>
    </div>
  </div>;
}

export default MonProfilScreen;
export { MonProfilScreen, PasswordTab };

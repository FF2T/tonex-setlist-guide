// src/app/screens/MonProfilScreen.jsx — Phase 7.19 (découpage main.jsx).
//
// Écran 👤 Mon profil — tabs visibles selon admin/non-admin et les
// devices activés du profil. Wrap tous les onglets-tabs (ProfileTab,
// MesAppareilsTab, ToneNetTab, BankEditor, TmpBrowser, etc.).
//
// MaintenanceTab reste dans main.jsx pour l'instant — passé via prop
// `MaintenanceTabComponent` pour éviter une dépendance circulaire le
// temps de la séparation.

import React, { useState, useEffect } from 'react';
import { SUPPORTED_LOCALES, setLocale, useLocale, t, tFormat, getLocale } from '../../i18n/index.js';
import { findDuplicateSong } from '../utils/song-helpers.js';
import { updateAiCache } from '../utils/ai-helpers.js';
import { fetchAI } from '../utils/fetchAI.js';
import { setSharedGeminiKey } from '../utils/shared-key.js';
import { hashPassword, verifyPassword, isPasswordLegacy } from '../../core/crypto-utils.js';
import { isTrusted, setTrusted } from '../../core/state.js';
import { resizeImageToDataUrl } from '../utils/image-resize.js';
import { buildFeedbackUrl } from '../../core/branding.js';
import { formatDateJJMMAA } from '../../core/date-utils.js';
import Breadcrumb from '../components/Breadcrumb.jsx';
import NavIcon from '../components/NavIcon.jsx';
import TabButton from '../components/TabButton.jsx';
import Button from '../components/Button.jsx';
import BankEditor from '../components/BankEditor.jsx';
import ProfileTab from './ProfileTab.jsx';
import MesAppareilsTab from './MesAppareilsTab.jsx';
import MyCustomPresetsTab from './MyCustomPresetsTab.jsx';
import PacksTab from './PacksTab.jsx';
// Phase 7.72 — ToneNetTab, AllUserPresetsTab, ProfilesAdmin, AdminPacksTab
// migrés dans src/app/screens/AdminScreen.jsx (écran admin séparé).
import ExportImportScreen from './ExportImportScreen.jsx';
import { InlineRenameInput } from './ListScreen.jsx';
import TmpBrowser from '../../devices/tonemaster-pro/Browser.jsx';
import { FACTORY_BANKS_PEDALE_V1, FACTORY_BANKS_PEDALE_V2 } from '../../devices/tonex-pedal/index.js';
import { FACTORY_BANKS_ANNIVERSARY } from '../../devices/tonex-anniversary/index.js';
import { FACTORY_BANKS_PLUG } from '../../devices/tonex-plug/index.js';

function MonProfilScreen({
  songDb, onSongDb, onAiCacheUpdate, setlists, allSetlists, onSetlists, onDeletedSetlistIds,
  banksAnn, onBanksAnn, banksPlug, onBanksPlug,
  banksOne, onBanksOne, banksOnePlus, onBanksOnePlus,
  onBack, onNavigate,
  aiProvider, onAiProvider, aiKeys, onAiKeys, theme, onTheme,
  profile, profiles, onProfiles, activeProfileId,
  allGuitars, allRigsGuitars, guitarBias,
  initTab, customGuitars, onCustomGuitars,
  toneNetPresets, onToneNetPresets,
  adminPacks, onAdminPacks,
  fullState, onImportState, onLogout,
  MaintenanceTabComponent, onSaveSharedKey,
  onSharedUsagesOverrides, // Phase 7.79.3b — propagé vers MesAppareilsTab → BankEditor
}) {
  const locale = useLocale();
  // Phase 7.73.2 — Rétrocompat initTab : les tabs 'display' et 'reco'
  // n'existent plus séparément, ils sont fusionnés dans 'preferences'.
  // Si un caller passe encore 'display' ou 'reco', on redirige.
  const normalizedInitTab = (() => {
    if (initTab === 'display' || initTab === 'reco') return 'preferences';
    // Phase 7.73.2 Session B — 'password' fusionné dans Mon compte
    if (initTab === 'password') return 'monCompte';
    // Réorg 2026-05-28 — 'sources' + 'custompacks' fusionnés dans 'devices'
    // (Mon matériel numérique).
    if (initTab === 'sources' || initTab === 'custompacks') return 'devices';
    return initTab;
  })();
  const [tab, setTab] = useState(normalizedInitTab || 'monCompte');
  const [newSlName, setNewSlName] = useState('');
  const [editSlId, setEditSlId] = useState(null);
  const [editSlName, setEditSlName] = useState('');
  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongArtist, setNewSongArtist] = useState('');
  const [newSongSlIds, setNewSongSlIds] = useState([]);
  const toggleNewSongSl = (id) => setNewSongSlIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const [expandedSongId, setExpandedSongId] = useState(null);
  const toggleSongInSetlist = (songId, slId) => onSetlists((p) => p.map((sl) => sl.id !== slId ? sl : { ...sl, songIds: sl.songIds.includes(songId) ? sl.songIds.filter((x) => x !== songId) : [...sl.songIds, songId] }));
  // v9.7.31 — Cowork audit P1 : padding élargi pour cibles tactiles ~44px.
  // v9.7.32 — Lot 4 polish iPad : maxWidth 480 sur inputs profil (sinon
  // s'étirent à 684px en iPad 834, formulaire désertique).
  const inp = { background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-md)', padding: '10px 12px', fontSize: 13, boxSizing: 'border-box', minHeight: 44, maxWidth: 480 };
  // Réorg 2026-05-29 — instrument(s) du profil pilotés depuis Préférences.
  // Gate les onglets "Mes guitares" / "Mes basses". ≥1 instrument requis.
  const instruments = Array.isArray(profile?.instruments) && profile.instruments.length > 0 ? profile.instruments : ['guitar'];
  const playsGuitar = instruments.includes('guitar');
  const playsBass = instruments.includes('bass');
  const toggleInstrument = (instr) => {
    onProfiles((p) => {
      const cur = p[activeProfileId]; if (!cur) return p;
      const list = Array.isArray(cur.instruments) && cur.instruments.length > 0 ? cur.instruments : ['guitar'];
      let next;
      if (list.includes(instr)) {
        if (list.length <= 1) return p; // garde-fou : ≥1 instrument
        next = list.filter((x) => x !== instr);
      } else {
        next = instr === 'guitar' ? ['guitar', ...list.filter((x) => x !== 'guitar')] : [...list, instr];
      }
      return { ...p, [activeProfileId]: { ...cur, instruments: next, lastModified: Date.now() } };
    });
  };
  // Garde-fou : si l'onglet actif devient masqué (instrument décoché), retombe
  // sur Préférences (où se fait le choix d'instrument).
  useEffect(() => {
    if (tab === 'profile' && !playsGuitar) setTab('preferences');
    else if (tab === 'basses' && !playsBass) setTab('preferences');
  }, [tab, playsGuitar, playsBass]);
  // Vague 3 UX (2026-05-28) — composant TabButton partagé (taille/style
  // unifiés avec AdminScreen).
  const tabBtn = (id, label, iconId) => (
    <TabButton active={tab === id} label={label} iconId={iconId} onClick={() => setTab(id)}/>
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
    if (isDemo) return; // Phase 7.51.2 — pas de fetchAI ni add en mode démo
    const ns = { id: `c_${Date.now()}`, title, artist, isCustom: true, ig: [], aiCache: null };
    onSongDb((p) => [...p, ns]);
    if (newSongSlIds.length > 0) onSetlists((p) => p.map((sl) => newSongSlIds.includes(sl.id) ? { ...sl, songIds: [...sl.songIds, ns.id] } : sl));
    fetchAI(ns, '', banksAnn, banksPlug, aiProvider, aiKeys, allGuitars, null, null, profile?.recoMode || 'balanced', guitarBias, ns.outputContext || profile?.outputContext || 'frfr', profile?.preferredStyles || [])
      // Phase 7.54 — Écrit dans profile.aiCache
      .then((r) => {
        const value = updateAiCache(null, '', r);
        if (onAiCacheUpdate) onAiCacheUpdate(ns.id, value);
        else onSongDb((p) => p.map((x) => x.id === ns.id ? { ...x, aiCache: value } : x));
      })
      .catch(() => {});
    setNewSongTitle(''); setNewSongArtist(''); setNewSongSlIds([]);
  };
  const deleteSongFromDb = (id) => {
    const s = songDb.find((x) => x.id === id);
    if (!s) return;
    if (!window.confirm(`Supprimer "${s.title}" (${s.artist}) de la base ?\nLe morceau sera retiré de toutes les setlists.`)) return;
    onSongDb((p) => p.filter((x) => x.id !== id)); onSetlists((p) => p.map((sl) => ({ ...sl, songIds: sl.songIds.filter((x) => x !== id) })));
  };

  // Phase 7.51.2 — Mode démo : seul le tab "Affichage" (theme + locale)
  // est exposé. Les autres tabs sont des writes et sont cachés.
  const isDemo = profile?.isDemo === true;

  return (
    <div>
      <Breadcrumb crumbs={[{ label: t('common.home', 'Accueil'), screen: 'list' }, { label: t('profile.title-short', 'Mon profil') }]} onNavigate={onNavigate}/>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><NavIcon id="user" size={20}/>{t('profile.title-flat', 'Mon profil')}</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* Phase 7.73.2 Session B — Tab "👤 Mon compte" en premier.
            Regroupe Identité + Sécurité (migration PasswordTab) + Mes
            données (export/import perso). Le tab "🔐 Mot de passe"
            séparé est retiré (migré dans Sécurité de Mon compte). */}
        {!isDemo && tabBtn('monCompte', t('profile.tab.mon-compte-flat', 'Mon compte'), 'user')}
        {/* Phase 7.73.2 — Renommages "Guitares" → "Mes guitares" /
            "Sources" → "Mes sources" pour cohérence avec "Mes appareils"
            / "Mes presets custom". */}
        {/* Réorg 2026-05-29 — onglets instruments gatés par profile.instruments
            (choix dans Préférences → Instrument(s)). */}
        {!isDemo && playsGuitar && tabBtn('profile', t('profile.tab.guitars-flat', 'Mes guitares'), 'guitar')}
        {!isDemo && playsBass && tabBtn('basses', t('profile.tab.basses-flat', 'Mes basses'), 'bass')}
        {/* Réorg 2026-05-28 — "Mes amplis & pédales" : tout l'analogique
            (amplis guitare + basse + pédales Phase C), sorti des onglets
            instruments. */}
        {!isDemo && tabBtn('ampsPedals', t('profile.tab.amps-pedals-flat', 'Mes amplis & pédales'), 'amp')}
        {/* Réorg 2026-05-28 — "Mon matériel numérique" : ToneX + TMP + banks
            + sources + presets custom (= ancien "Mes appareils" + absorbe
            sources/custompacks). */}
        {!isDemo && tabBtn('devices', t('profile.tab.devices-flat', 'Mon matériel numérique'), 'device')}
        {/* Phase 7.72 — Tab ToneNET migré dans l'écran Admin séparé.
            Accessible via le bouton "⚙️ Admin" dans la nav. */}
        {/* Phase 7.75 — Tabs pedale/ann/plug/tmp consolidés dans Mes
            appareils (sections collapsables par device activé). */}
        {/* Phase 7.73.2 — Tabs "🎨 Affichage" + "🎯 Préférences IA"
            fusionnés dans le nouveau tab "⚙️ Préférences" (3 sous-
            sections : Affichage + Préférences IA + Préférences musicales). */}
        {tabBtn('preferences', t('profile.tab.preferences-flat', 'Préférences'), 'admin')}
        {/* Phase 7.73.2 Session B — Tab "🔐 Mot de passe" retiré
            (migré dans Mon compte → 🔐 Sécurité). */}
        {/* Phase 7.72 — Tabs Clé API + Maintenance migrés dans Admin séparé. */}
        {/* Phase 7.67 — Export/Import ouvert aux non-admins. Les setters
            onBanksAnn/onBanksPlug écrivent dans profile.banksAnn/banksPlug
            du profil actif (per-profile, pas cross-profil). Modale preview
            ajoutée dans ExportImportScreen avant l'overwrite. */}
        {/* Phase 7.73.1 — Tab "📋 Export / Import" supprimé.
            Import/Export CSV intégré directement dans les onglets device
            (pedale/ann/plug). Le JSON full state admin reste accessible
            via ⚙️ Admin → Maintenance. */}
        {/* Phase 7.72 — Tabs Profils + AllUserPresets + AdminPacks
            migrés dans Admin séparé (cf bouton ⚙️ Admin dans la nav). */}
      </div>
      {/* Phase 7.73.2 Session B — Tab "👤 Mon compte" (premier tab,
          défaut). 3 sections empilées avec séparateurs <hr/> :
          1. 👤 Identité (avatar + nom + bio + email + badges)
          2. 🔐 Sécurité (PasswordTab + trusted devices)
          3. 💾 Mes données (export/import perso + reset) */}
      {tab === 'monCompte' && (
        <MonCompteSection
          profile={profile}
          profiles={profiles}
          onProfiles={onProfiles}
          activeProfileId={activeProfileId}
          setlists={setlists}
          songDb={songDb}
          onSongDb={onSongDb}
          onSetlists={onSetlists}
          banksAnn={banksAnn}
          onBanksAnn={onBanksAnn}
          banksPlug={banksPlug}
          onBanksPlug={onBanksPlug}
          toneNetPresets={toneNetPresets}
          customGuitars={customGuitars}
          onLogout={onLogout}
          inp={inp}
        />
      )}
      {tab === 'profile' && <ProfileTab profile={profile} profiles={profiles} onProfiles={onProfiles} activeProfileId={activeProfileId} inp={inp} section="guitars" aiKeys={aiKeys} customGuitars={customGuitars} onCustomGuitars={onCustomGuitars}/>}
      {tab === 'basses' && <ProfileTab profile={profile} profiles={profiles} onProfiles={onProfiles} activeProfileId={activeProfileId} inp={inp} section="basses"/>}
      {/* Réorg 2026-05-28 — Onglet "Mes amplis & pédales" (analogique). */}
      {tab === 'ampsPedals' && <ProfileTab profile={profile} profiles={profiles} onProfiles={onProfiles} activeProfileId={activeProfileId} inp={inp} section="ampsPedals" aiKeys={aiKeys}/>}
      {/* Réorg 2026-05-28 — Onglet "Mon matériel numérique" : empile
          appareils ToneX/TMP + banks + sources + presets custom. */}
      {tab === 'devices' && <>
        <MesAppareilsTab profile={profile} profiles={profiles} onProfiles={onProfiles} activeProfileId={activeProfileId} banksAnn={banksAnn} onBanksAnn={onBanksAnn} banksPlug={banksPlug} onBanksPlug={onBanksPlug} banksOne={banksOne} onBanksOne={onBanksOne} banksOnePlus={banksOnePlus} onBanksOnePlus={onBanksOnePlus} toneNetPresets={toneNetPresets} onToneNetPresets={onToneNetPresets} songDb={songDb} fullState={fullState} onImportState={onImportState} onNavigate={onNavigate} onSharedUsagesOverrides={onSharedUsagesOverrides}/>
        <ProfileTab profile={profile} profiles={profiles} onProfiles={onProfiles} activeProfileId={activeProfileId} inp={inp} section="sources"/>
        <MyCustomPresetsTab profile={profile} onProfiles={onProfiles} activeProfileId={activeProfileId} songDb={songDb} inp={inp}/>
      </>}
      {/* Phase 7.72 — Tabs AllUserPresets + AdminPacks migrés dans AdminScreen. */}
      {/* Phase 7.72 — Rendus admin migrés dans AdminScreen.jsx */}
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
                <button title={t('list.rename-setlist', 'Renommer la setlist')} onClick={() => { setEditSlId(sl.id); setEditSlName(sl.name); }} style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '4px 8px', fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}><NavIcon id="pen" size={14}/></button>
                {setlists.length > 1 && <button title={t('list.delete-setlist', 'Supprimer la setlist')} onClick={() => deleteSetlist(sl.id)} style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', borderRadius: 'var(--r-md)', padding: '4px 8px', fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}><NavIcon id="trash" size={14}/></button>}
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
      {tab === 'preferences' && <div>
        <div style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 16 }}>{t('preferences.intro', 'Tes préférences d\'utilisation de l\'app.')}</div>

        {/* Réorg 2026-05-29 — Section 0 : Instrument(s). Choix de haut niveau
            (guitare / basse / les deux) qui active les onglets + recommandations
            correspondants. La basse peut être l'unique instrument. */}
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 4, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{t('preferences.section-instruments', 'Instrument(s)')}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>{t('preferences.instruments-hint', 'Sélectionne le(s) instrument(s) que tu joues — ça active les onglets et recommandations correspondants. Au moins un requis.')}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[
            { id: 'guitar', label: t('play-context.instrument-guitar', 'Guitare'), icon: 'guitar', on: playsGuitar },
            { id: 'bass', label: t('play-context.instrument-bass', 'Basse'), icon: 'bass', on: playsBass },
          ].map(({ id, label, icon, on }) => (
            <button key={id} data-testid={`pref-instrument-${id}`}
              onClick={() => { if (!isDemo) toggleInstrument(id); }}
              disabled={isDemo}
              title={isDemo ? t('demo.blocked', 'Action désactivée en mode démo') : undefined}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: on ? 'var(--accent-bg)' : 'var(--a5)', border: on ? '1px solid var(--border-accent)' : '1px solid var(--a10)', color: on ? 'var(--accent)' : 'var(--text-sec)', borderRadius: 'var(--r-lg)', padding: '14px 8px', fontSize: 14, fontWeight: 700, cursor: isDemo ? 'not-allowed' : 'pointer', opacity: isDemo ? 0.5 : 1, whiteSpace: 'nowrap' }}>
              <div style={{ width: 18, height: 18, borderRadius: 'var(--r-sm)', border: on ? '2px solid var(--accent)' : '2px solid var(--text-muted)', background: on ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{on && <span style={{ color: 'var(--text-inverse)', fontSize: 10, fontWeight: 900 }}>✓</span>}</div>
              <NavIcon id={icon} size={16}/>{label}
            </button>
          ))}
        </div>

        {/* Phase 7.73.2 — Section 1 : Affichage (ex-tab "display" Phase 7.36) */}
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 4, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{t('preferences.section-display', 'Affichage')}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>{t('profile.display.intro', 'Apparence de l\'application.')}</div>
        <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>{t('profile.display.theme', 'Thème')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ v: 'dark', label: t('profile.display.theme-dark', 'Sombre'), desc: t('profile.display.theme-dark-desc', 'Fond sombre') }, { v: 'light', label: t('profile.display.theme-light', 'Clair'), desc: t('profile.display.theme-light-desc', 'Fond clair') }].map(({ v, label, desc }) => (
              <button key={v} onClick={() => onTheme(v)} style={{ flex: 1, background: theme === v ? 'var(--accent-bg)' : 'var(--a5)', border: theme === v ? '1px solid var(--border-accent)' : '1px solid var(--a10)', color: theme === v ? 'var(--accent)' : 'var(--text-sec)', borderRadius: 'var(--r-lg)', padding: '14px 8px', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'center', whiteSpace: 'nowrap' }}>
                <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap' }}>{desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{t('profile.display.language', 'Langue')}</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.5 }}>{t('profile.display.language-hint', 'L\'interface est encore majoritairement en français. Les traductions sont en cours de déploiement progressif.')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {SUPPORTED_LOCALES.map(({ id, label }) => {
              const active = locale === id;
              return <button
                key={id}
                data-testid={`locale-${id}`}
                onClick={() => { setLocale(id); }}
                style={{ flex: 1, background: active ? 'var(--accent-bg)' : 'var(--a5)', border: active ? '1px solid var(--border-accent)' : '1px solid var(--a10)', color: active ? 'var(--accent)' : 'var(--text-sec)', borderRadius: 'var(--r-lg)', padding: '14px 8px', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'center', whiteSpace: 'nowrap' }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</div>
              </button>;
            })}
          </div>
        </div>

        {/* Phase 7.73.2 — Section 2 : Préférences IA (ex-tab "reco" Phase 7.1) */}
        <hr style={{ border: 'none', borderTop: '1px solid var(--a10)', margin: '20px 0 16px 0' }} />
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 4, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{t('preferences.section-ai', 'Préférences IA')}</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 12 }}>{t('profile.reco.intro', 'Comment l\'IA propose les recommandations.')}</div>
        {/* Phase 7.83 demo-gating — wrap section IA en mode démo (pointer-events none + opacity).
            Le user voit ses préférences mais ne peut pas les modifier. */}
        <div style={{ opacity: isDemo ? 0.5 : 1, pointerEvents: isDemo ? 'none' : 'auto' }} title={isDemo ? t('demo.blocked', 'Action désactivée en mode démo') : undefined} aria-disabled={isDemo ? 'true' : undefined}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {[
            { id: 'balanced', label: t('profile.reco.balanced-label', 'Équilibré (défaut)'), desc: t('profile.reco.balanced-desc', 'Mélange fidélité au morceau original et versatilité du rig. Comportement actuel.') },
            { id: 'faithful', label: t('profile.reco.faithful-label', 'Fidèle à l\'original'), desc: t('profile.reco.faithful-desc', 'L\'IA privilégie la guitare/ampli/effets exacts utilisés sur l\'enregistrement original. Reco proche du son du disque.') },
            { id: 'interpretation', label: t('profile.reco.interpretation-label', 'Interprétation libre'), desc: t('profile.reco.interpretation-desc', 'L\'IA privilégie les guitares versatiles (ES-335, SG, Strat) qui couvrent bien le style, même si ce n\'est pas l\'instrument original. Pratique si tu as un rig limité.') },
          ].map(({ id, label, desc }) => {
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
                  <span>{label}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>{desc}</div>
              </div>
            </button>;
          })}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.5, marginBottom: 16 }}>{t('profile.reco.mode-hint', 'Ce mode est passé en input à chaque appel IA. Les morceaux déjà analysés gardent leur cache jusqu\'à invalidation.')}</div>

        {/* Phase 10 — Contexte d'écoute (output audio). Dicte cab_enabled
            au prompt IA Phase 9.1 + adapte les recos selon le matériel
            d'écoute (casque / FRFR / sono / ampli avec ou sans cab). */}
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 4, marginBottom: 6 }}>{t('profile.output-context.title-flat', 'Contexte d\'écoute')}</div>
        <div style={{ fontSize: 12, color: 'var(--text-sec)', marginBottom: 10, lineHeight: 1.5 }}>{t('profile.output-context.intro', 'Sur quel matériel tu joues le plus souvent. Affecte les conseils d\'EQ et de volume de l\'IA selon le rendu attendu.')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {[
            { id: 'frfr', label: t('output-context.label.frfr', 'Enceinte FRFR'), desc: t('output-context.desc.frfr', 'Enceinte neutre alimentée (Headrush, Friedman ASM, Powercab+, ToneX Cab…). Restitution fidèle de la capture.') },
            { id: 'headphone', label: t('output-context.label.headphone', 'Casque'), desc: t('output-context.desc.headphone', 'Jeu silencieux via la sortie casque de la pédale. L\'IA peut moduler les aigus pour le confort d\'écoute.') },
            { id: 'pa', label: t('output-context.label.pa', 'Sono / Table de mixage'), desc: t('output-context.desc.pa', 'Sortie directe via DI vers PA, table ou monitors studio. Le mixeur attend un signal prêt à mixer.') },
          ].map(({ id, label, desc }) => {
            const active = (profile.outputContext || 'frfr') === id;
            return <button
              key={id}
              data-testid={`output-context-${id}`}
              onClick={() => {
                onProfiles((p) => ({ ...p, [activeProfileId]: { ...p[activeProfileId], outputContext: id, lastModified: Date.now() } }));
              }}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: active ? 'var(--accent-bg)' : 'var(--a3)', border: active ? '1px solid var(--accent-border)' : '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '12px 14px', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ width: 18, height: 18, borderRadius: '50%', border: active ? '2px solid var(--accent)' : '2px solid var(--text-muted)', background: active ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>{active && <span style={{ color: 'var(--bg)', fontSize: 11, fontWeight: 900 }}>✓</span>}</div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 13, color: active ? 'var(--text)' : 'var(--text-muted)', fontWeight: active ? 700 : 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{label}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>{desc}</div>
              </div>
            </button>;
          })}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.5, marginBottom: 16 }}>{t('profile.output-context.hint-flat', 'Tu peux aussi forcer un autre contexte par morceau depuis la fiche song. Changer ici n\'invalide pas les caches existants — utilise "Réinitialiser mes analyses" pour regenerer. Le toggle CAB ON/OFF de la pédale est décidé par l\'IA selon la capture choisie, pas par ce paramètre.')}</div>

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
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4 }}>L'IA apprend tes préférences depuis tes feedbacks (auto, dès 3 morceaux feedbackés). Tu peux forcer un choix manuel (gagne sur l'auto). Soft hint dans le prompt, l'IA reste libre.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {BIAS_STYLES.map(({ id, label }) => {
                const effective = guitarBias && guitarBias[id];
                const manualId = manualMap[id] || '';
                return <div key={id} data-testid={`bias-row-${id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'var(--a6)', borderRadius: 'var(--r-md)', padding: '6px 10px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5, minWidth: 70 }}>{label}</span>
                    {effective
                      ? <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 'var(--r-sm)', background: effective.source === 'manual' ? 'var(--accent-bg)' : 'var(--a8)', color: effective.source === 'manual' ? 'var(--accent)' : 'var(--text-sec)', fontWeight: 600 }}>
                        {effective.source === 'manual' ? t('profile.bias-manual', 'manuel') : tFormat('profile.bias-auto', { count: effective.count }, 'auto · {count} fb')}
                      </span>
                      : <span style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>aucune</span>
                    }
                    {effective && <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 500 }}>{effective.guitarName}</span>}
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
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4 }}>Invalide les caches IA UNIQUEMENT pour les morceaux de tes setlists ({myCount} morceau{myCount > 1 ? 'x' : ''} concerné{myCount > 1 ? 's' : ''}). Pratique pour forcer une ré-analyse après un changement de banks, de sources ou de mode reco. Au prochain ouverture (ou via "Analyser/MAJ" en Setlists), une nouvelle analyse sera lancée.</div>
              <Button
                testId="reco-invalidate-mine"
                variant="primary"
                disabled={myCount === 0}
                onClick={() => {
                  if (!myCount) { window.alert('Aucun cache IA à invalider sur tes morceaux.'); return; }
                  if (!window.confirm(`Invalider ${myCount} cache${myCount > 1 ? 's' : ''} IA sur tes morceaux ?\n\nMode actuel : ${profile.recoMode || 'balanced'}.\n\nLes morceaux seront re-analysés à la demande.\n\nCela consomme du quota Gemini quand les re-analyses tournent (batch parallèle ~33s par vague de 5).`)) return;
                  // Phase 7.54 — Wipe profile.aiCache pour mes songs uniquement.
                  // Reset les entries dans profile.aiCache du profil actif.
                  // Aussi reset shared.aiCache (rétro-compat avec songs pre-v10).
                  onProfiles((p) => {
                    const cur = p[activeProfileId];
                    if (!cur) return p;
                    const prevCache = cur.aiCache || {};
                    const nextCache = { ...prevCache };
                    mySongIds.forEach((id) => { delete nextCache[id]; });
                    return { ...p, [activeProfileId]: { ...cur, aiCache: nextCache, lastModified: Date.now() } };
                  });
                  onSongDb((p) => p.map((s) => (mySongIds.has(s.id) && s.aiCache) ? { ...s, aiCache: null } : s));
                  window.alert(`${myCount} cache${myCount > 1 ? 's' : ''} invalidé${myCount > 1 ? 's' : ''}. Va dans Setlists et clique "Analyser/MAJ".`);
                }}
              >{tFormat('profile.reset-my-analyses', { count: myCount }, 'Réinitialiser mes analyses ({count})')}</Button>
            </div>
          );
        })()}
        {profile.isAdmin && <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Appliquer le mode à toute la base (admin)</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4 }}>Invalide TOUS les caches IA — y compris les morceaux des autres profils. À utiliser après un changement structurel (prompt, scoring) qui affecte tous les profils.</div>
          <Button
            testId="reco-invalidate-all"
            variant="danger"
            onClick={() => {
              const n = (songDb || []).filter((s) => s.aiCache).length;
              if (!n) { window.alert('Aucun cache IA à invalider.'); return; }
              if (!window.confirm(`Invalider ${n} cache${n > 1 ? 's' : ''} IA (TOUS profils) ?\n\nMode actuel : ${profile.recoMode || 'balanced'}.\n\nLes morceaux seront re-analysés à la demande (ouverture ou bouton "Analyser/MAJ" en setlists).\n\nCela consomme du quota Gemini quand les re-analyses tournent (batch parallèle ~33s par vague de 5).`)) return;
              // Phase 7.54 — Wipe TOUS les profile.aiCache + shared.songDb.aiCache.
              onProfiles((p) => {
                const out = {};
                for (const [id, pr] of Object.entries(p)) {
                  out[id] = { ...pr, aiCache: {}, lastModified: Date.now() };
                }
                return out;
              });
              onSongDb((p) => p.map((s) => s.aiCache ? { ...s, aiCache: null } : s));
              window.alert(`${n} caches invalidés. Reviens dans Setlists et clique "Analyser/MAJ".`);
            }}
          >{t('profile.invalidate-all-caches', 'Invalider tous les caches IA')}</Button>
        </div>}
        </div>{/* fin wrap demo-gating section IA */}

        {/* Phase 7.73.2 — Section 3 : Préférences musicales (NOUVEAU).
            Multi-select des styles préférés du user. Soft hint orientatif
            pour les recommandations IA (pas de logique de scoring encore
            câblée — Phase 7.73.2.1 future si signal user). Stocké dans
            profile.preferredStyles: string[]. Additif, pas STATE_VERSION. */}
        <hr style={{ border: 'none', borderTop: '1px solid var(--a10)', margin: '20px 0 16px 0' }} />
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 4, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{t('preferences.section-musical-styles', 'Préférences musicales')}</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 12 }}>{t('preferences.musical-styles-intro', 'Styles que tu joues le plus souvent. Sert d\'indication contextuelle pour l\'IA.')}</div>
        <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 14, marginBottom: 16, opacity: isDemo ? 0.5 : 1, pointerEvents: isDemo ? 'none' : 'auto' }} title={isDemo ? t('demo.blocked', 'Action désactivée en mode démo') : undefined} aria-disabled={isDemo ? 'true' : undefined}>
          {(() => {
            const STYLES = [
              { id: 'blues', label: t('preferences.musical-styles.blues', 'Blues') },
              { id: 'rock', label: t('preferences.musical-styles.rock', 'Rock') },
              { id: 'hard_rock', label: t('preferences.musical-styles.hard-rock', 'Hard rock') },
              { id: 'jazz', label: t('preferences.musical-styles.jazz', 'Jazz') },
              { id: 'metal', label: t('preferences.musical-styles.metal', 'Metal') },
              { id: 'pop', label: t('preferences.musical-styles.pop', 'Pop') },
            ];
            const selected = Array.isArray(profile.preferredStyles) ? profile.preferredStyles : [];
            const toggleStyle = (id) => {
              onProfiles((p) => {
                const cur = p[activeProfileId]; if (!cur) return p;
                const prev = Array.isArray(cur.preferredStyles) ? cur.preferredStyles : [];
                const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
                return { ...p, [activeProfileId]: { ...cur, preferredStyles: next, lastModified: Date.now() } };
              });
            };
            return (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {STYLES.map(({ id, label }) => {
                  const active = selected.includes(id);
                  return (
                    <button
                      key={id}
                      data-testid={`musical-style-${id}`}
                      onClick={() => toggleStyle(id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: active ? 'var(--accent-bg)' : 'var(--a5)',
                        border: active ? '1px solid var(--border-accent)' : '1px solid var(--a10)',
                        color: active ? 'var(--accent)' : 'var(--text-sec)',
                        borderRadius: 'var(--r-md)', padding: '8px 14px',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      <span>{label}</span>
                      {active && <span style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 900 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            );
          })()}
          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.5, marginTop: 10 }}>{t('preferences.musical-styles-hint', 'Tu peux sélectionner plusieurs styles. Information indicative pour l\'IA, pas de filtre strict.')}</div>
        </div>
      </div>}
      {/* Phase 7.72 — Tabs Clé API + Maintenance migrés dans AdminScreen.
          Phase 7.73.1 — Tab Export/Import inline retiré (CSV par device
          via DeviceCSVPanel ci-dessus dans les tabs pedale/ann/plug). */}
      {/* Phase 7.72 — Tab Profils migré dans AdminScreen. */}
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--a8)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Phase 7.85 — Footer liens : padding 10x4 + minHeight 44 iOS HIG
            (Cowork B15 P1 : "Aide" 26×15, "Envoyer un feedback" 120×15,
            "Mise à jour" 62×15 = micro-cibles sous seuil touch). */}
        <button onClick={() => { if (typeof window.setShowOnboarding === 'function') window.setShowOnboarding(true); else { const e = new CustomEvent('showOnboarding'); window.dispatchEvent(e); } }} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: '10px 12px', minHeight: 44, minWidth: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{t('profile.footer-help', 'Aide')}</button>
        {/* Phase 7.73.0 — Bouton feedback Tally. Pré-rempli avec
            profile_name + app_version. Ouvre dans un nouvel onglet. */}
        <a
          href={buildFeedbackUrl(profile?.name, (typeof window !== 'undefined' && window.__BACKLINE_APP_VERSION) || '')}
          target="_blank"
          rel="noopener noreferrer"
          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: '10px 6px', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
        >{t('profile.footer-feedback-flat', 'Envoyer un feedback')}</a>
        <button onClick={() => { location.reload(true); }} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: '10px 6px', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>{t('profile.footer-update', 'Mise à jour')}</button>
        {onLogout && <button onClick={onLogout} style={{ background: 'var(--a5)', border: '1px solid var(--a10)', color: 'var(--text-muted)', borderRadius: 'var(--r-md)', padding: '12px 18px', fontSize: 13, cursor: 'pointer', marginLeft: 'auto', minHeight: 44 }}>{t('profile.footer-logout', 'Se déconnecter')}</button>}
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
    <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 16, maxWidth: 480, width: '100%', boxSizing: 'border-box' }}>
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
      {success && <div style={{ fontSize: 11, color: 'var(--green)', background: 'var(--a4)', border: '1px solid var(--green)', borderRadius: 'var(--r-md)', padding: '6px 10px', marginBottom: 12 }}>Mot de passe mis à jour avec succès.</div>}
      <button
        data-testid="password-change-submit"
        disabled={submitting}
        onClick={onSubmit}
        style={{ background: submitting ? 'var(--bg-disabled)' : 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '12px 18px', fontSize: 13, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1, minHeight: 44 }}
      >{submitting ? 'En cours…' : 'Enregistrer le nouveau mot de passe'}</button>
    </div>

    {/* Phase 7.63 — Historique de connexion. Affiche les 5 dernières
        entries du loginHistory. Entries au format number = login normal.
        Entries au format {type:'admin_switch',ts,adminId,adminName} =
        accès admin (Phase 7.63, transparence beta-testeur).
        Le beta-testeur (non-admin) voit ici si Sébastien (ou un autre
        admin) a accédé à son profil. */}
    {Array.isArray(profile?.loginHistory) && profile.loginHistory.length > 0 && (
      <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 16, maxWidth: 480, width: '100%', boxSizing: 'border-box', marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{t('password.history-title', 'Historique de connexion')}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{t('password.history-hint-flat', 'Les 5 derniers événements sur ton profil. Les entrées en mode admin indiquent un accès admin (un autre profil avec droits admin a switché sur le tien).')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {profile.loginHistory.slice(0, 5).map((entry, i) => {
            if (typeof entry === 'number') {
              return (
                <div key={i} style={{ fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.6 }}>
                  {new Date(entry).toLocaleString(getLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              );
            }
            if (entry && entry.type === 'admin_switch') {
              const dt = new Date(entry.ts).toLocaleString(getLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
              return (
                <div key={i} style={{ fontSize: 11, color: 'var(--copper-300, #d97a3a)', lineHeight: 1.6, fontWeight: 600 }} title={t('password.admin-switch-title', 'Un admin a accédé à ton profil')}>
                  {entry.adminName || entry.adminId} <span style={{ color: 'var(--text-muted)' }}>({t('password.admin-mode', 'mode admin')}) · {dt}</span>
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    )}
  </div>;
}

// Phase 7.73.2 Session B (2026-05-23) — Composant MonCompteSection
// regroupe 3 sections empilées dans le nouveau tab "👤 Mon compte" :
//
// 1. 👤 Identité (avatar + nom + bio + email + badges read-only)
// 2. 🔐 Sécurité (PasswordTab existant + trusted devices)
// 3. 💾 Mes données (export/import perso + reset profil)
//
// Avatar upload via image-resize.js Phase 7.29.9 (data-URL JPEG ~30 KB).
// Trusted devices : statut local du profil sur CE device, bouton
// "Révoquer" via setTrusted(id, false) + reload.
// Sections séparées par <hr/> avec headers fontSize 14.
function MonCompteSection({
  profile, onProfiles, activeProfileId, profiles,
  setlists, songDb, onSongDb, onSetlists,
  banksAnn, onBanksAnn, banksPlug, onBanksPlug,
  toneNetPresets, customGuitars,
  onLogout, inp,
}) {
  // Section 👤 Identité — édition inline name + bio + email + avatar
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile?.name || '');
  const [bioDraft, setBioDraft] = useState(profile?.bio || '');
  const [emailDraft, setEmailDraft] = useState(profile?.email || '');
  const [avatarErr, setAvatarErr] = useState('');

  const saveName = () => {
    const n = nameDraft.trim();
    if (!n) { setEditingName(false); setNameDraft(profile?.name || ''); return; }
    if (n === profile?.name) { setEditingName(false); return; }
    onProfiles((p) => ({ ...p, [activeProfileId]: { ...p[activeProfileId], name: n, lastModified: Date.now() } }));
    setEditingName(false);
  };
  const cancelName = () => { setEditingName(false); setNameDraft(profile?.name || ''); };

  const saveBio = () => {
    const b = bioDraft.trim();
    if (b === (profile?.bio || '')) return;
    onProfiles((p) => ({ ...p, [activeProfileId]: { ...p[activeProfileId], bio: b || undefined, lastModified: Date.now() } }));
  };
  const saveEmail = () => {
    const e = emailDraft.trim();
    if (e === (profile?.email || '')) return;
    onProfiles((p) => ({ ...p, [activeProfileId]: { ...p[activeProfileId], email: e || undefined, lastModified: Date.now() } }));
  };

  const onAvatarUpload = async (e) => {
    setAvatarErr('');
    const file = e?.target?.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith('image/')) { setAvatarErr(t('mon-compte.avatar-err-type', 'Format non supporté (image attendue).')); return; }
    if (file.size > 5 * 1024 * 1024) { setAvatarErr(t('mon-compte.avatar-err-size', 'Image trop grosse (max 5 MB avant resize).')); return; }
    try {
      const dataUrl = await resizeImageToDataUrl(file, 240, 0.85);
      onProfiles((p) => ({ ...p, [activeProfileId]: { ...p[activeProfileId], avatar: dataUrl, lastModified: Date.now() } }));
    } catch (err) {
      setAvatarErr(t('mon-compte.avatar-err-resize', 'Erreur lors du resize : ') + (err?.message || String(err)));
    }
    // Reset l'input file pour permettre de re-uploader la même image
    if (e?.target) e.target.value = '';
  };
  const removeAvatar = () => {
    if (!profile?.avatar) return;
    if (!window.confirm(t('mon-compte.avatar-remove-confirm', 'Retirer ton avatar ?'))) return;
    onProfiles((p) => ({ ...p, [activeProfileId]: { ...p[activeProfileId], avatar: undefined, lastModified: Date.now() } }));
  };

  // Section 🔐 Sécurité — trusted devices
  const trusted = isTrusted(activeProfileId);
  const revokeTrusted = () => {
    if (!window.confirm(t('mon-compte.trusted-revoke-confirm', 'Révoquer la confiance de cet appareil ?\nTu devras retaper ton mot de passe à la prochaine connexion sur cet appareil.'))) return;
    setTrusted(activeProfileId, false);
    window.alert(t('mon-compte.trusted-revoke-done-flat', 'Confiance révoquée pour cet appareil.'));
  };

  // Section 💾 Mes données — export perso filtré par profil
  const exportMyData = () => {
    const mySetlists = (setlists || []).filter((sl) => Array.isArray(sl.profileIds) && sl.profileIds.includes(activeProfileId));
    const mySongIds = new Set();
    mySetlists.forEach((sl) => (sl.songIds || []).forEach((id) => mySongIds.add(id)));
    const mySongs = (songDb || []).filter((s) => mySongIds.has(s.id));
    const payload = {
      version: 'mon-compte-export-v1',
      exported: new Date().toISOString(),
      profileId: activeProfileId,
      profile: { ...profile },
      setlists: mySetlists,
      songs: mySongs,
      banksAnn: banksAnn || {},
      banksPlug: banksPlug || {},
      toneNetPresets: toneNetPresets || [],
      customGuitars: customGuitars || [],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backline_${(profile?.name || activeProfileId).replace(/\s+/g, '_')}_${formatDateJJMMAA()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetMyProfile = () => {
    const confirmTxt = t('mon-compte.reset-confirm', 'Réinitialiser ton profil ?\n\nCela vide :\n- Tes guitares custom\n- Tes presets custom\n- Tes banks (Anniversary + Plug)\n- Tes setlists\n- Ton historique IA\n\nGardé :\n- Ton nom + email + bio + avatar\n- Ton mot de passe\n- Ton historique de connexion\n\nIrréversible.');
    if (!window.confirm(confirmTxt)) return;
    onProfiles((p) => {
      const cur = p[activeProfileId]; if (!cur) return p;
      return {
        ...p,
        [activeProfileId]: {
          ...cur,
          myGuitars: [],
          customGuitars: [],
          editedGuitars: {},
          banksAnn: {},
          banksPlug: {},
          customPacks: [],
          aiCache: {},
          guitarBias: {},
          preferredStyles: [],
          lastModified: Date.now(),
        },
      };
    });
    onSetlists((p) => (p || []).filter((sl) => !(Array.isArray(sl.profileIds) && sl.profileIds.includes(activeProfileId) && sl.profileIds.length === 1)));
    window.alert(t('mon-compte.reset-done-flat', 'Profil réinitialisé.'));
  };

  // Badges read-only
  const badges = [];
  if (profile?.isAdmin) badges.push({ icon: '★', label: t('mon-compte.badge-admin', 'ADMIN'), color: 'var(--accent)' });
  if (profile?.isDemo) badges.push({ icon: '🎬', label: t('mon-compte.badge-demo', 'DEMO'), color: 'var(--brass-bg)' });

  const sectionTitleStyle = { fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 4, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 };
  const sectionIntroStyle = { fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 };
  const cardStyle = { background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 14, marginBottom: 12 };
  const fieldLabelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 };

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 16 }}>{t('mon-compte.intro', 'Ton profil, ta sécurité et tes données.')}</div>

      {/* ─── Section 1 : 👤 Identité ─── */}
      <div style={sectionTitleStyle}>
        <NavIcon id="user" size={15}/><span>{t('mon-compte.section-identity', 'Identité')}</span>
      </div>
      <div style={sectionIntroStyle}>{t('mon-compte.identity-intro', 'Ton identité dans Backline. Email facultatif.')}</div>
      <div style={cardStyle}>
        {/* Avatar */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 14 }}>
          {profile?.avatar ? (
            <img src={profile.avatar} alt="avatar" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--a10)' }}/>
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--a8)', border: '2px solid var(--a10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: 'var(--text-sec)' }}>{(profile?.name || '?').charAt(0).toUpperCase()}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ background: 'var(--a5)', border: '1px solid var(--a8)', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '6px 12px', fontSize: 11, cursor: 'pointer', fontWeight: 700, minHeight: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              {profile?.avatar ? t('mon-compte.avatar-change', 'Changer') : t('mon-compte.avatar-add', 'Ajouter un avatar')}
              <input type="file" accept="image/*" onChange={onAvatarUpload} style={{ display: 'none' }}/>
            </label>
            {profile?.avatar && <Button variant="ghost" size="sm" onClick={removeAvatar}>{t('mon-compte.avatar-remove', 'Retirer')}</Button>}
          </div>
        </div>
        {avatarErr && <div style={{ fontSize: 11, color: 'var(--wine-400)', marginBottom: 10 }}>{avatarErr}</div>}

        {/* Nom (édition inline) */}
        <div style={fieldLabelStyle}>{t('mon-compte.field-name', 'Nom')}</div>
        {editingName ? (
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') cancelName(); }}
              autoFocus
              style={{ ...inp, flex: 1 }}
            />
            <Button variant="primary" size="sm" onClick={saveName}>{t('mon-compte.save', 'OK')}</Button>
            <Button variant="secondary" size="sm" onClick={cancelName}>{t('mon-compte.cancel', 'Annuler')}</Button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, flex: 1 }}>{profile?.name || '—'}</div>
            <Button variant="ghost" onClick={() => { setEditingName(true); setNameDraft(profile?.name || ''); }}>{t('mon-compte.edit', 'Modifier')}</Button>
          </div>
        )}

        {/* Bio (textarea, save au blur) */}
        <div style={fieldLabelStyle}>{t('mon-compte.field-bio', 'Bio courte')} <span style={{ fontWeight: 400, color: 'var(--text-dim)', fontSize: 10 }}>({t('mon-compte.field-bio-hint', 'optionnel, max 200 caractères')})</span></div>
        <textarea
          value={bioDraft}
          maxLength={200}
          onChange={(e) => setBioDraft(e.target.value)}
          onBlur={saveBio}
          placeholder={t('mon-compte.field-bio-placeholder', 'Ex: Guitariste blues/rock, 12 ans de pratique...')}
          rows={2}
          style={{ ...inp, width: '100%', resize: 'vertical', marginBottom: 12, fontFamily: 'var(--font-body)' }}
        />

        {/* Email (input, save au blur) */}
        <div style={fieldLabelStyle}>{t('mon-compte.field-email', 'Email')} <span style={{ fontWeight: 400, color: 'var(--text-dim)', fontSize: 10 }}>({t('mon-compte.field-email-hint', 'optionnel, pour récup mot de passe')})</span></div>
        <input
          type="email"
          value={emailDraft}
          onChange={(e) => setEmailDraft(e.target.value)}
          onBlur={saveEmail}
          placeholder="moi@exemple.com"
          autoComplete="email"
          style={{ ...inp, width: '100%' }}
        />

        {/* Badges read-only */}
        {badges.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
            {badges.map((b, i) => (
              <span key={i} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 'var(--r-sm)', background: b.color, color: b.color === 'var(--accent)' ? 'var(--bg)' : 'var(--text)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {b.icon} {b.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ─── Section 2 : 🔐 Sécurité ─── */}
      <hr style={{ border: 'none', borderTop: '1px solid var(--a10)', margin: '20px 0 16px 0' }}/>
      <div style={sectionTitleStyle}>
        <NavIcon id="lock" size={15}/><span>{t('mon-compte.section-security', 'Sécurité')}</span>
      </div>
      <PasswordTab profile={profile} onProfiles={onProfiles} activeProfileId={activeProfileId} inp={inp}/>

      {/* Trusted devices */}
      <div style={{ ...cardStyle, marginTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('mon-compte.trusted-title', 'Appareil de confiance')}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4 }}>
          {trusted
            ? t('mon-compte.trusted-yes', 'Cet appareil est de confiance : tu n\'as pas à retaper ton mot de passe à chaque connexion. La confiance est locale à cet appareil (pas synchronisée).')
            : t('mon-compte.trusted-no', 'Cet appareil n\'est pas de confiance : ton mot de passe sera demandé à chaque connexion. La confiance se gagne en cochant "Mémoriser cet appareil" au login.')}
        </div>
        {trusted && (
          <Button variant="danger" onClick={revokeTrusted}>{t('mon-compte.trusted-revoke', 'Révoquer pour cet appareil')}</Button>
        )}
      </div>

      {/* ─── Section 3 : 💾 Mes données ─── */}
      <hr style={{ border: 'none', borderTop: '1px solid var(--a10)', margin: '20px 0 16px 0' }}/>
      <div style={sectionTitleStyle}>
        <span>{t('mon-compte.section-data', 'Mes données')}</span>
      </div>
      <div style={sectionIntroStyle}>{t('mon-compte.data-intro', 'Export, import et réinitialisation de TES données (profil actif uniquement).')}</div>
      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <Button variant="primary" onClick={exportMyData}>{t('mon-compte.data-export', 'Exporter mes données (JSON)')}</Button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {t('mon-compte.data-export-hint', 'Inclut ton profil, tes setlists, tes morceaux, tes banks, tes presets ToneNET et tes guitares custom. Ne contient pas tes données autres profils.')}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--wine-400)', marginBottom: 4 }}>⚠ {t('mon-compte.reset-title', 'Réinitialiser mon profil')}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4 }}>
          {t('mon-compte.reset-hint', 'Vide ton rig, tes banks, tes setlists et ton historique IA. Garde ton nom, email, mot de passe et historique de connexion. Action irréversible.')}
        </div>
        <Button variant="danger-ghost" onClick={resetMyProfile}>{t('mon-compte.reset-button', 'Réinitialiser mon profil')}</Button>
      </div>

      {/* ─── Section 4 : 📊 Activité (Phase 7.73.2 Session C) ─── */}
      {(() => {
        const lh = Array.isArray(profile?.loginHistory) ? profile.loginHistory : [];
        // Plus ancienne entrée = inscription approximative. Format dual
        // (number = login normal, object = admin_switch). On filtre les
        // numbers seulement pour estimer la date d'inscription.
        const numericEntries = lh.filter((e) => typeof e === 'number');
        // Phase 14.15 (anomalie E) — priorité à profile.createdAt (date exacte
        // d'inscription, posée à la création). Fallback : plus ancien login
        // numérique connu via Math.min (robuste à l'ordre du tableau ; le
        // loginHistory est capé à 5 donc c'est approximatif pour les anciens
        // profils sans createdAt). Sinon « — » (donnée inconnue, pas inventée).
        const firstLogin = typeof profile?.createdAt === 'number'
          ? profile.createdAt
          : (numericEntries.length > 0 ? Math.min(...numericEntries) : null);
        const inscriptionDate = firstLogin ? new Date(firstLogin) : null;
        const mySetlists = (setlists || []).filter((sl) => Array.isArray(sl.profileIds) && sl.profileIds.includes(activeProfileId));
        const myAiCacheCount = Object.keys(profile?.aiCache || {}).length;
        // Compter les feedbacks dans song.feedback[] sur les morceaux que
        // je joue (les feedbacks sont partagés cross-profil v1, on les
        // compte tous sur les morceaux de mes setlists).
        const mySongIds = new Set();
        mySetlists.forEach((sl) => (sl.songIds || []).forEach((id) => mySongIds.add(id)));
        const feedbackCount = (songDb || []).filter((s) => mySongIds.has(s.id)).reduce((acc, s) => acc + (Array.isArray(s.feedback) ? s.feedback.length : 0), 0);
        // Customs créés : flatten customPacks + customGuitars
        const customPresetsCount = (profile?.customPacks || []).reduce((acc, pk) => acc + (Array.isArray(pk.presets) ? pk.presets.length : 0), 0);
        const customGuitarsCount = Array.isArray(profile?.customGuitars) ? profile.customGuitars.length : 0;
        const stats = [
          { label: t('mon-compte.stats-inscription', 'Inscription'), value: inscriptionDate ? inscriptionDate.toLocaleDateString(getLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—' },
          { label: t('mon-compte.stats-setlists', 'Setlists'), value: mySetlists.length },
          { label: t('mon-compte.stats-analyses', 'Analyses IA'), value: myAiCacheCount },
          { label: t('mon-compte.stats-feedbacks', 'Feedbacks donnés'), value: feedbackCount },
          { label: t('mon-compte.stats-custom-presets', 'Presets custom'), value: customPresetsCount },
          { label: t('mon-compte.stats-custom-guitars', 'Guitares custom'), value: customGuitarsCount },
        ];
        return (
          <>
            <hr style={{ border: 'none', borderTop: '1px solid var(--a10)', margin: '20px 0 16px 0' }}/>
            <div style={sectionTitleStyle}>
              <span>{t('mon-compte.section-activity', 'Activité')}</span>
            </div>
            <div style={sectionIntroStyle}>{t('mon-compte.activity-intro', 'Tes stats sur Backline (read-only).')}</div>
            <div style={cardStyle}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                {stats.map((s, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--a3)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{s.label}</div>
                    <div style={{ fontSize: 18, color: 'var(--text-bright)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        );
      })()}

      {/* ─── Section 5 : 🤝 Communauté (partages reçus, Phase 7.73.2 Session C) ─── */}
      {(() => {
        // Setlists où je suis dans profileIds ET il y a d'autres profileIds
        // (= setlist partagée avec moi par un autre user). v1 read-only.
        const sharedWithMe = (setlists || []).filter((sl) => {
          if (!Array.isArray(sl.profileIds)) return false;
          if (!sl.profileIds.includes(activeProfileId)) return false;
          return sl.profileIds.length > 1; // partagée avec d'autres
        });
        return (
          <>
            <hr style={{ border: 'none', borderTop: '1px solid var(--a10)', margin: '20px 0 16px 0' }}/>
            <div style={sectionTitleStyle}>
              <span>{t('mon-compte.section-community', 'Communauté')}</span>
            </div>
            <div style={sectionIntroStyle}>{t('mon-compte.community-intro', 'Setlists partagées avec toi par d\'autres profils.')}</div>
            <div style={cardStyle}>
              {sharedWithMe.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>
                  {t('mon-compte.community-empty', 'Aucune setlist partagée avec toi pour le moment.')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {sharedWithMe.map((sl) => {
                    const otherIds = sl.profileIds.filter((id) => id !== activeProfileId);
                    const otherNames = otherIds.map((id) => profiles?.[id]?.name || id).join(', ');
                    return (
                      <div key={sl.id} style={{ background: 'var(--a3)', borderRadius: 'var(--r-md)', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 120 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{sl.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                            {tFormat('mon-compte.shared-with', { count: (sl.songIds || []).length, others: otherNames }, '{count} morceaux · avec {others}')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        );
      })()}

      {/* ─── Section 6 : 💬 Aide (Phase 7.73.2 Session C) ─── */}
      <hr style={{ border: 'none', borderTop: '1px solid var(--a10)', margin: '20px 0 16px 0' }}/>
      <div style={sectionTitleStyle}>
        <span>{t('mon-compte.section-help', 'Aide')}</span>
      </div>
      <div style={sectionIntroStyle}>{t('mon-compte.help-intro', 'Tutoriel, feedback et contact.')}</div>
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Relancer le tutoriel (pattern footer existant Phase 1) */}
          <Button
            variant="secondary"
            fullWidth
            onClick={() => {
              if (typeof window.setShowOnboarding === 'function') window.setShowOnboarding(true);
              else { const e = new CustomEvent('showOnboarding'); window.dispatchEvent(e); }
            }}
          >{t('mon-compte.help-relaunch-tutorial', 'Relancer le tutoriel d\'introduction')}</Button>

          {/* Feedback Tally (Phase 7.73.0) — <a> stylé comme Button secondary
              pour cohérence visuelle (lien externe, pas un bouton). */}
          <a
            href={buildFeedbackUrl(profile?.name, (typeof window !== 'undefined' && window.__BACKLINE_APP_VERSION) || '')}
            target="_blank"
            rel="noopener noreferrer"
            style={{ background: 'var(--a5)', border: '1px solid var(--a8)', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '10px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >{t('mon-compte.help-send-feedback', 'Envoyer un feedback à l\'équipe')}</a>
          {/* Phase 7.73.2.1 (2026-05-23) — Bouton mailto retiré pour
              privacy (l'email admin était exposé en clair via mailto:).
              Toute communication passe par le formulaire Tally
              ci-dessus (canal unique de feedback). */}
        </div>

        {/* Version (info read-only) */}
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--a10)', fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span>{t('mon-compte.help-version-label', 'Version')} : <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{(typeof window !== 'undefined' && window.__BACKLINE_APP_VERSION) || '?'}</span></span>
          <span style={{ color: 'var(--text-tertiary)' }}>·</span>
          <span>{t('mon-compte.help-build-tag', 'Backline')}</span>
        </div>
      </div>
    </div>
  );
}

// Phase 7.73.1 — Factory : callback pour push les "ajouter custom" depuis
// la modale presets inconnus (CSV import) vers profile.customPacks "Mes
// presets" du profil actif. Centralisé ici pour réutilisation dans
// DeviceCSVPanel (3 instances : pedale/ann/plug).
function makeOnAddCustomPresets(onProfiles, activeProfileId) {
  return (presets) => {
    onProfiles((p) => {
      const cur = p[activeProfileId];
      if (!cur) return p;
      const packs = (cur.customPacks || []).slice();
      const defaultIdx = packs.findIndex((pk) => pk.name === 'Mes presets');
      if (defaultIdx >= 0) {
        const existing = packs[defaultIdx];
        const existingNames = new Set((existing.presets || []).map((pr) => pr.name));
        const newOnes = presets.filter((pr) => !existingNames.has(pr.name));
        packs[defaultIdx] = { ...existing, presets: [...(existing.presets || []), ...newOnes] };
      } else {
        packs.push({ name: 'Mes presets', presets: presets.slice() });
      }
      return { ...p, [activeProfileId]: { ...cur, customPacks: packs, lastModified: Date.now() } };
    });
  };
}

// Phase 7.73.1 — Panneau CSV import/export filtré par device. Wrapper
// minimal autour de ExportImportScreen avec prop restrictToDevice qui
// cache les boutons/previews de l'autre device + filter l'import.
// Rendu en haut de chaque tab device (pedale/ann/plug) dans
// MonProfilScreen pour donner l'accès CSV au plus proche du contexte.
function DeviceCSVPanel({ restrictToDevice, banksAnn, onBanksAnn, banksPlug, onBanksPlug, fullState, onImportState, isAdmin, onAddCustomPresets, onNavigate }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <ExportImportScreen
        banksAnn={banksAnn}
        onBanksAnn={onBanksAnn}
        banksPlug={banksPlug}
        onBanksPlug={onBanksPlug}
        fullState={fullState}
        onImportState={onImportState}
        inline={true}
        isAdmin={false}  /* hide JSON full state — admin l'a via ⚙️ Admin */
        onAddCustomPresets={onAddCustomPresets}
        onNavigate={onNavigate}
        restrictToDevice={restrictToDevice}
      />
    </div>
  );
}

export default MonProfilScreen;
export { MonProfilScreen, PasswordTab };

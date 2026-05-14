// src/app/screens/SetlistsScreen.jsx — Phase 7.14 (découpage main.jsx).
//
// Wrapper à 2 tabs au-dessus du ListScreen :
// - tab "Setlists" : rend ListScreen (sélecteur setlist + liste morceaux).
// - tab "Morceaux" : vue globale du songDb groupée par artiste, avec
//   pour chaque song un panel "Setlists" qui toggle l'appartenance + un
//   bouton supprimer (de la base). En bas, formulaire d'ajout rapide
//   d'un morceau custom (titre + artiste libre + setlists cibles).

import React, { useState, useMemo } from 'react';
import { findDuplicateSong } from '../utils/song-helpers.js';
import { updateAiCache } from '../utils/ai-helpers.js';
import { fetchAI } from '../utils/fetchAI.js';
import Breadcrumb from '../components/Breadcrumb.jsx';
import ListScreen from './ListScreen.jsx';
import { SongSearchBar } from './HomeScreen.jsx';

function SetlistsScreen({
  songDb, onSongDb, setlists, allSetlists, onSetlists, mySongIds,
  checked, onChecked, onNext, onSettings, onNavigate,
  banksAnn, onBanksAnn, banksPlug, onBanksPlug,
  aiProvider, aiKeys, allGuitars, allRigsGuitars, guitarBias,
  availableSources, activeProfileId, profiles, profile,
  onTmpPatchOverride, onLive,
}) {
  const visibleSongDb = useMemo(
    () => (mySongIds ? songDb.filter((s) => mySongIds.has(s.id)) : songDb),
    [songDb, mySongIds]
  );
  const [tab, setTab] = useState('setlists');
  const tabBtn = (id, label) => (
    <button onClick={() => setTab(id)} style={{ background: tab === id ? 'var(--accent-bg)' : 'var(--a5)', border: tab === id ? '1px solid var(--accent-border)' : '1px solid var(--a8)', color: tab === id ? 'var(--accent)' : 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
  );

  // Songs tab state
  const [songSort, setSongSort] = useState('artist');
  const [newSongSlIds, setNewSongSlIds] = useState([]);
  const [expandedSongId, setExpandedSongId] = useState(null);
  const toggleNewSongSl = (id) => setNewSongSlIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleSongInSetlist = (songId, slId) => onSetlists((p) => p.map((sl) => sl.id !== slId ? sl : { ...sl, songIds: sl.songIds.includes(songId) ? sl.songIds.filter((x) => x !== songId) : [...sl.songIds, songId] }));

  // Phase 7.14 — Add song via SongSearchBar (même flow que HomeScreen :
  // input → IA correction → confirmation user). Le user a pré-sélectionné
  // les setlists cibles via newSongSlIds avant de chercher. Sur confirm,
  // on dédup contre songDb (findDuplicateSong) ; si déjà présent on
  // ajoute juste aux setlists, sinon on crée le custom song + fetchAI
  // en background + propagation aux setlists.
  const handleSongSearchConfirm = (title, artist) => {
    const finalArtist = artist || 'Artiste inconnu';
    const dup = findDuplicateSong(songDb, title, finalArtist);
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
      setNewSongSlIds([]);
      return;
    }
    const ns = { id: `c_${Date.now()}`, title, artist: finalArtist, isCustom: true, ig: [], aiCache: null };
    onSongDb((p) => [...p, ns]);
    if (newSongSlIds.length > 0) onSetlists((p) => p.map((sl) => newSongSlIds.includes(sl.id) ? { ...sl, songIds: [...sl.songIds, ns.id] } : sl));
    fetchAI(ns, '', banksAnn, banksPlug, aiProvider, aiKeys, allGuitars, null, null, profile?.recoMode || 'balanced', guitarBias)
      .then((r) => onSongDb((p) => p.map((x) => x.id === ns.id ? { ...x, aiCache: updateAiCache(x.aiCache, '', r) } : x)))
      .catch(() => {});
    setNewSongSlIds([]);
  };

  const deleteSongFromDb = (id) => {
    const s = songDb.find((x) => x.id === id);
    if (!s) return;
    if (!window.confirm(`Supprimer "${s.title}" (${s.artist}) de la base ?\nLe morceau sera retiré de toutes les setlists.`)) return;
    onSongDb((p) => p.filter((x) => x.id !== id));
    onSetlists((p) => p.map((sl) => ({ ...sl, songIds: sl.songIds.filter((x) => x !== id) })));
  };

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Accueil', screen: 'list' }, { label: 'Setlists & Morceaux' }]} onNavigate={onNavigate}/>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Setlists</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {tabBtn('setlists', 'Setlists')}
        {tabBtn('songs', 'Morceaux')}
      </div>
      {tab === 'setlists' && <ListScreen songDb={songDb} onSongDb={onSongDb} allSetlists={allSetlists} setlists={setlists} onSetlists={onSetlists} mySongIds={mySongIds} checked={checked} onChecked={onChecked} onNext={onNext} onSettings={onSettings} banksAnn={banksAnn} onBanksAnn={onBanksAnn} banksPlug={banksPlug} onBanksPlug={onBanksPlug} aiProvider={aiProvider} aiKeys={aiKeys} hideHeader={true} allGuitars={allGuitars} allRigsGuitars={allRigsGuitars} guitarBias={guitarBias} availableSources={availableSources} activeProfileId={activeProfileId} profiles={profiles} profile={profile} onTmpPatchOverride={onTmpPatchOverride} onLive={onLive}/>}
      {tab === 'songs' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text-sec)' }}>{visibleSongDb.length} morceaux</div>
            <select value={songSort} onChange={(e) => setSongSort(e.target.value)} style={{ background: 'var(--bg-card)', color: 'var(--text-sec)', border: '1px solid var(--a12)', borderRadius: 'var(--r-md)', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
              <option value="alpha">A → Z (titre)</option>
              <option value="artist">Par artiste</option>
              <option value="recent">Récents</option>
            </select>
          </div>
          {(() => {
            // Defensive dedup by id (cf ListScreen) pour éviter le warning
            // React keys dupliquées sur songDb corrompue.
            const seen = new Set();
            const sorted = visibleSongDb.filter((s) => { if (seen.has(s.id)) return false; seen.add(s.id); return true; });
            if (songSort === 'alpha') sorted.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
            else if (songSort === 'artist') sorted.sort((a, b) => a.artist.localeCompare(b.artist, 'fr') || a.title.localeCompare(b.title, 'fr'));
            else sorted.reverse();
            let lastArtist = '';
            return sorted.map((s) => {
              const expanded = expandedSongId === s.id;
              const showArtistHeader = songSort === 'artist' && s.artist !== lastArtist;
              if (showArtistHeader) lastArtist = s.artist;
              return (
                <div key={s.id}>
                  {showArtistHeader && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', marginTop: 10, marginBottom: 4, paddingLeft: 2 }}>{s.artist}</div>}
                  <div style={{ background: 'var(--a3)', border: '1px solid var(--a6)', borderRadius: 'var(--r-lg)', marginBottom: 4, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px' }}>
                      <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.title}</div>{songSort !== 'artist' && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.artist}{s.isCustom ? ' · ✨IA' : ''}</div>}</div>
                      <button onClick={() => setExpandedSongId(expanded ? null : s.id)} style={{ background: expanded ? 'var(--accent-bg)' : 'var(--a7)', border: expanded ? '1px solid var(--accent-border)' : '1px solid var(--a10)', color: expanded ? 'var(--accent)' : 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>Setlists</button>
                      <button onClick={() => deleteSongFromDb(s.id)} style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', borderRadius: 'var(--r-md)', padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Supprimer</button>
                    </div>
                    {expanded && (
                      <div style={{ padding: '8px 12px 10px', borderTop: '1px solid var(--a5)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {setlists.map((sl) => {
                          const inSl = sl.songIds.includes(s.id);
                          return (
                            <button key={sl.id} onClick={() => toggleSongInSetlist(s.id, sl.id)} style={{ background: inSl ? 'var(--green-border)' : 'var(--a5)', border: inSl ? '1px solid rgba(74,222,128,0.4)' : '1px solid var(--a10)', color: inSl ? 'var(--green)' : 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{inSl ? '✓ ' : ''}{sl.name}</button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            });
          })()}
          <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-soft)', borderRadius: 'var(--r-lg)', padding: 14, marginTop: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginBottom: 10 }}>+ Ajouter un morceau</div>
            {setlists.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Ajouter aussi à :</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {setlists.map((sl) => {
                    const sel = newSongSlIds.includes(sl.id);
                    return (
                      <button key={sl.id} onClick={() => toggleNewSongSl(sl.id)} style={{ background: sel ? 'var(--accent-bg)' : 'var(--a5)', border: sel ? '1px solid var(--border-accent)' : '1px solid var(--a10)', color: sel ? 'var(--accent)' : 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{sl.name}</button>
                    );
                  })}
                </div>
              </>
            )}
            {/* Phase 7.14 — même flow que HomeScreen : recherche IA + correction
                avant ajout. Le user a déjà coché les setlists cibles ci-dessus. */}
            <SongSearchBar songDb={songDb} aiProvider={aiProvider} aiKeys={aiKeys} onConfirm={handleSongSearchConfirm}/>
          </div>
        </div>
      )}
    </div>
  );
}

export default SetlistsScreen;
export { SetlistsScreen };

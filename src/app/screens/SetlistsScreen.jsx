// src/app/screens/SetlistsScreen.jsx — Phase 7.14 (découpage main.jsx).
//
// Wrapper à 2 tabs au-dessus du ListScreen :
// - tab "Setlists" : rend ListScreen (sélecteur setlist + liste morceaux).
// - tab "Morceaux" : vue globale du songDb groupée par artiste, avec
//   pour chaque song un panel "Setlists" qui toggle l'appartenance + un
//   bouton supprimer (de la base). En bas, formulaire d'ajout rapide
//   d'un morceau custom (titre + artiste libre + setlists cibles).

import React, { useState, useMemo } from 'react';
import { t, tFormat, tPlural } from '../../i18n/index.js';
import { findDuplicateSong } from '../utils/song-helpers.js';
import { updateAiCache } from '../utils/ai-helpers.js';
import { fetchAI } from '../utils/fetchAI.js';
import Breadcrumb from '../components/Breadcrumb.jsx';
import ListScreen from './ListScreen.jsx';
import { SongSearchBar } from './HomeScreen.jsx';

function SetlistsScreen({
  songDb, onSongDb, onAiCacheUpdate, setlists, allSetlists, onSetlists, mySongIds,
  checked, onChecked, onSettings, onNavigate,
  banksAnn, onBanksAnn, banksPlug, onBanksPlug,
  banksOne, banksOnePlus,
  aiProvider, aiKeys, allGuitars, allRigsGuitars, guitarBias,
  availableSources, activeProfileId, profiles, profile, onProfiles,
  onTmpPatchOverride, onLive,
  toneNetPresets, onToneNetPresets,
  onSharedUsagesOverrides, // Phase 7.79.3 — propagé vers ListScreen → SongDetailCard → PresetCurationModal
}) {
  const visibleSongDb = useMemo(
    () => (mySongIds ? songDb.filter((s) => mySongIds.has(s.id)) : songDb),
    [songDb, mySongIds]
  );
  const [tab, setTab] = useState('setlists');
  const tabBtn = (id, label) => (
    <button onClick={() => setTab(id)} style={{ minHeight: 44, background: tab === id ? 'var(--accent-bg)' : 'var(--a5)', border: tab === id ? '1px solid var(--accent-border)' : '1px solid var(--a8)', color: tab === id ? 'var(--accent)' : 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '10px 16px', fontSize: 'clamp(12px, 1.25vw, 14px)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{label}</button>
  );

  // Songs tab state
  const [songSort, setSongSort] = useState('artist');
  const [newSongSlIds, setNewSongSlIds] = useState([]);
  const toggleNewSongSl = (id) => setNewSongSlIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleSongInSetlist = (songId, slId) => onSetlists((p) => p.map((sl) => sl.id !== slId ? sl : { ...sl, songIds: sl.songIds.includes(songId) ? sl.songIds.filter((x) => x !== songId) : [...sl.songIds, songId] }));

  // Phase 7.14 — Add song via SongSearchBar (même flow que HomeScreen :
  // input → IA correction → confirmation user). Le user a pré-sélectionné
  // les setlists cibles via newSongSlIds avant de chercher. Sur confirm,
  // on dédup contre songDb (findDuplicateSong) ; si déjà présent on
  // ajoute juste aux setlists, sinon on crée le custom song + fetchAI
  // en background + propagation aux setlists.
  const handleSongSearchConfirm = (title, artist) => {
    const finalArtist = artist || t('setlists.unknown-artist', 'Artiste inconnu');
    const dup = findDuplicateSong(songDb, title, finalArtist);
    if (dup) {
      const slCount = newSongSlIds.length;
      const addToTarget = slCount > 1
        ? t('setlists.add-to-selected-plural', 'aux setlists sélectionnées')
        : t('setlists.add-to-selected-single', 'à la setlist sélectionnée');
      const msg = tFormat('setlists.already-in-db', { title: dup.title, artist: dup.artist, ask: slCount > 0 ? '\n\n' + tFormat('setlists.add-question', { target: addToTarget }, "Voulez-vous l'ajouter {target} ?") : '' }, '"{title}" ({artist}) est déjà dans la base.{ask}');
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
    if (profile?.isDemo) return; // Phase 7.51.2 — pas de fetchAI ni add en mode démo
    const ns = { id: `c_${Date.now()}`, title, artist: finalArtist, isCustom: true, ig: [], aiCache: null };
    onSongDb((p) => [...p, ns]);
    if (newSongSlIds.length > 0) onSetlists((p) => p.map((sl) => newSongSlIds.includes(sl.id) ? { ...sl, songIds: [...sl.songIds, ns.id] } : sl));
    fetchAI(ns, '', banksAnn, banksPlug, aiProvider, aiKeys, allGuitars, null, null, profile?.recoMode || 'balanced', guitarBias, ns.outputContext || profile?.outputContext || 'frfr', profile?.preferredStyles || [])
      // Phase 7.54 — Écrit dans profile.aiCache via setSongAiCache au lieu
      // de shared.songDb. Si onAiCacheUpdate n'est pas passé (cas dégénéré),
      // fallback vers onSongDb pour compat.
      .then((r) => {
        const value = updateAiCache(null, '', r);
        if (onAiCacheUpdate) onAiCacheUpdate(ns.id, value);
        else onSongDb((p) => p.map((x) => x.id === ns.id ? { ...x, aiCache: value } : x));
      })
      .catch(() => {});
    setNewSongSlIds([]);
  };

  const deleteSongFromDb = (id) => {
    const s = songDb.find((x) => x.id === id);
    if (!s) return;
    if (!window.confirm(tFormat('setlists.delete-confirm', { title: s.title, artist: s.artist }, 'Supprimer "{title}" ({artist}) de la base ?\nLe morceau sera retiré de toutes les setlists.'))) return;
    onSongDb((p) => p.filter((x) => x.id !== id));
    onSetlists((p) => p.map((sl) => ({ ...sl, songIds: sl.songIds.filter((x) => x !== id) })));
  };

  return (
    <div>
      <Breadcrumb crumbs={[{ label: t('common.home', 'Accueil'), screen: 'list' }, { label: t('setlists.breadcrumb', 'Setlists & Morceaux') }]} onNavigate={onNavigate}/>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>{t('setlists.title', 'Setlists')}</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {tabBtn('setlists', t('setlists.tab-setlists', 'Setlists'))}
        {tabBtn('songs', t('setlists.tab-songs', 'Morceaux'))}
      </div>
      {tab === 'setlists' && <ListScreen songDb={songDb} onSongDb={onSongDb} onAiCacheUpdate={onAiCacheUpdate} allSetlists={allSetlists} setlists={setlists} onSetlists={onSetlists} mySongIds={mySongIds} checked={checked} onChecked={onChecked} onSettings={onSettings} banksAnn={banksAnn} onBanksAnn={onBanksAnn} banksPlug={banksPlug} onBanksPlug={onBanksPlug} banksOne={banksOne} banksOnePlus={banksOnePlus} aiProvider={aiProvider} aiKeys={aiKeys} hideHeader={true} allGuitars={allGuitars} allRigsGuitars={allRigsGuitars} guitarBias={guitarBias} availableSources={availableSources} activeProfileId={activeProfileId} profiles={profiles} profile={profile} onProfiles={onProfiles} onTmpPatchOverride={onTmpPatchOverride} onLive={onLive} toneNetPresets={toneNetPresets} onToneNetPresets={onToneNetPresets} onSharedUsagesOverrides={onSharedUsagesOverrides}/>}
      {tab === 'songs' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text-sec)', whiteSpace: 'nowrap' }}>{tPlural('setlists.songs-count', visibleSongDb.length, {}, { one: '1 morceau', other: '{count} morceaux' })}</div>
            <select value={songSort} onChange={(e) => setSongSort(e.target.value)} style={{ background: 'var(--bg-card)', color: 'var(--text-sec)', border: '1px solid var(--a12)', borderRadius: 'var(--r-md)', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
              <option value="alpha">{t('setlists.sort-alpha', 'A → Z (titre)')}</option>
              <option value="artist">{t('setlists.sort-artist', 'Par artiste')}</option>
              <option value="recent">{t('setlists.sort-recent', 'Récents')}</option>
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
              const showArtistHeader = songSort === 'artist' && s.artist !== lastArtist;
              if (showArtistHeader) lastArtist = s.artist;
              return (
                <div key={s.id}>
                  {showArtistHeader && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', marginTop: 10, marginBottom: 4, paddingLeft: 2 }}>{s.artist}</div>}
                  <div style={{ background: 'var(--a3)', border: '1px solid var(--a6)', borderRadius: 'var(--r-lg)', marginBottom: 4, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>{songSort !== 'artist' && <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.artist}{s.isCustom ? ' · ✨IA' : ''}</div>}</div>
                      <button onClick={() => deleteSongFromDb(s.id)} style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', borderRadius: 'var(--r-md)', padding: '4px 10px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>{t('setlists.delete', 'Supprimer')}</button>
                    </div>
                    {/* Toggle setlist inline (même système que la recherche
                        initiale HomeScreen) — pills directement visibles, ✓ vert
                        quand le morceau est dans la setlist, clic = toggle. */}
                    {setlists.length > 0 && (
                      <div style={{ padding: '0 12px 10px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {setlists.map((sl) => {
                          const inSl = sl.songIds.includes(s.id);
                          return (
                            <button key={sl.id} onClick={() => toggleSongInSetlist(s.id, sl.id)} style={{ background: inSl ? 'rgba(74,222,128,0.15)' : 'var(--a5)', border: inSl ? '1px solid rgba(74,222,128,0.4)' : '1px solid var(--a10)', color: inSl ? 'var(--green)' : 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '10px 14px', minHeight: 44, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{inSl ? '✓ ' : ''}{sl.name}</button>
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
            <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginBottom: 10 }}>{t('setlists.add-song', '+ Ajouter un morceau')}</div>
            {setlists.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{t('setlists.also-add-to', 'Ajouter aussi à :')}</div>
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
            <SongSearchBar songDb={songDb} aiProvider={aiProvider} aiKeys={aiKeys} isDemo={profile?.isDemo === true} onConfirm={handleSongSearchConfirm}/>
          </div>
        </div>
      )}
    </div>
  );
}

export default SetlistsScreen;
export { SetlistsScreen };

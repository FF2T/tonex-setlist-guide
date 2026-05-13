// src/app/screens/ParametresScreen.jsx — Phase 7.18 (découpage main.jsx).
//
// Écran ⚙️ Paramètres : protégé par un PIN admin. Une fois unlocked,
// expose 5 onglets : Sources (packs/captures), Clé API IA, Profils
// (CRUD + reset password), Maintenance (audit, recalcul IA, dédoublons),
// Export / Import (nav vers ExportImportScreen).
//
// Les tabs PacksTab/ProfilesAdmin/MaintenanceTab restent rendus depuis
// main.jsx pour l'instant (extraction prévue Phase 7.19+).

import React, { useState, useRef, useEffect } from 'react';
import { setSharedGeminiKey } from '../utils/shared-key.js';
import Breadcrumb from '../components/Breadcrumb.jsx';

const ADMIN_PIN = '212402';

function ParametresScreen({
  onBack, onNavigate,
  aiProvider, onAiProvider, aiKeys, onAiKeys,
  profile, profiles, onProfiles, activeProfileId,
  fullState, onImportState,
  banksAnn, onBanksAnn, banksPlug, onBanksPlug,
  songDb, onSongDb, setlists: allSetlists, onSetlists,
  PacksTabComponent, ProfilesAdminComponent, MaintenanceTabComponent,
  onDeletedSetlistIds, guitarBias,
  onSaveSharedKey,
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinErr, setPinErr] = useState(false);
  const pinRef = useRef(null);
  useEffect(() => { if (!unlocked) setTimeout(() => pinRef.current?.focus(), 100); }, []);
  const [tab, setTab] = useState('presets');
  const tryUnlock = () => { if (pin === ADMIN_PIN) { setUnlocked(true); setPinErr(false); } else { setPinErr(true); } };
  const inp = { background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-md)', padding: '6px 10px', fontSize: 12, boxSizing: 'border-box' };
  const tabBtn = (id, label) => (
    <button onClick={() => setTab(id)} style={{ background: tab === id ? 'var(--accent-bg)' : 'var(--a5)', border: tab === id ? '1px solid var(--border-accent)' : '1px solid var(--a8)', color: tab === id ? 'var(--accent)' : 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
  );
  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Accueil', screen: 'list' }, { label: 'Paramètres' }]} onNavigate={onNavigate}/>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>⚙️ Paramètres</div>
      {!unlocked ? (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 12 }}>Entrez le code administrateur.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input ref={pinRef} type="password" inputMode="numeric" autoFocus placeholder="Code admin" value={pin} onChange={(e) => { setPin(e.target.value); setPinErr(false); }} onKeyDown={(e) => e.key === 'Enter' && tryUnlock()} style={{ ...inp, flex: 1 }}/>
            <button onClick={tryUnlock} style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>OK</button>
          </div>
          {pinErr && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 6 }}>Code incorrect</div>}
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {tabBtn('presets', '📦 Sources')}
            {tabBtn('ia', '🔑 Clé API')}
            {tabBtn('profiles', '👤 Profils')}
            {tabBtn('maintenance', '🔧 Maintenance')}
            {tabBtn('export', '📋 Export / Import')}
          </div>
          {tab === 'presets' && PacksTabComponent && <PacksTabComponent profile={profile} onProfiles={onProfiles} activeProfileId={activeProfileId} aiProvider={aiProvider} aiKeys={aiKeys}/>}
          {tab === 'ia' && <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 700 }}>Modèle actif :</span>
              <span style={{ color: 'var(--green)', fontWeight: 600 }}>{aiProvider === 'gemini' ? 'gemini-3-flash-preview' : 'claude-haiku-4-5'}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 12 }}>Fournisseur IA pour l'analyse des morceaux.</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[{ v: 'gemini', l: 'Google (Gemini)' }].map(({ v, l }) => (
                <button key={v} onClick={() => onAiProvider(v)} style={{ flex: 1, background: aiProvider === v ? 'var(--green-border)' : 'var(--a5)', border: aiProvider === v ? '1px solid rgba(74,222,128,0.6)' : '1px solid var(--a10)', color: aiProvider === v ? 'var(--green)' : 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
              ))}
            </div>
            <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: 'var(--r-lg)', padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 10 }}>🔑 Clé API Google AI Studio</div>
              <input type="password" placeholder="AIza..." value={aiKeys.gemini} onChange={(e) => { onAiKeys((p) => ({ ...p, gemini: e.target.value })); }} style={{ ...inp, width: '100%', marginBottom: 8, fontFamily: 'monospace' }}/>
              <button onClick={() => { if (aiKeys.gemini) { if (onSaveSharedKey) onSaveSharedKey(aiKeys.gemini); setSharedGeminiKey(aiKeys.gemini); } }} disabled={!aiKeys.gemini} style={{ background: aiKeys.gemini ? 'var(--green)' : 'var(--bg-disabled)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: aiKeys.gemini ? 'pointer' : 'not-allowed', marginBottom: 8 }}>Partager la clé (tous les utilisateurs)</button>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>aistudio.google.com → Get API key</div>
              {aiKeys.gemini && <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 8 }}>✓ Clé configurée ({aiKeys.gemini.slice(0, 8)}...)</div>}
            </div>
          </div>}
          {tab === 'profiles' && ProfilesAdminComponent && <ProfilesAdminComponent profiles={profiles} onProfiles={onProfiles}/>}
          {tab === 'maintenance' && MaintenanceTabComponent && <MaintenanceTabComponent songDb={songDb} onSongDb={onSongDb} setlists={allSetlists} onSetlists={onSetlists} onDeletedSetlistIds={onDeletedSetlistIds} banksAnn={banksAnn} banksPlug={banksPlug} aiProvider={aiProvider} aiKeys={aiKeys} profile={profile} guitarBias={guitarBias}/>}
          {tab === 'export' && <div>
            <button onClick={() => onNavigate('exportimport')} style={{ width: '100%', background: 'var(--yellow-bg)', border: '1px solid var(--yellow-border)', color: 'var(--yellow)', borderRadius: 'var(--r-lg)', padding: '12px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
              📋 Export / Import →
            </button>
          </div>}
        </div>
      )}
    </div>
  );
}

export default ParametresScreen;
export { ParametresScreen };

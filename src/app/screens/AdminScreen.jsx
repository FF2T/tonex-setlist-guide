// src/app/screens/AdminScreen.jsx — Phase 7.72
//
// Écran "⚙️ Admin" dédié à l'admin Sébastien. Sépare visuellement les
// outils de gestion de l'app de "Mon Profil" (gestion de SES affaires).
//
// Tabs admin migrés depuis MonProfilScreen :
//   - 👥 Profils — CRUD utilisateurs
//   - 👁 Tous presets users — vue agrégée per-profil
//   - 📦 Packs admin — création packs via listing texte (Phase 7.69.7)
//   - 🌐 ToneNET — édition catalog ToneNET communautaire
//   - 🔧 Maintenance — invalidation cache, dédup, backups
//   - 🔑 Clé API partagée — Gemini + Anthropic
//
// Le screen est gated `profile.isAdmin` côté router (cf main.jsx).
// Si un non-admin arrive via URL hack → redirect vers 'list'.

import React, { useState } from 'react';
import { t } from '../../i18n/index.js';
import Breadcrumb from '../components/Breadcrumb.jsx';
import ProfilesAdmin from './ProfilesAdmin.jsx';
import AllUserPresetsTab from './AllUserPresetsTab.jsx';
import AdminPacksTab from './AdminPacksTab.jsx';
import ToneNetTab from './ToneNetTab.jsx';
import { setSharedGeminiKey } from '../utils/shared-key.js';

function AdminScreen({
  profile, profiles, onProfiles, activeProfileId,
  songDb, onSongDb, onAiCacheUpdate,
  allSetlists, onSetlists, onDeletedSetlistIds,
  banksAnn, banksPlug,
  aiProvider, aiKeys, onAiKeys, onSaveSharedKey,
  guitarBias,
  toneNetPresets, onToneNetPresets, onDeletedToneNetIds,
  adminPacks, onAdminPacks,
  MaintenanceTabComponent,
  fullState, onImportState,
  onBack, onNavigate,
}) {
  const [tab, setTab] = useState('profiles');

  const inp = { background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-md)', padding: '6px 10px', fontSize: 12, boxSizing: 'border-box' };

  const tabBtn = (id, label) => (
    <button
      onClick={() => setTab(id)}
      style={{
        background: tab === id ? 'var(--accent-bg)' : 'var(--a4)',
        border: tab === id ? '1px solid var(--accent-border)' : '1px solid var(--a8)',
        color: tab === id ? 'var(--accent)' : 'var(--text-sec)',
        borderRadius: 'var(--r-md)',
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: tab === id ? 700 : 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <Breadcrumb
        crumbs={[
          { label: t('common.home', 'Accueil'), screen: 'list' },
          { label: t('admin.breadcrumb', '⚙️ Admin') },
        ]}
        onNavigate={onNavigate}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)' }}>
          {t('admin.title', '⚙️ Espace Admin')}
        </div>
        <span style={{ fontSize: 10, background: 'var(--brass-300)', color: 'var(--tolex-900)', borderRadius: 'var(--r-sm)', padding: '2px 8px', fontWeight: 700 }}>ADMIN</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
        {t('admin.intro', 'Outils de gestion de l\'app. Tes affaires perso (guitares, banks, presets, etc.) restent dans "Mon Profil".')}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {tabBtn('profiles', t('admin.tab.profiles', '👥 Profils'))}
        {tabBtn('alluserpresets', t('admin.tab.alluserpresets', '👁 Tous presets users'))}
        {tabBtn('adminpacks', t('admin.tab.adminpacks', '📦 Packs admin'))}
        {tabBtn('tonenet', t('admin.tab.tonenet', '🌐 ToneNET'))}
        {tabBtn('maintenance', t('admin.tab.maintenance', '🔧 Maintenance'))}
        {tabBtn('ia', t('admin.tab.ia', '🔑 Clé API partagée'))}
      </div>

      {tab === 'profiles' && <ProfilesAdmin profiles={profiles} onProfiles={onProfiles}/>}

      {tab === 'alluserpresets' && (
        <AllUserPresetsTab profiles={profiles} onProfiles={onProfiles} songDb={songDb} inp={inp}/>
      )}

      {tab === 'adminpacks' && (
        <AdminPacksTab
          adminPacks={adminPacks}
          onAdminPacks={onAdminPacks}
          profile={profile}
          inp={inp}
          aiKeys={aiKeys}
          aiProvider={aiProvider}
        />
      )}

      {tab === 'tonenet' && (
        <ToneNetTab
          toneNetPresets={toneNetPresets}
          onToneNetPresets={onToneNetPresets}
          onDeletedToneNetIds={onDeletedToneNetIds}
          inp={inp}
          songDb={songDb}
        />
      )}

      {tab === 'maintenance' && MaintenanceTabComponent && (
        <MaintenanceTabComponent
          songDb={songDb}
          onSongDb={onSongDb}
          onAiCacheUpdate={onAiCacheUpdate}
          onProfiles={onProfiles}
          activeProfileId={activeProfileId}
          setlists={allSetlists}
          onSetlists={onSetlists}
          onDeletedSetlistIds={onDeletedSetlistIds}
          banksAnn={banksAnn}
          banksPlug={banksPlug}
          aiProvider={aiProvider}
          aiKeys={aiKeys}
          profile={profile}
          profiles={profiles}
          guitarBias={guitarBias}
          fullState={fullState}
          onImportState={onImportState}
        />
      )}

      {tab === 'ia' && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 12 }}>
            {t('admin.ia-intro', 'Clé API Gemini partagée avec tous les profils (via Firestore config/apikeys).')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 700 }}>Modèle actif :</span>
            <span style={{ color: 'var(--green)', fontWeight: 600 }}>
              {aiProvider === 'gemini' ? 'gemini-3-flash-preview' : 'claude-haiku-4-5'}
            </span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Clé Gemini</div>
          <input
            type="password"
            placeholder="AIza..."
            value={aiKeys.gemini}
            onChange={(e) => onAiKeys((p) => ({ ...p, gemini: e.target.value }))}
            style={{ ...inp, width: '100%', marginBottom: 8, fontFamily: 'monospace' }}
          />
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                if (!aiKeys.gemini) { window.alert('Configure d\'abord une clé Gemini.'); return; }
                if (!window.confirm('Partager ta clé Gemini avec tous les profils ?\n\n• La clé est stockée dans Firestore (config/apikeys.gemini)\n• Tous les devices la téléchargent au boot\n• Les profils sans clé personnelle l\'utiliseront en fallback\n• Les appels IA seront facturés sur ton quota Google\n\nGemini a un free tier généreux (1500 req/jour) qui suffit largement.')) return;
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
            >
              🔑 Partager la clé (tous les profils)
            </button>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', alignSelf: 'center' }}>aistudio.google.com → Get API key</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Clé Anthropic (fallback)</div>
          <input
            type="password"
            placeholder="sk-ant-..."
            value={aiKeys.anthropic}
            onChange={(e) => onAiKeys((p) => ({ ...p, anthropic: e.target.value }))}
            style={{ ...inp, width: '100%', fontFamily: 'monospace' }}
          />
        </div>
      )}

      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--a8)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
          ← {t('common.back-home', 'Retour à l\'accueil')}
        </button>
      </div>
    </div>
  );
}

export default AdminScreen;
export { AdminScreen };

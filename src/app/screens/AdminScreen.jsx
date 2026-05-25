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
import { getSharedGeminiKey, setSharedGeminiKey } from '../utils/shared-key.js';

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
  // S9.12 — État local pour le champ "Clé Gemini partagée". Initialisé
  // depuis le singleton module (getSharedGeminiKey, posé au boot via
  // loadSharedKey()). L'écriture pousse à Firestore via onSaveSharedKey
  // + update local module via setSharedGeminiKey.
  const [sharedKeyInput, setSharedKeyInput] = useState(() => getSharedGeminiKey() || '');

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
            {t('admin.ia-intro-v2', '3 clés API distinctes : partagée Firestore (tous profils), perso Gemini (toi seul), perso Anthropic (toi seul, S9.11 auto-forcé si présente).')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 12px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 700 }}>{t('admin.active-model', 'Modèle actif :')}</span>
            <span style={{ color: 'var(--green)', fontWeight: 600 }}>
              {aiProvider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gemini-3-flash-preview'}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)' }}>
              {aiProvider === 'anthropic'
                ? t('admin.using-anthropic', '🅰 Anthropic perso')
                : (aiKeys.gemini ? t('admin.using-gemini-perso', '🅖 Gemini perso') : t('admin.using-gemini-shared', '🅖 Gemini partagée'))}
            </span>
          </div>

          {/* ENTRÉE 1 — Clé Gemini partagée (Firestore) */}
          <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--a8)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>🌐 {t('admin.shared-gemini-title', 'Clé Gemini partagée (Firestore)')}</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.45 }}>
              {t('admin.shared-gemini-hint', 'Stockée dans Firestore config/apikeys. Téléchargée au boot par tous les profils. Sert de fallback aux profils SANS clé Gemini perso.')}
            </div>
            <input
              type="password"
              placeholder="AIza... (clé déjà partagée chargée depuis Firestore)"
              value={sharedKeyInput}
              onChange={(e) => setSharedKeyInput(e.target.value)}
              style={{ ...inp, width: '100%', marginBottom: 6, fontFamily: 'monospace' }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={() => {
                  if (!sharedKeyInput) { window.alert(t('admin.shared-gemini-empty', 'Saisis une clé Gemini avant de partager.')); return; }
                  if (!window.confirm(t('admin.shared-gemini-confirm', 'Mettre à jour la clé Gemini partagée ?\n\n• Stockée dans Firestore (config/apikeys.gemini)\n• Tous les devices la téléchargent au boot\n• Les profils sans clé Gemini perso l\'utiliseront en fallback\n• Les appels IA seront facturés sur le quota Google de la clé'))) return;
                  if (!onSaveSharedKey) { window.alert('saveSharedKey indisponible.'); return; }
                  onSaveSharedKey(sharedKeyInput).then(() => {
                    setSharedGeminiKey(sharedKeyInput);
                    window.alert(t('admin.shared-gemini-ok', '✓ Clé partagée mise à jour. Les autres profils l\'utiliseront au prochain reload.'));
                  }).catch((e) => {
                    console.error('[saveSharedKey] failed:', e);
                    window.alert(t('admin.shared-gemini-fail', 'Échec du partage. Vérifie ta console pour le détail.'));
                  });
                }}
                disabled={!sharedKeyInput}
                style={{ background: sharedKeyInput ? 'var(--green)' : 'var(--bg-disabled)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: sharedKeyInput ? 'pointer' : 'not-allowed' }}
              >
                🔑 {t('admin.shared-gemini-save', 'Mettre à jour la clé partagée')}
              </button>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>aistudio.google.com → Get API key</span>
            </div>
          </div>

          {/* ENTRÉE 2 — Clé Gemini perso (locale) */}
          <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--a8)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>🅖 {t('admin.perso-gemini-title', 'Clé Gemini perso (toi seul)')}</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.45 }}>
              {t('admin.perso-gemini-hint', 'Reste sur ce device (jamais syncée Firestore — Phase 7.30 strip). Prend priorité sur la clé partagée pour TES analyses. Crée une 2e clé sur un nouveau projet Google Cloud pour avoir un quota free tier indépendant (1500 req/jour).')}
            </div>
            <input
              type="password"
              placeholder="AIza..."
              value={aiKeys.gemini}
              onChange={(e) => onAiKeys((p) => ({ ...p, gemini: e.target.value }))}
              style={{ ...inp, width: '100%', fontFamily: 'monospace' }}
            />
          </div>

          {/* ENTRÉE 3 — Clé Anthropic perso (locale) */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>🅰 {t('admin.perso-anthropic-title', 'Clé Anthropic perso (toi seul)')}</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.45 }}>
              {t('admin.perso-anthropic-hint', 'Reste sur ce device (jamais syncée Firestore). S9.11 auto-force Anthropic si cette clé est présente ET tu es admin. console.anthropic.com → API Keys. ⚠ Pas inclus dans Claude.ai Pro/Max — facturation API séparée, prépaiement minimum $5.')}
            </div>
            <input
              type="password"
              placeholder="sk-ant-..."
              value={aiKeys.anthropic}
              onChange={(e) => onAiKeys((p) => ({ ...p, anthropic: e.target.value }))}
              style={{ ...inp, width: '100%', fontFamily: 'monospace' }}
            />
          </div>
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

// src/app/screens/AllUserPresetsTab.jsx — Phase 7.69.
//
// Tab admin only "👁 Tous les presets utilisateur" — vue agrégée
// sur les profile.customPacks de TOUS les profils. Permet à
// l'admin (Sébastien) de :
//   - Voir d'un coup d'œil tous les presets persos saisis par
//     les beta-testeurs
//   - Identifier les patterns communs ou les manques
//   - Éditer/supprimer un preset d'un autre profil si besoin
//     (modération, correction d'usages mal saisis, etc.)
//
// L'édition cross-profil utilise le composant MyCustomPresetsTab
// existant en injectant `activeProfileId` égal à l'id du profil
// cible (override). Le banner admin-switch Phase 7.63 ne se
// déclenche pas (l'admin reste sur son propre profil pour la
// vue, l'écriture cible un autre profil via setProfiles).
//
// Lecture-écriture stricte : pas d'opération destructive de masse.
// Bouton ✕ par preset avec confirm() classique.

import React, { useState, useMemo } from 'react';
import { t, tFormat } from '../../i18n/index.js';
import MyCustomPresetsTab from './MyCustomPresetsTab.jsx';

function AllUserPresetsTab({ profiles, onProfiles, songDb, inp }) {
  const [editingProfileId, setEditingProfileId] = useState(null);

  // Liste agrégée [{profileId, profileName, presetCount, presets:[...]}]
  // triée par nb de presets décroissant pour visibilité.
  const aggregated = useMemo(() => {
    const out = [];
    Object.entries(profiles || {}).forEach(([id, p]) => {
      if (!p || p.isDemo) return;
      const packs = p.customPacks || [];
      let count = 0;
      packs.forEach((pk) => { count += (pk.presets || []).length; });
      if (count === 0) return;
      out.push({
        profileId: id,
        profileName: p.name || id,
        isAdmin: !!p.isAdmin,
        packCount: packs.length,
        presetCount: count,
      });
    });
    out.sort((a, b) => b.presetCount - a.presetCount);
    return out;
  }, [profiles]);

  const totalPresets = aggregated.reduce((acc, x) => acc + x.presetCount, 0);

  if (editingProfileId) {
    const target = profiles[editingProfileId];
    return (
      <div>
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setEditingProfileId(null)}
            style={{ background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
          >← {t('alluserpresets.back', 'Retour à la liste')}</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              {t('alluserpresets.editing', 'Édition des presets de :')} <span style={{ color: 'var(--accent)' }}>{target?.name || editingProfileId}</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {t('alluserpresets.editing-hint', 'Mode admin : les modifications s\'appliquent au profil cible et seront synchronisées via Firestore.')}
            </div>
          </div>
        </div>
        {/* Réutilise MyCustomPresetsTab avec activeProfileId override.
            La prop `profile` est le profil cible (pas l'admin courant). */}
        <MyCustomPresetsTab
          profile={target}
          onProfiles={onProfiles}
          activeProfileId={editingProfileId}
          songDb={songDb}
          inp={inp}
        />
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 12 }}>
        {t('alluserpresets.intro', 'Vue admin : tous les presets persos saisis par les beta-testeurs. Clique sur un profil pour voir ou éditer ses presets.')}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
        {tFormat('alluserpresets.summary', { profiles: aggregated.length, presets: totalPresets }, '{profiles} profil(s) ont documenté {presets} preset(s) au total.')}
      </div>

      {aggregated.length === 0 && (
        <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📦</div>
          <div style={{ fontSize: 12 }}>{t('alluserpresets.empty', 'Aucun profil n\'a documenté de preset custom pour le moment.')}</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {aggregated.map((row) => (
          <div
            key={row.profileId}
            onClick={() => setEditingProfileId(row.profileId)}
            style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'background 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--a5)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--a4)'; }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {row.profileName}
                {row.isAdmin && <span style={{ fontSize: 9, background: 'var(--brass-300)', color: 'var(--tolex-900)', borderRadius: 'var(--r-sm)', padding: '1px 5px', fontWeight: 700 }}>ADMIN</span>}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                {tFormat('alluserpresets.count', { presets: row.presetCount, packs: row.packCount }, '{presets} preset(s) dans {packs} pack(s)')}
              </div>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>→</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AllUserPresetsTab;
export { AllUserPresetsTab };

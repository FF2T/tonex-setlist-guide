// src/app/components/profile-color.js — Phase 7.18 (découpage main.jsx).
//
// Hash déterministe d'un profileId vers une couleur de la palette
// "brass/copper/wine". Utilisé par ProfilePickerScreen, ProfileSelector,
// AppHeader, et tous les avatars de profils.

const PROFILE_COLORS = [
  'var(--brass-400)',
  'var(--copper-400)',
  'var(--wine-400)',
  'var(--brass-300)',
  'var(--copper-500)',
  'var(--brass-600)',
];

export function profileColor(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return PROFILE_COLORS[Math.abs(h) % PROFILE_COLORS.length];
}

export { PROFILE_COLORS };

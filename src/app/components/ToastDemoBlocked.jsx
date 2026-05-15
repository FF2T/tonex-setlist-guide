// src/app/components/ToastDemoBlocked.jsx — Phase 7.51.2.
//
// Toast non-intrusif affiché quand un visiteur démo tente une action
// désactivée (write profile/setlists/songDb, fetchAI, push Firestore).
// Position : fixed bottom centered. Auto-dismiss après 2.5s. Non
// dismissible manuellement (pas de bouton fermer) — c'est volontaire,
// le visiteur reçoit le feedback et continue à explorer.
//
// Props :
//   - message : string|null (null = caché)
//   - onDismiss : callback appelé après le timeout 2.5s
//
// Le composant est rendu une seule fois au niveau App, et son état est
// piloté par useState `demoToastMsg` dans App + showDemoToast() qui le
// set après chaque write bloqué. Plusieurs writes bloqués rapprochés
// dans le temps réinitialisent le timer (le toast reste affiché tant
// que des writes arrivent dans la fenêtre de 2.5s).

import React, { useEffect } from 'react';

function ToastDemoBlocked({ message, onDismiss }) {
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(() => { if (typeof onDismiss === 'function') onDismiss(); }, 2500);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--a7)',
        color: 'var(--text-bright)',
        padding: '10px 18px',
        borderRadius: 'var(--r-lg)',
        fontSize: 13,
        fontWeight: 600,
        boxShadow: 'var(--shadow-md)',
        zIndex: 99,
        opacity: 0.95,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        maxWidth: 'min(420px, calc(100vw - 32px))',
        pointerEvents: 'none', // visiteur peut continuer à cliquer derrière
      }}
    >
      <span aria-hidden="true">🔒</span>
      <span>{message}</span>
    </div>
  );
}

export default ToastDemoBlocked;
export { ToastDemoBlocked };

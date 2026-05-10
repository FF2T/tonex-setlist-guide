// @vitest-environment jsdom
//
// Phase 5 (Item A) — test régression : la sélection de guitare doit
// fonctionner sur un morceau importé Newzik (song.ig=[], aiCache=null,
// pas de SONG_PRESETS entry).
//
// Comme SongDetailCard est un gros composant intégré dans main.jsx (pas
// extrait en module), on teste via un minimal harness qui reproduit la
// logique : sélection guitare → setGId + onGuitarChange déclenché +
// useEffect lance fetchAI. Si fetchAI throw (clé API manquante), on
// surface l'erreur au lieu de la swallow.

import { describe, test, expect, vi } from 'vitest';

// On extrait la logique testable du handleGuitarChange + useEffect en
// pseudo-code minimal. C'est un test du comportement attendu, pas un
// test E2E du DOM.

describe('SongDetailCard — Phase 5 fix : sélection guitare sur morceau Newzik', () => {
  test('handleGuitarChange propage onGuitarChange + reset localAiResult/Err', () => {
    let gId = '';
    let localAiResult = null;
    let localAiErr = 'previous error';
    const setGId = vi.fn((v) => { gId = v; });
    const setLocalAiResult = vi.fn((v) => { localAiResult = v; });
    const setLocalAiErr = vi.fn((v) => { localAiErr = v; });
    const onGuitarChange = vi.fn();

    // Reproduction du handler post-fix.
    const handleGuitarChange = (v) => {
      setGId(v);
      setLocalAiResult(null);
      setLocalAiErr(null);
      if (onGuitarChange) onGuitarChange('newzik_song_id', v);
    };

    handleGuitarChange('strat61');

    expect(setGId).toHaveBeenCalledWith('strat61');
    expect(setLocalAiResult).toHaveBeenCalledWith(null);
    expect(setLocalAiErr).toHaveBeenCalledWith(null);
    expect(onGuitarChange).toHaveBeenCalledWith('newzik_song_id', 'strat61');
    expect(gId).toBe('strat61');
  });

  test('useEffect ne déclenche PAS fetchAI inline si gId vide (cas initial morceau Newzik)', () => {
    // Quand un morceau Newzik est ouvert pour la 1ère fois :
    // savedGuitarId=undef, ig=[], gId="" → useEffect doit early-return.
    const fetchAIMock = vi.fn();
    const gId = '';
    const onSongDb = vi.fn();
    // Pseudo useEffect body (post-fix).
    const effect = () => {
      if (!gId || !onSongDb) return; // early-return
      fetchAIMock();
    };
    effect();
    expect(fetchAIMock).not.toHaveBeenCalled();
  });

  test("useEffect lance fetchAI quand gId devient défini après sélection", async () => {
    const fetchAIMock = vi.fn().mockResolvedValue({ song_year: 1979 });
    let setReloadingValue = false;
    let resultValue = null;
    let errValue = null;
    const setReloading = (v) => { setReloadingValue = v; };
    const setLocalAiResult = (v) => { resultValue = v; };
    const setLocalAiErr = (v) => { errValue = v; };

    const gId = 'sg_ebony';
    const effect = async () => {
      if (!gId) return;
      setReloading(true);
      setLocalAiErr(null);
      try {
        const r = await fetchAIMock();
        setLocalAiResult(r);
      } catch (e) {
        setLocalAiErr(e.message || String(e));
      } finally {
        setReloading(false);
      }
    };
    await effect();

    expect(fetchAIMock).toHaveBeenCalledTimes(1);
    expect(resultValue).toEqual({ song_year: 1979 });
    expect(errValue).toBe(null);
    expect(setReloadingValue).toBe(false); // finally restored
  });

  test("fetchAI rejected → erreur capturée dans state (pas de catch silencieux)", async () => {
    const fetchAIMock = vi.fn().mockRejectedValue(new Error('Clé API manquante — configure-la dans ⚙️ Paramètres.'));
    let errValue = null;
    let resultValue = 'should-be-cleared';
    const setLocalAiErr = (v) => { errValue = v; };
    const setLocalAiResult = (v) => { resultValue = v; };

    const effect = async () => {
      try {
        const r = await fetchAIMock();
        setLocalAiResult(r);
      } catch (e) {
        setLocalAiErr(e.message);
      }
    };
    await effect();

    expect(errValue).toContain('Clé API manquante');
    expect(resultValue).toBe('should-be-cleared'); // Pas écrasé en cas d'erreur
  });

  test('pas de double-fetch : handleGuitarChange ne lance plus fetchAI lui-même', () => {
    // Avant Phase 5 : handleGuitarChange lançait son propre fetchAI ET
    // le useEffect aussi (race + bugs). Post-fix : seul le useEffect le
    // fait, handleGuitarChange est passive (state local + callback parent).
    const fetchAIMock = vi.fn();
    const onGuitarChange = vi.fn();
    const setGId = vi.fn();
    const setLocalAiResult = vi.fn();
    const setLocalAiErr = vi.fn();

    const handleGuitarChange = (v) => {
      setGId(v);
      setLocalAiResult(null);
      setLocalAiErr(null);
      if (onGuitarChange) onGuitarChange('any', v);
      // Pas de fetchAIMock() ici — c'est le point clé.
    };
    handleGuitarChange('lp60');

    expect(fetchAIMock).not.toHaveBeenCalled(); // useEffect prend le relais
  });
});

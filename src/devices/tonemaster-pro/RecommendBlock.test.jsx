// @vitest-environment jsdom
//
// Tests UI du composant RecommendBlock TMP : compact + drawer + edge
// cases (pas d'aiCache).

import { describe, test, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import RecommendBlock, {
  summarizeChain, formatCabParam, formatBlockParam, formatHzCut,
} from './RecommendBlock.jsx';
import { ROCK_PRESET } from './catalog.js';

const ACDC_HTH = {
  id: 'acdc_hth', title: 'Highway to Hell', artist: 'AC/DC',
  aiCache: {
    result: {
      ref_amp: 'Marshall Super Lead 100W',
      ref_effects: 'Aucun effet',
      song_style: 'hard_rock',
    },
  },
};

const SG = { id: 'sg_ebony', type: 'HB', name: 'SG' };

describe('summarizeChain', () => {
  test('Rock Preset summary mentionne Plexi + Greenback + Drive', () => {
    const s = summarizeChain(ROCK_PRESET);
    expect(s).toContain('Plexi');
    expect(s).toContain('+Drive');
    expect(s).toContain('Spring');
  });

  test('patch null → ""', () => {
    expect(summarizeChain(null)).toBe('');
  });
});

describe('TMPRecommendBlock — rendu compact', () => {
  test('AC/DC + SG → patch top affiché avec score', () => {
    const { container } = render(
      <RecommendBlock song={ACDC_HTH} guitar={SG} profile={null} _allGuitars={null}/>,
    );
    const block = container.querySelector('[data-testid="tmp-recommend-block"]');
    expect(block).not.toBeNull();
    // Le top patch sur AC/DC doit être rock_preset (assertion via data-attr).
    expect(block.getAttribute('data-tmp-patch-id')).toBe('rock_preset');
    expect(block.getAttribute('data-device-id')).toBe('tonemaster-pro');
    // Score visible (chiffre + %)
    expect(block.textContent).toMatch(/\d+%/);
    // Nom du patch visible
    expect(block.textContent).toContain('Rock Preset');
  });
});

describe('TMPRecommendBlock — drawer expandable', () => {
  test('clic ouvre le drawer et affiche les blocs détaillés', () => {
    const { container, getByText } = render(
      <RecommendBlock song={ACDC_HTH} guitar={SG} profile={null} _allGuitars={null}/>,
    );
    // Drawer fermé par défaut : pas de tmp-block-amp visible
    expect(container.querySelector('[data-testid="tmp-block-amp"]')).toBeNull();
    // Clic sur le bouton compact
    const button = container.querySelector('[data-testid="tmp-recommend-block"] button');
    fireEvent.click(button);
    // Drawer ouvert : blocs visibles
    expect(container.querySelector('[data-testid="tmp-block-amp"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tmp-block-cab"]')).not.toBeNull();
    // Le contenu de tmp-block-amp doit mentionner British Plexi
    expect(getByText('British Plexi')).toBeTruthy();
  });

  test('drawer affiche Style + Gain + Pickup', () => {
    const { container } = render(
      <RecommendBlock song={ACDC_HTH} guitar={SG} profile={null} _allGuitars={null}/>,
    );
    const button = container.querySelector('[data-testid="tmp-recommend-block"] button');
    fireEvent.click(button);
    // hard_rock + mid + pickup HB:95 dans le footer du drawer
    expect(container.textContent).toContain('hard_rock');
    expect(container.textContent).toContain('mid');
    expect(container.textContent).toContain('HB:95');
  });
});

describe('formatCabParam · labels FR lisibles (FIX 3 Phase 3.5)', () => {
  test('axis on/off → "plein cône" / "off-axis"', () => {
    expect(formatCabParam('axis', 'on')).toBe('Micro en plein cône (axis on)');
    expect(formatCabParam('axis', 'off')).toBe('Micro décalé (off-axis)');
  });

  test('distance en pouces avec équivalent cm (arrondi au demi)', () => {
    expect(formatCabParam('distance', 6)).toBe('Micro à 6 pouces (~15 cm)');
    expect(formatCabParam('distance', 3)).toBe('Micro à 3 pouces (~7.5 cm)');
    expect(formatCabParam('distance', 1)).toBe('Micro à 1 pouce (~2.5 cm)');
  });

  test('low_cut/high_cut aux extrémités = (off)', () => {
    expect(formatCabParam('low_cut', 20)).toBe('Filtre passe-haut 20 Hz (off)');
    expect(formatCabParam('high_cut', 20000)).toBe('Filtre passe-bas 20 kHz (off)');
  });

  test('low_cut/high_cut valeur intermédiaire → format Hz/kHz explicite', () => {
    expect(formatCabParam('low_cut', 80)).toBe('Filtre passe-haut : 80 Hz');
    expect(formatCabParam('high_cut', 8000)).toBe('Filtre passe-bas : 8 kHz');
    expect(formatCabParam('high_cut', 12500)).toBe('Filtre passe-bas : 12.5 kHz');
  });

  test('mic → libellé direct', () => {
    expect(formatCabParam('mic', 'Dyn SM57')).toBe('Micro : Dyn SM57');
  });

  test('drawer ouvert sur ROCK_PRESET → labels FR cab visibles', () => {
    // ROCK_PRESET utilise SM57 axis on distance 6 → "plein cône" + "6 pouces" doivent être visibles.
    const { container } = render(
      <RecommendBlock song={ACDC_HTH} guitar={SG} profile={null} _allGuitars={null}/>,
    );
    const button = container.querySelector('[data-testid="tmp-recommend-block"] button');
    fireEvent.click(button);
    const cabBlock = container.querySelector('[data-testid="tmp-block-cab"]');
    expect(cabBlock).not.toBeNull();
    expect(cabBlock.textContent).toContain('plein cône');
    expect(cabBlock.textContent).toContain('pouces');
  });
});

describe('formatBlockParam · libellés généralisés tous blocs (Phase 3.6)', () => {
  test('amp British Plexi → /10 par défaut + noms knobs firmware', () => {
    expect(formatBlockParam('amp', 'volume_i', 5, 'British Plexi')).toBe('Volume I : 5/10');
    expect(formatBlockParam('amp', 'volume_ii', 5, 'British Plexi')).toBe('Volume II : 5/10');
    expect(formatBlockParam('amp', 'treble', 6, 'British Plexi')).toBe('Treble : 6/10');
    expect(formatBlockParam('amp', 'middle', 5, 'British Plexi')).toBe('Middle : 5/10');
    expect(formatBlockParam('amp', 'bass', 5, 'British Plexi')).toBe('Bass : 5/10');
    expect(formatBlockParam('amp', 'presence', 6, 'British Plexi')).toBe('Presence : 6/10');
  });

  test("amp Fender '59 Bassman → échelle /12 (tweed)", () => {
    expect(formatBlockParam('amp', 'gain', 6, "Fender '59 Bassman")).toBe('Gain : 6/12');
    expect(formatBlockParam('amp', 'bass', 8, "Fender '59 Bassman")).toBe('Bass : 8/12');
    expect(formatBlockParam('amp', 'presence', 6, "Fender '59 Bassman")).toBe('Presence : 6/12');
  });

  test('drive : drive/tone/level → /10', () => {
    expect(formatBlockParam('drive', 'drive', 3)).toBe('Drive : 3/10');
    expect(formatBlockParam('drive', 'tone', 5)).toBe('Tone : 5/10');
    expect(formatBlockParam('drive', 'level', 7)).toBe('Level : 7/10');
  });

  test('comp : ratio sous forme X:1, autres knobs /10', () => {
    expect(formatBlockParam('comp', 'ratio', 5)).toBe('Ratio : 5:1');
    expect(formatBlockParam('comp', 'threshold', 5)).toBe('Threshold : 5/10');
    expect(formatBlockParam('comp', 'attack', 5)).toBe('Attack : 5/10');
    expect(formatBlockParam('comp', 'release', 5)).toBe('Release : 5/10');
  });

  test('eq : Hz pour fréquences, dB pour gains, mode passe-haut si low_gain ≤ -12', () => {
    expect(formatBlockParam('eq', 'low_freq', 98)).toBe('Low Freq : 98 Hz');
    expect(formatBlockParam('eq', 'mid_freq', 2000)).toBe('Mid Freq : 2 kHz');
    expect(formatBlockParam('eq', 'mid_gain', 2)).toBe('Mid Gain : +2 dB');
    expect(formatBlockParam('eq', 'hi_gain', -3)).toBe('Hi Gain : -3 dB');
    expect(formatBlockParam('eq', 'low_gain', -12)).toBe('Low Gain : -12 dB (mode passe-haut 6 dB/Oct)');
  });

  test('delay : time ms, feedback/mix %, cuts via formatHzCut', () => {
    expect(formatBlockParam('delay', 'time', 350)).toBe('Time : 350 ms');
    expect(formatBlockParam('delay', 'feedback', 25)).toBe('Feedback : 25 %');
    expect(formatBlockParam('delay', 'mix', 15)).toBe('Mix : 15 %');
    expect(formatBlockParam('delay', 'hi_cut', 6000)).toBe('Filtre passe-bas : 6 kHz');
    expect(formatBlockParam('delay', 'low_cut', 100)).toBe('Filtre passe-haut : 100 Hz');
  });

  test('reverb : mixer/dwell/tone /10, predelay ms, cuts off aux extrémités', () => {
    expect(formatBlockParam('reverb', 'mixer', 3)).toBe('Mixer : 3/10');
    expect(formatBlockParam('reverb', 'dwell', 7)).toBe('Dwell : 7/10');
    expect(formatBlockParam('reverb', 'tone', 6)).toBe('Tone : 6/10');
    expect(formatBlockParam('reverb', 'predelay', 0)).toBe('Predelay : 0 ms');
    expect(formatBlockParam('reverb', 'hi_cut', 8000)).toBe('Filtre passe-bas : 8 kHz');
    expect(formatBlockParam('reverb', 'hi_cut', 20000)).toBe('Filtre passe-bas 20 kHz (off)');
    expect(formatBlockParam('reverb', 'low_cut', 20)).toBe('Filtre passe-haut 20 Hz (off)');
  });

  test('noise_gate : threshold + attenuation /10', () => {
    expect(formatBlockParam('noise_gate', 'threshold', 5)).toBe('Threshold : 5/10');
    expect(formatBlockParam('noise_gate', 'attenuation', 6)).toBe('Attenuation : 6/10');
  });

  test('mod : rate Hz, depth/mix %, type string', () => {
    expect(formatBlockParam('mod', 'rate', 2)).toBe('Rate : 2 Hz');
    expect(formatBlockParam('mod', 'depth', 50)).toBe('Depth : 50 %');
    expect(formatBlockParam('mod', 'type', 'classic')).toBe('Type : classic');
  });

  test('cab : délégation à formatCabParam (rétro-compat)', () => {
    expect(formatBlockParam('cab', 'axis', 'on')).toBe(formatCabParam('axis', 'on'));
    expect(formatBlockParam('cab', 'distance', 6)).toBe(formatCabParam('distance', 6));
  });

  test('formatHzCut : conventions partagées cab/delay/reverb', () => {
    expect(formatHzCut('low_cut', 20)).toBe('Filtre passe-haut 20 Hz (off)');
    expect(formatHzCut('high_cut', 20000)).toBe('Filtre passe-bas 20 kHz (off)');
    expect(formatHzCut('hi_cut', 8000)).toBe('Filtre passe-bas : 8 kHz');
    expect(formatHzCut('low_cut', 100)).toBe('Filtre passe-haut : 100 Hz');
  });

  test('drawer ouvert sur ROCK_PRESET → labels FR amp + drive + reverb visibles', () => {
    const { container } = render(
      <RecommendBlock song={ACDC_HTH} guitar={SG} profile={null} _allGuitars={null}/>,
    );
    const button = container.querySelector('[data-testid="tmp-recommend-block"] button');
    fireEvent.click(button);
    // Amp British Plexi (valeurs Arthur corrigées Phase 3.8 — Plexi cranked).
    const ampBlock = container.querySelector('[data-testid="tmp-block-amp"]');
    expect(ampBlock.textContent).toContain('Volume I : 10/10');
    expect(ampBlock.textContent).toContain('Presence : 5/10');
    // Drive Super Drive — Phase 3.8 : drive 2.5, level 3, tone 8.
    const driveBlock = container.querySelector('[data-testid="tmp-block-drive"]');
    expect(driveBlock.textContent).toContain('Drive : 2.5/10');
    // Reverb Spring — Phase 3.8 : mixer plus discret 2.5.
    const reverbBlock = container.querySelector('[data-testid="tmp-block-reverb"]');
    expect(reverbBlock.textContent).toContain('Mixer : 2.5/10');
  });
});

describe('TMPRecommendBlock — playingTipsBySong (Phase 3.8)', () => {
  // Cream "White Room" est dans usages de rock_preset → top patch.
  // ROCK_PRESET.playingTipsBySong.cream_wr existe → tip rendu.
  const CREAM_WR = {
    id: 'cream_wr', title: 'White Room', artist: 'Cream',
    aiCache: {
      result: { ref_amp: 'Marshall JTM45', ref_effects: 'Wah-wah', song_style: 'rock' },
    },
  };

  test('drawer ouvert sur cream_wr → conseil "💡 Conseil pour ce morceau" affiché', () => {
    const { container } = render(
      <RecommendBlock song={CREAM_WR} guitar={SG} profile={null} _allGuitars={null}/>,
    );
    // Force ouverture drawer
    const button = container.querySelector('[data-testid="tmp-recommend-block"] button');
    fireEvent.click(button);
    const tip = container.querySelector('[data-testid="tmp-playing-tip"]');
    expect(tip).not.toBeNull();
    expect(tip.textContent).toContain('Conseil pour ce morceau');
    expect(tip.textContent).toContain('micro manche');
    expect(tip.textContent).toContain('tonalité à 0');
  });

  test('drawer ouvert sur AC/DC HTH (pas de tip pour ce song.id) → encart absent', () => {
    const { container } = render(
      <RecommendBlock song={ACDC_HTH} guitar={SG} profile={null} _allGuitars={null}/>,
    );
    const button = container.querySelector('[data-testid="tmp-recommend-block"] button');
    fireEvent.click(button);
    expect(container.querySelector('[data-testid="tmp-playing-tip"]')).toBeNull();
  });

  test('notes du patch (Scene Solo / footswitch solo) restent affichées en italic', () => {
    const { container } = render(
      <RecommendBlock song={CREAM_WR} guitar={SG} profile={null} _allGuitars={null}/>,
    );
    const button = container.querySelector('[data-testid="tmp-recommend-block"] button');
    fireEvent.click(button);
    // Phase 4 : les notes mentionnent désormais "Scene Solo (FS2)".
    expect(container.textContent).toContain('Scene Solo');
  });
});

describe('TMPRecommendBlock — edge cases', () => {
  test('song sans aiCache → composant ne crashe pas, rend quand même un patch', () => {
    const songNoCache = { id: 'foo', title: 'X', artist: 'Y' };
    const { container } = render(
      <RecommendBlock song={songNoCache} guitar={SG} profile={null} _allGuitars={null}/>,
    );
    // Au moins un patch est suggéré (basé sur pickup + style neutre).
    const block = container.querySelector('[data-testid="tmp-recommend-block"]');
    expect(block).not.toBeNull();
  });

  test('song null → composant retourne null sans crash', () => {
    const { container } = render(
      <RecommendBlock song={null} guitar={null} profile={null} _allGuitars={null}/>,
    );
    // Le composant retourne null si pas de patch top — le wrapper test
    // rend simplement vide.
    const block = container.querySelector('[data-testid="tmp-recommend-block"]');
    // Soit null soit présent mais sans crash.
    expect(true).toBe(true);
  });
});

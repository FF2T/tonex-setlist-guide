// src/app/styles/tokens.test.js — Phase 7.55.7 S6 (S6-1).

import { describe, it, expect } from 'vitest';
import {
  TYPO, WEIGHT,
  TEXT_1, TEXT_2, TEXT_3,
  BG_1, BG_2, BG_ACCENT,
  BORDER_SUBTLE, BORDER_STRONG, BORDER_ACCENT,
  badgeScore, badgeSlot, badgeLabel, badgePill, badgeTag,
  sectionCard, sectionTitle,
  tile, chip,
} from './tokens.js';

describe('TYPO tokens', () => {
  it('expose 4 niveaux principaux + 2 display, valeurs croissantes', () => {
    expect(TYPO.micro).toBe(9);
    expect(TYPO.meta).toBe(10);
    expect(TYPO.body).toBe(12);
    expect(TYPO.emph).toBe(14);
    expect(TYPO.xl).toBe(20);
    expect(TYPO['2xl']).toBe(32);
  });
  it('est figé (Object.freeze)', () => {
    expect(Object.isFrozen(TYPO)).toBe(true);
  });
});

describe('WEIGHT tokens', () => {
  it('expose 4 niveaux 400/600/700/800', () => {
    expect(WEIGHT.normal).toBe(400);
    expect(WEIGHT.medium).toBe(600);
    expect(WEIGHT.bold).toBe(700);
    expect(WEIGHT.black).toBe(800);
  });
  it('est figé', () => {
    expect(Object.isFrozen(WEIGHT)).toBe(true);
  });
});

describe('Couleurs sémantiques (canoniques)', () => {
  it('TEXT_1/2/3 pointent sur --text-primary/secondary/tertiary', () => {
    expect(TEXT_1).toBe('var(--text-primary)');
    expect(TEXT_2).toBe('var(--text-secondary)');
    expect(TEXT_3).toBe('var(--text-tertiary)');
  });
  it('BG_1/2 pointent sur --bg-elev-1/2 + BG_ACCENT sur --accent-soft', () => {
    expect(BG_1).toBe('var(--bg-elev-1)');
    expect(BG_2).toBe('var(--bg-elev-2)');
    expect(BG_ACCENT).toBe('var(--accent-soft)');
  });
  it('BORDER_SUBTLE/STRONG pointent canoniquement', () => {
    expect(BORDER_SUBTLE).toBe('var(--border-subtle)');
    expect(BORDER_STRONG).toBe('var(--border-strong)');
    expect(BORDER_ACCENT).toBe('var(--border-accent)');
  });
});

describe('badgeScore', () => {
  it('produit style mono bold avec color/bg dynamiques et border alpha 30%', () => {
    const s = badgeScore({ color: '#abc', bg: 'rgba(1,2,3,0.1)' });
    expect(s.fontFamily).toBe('var(--font-mono)');
    expect(s.fontSize).toBe(10);
    expect(s.fontWeight).toBe(800);
    expect(s.color).toBe('#abc');
    expect(s.background).toBe('rgba(1,2,3,0.1)');
    expect(s.border).toBe('1px solid #abc30');
    expect(s.borderRadius).toBe('var(--r-sm)');
    expect(s.padding).toBe('1px 6px');
  });
});

describe('badgeSlot', () => {
  it('produit style avec bg `${color}18` et border `${color}40`', () => {
    const s = badgeSlot({ color: '#def' });
    expect(s.fontSize).toBe(10);
    expect(s.background).toBe('#def18');
    expect(s.border).toBe('1px solid #def40');
    expect(s.fontWeight).toBe(700);
  });
});

describe('badgeLabel', () => {
  it('produit style avec color + bg + truncate (overflow ellipsis)', () => {
    const s = badgeLabel({ color: '#fff', bg: 'rgba(255,255,255,0.05)' });
    expect(s.color).toBe('#fff');
    expect(s.background).toBe('rgba(255,255,255,0.05)');
    expect(s.border).toBe('1px solid #fff30');
    expect(s.overflow).toBe('hidden');
    expect(s.textOverflow).toBe('ellipsis');
    expect(s.whiteSpace).toBe('nowrap');
  });
  it('bg absent → transparent + border none si color absent', () => {
    const s = badgeLabel({});
    expect(s.background).toBe('transparent');
    expect(s.border).toBe('none');
  });
});

describe('badgePill', () => {
  it('produit style neutre BG_1 + border subtle + UI font par défaut', () => {
    const s = badgePill();
    expect(s.fontSize).toBe(10);
    expect(s.color).toBe(TEXT_2);
    expect(s.background).toBe(BG_1);
    expect(s.border).toBe(`1px solid ${BORDER_SUBTLE}`);
    expect(s.fontFamily).toBe('var(--font-ui)');
    expect(s.whiteSpace).toBe('nowrap');
  });
  it('mono=true → utilise font-mono (pour potards)', () => {
    const s = badgePill({ mono: true });
    expect(s.fontFamily).toBe('var(--font-mono)');
  });
});

describe('badgeTag', () => {
  it('actif (défaut) → accent color + accent bg + uppercase', () => {
    const s = badgeTag();
    expect(s.fontSize).toBe(9);
    expect(s.color).toBe('var(--accent)');
    expect(s.background).toBe(BG_ACCENT);
    expect(s.textTransform).toBe('uppercase');
  });
  it('inactif → TEXT_3 + transparent + border subtle', () => {
    const s = badgeTag({ active: false });
    expect(s.color).toBe(TEXT_3);
    expect(s.background).toBe('transparent');
    expect(s.border).toBe(`1px solid ${BORDER_SUBTLE}`);
  });
});

describe('sectionCard', () => {
  it('défaut : BG_1 + border subtle + radius lg + padding 10×12', () => {
    const s = sectionCard();
    expect(s.background).toBe(BG_1);
    expect(s.border).toBe(`1px solid ${BORDER_SUBTLE}`);
    expect(s.borderRadius).toBe('var(--r-lg)');
    expect(s.padding).toBe('10px 12px');
  });
  it('accent=true → BG_ACCENT + border accent', () => {
    const s = sectionCard({ accent: true });
    expect(s.background).toBe(BG_ACCENT);
    expect(s.border).toBe(`1px solid ${BORDER_ACCENT}`);
  });
});

describe('sectionTitle', () => {
  it('produit micro uppercase mono avec letterSpacing', () => {
    const s = sectionTitle();
    expect(s.fontSize).toBe(9);
    expect(s.fontWeight).toBe(700);
    expect(s.color).toBe(TEXT_3);
    expect(s.fontFamily).toBe('var(--font-mono)');
    expect(s.textTransform).toBe('uppercase');
    expect(s.letterSpacing).toBe('var(--tracking-wider)');
    expect(s.display).toBe('flex');
  });
});

describe('tile (PresetBrowser massive tiles)', () => {
  it('inactif : TEXT_1 + BG_1 + body fontSize 12 + padding 10×14', () => {
    const s = tile();
    expect(s.fontSize).toBe(12);
    expect(s.fontWeight).toBe(600);
    expect(s.color).toBe(TEXT_1);
    expect(s.background).toBe(BG_1);
    expect(s.padding).toBe('10px 14px');
    expect(s.transition).toBe('all .15s');
  });
  it('active : accent color + accent bg + bold', () => {
    const s = tile({ active: true });
    expect(s.fontWeight).toBe(700);
    expect(s.color).toBe('var(--accent)');
    expect(s.background).toBe(BG_ACCENT);
  });
});

describe('chip (filtres compacts)', () => {
  it('inactif : TEXT_2 + BG_1 + meta fontSize 10 + padding 10×12 (v9.7.9 tactile iPad)', () => {
    const s = chip();
    expect(s.fontSize).toBe(10);
    expect(s.fontWeight).toBe(600);
    expect(s.color).toBe(TEXT_2);
    expect(s.padding).toBe('10px 12px');
    expect(s.minHeight).toBe(40);
    expect(s.whiteSpace).toBe('nowrap');
  });
  it('active : accent + bold', () => {
    const s = chip({ active: true });
    expect(s.fontWeight).toBe(700);
    expect(s.color).toBe('var(--accent)');
  });
});

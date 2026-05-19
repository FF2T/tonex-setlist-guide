// src/app/utils/csv-helpers.test.js — Phase 7.69.1
//
// Régression : parseCSV doit gérer le cas "CSV double-quoted"
// (Excel/Numbers re-quote un fichier déjà quoté lors d'un Save As).
// Chaque ligne entière est wrappée d'une paire de guillemets
// externes + guillemets internes doublés (`""`).
//
// Cas réel rapporté 2026-05-19 : ToneX_Anniversary_test.csv exporté
// depuis Backline puis ré-ouvert/sauvé via Excel.

import { describe, it, expect } from 'vitest';
import { parseCSV } from './csv-helpers.js';

describe('parseCSV — format standard (long)', () => {
  it('parse un CSV standard long-format', () => {
    const text = [
      'Pédale,Bank,Catégorie,Slot,Type,Preset',
      'ToneX Anniversary,0,,A,Clean,TSR Mars Clean',
      'ToneX Anniversary,0,,B,Drive,TSR Mars Drive',
      'ToneX Anniversary,0,,C,Lead,TSR Mars Lead',
      'ToneX Plug,5,,A,Clean,Plug Clean',
    ].join('\n');
    const r = parseCSV(text);
    expect(r).not.toBeNull();
    expect(r.ann[0]).toEqual({ cat: '', A: 'TSR Mars Clean', B: 'TSR Mars Drive', C: 'TSR Mars Lead' });
    expect(r.plug[5].A).toBe('Plug Clean');
  });
});

describe('parseCSV — format standard (wide)', () => {
  it('parse un CSV standard wide-format (Preset A/B/C colonnes)', () => {
    const text = [
      'Pédale,Bank,Catégorie,Preset A,Preset B,Preset C',
      'ToneX Anniversary,0,,A1,B1,C1',
      'ToneX Anniversary,1,,A2,B2,C2',
    ].join('\n');
    const r = parseCSV(text);
    expect(r).not.toBeNull();
    expect(r.ann[0]).toEqual({ cat: '', A: 'A1', B: 'B1', C: 'C1' });
    expect(r.ann[1]).toEqual({ cat: '', A: 'A2', B: 'B2', C: 'C2' });
  });
});

describe('parseCSV — CSV double-quoted (Phase 7.69.1)', () => {
  // Format pathologique : chaque ligne entière est wrappée d'une
  // paire de quotes externes + guillemets internes doublés. Cas
  // réel Excel/Numbers re-export.
  it('détecte et unwrap CSV double-quoted', () => {
    const text = [
      '"Pédale,""Bank"",""Catégorie"",""Slot"",""Type"",""Preset"""',
      '"ToneX Anniversary,""0"","""",""A"",""Clean"",""TSR Mars Clean"""',
      '"ToneX Anniversary,""0"","""",""B"",""Drive"",""TSR Mars Drive"""',
      '"ToneX Anniversary,""0"","""",""C"",""Lead"",""TSR Mars Lead"""',
    ].join('\n');
    const r = parseCSV(text);
    expect(r).not.toBeNull();
    expect(r.ann[0]).toEqual({ cat: '', A: 'TSR Mars Clean', B: 'TSR Mars Drive', C: 'TSR Mars Lead' });
  });

  it('CSV double-quoted complet (50 banks ann)', () => {
    const lines = ['"Pédale,""Bank"",""Catégorie"",""Slot"",""Type"",""Preset"""'];
    for (let b = 0; b < 50; b++) {
      lines.push(`"ToneX Anniversary,""${b}"","""",""A"",""Clean"",""Preset ${b}A"""`);
      lines.push(`"ToneX Anniversary,""${b}"","""",""B"",""Drive"",""Preset ${b}B"""`);
      lines.push(`"ToneX Anniversary,""${b}"","""",""C"",""Lead"",""Preset ${b}C"""`);
    }
    const r = parseCSV(lines.join('\n'));
    expect(r).not.toBeNull();
    expect(Object.keys(r.ann)).toHaveLength(50);
    expect(r.ann[0].A).toBe('Preset 0A');
    expect(r.ann[49].C).toBe('Preset 49C');
  });

  it('détection robuste : ligne sans `""` interne → traité comme standard', () => {
    // Une ligne simple `"text"` ne doit pas être unwrappée car elle
    // ne contient pas de `""` doublé interne. C'est juste une cellule
    // unique quoted.
    const text = [
      '"Pédale","Bank","Catégorie","Slot","Type","Preset"',
      'ToneX Anniversary,0,,A,Clean,SimpleClean',
    ].join('\n');
    const r = parseCSV(text);
    expect(r).not.toBeNull();
    expect(r.ann[0].A).toBe('SimpleClean');
  });

  it('mix double-quoted partiel (header double + corps standard) → pas unwrap', () => {
    // Si TOUTES les lignes ne matchent pas le pattern, on ne unwrap pas.
    // Évite false positive.
    const text = [
      '"Pédale,""Bank"",""Slot"",""Preset"""',
      'ToneX Anniversary,0,A,SomePreset',
    ].join('\n');
    const r = parseCSV(text);
    // Le header est unique colonne géante → iBank === -1 → null.
    // C'est OK : si l'utilisateur a un CSV mixte foireux, on retourne
    // null plutôt que de mal parser silencieusement.
    expect(r).toBeNull();
  });
});

describe('parseCSV — erreurs', () => {
  it('texte vide → null', () => {
    expect(parseCSV('')).toBeNull();
  });
  it('1 seule ligne → null', () => {
    expect(parseCSV('Pédale,Bank,Slot,Preset')).toBeNull();
  });
  it('headers manquants (pas de Bank) → null', () => {
    const text = ['Foo,Bar,Baz', 'a,b,c'].join('\n');
    expect(parseCSV(text)).toBeNull();
  });
});

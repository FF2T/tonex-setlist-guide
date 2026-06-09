// src/app/utils/parse-pack-listing.test.js — Phase 7.69.7

import { describe, it, expect } from 'vitest';
import { parsePackListing } from './parse-pack-listing.js';

describe('parsePackListing — format unzip -l', () => {
  it('parse listing unzip standard', () => {
    const text = [
      'Archive:  TSR-Bumble-Deluxe-Pack.zip',
      '  Length      Date    Time    Name',
      '---------  ---------- -----   ----',
      '   123456  2024-01-15 14:32   TSR Bumble DLX CLN 1.txp',
      '   234567  2024-01-15 14:32   TSR Bumble DLX CLN 2.txp',
      '   345678  2024-01-15 14:32   TSR Bumble DLX Drive 1.txp',
      '---------                     -------',
      '   703701                     3 files',
    ].join('\n');
    const r = parsePackListing(text);
    expect(r.archiveName).toBe('TSR-Bumble-Deluxe-Pack');
    expect(r.presets).toEqual([
      'TSR Bumble DLX CLN 1',
      'TSR Bumble DLX CLN 2',
      'TSR Bumble DLX Drive 1',
    ]);
  });

  it('strip path prefix dans les noms de fichiers', () => {
    const text = [
      'Archive:  pack.zip',
      '  Length      Date    Time    Name',
      '---------  ---------- -----   ----',
      '   123456  2024-01-15 14:32   subfolder/TSR Foo.txp',
      '   234567  2024-01-15 14:32   subfolder/nested/Bar.txp',
    ].join('\n');
    const r = parsePackListing(text);
    expect(r.presets).toEqual(['TSR Foo', 'Bar']);
  });

  it('dédoublonne', () => {
    const text = [
      'Archive:  dup.zip',
      '   100  2024-01-15 14:32   foo.txp',
      '   200  2024-01-15 14:32   foo.txp',
      '   300  2024-01-15 14:32   bar.txp',
    ].join('\n');
    const r = parsePackListing(text);
    expect(r.presets).toEqual(['foo', 'bar']);
  });

  it('archive name strip .zip', () => {
    const r = parsePackListing('Archive:  MyPack.zip\n   100 2024-01-15 14:32 a.txp');
    expect(r.archiveName).toBe('MyPack');
  });

  it('archive name strip path', () => {
    const r = parsePackListing('Archive:  /path/to/Foo.zip\n   100 2024-01-15 14:32 a.txp');
    expect(r.archiveName).toBe('Foo');
  });
});

describe('parsePackListing — format ls / find', () => {
  it('parse ls *.txp simple', () => {
    const text = [
      'TSR Bumble DLX CLN 1.txp',
      'TSR Bumble DLX CLN 2.txp',
      'TSR Bumble DLX Drive 1.txp',
    ].join('\n');
    const r = parsePackListing(text);
    expect(r.archiveName).toBeNull();
    expect(r.presets).toHaveLength(3);
    expect(r.presets[0]).toBe('TSR Bumble DLX CLN 1');
  });

  it('parse find . -name *.txp avec ./', () => {
    const text = [
      './TSR Foo.txp',
      './subfolder/TSR Bar.txp',
      './subfolder/nested/Baz.txp',
    ].join('\n');
    const r = parsePackListing(text);
    expect(r.presets).toEqual(['TSR Foo', 'TSR Bar', 'Baz']);
  });
});

describe('parsePackListing — liste brute sans extension', () => {
  it('parse 1 nom par ligne sans .txp', () => {
    const text = [
      'TSR Mars 800SL Cn1 Clean',
      'TSR Mars 800SL Cn1 Drive',
      'TSR Mars 800SL Cn2 Lead',
    ].join('\n');
    const r = parsePackListing(text);
    expect(r.presets).toHaveLength(3);
    expect(r.presets[0]).toBe('TSR Mars 800SL Cn1 Clean');
  });

  it('skip lignes vides', () => {
    const text = 'Foo\n\n\nBar\n\n';
    const r = parsePackListing(text);
    expect(r.presets).toEqual(['Foo', 'Bar']);
  });
});

describe('parsePackListing — artefacts à ignorer', () => {
  it('skip header Length Date Time Name', () => {
    const text = '  Length      Date    Time    Name\n   100 2024-01-15 14:32 foo.txp';
    const r = parsePackListing(text);
    expect(r.presets).toEqual(['foo']);
  });

  it('skip séparateurs ---', () => {
    const text = '---------  ---------- -----   ----\n   100 2024-01-15 14:32 foo.txp';
    const r = parsePackListing(text);
    expect(r.presets).toEqual(['foo']);
  });

  it('skip footer total / N files', () => {
    const text = [
      '   100 2024-01-15 14:32 foo.txp',
      '---------                     -------',
      '   100                        1 files',
    ].join('\n');
    const r = parsePackListing(text);
    expect(r.presets).toEqual(['foo']);
  });
});

describe('parsePackListing — edge cases', () => {
  it('inputs falsy → vide', () => {
    expect(parsePackListing(null)).toEqual({ archiveName: null, presets: [] });
    expect(parsePackListing(undefined)).toEqual({ archiveName: null, presets: [] });
    expect(parsePackListing('')).toEqual({ archiveName: null, presets: [] });
    expect(parsePackListing(123)).toEqual({ archiveName: null, presets: [] });
  });

  it('ne casse pas sur lignes contenant des tabs (skip)', () => {
    const text = 'foo\tbar\nbaz.txp';
    const r = parsePackListing(text);
    expect(r.presets).toEqual(['baz']);
  });

  it('garde les "/" des noms bruts (amplis vintage) — anomalie A 2026-06-09', () => {
    const text = [
      'VOX AC30/4 Fawn EF86',
      '1964 Marshall JTM-45 Clapton knobs / Radiospares OT',
    ].join('\n');
    const r = parsePackListing(text);
    expect(r.presets).toEqual([
      'VOX AC30/4 Fawn EF86',
      '1964 Marshall JTM-45 Clapton knobs / Radiospares OT',
    ]);
  });

  it('strip le préfixe de chemin uniquement pour les vrais .txp', () => {
    const text = 'folder/sub/Mesa Rectifier Modern.txp';
    const r = parsePackListing(text);
    expect(r.presets).toEqual(['Mesa Rectifier Modern']);
  });

  it('cas réel mixte : unzip -l + names with special chars', () => {
    const text = [
      'Archive:  TSR-Mix-Pack.zip',
      '   100 2024-01-15 14:32 TSR Mars 800SL Cn1&2 HG.txp',
      '   200 2024-01-15 14:32 Kirk & James - Gasoline v2.txp',
      '   300 2024-01-15 14:32 Maiden Pack | Fear Of The Solo.txp',
    ].join('\n');
    const r = parsePackListing(text);
    expect(r.archiveName).toBe('TSR-Mix-Pack');
    expect(r.presets).toEqual([
      'TSR Mars 800SL Cn1&2 HG',
      'Kirk & James - Gasoline v2',
      'Maiden Pack | Fear Of The Solo',
    ]);
  });
});

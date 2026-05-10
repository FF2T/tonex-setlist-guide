// src/core/setlists.js — extrait depuis main.jsx (Phase 1, étape 3).
// La setlist initiale "Ma Setlist" agrège tous les morceaux de
// INIT_SONG_DB_META.

import { INIT_SONG_DB_META } from './songs.js';

const INIT_SETLISTS = [{id:"sl_main",name:"Ma Setlist",songIds:INIT_SONG_DB_META.map(s=>s.id)}];

export { INIT_SETLISTS };

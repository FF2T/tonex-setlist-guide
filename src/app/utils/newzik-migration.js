// src/app/utils/newzik-migration.js — Phase 7.23 (découpage main.jsx).
//
// Migration one-time des setlists Newzik historiques de Sébastien.
// Crée 2 setlists ("Cours Franck B" + "Arthur & Seb") et fusionne
// "Nouvelle setlist" → "Ma Setlist". Idempotent — voir computeNewzikCreateNames
// / computeNewzikMergeNames dans core/state.js pour la gate logic.
//
// Cette migration est device-local : elle ne tourne que sur les devices
// qui n'ont pas encore les setlists migrées (gate par firestoreLoaded
// dans App, vérifie après sync remote pour éviter de recréer ce que
// Firestore a déjà importé).

import { computeNewzikCreateNames, computeNewzikMergeNames } from '../../core/state.js';
import { findDuplicateSong } from './song-helpers.js';

// Données statiques des 3 listes Newzik historiques. Format : [titre, artiste].
const LISTS = {
  'Cours Franck B': [
    ['Play That Funky Music', 'Wild Cherry'], ['I Got All You Need', 'Joe Bonamassa'],
    ['The Thrill Is Gone', 'B.B. King'], ['Ticket to Ride', 'The Beatles'],
    ['You Shook Me All Night Long', 'AC/DC'], ['Day Tripper', 'The Beatles'],
    ['Johnny B. Goode', 'Chuck Berry'], ['Sarbacane', 'Francis Cabrel'],
    ['Immortels', 'Alain Bashung'], ["Knockin' on Heaven's Door", "Guns N' Roses"],
    ['Motherless Child', 'Eric Clapton'], ['Come Together', 'The Beatles'],
    ['Crazy Little Thing Called Love', 'Queen'], ['Satisfaction', 'The Rolling Stones'],
    ['Romeo and Juliet', 'Dire Straits'], ['Tush', 'ZZ Top'],
    ['Devil Inside', 'INXS'], ['Bohemian Rhapsody', 'Queen'],
    ['Should I Stay or Should I Go', 'The Clash'], ["I've All I Need", 'Liam Gallagher'],
    ['The Power of Love', 'Huey Lewis and The News'], ['Brothers in Arms', 'Dire Straits'],
    ["What's Up", '4 Non Blondes'], ['Thunderstruck', 'AC/DC'],
    ['Stairway to Heaven', 'Led Zeppelin'], ['Walk of Life', 'Dire Straits'],
    ['Flipper', 'Téléphone'], ['Hoochie Coochie Man', 'Muddy Waters'],
    ['Smoke on the Water', 'Deep Purple'], ['Autumn Leaves', 'Standard Jazz'],
    ['Space Oddity', 'David Bowie'], ['Heroes', 'David Bowie'],
    ['White Room', 'Cream'], ['Still Loving You', 'Scorpions'],
    ['Another One Bites the Dust', 'Queen'], ['Highway to Hell', 'AC/DC'],
    ['No Surprises', 'Radiohead'], ['Paranoid', 'Black Sabbath'],
    ['Under Pressure', 'Queen'], ['TNT', 'AC/DC'],
    ['Money for Nothing', 'Dire Straits'], ['La Grange', 'ZZ Top'],
    ['Calling Elvis', 'Dire Straits'], ['Sunshine of Your Love', 'Cream'],
    ['Black Magic Woman', 'Peter Green'],
  ],
  'Arthur & Seb': [
    ['Back in Black', 'AC/DC'], ['Flipper', 'Téléphone'],
    ['Highway to Hell', 'AC/DC'], ['Hoochie Coochie Man', 'Muddy Waters'],
    ['Money for Nothing', 'Dire Straits'], ['Smoke on the Water', 'Deep Purple'],
    ['Stairway to Heaven', 'Led Zeppelin'], ['The Thrill Is Gone', 'B.B. King'],
    ['Thunderstruck', 'AC/DC'], ['TNT', 'AC/DC'],
    ['White Room', 'Cream'], ['You Shook Me All Night Long', 'AC/DC'],
    ['Autumn Leaves', 'Standard Jazz'], ['Black Magic Woman', 'Peter Green'],
    ['Bohemian Rhapsody', 'Queen'], ['Calling Elvis', 'Dire Straits'],
    ['Come Together', 'The Beatles'], ['Day Tripper', 'The Beatles'],
    ['Hells Bells', 'AC/DC'], ['I Got All You Need', 'Joe Bonamassa'],
    ['Johnny B. Goode', 'Chuck Berry'], ["Knockin' on Heaven's Door", "Guns N' Roses"],
    ['La Grange', 'ZZ Top'], ['Paranoid', 'Black Sabbath'],
    ['Sunshine of Your Love', 'Cream'], ['Ticket to Ride', 'The Beatles'],
    ['Under Pressure', 'Queen'], ['Walk of Life', 'Dire Straits'],
  ],
  'Nouvelle setlist': [
    ['Black Magic Woman', 'Peter Green'], ['Sunshine of Your Love', 'Cream'],
    ['Calling Elvis', 'Dire Straits'], ['La Grange', 'ZZ Top'],
    ['Smoke on the Water', 'Deep Purple'], ['Space Oddity', 'David Bowie'],
    ['Paranoid', 'Black Sabbath'], ['TNT', 'AC/DC'],
    ['Your Song', 'Elton John'], ['Stairway to Heaven', 'Led Zeppelin'],
    ['Flipper', 'Téléphone'], ['Walk of Life', 'Dire Straits'],
    ['Autumn Leaves', 'Standard Jazz'], ['Hoochie Coochie Man', 'Muddy Waters'],
    ['Heroes', 'David Bowie'], ['Under Pressure', 'Queen'],
    ['Money for Nothing', 'Dire Straits'], ['No Surprises', 'Radiohead'],
    ['Highway to Hell', 'AC/DC'], ['White Room', 'Cream'],
    ['Still Loving You', 'Scorpions'], ['Thunderstruck', 'AC/DC'],
    ['I Got All You Need', 'Joe Bonamassa'], ['Play That Funky Music', 'Wild Cherry'],
    ['Johnny B. Goode', 'Chuck Berry'], ['Ticket to Ride', 'The Beatles'],
    ["What's Up", '4 Non Blondes'], ['Should I Stay or Should I Go', 'The Clash'],
    ["I've All I Need", 'Liam Gallagher'], ['Bohemian Rhapsody', 'Queen'],
    ['Devil Inside', 'INXS'], ['Tush', 'ZZ Top'],
    ["I Can't Dance", 'Genesis'], ['Fly Me to the Moon', 'Frank Sinatra'],
    ['Sultans of Swing', 'Dire Straits'], ['Self Esteem', 'The Offspring'],
    ['Change the World', 'The Offspring'], ['Come Out and Play', 'The Offspring'],
    ["Don't Look Back in Anger", 'Oasis'], ['Godfather Theme', "Guns N' Roses"],
    ['La Javanaise', 'Serge Gainsbourg'], ['Cocaine', 'Eric Clapton'],
    ['Paradise City', "Guns N' Roses"], ['Change the World', 'Eric Clapton'],
    ['Get Back', 'The Beatles'], ['Let It Be', 'The Beatles'],
    ['Good Times', 'Chic'], ['Wonderful Tonight', 'Eric Clapton'],
    ['Wicked Game', 'Chris Isaak'], ['Wild World', 'Cat Stevens'],
    ['Viva la Vida', 'Coldplay'], ['Wake Me Up', 'Avicii'],
    ['Tears in Heaven', 'Eric Clapton'], ['While My Guitar Gently Weeps', 'The Beatles'],
    ["Sweet Child O' Mine", "Guns N' Roses"], ['Talking About a Revolution', 'Tracy Chapman'],
    ['Sweet Home Chicago', 'Robert Johnson'], ['Sweet Home Alabama', 'Lynyrd Skynyrd'],
    ['Sunday Bloody Sunday', 'U2'], ['Surf Rider', 'The Lively Ones'],
    ['Strong Enough', 'Sheryl Crow'], ['Save Tonight', 'Eagle Eye Cherry'],
    ['Shape of My Heart', 'Sting'], ['Something', 'The Beatles'],
    ['Jumping Jack Flash', 'The Rolling Stones'], ['Message in a Bottle', 'The Police'],
    ['Every Breath You Take', 'The Police'], ['Wish You Were Here', 'Pink Floyd'],
    ['Nothing Else Matters', 'Metallica'], ['Motherless Child', 'Eric Clapton'],
    ['Minor Swing', 'Django Reinhardt'], ["Knockin' on Heaven's Door", "Guns N' Roses"],
    ['Master Blaster', 'Stevie Wonder'], ['Is This Love', 'Bob Marley'],
    ['Hotel California', 'Eagles'], ['Hallelujah', 'Leonard Cohen'],
    ['The Girl from Ipanema', 'Astrud Gilberto'], ['Get Back', 'The Beatles'],
    ['Englishman in New York', 'Sting'], ['Boom Boom', 'John Lee Hooker'],
    ['Dust in the Wind', 'Kansas'], ['Get Lucky', 'Daft Punk'],
    ['Come Together', 'The Beatles'], ['Layla', 'Eric Clapton'],
    ["C'est vraiment toi", 'Téléphone'], ['Californication', 'Red Hot Chili Peppers'],
    ['Hallelujah', 'Jeff Buckley'], ['Billie Jean', 'Michael Jackson'],
    ['Berimbau', 'Baden Powell'], ['Here Comes the Sun', 'The Beatles'],
    ['Blackbird', 'The Beatles'], ['Immortels', 'Alain Bashung'],
    ['Another One Bites the Dust', 'Queen'], ['Angie', 'The Rolling Stones'],
    ['Alter Ego', 'Jean-Louis Aubert'], ['A Horse with No Name', 'America'],
    ['Under the Bridge', 'Red Hot Chili Peppers'], ['All Apologies', 'Nirvana'],
    ["California Dreamin'", 'The Mamas and the Papas'], ['The Wind', 'Cat Stevens'],
    ['The Sound of Silence', 'Simon & Garfunkel'], ['O Holy Night', 'Sufjan Stevens'],
    ['Sweet Virginia', 'The Rolling Stones'], ['Father and Son', 'Cat Stevens'],
    ['Take Me Home Country Roads', 'John Denver'], ['Ring of Fire', 'Johnny Cash'],
    ['Wish You Were Here', 'Pink Floyd'], ['Simple Man', 'Lynyrd Skynyrd'],
  ],
};

const MERGE_INTO = { 'Nouvelle setlist': 'Ma Setlist' };

const sameProfileIds = (a, b) => {
  const ax = Array.isArray(a) ? [...a].sort().join('|') : '';
  const bx = Array.isArray(b) ? [...b].sort().join('|') : '';
  return ax === bx;
};

// Migration applicable au state local. Return { newSongs, setlistUpdater }
// où setlistUpdater est une fonction (prev → next) à passer à setSetlists.
// Retourne null si rien à migrer (idempotent).
export function prepareNewzikMigration(songDb, setlists, activeProfileId) {
  const createNames = computeNewzikCreateNames(setlists, Object.keys(LISTS), MERGE_INTO);
  const mergeNames = computeNewzikMergeNames(setlists, MERGE_INTO);
  if (!createNames.length && !mergeNames.length) return null;

  const needed = [].concat(createNames, mergeNames);
  const newSongs = [];
  const songIdMap = {};
  const allItems = [].concat(...needed.map((n) => LISTS[n]));
  allItems.forEach(([title, artist]) => {
    const key = title.toLowerCase() + '|||' + artist.toLowerCase();
    if (songIdMap[key]) return;
    const dup = findDuplicateSong(songDb, title, artist) || findDuplicateSong(newSongs, title, artist);
    if (dup) { songIdMap[key] = dup.id; return; }
    const ns = { id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), title, artist, isCustom: true, ig: [], aiCache: null };
    newSongs.push(ns); songIdMap[key] = ns.id;
  });

  const setlistUpdater = (prev) => {
    let result = [...prev];
    createNames.forEach((slName) => {
      const ids = LISTS[slName].map(([t, a]) => songIdMap[t.toLowerCase() + '|||' + a.toLowerCase()]).filter(Boolean);
      const existing = result.find((sl) => sl.name === slName && sameProfileIds(sl.profileIds, [activeProfileId]));
      if (existing) {
        const existingIds = new Set(existing.songIds || []);
        const added = ids.filter((id) => !existingIds.has(id));
        if (added.length) { existing.songIds = (existing.songIds || []).concat(added); }
      } else {
        result.push({ id: 'sl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8), name: slName, songIds: ids, profileIds: [activeProfileId] });
      }
    });
    mergeNames.forEach((srcName) => {
      const targetName = MERGE_INTO[srcName];
      const target = result.find((sl) => sl.name === targetName);
      if (!target) return;
      const ids = LISTS[srcName].map(([t, a]) => songIdMap[t.toLowerCase() + '|||' + a.toLowerCase()]).filter(Boolean);
      const existingIds = new Set(target.songIds);
      const merged = ids.filter((id) => !existingIds.has(id));
      target.songIds = target.songIds.concat(merged);
      result = result.filter((sl) => sl.name !== srcName);
    });
    return result;
  };

  return { newSongs, createNames, mergeNames, setlistUpdater };
}

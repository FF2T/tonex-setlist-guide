// src/app/screens/PresetBrowser.jsx — Phase 7.17 (découpage main.jsx).
//
// Explorateur de presets : recherche, profils sonores, navigation par
// ampli (brand → family → preset). Affiche une fiche détaillée pour
// chaque preset sélectionné via PresetDetailInline (co-localisé).
//
// PresetDetailInline est également importé par JamScreen.jsx pour
// afficher le détail d'un preset jam-pick.

import React, { useState, useMemo, useEffect } from 'react';
import { t, tFormat, tPlural } from '../../i18n/index.js';
import { GUITARS } from '../../core/guitars.js';
import { normalizePresetName } from '../../core/catalog.js';
import { SOURCE_LABELS } from '../../core/sources.js';
import {
  computePickupScore, computeGuitarScoreV2, getGainRange, gainToNumeric,
} from '../../core/scoring/index.js';
import { findGuitarProfile } from '../../core/scoring/guitar.js';
import { PRESET_CATALOG_FULL } from '../../data/preset_catalog_full.js';
import {
  PRESET_CATALOG, FACTORY_CATALOG, PLUG_FACTORY_CATALOG, TSR_PACK_CATALOG,
  ANNIVERSARY_CATALOG,
} from '../../data/data_catalogs.js';
import { PRESET_CONTEXT } from '../../data/data_context.js';
import { TSR_PACK_ZIPS } from '../../data/tsr-packs.js';
import { findInBanks } from '../utils/preset-helpers.js';
import { scoreColor, scoreBg } from '../components/score-utils.js';

const PRESET_PAGE_SIZE = 30;

// Résout un nom d'ampli vers son entrée PRESET_CONTEXT (info enrichie :
// émoji, refs artistes/morceaux, description). Tolère les noms volontairement
// déformés (trademark avoidance) via une table d'alias, les combos
// "Ampli + Pédale", et un fallback fuzzy par substring.
function findAmpContext(ampName, ctxMap) {
  if (!ampName) return null;
  const ctx = ctxMap || PRESET_CONTEXT;
  if (ctx[ampName]) return ctx[ampName];
  const ALIASES = {
    'Cornfield Harle': 'Cornford Harlequin',
    'Reinguard T-36': 'Reinhardt RT-36',
    'Diesel Humbert': 'Diezel Herbert',
    'Electro Dime': 'Electro-Harmonix',
    'Chandler GAV19T': 'Benson Chimera',
    'Chandler 19T': 'Benson Chimera',
    'Bumble Deluxe': 'Dumble Deluxe',
    'Rouge Plate D50': 'Dr. Z',
    'Sons Amplification': 'Sons Amp',
    'Mega Barba': 'Mesa Boogie',
    'Ample Betty': 'Supro',
    'Amplified Nation Overdrive Reverb': 'Dumble ODS',
    'Amplified Nation Wonderland Overdrive': 'Dumble ODS',
    'Bogner Goldfinger': 'Bogner G-Finger',
    'Dumble Overdrive Deluxe': 'Dumble Deluxe',
    'Mega Amp': 'Mesa Boogie',
    'Synergy SYN-30': 'Fender Champ',
    'Suhr PT-100 / 2864-S': 'Marshall Plexi',
    'Divers British': 'Marshall Plexi',
    'Divers basse': 'Ampeg SVT',
    'Divided by 13': 'Divided by 13',
    'Pédales de drive': 'Drive Pedals',
  };
  if (ALIASES[ampName] && ctx[ALIASES[ampName]]) return ctx[ALIASES[ampName]];
  if (ampName.includes(' + ')) {
    const baseAmp = ampName.split(' + ')[0].trim();
    const baseCtx = findAmpContext(baseAmp, ctx);
    if (baseCtx) return baseCtx;
  }
  const norm = ampName.replace(/\s+/g, ' ').trim();
  const variations = [
    norm.replace('Mesa Boogie ', 'Mesa '),
    norm.replace('Mesa ', 'Mesa Boogie '),
    norm.replace('Marshall ', 'Mars '),
    norm.replace('Mars ', 'Marshall '),
    norm.replace('Fender ', 'FNDR '),
    norm.replace('FNDR ', 'Fender '),
  ];
  for (const v of variations) { if (ctx[v]) return ctx[v]; }
  const lower = norm.toLowerCase();
  for (const [k, v] of Object.entries(ctx)) {
    if (k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase())) return v;
  }
  return null;
}

// Fiche détaillée d'un preset : infos ampli, style/gain, morceaux
// mythiques filtrés par registre de gain (clean/heavy tracks), guitares
// adaptées scorées par computePickupScore + computeGuitarScoreV2.
// Utilisé par PresetBrowser (via PresetList) et JamScreen (via JamPresetItem).
function PresetDetailInline({ name, info, banksAnn, banksPlug, presetContext, guitars }) {
  const ctx = findAmpContext(info.amp, presetContext || PRESET_CONTEXT);
  const annLoc = findInBanks(name, banksAnn);
  const plugLoc = findInBanks(name, banksPlug);
  const allGuitars = guitars || GUITARS;
  const sectionStyle = { background: 'var(--a3)', border: '1px solid var(--a7)', borderRadius: 'var(--r-lg)', padding: '10px 12px', marginBottom: 8 };
  const sectionTitle = (icon, label) => <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>{icon} {label}</div>;
  const STYLE_LABELS = { blues: 'Blues', rock: 'Rock', hard_rock: 'Hard Rock', jazz: 'Jazz', metal: 'Metal', pop: 'Pop' };
  const GAIN_LABELS = { low: 'Low gain — Clean / Edge of breakup', mid: 'Mid gain — Crunch / Drive', high: 'High gain — Lead / Saturé' };
  const GAIN_SHORT = { low: 'Clean', mid: 'Crunch / Drive', high: 'Lead / High gain' };
  const GAIN_STYLES = {
    low: { primary: ['blues', 'jazz', 'pop', 'rock'], desc: 'Son clean : ideal pour blues, jazz, pop, rock rythmique' },
    mid: { primary: ['rock', 'blues', 'hard_rock'], desc: 'Son crunch/drive : ideal pour rock, blues-rock, hard rock' },
    high: { primary: ['hard_rock', 'metal', 'rock'], desc: 'Son sature : ideal pour hard rock, metal, rock lead' },
  };
  const gainStyles = GAIN_STYLES[info.gain] || GAIN_STYLES.mid;
  const CLEAN_TRACKS = ['gravity', 'waiting on the world', 'sultans of swing', 'romeo', 'juliet', 'wonderful tonight', 'tears in heaven', 'blackbird', 'dust in the wind', 'stairway', 'hotel california intro', 'wish you were here', 'under the bridge', 'hallelujah', 'the thrill is gone', 'truckin'];
  const HEAVY_TRACKS = ['money for nothing', 'paranoid', 'back in black', 'highway to hell', 'thunderstruck', 'smoke on the water', 'purple haze', 'whole lotta love', 'eruption', 'master of puppets', 'enter sandman', 'schism', 'b.y.o.b.', 'ace of spades', 'crazy train', 'iron man'];
  const filterRefs = (refs) => {
    if (!refs || refs.length === 0) return refs;
    const gain = info.gain;
    let filtered = refs.map((r) => {
      if (!r.t || r.t.length === 0) return r;
      const tracks = r.t.filter((t) => {
        const tl = t.toLowerCase();
        if (gain === 'low') return !HEAVY_TRACKS.some((h) => tl.includes(h));
        if (gain === 'high') return !CLEAN_TRACKS.some((c) => tl.includes(c));
        return true;
      });
      return { ...r, t: tracks };
    });
    filtered = filtered.filter((r) => r.t.length > 0 || (refs.find((o) => o.a === r.a)?.t || []).length === 0);
    return filtered.length > 0 ? filtered : refs;
  };
  const nameLower = name.toLowerCase();
  const presetChar =
    (/\bclean\b|\bclr\b|\bcln\b/i.test(nameLower)) ? 'Clean — Son clair, dynamique, expressif'
      : (/\bedge\b|\beob\b|\bbreakup\b/i.test(nameLower)) ? 'Edge of breakup — A la limite de la saturation, très dynamique'
        : (/\bcrunch\b|\bgrit\b/i.test(nameLower)) ? 'Crunch — Saturation légère, réactif au toucher'
          : (/\bdrive\b|\bod\b|\boverdrive\b/i.test(nameLower)) ? 'Drive — Saturation moyenne, sustain musical'
            : (/\blead\b|\bsolo\b/i.test(nameLower)) ? 'Lead — Saturation prononcée, sustain long pour solos'
              : (/\bhigh.?gain\b|\bfull.?beans\b|\bdimed\b|\bmax\b/i.test(nameLower)) ? 'High gain — Saturation maximale, mur de son'
                : (/\bboost\b|\bklon\b|\bts\b|\btube.?screamer\b|\brodent\b|\bmuff\b|\bfuzz\b/i.test(nameLower)) ? 'Boost / Pedale — Son avec pedale de drive en amont'
                  : null;
  const filteredRefs = filterRefs(ctx?.refs);
  const guitarScores = allGuitars.map((g) => {
    const sc = computePickupScore(info.style, getGainRange(gainToNumeric(info.gain)), g.type);
    const gs = computeGuitarScoreV2(g.id, info.style, getGainRange(gainToNumeric(info.gain)), info.voicing);
    const combined = Math.round(sc * 0.6 + gs * 0.4);
    return { id: g.id, name: g.short || g.name, type: g.type, score: combined };
  }).sort((a, b) => b.score - a.score);
  return (
    <div style={{ background: 'var(--bg-elev-1)', border: '1px solid var(--a7)', borderRadius: '0 0 9px 9px', padding: 12, marginTop: -1, animation: 'slideDown .2s ease-out', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={sectionStyle}>
        {sectionTitle('🔊', 'Infos ampli / preset')}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 2 }}>{ctx?.emoji && <span style={{ marginRight: 4 }}>{ctx.emoji}</span>}{info.amp}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{name}{info.channel ? ' · ' + info.channel : ''}</div>
          </div>
        </div>
        {presetChar && <div style={{ fontSize: 11, color: 'var(--text-sec)', background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '6px 10px', marginBottom: 6, fontWeight: 500 }}>{presetChar}</div>}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
          {info.src && <span style={{ fontSize: 9, color: 'var(--text-muted)', background: 'var(--a6)', borderRadius: 'var(--r-sm)', padding: '2px 6px', fontWeight: 600 }}>{SOURCE_LABELS[info.src] || info.src}</span>}
          {info.cab && <span style={{ fontSize: 9, color: 'var(--text-muted)', background: 'var(--a6)', borderRadius: 'var(--r-sm)', padding: '2px 6px' }}>🔈 {info.cab}</span>}
          {info.pack && <span style={{ fontSize: 9, color: 'var(--text-muted)', background: 'var(--a6)', borderRadius: 'var(--r-sm)', padding: '2px 6px' }}>{info.pack}</span>}
          {info.pack && TSR_PACK_ZIPS[info.pack] && <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>📁 {TSR_PACK_ZIPS[info.pack]}.zip</span>}
        </div>
        {info.comment && <div style={{ fontSize: 10, color: 'var(--text-sec)', fontStyle: 'italic', marginBottom: 6 }}>{info.comment}</div>}
        {ctx?.desc && <div style={{ fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.5 }}>{ctx.desc}</div>}
        {!ctx?.desc && <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>{t('preset-browser.no-desc', 'Pas de description disponible pour cet ampli.')}</div>}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
          {annLoc
            ? <span style={{ fontSize: 10, color: 'var(--green)', background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: 'var(--r-md)', padding: '3px 8px', fontWeight: 600 }}>📦 Banque {annLoc.bank}{annLoc.slot}</span>
            : <span style={{ fontSize: 10, color: 'var(--text-dim)', background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '3px 8px' }}>📦 Non installe</span>}
          {plugLoc
            ? <span style={{ fontSize: 10, color: 'var(--green)', background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: 'var(--r-md)', padding: '3px 8px', fontWeight: 600 }}>🔌 Banque {plugLoc.bank}{plugLoc.slot}</span>
            : <span style={{ fontSize: 10, color: 'var(--text-dim)', background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '3px 8px' }}>🔌 Non installe</span>}
        </div>
      </div>
      <div style={sectionStyle}>
        {sectionTitle('🎛', 'Style & gain')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--text-sec)' }}><span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{t('preset-browser.gain', 'Gain')}</span> <span style={{ fontWeight: 600 }}>{GAIN_LABELS[info.gain] || info.gain}</span></div>
          <div style={{ fontSize: 11, color: 'var(--text-sec)' }}><span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{t('preset-browser.style', 'Style catalogue')}</span> <span style={{ fontWeight: 600 }}>{STYLE_LABELS[info.style] || info.style}</span></div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{gainStyles.desc}</div>
        </div>
      </div>
      {filteredRefs && filteredRefs.length > 0 && (
        <div style={sectionStyle}>
          {sectionTitle('🎵', 'Morceaux mythiques — registre ' + GAIN_SHORT[info.gain])}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {filteredRefs.map((r) => (
              <div key={r.a} style={{ fontSize: 11, color: 'var(--text-sec)' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{r.a}</span>
                {r.t.length > 0 && <span style={{ color: 'var(--text-dim)' }}> — {r.t.join(', ')}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={sectionStyle}>
        {sectionTitle('🎸', 'Guitares adaptees')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {guitarScores.map((g) => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-bright)', flex: 1 }}>{g.name} <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>({g.type})</span></span>
              <div style={{ width: 60, height: 4, background: 'var(--a8)', borderRadius: 'var(--r-xs)', overflow: 'hidden', flexShrink: 0 }}><div style={{ width: `${g.score}%`, height: '100%', background: scoreColor(g.score), borderRadius: 'var(--r-xs)' }}/></div>
              <span style={{ fontSize: 10, fontWeight: 700, color: scoreColor(g.score), width: 32, textAlign: 'right', flexShrink: 0 }}>{g.score}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PresetList({ filtered, selected, setSelected, banksAnn, banksPlug, fullCatalog, filterSrcs, filterPacks, togglePack, setFilterPacks, mergedContext, guitars }) {
  const [shown, setShown] = useState(PRESET_PAGE_SIZE);
  useEffect(() => setShown(PRESET_PAGE_SIZE), [filtered, filterPacks]);

  const subPacks = useMemo(() => {
    const groups = {};
    filtered.forEach(([name, info]) => {
      const key = info.amp || 'Autre';
      groups[key] = (groups[key] || 0) + 1;
    });
    return Object.entries(groups).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const displayFiltered = useMemo(() => {
    if (filterPacks.length === 0) return filtered;
    return filtered.filter(([, info]) => filterPacks.includes(info.amp || 'Autre'));
  }, [filtered, filterPacks]);

  const visible = displayFiltered.slice(0, shown);
  const remaining = displayFiltered.length - shown;
  return (
    <div>
      {subPacks && subPacks.length > 1 && (() => {
        const chipStyle = (on) => ({ fontSize: 10, fontWeight: on ? 700 : 500, color: on ? 'var(--accent)' : 'var(--text-sec)', background: on ? 'var(--accent-bg)' : 'var(--a3)', border: on ? '1px solid var(--accent-border)' : '1px solid var(--a6)', borderRadius: 'var(--r-md)', padding: '4px 8px', cursor: 'pointer' });
        return (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', marginBottom: 6 }}>Modele d'ampli</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button onClick={() => setFilterPacks([])} style={chipStyle(filterPacks.length === 0)}>Tous ({filtered.length})</button>
              {subPacks.slice(0, 20).map(([amp, count]) => { const on = filterPacks.includes(amp); return <button key={amp} onClick={() => togglePack(amp)} style={chipStyle(on)}>{amp} ({count})</button>; })}
            </div>
          </div>
        );
      })()}
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', marginBottom: 8 }}>
        {displayFiltered.length} preset{displayFiltered.length > 1 ? 's' : ''} — clique pour voir la fiche
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {visible.map(([name, info]) => {
          const annLoc = findInBanks(name, banksAnn);
          const plugLoc = findInBanks(name, banksPlug);
          const isSel = selected === name;
          return (
            <div key={name}>
              <div onClick={() => setSelected(isSel ? null : name)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: isSel ? 'var(--accent-bg)' : 'var(--a3)', border: isSel ? '1px solid var(--accent-border)' : '1px solid var(--a6)', borderRadius: isSel ? '9px 9px 0 0' : 9, padding: '8px 11px', cursor: 'pointer' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: isSel ? 'var(--accent)' : 'var(--text-bright)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{info.amp}</span>
                    {(info.pack || info.amp) && <span style={{ fontSize: 9, color: 'var(--text-muted)', background: 'var(--a6)', borderRadius: 'var(--r-sm)', padding: '1px 5px' }}>{info.pack || info.amp}</span>}
                    {annLoc && <span style={{ fontSize: 9, color: 'var(--accent)', background: 'var(--accent-bg)', borderRadius: 'var(--r-sm)', padding: '1px 5px', fontWeight: 700 }}>📦{annLoc.bank}{annLoc.slot}</span>}
                    {plugLoc && <span style={{ fontSize: 9, color: 'var(--accent)', background: 'rgba(165,180,252,0.1)', borderRadius: 'var(--r-sm)', padding: '1px 5px', fontWeight: 700 }}>🔌{plugLoc.bank}{plugLoc.slot}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0 }}>
                  {['HB', 'SC', 'P90'].map((gt) => { const sc = computePickupScore(info.style, getGainRange(gainToNumeric(info.gain)), gt); return <span key={gt} style={{ fontSize: 9, color: scoreColor(sc), fontWeight: 700, background: scoreBg(sc), borderRadius: 'var(--r-sm)', padding: '1px 4px' }}>{sc}</span>; })}
                </div>
              </div>
              {isSel && <PresetDetailInline name={name} info={info} banksAnn={banksAnn} banksPlug={banksPlug} presetContext={mergedContext} guitars={guitars}/>}
            </div>
          );
        })}
      </div>
      {remaining > 0 && (
        <button onClick={() => setShown((s) => s + PRESET_PAGE_SIZE)}
          style={{ width: '100%', marginTop: 10, background: 'var(--a5)', border: '1px solid var(--a10)', color: 'var(--text-sec)', borderRadius: 'var(--r-lg)', padding: '10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
          Voir {Math.min(remaining, PRESET_PAGE_SIZE)} de plus ({remaining} restants)
        </button>
      )}
    </div>
  );
}

const CURATED_FAMILIES = {
  Fender: [
    ['Bassman', ['Bassman']],
    ['Twin', ['Twin']],
    ['Princeton', ['Princeton']],
    ['Deluxe', ['Deluxe']],
    ['Champ', ['Champ']],
    ['Super', ['Super Reverb', 'Super S', 'Super ']],
    ['Concert', ['Concert']],
    ['Pro', ['Pro Amp']],
    ['Cambridge', ['Cambridge']],
    ['Bandmaster', ['Bandmaster']],
    ['Texas Star', ['Texas Star']],
    ['Tweed', ['Tweed']],
  ],
  Marshall: [
    ['Plexi', ['Plexi', 'Super Lead', 'Super 100', '1974X', 'Major']],
    ['JCM800', ['JCM800', 'JC800']],
    ['JCM900', ['JCM900']],
    ['SL800', ['SL800']],
    ['SL100', ['SL100']],
    ['JTM', ['JTM']],
    ['SLT60', ['SLT60']],
    ['Silver Jubilee', ['Silver Jubilee', 'Silver J']],
    ['Super Bass', ['Super Bass', 'SB100']],
    ['18W', ['18W']],
  ],
};

function familyForAmp(amp, brand) {
  if (!amp) return 'Autre';
  if (brand === 'Pédales') {
    const after = amp.split(' + ').slice(1).join(' + ').trim();
    return after || amp;
  }
  const base = amp.split(' + ')[0].trim();
  const curated = CURATED_FAMILIES[brand];
  if (curated) {
    for (let i = 0; i < curated.length; i++) {
      const fam = curated[i][0]; const pats = curated[i][1];
      for (let j = 0; j < pats.length; j++) {
        if (base.indexOf(pats[j]) !== -1) return fam;
      }
    }
  }
  let name = base;
  if (brand && name.indexOf(brand) === 0) name = name.substring(brand.length).trim();
  name = name.replace(/^(Tweed|Blonde|Silverface|Blackface|BF|SF|Custom|Hot Rod)\s+/i, '');
  name = name.replace(/^(5E\d+|505\d+|AA\d+|AB\d+|6G\d+)\s+/i, '');
  name = name.replace(/\b(19[5-9]\d|20[0-2]\d)\b/g, '').trim().replace(/\s+/g, ' ');
  return name || base || 'Autre';
}

function PresetBrowser({ banksAnn, banksPlug, availableSources, customPacks, guitars, toneNetPresets }) {
  const [soundProfile, setSoundProfile] = useState('all');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [filterPacks, setFilterPacks] = useState([]);
  const togglePack = (key) => setFilterPacks((p) => p.includes(key) ? p.filter((x) => x !== key) : [...p, key]);

  const mergedContext = useMemo(() => {
    const ctx = { ...PRESET_CONTEXT };
    (customPacks || []).forEach((pack) => {
      if (pack.ampContext) {
        for (const [amp, info] of Object.entries(pack.ampContext)) {
          if (!ctx[amp]) ctx[amp] = info;
        }
      }
    });
    return ctx;
  }, [customPacks]);

  const fullCatalog = useMemo(() => {
    const tsrNorms = new Set(Object.keys(TSR_PACK_CATALOG).map(normalizePresetName));
    const fullDeduped = {};
    for (const [k, v] of Object.entries(PRESET_CATALOG_FULL)) {
      if (!tsrNorms.has(normalizePresetName(k))) fullDeduped[k] = v;
    }
    const cat = { ...fullDeduped, ...TSR_PACK_CATALOG, ...ANNIVERSARY_CATALOG, ...FACTORY_CATALOG, ...PLUG_FACTORY_CATALOG, ...PRESET_CATALOG };
    (customPacks || []).forEach((pack) => {
      (pack.presets || []).forEach((p) => {
        if (p.name && !cat[p.name]) cat[p.name] = { src: pack.name, amp: p.amp || 'Custom', gain: p.gain || 'mid', style: p.style || 'rock', scores: p.scores || { HB: 78, SC: 78, P90: 78 } };
      });
    });
    (toneNetPresets || []).forEach((p) => {
      if (p.name && !cat[p.name]) cat[p.name] = { src: 'ToneNET', amp: p.amp || 'ToneNET', gain: p.gain || 'mid', style: p.style || 'rock', channel: p.channel || '', cab: p.cab || '', comment: p.comment || '', scores: p.scores || { HB: 75, SC: 75, P90: 75 } };
    });
    if (availableSources) {
      for (const k of Object.keys(cat)) {
        if (availableSources[cat[k].src] === false) delete cat[k];
      }
    }
    return cat;
  }, [customPacks, toneNetPresets, availableSources]);

  const SOUND_PROFILES = {
    all: { label: 'Tous les presets', filter: () => true },
    clean_cristallin: { label: 'Clean cristallin', desc: 'Fender, jazz, pop', filter: (i) => i.gain === 'low' && ['jazz', 'pop', 'blues', 'rock'].includes(i.style) },
    blues_vintage: { label: 'Blues vintage', desc: 'B.B. King, Clapton, edge of breakup', filter: (i) => (i.style === 'blues') || (i.gain === 'low' && i.style === 'rock') },
    jazz_warm: { label: 'Jazz warm', desc: 'Son rond, chaleureux', filter: (i) => i.style === 'jazz' || (i.gain === 'low' && i.style === 'pop') },
    crunch_70s: { label: 'Crunch rock 70s', desc: 'Led Zep, Stones, Hendrix', filter: (i) => i.gain === 'mid' && ['rock', 'blues'].includes(i.style) },
    british: { label: 'British invasion', desc: 'Marshall, Vox, AC/DC', filter: (i) => i.gain === 'mid' && ['rock', 'hard_rock'].includes(i.style) },
    blues_rock: { label: 'Blues-rock texan', desc: 'SRV, Mayer, Bonamassa', filter: (i) => i.style === 'blues' && ['mid', 'low'].includes(i.gain) },
    funk_soul: { label: 'Funk / Soul', desc: 'Clean dynamique, Nile Rodgers', filter: (i) => i.gain === 'low' && ['pop', 'rock'].includes(i.style) },
    hard_rock: { label: 'Hard rock classique', desc: 'AC/DC, GN\'R, Van Halen', filter: (i) => i.style === 'hard_rock' && ['mid', 'high'].includes(i.gain) },
    metal: { label: 'Metal moderne', desc: 'Metallica, Tool, Petrucci', filter: (i) => i.style === 'metal' || (i.gain === 'high' && i.style === 'hard_rock') },
    high_gain_lead: { label: 'High gain lead', desc: 'Solos, shred, sustain', filter: (i) => i.gain === 'high' },
    pedales: { label: 'Pedales de drive', desc: 'Captures pedales seules', filter: (i) => (i.amp || '').includes('drive') || (i.amp || '').includes('Pedal') || (i.amp || '').toLowerCase().includes('pédale') },
  };

  const ampBrands = useMemo(() => {
    const brands = {};
    Object.values(fullCatalog).forEach((info) => {
      if (!info.amp) return;
      let brand = info.amp.split(' ')[0];
      if (brand === 'Dr.' || brand === 'Two' || brand === 'Bad' || brand === 'Divided') brand = info.amp.split(' ').slice(0, 2).join(' ');
      if (!brands[brand]) brands[brand] = 0;
      brands[brand]++;
    });
    return Object.entries(brands).sort((a, b) => b[1] - a[1]);
  }, [fullCatalog]);

  const filtered = useMemo(() => Object.entries(fullCatalog).filter(([name, info]) => {
    const profile = SOUND_PROFILES[soundProfile];
    if (profile && !profile.filter(info)) return false;
    if (filterBrand) {
      let b = info.amp ? info.amp.split(' ')[0] : '';
      if (b === 'Dr.' || b === 'Two' || b === 'Bad' || b === 'Divided') b = info.amp.split(' ').slice(0, 2).join(' ');
      if (b !== filterBrand) return false;
    }
    if (filterModel && familyForAmp(info.amp, filterBrand) !== filterModel) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const ctx = mergedContext[info.amp];
      const artistsStr = (ctx?.refs || []).map((r) => r.a).join(' ').toLowerCase();
      const tracksStr = (ctx?.refs || []).flatMap((r) => r.t).join(' ').toLowerCase();
      if (!name.toLowerCase().includes(q) && !info.amp.toLowerCase().includes(q) && !artistsStr.includes(q) && !tracksStr.includes(q)) return false;
    }
    return true;
  }), [soundProfile, filterBrand, filterModel, search]);

  const [randomPick, setRandomPick] = useState(null);
  const pickRandom = () => {
    const pool = Object.entries(fullCatalog);
    if (!pool.length) return;
    const [name, info] = pool[Math.floor(Math.random() * pool.length)];
    setRandomPick({ name, info });
    setSelected(null);
  };

  const ampFamilies = useMemo(() => {
    if (!filterBrand) return [];
    const fams = {};
    Object.values(fullCatalog).forEach((info) => {
      if (!info.amp) return;
      let b = info.amp.split(' ')[0];
      if (b === 'Dr.' || b === 'Two' || b === 'Bad' || b === 'Divided') b = info.amp.split(' ').slice(0, 2).join(' ');
      if (b !== filterBrand) return;
      const profile = SOUND_PROFILES[soundProfile];
      if (profile && !profile.filter(info)) return;
      const fam = familyForAmp(info.amp, filterBrand);
      if (!fams[fam]) fams[fam] = { count: 0, amps: new Set() };
      fams[fam].count++;
      fams[fam].amps.add(info.amp);
    });
    return Object.entries(fams).map(([fam, data]) => [fam, { count: data.count, amps: [...data.amps].sort() }]).sort((a, b) => b[1].count - a[1].count);
  }, [fullCatalog, filterBrand, soundProfile]);

  const hasFilter = soundProfile !== 'all' || filterBrand || search.trim();
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>{t('preset-browser.intro', 'Explore ta bibliothèque de presets et découvre leur contexte musical.')}</div>

      <div style={{ position: 'relative', marginBottom: 6 }}>
        <input
          type="search"
          enterKeyHint="search"
          placeholder={t('preset-browser.search-placeholder', '🔍 Rechercher artiste, morceau, ampli...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          style={{ width: '100%', background: 'var(--bg-card)', color: 'var(--text)', border: '2px solid var(--a15)', borderRadius: 'var(--r-lg)', padding: '14px 44px 14px 16px', fontSize: 15, boxSizing: 'border-box' }}
        />
        {search && (
          <button onClick={() => setSearch('')} aria-label={t('preset-browser.clear-search', 'Effacer la recherche')}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'var(--a7)', border: 'none', color: 'var(--text-sec)', borderRadius: '50%', width: 28, height: 28, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >✕</button>
        )}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 14, fontStyle: 'italic' }}>{t('preset-browser.live-filter', 'Résultats filtrés en temps réel')}</div>

      <button onClick={pickRandom} style={{ width: '100%', background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-lg)', padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 16 }}>
        {t('preset-browser.random', '🎲 Preset aléatoire')}
      </button>

      {randomPick && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{randomPick.name}</span>
            <button onClick={() => setRandomPick(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
          <PresetDetailInline name={randomPick.name} info={randomPick.info} banksAnn={banksAnn} banksPlug={banksPlug} presetContext={mergedContext} guitars={guitars}/>
        </div>
      )}

      {(() => {
        const tile = (active) => ({ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? 'var(--accent)' : 'var(--text-muted)', background: active ? 'var(--accent-bg)' : 'var(--a3)', border: active ? '1px solid var(--accent-border)' : '1px solid var(--a7)', borderRadius: 'var(--r-md)', padding: '6px 12px', cursor: 'pointer', textAlign: 'left' });
        const PROFILE_GROUPS = [
          { title: t('preset-browser.group-clean', 'Sons cleans'), profiles: ['clean_cristallin', 'blues_vintage', 'jazz_warm', 'funk_soul'] },
          { title: t('preset-browser.group-crunch', 'Sons crunch / drive'), profiles: ['crunch_70s', 'british', 'blues_rock'] },
          { title: t('preset-browser.group-saturated', 'Sons satures'), profiles: ['hard_rock', 'metal', 'high_gain_lead'] },
          { title: t('preset-browser.group-other', 'Autre'), profiles: ['pedales'] },
        ];
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', marginBottom: 6 }}>{t('preset-browser.what-sound', 'Quel son cherches-tu ?')}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                <button onClick={() => setSoundProfile('all')} style={tile(soundProfile === 'all')}>{t('preset-browser.all', 'Tous')}</button>
              </div>
              {PROFILE_GROUPS.map((g) => (
                <div key={g.title} style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 600, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', marginBottom: 4 }}>{g.title}</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {g.profiles.map((id) => {
                      const p = SOUND_PROFILES[id]; if (!p) return null;
                      const active = soundProfile === id;
                      return (
                        <button key={id} onClick={() => setSoundProfile(active ? 'all' : id)} style={tile(active)}>
                          <div>{p.label}</div>
                          {p.desc && <div style={{ fontSize: 9, fontWeight: 400, color: active ? 'var(--accent)' : 'var(--text-dim)', marginTop: 1 }}>{p.desc}</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {hasFilter && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {filterBrand && !filterModel && <button onClick={() => { setFilterBrand(''); setFilterModel(''); }} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{t('preset-browser.back-to-amps', '← Amplis')}</button>}
                  {filterBrand && filterModel && <button onClick={() => setFilterModel('')} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>← {filterBrand}</button>}
                  {filterBrand && !filterModel && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{filterBrand}</span>}
                  {filterModel && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{filterModel}</span>}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tPlural('preset-browser.presets-count', filtered.length, {}, { one: '1 preset', other: '{count} presets' })}</span>
                </div>
                <button onClick={() => { setSoundProfile('all'); setFilterBrand(''); setFilterModel(''); setFilterPacks([]); setSearch(''); }} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>{t('preset-browser.reset', 'Reinitialiser')}</button>
              </div>
            )}
          </div>
        );
      })()}

      {!hasFilter && (
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', marginBottom: 10 }}>{tFormat('preset-browser.browse-by-amp', { count: Object.keys(fullCatalog).length }, 'Parcourir par ampli — {count} presets')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
            {ampBrands.slice(0, 18).map(([brand, count]) => (
              <button key={brand} onClick={() => { setFilterBrand(brand); setFilterModel(''); }}
                style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '12px 8px', cursor: 'pointer', textAlign: 'center', transition: 'all .15s' }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--a15)'; e.currentTarget.style.background = 'var(--a7)'; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--a8)'; e.currentTarget.style.background = 'var(--a4)'; }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{brand}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{tPlural('preset-browser.presets-count', count, {}, { one: '1 preset', other: '{count} presets' })}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      {filterBrand && !filterModel && !search.trim() && ampFamilies.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 4 }}>
            {ampFamilies.map(([fam, data]) => {
              const sub = data.amps.length > 1 ? data.amps.map((a) => a.replace(filterBrand, '').replace(' + ', ' + ').trim()).slice(0, 3).join(' · ') : '';
              return (
                <button key={fam} onClick={() => setFilterModel(fam)}
                  style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-md)', padding: '8px 12px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, transition: 'all .15s' }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--a15)'; e.currentTarget.style.background = 'var(--a7)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--a8)'; e.currentTarget.style.background = 'var(--a4)'; }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{fam}</div>
                    {sub && <div style={{ fontSize: 9, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{sub}{data.amps.length > 3 ? ' …' : ''}</div>}
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>{data.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {hasFilter && (filterModel || search.trim() || !filterBrand) && filtered.length === 0 && <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-dim)', fontSize: 13 }}>{t('preset-browser.no-match', 'Aucun preset ne correspond à ces critères.')}</div>}
      {hasFilter && (filterModel || search.trim() || !filterBrand) && filtered.length > 0 && <PresetList filtered={filtered} selected={selected} setSelected={setSelected} banksAnn={banksAnn} banksPlug={banksPlug} fullCatalog={fullCatalog} filterSrcs={[]} filterPacks={filterPacks} togglePack={togglePack} setFilterPacks={setFilterPacks} mergedContext={mergedContext} guitars={guitars}/>}
    </div>
  );
}

export default PresetBrowser;
export {
  PresetBrowser, PresetDetailInline, PresetList,
  findAmpContext, familyForAmp,
};

// src/app/screens/SynthesisScreen.jsx — Phase 7.17 (découpage main.jsx).
//
// Tableau de synthèse final post-Recap : pour chaque morceau de la
// setlist, montre guitare assignée + un preset reco par device activé
// (1 colonne par device). Phase 3 fix : exclut les devices avec
// RecommendBlock (TMP) qui ne fittent pas une colonne tabulaire ;
// ils restent visibles dans Recap/Setlists collapsed.

import React from 'react';
import { t, tFormat, tPlural } from '../../i18n/index.js';
import { GUITARS } from '../../core/guitars.js';
import { getActiveDevicesForRender } from '../utils/devices-render.js';
import { getBestResult, enrichAIResult } from '../utils/ai-helpers.js';
import { getInstallRec } from '../utils/preset-helpers.js';
import { scoreColor, scoreBg } from '../components/score-utils.js';
import Breadcrumb from '../components/Breadcrumb.jsx';

function SynthesisScreen({ songs, gps, aiR, onBack, onNavigate, songDb, banksAnn, banksPlug, allGuitars, availableSources, profile }) {
  const enabledDevices = getActiveDevicesForRender(profile).filter((d) => typeof d.RecommendBlock !== 'function');
  const rows = songs.map((s) => {
    const g = (allGuitars || GUITARS).find((x) => x.id === gps[s.id]);
    const type = g?.type || 'HB';
    const gId = g?.id || '';
    const aiCraw = getBestResult(s, gId, aiR[s.id] || s.aiCache?.result) || null;
    const ai = aiCraw ? enrichAIResult({ ...aiCraw, preset_ann: null, preset_plug: null, ideal_preset: null, ideal_preset_score: 0, ideal_top3: null }, type, gId, banksAnn, banksPlug) : null;
    const perDevice = {};
    if (ai) {
      enabledDevices.forEach((d) => {
        const banks = d.bankStorageKey === 'banksAnn' ? banksAnn : banksPlug;
        const presetData = ai[d.presetResultKey];
        if (presetData) {
          const rec = getInstallRec(presetData.label, type, banks, gId);
          perDevice[d.id] = { name: presetData.label, score: presetData.score, rec };
        }
      });
    }
    return { s, g, type, perDevice };
  });
  const th = { fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', padding: '8px 10px', borderBottom: '1px solid var(--a10)', textAlign: 'left' };
  const td = { fontSize: 12, padding: '10px', borderBottom: '1px solid var(--a5)', verticalAlign: 'top' };
  const cellPreset = (item, accentColor) => {
    if (!item) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    const { name, score, rec } = item;
    const sc = score != null ? score : rec?.score;
    const scC = sc != null ? scoreColor(sc) : 'var(--text-tertiary)';
    const scB = sc != null ? scoreBg(sc) : 'transparent';
    return (
      <div>
        {rec?.installed
          ? <span style={{ fontWeight: 700, color: accentColor, fontSize: 13, marginRight: 4 }}>{tFormat('synthesis.bank', { bank: rec.bank, slot: rec.slot }, 'Banque {bank}{slot}')}</span>
          : <span style={{ fontSize: 10, background: 'var(--yellow-bg)', color: 'var(--yellow)', borderRadius: 'var(--r-sm)', padding: '1px 6px', fontWeight: 700, marginRight: 4 }}>{t('synthesis.to-install', '⬇ À installer')}</span>
        }
        {sc != null && <span style={{ fontSize: 10, fontWeight: 800, color: scC, background: scB, borderRadius: 'var(--r-sm)', padding: '1px 6px' }}>{sc}%</span>}
        <div style={{ fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.5, marginTop: 2 }}>{name}</div>
        {!rec?.installed && rec?.replaceBank != null && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>{tFormat('synthesis.replaces-bank', { bank: rec.replaceBank, slot: rec.replaceSlot }, '→ Remplace Banque {bank}{slot}')}</div>}
      </div>
    );
  };
  return (
    <div>
      <Breadcrumb crumbs={[{ label: t('common.home', 'Accueil'), screen: 'list' }, { label: t('synthesis.breadcrumb-recap', 'Récap'), screen: 'recap' }, { label: t('synthesis.breadcrumb', 'Synthèse') }]} onNavigate={onNavigate}/>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>{t('synthesis.title', 'Tableau de synthèse')}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{tPlural('synthesis.songs-count', songs.length, {}, { one: '1 morceau', other: '{count} morceaux' })}</div>
      </div>
      <div style={{ overflowX: 'auto', borderRadius: 'var(--r-lg)', border: '1px solid var(--a8)' }}>
        <table>
          <thead><tr style={{ background: 'var(--a4)' }}>
            <th style={th}>{t('synthesis.col-song', 'Morceau')}</th>
            <th style={th}>{t('synthesis.col-guitar', 'Guitare')}</th>
            {enabledDevices.map((d) => (
              <th key={d.id} style={{ ...th, color: d.id === 'tonex-plug' ? 'var(--accent)' : 'var(--text-sec)' }}>{d.icon} {d.label}</th>
            ))}
          </tr></thead>
          <tbody>
            {rows.map(({ s, g, perDevice }, i) => (
              <tr key={s.id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--a3)' }}>
                <td style={td}><div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>{s.title}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.artist}</div></td>
                <td style={td}>{g ? <span style={{ fontSize: 12, color: 'var(--green)', background: 'var(--green-bg)', borderRadius: 'var(--r-sm)', padding: '2px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}>{g.short}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                {enabledDevices.map((d) => (
                  <td key={d.id} style={td}>{cellPreset(perDevice[d.id], d.id === 'tonex-plug' ? 'var(--accent)' : 'var(--text-sec)')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SynthesisScreen;
export { SynthesisScreen };

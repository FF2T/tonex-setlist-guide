// src/app/screens/ExportImportScreen.jsx — Phase 7.18 (découpage main.jsx).
//
// Écran ⚙️ Paramètres → Import/Export. Permet :
// - Sauvegarde JSON complète du state (setlists/songDb/presets/banks).
// - Import JSON (replace via onImportState).
// - Export CSV des banks (Anniversary / Plug / les deux).
// - Import CSV avec preview + mode merge/replace.

import React, { useState, useRef } from 'react';
import { CC, CL } from '../utils/ui-constants.js';
import { downloadFile, generateCSV, exportJSON, parseCSV } from '../utils/csv-helpers.js';
import Breadcrumb from '../components/Breadcrumb.jsx';

function ExportImportScreen({ banksAnn, onBanksAnn, banksPlug, onBanksPlug, onBack, onNavigate, fullState, onImportState }) {
  const [exported, setExported] = useState(null);
  const [importData, setImportData] = useState(null);
  const [importErr, setImportErr] = useState(null);
  const [importMode, setImportMode] = useState('merge');
  const [toast, setToast] = useState(null);
  const csvRef = useRef(null);
  const jsonRef = useRef(null);
  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const doExportCSV = (banks, name, key) => { try { downloadFile(generateCSV(banks, name), `ToneX_${key}.csv`); setExported(key); setTimeout(() => setExported(null), 2000); } catch (e) {} };
  const doExportAll = () => { try { const c1 = generateCSV(banksAnn, 'ToneX Anniversary'); const c2 = generateCSV(banksPlug, 'ToneX Plug').split('\n').slice(1).join('\n'); downloadFile(c1 + '\n' + c2, 'ToneX_Tous_Presets.csv'); setExported('all'); setTimeout(() => setExported(null), 2000); } catch (e) {} };
  const doExportJSON = () => { exportJSON(fullState); flash('Sauvegarde JSON exportée ✅'); };

  const handleCSVFile = (e) => {
    const file = e.target.files[0]; if (!file) return; setImportErr(null);
    const reader = new FileReader();
    reader.onload = (ev) => { try { const p = parseCSV(ev.target.result); if (!p) { setImportErr('Format non reconnu.'); return; } setImportData(p); } catch (err) { setImportErr('Erreur : ' + err.message); } };
    reader.readAsText(file, 'UTF-8'); e.target.value = '';
  };
  const handleJSONFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        onImportState(data);
        flash('Import JSON réussi ✅');
      } catch (err) { setImportErr('Fichier JSON invalide.'); }
    };
    reader.readAsText(file, 'UTF-8'); e.target.value = '';
  };
  const confirmCSV = () => {
    if (!importData) return;
    if (importMode === 'replace') { if (Object.keys(importData.ann).length > 0) onBanksAnn(importData.ann); if (Object.keys(importData.plug).length > 0) onBanksPlug(importData.plug); }
    else { if (Object.keys(importData.ann).length > 0) onBanksAnn((p) => ({ ...p, ...importData.ann })); if (Object.keys(importData.plug).length > 0) onBanksPlug((p) => ({ ...p, ...importData.plug })); }
    setImportData(null); flash('Import CSV réussi ✅');
  };

  const xBtn = (onClick, key, label, color) => (
    <button onClick={onClick} style={{ background: exported === key ? 'var(--green-border)' : color, border: 'none', color: 'var(--text)', borderRadius: 'var(--r-lg)', padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
      {exported === key ? '✅ OK' : label}
    </button>
  );
  const th = { padding: '7px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', borderBottom: '2px solid var(--a10)', color: 'var(--text-sec)' };
  const td = { padding: '6px 10px', fontSize: 11, borderBottom: '1px solid var(--a5)', verticalAlign: 'middle' };

  return (
    <div>
      {toast && <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: 'var(--green)', color: 'var(--text)', borderRadius: 'var(--r-lg)', padding: '10px 22px', fontSize: 13, fontWeight: 700, zIndex: 999 }}>✅ {toast}</div>}
      <Breadcrumb crumbs={[{ label: 'Accueil', screen: 'list' }, { label: 'Mon Profil', screen: 'profile' }, { label: 'Import / Export' }]} onNavigate={onNavigate}/>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 20 }}>📋 Export / Import</div>

      {/* Sauvegarde JSON */}
      <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>💾 Sauvegarde complète (JSON)</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={doExportJSON} style={{ background: 'var(--green)', border: 'none', color: 'var(--text)', borderRadius: 'var(--r-lg)', padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>⬇ Exporter JSON</button>
          <button onClick={() => jsonRef.current?.click()} style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.35)', color: 'var(--green)', borderRadius: 'var(--r-lg)', padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>📂 Importer JSON</button>
          <input ref={jsonRef} type="file" accept=".json" onChange={handleJSONFile} style={{ display: 'none' }}/>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Sauvegarde complète : setlists, morceaux, presets, banks. Parfait pour sauvegarder ou transférer entre appareils.</div>
      </div>

      {/* Export CSV */}
      <div style={{ background: 'var(--a3)', border: '1px solid var(--a7)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 12, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>Export CSV (Banks)</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {xBtn(() => doExportCSV(banksAnn, 'ToneX Anniversary', 'Anniversary'), 'Anniversary', '⬇ Anniversary', 'var(--brass-300)')}
          {xBtn(() => doExportCSV(banksPlug, 'ToneX Plug', 'Plug'), 'Plug', '⬇ Plug', 'var(--accent)')}
          {xBtn(doExportAll, 'all', '⬇ Les deux', 'var(--brass-500)')}
        </div>
      </div>

      {/* Import CSV */}
      <div style={{ background: 'var(--a3)', border: '1px solid var(--a7)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sec)', marginBottom: 12, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>Import CSV (Banks)</div>
        <button onClick={() => csvRef.current?.click()} style={{ background: 'var(--yellow-bg)', border: '1px solid rgba(251,191,36,0.35)', color: 'var(--yellow)', borderRadius: 'var(--r-lg)', padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 8 }}>📂 Charger CSV</button>
        <input ref={csvRef} type="file" accept=".csv,.txt" onChange={handleCSVFile} style={{ display: 'none' }}/>
        {importErr && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--red)', background: 'rgba(239,68,68,0.1)', borderRadius: 'var(--r-md)', padding: '8px 12px' }}>{importErr}</div>}
        {importData && <div style={{ marginTop: 14, background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', borderRadius: 'var(--r-lg)', padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 10 }}>Aperçu</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            {Object.keys(importData.ann).length > 0 && <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 'var(--r-md)', padding: '6px 12px' }}><div style={{ fontSize: 12, color: 'var(--text-sec)', fontWeight: 700 }}>📦 Pedale</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{Object.keys(importData.ann).length} banks</div></div>}
            {Object.keys(importData.plug).length > 0 && <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', borderRadius: 'var(--r-md)', padding: '6px 12px' }}><div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>🔌 Plug</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{Object.keys(importData.plug).length} banks</div></div>}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[{ v: 'replace', l: '🔄 Remplacer' }, { v: 'merge', l: '🔀 Fusionner' }].map(({ v, l }) => (
              <button key={v} onClick={() => setImportMode(v)} style={{ flex: 1, background: importMode === v ? 'var(--accent-bg)' : 'var(--a5)', border: importMode === v ? '1px solid var(--border-accent)' : '1px solid var(--a10)', color: importMode === v ? 'var(--accent)' : 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setImportData(null)} style={{ flex: 1, background: 'var(--a7)', border: '1px solid var(--a10)', color: 'var(--text-sec)', borderRadius: 'var(--r-md)', padding: '9px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Annuler</button>
            <button onClick={confirmCSV} style={{ flex: 2, background: 'var(--accent)', border: 'none', color: 'var(--text)', borderRadius: 'var(--r-md)', padding: '9px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>✅ Importer</button>
          </div>
        </div>}
      </div>

      {/* Tableaux banks */}
      {[{ banks: banksAnn, label: 'ToneX Anniversary', color: 'var(--accent)' }, { banks: banksPlug, label: 'ToneX Plug', color: 'var(--accent)' }].map(({ banks, label, color }) => (
        <div key={label} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}><div style={{ width: 4, height: 18, background: color, borderRadius: 'var(--r-xs)' }}/><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{label}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{Object.keys(banks).length} banks</div></div>
          <div style={{ overflowX: 'auto', borderRadius: 'var(--r-lg)', border: '1px solid var(--a8)' }}>
            <table>
              <thead><tr style={{ background: 'var(--a4)' }}><th style={{ ...th, width: 45 }}>Bank</th><th style={th}>Catégorie</th>{['A', 'B', 'C'].map((c) => <th key={c} style={{ ...th, color: CC[c] }}>{c} — {CL[c]}</th>)}</tr></thead>
              <tbody>
                {Object.entries(banks).sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, v], i) => (
                  <tr key={k} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--a3)' }}>
                    <td style={{ ...td, fontWeight: 800, color: color, fontSize: 13 }}>{k}</td>
                    <td style={{ ...td, color: 'var(--text-sec)' }}>{v.cat}</td>
                    {['A', 'B', 'C'].map((c) => <td key={c} style={td}><span style={{ color: 'var(--text-bright)' }}>{v[c]}</span></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ExportImportScreen;
export { ExportImportScreen };

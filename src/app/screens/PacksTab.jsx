// src/app/screens/PacksTab.jsx — Phase 7.19 (découpage main.jsx).
//
// Onglet "📦 Sources / Packs" dans MonProfilScreen et ParametresScreen.
// Permet d'ajouter un pack de presets en joignant une photo ou
// document — l'IA (Gemini ou Claude) en extrait les presets + le
// contexte amp. Sauvegarde dans profile.customPacks.

import React, { useState, useRef } from 'react';
import { safeParseJSON } from '../utils/ai-helpers.js';
import { getSharedGeminiKey } from '../utils/shared-key.js';

function PacksTab({ profile, onProfiles, activeProfileId, aiProvider, aiKeys }) {
  const [packName, setPackName] = useState('');
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const fileRef = useRef(null);

  const updateProfile = (field, value) => onProfiles((p) => ({ ...p, [activeProfileId]: { ...p[activeProfileId], [field]: typeof value === 'function' ? value(p[activeProfileId][field]) : value, lastModified: Date.now() } }));

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f); setErr(null);
    const reader = new FileReader();
    reader.onload = (ev) => { setFilePreview(ev.target.result); };
    reader.readAsDataURL(f);
  };

  const extractPresets = () => {
    if (!packName.trim() || !filePreview) return;
    const key = aiKeys?.gemini || aiKeys?.anthropic || getSharedGeminiKey();
    const provider = (aiKeys?.gemini || getSharedGeminiKey()) ? 'gemini' : 'anthropic';
    if (!key) { setErr('Clé API manquante — configure-la dans ⚙️ Paramètres.'); return; }
    setLoading(true); setErr(null);
    const prompt = `Analyse cette image/document d'un pack de presets pour guitare ToneX appelé "${packName.trim()}".
Extrais TOUS les noms de presets visibles et pour chacun déduis :
- amp : le modèle d'ampli simulé (nom générique, ex: "Marshall JCM800", "Fender Twin Reverb")
- gain : "low", "mid" ou "high"
- style : "blues", "rock", "hard_rock", "jazz", "pop" ou "metal"
- scores : compatibilité par type de micro {HB: 50-97, SC: 50-97, P90: 50-97}

Pour chaque ampli UNIQUE trouvé, génère aussi une fiche descriptive :
- emoji : un emoji représentatif
- refs : artistes et morceaux associés [{a:"Artiste",t:["Morceau 1","Morceau 2"]}]
- desc : description courte en français de l'ampli (2-3 phrases)

Réponds UNIQUEMENT en JSON (sans markdown) :
{"presets":[{"name":"...","amp":"...","gain":"...","style":"...","scores":{"HB":85,"SC":70,"P90":78}},...],
"ampContext":{"Nom Ampli":{"emoji":"🎸","refs":[{"a":"Artiste","t":["Morceau"]}],"desc":"Description..."},...}}`;
    const base64 = filePreview.split(',')[1];
    const mimeType = filePreview.split(';')[0].split(':')[1];
    if (provider === 'gemini') {
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${key}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ inlineData: { mimeType, data: base64 } }, { text: prompt }] }] }),
      }).then((r) => r.json()).then((d) => {
        if (d.error) throw new Error(d.error.message);
        const txt = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = safeParseJSON(txt);
        savePack(parsed.presets || [], parsed.ampContext || {});
      }).catch((e) => setErr(e.message)).finally(() => setLoading(false));
    } else {
      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 4096, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } }, { type: 'text', text: prompt }] }] }),
      }).then((r) => r.json()).then((d) => {
        if (d.error) throw new Error(d.error.message);
        const txt = d.content?.map((i) => i.text || '').join('') || '';
        const parsed = safeParseJSON(txt);
        savePack(parsed.presets || [], parsed.ampContext || {});
      }).catch((e) => setErr(e.message)).finally(() => setLoading(false));
    }
  };

  const savePack = (presets, ampContext) => {
    const pack = { id: `pack_${Date.now()}`, name: packName.trim(), presetCount: presets.length, presets: presets.map((p) => ({ ...p, src: packName.trim() })), ampContext: ampContext || {} };
    updateProfile('customPacks', (prev) => [...(prev || []), pack]);
    setPackName(''); setFile(null); setFilePreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const deletePack = (id) => {
    updateProfile('customPacks', (prev) => (prev || []).filter((p) => p.id !== id));
  };

  const packs = profile.customPacks || [];
  const inp = { background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--a15)', borderRadius: 'var(--r-md)', padding: '6px 10px', fontSize: 12, boxSizing: 'border-box' };

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 16 }}>Ajoute des packs de presets en joignant une photo ou un document. L'IA en extraira les presets.</div>
      {packs.length > 0 && <div style={{ marginBottom: 16 }}>
        {packs.map((p) => (
          <div key={p.id} style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 12, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{p.name}</div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.presetCount || p.presets?.length || 0} presets</span>
              <button onClick={() => deletePack(p.id)} style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', borderRadius: 'var(--r-md)', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>Supprimer</button>
            </div>
            {p.presets?.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {p.presets.slice(0, 8).map((pr, i) => <span key={i} style={{ fontSize: 10, background: 'var(--a5)', border: '1px solid var(--a8)', borderRadius: 'var(--r-sm)', padding: '2px 6px', color: 'var(--text-sec)' }}>{pr.name}</span>)}
              {p.presets.length > 8 && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{p.presets.length - 8} autres</span>}
            </div>}
          </div>
        ))}
      </div>}
      <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-soft)', borderRadius: 'var(--r-lg)', padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 12 }}>+ Nouveau pack</div>
        <input placeholder="Nom du pack (ex: TSR Blues Pack)" value={packName} onChange={(e) => setPackName(e.target.value)} style={{ ...inp, width: '100%', marginBottom: 10 }}/>
        <div style={{ marginBottom: 10 }}>
          <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleFile} style={{ fontSize: 12, color: 'var(--text-sec)' }}/>
        </div>
        {filePreview && filePreview.startsWith('data:image') && <div style={{ marginBottom: 10, borderRadius: 'var(--r-md)', overflow: 'hidden', border: '1px solid var(--a8)' }}>
          <img src={filePreview} style={{ width: '100%', maxHeight: 200, objectFit: 'contain', background: 'var(--a3)' }}/>
        </div>}
        {filePreview && !filePreview.startsWith('data:image') && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>Document joint ({file?.name})</div>}
        {err && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>{err}</div>}
        <button onClick={extractPresets} disabled={!packName.trim() || !filePreview || loading}
          style={{ width: '100%', background: packName.trim() && filePreview && !loading ? 'var(--accent)' : 'var(--bg-disabled)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-lg)', padding: '12px', fontSize: 13, fontWeight: 700, cursor: packName.trim() && filePreview && !loading ? 'pointer' : 'not-allowed' }}>
          {loading ? 'Extraction IA en cours...' : 'Extraire les presets avec l\'IA'}
        </button>
      </div>
    </div>
  );
}

export default PacksTab;
export { PacksTab };

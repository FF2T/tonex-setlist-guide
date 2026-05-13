// src/devices/tonemaster-pro/Browser.jsx — Phase 7.11.
//
// Read-only browser des patches TMP. Liste les 20 factory groupés par
// source (arthur / orphan / generated) + les customs du profil. Chaque
// patch: card compacte avec name + amp model + chain summary + badges
// style/gain. Click → drawer expandable affichant les blocs (utilise
// getPatchBlocks). Badge ⚙️ si le profil a un override factory pour
// ce patch.
//
// L'éditeur (création/modif) est dette Phase 4 séparée. Ce browser ne
// fait que afficher.

import React, { useState, useMemo } from 'react';
import { TMP_FACTORY_PATCHES, TONEMASTER_PRO_CATALOG } from './catalog.js';
import { getPatchBlocks, RENDER_ORDER } from './chain-model.js';
import { summarizeChain, pickTopParams, formatBlockParam } from './RecommendBlock.jsx';
import TmpPatchEditor, { clonePatchAsCustom, buildBlankPatch } from './Editor.jsx';

const SOURCE_LABELS = {
  arthur: 'Patches Arthur',
  orphan: 'Patches seed',
  generated: 'Patches famille',
  custom: 'Mes patches custom',
};

function PatchCard({ patch, expanded, onToggle, hasOverride, isCustom, onClone, onEdit, onDelete }) {
  const chain = summarizeChain(patch);
  const blocks = getPatchBlocks(patch);
  const color = TONEMASTER_PRO_CATALOG.deviceColor;
  const usagesShort = Array.isArray(patch.usages)
    ? patch.usages.map((u) => u.artist).filter(Boolean).slice(0, 3).join(' · ')
    : '';
  return (
    <div
      data-testid={`tmp-browser-patch-${patch.id}`}
      style={{
        background: 'var(--a4)',
        border: `1px solid var(--a8)`,
        borderRadius: 'var(--r-md)',
        marginBottom: 6,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', padding: '8px 10px',
          background: 'transparent', border: 'none',
          textAlign: 'left', cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 14, flexShrink: 0 }}>{TONEMASTER_PRO_CATALOG.icon}</span>
        <span
          style={{
            color, fontWeight: 700, flexShrink: 0,
            background: `${color}18`, border: `1px solid ${color}40`,
            borderRadius: 'var(--r-sm)', padding: '1px 6px', fontSize: 12,
          }}
        >
          {patch.name}
        </span>
        {hasOverride && <span data-testid={`tmp-browser-override-${patch.id}`} style={{ fontSize: 10, padding: '1px 5px', borderRadius: 'var(--r-sm)', background: 'var(--accent-bg)', color: 'var(--accent)', fontWeight: 600 }}>⚙️ personnalisé</span>}
        <span style={{ flex: 1, color: 'var(--text-muted)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {chain}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{expanded ? '▲' : '▼'}</span>
      </button>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, padding: '0 10px 8px 10px' }}>
        {patch.style && <span style={{ fontSize: 10, padding: '1px 6px', background: 'var(--a6)', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{patch.style.replace('_', ' ')}</span>}
        {patch.gain && <span style={{ fontSize: 10, padding: '1px 6px', background: 'var(--a6)', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)' }}>{patch.gain} gain</span>}
        {usagesShort && <span style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>· {usagesShort}</span>}
        <span style={{ flex: 1 }}/>
        {/* Phase 7.12 — actions clone/edit/delete. Clone visible sur factory,
            edit+delete sur custom. */}
        {!isCustom && onClone && (
          <button
            data-testid={`tmp-browser-clone-${patch.id}`}
            onClick={(e) => { e.stopPropagation(); onClone(patch); }}
            style={{ fontSize: 10, padding: '2px 6px', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', color: 'var(--accent)', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontWeight: 600 }}
            title="Cloner ce patch comme custom"
          >📋 Cloner</button>
        )}
        {isCustom && onEdit && (
          <button
            data-testid={`tmp-browser-edit-${patch.id}`}
            onClick={(e) => { e.stopPropagation(); onEdit(patch); }}
            style={{ fontSize: 10, padding: '2px 6px', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', color: 'var(--accent)', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontWeight: 600 }}
          >✏️ Modifier</button>
        )}
        {isCustom && onDelete && (
          <button
            data-testid={`tmp-browser-delete-${patch.id}`}
            onClick={(e) => { e.stopPropagation(); if (window.confirm(`Supprimer "${patch.name}" ?`)) onDelete(patch.id); }}
            style={{ fontSize: 10, padding: '2px 6px', background: 'transparent', border: '1px solid var(--a15)', color: 'var(--text-sec)', borderRadius: 'var(--r-sm)', cursor: 'pointer' }}
          >🗑️</button>
        )}
      </div>
      {expanded && (
        <div data-testid={`tmp-browser-detail-${patch.id}`} style={{ borderTop: '1px solid var(--a8)', padding: '8px 10px', background: 'var(--a3)' }}>
          {blocks.map((b) => {
            const slot = b.slot;
            const params = pickTopParams(b, slot);
            return (
              <div key={slot} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>{slot.replace('_', ' ')}</div>
                <div style={{ fontSize: 11, color: 'var(--text)' }}>{b.model}</div>
                {params.length > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {params.map(([k, v]) => formatBlockParam(slot, k, v, b.model)).join(' · ')}
                  </div>
                )}
              </div>
            );
          })}
          {patch.notes && <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--a8)', fontSize: 11, color: 'var(--text-sec)', lineHeight: 1.4, fontStyle: 'italic' }}>{patch.notes}</div>}
          {Array.isArray(patch.usages) && patch.usages.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
              <b>Usages :</b> {patch.usages.map((u) => `${u.artist}${Array.isArray(u.songs) && u.songs.length > 0 ? ` (${u.songs.slice(0, 3).join(', ')}${u.songs.length > 3 ? '…' : ''})` : ''}`).join(' · ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TmpBrowser({ profile, onUpdateCustoms }) {
  const [expandedId, setExpandedId] = useState(null);
  // Phase 7.12 — editor state: { patch, mode: 'clone'|'edit' } ou null.
  const [editorState, setEditorState] = useState(null);
  const factoryOverrides = profile?.tmpPatches?.factoryOverrides || {};
  const customs = useMemo(
    () => (Array.isArray(profile?.tmpPatches?.custom) ? profile.tmpPatches.custom : []),
    [profile],
  );
  const groups = useMemo(() => {
    const out = { arthur: [], orphan: [], generated: [], custom: customs };
    TMP_FACTORY_PATCHES.forEach((p) => {
      const k = p.source || 'generated';
      if (out[k]) out[k].push(p);
    });
    return out;
  }, [customs]);
  const totalCount = TMP_FACTORY_PATCHES.length + customs.length;
  const toggle = (id) => setExpandedId((cur) => (cur === id ? null : id));

  const openClone = (factoryPatch) => {
    setEditorState({ patch: clonePatchAsCustom(factoryPatch), mode: 'clone' });
  };
  const openEdit = (customPatch) => {
    setEditorState({ patch: customPatch, mode: 'edit' });
  };
  const openBlank = () => {
    setEditorState({ patch: buildBlankPatch(), mode: 'clone' });
  };
  const closeEditor = () => setEditorState(null);

  const handleSave = (savedPatch) => {
    if (!onUpdateCustoms) { closeEditor(); return; }
    const existing = customs.find((c) => c.id === savedPatch.id);
    const next = existing
      ? customs.map((c) => (c.id === savedPatch.id ? savedPatch : c))
      : [...customs, savedPatch];
    onUpdateCustoms(next);
    closeEditor();
  };
  const handleDelete = (id) => {
    if (!onUpdateCustoms) return;
    onUpdateCustoms(customs.filter((c) => c.id !== id));
    closeEditor();
  };
  const handleDeleteFromCard = (id) => {
    if (!onUpdateCustoms) return;
    onUpdateCustoms(customs.filter((c) => c.id !== id));
  };

  return (
    <div data-testid="tmp-browser-root">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--text-sec)' }}>
          {totalCount} patches Tone Master Pro disponibles. {customs.length > 0 && `${customs.length} custom + `}{TMP_FACTORY_PATCHES.length} factory.
        </div>
        {onUpdateCustoms && (
          <button
            data-testid="tmp-browser-new-blank"
            onClick={openBlank}
            style={{ fontSize: 12, padding: '6px 12px', background: 'var(--accent)', border: 'none', color: 'var(--text-inverse)', borderRadius: 'var(--r-md)', cursor: 'pointer', fontWeight: 700 }}
          >🆕 Nouveau patch</button>
        )}
      </div>
      {['custom', 'arthur', 'orphan', 'generated'].map((key) => {
        const list = groups[key];
        if (!list || list.length === 0) return null;
        const isCustomGroup = key === 'custom';
        return (
          <div key={key} style={{ marginBottom: 16 }}>
            <div data-testid={`tmp-browser-group-${key}`} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{SOURCE_LABELS[key] || key} ({list.length})</div>
            {list.map((p) => (
              <PatchCard
                key={p.id}
                patch={p}
                expanded={expandedId === p.id}
                onToggle={() => toggle(p.id)}
                hasOverride={!!factoryOverrides[p.id]}
                isCustom={isCustomGroup}
                onClone={!isCustomGroup && onUpdateCustoms ? openClone : null}
                onEdit={isCustomGroup && onUpdateCustoms ? openEdit : null}
                onDelete={isCustomGroup && onUpdateCustoms ? handleDeleteFromCard : null}
              />
            ))}
          </div>
        );
      })}
      {editorState && (
        <TmpPatchEditor
          patch={editorState.patch}
          mode={editorState.mode}
          onSave={handleSave}
          onDelete={editorState.mode === 'edit' ? handleDelete : null}
          onCancel={closeEditor}
        />
      )}
    </div>
  );
}

export default TmpBrowser;
export { TmpBrowser, PatchCard, SOURCE_LABELS };

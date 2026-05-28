// src/app/screens/MesAppareilsTab.jsx — Phase 7.19 + Phase 7.75 consolidation.
//
// Onglet "📱 Mes appareils" CONSOLIDÉ : checkboxes des devices + contenu
// banks/patches par device activé en sections collapsables.
//
// Avant Phase 7.75 : 4 onglets séparés (Mes appareils + 🎛 Pedale + 🎛 Ann +
//   🔌 Plug + 🎚 TMP) → fouillis dans MonProfilScreen.
// Phase 7.75 : tout dans Mes appareils. Sections collapsables par device,
//   CSV compact 1 ligne par device, warning si Pedal+Anniversary partagent
//   banksAnn.

import React, { useState, useMemo } from 'react';
import { t, tFormat } from '../../i18n/index.js';
import { getAllDevices } from '../../devices/registry.js';
import { stampedProfileUpdate } from '../../core/state.js';
import BankEditor from '../components/BankEditor.jsx';
import ExportImportScreen from './ExportImportScreen.jsx';
import ResolveUnknownsModal from '../components/ResolveUnknownsModal.jsx';
import CurateNonCuratedModal from '../components/CurateNonCuratedModal.jsx';
import TmpBrowser from '../../devices/tonemaster-pro/Browser.jsx';
import { FACTORY_BANKS_PEDALE_V1, FACTORY_BANKS_PEDALE_V2 } from '../../devices/tonex-pedal/index.js';
import { FACTORY_BANKS_ANNIVERSARY } from '../../devices/tonex-anniversary/index.js';
import { FACTORY_BANKS_PLUG } from '../../devices/tonex-plug/index.js';
import { detectUnknownsInBanks, detectAllNonCurated, applyResolutionsToBanks } from '../../core/preset-curation.js';
import { PRESET_CATALOG_MERGED, normalizePresetName, CURATION_COLORS } from '../../core/catalog.js';
import { cascadeAvailableSources } from '../../core/sources.js';

// Phase 7.75 — Factory : callback pour push les "ajouter custom" depuis
// la modale presets inconnus (CSV import) vers profile.customPacks "Mes
// presets" du profil actif. Centralisé ici car partagé entre les 3
// sections device (Pedal/Ann/Plug).
function makeOnAddCustomPresets(onProfiles, activeProfileId) {
  return (presets) => {
    onProfiles((p) => {
      const cur = p[activeProfileId];
      if (!cur) return p;
      const packs = (cur.customPacks || []).slice();
      const defaultIdx = packs.findIndex((pk) => pk.name === 'Mes presets');
      if (defaultIdx >= 0) {
        const existing = packs[defaultIdx];
        const existingNames = new Set((existing.presets || []).map((pr) => pr.name));
        const newOnes = presets.filter((pr) => !existingNames.has(pr.name));
        packs[defaultIdx] = { ...existing, presets: [...(existing.presets || []), ...newOnes] };
      } else {
        packs.push({ name: 'Mes presets', presets: presets.slice() });
      }
      return { ...p, [activeProfileId]: { ...cur, customPacks: packs, lastModified: Date.now() } };
    });
  };
}

// Phase 7.73.2.4 — Petit composant interne pour rendre une ligne de
// légende avec pastille (8px ronde colorée) + label texte.
function LegendRow({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span style={{
        display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
        background: color?.dot || '#888', border: '1px solid ' + (color?.border || '#666'),
        flexShrink: 0, marginTop: 3,
      }}/>
      <span style={{ flex: 1, lineHeight: 1.4 }}>{label}</span>
    </div>
  );
}

function MesAppareilsTab({
  profile, profiles, onProfiles, activeProfileId,
  banksAnn, onBanksAnn, banksPlug, onBanksPlug,
  toneNetPresets, onToneNetPresets,
  songDb,
  fullState, onImportState,
  onNavigate,
  onSharedUsagesOverrides, // Phase 7.79.3b — propagé à BankEditor
}) {
  const isAdmin = !!profile?.isAdmin;
  const allDevices = getAllDevices();
  const enabled = new Set(profile.enabledDevices || []);

  // Sections expandables : par défaut toutes ouvertes (le user voit
  // tout son rig d'un coup). Toggle pour collapse si besoin.
  const [collapsedDevices, setCollapsedDevices] = useState(() => new Set());
  // Phase 7.73.2.4 — Légende des pastilles curation (Phase 7.70).
  // Collapsée par défaut, le user clique pour révéler les 4 statuts
  // (rouge wine inconnu, brass orange connu, bleu clair curé perso,
  // bleu moyen curé admin). 5e niveau curé studio Phase 11 (slot vide).
  const [legendOpen, setLegendOpen] = useState(false);
  const toggleCollapsed = (id) => {
    setCollapsedDevices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleDevice = (id) => {
    const next = new Set(enabled);
    if (next.has(id)) {
      if (next.size <= 1) return;
      next.delete(id);
    } else {
      next.add(id);
    }
    const arr = allDevices.filter((d) => next.has(d.id)).map((d) => d.id);
    const isNowEnabled = next.has(id);
    // Phase 7.74.10 — cascade automatique sur availableSources : ON
    // active la source factory liée (Factory/Anniversary/PlugFactory),
    // OFF désactive toutes les sources liées au device (incluant
    // FactoryV1 pour tonex-pedal). Nettoie aussi les états pollués
    // (Factory: true sans tonex-pedal activé).
    onProfiles((p) => {
      const cur = p[activeProfileId];
      if (!cur) return p;
      const nextAvailableSources = cascadeAvailableSources(
        cur.availableSources, id, isNowEnabled
      );
      const patch = { enabledDevices: arr };
      if (nextAvailableSources !== cur.availableSources) {
        patch.availableSources = nextAvailableSources;
      }
      return stampedProfileUpdate(p, activeProfileId, patch);
    });
  };

  const addCustomPresets = makeOnAddCustomPresets(onProfiles, activeProfileId);

  // Phase 7.75 — warning si Pedal + Anniversary tous deux activés :
  // ils partagent banksAnn (data legacy depuis Phase 2). On affiche
  // un message clair que les modifs sur l'un affectent l'autre.
  const sharesBanksAnn = enabled.has('tonex-pedal') && enabled.has('tonex-anniversary');

  // Phase 7.77 — état modale "Résoudre les inconnus" partagée entre les
  // sections device. resolveModalDevice = id du device dont la modale
  // est ouverte (ou null). Pas plus d'une modale à la fois.
  const [resolveModalDevice, setResolveModalDevice] = useState(null);

  // Phase 7.77 — datalist catalog (dédupliqué par normalize) pour autocomplete
  // dans la modale. Identique à ExportImportScreen Phase 7.69.11.
  const catalogNames = useMemo(() => {
    const byNorm = new Map();
    for (const k of Object.keys(PRESET_CATALOG_MERGED)) {
      const norm = normalizePresetName(k);
      const existing = byNorm.get(norm);
      if (!existing || k.length < existing.length) byNorm.set(norm, k);
    }
    return Array.from(byNorm.values()).sort();
  }, []);

  // Phase 7.77 — Détection des unknowns par device. Memoize par device.
  // Pedal + Anniversary partagent banksAnn → mêmes unknowns.
  const unknownsByDevice = useMemo(() => {
    return {
      'tonex-pedal': detectUnknownsInBanks(banksAnn),
      'tonex-anniversary': detectUnknownsInBanks(banksAnn),
      'tonex-plug': detectUnknownsInBanks(banksPlug),
    };
  }, [banksAnn, banksPlug]);

  // Phase 7.77 — Apply résolutions au callback de la modale.
  // Le device détermine quelles banks (Ann ou Plug) reçoivent les updates.
  const handleResolveConfirm = (deviceId, resolutions, customsToAdd) => {
    // 1. Push customs s'il y en a
    if (customsToAdd && customsToAdd.length > 0) {
      addCustomPresets(customsToAdd);
    }
    // 2. Apply remap/clear aux banks concernées
    const hasBanksAnn = deviceId === 'tonex-pedal' || deviceId === 'tonex-anniversary';
    const hasBanksPlug = deviceId === 'tonex-plug';
    if (hasBanksAnn) {
      const nextBanks = applyResolutionsToBanks(banksAnn, resolutions);
      if (nextBanks !== banksAnn) onBanksAnn(nextBanks);
    }
    if (hasBanksPlug) {
      const nextBanks = applyResolutionsToBanks(banksPlug, resolutions);
      if (nextBanks !== banksPlug) onBanksPlug(nextBanks);
    }
    setResolveModalDevice(null);
  };

  // Phase 7.78 — Curation des non-curés (admin only).
  // Détecte par device les presets status='known' (catalog OK mais sans
  // usages). MVP : éditables = custom + ToneNET, read-only = catalog statique.
  const [curateModalDevice, setCurateModalDevice] = useState(null);

  const nonCuratedByDevice = useMemo(() => {
    if (!isAdmin) return { 'tonex-pedal': [], 'tonex-anniversary': [], 'tonex-plug': [] };
    return {
      'tonex-pedal': detectAllNonCurated(banksAnn),
      'tonex-anniversary': detectAllNonCurated(banksAnn),
      'tonex-plug': detectAllNonCurated(banksPlug),
    };
  }, [isAdmin, banksAnn, banksPlug]);

  // Phase 7.78 — apply curation usages.
  // usagesByName = { [presetName]: usages[]|undefined }.
  // Route au save :
  //   - src='custom' → modifie profile.customPacks[].presets[].usages (LWW profil).
  //   - src='ToneNET' → modifie shared.toneNetPresets[].usages (LWW shared).
  // Stamp lastModified pour LWW Firestore.
  const handleCurateConfirm = (deviceId, usagesByName) => {
    const names = Object.keys(usagesByName);
    if (names.length === 0) { setCurateModalDevice(null); return; }

    // Séparer customs (par nom) vs ToneNET (par nom) selon le catalog.
    // detectAllNonCurated nous a donné le src au moment du detect.
    const nonCurated = nonCuratedByDevice[deviceId] || [];
    const srcByName = {};
    nonCurated.forEach((p) => { srcByName[p.name] = p.src; });

    // 1. Customs : update profile.customPacks
    const customUpdates = names.filter((n) => srcByName[n] === 'custom');
    if (customUpdates.length > 0) {
      onProfiles((p) => {
        const cur = p[activeProfileId];
        if (!cur) return p;
        const packs = (cur.customPacks || []).map((pack) => ({
          ...pack,
          presets: (pack.presets || []).map((pr) => {
            if (!customUpdates.includes(pr.name)) return pr;
            const newUsages = usagesByName[pr.name];
            if (!newUsages) {
              const { usages: _, ...rest } = pr; // drop usages si vide
              return rest;
            }
            return { ...pr, usages: newUsages };
          }),
        }));
        return { ...p, [activeProfileId]: { ...cur, customPacks: packs, lastModified: Date.now() } };
      });
    }

    // 2. ToneNET : update shared.toneNetPresets
    const tonenetUpdates = names.filter((n) => srcByName[n] === 'ToneNET');
    if (tonenetUpdates.length > 0 && typeof onToneNetPresets === 'function') {
      onToneNetPresets((prev) => {
        return (prev || []).map((tp) => {
          if (!tonenetUpdates.includes(tp.name)) return tp;
          const newUsages = usagesByName[tp.name];
          const stamped = { ...tp, lastModified: Date.now() };
          if (!newUsages) {
            const { usages: _, ...rest } = stamped;
            return rest;
          }
          return { ...stamped, usages: newUsages };
        });
      });
    }

    setCurateModalDevice(null);
  };

  // Rendu section device (BankEditor + CSV compact + TMP).
  const renderDeviceSection = (d) => {
    const isCollapsed = collapsedDevices.has(d.id);
    const sectionStyle = {
      background: 'var(--a3)',
      border: '1px solid var(--a7)',
      borderRadius: 'var(--r-lg)',
      padding: 14,
      marginTop: 12,
    };

    let content = null;

    if (d.id === 'tonex-pedal') {
      content = (
        <>
          {sharesBanksAnn && (
            <div style={{ fontSize: 11, color: 'var(--yellow)', background: 'var(--yellow-bg)', border: '1px solid rgba(251,191,36,0.35)', borderRadius: 'var(--r-md)', padding: '6px 10px', marginBottom: 10 }}>
              {t('devices.shared-banks-warning', '⚠ Ces banks sont partagées avec ton ToneX Anniversary (data legacy). Modifs sur l\'un affectent l\'autre.')}
            </div>
          )}
          <ExportImportScreen
            banksAnn={banksAnn} onBanksAnn={onBanksAnn}
            banksPlug={banksPlug} onBanksPlug={onBanksPlug}
            fullState={fullState} onImportState={onImportState}
            inline={true} isAdmin={false}
            onAddCustomPresets={addCustomPresets}
            onNavigate={onNavigate}
            restrictToDevice="ann"
            compact={true}
          />
          <BankEditor
            banks={banksAnn} onBanks={onBanksAnn}
            color="var(--accent)" maxBanks={50}
            toneNetPresets={toneNetPresets}
            onToneNetPresets={onToneNetPresets}
            profile={profile} onProfiles={onProfiles} activeProfileId={activeProfileId}
            songDb={songDb} isAdmin={isAdmin}
            onSharedUsagesOverrides={onSharedUsagesOverrides}
            factoryBanksByVersion={[
              { id: 'v2', label: t('bank-editor.firmware-v2', 'Firmware v2 (2025/04/03)'), banks: FACTORY_BANKS_PEDALE_V2 },
              { id: 'v1', label: t('bank-editor.firmware-v1', 'Firmware v1 (historique)'), banks: FACTORY_BANKS_PEDALE_V1 },
            ]}
            defaultFactoryVersion="v2"
          />
        </>
      );
    } else if (d.id === 'tonex-anniversary') {
      content = (
        <>
          {sharesBanksAnn && (
            <div style={{ fontSize: 11, color: 'var(--yellow)', background: 'var(--yellow-bg)', border: '1px solid rgba(251,191,36,0.35)', borderRadius: 'var(--r-md)', padding: '6px 10px', marginBottom: 10 }}>
              {t('devices.shared-banks-warning', '⚠ Ces banks sont partagées avec ton ToneX Pedal classique (data legacy). Modifs sur l\'un affectent l\'autre.')}
            </div>
          )}
          <ExportImportScreen
            banksAnn={banksAnn} onBanksAnn={onBanksAnn}
            banksPlug={banksPlug} onBanksPlug={onBanksPlug}
            fullState={fullState} onImportState={onImportState}
            inline={true} isAdmin={false}
            onAddCustomPresets={addCustomPresets}
            onNavigate={onNavigate}
            restrictToDevice="ann"
            compact={true}
          />
          <BankEditor
            banks={banksAnn} onBanks={onBanksAnn}
            color="var(--accent)" maxBanks={50}
            factoryBanks={FACTORY_BANKS_ANNIVERSARY}
            toneNetPresets={toneNetPresets}
            onToneNetPresets={onToneNetPresets}
            profile={profile} onProfiles={onProfiles} activeProfileId={activeProfileId}
            songDb={songDb} isAdmin={isAdmin}
            onSharedUsagesOverrides={onSharedUsagesOverrides}
          />
        </>
      );
    } else if (d.id === 'tonex-plug') {
      content = (
        <>
          <ExportImportScreen
            banksAnn={banksAnn} onBanksAnn={onBanksAnn}
            banksPlug={banksPlug} onBanksPlug={onBanksPlug}
            fullState={fullState} onImportState={onImportState}
            inline={true} isAdmin={false}
            onAddCustomPresets={addCustomPresets}
            onNavigate={onNavigate}
            restrictToDevice="plug"
            compact={true}
          />
          <BankEditor
            banks={banksPlug} onBanks={onBanksPlug}
            color="var(--accent)" maxBanks={10} startBank={1}
            factoryBanks={FACTORY_BANKS_PLUG}
            toneNetPresets={toneNetPresets}
            onToneNetPresets={onToneNetPresets}
            profile={profile} onProfiles={onProfiles} activeProfileId={activeProfileId}
            songDb={songDb} isAdmin={isAdmin}
            onSharedUsagesOverrides={onSharedUsagesOverrides}
          />
        </>
      );
    } else if (d.id === 'tonemaster-pro') {
      content = (
        <TmpBrowser profile={profile} onUpdateCustoms={(customs) => {
          onProfiles((p) => {
            const cur = p[activeProfileId];
            if (!cur) return p;
            const prevTmp = cur.tmpPatches || { custom: [], factoryOverrides: {} };
            return { ...p, [activeProfileId]: { ...cur, tmpPatches: { ...prevTmp, custom: customs }, lastModified: Date.now() } };
          });
        }}/>
      );
    }

    if (!content) return null;

    // Phase 7.77 — count d'unknowns dans les banks de ce device. TMP exclu
    // (pas de banks). Bouton "🔴 Résoudre" affiché si N > 0.
    const unknownsCount = (unknownsByDevice[d.id] || []).length;
    // Phase 7.78 — count de non-curés (admin only).
    const nonCuratedCount = isAdmin ? (nonCuratedByDevice[d.id] || []).length : 0;

    return (
      <div key={d.id} style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isCollapsed ? 0 : 10 }}>
          <button
            onClick={() => toggleCollapsed(d.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }}>{d.icon}</span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{d.label}</span>
          </button>
          {unknownsCount > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setResolveModalDevice(d.id); }}
              title={t('resolve.button-hint', 'Résoudre les presets inconnus (rouges) dans les banks de ce device')}
              style={{
                background: 'rgba(155,58,44,0.15)',
                border: '1px solid rgba(155,58,44,0.4)',
                color: 'var(--wine-400)',
                borderRadius: 'var(--r-sm)',
                padding: '3px 8px',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {tFormat('resolve.button-flat', { n: unknownsCount }, 'Résoudre ({n})')}
            </button>
          )}
          {isAdmin && nonCuratedCount > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setCurateModalDevice(d.id); }}
              title={t('curate.button-hint', 'Curer les presets non curés (orange) avec des usages artiste/morceau')}
              style={{
                background: 'rgba(218,165,32,0.15)',
                border: '1px solid rgba(218,165,32,0.4)',
                color: 'var(--brass-300)',
                borderRadius: 'var(--r-sm)',
                padding: '3px 8px',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {tFormat('curate.button-flat', { n: nonCuratedCount }, 'Curer ({n})')}
            </button>
          )}
          <button
            onClick={() => toggleCollapsed(d.id)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-dim)', padding: '0 4px' }}
          >
            {isCollapsed ? '▼' : '▲'}
          </button>
        </div>
        {!isCollapsed && content}
      </div>
    );
  };

  // Liste des devices activés à afficher (ordre du registry).
  const enabledList = allDevices.filter((d) => enabled.has(d.id));

  return (
    <div>
      {/* Section 1 — Toggle des devices */}
      <div style={{ background: 'var(--a4)', border: '1px solid var(--a8)', borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{t('devices.title', 'Mes appareils audio')}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>{t('devices.hint', "Coche les appareils que tu utilises. Les blocs Recap et Synthèse n'afficheront que ceux-ci. Au moins un appareil doit rester coché.")}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {allDevices.map((d) => {
            const on = enabled.has(d.id);
            return (
              <button
                key={d.id}
                onClick={() => toggleDevice(d.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: on ? 'var(--green-bg)' : 'var(--a3)',
                  border: on ? '1px solid var(--green-border)' : '1px solid var(--a8)',
                  borderRadius: 'var(--r-md)', padding: '12px 14px',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: 'var(--r-sm)',
                  border: on ? '2px solid var(--green)' : '2px solid var(--text-muted)',
                  background: on ? 'var(--green)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {on && <span style={{ color: 'var(--bg)', fontSize: 10, fontWeight: 900 }}>✓</span>}
                </div>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{d.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: on ? 'var(--text)' : 'var(--text-sec)' }}>{d.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{d.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 2 — Contenu par device activé (BankEditor + CSV + TMP) */}
      {enabledList.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, marginLeft: 4 }}>
            {tFormat('devices.sections-hint', { n: enabledList.length }, 'Banks et patches de tes {n} appareil(s) activé(s) :')}
          </div>
          {/* Phase 7.73.2.4 — Légende des pastilles curation (Phase 7.70). */}
          <div style={{ marginLeft: 4, marginBottom: 8 }}>
            <button
              onClick={() => setLegendOpen((v) => !v)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: '4px 0', fontSize: 11, color: 'var(--text-dim)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span>{legendOpen ? '▲' : '▼'}</span>
              <span>{t('curation-legend.title', 'Légende des pastilles de curation')}</span>
            </button>
            {legendOpen && (
              <div style={{
                background: 'var(--a2)', border: '1px solid var(--a7)',
                borderRadius: 'var(--r-md)', padding: 10, marginTop: 4,
                fontSize: 11, color: 'var(--text-sec)',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <LegendRow color={CURATION_COLORS.unknown}      label={t('curation-legend.unknown', 'Inconnu — pas dans le catalog, scoring dégradé, pas de pin IA possible.')}/>
                <LegendRow color={CURATION_COLORS.known}        label={t('curation-legend.known', 'Connu non curé — dans le catalog, mais sans usages artiste/morceau. Scoring V9 OK, pas de pin direct.')}/>
                <LegendRow color={CURATION_COLORS['curated-perso']}  label={t('curation-legend.curated-perso', 'Curé perso — tu as enrichi ce preset (custom ou ToneNET) avec des usages.')}/>
                <LegendRow color={CURATION_COLORS['curated-admin']}  label={t('curation-legend.curated-admin', 'Curé admin — preset enrichi par Sébastien dans le catalog Backline (Factory, Anniversary, TSR, AA, JS, TJ, WT, Galtone, ML).')}/>
                <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {t('curation-legend.tip', 'Astuce : clique sur une pastille pour voir ou éditer ses usages.')}
                </div>
              </div>
            )}
          </div>
          {enabledList.map(renderDeviceSection)}
        </div>
      )}

      {/* Phase 7.77 — Modale "Résoudre les inconnus" (un seul device à la fois) */}
      {resolveModalDevice && (unknownsByDevice[resolveModalDevice] || []).length > 0 && (
        <ResolveUnknownsModal
          unknowns={unknownsByDevice[resolveModalDevice]}
          catalogNames={catalogNames}
          allowAddCustom={true}
          onConfirm={(resolutions, customsToAdd) => handleResolveConfirm(resolveModalDevice, resolutions, customsToAdd)}
          onCancel={() => setResolveModalDevice(null)}
        />
      )}

      {/* Phase 7.78 — Modale "Curer les non-curés" (admin only) */}
      {isAdmin && curateModalDevice && (nonCuratedByDevice[curateModalDevice] || []).length > 0 && (
        <CurateNonCuratedModal
          nonCurated={nonCuratedByDevice[curateModalDevice]}
          songDb={songDb}
          onConfirm={(usagesByName) => handleCurateConfirm(curateModalDevice, usagesByName)}
          onCancel={() => setCurateModalDevice(null)}
        />
      )}
    </div>
  );
}

export default MesAppareilsTab;
export { MesAppareilsTab };

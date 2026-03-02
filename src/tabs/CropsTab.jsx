import { useState, useMemo, memo } from 'react';
import { useApp } from '../context/AppContext';
import { Card, Button, Modal, FormField, Input, Select, Badge, EmptyState } from '../components/shared';
import { familyColors, categoryToType, cropTypes } from '../data/crops';
import { generateId } from '../utils/helpers';
import { useVirtualList } from '../hooks/useVirtualList';

const FAMILIES = ['Brassicaceae', 'Asteraceae', 'Amaranthaceae', 'Amaryllidaceae', 'Apiaceae', 'Solanaceae', 'Cucurbitaceae', 'Fabaceae', 'Poaceae', 'Lamiaceae', 'Rosaceae', 'Ranunculaceae', 'Boraginaceae', 'Caryophyllaceae', 'Iridaceae', 'Papaveraceae', 'Scrophulariaceae', 'Violaceae', 'Malvaceae', 'Polygonaceae'];
const SEASONS = ['cool', 'warm'];
const CATEGORIES = [
  { value: 'greens', label: '🥬 Greens' },
  { value: 'rootVeg', label: '🥕 Root Veg' },
  { value: 'fruitingVeg', label: '🍅 Fruiting Veg' },
  { value: 'legumes', label: '🫘 Legumes' },
  { value: 'grains', label: '🌽 Grains' },
  { value: 'fruits', label: '🍓 Fruits' },
  { value: 'herbs', label: '🌿 Herbs' },
  { value: 'flowers', label: '🌸 Flowers' },
  { value: 'coverCrops', label: '🌾 Cover Crops' },
];
const ICONS = ['🥬','🥦','🔴','🥕','🍅','🫑','🌶️','🍆','🥒','🟡','🎃','🫘','🌽','🌿','🟣','🧅','🌸','🌺','🌼','🌻','🌷','💐','🤍','🌾','🍀','🌱'];

export default function CropsTab() {
  const { crops, zones, settings, selectedCropIds, harvests, pestLogs, rotationHistory, updateState, theme, showToast } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '', family: 'Brassicaceae', icon: '🌱', season: 'cool',
    spacing: 20, rowSpacing: 30, daysToMaturity: 60,
    seedsPerGram: 100, germinationRate: 0.8, successionInterval: 0,
    kcCoeff: 1.0, droughtTolerance: 'medium', category: 'greens',
  });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showPlantModal, setShowPlantModal] = useState(null);
  const [plantForm, setPlantForm] = useState({ bedId: '', startWeek: 1 });
  const [activeType, setActiveType] = useState('all');
  const [search, setSearch] = useState('');

  const selectedSet = useMemo(() => new Set(selectedCropIds || []), [selectedCropIds]);

  const toggleCropSelection = (cropId) => {
    updateState(prev => {
      const current = new Set(prev.selectedCropIds || []);
      if (current.has(cropId)) {
        current.delete(cropId);
      } else {
        current.add(cropId);
      }
      return { ...prev, selectedCropIds: [...current] };
    });
  };

  const selectAllVisible = () => {
    updateState(prev => {
      const current = new Set(prev.selectedCropIds || []);
      filteredCrops.forEach(c => current.add(c.id));
      return { ...prev, selectedCropIds: [...current] };
    });
  };

  const deselectAllVisible = () => {
    updateState(prev => {
      const visibleIds = new Set(filteredCrops.map(c => c.id));
      const current = (prev.selectedCropIds || []).filter(id => !visibleIds.has(id));
      return { ...prev, selectedCropIds: current };
    });
  };

  const allBeds = useMemo(() => zones.flatMap(z => z.beds.map(b => ({ ...b, zoneName: z.name }))), [zones]);
  const currentYear = settings.currentYear || new Date().getFullYear();

  // Filter crops by type and search
  const filteredCrops = useMemo(() => {
    let result = crops;
    if (activeType !== 'all') {
      result = result.filter(c => (categoryToType[c.category] || 'vegetables') === activeType);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(q) || c.family.toLowerCase().includes(q));
    }
    return result;
  }, [crops, activeType, search]);

  // Group filtered crops by type for display
  const groupedCrops = useMemo(() => {
    if (activeType !== 'all') return null; // no grouping when filtered
    const groups = {};
    filteredCrops.forEach(crop => {
      const type = categoryToType[crop.category] || 'vegetables';
      if (!groups[type]) groups[type] = [];
      groups[type].push(crop);
    });
    return groups;
  }, [filteredCrops, activeType]);

  const { visibleItems: virtualCrops, hasMore, sentinelRef } = useVirtualList(filteredCrops, { batchSize: 30 });

  const typeOrder = ['vegetables', 'fruits', 'herbs', 'flowers', 'coverCrops'];
  const typeLabels = {
    vegetables: '🥬 Vegetables',
    fruits: '🍓 Fruits',
    herbs: '🌿 Herbs',
    flowers: '🌸 Flowers',
    coverCrops: '🌾 Cover Crops',
  };
  const typeColors = {
    vegetables: '#4a7c59',
    fruits: '#e74c3c',
    herbs: '#26a69a',
    flowers: '#9c27b0',
    coverCrops: '#8d6e63',
  };

  const openAdd = () => {
    setEditing(null);
    setForm({
      name: '', family: 'Brassicaceae', icon: '🌱', season: 'cool',
      spacing: 20, rowSpacing: 30, daysToMaturity: 60,
      seedsPerGram: 100, germinationRate: 0.8, successionInterval: 0,
      kcCoeff: 1.0, droughtTolerance: 'medium', category: 'greens',
    });
    setShowModal(true);
  };

  const openEdit = (crop) => {
    setEditing(crop.id);
    setForm({ ...crop });
    setShowModal(true);
  };

  const [formError, setFormError] = useState('');

  const save = () => {
    if (!form.name.trim()) { setFormError('Crop name is required.'); return; }
    setFormError('');
    updateState(prev => {
      const list = [...prev.crops];
      if (editing) {
        const idx = list.findIndex(c => c.id === editing);
        if (idx >= 0) list[idx] = { ...list[idx], ...form, spacing: +form.spacing, rowSpacing: +form.rowSpacing, daysToMaturity: +form.daysToMaturity, seedsPerGram: +form.seedsPerGram, germinationRate: +form.germinationRate, successionInterval: +form.successionInterval, kcCoeff: +form.kcCoeff };
      } else {
        let newId = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const existingIds = new Set(list.map(c => c.id));
        while (existingIds.has(newId)) {
          newId += '-' + Math.random().toString(36).slice(2, 5);
        }
        list.push({
          id: newId,
          ...form,
          spacing: +form.spacing, rowSpacing: +form.rowSpacing, daysToMaturity: +form.daysToMaturity,
          seedsPerGram: +form.seedsPerGram, germinationRate: +form.germinationRate, successionInterval: +form.successionInterval, kcCoeff: +form.kcCoeff,
        });
      }
      return { ...prev, crops: list };
    });
    setShowModal(false);
  };

  const remove = (id) => {
    const crop = crops.find(c => c.id === id);
    // Snapshot related data for undo
    const removedHarvests = (harvests || []).filter(h => h.cropId === id);
    const removedPestLogs = (pestLogs || []).filter(p => p.cropId === id);
    const removedRotation = (rotationHistory || []).filter(r => r.cropId === id);
    const wasSelected = (selectedCropIds || []).includes(id);
    // Snapshot plantings per bed
    const removedPlantings = {};
    zones.forEach(z => z.beds.forEach(b => {
      const bp = (b.plantings || []).filter(p => p.cropId === id);
      if (bp.length) removedPlantings[b.id] = bp;
    }));

    updateState(prev => ({
      ...prev,
      crops: prev.crops.filter(c => c.id !== id),
      selectedCropIds: (prev.selectedCropIds || []).filter(cid => cid !== id),
      harvests: (prev.harvests || []).filter(h => h.cropId !== id),
      pestLogs: (prev.pestLogs || []).filter(p => p.cropId !== id),
      rotationHistory: (prev.rotationHistory || []).filter(r => r.cropId !== id),
      zones: prev.zones.map(z => ({
        ...z,
        beds: z.beds.map(b => ({
          ...b,
          plantings: (b.plantings || []).filter(p => p.cropId !== id),
        })),
      })),
    }));
    setDeleteConfirm(null);

    if (crop) {
      showToast(`"${crop.name}" and all related data deleted`, {
        type: 'warning',
        undo: () => updateState(prev => ({
          ...prev,
          crops: [...prev.crops, crop],
          selectedCropIds: wasSelected ? [...(prev.selectedCropIds || []), id] : prev.selectedCropIds,
          harvests: [...(prev.harvests || []), ...removedHarvests],
          pestLogs: [...(prev.pestLogs || []), ...removedPestLogs],
          rotationHistory: [...(prev.rotationHistory || []), ...removedRotation],
          zones: prev.zones.map(z => ({
            ...z,
            beds: z.beds.map(b => ({
              ...b,
              plantings: removedPlantings[b.id]
                ? [...(b.plantings || []), ...removedPlantings[b.id]]
                : b.plantings,
            })),
          })),
        })),
      });
    }
  };

  const openPlantModal = (crop) => {
    setShowPlantModal(crop);
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const week = Math.max(1, Math.min(52, Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7)));
    setPlantForm({ bedId: allBeds[0]?.id || '', startWeek: week });
  };

  const addToSeason = () => {
    if (!plantForm.bedId || !showPlantModal) return;
    updateState(prev => ({
      ...prev,
      zones: prev.zones.map(z => ({
        ...z,
        beds: z.beds.map(b => b.id === plantForm.bedId ? {
          ...b,
          plantings: [...(b.plantings || []), {
            id: generateId(),
            cropId: showPlantModal.id,
            startWeek: +plantForm.startWeek,
            year: currentYear,
            notes: '',
            source: 'manual',
          }],
        } : b),
      })),
    }));
    setShowPlantModal(null);
  };

  const renderCropRow = (crop) => (
    <tr
      key={crop.id}
      onClick={() => openEdit(crop)}
      style={{ borderBottom: `1px solid ${theme.borderLight}`, cursor: 'pointer', transition: 'background 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.background = theme.bgHover}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <td style={{ padding: '8px', textAlign: 'center', width: '36px' }} onClick={e => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selectedSet.has(crop.id)}
          onChange={() => toggleCropSelection(crop.id)}
          style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: theme.accent }}
        />
      </td>
      <td style={{ padding: '8px', color: theme.text, fontWeight: '500' }}>{crop.icon} {crop.name}</td>
      <td style={{ padding: '8px' }}>
        <Badge bg={familyColors[crop.family] || '#888'} color="#fff">{crop.family}</Badge>
      </td>
      <td style={{ padding: '8px', color: theme.textSecondary }}>{crop.season === 'warm' ? '☀️ Warm' : '❄️ Cool'}</td>
      <td style={{ padding: '8px', color: theme.textSecondary }}>{crop.spacing} cm</td>
      <td style={{ padding: '8px', color: theme.textSecondary }}>{crop.rowSpacing} cm</td>
      <td style={{ padding: '8px', color: theme.accent, fontWeight: '600' }}>{crop.daysToMaturity}</td>
      <td style={{ padding: '8px', color: theme.textSecondary }}>{crop.seedsPerGram}</td>
      <td style={{ padding: '8px', color: theme.textSecondary }}>{(crop.germinationRate * 100).toFixed(0)}%</td>
      <td style={{ padding: '8px', color: crop.successionInterval > 0 ? theme.warning : theme.textMuted }}>
        {crop.successionInterval > 0 ? `${crop.successionInterval}d` : '—'}
      </td>
      <td style={{ padding: '8px', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
        <button
          onClick={() => openPlantModal(crop)}
          title="Add to season"
          style={{ background: theme.accent, color: '#fff', border: 'none', cursor: 'pointer', fontSize: '11px', padding: '4px 8px', borderRadius: '6px', fontWeight: '600', marginRight: '6px', fontFamily: "'Libre Franklin', sans-serif" }}
        >+ Season</button>
        <button
          onClick={() => setDeleteConfirm(crop)}
          title="Delete crop"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
        >🗑️</button>
      </td>
    </tr>
  );

  const tableHead = (
    <thead>
      <tr style={{ borderBottom: `2px solid ${theme.border}` }}>
        <th style={{ padding: '8px', textAlign: 'center', width: '36px', color: theme.textSecondary, fontWeight: '600', fontSize: '11px' }}>✓</th>
        {['Crop', 'Family', 'Season', 'Spacing', 'Row Sp.', 'Days', 'Seeds/g', 'Germ %', 'Succession', 'Actions'].map(h => (
          <th key={h} style={{ padding: '8px', textAlign: h === 'Actions' ? 'center' : 'left', color: theme.textSecondary, fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
        ))}
      </tr>
    </thead>
  );

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ margin: 0, fontFamily: "'DM Serif Display', serif", color: theme.text }}>🌾 Crop Database</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: theme.textMuted }}>{filteredCrops.length} crops</span>
          <Button onClick={openAdd}>+ Add Crop</Button>
        </div>
      </div>

      {/* Type filter tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '4px', flexWrap: 'wrap' }}>
        {cropTypes.map(t => {
          const isActive = activeType === t.value;
          const count = t.value === 'all'
            ? crops.length
            : crops.filter(c => (categoryToType[c.category] || 'vegetables') === t.value).length;
          return (
            <button
              key={t.value}
              onClick={() => setActiveType(t.value)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: isActive ? `2px solid ${t.color}` : `1.5px solid ${theme.border}`,
                background: isActive ? `${t.color}15` : 'transparent',
                color: isActive ? t.color : theme.textSecondary,
                fontSize: '12px',
                fontWeight: isActive ? '700' : '500',
                cursor: 'pointer',
                fontFamily: "'Libre Franklin', sans-serif",
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {t.label}
              <span style={{
                fontSize: '10px',
                background: isActive ? t.color : theme.borderLight,
                color: isActive ? '#fff' : theme.textMuted,
                padding: '1px 6px',
                borderRadius: '10px',
                fontWeight: '600',
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search crops by name or family..."
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '8px 14px',
            borderRadius: '8px',
            border: `1.5px solid ${theme.border}`,
            background: theme.bgCard,
            color: theme.text,
            fontSize: '13px',
            fontFamily: "'Libre Franklin', sans-serif",
            outline: 'none',
          }}
        />
      </div>

      {/* Selection summary bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px',
        marginBottom: '16px', padding: '8px 14px', borderRadius: '8px',
        background: selectedSet.size > 0 ? `${theme.accent}08` : theme.bgHover,
        border: `1px solid ${selectedSet.size > 0 ? theme.accent + '30' : theme.borderLight}`,
      }}>
        <div style={{ fontSize: '13px', color: theme.text }}>
          <strong style={{ color: theme.accent }}>{selectedSet.size}</strong> of {crops.length} crops selected for season
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={selectAllVisible} style={{
            fontSize: '11px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
            border: `1px solid ${theme.borderLight}`, background: 'transparent', color: theme.textSecondary,
            fontFamily: "'Libre Franklin', sans-serif",
          }}>Select All Visible</button>
          <button onClick={deselectAllVisible} style={{
            fontSize: '11px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
            border: `1px solid ${theme.borderLight}`, background: 'transparent', color: theme.textSecondary,
            fontFamily: "'Libre Franklin', sans-serif",
          }}>Deselect Visible</button>
        </div>
      </div>

      {/* Table - grouped when "All" is selected */}
      {activeType === 'all' && !search.trim() ? (
        // Grouped view
        typeOrder.map(type => {
          const typeCrops = groupedCrops?.[type];
          if (!typeCrops || typeCrops.length === 0) return null;
          return (
            <div key={type} style={{ marginBottom: '24px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
                padding: '8px 12px',
                background: `${typeColors[type]}10`,
                borderRadius: '8px',
                borderLeft: `4px solid ${typeColors[type]}`,
              }}>
                <span style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontSize: '16px',
                  color: typeColors[type],
                  fontWeight: '600',
                }}>{typeLabels[type]}</span>
                <span style={{
                  fontSize: '11px',
                  background: typeColors[type],
                  color: '#fff',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontWeight: '600',
                }}>{typeCrops.length}</span>
              </div>
              <Card style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: "'Libre Franklin', sans-serif" }}>
                  {tableHead}
                  <tbody>
                    {typeCrops.map(renderCropRow)}
                  </tbody>
                </table>
              </Card>
            </div>
          );
        })
      ) : (
        // Flat filtered view
        <Card style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: "'Libre Franklin', sans-serif" }}>
            {tableHead}
            <tbody>
              {filteredCrops.length === 0 ? (
                <tr><td colSpan="11" style={{ padding: '40px', textAlign: 'center', color: theme.textMuted }}>
                  No crops found matching your filter.
                </td></tr>
              ) : (<>
                {virtualCrops.map(renderCropRow)}
                {hasMore && (
                  <tr ref={sentinelRef}><td colSpan="11" style={{ padding: '12px', textAlign: 'center', color: theme.textMuted, fontSize: '12px' }}>
                    Loading more crops...
                  </td></tr>
                )}
              </>)}
            </tbody>
          </table>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Crop" width="400px">
        {deleteConfirm && (
          <div>
            <div style={{ padding: '16px', background: '#fef2f2', borderRadius: '8px', marginBottom: '16px', textAlign: 'center' }}>
              <span style={{ fontSize: '32px' }}>{deleteConfirm.icon}</span>
              <p style={{ margin: '8px 0 0', fontFamily: "'Libre Franklin', sans-serif", fontSize: '14px', color: '#991b1b' }}>
                Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
              </p>
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#b91c1c' }}>
                This will remove the crop and all its plantings, harvests, and rotation history.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <button
                onClick={() => remove(deleteConfirm.id)}
                style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontFamily: "'Libre Franklin', sans-serif", fontSize: '13px' }}
              >Delete</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add to Season Modal */}
      <Modal open={!!showPlantModal} onClose={() => setShowPlantModal(null)} title="Add to Season" width="420px">
        {showPlantModal && (
          <div>
            <div style={{ padding: '12px', background: `${theme.accent}10`, borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '28px' }}>{showPlantModal.icon}</span>
              <div>
                <div style={{ fontWeight: '600', color: theme.text, fontFamily: "'DM Serif Display', serif" }}>{showPlantModal.name}</div>
                <div style={{ fontSize: '12px', color: theme.textSecondary }}>{showPlantModal.family} · {showPlantModal.daysToMaturity} days · Season {currentYear}</div>
              </div>
            </div>
            {allBeds.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: theme.textSecondary, fontSize: '13px' }}>
                No beds available. Create a zone and bed on the Beds tab first.
              </div>
            ) : (
              <>
                <FormField label="Bed">
                  <Select value={plantForm.bedId} onChange={e => setPlantForm({ ...plantForm, bedId: e.target.value })}>
                    {allBeds.map(b => <option key={b.id} value={b.id}>{b.name} ({b.zoneName})</option>)}
                  </Select>
                </FormField>
                <FormField label="Start Week">
                  <Input type="number" min={1} max={52} value={plantForm.startWeek} onChange={e => setPlantForm({ ...plantForm, startWeek: e.target.value })} />
                </FormField>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <Button variant="ghost" onClick={() => setShowPlantModal(null)}>Cancel</Button>
                  <Button onClick={addToSeason}>🌱 Plant</Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Edit/Add Crop Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Crop' : 'Add Crop'} width="550px">
        <FormField label="Name">
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Crop name" />
        </FormField>
        <div style={{ display: 'flex', gap: '12px' }}>
          <FormField label="Family" style={{ flex: 2 }}>
            <Select value={form.family} onChange={e => setForm({ ...form, family: e.target.value })}>
              {FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
            </Select>
          </FormField>
          <FormField label="Icon" style={{ flex: 1 }}>
            <Select value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })}>
              {ICONS.map(i => <option key={i} value={i}>{i}</option>)}
            </Select>
          </FormField>
          <FormField label="Season" style={{ flex: 1 }}>
            <Select value={form.season} onChange={e => setForm({ ...form, season: e.target.value })}>
              {SEASONS.map(s => <option key={s} value={s}>{s === 'warm' ? '☀️ Warm' : '❄️ Cool'}</option>)}
            </Select>
          </FormField>
        </div>
        <FormField label="Category">
          <Select value={form.category || 'greens'} onChange={e => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </FormField>
        <div style={{ display: 'flex', gap: '12px' }}>
          <FormField label="Spacing (cm)" style={{ flex: 1 }}>
            <Input type="number" value={form.spacing} onChange={e => setForm({ ...form, spacing: e.target.value })} />
          </FormField>
          <FormField label="Row Spacing (cm)" style={{ flex: 1 }}>
            <Input type="number" value={form.rowSpacing} onChange={e => setForm({ ...form, rowSpacing: e.target.value })} />
          </FormField>
          <FormField label="Days to Maturity" style={{ flex: 1 }}>
            <Input type="number" value={form.daysToMaturity} onChange={e => setForm({ ...form, daysToMaturity: e.target.value })} />
          </FormField>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <FormField label="Seeds/gram" style={{ flex: 1 }}>
            <Input type="number" value={form.seedsPerGram} onChange={e => setForm({ ...form, seedsPerGram: e.target.value })} />
          </FormField>
          <FormField label="Germination %" style={{ flex: 1 }}>
            <Input type="number" step="0.01" value={form.germinationRate} onChange={e => setForm({ ...form, germinationRate: e.target.value })} />
          </FormField>
          <FormField label="Succession (days)" style={{ flex: 1 }}>
            <Input type="number" value={form.successionInterval} onChange={e => setForm({ ...form, successionInterval: e.target.value })} />
          </FormField>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <FormField label="Kc Coefficient" style={{ flex: 1 }}>
            <Input type="number" step="0.05" value={form.kcCoeff} onChange={e => setForm({ ...form, kcCoeff: e.target.value })} />
          </FormField>
          <FormField label="Drought Tolerance" style={{ flex: 1 }}>
            <Select value={form.droughtTolerance} onChange={e => setForm({ ...form, droughtTolerance: e.target.value })}>
              <option value="low">💧💧💧 Low</option>
              <option value="medium">💧💧 Medium</option>
              <option value="high">💧 High</option>
            </Select>
          </FormField>
        </div>
        {formError && <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '8px' }}>{formError}</div>}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? 'Update' : 'Add Crop'}</Button>
        </div>
      </Modal>
    </div>
  );
}

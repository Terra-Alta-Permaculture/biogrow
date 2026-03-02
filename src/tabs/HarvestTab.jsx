import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Card, SummaryCard, Button, Modal, FormField, Input, Select, Badge, EmptyState } from '../components/shared';
import { generateId, formatDate } from '../utils/helpers';
import { exportHarvestReportPdf } from '../utils/pdfExport';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const QUALITIES = ['A','B','C'];

export default function HarvestTab() {
  const { harvests, zones, crops, selectedCropIds, settings, updateState, theme, showToast, user } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [filterCrop, setFilterCrop] = useState('all');
  const [filterZone, setFilterZone] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [form, setForm] = useState({ cropId: '', bedId: '', date: new Date().toISOString().slice(0,10), weight: '', quality: 'A', pricePerKg: '', buyer: '', notes: '' });
  const [quickMode, setQuickMode] = useState(false);
  const [quickCrop, setQuickCrop] = useState('');
  const [quickWeight, setQuickWeight] = useState('');
  const [showComparison, setShowComparison] = useState(false);

  const allBeds = useMemo(() => zones.flatMap(z => z.beds.map(b => ({ ...b, zoneName: z.name, zoneId: z.id }))), [zones]);

  const filtered = useMemo(() => {
    let h = [...(harvests || [])];
    if (filterCrop !== 'all') h = h.filter(x => x.cropId === filterCrop);
    if (filterZone !== 'all') h = h.filter(x => {
      const bed = allBeds.find(b => b.id === x.bedId);
      return bed && bed.zoneId === filterZone;
    });
    if (filterMonth !== 'all') h = h.filter(x => new Date(x.date).getMonth() === parseInt(filterMonth));
    return h.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [harvests, filterCrop, filterZone, filterMonth, allBeds]);

  const stats = useMemo(() => {
    const h = harvests || [];
    const totalYield = h.reduce((s, x) => s + (parseFloat(x.weight) || 0), 0);
    const totalRevenue = h.reduce((s, x) => s + ((parseFloat(x.weight) || 0) * (parseFloat(x.pricePerKg) || 0)), 0);
    const cropSet = new Set(h.map(x => x.cropId));
    return {
      count: h.length,
      totalYield: totalYield.toFixed(1),
      totalRevenue: totalRevenue.toFixed(2),
      avgPerKg: totalYield > 0 ? (totalRevenue / totalYield).toFixed(2) : '0.00',
      cropCount: cropSet.size,
    };
  }, [harvests]);

  const monthlyData = useMemo(() => {
    const data = Array(12).fill(0);
    (harvests || []).forEach(h => {
      const m = new Date(h.date).getMonth();
      data[m] += parseFloat(h.weight) || 0;
    });
    return data;
  }, [harvests]);

  const maxMonthly = Math.max(...monthlyData, 1);

  const cropBreakdown = useMemo(() => {
    const map = {};
    (harvests || []).forEach(h => {
      if (!map[h.cropId]) map[h.cropId] = { yield: 0, revenue: 0, count: 0 };
      const w = parseFloat(h.weight) || 0;
      map[h.cropId].yield += w;
      map[h.cropId].revenue += w * (parseFloat(h.pricePerKg) || 0);
      map[h.cropId].count++;
    });
    return Object.entries(map).map(([cropId, d]) => {
      const crop = crops.find(c => c.id === cropId);
      return { cropId, crop, ...d, perKg: d.yield > 0 ? (d.revenue / d.yield).toFixed(2) : '0.00' };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [harvests, crops]);

  const bedYields = useMemo(() => {
    const map = {};
    (harvests || []).forEach(h => {
      if (!map[h.bedId]) map[h.bedId] = 0;
      map[h.bedId] += parseFloat(h.weight) || 0;
    });
    return Object.entries(map).map(([bedId, totalKg]) => {
      const bed = allBeds.find(b => b.id === bedId);
      const area = bed ? bed.width * bed.length : 1;
      return { bedId, bed, totalKg, kgPerM2: (totalKg / area).toFixed(1) };
    }).sort((a, b) => parseFloat(b.kgPerM2) - parseFloat(a.kgPerM2));
  }, [harvests, allBeds]);

  const maxBedYield = Math.max(...bedYields.map(b => parseFloat(b.kgPerM2)), 1);

  // Year-over-Year comparison
  const currentYear = settings?.currentYear || new Date().getFullYear();
  const prevYear = currentYear - 1;

  const yearComparison = useMemo(() => {
    const h = harvests || [];
    const currData = Array(12).fill(0);
    const prevData = Array(12).fill(0);
    const currRev = Array(12).fill(0);
    const prevRev = Array(12).fill(0);
    let hasPrev = false;
    h.forEach(entry => {
      const d = new Date(entry.date);
      const y = d.getFullYear();
      const m = d.getMonth();
      const w = parseFloat(entry.weight) || 0;
      const r = w * (parseFloat(entry.pricePerKg) || 0);
      if (y === currentYear) { currData[m] += w; currRev[m] += r; }
      else if (y === prevYear) { prevData[m] += w; prevRev[m] += r; hasPrev = true; }
    });
    const currTotal = currData.reduce((a, b) => a + b, 0);
    const prevTotal = prevData.reduce((a, b) => a + b, 0);
    const currRevTotal = currRev.reduce((a, b) => a + b, 0);
    const prevRevTotal = prevRev.reduce((a, b) => a + b, 0);
    const yieldChange = prevTotal > 0 ? Math.round(((currTotal - prevTotal) / prevTotal) * 100) : null;
    const revChange = prevRevTotal > 0 ? Math.round(((currRevTotal - prevRevTotal) / prevRevTotal) * 100) : null;
    return { currData, prevData, hasPrev, currTotal, prevTotal, currRevTotal, prevRevTotal, yieldChange, revChange };
  }, [harvests, currentYear, prevYear]);

  const openAdd = () => {
    setEditing(null);
    setForm({ cropId: crops[0]?.id || '', bedId: allBeds[0]?.id || '', date: new Date().toISOString().slice(0,10), weight: '', quality: 'A', pricePerKg: '', buyer: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (h) => {
    setEditing(h.id);
    setForm({ cropId: h.cropId, bedId: h.bedId, date: h.date, weight: h.weight, quality: h.quality, pricePerKg: h.pricePerKg, buyer: h.buyer || '', notes: h.notes || '' });
    setShowModal(true);
  };

  const [formError, setFormError] = useState('');

  const save = () => {
    if (!form.cropId) { setFormError('Please select a crop.'); return; }
    if (!form.weight || +form.weight <= 0) { setFormError('Please enter a valid weight.'); return; }
    setFormError('');
    const entry = { ...form, weight: form.weight.toString(), pricePerKg: form.pricePerKg.toString() };
    updateState(prev => {
      const list = [...(prev.harvests || [])];
      if (editing) {
        const idx = list.findIndex(x => x.id === editing);
        if (idx >= 0) list[idx] = { ...list[idx], ...entry };
      } else {
        list.push({ id: generateId(), ...entry });
      }
      return { ...prev, harvests: list };
    });
    setShowModal(false);
  };

  const remove = (id) => {
    const item = (harvests || []).find(x => x.id === id);
    updateState(prev => ({ ...prev, harvests: (prev.harvests || []).filter(x => x.id !== id) }));
    setDeleteConfirm(null);
    if (item) {
      const crop = crops.find(c => c.id === item.cropId);
      showToast(`Harvest "${crop?.name || 'entry'}" deleted`, {
        type: 'warning',
        undo: () => updateState(prev => ({ ...prev, harvests: [...(prev.harvests || []), item] })),
      });
    }
  };

  const getCrop = (id) => crops.find(c => c.id === id);
  const getBed = (id) => allBeds.find(b => b.id === id);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTotal = useMemo(() => {
    return (harvests || [])
      .filter(h => h.date === todayStr)
      .reduce((s, h) => s + (parseFloat(h.weight) || 0), 0);
  }, [harvests, todayStr]);

  const quickCrops = useMemo(() => {
    if (selectedCropIds?.length > 0) {
      return crops.filter(c => selectedCropIds.includes(c.id));
    }
    return crops;
  }, [crops, selectedCropIds]);

  const handleQuickSave = () => {
    if (!quickCrop || !quickWeight || +quickWeight <= 0) return;
    // Find last bed used for this crop
    const lastHarvest = [...(harvests || [])].reverse().find(h => h.cropId === quickCrop);
    const entry = {
      id: generateId(),
      cropId: quickCrop,
      bedId: lastHarvest?.bedId || allBeds[0]?.id || '',
      date: todayStr,
      weight: quickWeight.toString(),
      quality: 'A',
      pricePerKg: lastHarvest?.pricePerKg || '',
      buyer: '',
      notes: '',
    };
    updateState(prev => ({ ...prev, harvests: [...(prev.harvests || []), entry] }));
    const crop = getCrop(quickCrop);
    showToast(`${quickWeight} kg of ${crop?.name || 'crop'} logged`, { type: 'success' });
    setQuickWeight('');
  };

  const s = { label: { fontSize: '12px', color: theme.textMuted, fontFamily: "'Libre Franklin', sans-serif" } };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ margin: 0, fontFamily: "'DM Serif Display', serif", color: theme.text }}>🧺 Harvest Log</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => exportHarvestReportPdf({ harvests, crops, zones, settings, user })} style={{ fontSize: '12px', padding: '6px 14px' }}>
            📄 Export Report
          </Button>
          <Button variant={quickMode ? 'secondary' : 'ghost'} onClick={() => setQuickMode(!quickMode)}>
            {quickMode ? 'Close Quick Log' : '⚡ Quick Log'}
          </Button>
          <Button onClick={openAdd}>+ Log Harvest</Button>
        </div>
      </div>

      {/* Quick Log Inline Card */}
      {quickMode && (
        <Card style={{ marginBottom: '16px', padding: '16px', borderLeft: `4px solid ${theme.accent}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '15px' }}>
              ⚡ Quick Harvest Log
            </h4>
            {todayTotal > 0 && (
              <Badge bg={theme.accent} color="#fff">Today: {todayTotal.toFixed(1)} kg</Badge>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '2 1 160px' }}>
              <label style={{ fontSize: '11px', color: theme.textSecondary, fontWeight: '600', marginBottom: '4px', display: 'block' }}>Crop</label>
              <select
                value={quickCrop}
                onChange={e => setQuickCrop(e.target.value)}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: '8px',
                  border: `1.5px solid ${theme.border}`, background: theme.bgInput,
                  color: theme.text, fontSize: '13px', fontFamily: "'Libre Franklin', sans-serif",
                }}
              >
                <option value="">Select crop...</option>
                {quickCrops.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 100px' }}>
              <label style={{ fontSize: '11px', color: theme.textSecondary, fontWeight: '600', marginBottom: '4px', display: 'block' }}>Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                value={quickWeight}
                onChange={e => setQuickWeight(e.target.value)}
                placeholder="0.0"
                onKeyDown={e => e.key === 'Enter' && handleQuickSave()}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: '8px',
                  border: `1.5px solid ${theme.border}`, background: theme.bgInput,
                  color: theme.text, fontSize: '13px', fontFamily: "'Libre Franklin', sans-serif",
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <Button
              onClick={handleQuickSave}
              style={{ padding: '8px 16px', opacity: quickCrop && quickWeight && +quickWeight > 0 ? 1 : 0.5 }}
            >
              Save
            </Button>
          </div>
          <div style={{ fontSize: '11px', color: theme.textMuted, marginTop: '8px' }}>
            Auto-fills: date = today, quality = A, bed = last used for this crop
          </div>
        </Card>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
        <SummaryCard icon="🧺" label="Total Harvests" value={stats.count} />
        <SummaryCard icon="⚖️" label="Total Yield" value={`${stats.totalYield} kg`} color={theme.accent} />
        <SummaryCard icon="💰" label="Revenue" value={`€${stats.totalRevenue}`} color="#2e7d32" />
        <SummaryCard icon="📊" label="Avg €/kg" value={`€${stats.avgPerKg}`} />
        <SummaryCard icon="🌿" label="Crops Harvested" value={stats.cropCount} />
      </div>

      {/* Monthly yield chart */}
      <Card style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 16px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '16px' }}>Monthly Yield (kg)</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px' }}>
          {MONTHS.map((m, i) => (
            <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ fontSize: '10px', color: theme.textMuted, marginBottom: '4px' }}>{monthlyData[i] > 0 ? monthlyData[i].toFixed(0) : ''}</div>
              <div style={{
                width: '100%',
                maxWidth: '40px',
                height: `${(monthlyData[i] / maxMonthly) * 90}%`,
                minHeight: monthlyData[i] > 0 ? '4px' : '0',
                background: `linear-gradient(to top, ${theme.accent}, #81c784)`,
                borderRadius: '4px 4px 0 0',
                transition: 'height 0.3s',
              }} />
              <div style={{ fontSize: '10px', color: theme.textMuted, marginTop: '4px' }}>{m}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Year-over-Year Comparison */}
      {yearComparison.hasPrev && (
        <Card style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showComparison ? '16px' : '0' }}>
            <h3 style={{ margin: 0, fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '16px' }}>
              📊 Year Comparison
            </h3>
            <button
              onClick={() => setShowComparison(!showComparison)}
              style={{
                padding: '4px 12px', borderRadius: '6px', border: `1px solid ${theme.border}`,
                background: showComparison ? theme.accent : 'transparent',
                color: showComparison ? '#fff' : theme.textSecondary,
                fontSize: '12px', cursor: 'pointer', fontFamily: "'Libre Franklin', sans-serif",
              }}
            >
              {showComparison ? 'Hide' : 'Show'} {prevYear} vs {currentYear}
            </button>
          </div>
          {showComparison && (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px', marginBottom: '8px' }}>
                {MONTHS.map((m, i) => {
                  const maxVal = Math.max(...yearComparison.currData, ...yearComparison.prevData, 1);
                  return (
                    <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', width: '100%', justifyContent: 'center', height: '100%' }}>
                        <div style={{
                          width: '45%', maxWidth: '18px',
                          height: `${(yearComparison.prevData[i] / maxVal) * 90}%`,
                          minHeight: yearComparison.prevData[i] > 0 ? '3px' : '0',
                          background: theme.textMuted + '40', borderRadius: '3px 3px 0 0',
                        }} title={`${prevYear}: ${yearComparison.prevData[i].toFixed(1)} kg`} />
                        <div style={{
                          width: '45%', maxWidth: '18px',
                          height: `${(yearComparison.currData[i] / maxVal) * 90}%`,
                          minHeight: yearComparison.currData[i] > 0 ? '3px' : '0',
                          background: theme.accent, borderRadius: '3px 3px 0 0',
                        }} title={`${currentYear}: ${yearComparison.currData[i].toFixed(1)} kg`} />
                      </div>
                      <div style={{ fontSize: '9px', color: theme.textMuted, marginTop: '3px' }}>{m}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', fontSize: '11px', color: theme.textMuted, marginBottom: '10px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: theme.textMuted + '40' }} /> {prevYear}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: theme.accent }} /> {currentYear}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', fontSize: '13px' }}>
                {yearComparison.yieldChange !== null && (
                  <span style={{ color: yearComparison.yieldChange >= 0 ? '#16a34a' : '#dc2626', fontWeight: '600' }}>
                    Yield: {yearComparison.yieldChange >= 0 ? '+' : ''}{yearComparison.yieldChange}% vs {prevYear}
                  </span>
                )}
                {yearComparison.revChange !== null && (
                  <span style={{ color: yearComparison.revChange >= 0 ? '#16a34a' : '#dc2626', fontWeight: '600' }}>
                    Revenue: {yearComparison.revChange >= 0 ? '+' : ''}{yearComparison.revChange}% vs {prevYear}
                  </span>
                )}
              </div>
            </>
          )}
        </Card>
      )}

      {/* Filters */}
      <Card style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <div>
            <span style={s.label}>Crop: </span>
            <select value={filterCrop} onChange={e => setFilterCrop(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${theme.border}`, background: theme.bgInput, color: theme.text, fontSize: '13px' }}>
              <option value="all">All Crops</option>
              {crops.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div>
            <span style={s.label}>Zone: </span>
            <select value={filterZone} onChange={e => setFilterZone(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${theme.border}`, background: theme.bgInput, color: theme.text, fontSize: '13px' }}>
              <option value="all">All Zones</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
          <div>
            <span style={s.label}>Month: </span>
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${theme.border}`, background: theme.bgInput, color: theme.text, fontSize: '13px' }}>
              <option value="all">All Months</option>
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* Harvest log table */}
      <Card style={{ marginBottom: '24px', overflowX: 'auto' }}>
        <h3 style={{ margin: '0 0 12px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '16px' }}>Harvest Log</h3>
        {filtered.length === 0 ? (
          <EmptyState icon="🧺" message="No harvests logged yet. Start tracking your yields!" />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: "'Libre Franklin', sans-serif" }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${theme.border}` }}>
                {['Date', 'Crop', 'Bed', 'Weight', 'Quality', '€/kg', 'Buyer', 'Revenue', ''].map(h => (
                  <th key={h} style={{ padding: '8px', textAlign: 'left', color: theme.textSecondary, fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(h => {
                const crop = getCrop(h.cropId);
                const bed = getBed(h.bedId);
                const rev = ((parseFloat(h.weight) || 0) * (parseFloat(h.pricePerKg) || 0)).toFixed(2);
                return (
                  <tr key={h.id} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
                    <td style={{ padding: '8px', color: theme.text }}>{formatDate(h.date)}</td>
                    <td style={{ padding: '8px', color: theme.text }}>{crop ? `${crop.icon} ${crop.name}` : h.cropId}</td>
                    <td style={{ padding: '8px', color: theme.textSecondary }}>{bed ? `${bed.name} (${bed.zoneName})` : h.bedId}</td>
                    <td style={{ padding: '8px', color: theme.text, fontWeight: '600' }}>{h.weight} kg</td>
                    <td style={{ padding: '8px' }}><Badge bg={h.quality === 'A' ? theme.accent : h.quality === 'B' ? theme.warning : theme.error} color="#fff">{h.quality}</Badge></td>
                    <td style={{ padding: '8px', color: theme.textSecondary }}>€{h.pricePerKg || '0'}</td>
                    <td style={{ padding: '8px', color: theme.textSecondary }}>{h.buyer || '—'}</td>
                    <td style={{ padding: '8px', color: '#2e7d32', fontWeight: '600' }}>€{rev}</td>
                    <td style={{ padding: '8px', display: 'flex', gap: '4px' }}>
                      <button onClick={() => openEdit(h)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>✏️</button>
                      <button onClick={() => setDeleteConfirm(h)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>🗑️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Crop breakdown */}
      {cropBreakdown.length > 0 && (
        <Card style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 12px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '16px' }}>Per-Crop Breakdown</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {cropBreakdown.map(cb => (
              <div key={cb.cropId} style={{ background: theme.bgTab, borderRadius: '10px', padding: '12px 16px', minWidth: '180px', flex: '1 1 180px' }}>
                <div style={{ fontSize: '15px', fontWeight: '600', color: theme.text, marginBottom: '6px' }}>{cb.crop ? `${cb.crop.icon} ${cb.crop.name}` : cb.cropId}</div>
                <div style={{ fontSize: '12px', color: theme.textSecondary, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span>Yield: <strong>{cb.yield.toFixed(1)} kg</strong></span>
                  <span>Revenue: <strong style={{ color: '#2e7d32' }}>€{cb.revenue.toFixed(2)}</strong></span>
                  <span>Avg: <strong>€{cb.perKg}/kg</strong></span>
                  <span>Harvests: {cb.count}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Bed yield analysis */}
      {bedYields.length > 0 && (
        <Card>
          <h3 style={{ margin: '0 0 12px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '16px' }}>Bed Yield Analysis (kg/m²)</h3>
          {bedYields.map(by => (
            <div key={by.bedId} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{ width: '120px', fontSize: '12px', color: theme.textSecondary, flexShrink: 0 }}>{by.bed ? by.bed.name : by.bedId}</div>
              <div style={{ flex: 1, background: theme.bgTab, borderRadius: '4px', height: '20px', overflow: 'hidden' }}>
                <div style={{
                  width: `${(parseFloat(by.kgPerM2) / maxBedYield) * 100}%`,
                  height: '100%',
                  background: `linear-gradient(to right, ${theme.accent}, #81c784)`,
                  borderRadius: '4px',
                  minWidth: '2px',
                }} />
              </div>
              <div style={{ width: '70px', fontSize: '12px', fontWeight: '600', color: theme.text, textAlign: 'right' }}>{by.kgPerM2} kg/m²</div>
            </div>
          ))}
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Harvest?" width="400px">
        {deleteConfirm && (() => {
          const crop = getCrop(deleteConfirm.cropId);
          return (
            <div>
              <p style={{ margin: '0 0 16px', color: theme.textSecondary, fontSize: '14px' }}>
                Delete harvest of <strong>{crop ? `${crop.icon} ${crop.name}` : 'unknown crop'}</strong> ({deleteConfirm.weight} kg) from {formatDate(deleteConfirm.date)}?
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                <button onClick={() => remove(deleteConfirm.id)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#e53935', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>Delete</button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Harvest' : 'Log Harvest'}>
        <FormField label="Crop">
          <Select value={form.cropId} onChange={e => setForm({ ...form, cropId: e.target.value })}>
            {crops.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </Select>
        </FormField>
        <FormField label="Bed">
          <Select value={form.bedId} onChange={e => setForm({ ...form, bedId: e.target.value })}>
            {allBeds.map(b => <option key={b.id} value={b.id}>{b.name} ({b.zoneName})</option>)}
          </Select>
        </FormField>
        <FormField label="Date">
          <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
        </FormField>
        <div style={{ display: 'flex', gap: '12px' }}>
          <FormField label="Weight (kg)" style={{ flex: 1 }}>
            <Input type="number" step="0.1" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} placeholder="0.0" />
          </FormField>
          <FormField label="Quality" style={{ flex: 1 }}>
            <Select value={form.quality} onChange={e => setForm({ ...form, quality: e.target.value })}>
              {QUALITIES.map(q => <option key={q} value={q}>Grade {q}</option>)}
            </Select>
          </FormField>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <FormField label="Price/kg (€)" style={{ flex: 1 }}>
            <Input type="number" step="0.01" value={form.pricePerKg} onChange={e => setForm({ ...form, pricePerKg: e.target.value })} placeholder="0.00" />
          </FormField>
          <FormField label="Buyer" style={{ flex: 1 }}>
            <Input value={form.buyer} onChange={e => setForm({ ...form, buyer: e.target.value })} placeholder="Market, Restaurant..." />
          </FormField>
        </div>
        <FormField label="Notes">
          <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." />
        </FormField>
        {formError && <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '8px' }}>{formError}</div>}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? 'Update' : 'Log Harvest'}</Button>
        </div>
      </Modal>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Card, SummaryCard, Button, Modal, FormField, Input, Select, Badge, EmptyState } from '../components/shared';
import { generateId, formatDate } from '../utils/helpers';
import { exportAnalyticsReportPdf } from '../utils/pdfExport';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const EXPENSE_CATEGORIES = [
  { value: 'seeds', label: 'Seeds', icon: '🌰' },
  { value: 'labor', label: 'Labor', icon: '👷' },
  { value: 'inputs', label: 'Inputs (fertilizer, soil)', icon: '🧪' },
  { value: 'equipment', label: 'Equipment', icon: '🔧' },
  { value: 'water', label: 'Water / Irrigation', icon: '💧' },
  { value: 'other', label: 'Other', icon: '📦' },
];
const CAT_COLORS = { seeds: '#8bc34a', labor: '#ff9800', inputs: '#9c27b0', equipment: '#607d8b', water: '#03a9f4', other: '#795548' };

export default function AnalyticsTab() {
  const { harvests, expenses, laborLogs, zones, crops, settings, updateState, theme, showToast, user } = useApp();
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showLaborModal, setShowLaborModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editType, setEditType] = useState(null); // 'expense' | 'labor'
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [view, setView] = useState('overview'); // 'overview' | 'expenses' | 'labor'
  const [filterCat, setFilterCat] = useState('all');
  const [expForm, setExpForm] = useState({ date: new Date().toISOString().slice(0, 10), category: 'seeds', amount: '', description: '', cropId: '', notes: '' });
  const [labForm, setLabForm] = useState({ date: new Date().toISOString().slice(0, 10), hours: '', hourlyRate: '15', taskDescription: '', worker: '', cropId: '' });
  const [formError, setFormError] = useState('');

  const currentYear = settings?.currentYear || new Date().getFullYear();

  const allBeds = useMemo(() => zones.flatMap(z => z.beds.map(b => ({ ...b, zoneName: z.name, zoneId: z.id }))), [zones]);
  const totalArea = useMemo(() => allBeds.reduce((s, b) => s + (b.width || 0.75) * (b.length || 10), 0), [allBeds]);

  // --- Revenue from harvests ---
  const monthlyRevenue = useMemo(() => {
    const data = Array(12).fill(0);
    (harvests || []).forEach(h => {
      const d = new Date(h.date);
      if (d.getFullYear() !== currentYear) return;
      data[d.getMonth()] += (parseFloat(h.weight) || 0) * (parseFloat(h.pricePerKg) || 0);
    });
    return data;
  }, [harvests, currentYear]);

  const totalRevenue = monthlyRevenue.reduce((s, v) => s + v, 0);

  // --- Expenses ---
  const yearExpenses = useMemo(() => (expenses || []).filter(e => {
    const y = new Date(e.date).getFullYear();
    return y === currentYear;
  }), [expenses, currentYear]);

  const yearLabor = useMemo(() => (laborLogs || []).filter(l => {
    const y = new Date(l.date).getFullYear();
    return y === currentYear;
  }), [laborLogs, currentYear]);

  const monthlyExpenses = useMemo(() => {
    const data = Array(12).fill(0);
    yearExpenses.forEach(e => { data[new Date(e.date).getMonth()] += parseFloat(e.amount) || 0; });
    yearLabor.forEach(l => { data[new Date(l.date).getMonth()] += (parseFloat(l.hours) || 0) * (parseFloat(l.hourlyRate) || 0); });
    return data;
  }, [yearExpenses, yearLabor]);

  const totalExpenses = monthlyExpenses.reduce((s, v) => s + v, 0);
  const totalLaborCost = yearLabor.reduce((s, l) => s + (parseFloat(l.hours) || 0) * (parseFloat(l.hourlyRate) || 0), 0);
  const totalLaborHours = yearLabor.reduce((s, l) => s + (parseFloat(l.hours) || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';
  const costPerM2 = totalArea > 0 ? (totalExpenses / totalArea).toFixed(2) : '0.00';

  // --- Category breakdown ---
  const catBreakdown = useMemo(() => {
    const map = {};
    EXPENSE_CATEGORIES.forEach(c => { map[c.value] = 0; });
    yearExpenses.forEach(e => { map[e.category] = (map[e.category] || 0) + (parseFloat(e.amount) || 0); });
    // Add labor costs
    map.labor = (map.labor || 0) + totalLaborCost;
    return EXPENSE_CATEGORIES.map(c => ({ ...c, amount: map[c.value] || 0 })).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);
  }, [yearExpenses, totalLaborCost]);

  // --- Per-crop profitability ---
  const cropProfit = useMemo(() => {
    const revMap = {};
    (harvests || []).forEach(h => {
      if (new Date(h.date).getFullYear() !== currentYear) return;
      revMap[h.cropId] = (revMap[h.cropId] || 0) + (parseFloat(h.weight) || 0) * (parseFloat(h.pricePerKg) || 0);
    });
    const costMap = {};
    yearExpenses.filter(e => e.cropId).forEach(e => { costMap[e.cropId] = (costMap[e.cropId] || 0) + (parseFloat(e.amount) || 0); });
    yearLabor.filter(l => l.cropId).forEach(l => { costMap[l.cropId] = (costMap[l.cropId] || 0) + (parseFloat(l.hours) || 0) * (parseFloat(l.hourlyRate) || 0); });
    const ids = new Set([...Object.keys(revMap), ...Object.keys(costMap)]);
    return [...ids].map(id => {
      const crop = crops.find(c => c.id === id);
      const rev = revMap[id] || 0;
      const cost = costMap[id] || 0;
      return { cropId: id, crop, revenue: rev, cost, profit: rev - cost };
    }).sort((a, b) => b.profit - a.profit).slice(0, 10);
  }, [harvests, yearExpenses, yearLabor, crops, currentYear]);

  // --- Monthly labor hours ---
  const monthlyLabor = useMemo(() => {
    const data = Array(12).fill(0);
    yearLabor.forEach(l => { data[new Date(l.date).getMonth()] += parseFloat(l.hours) || 0; });
    return data;
  }, [yearLabor]);

  // --- Bed ROI ---
  const bedROI = useMemo(() => {
    const revMap = {};
    (harvests || []).forEach(h => {
      if (new Date(h.date).getFullYear() !== currentYear) return;
      revMap[h.bedId] = (revMap[h.bedId] || 0) + (parseFloat(h.weight) || 0) * (parseFloat(h.pricePerKg) || 0);
    });
    return Object.entries(revMap).map(([bedId, rev]) => {
      const bed = allBeds.find(b => b.id === bedId);
      const area = bed ? (bed.width || 0.75) * (bed.length || 10) : 1;
      return { bedId, bed, revenue: rev, perM2: (rev / area).toFixed(2) };
    }).sort((a, b) => parseFloat(b.perM2) - parseFloat(a.perM2)).slice(0, 10);
  }, [harvests, allBeds, currentYear]);

  // --- CRUD ---
  const openAddExpense = () => {
    setEditing(null); setEditType('expense');
    setExpForm({ date: new Date().toISOString().slice(0, 10), category: 'seeds', amount: '', description: '', cropId: '', notes: '' });
    setFormError('');
    setShowExpenseModal(true);
  };

  const openEditExpense = (e) => {
    setEditing(e.id); setEditType('expense');
    setExpForm({ date: e.date, category: e.category, amount: e.amount, description: e.description || '', cropId: e.cropId || '', notes: e.notes || '' });
    setFormError('');
    setShowExpenseModal(true);
  };

  const saveExpense = () => {
    if (!expForm.amount || +expForm.amount <= 0) { setFormError('Enter a valid amount.'); return; }
    if (!expForm.description.trim()) { setFormError('Enter a description.'); return; }
    setFormError('');
    const entry = { ...expForm, amount: expForm.amount.toString(), year: new Date(expForm.date).getFullYear() };
    updateState(prev => {
      const list = [...(prev.expenses || [])];
      if (editing) {
        const idx = list.findIndex(x => x.id === editing);
        if (idx >= 0) list[idx] = { ...list[idx], ...entry };
      } else {
        list.push({ id: generateId(), ...entry });
      }
      return { ...prev, expenses: list };
    });
    setShowExpenseModal(false);
    showToast(editing ? 'Expense updated' : 'Expense added', { type: 'success' });
  };

  const openAddLabor = () => {
    setEditing(null); setEditType('labor');
    setLabForm({ date: new Date().toISOString().slice(0, 10), hours: '', hourlyRate: '15', taskDescription: '', worker: '', cropId: '' });
    setFormError('');
    setShowLaborModal(true);
  };

  const openEditLabor = (l) => {
    setEditing(l.id); setEditType('labor');
    setLabForm({ date: l.date, hours: l.hours, hourlyRate: l.hourlyRate, taskDescription: l.taskDescription || '', worker: l.worker || '', cropId: l.cropId || '' });
    setFormError('');
    setShowLaborModal(true);
  };

  const saveLabor = () => {
    if (!labForm.hours || +labForm.hours <= 0) { setFormError('Enter valid hours.'); return; }
    if (!labForm.taskDescription.trim()) { setFormError('Enter a task description.'); return; }
    setFormError('');
    const entry = { ...labForm, hours: labForm.hours.toString(), hourlyRate: labForm.hourlyRate.toString(), year: new Date(labForm.date).getFullYear() };
    updateState(prev => {
      const list = [...(prev.laborLogs || [])];
      if (editing) {
        const idx = list.findIndex(x => x.id === editing);
        if (idx >= 0) list[idx] = { ...list[idx], ...entry };
      } else {
        list.push({ id: generateId(), ...entry });
      }
      return { ...prev, laborLogs: list };
    });
    setShowLaborModal(false);
    showToast(editing ? 'Labor log updated' : 'Labor log added', { type: 'success' });
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    const { id, type } = deleteConfirm;
    updateState(prev => {
      if (type === 'expense') return { ...prev, expenses: (prev.expenses || []).filter(x => x.id !== id) };
      return { ...prev, laborLogs: (prev.laborLogs || []).filter(x => x.id !== id) };
    });
    setDeleteConfirm(null);
    showToast('Deleted', { type: 'info' });
  };

  const maxRevExp = Math.max(...monthlyRevenue, ...monthlyExpenses, 1);
  const maxLaborH = Math.max(...monthlyLabor, 1);
  const maxCropProfit = cropProfit.length > 0 ? Math.max(...cropProfit.map(c => Math.abs(c.profit)), 1) : 1;
  const maxBedROI = bedROI.length > 0 ? Math.max(...bedROI.map(b => parseFloat(b.perM2)), 1) : 1;

  const s = {
    label: { fontSize: '12px', color: theme.textMuted, marginRight: '4px' },
    heading: { margin: '0 0 16px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '16px' },
    selectStyle: { padding: '6px 10px', borderRadius: '6px', border: `1px solid ${theme.border}`, background: theme.bgInput, color: theme.text, fontSize: '13px', fontFamily: "'Libre Franklin', sans-serif" },
  };

  const filteredExpenses = filterCat === 'all' ? yearExpenses : yearExpenses.filter(e => e.category === filterCat);

  return (
    <div style={{ padding: '20px 16px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
        <h2 style={{ margin: 0, fontFamily: "'DM Serif Display', serif", color: theme.text }}>
          📊 Farm Analytics
        </h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => exportAnalyticsReportPdf({ harvests, expenses, laborLogs, crops, zones, settings, user })} style={{ fontSize: '12px', padding: '6px 14px' }}>📄 Export Report</Button>
          <Button variant="secondary" onClick={openAddExpense} style={{ fontSize: '12px', padding: '6px 14px' }}>+ Expense</Button>
          <Button variant="secondary" onClick={openAddLabor} style={{ fontSize: '12px', padding: '6px 14px' }}>+ Labor</Button>
        </div>
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
        {[{ id: 'overview', label: '📊 Overview' }, { id: 'expenses', label: '💰 Expenses' }, { id: 'labor', label: '👷 Labor' }].map(v => (
          <button key={v.id} onClick={() => setView(v.id)} style={{
            padding: '6px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
            fontFamily: "'Libre Franklin', sans-serif", fontSize: '13px',
            fontWeight: view === v.id ? '600' : '400',
            background: view === v.id ? (theme.accentLight || '#e8f5e9') : 'transparent',
            color: view === v.id ? theme.accent : theme.textSecondary,
            transition: 'all 0.2s',
          }}>{v.label}</button>
        ))}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
        <SummaryCard icon="💰" label="Revenue" value={`€${totalRevenue.toFixed(0)}`} color="#2e7d32" />
        <SummaryCard icon="📉" label="Expenses" value={`€${totalExpenses.toFixed(0)}`} color="#c62828" />
        <SummaryCard icon={netProfit >= 0 ? "📈" : "📉"} label="Net Profit" value={`€${netProfit.toFixed(0)}`} color={netProfit >= 0 ? '#2e7d32' : '#c62828'} />
        <SummaryCard icon="📊" label="Margin" value={`${profitMargin}%`} color={parseFloat(profitMargin) >= 0 ? '#2e7d32' : '#c62828'} />
        <SummaryCard icon="⏱️" label="Labor Hours" value={totalLaborHours.toFixed(0)} />
        <SummaryCard icon="💶" label="Cost/m²" value={`€${costPerM2}`} />
      </div>

      {view === 'overview' && (
        <>
          {/* Revenue vs Expenses chart */}
          <Card style={{ marginBottom: '24px' }}>
            <h3 style={s.heading}>Revenue vs Expenses by Month</h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '140px' }}>
              {MONTHS.map((m, i) => (
                <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', width: '100%', justifyContent: 'center', height: '100%' }}>
                    <div style={{
                      width: '45%', maxWidth: '18px',
                      height: `${(monthlyRevenue[i] / maxRevExp) * 85}%`,
                      minHeight: monthlyRevenue[i] > 0 ? '3px' : '0',
                      background: '#4caf50', borderRadius: '3px 3px 0 0',
                    }} title={`Revenue: €${monthlyRevenue[i].toFixed(0)}`} />
                    <div style={{
                      width: '45%', maxWidth: '18px',
                      height: `${(monthlyExpenses[i] / maxRevExp) * 85}%`,
                      minHeight: monthlyExpenses[i] > 0 ? '3px' : '0',
                      background: '#ef5350', borderRadius: '3px 3px 0 0',
                    }} title={`Expenses: €${monthlyExpenses[i].toFixed(0)}`} />
                  </div>
                  <div style={{ fontSize: '9px', color: theme.textMuted, marginTop: '4px' }}>{m}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', fontSize: '11px', color: theme.textMuted, marginTop: '8px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#4caf50' }} /> Revenue
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#ef5350' }} /> Expenses
              </span>
            </div>
          </Card>

          {/* Monthly Profit Trend */}
          <Card style={{ marginBottom: '24px' }}>
            <h3 style={s.heading}>Monthly Profit Trend</h3>
            {(() => {
              const profits = MONTHS.map((_, i) => monthlyRevenue[i] - monthlyExpenses[i]);
              const maxP = Math.max(...profits.map(Math.abs), 1);
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '120px' }}>
                  {MONTHS.map((m, i) => (
                    <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'center', position: 'relative' }}>
                      <div style={{
                        width: '70%', maxWidth: '30px',
                        height: `${(Math.abs(profits[i]) / maxP) * 45}%`,
                        minHeight: profits[i] !== 0 ? '3px' : '0',
                        background: profits[i] >= 0 ? '#4caf50' : '#ef5350',
                        borderRadius: profits[i] >= 0 ? '3px 3px 0 0' : '0 0 3px 3px',
                        position: 'absolute',
                        [profits[i] >= 0 ? 'bottom' : 'top']: '50%',
                      }} title={`€${profits[i].toFixed(0)}`} />
                      <div style={{ fontSize: '9px', color: theme.textMuted, position: 'absolute', bottom: '0' }}>{m}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Card>

          {/* Cost Breakdown */}
          {catBreakdown.length > 0 && (
            <Card style={{ marginBottom: '24px' }}>
              <h3 style={s.heading}>Cost Breakdown by Category</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {catBreakdown.map(c => (
                  <div key={c.value} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '100px', fontSize: '12px', color: theme.text, flexShrink: 0 }}>
                      {c.icon} {c.label}
                    </div>
                    <div style={{ flex: 1, height: '20px', background: theme.borderLight, borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${totalExpenses > 0 ? (c.amount / totalExpenses) * 100 : 0}%`,
                        height: '100%',
                        background: CAT_COLORS[c.value] || '#999',
                        borderRadius: '4px',
                        transition: 'width 0.3s',
                      }} />
                    </div>
                    <div style={{ width: '70px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: theme.text }}>
                      €{c.amount.toFixed(0)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Per-Crop Profitability */}
          {cropProfit.length > 0 && (
            <Card style={{ marginBottom: '24px' }}>
              <h3 style={s.heading}>Crop Profitability (Top 10)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {cropProfit.map(c => (
                  <div key={c.cropId} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '120px', fontSize: '12px', color: theme.text, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.crop?.icon || '🌱'} {c.crop?.name || 'Unknown'}
                    </div>
                    <div style={{ flex: 1, height: '18px', background: theme.borderLight, borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                      <div style={{
                        width: `${(Math.abs(c.profit) / maxCropProfit) * 100}%`,
                        height: '100%',
                        background: c.profit >= 0 ? '#4caf50' : '#ef5350',
                        borderRadius: '4px',
                      }} />
                    </div>
                    <div style={{ width: '70px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: c.profit >= 0 ? '#2e7d32' : '#c62828' }}>
                      €{c.profit.toFixed(0)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Labor Hours by Month */}
          {totalLaborHours > 0 && (
            <Card style={{ marginBottom: '24px' }}>
              <h3 style={s.heading}>Labor Hours by Month</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '100px' }}>
                {MONTHS.map((m, i) => (
                  <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ fontSize: '10px', color: theme.textMuted, marginBottom: '2px' }}>{monthlyLabor[i] > 0 ? monthlyLabor[i].toFixed(0) : ''}</div>
                    <div style={{
                      width: '100%', maxWidth: '30px',
                      height: `${(monthlyLabor[i] / maxLaborH) * 80}%`,
                      minHeight: monthlyLabor[i] > 0 ? '3px' : '0',
                      background: '#ff9800', borderRadius: '3px 3px 0 0',
                    }} />
                    <div style={{ fontSize: '9px', color: theme.textMuted, marginTop: '3px' }}>{m}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Bed ROI */}
          {bedROI.length > 0 && (
            <Card style={{ marginBottom: '24px' }}>
              <h3 style={s.heading}>Revenue per m² by Bed (Top 10)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {bedROI.map(b => (
                  <div key={b.bedId} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '90px', fontSize: '12px', color: theme.text, flexShrink: 0 }}>
                      {b.bed?.name || 'Bed'}
                    </div>
                    <div style={{ flex: 1, height: '18px', background: theme.borderLight, borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${(parseFloat(b.perM2) / maxBedROI) * 100}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #4caf50, #81c784)',
                        borderRadius: '4px',
                      }} />
                    </div>
                    <div style={{ width: '70px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: theme.text }}>
                      €{b.perM2}/m²
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {totalRevenue === 0 && totalExpenses === 0 && (
            <EmptyState icon="📊" title="No Data Yet" description="Record harvests and add expenses to see analytics. Use the + Expense and + Labor buttons above." />
          )}
        </>
      )}

      {/* Expenses list view */}
      {view === 'expenses' && (
        <>
          <Card style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <span style={s.label}>Category: </span>
                <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={s.selectStyle}>
                  <option value="all">All Categories</option>
                  {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              <Button onClick={openAddExpense} style={{ fontSize: '12px', padding: '6px 14px' }}>+ Add Expense</Button>
            </div>
          </Card>
          {filteredExpenses.length === 0 ? (
            <EmptyState icon="💰" title="No Expenses" description="Track your farm expenses to calculate profit margins." />
          ) : (
            <Card>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${theme.border}` }}>
                      {['Date', 'Category', 'Description', 'Crop', 'Amount'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px', fontSize: '11px', fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                      <th style={{ width: '60px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.sort((a, b) => new Date(b.date) - new Date(a.date)).map(e => {
                      const cat = EXPENSE_CATEGORIES.find(c => c.value === e.category);
                      const crop = e.cropId ? crops.find(c => c.id === e.cropId) : null;
                      return (
                        <tr key={e.id} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
                          <td style={{ padding: '8px', color: theme.text }}>{formatDate(e.date)}</td>
                          <td style={{ padding: '8px', color: theme.text }}>
                            <Badge style={{ background: (CAT_COLORS[e.category] || '#999') + '20', color: CAT_COLORS[e.category] || '#999' }}>
                              {cat?.icon} {cat?.label || e.category}
                            </Badge>
                          </td>
                          <td style={{ padding: '8px', color: theme.text }}>{e.description}</td>
                          <td style={{ padding: '8px', color: theme.textSecondary, fontSize: '12px' }}>{crop ? `${crop.icon} ${crop.name}` : '—'}</td>
                          <td style={{ padding: '8px', fontWeight: '600', color: '#c62828' }}>€{parseFloat(e.amount).toFixed(2)}</td>
                          <td style={{ padding: '8px' }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button onClick={() => openEditExpense(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>✏️</button>
                              <button onClick={() => setDeleteConfirm({ id: e.id, type: 'expense' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Labor list view */}
      {view === 'labor' && (
        <>
          <Card style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '13px', color: theme.textSecondary }}>
                Total: <strong>{totalLaborHours.toFixed(1)}h</strong> · €{totalLaborCost.toFixed(2)}
              </div>
              <Button onClick={openAddLabor} style={{ fontSize: '12px', padding: '6px 14px' }}>+ Add Labor</Button>
            </div>
          </Card>
          {yearLabor.length === 0 ? (
            <EmptyState icon="👷" title="No Labor Logs" description="Track labor hours and costs for profitability analysis." />
          ) : (
            <Card>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${theme.border}` }}>
                      {['Date', 'Task', 'Worker', 'Hours', 'Rate', 'Cost'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px', fontSize: '11px', fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                      <th style={{ width: '60px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {yearLabor.sort((a, b) => new Date(b.date) - new Date(a.date)).map(l => {
                      const cost = (parseFloat(l.hours) || 0) * (parseFloat(l.hourlyRate) || 0);
                      const crop = l.cropId ? crops.find(c => c.id === l.cropId) : null;
                      return (
                        <tr key={l.id} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
                          <td style={{ padding: '8px', color: theme.text }}>{formatDate(l.date)}</td>
                          <td style={{ padding: '8px', color: theme.text }}>
                            {l.taskDescription}
                            {crop && <span style={{ fontSize: '11px', color: theme.textMuted, marginLeft: '6px' }}>{crop.icon} {crop.name}</span>}
                          </td>
                          <td style={{ padding: '8px', color: theme.textSecondary }}>{l.worker || '—'}</td>
                          <td style={{ padding: '8px', color: theme.text, fontWeight: '600' }}>{l.hours}h</td>
                          <td style={{ padding: '8px', color: theme.textSecondary }}>€{parseFloat(l.hourlyRate).toFixed(2)}/h</td>
                          <td style={{ padding: '8px', fontWeight: '600', color: '#c62828' }}>€{cost.toFixed(2)}</td>
                          <td style={{ padding: '8px' }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button onClick={() => openEditLabor(l)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>✏️</button>
                              <button onClick={() => setDeleteConfirm({ id: l.id, type: 'labor' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Expense Modal */}
      <Modal open={showExpenseModal} onClose={() => setShowExpenseModal(false)} title={editing ? 'Edit Expense' : 'Add Expense'} width="440px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <FormField label="Date" style={{ flex: 1 }}>
              <Input type="date" value={expForm.date} onChange={e => setExpForm(f => ({ ...f, date: e.target.value }))} />
            </FormField>
            <FormField label="Category" style={{ flex: 1 }}>
              <Select value={expForm.category} onChange={e => setExpForm(f => ({ ...f, category: e.target.value }))}>
                {EXPENSE_CATEGORIES.filter(c => c.value !== 'labor').map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
              </Select>
            </FormField>
          </div>
          <FormField label="Amount (€)">
            <Input type="number" step="0.01" min="0" value={expForm.amount} onChange={e => setExpForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
          </FormField>
          <FormField label="Description">
            <Input value={expForm.description} onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Tomato seeds from supplier" />
          </FormField>
          <FormField label="Linked Crop (optional)">
            <Select value={expForm.cropId} onChange={e => setExpForm(f => ({ ...f, cropId: e.target.value }))}>
              <option value="">— None —</option>
              {crops.filter(c => c.name).sort((a, b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Notes (optional)">
            <Input value={expForm.notes} onChange={e => setExpForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes..." />
          </FormField>
          {formError && <div style={{ fontSize: '12px', color: '#dc2626' }}>{formError}</div>}
          <Button onClick={saveExpense}>{editing ? 'Update' : 'Add Expense'}</Button>
        </div>
      </Modal>

      {/* Labor Modal */}
      <Modal open={showLaborModal} onClose={() => setShowLaborModal(false)} title={editing ? 'Edit Labor Log' : 'Add Labor Log'} width="440px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <FormField label="Date" style={{ flex: 1 }}>
              <Input type="date" value={labForm.date} onChange={e => setLabForm(f => ({ ...f, date: e.target.value }))} />
            </FormField>
            <FormField label="Worker (optional)" style={{ flex: 1 }}>
              <Input value={labForm.worker} onChange={e => setLabForm(f => ({ ...f, worker: e.target.value }))} placeholder="Name" />
            </FormField>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <FormField label="Hours" style={{ flex: 1 }}>
              <Input type="number" step="0.25" min="0" value={labForm.hours} onChange={e => setLabForm(f => ({ ...f, hours: e.target.value }))} placeholder="0" />
            </FormField>
            <FormField label="Rate (€/h)" style={{ flex: 1 }}>
              <Input type="number" step="0.50" min="0" value={labForm.hourlyRate} onChange={e => setLabForm(f => ({ ...f, hourlyRate: e.target.value }))} placeholder="15" />
            </FormField>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', paddingBottom: '4px' }}>
              <div style={{ fontSize: '13px', color: theme.textSecondary }}>
                = €{((parseFloat(labForm.hours) || 0) * (parseFloat(labForm.hourlyRate) || 0)).toFixed(2)}
              </div>
            </div>
          </div>
          <FormField label="Task Description">
            <Input value={labForm.taskDescription} onChange={e => setLabForm(f => ({ ...f, taskDescription: e.target.value }))} placeholder="e.g. Weeding beds, harvesting tomatoes" />
          </FormField>
          <FormField label="Linked Crop (optional)">
            <Select value={labForm.cropId} onChange={e => setLabForm(f => ({ ...f, cropId: e.target.value }))}>
              <option value="">— None —</option>
              {crops.filter(c => c.name).sort((a, b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </Select>
          </FormField>
          {formError && <div style={{ fontSize: '12px', color: '#dc2626' }}>{formError}</div>}
          <Button onClick={saveLabor}>{editing ? 'Update' : 'Add Labor Log'}</Button>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete?" width="340px">
        <p style={{ fontSize: '14px', color: theme.textSecondary, marginBottom: '16px' }}>This cannot be undone.</p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button onClick={handleDelete} style={{ background: '#c62828' }}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}

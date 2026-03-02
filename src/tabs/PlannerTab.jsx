import { useState, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Card, SummaryCard, Button, Modal, FormField, Input, Select, Badge } from '../components/shared';
import { getSeasonPhase, getCurrentWeek, weekToMonth, monthToWeekRange, bedArea, generateId } from '../utils/helpers';
import { mealProfiles, cropCategories } from '../data/mealProfiles';
import { categoryToType, cropTypes } from '../data/crops';
import { aggregateDemand, aggregateManualDemand, mergeDemandMaps, computeSeasonPlan, applySeasonPlan } from '../utils/demandEngine';
import { analyzeTimingAlerts, summarizeAlerts } from '../utils/timingAlerts';
import YearSelector from '../components/YearSelector';
import { printFarmCalendar } from '../utils/printCalendar';
import { exportFarmPlanPdf, exportSeasonCalendarPdf } from '../utils/pdfExport';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PLAN_MODES = [
  { id: 'auto', label: 'Event-Driven', icon: '🎯', desc: 'Events drive the plan. Automatic crop allocation.' },
  { id: 'mixed', label: 'Mixed', icon: '🔀', desc: 'Events + your own manual entries.' },
  { id: 'manual', label: 'Manual', icon: '✋', desc: 'No events. Add demand entries yourself.' },
];
const DEMAND_CATEGORIES = Object.entries(cropCategories).map(([key, val]) => ({ value: key, label: `${val.icon} ${val.label}`, icon: val.icon, color: val.color }));

function getCropWindows(crop, lastFrost, firstFrost) {
  const windows = {};
  if (crop.season === 'cool') {
    windows.sowIndoors = { start: lastFrost - 8, end: lastFrost - 4 };
    windows.directSow = { start: lastFrost - 2, end: lastFrost + 4 };
    windows.transplant = { start: lastFrost, end: lastFrost + 6 };
  } else {
    windows.sowIndoors = { start: lastFrost - 10, end: lastFrost - 4 };
    windows.transplant = { start: lastFrost + 2, end: lastFrost + 8 };
    windows.directSow = { start: lastFrost + 2, end: lastFrost + 10 };
  }
  const maturityWeeks = Math.ceil(crop.daysToMaturity / 7);
  const earliestPlanting = crop.season === 'cool' ? windows.directSow.start : windows.transplant.start;
  windows.harvest = {
    start: earliestPlanting + maturityWeeks,
    end: Math.min(earliestPlanting + maturityWeeks + 8, firstFrost + 2),
  };
  return windows;
}

function isWeekInRange(week, range) { return week >= range.start && week <= range.end; }
function monthOverlapsRange(monthIdx, range) {
  const { start, end } = monthToWeekRange(monthIdx);
  return !(end < range.start || start > range.end);
}

function getActionsForWeek(crops, week, lastFrost, firstFrost) {
  const actions = [];
  crops.forEach(crop => {
    const windows = getCropWindows(crop, lastFrost, firstFrost);
    if (isWeekInRange(week, windows.sowIndoors)) actions.push({ crop, action: 'Sow Indoors', icon: '🏠', priority: 'high' });
    if (isWeekInRange(week, windows.directSow)) actions.push({ crop, action: 'Direct Sow', icon: '🌱', priority: 'high' });
    if (isWeekInRange(week, windows.transplant)) actions.push({ crop, action: 'Transplant', icon: '🌿', priority: 'medium' });
    if (isWeekInRange(week, windows.harvest)) actions.push({ crop, action: 'Harvest', icon: '🧺', priority: 'low' });
    if (crop.successionInterval && crop.successionInterval > 0) {
      const succWeeks = Math.round(crop.successionInterval / 7);
      const sowRange = windows.directSow;
      if (isWeekInRange(week, sowRange) && succWeeks > 0) {
        const weekInRange = week - sowRange.start;
        if (weekInRange > 0 && weekInRange % succWeeks === 0) {
          actions.push({ crop, action: 'Succession Sow', icon: '🔁', priority: 'medium' });
        }
      }
    }
  });
  return actions;
}

export default function PlannerTab({ onNavigate }) {
  const { zones, crops, settings, events: farmEvents, demandPlan, selectedCropIds, manualDemandEntries, updateState, theme, showToast, user } = useApp();
  const events = farmEvents || [];

  const lastFrost = settings.lastFrostWeek || 12;
  const firstFrost = settings.firstFrostWeek || 44;
  const currentWeek = getCurrentWeek();
  const phase = getSeasonPhase(currentWeek, lastFrost, firstFrost);
  const [viewYear, setViewYear] = useState(settings.currentYear || new Date().getFullYear());

  // Planning state
  const [planMode, setPlanMode] = useState('mixed');
  const [showAddDemand, setShowAddDemand] = useState(false);
  const [demandForm, setDemandForm] = useState({ cropId: '', quantityKg: '', category: 'greens', notes: '' });
  const [showPreview, setShowPreview] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);
  const [showConfirmApply, setShowConfirmApply] = useState(false);
  const [applyMode, setApplyMode] = useState('merge');
  const [applying, setApplying] = useState(false);

  // Frost date editing
  const [editingFrost, setEditingFrost] = useState(false);
  const [tempLastFrost, setTempLastFrost] = useState(lastFrost);
  const [tempFirstFrost, setTempFirstFrost] = useState(firstFrost);

  const headingFont = "'DM Serif Display', serif";
  const bodyFont = "'Libre Franklin', sans-serif";

  // --- Computed data ---

  const yearManualDemand = useMemo(() => (manualDemandEntries || []).filter(e => e.year === viewYear), [manualDemandEntries, viewYear]);

  // Combined demand overview
  const combinedDemand = useMemo(() => {
    const lossMargin = demandPlan?.lossMargin ?? 0.30;
    const eventDemandMap = aggregateDemand(events, mealProfiles, lossMargin);
    const manualDemandMap = aggregateManualDemand(manualDemandEntries || [], crops, settings, viewYear);
    const merged = mergeDemandMaps(eventDemandMap, manualDemandMap);

    const categories = Object.entries(merged)
      .filter(([_, d]) => d.totalKg > 0)
      .map(([cat, d]) => {
        const eligible = crops.filter(c => {
          if (c.category !== cat) return false;
          if (selectedCropIds && selectedCropIds.length > 0 && !selectedCropIds.includes(c.id)) return false;
          return true;
        });
        const avgYield = eligible.length > 0
          ? eligible.reduce((s, c) => s + (c.yieldPerM2 || 1), 0) / eligible.length
          : 1;
        return {
          category: cat,
          label: cropCategories[cat]?.label || cat,
          icon: cropCategories[cat]?.icon || '🌱',
          color: cropCategories[cat]?.color || theme.accent,
          totalKg: Math.round(d.totalKg * 10) / 10,
          estimatedArea: Math.round((d.totalKg / avgYield) * 10) / 10,
          cropCount: eligible.length,
        };
      })
      .filter(c => c.cropCount > 0);

    return {
      categories,
      totalKg: Math.round(categories.reduce((s, c) => s + c.totalKg, 0) * 10) / 10,
      totalArea: Math.round(categories.reduce((s, c) => s + c.estimatedArea, 0) * 10) / 10,
    };
  }, [events, manualDemandEntries, crops, settings, viewYear, demandPlan, selectedCropIds, theme]);

  // Farm stats
  const { totalBeds, availableBeds, demandPlantings, totalAreaUsed, totalFarmArea } = useMemo(() => {
    let total = 0, available = 0, demand = [], areaUsed = 0, farmArea = 0;
    zones.forEach(zone => {
      zone.beds.forEach(bed => {
        total++;
        farmArea += bedArea(bed);
        const yearPlantings = (bed.plantings || []).filter(p => p.year === viewYear);
        if (yearPlantings.length === 0) { available++; }
        else {
          areaUsed += bedArea(bed);
          yearPlantings.forEach(p => {
            if (p.source === 'demand') demand.push({ ...p, bedName: bed.name, zoneName: zone.name });
          });
        }
      });
    });
    return { totalBeds: total, availableBeds: available, demandPlantings: demand, totalAreaUsed: areaUsed, totalFarmArea: farmArea };
  }, [zones, viewYear]);

  // My crops summary per type
  const selectedCropSummary = useMemo(() => {
    const selected = (selectedCropIds || []);
    const byType = {};
    selected.forEach(id => {
      const crop = crops.find(c => c.id === id);
      if (!crop) return;
      const type = categoryToType[crop.category] || 'vegetables';
      byType[type] = (byType[type] || 0) + 1;
    });
    return { total: selected.length, byType };
  }, [selectedCropIds, crops]);

  // Weekly actions
  const nowActions = useMemo(() => getActionsForWeek(crops, currentWeek, lastFrost, firstFrost), [crops, currentWeek, lastFrost, firstFrost]);
  const soonActions = useMemo(() => {
    const all = [];
    for (let w = currentWeek + 1; w <= currentWeek + 3; w++) {
      getActionsForWeek(crops, w, lastFrost, firstFrost).forEach(a => {
        if (!all.find(x => x.crop.id === a.crop.id && x.action === a.action)) all.push({ ...a, week: w });
      });
    }
    return all;
  }, [crops, currentWeek, lastFrost, firstFrost]);

  // Timing alerts on active demand plantings
  const timingAlerts = useMemo(() => {
    if (demandPlantings.length === 0) return { alerts: [], summary: { critical: 0, urgent: 0, caution: 0, total: 0, worstSeverity: 'ok' } };
    const plantings = demandPlantings
      .filter(p => p.year === viewYear)
      .map(p => ({ cropId: p.cropId, startWeek: p.startWeek, id: p.id, source: p.source, eventIds: p.eventIds }));
    const alerts = analyzeTimingAlerts(plantings, crops, settings, currentWeek);
    return { alerts, summary: summarizeAlerts(alerts) };
  }, [demandPlantings, crops, settings, currentWeek, viewYear]);

  // Calendar
  const calendarData = useMemo(() => {
    return crops.map(crop => {
      const windows = getCropWindows(crop, lastFrost, firstFrost);
      const months = MONTH_NAMES.map((_, monthIdx) => {
        const actions = [];
        if (monthOverlapsRange(monthIdx, windows.sowIndoors)) actions.push({ icon: '🏠', label: 'Sow Indoors' });
        if (monthOverlapsRange(monthIdx, windows.directSow)) actions.push({ icon: '🌱', label: 'Direct Sow' });
        if (monthOverlapsRange(monthIdx, windows.transplant)) actions.push({ icon: '🌿', label: 'Transplant' });
        if (monthOverlapsRange(monthIdx, windows.harvest)) actions.push({ icon: '🧺', label: 'Harvest' });
        if (crop.successionInterval && crop.successionInterval > 0 && monthOverlapsRange(monthIdx, windows.directSow)) {
          actions.push({ icon: '🔁', label: 'Succession' });
        }
        return actions;
      });
      return { crop, months };
    });
  }, [crops, lastFrost, firstFrost]);

  // --- Handlers ---

  function saveFrostDates() {
    const lf = Math.max(1, Math.min(52, parseInt(tempLastFrost) || 12));
    const ff = Math.max(1, Math.min(52, parseInt(tempFirstFrost) || 44));
    updateState(prev => ({ ...prev, settings: { ...prev.settings, lastFrostWeek: lf, firstFrostWeek: ff } }));
    setEditingFrost(false);
  }

  const handleAddManualDemand = () => {
    if (!demandForm.category || !demandForm.quantityKg || parseFloat(demandForm.quantityKg) <= 0) return;
    const entry = {
      id: generateId(),
      cropId: demandForm.cropId || null,
      quantityKg: parseFloat(demandForm.quantityKg),
      category: demandForm.category,
      notes: demandForm.notes.trim(),
      year: viewYear,
    };
    updateState(prev => ({
      ...prev,
      manualDemandEntries: [...(prev.manualDemandEntries || []), entry],
    }));
    setDemandForm({ cropId: '', quantityKg: '', category: 'greens', notes: '' });
    setShowAddDemand(false);
  };

  const removeManualDemand = (id) => {
    updateState(prev => ({
      ...prev,
      manualDemandEntries: (prev.manualDemandEntries || []).filter(e => e.id !== id),
    }));
  };

  const resetAllDemand = () => {
    updateState(prev => ({
      ...prev,
      manualDemandEntries: (prev.manualDemandEntries || []).filter(e => e.year !== viewYear),
    }));
  };

  const handlePreview = useCallback(() => {
    const state = { events, crops, zones, settings, demandPlan, selectedCropIds, manualDemandEntries };
    const result = computeSeasonPlan(state, mealProfiles, viewYear);
    setPreviewResult(result);
    setShowPreview(true);
  }, [events, crops, zones, settings, demandPlan, selectedCropIds, manualDemandEntries, viewYear]);

  const handleApply = useCallback(() => {
    setApplying(true);
    const state = { events, crops, zones, settings, demandPlan, selectedCropIds, manualDemandEntries };
    const result = computeSeasonPlan(state, mealProfiles, viewYear);
    const newZones = applySeasonPlan(zones, result.allocations, viewYear, applyMode);
    updateState(prev => ({
      ...prev,
      zones: newZones,
      demandPlan: {
        ...prev.demandPlan,
        generatedAt: new Date().toISOString(),
        summary: result.summary,
        lastMode: applyMode,
      },
    }));
    setApplying(false);
    setShowConfirmApply(false);
    setPreviewResult(result);
    setShowPreview(true);
    showToast(`Season plan applied: ${result.summary?.cropCount || 0} crop allocations across ${result.summary?.bedCount || 0} beds`, { type: 'success' });
  }, [events, crops, zones, settings, demandPlan, selectedCropIds, manualDemandEntries, viewYear, applyMode, updateState, showToast]);

  const actionPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return { bg: theme.warningLight || '#fff3e0', color: theme.warning || '#e65100' };
      case 'medium': return { bg: theme.successLight || '#e8f5e9', color: theme.success || '#2e7d32' };
      case 'low': return { bg: theme.accentLight || '#e3f2fd', color: theme.accent || '#1565c0' };
      default: return { bg: theme.bgCard, color: theme.text };
    }
  };

  const hasBeds = zones.some(z => z.beds?.length > 0);
  const hasCrops = (selectedCropIds || []).length > 0;
  const hasDemand = combinedDemand.totalKg > 0;
  const canGenerate = hasBeds && hasCrops && hasDemand;
  const multiDayCount = events.filter(e => e.eventType === 'multi' && e.guestCount > 0).length;

  return (
    <div style={{ fontFamily: bodyFont, color: theme.text }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontFamily: headingFont, fontSize: '24px', color: theme.text, margin: '0 0 4px 0' }}>
            Season Plan
          </h2>
          <p style={{ fontSize: '13px', color: theme.textMuted, margin: 0 }}>
            Plan your growing season from demand to bed allocation. One flow for all farming styles.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            onClick={() => printFarmCalendar({ zones, crops, settings, user })}
          >
            🖨️ Print Calendar
          </Button>
          <Button
            variant="secondary"
            onClick={() => exportFarmPlanPdf({ zones, crops, settings, user })}
          >
            📄 Export PDF
          </Button>
        </div>
      </div>

      {/* Season Phase + Summary Cards */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <YearSelector value={viewYear} onChange={setViewYear} />
        <SummaryCard icon={phase.icon} label={`Week ${currentWeek} of 52`} value={phase.name} color={phase.color} />
        <SummaryCard icon="🧊" label="Last Frost Week" value={`Wk ${lastFrost}`} />
        <SummaryCard icon="🍁" label="First Frost Week" value={`Wk ${firstFrost}`} />
        <SummaryCard icon="🛏️" label="Available Beds" value={`${availableBeds} / ${totalBeds}`} color={availableBeds > 0 ? theme.success : theme.warning} />
        {demandPlantings.length > 0 && (
          <SummaryCard
            icon={timingAlerts.summary.worstSeverity === 'ok' ? '✅' : timingAlerts.summary.worstSeverity === 'critical' ? '🚨' : '⏰'}
            label="Timing Health"
            value={timingAlerts.summary.total === 0 ? 'On Track' : `${timingAlerts.summary.critical + timingAlerts.summary.urgent} alert${timingAlerts.summary.critical + timingAlerts.summary.urgent !== 1 ? 's' : ''}`}
            color={timingAlerts.summary.worstSeverity === 'ok' ? theme.success : timingAlerts.summary.worstSeverity === 'critical' ? (theme.error || '#d32f2f') : (theme.warning || '#f57c00')}
          />
        )}
      </div>

      {/* Planning Mode Selector */}
      <Card style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{ fontSize: '18px' }}>📋</span>
          <h3 style={{ fontFamily: headingFont, fontSize: '16px', margin: 0, color: theme.text }}>Planning Mode</h3>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {PLAN_MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setPlanMode(m.id)}
              style={{
                flex: '1 1 160px',
                padding: '12px 16px',
                borderRadius: '10px',
                border: planMode === m.id ? `2px solid ${theme.accent}` : `1.5px solid ${theme.borderLight}`,
                background: planMode === m.id ? `${theme.accent}10` : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: '18px', marginBottom: '4px' }}>{m.icon}</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: planMode === m.id ? theme.accent : theme.text, fontFamily: bodyFont }}>{m.label}</div>
              <div style={{ fontSize: '11px', color: theme.textMuted, fontFamily: bodyFont }}>{m.desc}</div>
            </button>
          ))}
        </div>
      </Card>

      {/* My Crops Summary */}
      <Card style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '18px' }}>🌾</span>
              <h3 style={{ fontFamily: headingFont, fontSize: '16px', margin: 0, color: theme.text }}>My Season Crops</h3>
              <Badge bg={selectedCropSummary.total > 0 ? theme.accent : theme.border} color="#fff">{selectedCropSummary.total}</Badge>
            </div>
            {selectedCropSummary.total > 0 ? (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                {cropTypes.filter(t => t.value !== 'all').map(t => {
                  const count = selectedCropSummary.byType[t.value] || 0;
                  if (count === 0) return null;
                  return <span key={t.value} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: `${t.color}15`, color: t.color, fontWeight: '600' }}>{t.label.split(' ')[0]} {count}</span>;
                })}
              </div>
            ) : (
              <p style={{ fontSize: '12px', color: theme.textMuted, margin: '4px 0 0' }}>No crops selected. Go to the Crops tab to select which crops you grow.</p>
            )}
          </div>
        </div>
      </Card>

      {/* Demand Section */}
      <Card style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>📊</span>
              <h3 style={{ fontFamily: headingFont, fontSize: '16px', margin: 0, color: theme.text }}>Season Demand</h3>
            </div>
            <p style={{ fontSize: '12px', color: theme.textMuted, margin: '2px 0 0' }}>
              {planMode === 'auto' ? `From ${multiDayCount} event${multiDayCount !== 1 ? 's' : ''}` :
               planMode === 'manual' ? 'From your manual entries' :
               `${multiDayCount} event${multiDayCount !== 1 ? 's' : ''} + ${yearManualDemand.length} manual entr${yearManualDemand.length !== 1 ? 'ies' : 'y'}`}
              {' · '}{((demandPlan?.lossMargin ?? 0.30) * 100).toFixed(0)}% loss margin
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {(planMode === 'mixed' || planMode === 'manual') && (
              <Button variant="secondary" onClick={() => setShowAddDemand(true)} style={{ fontSize: '12px', padding: '6px 14px' }}>
                + Add Manual Demand
              </Button>
            )}
            {yearManualDemand.length > 0 && (
              <button
                onClick={() => { if (window.confirm(`Reset all ${yearManualDemand.length} manual demand entries for ${viewYear}?`)) resetAllDemand(); }}
                style={{
                  background: 'none',
                  border: `1px solid ${theme.error || '#c62828'}`,
                  borderRadius: '6px',
                  padding: '6px 14px',
                  cursor: 'pointer',
                  color: theme.error || '#c62828',
                  fontSize: '12px',
                  fontFamily: bodyFont,
                  fontWeight: '500',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = (theme.error || '#c62828') + '15'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                title={`Remove all manual demand entries for ${viewYear}`}
              >
                🗑️ Reset Demand
              </button>
            )}
          </div>
        </div>

        {/* Manual demand entries list */}
        {(planMode === 'mixed' || planMode === 'manual') && yearManualDemand.length > 0 && (
          <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '8px', background: theme.bg, border: `1px solid ${theme.borderLight}` }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: theme.textSecondary, marginBottom: '6px', textTransform: 'uppercase' }}>Manual Entries</div>
            {yearManualDemand.map(entry => {
              const crop = entry.cropId ? crops.find(c => c.id === entry.cropId) : null;
              const catInfo = cropCategories[entry.category];
              return (
                <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: `1px solid ${theme.borderLight}`, fontSize: '13px' }}>
                  <span>{catInfo?.icon || '🌱'}</span>
                  <span style={{ fontWeight: '500', color: theme.text }}>{crop ? `${crop.icon} ${crop.name}` : catInfo?.label || entry.category}</span>
                  <span style={{ color: theme.accent, fontWeight: '600' }}>{entry.quantityKg} kg</span>
                  {entry.notes && <span style={{ color: theme.textMuted, fontSize: '11px' }}>({entry.notes})</span>}
                  <button onClick={() => { if (window.confirm('Remove this manual demand entry?')) removeManualDemand(entry.id); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, fontSize: '14px' }}>×</button>
                </div>
              );
            })}
          </div>
        )}

        {/* Combined demand table */}
        {combinedDemand.categories.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {['Category', 'Demand (kg)', 'Est. Area (m²)', 'Crops'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `2px solid ${theme.border}`, color: theme.textSecondary, fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {combinedDemand.categories.map(cat => (
                  <tr key={cat.category}>
                    <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.borderLight}` }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '16px' }}>{cat.icon}</span>
                        <span style={{ fontWeight: '500', color: theme.text }}>{cat.label}</span>
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.borderLight}`, fontWeight: '600', color: cat.color }}>{cat.totalKg} kg</td>
                    <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.borderLight}`, color: theme.textSecondary }}>{cat.estimatedArea} m²</td>
                    <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.borderLight}`, color: theme.textMuted }}>{cat.cropCount}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: '700' }}>
                  <td style={{ padding: '8px 12px', color: theme.text }}>Total</td>
                  <td style={{ padding: '8px 12px', color: theme.accent }}>{combinedDemand.totalKg} kg</td>
                  <td style={{ padding: '8px 12px', color: theme.textSecondary }}>{combinedDemand.totalArea} m²</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: theme.textMuted, fontSize: '13px' }}>
            {planMode === 'auto' ? 'No multi-day events with guest counts found. Create events in the Demand tab.' :
             'No demand entries yet. Click "+ Add Manual Demand" to get started.'}
          </div>
        )}
      </Card>

      {/* Plan Actions */}
      <Card style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🌱</span>
              <h3 style={{ fontFamily: headingFont, fontSize: '16px', margin: 0, color: theme.text }}>Allocate & Apply</h3>
            </div>
            <p style={{ fontSize: '12px', color: theme.textMuted, margin: '2px 0 0' }}>
              Generate crop-to-bed allocations and apply the plan to your farm.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" onClick={handlePreview} disabled={!canGenerate} style={{ fontSize: '12px', padding: '8px 16px', opacity: canGenerate ? 1 : 0.5 }}>
              👁️ Preview Plan
            </Button>
            <Button onClick={() => setShowConfirmApply(true)} disabled={!canGenerate} style={{ fontSize: '12px', padding: '8px 16px', opacity: canGenerate ? 1 : 0.5 }}>
              🌱 Apply to Beds
            </Button>
          </div>
        </div>

        {/* Prerequisites */}
        {!canGenerate && (
          <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: theme.warningLight || '#fff8e1', border: `1px solid ${theme.warning || '#f57f17'}`, fontSize: '12px', color: theme.warning || '#f57f17' }}>
            {!hasBeds && <div>• Create zones & beds in the Beds tab</div>}
            {!hasCrops && <div>• Select crops for the season in the Crops tab</div>}
            {!hasDemand && <div>• Add demand (create events or add manual demand entries)</div>}
          </div>
        )}

        {/* Last generated info */}
        {demandPlan?.generatedAt && (
          <div style={{ marginTop: '12px', padding: '8px 12px', borderRadius: '8px', background: theme.accentLight, fontSize: '12px', color: theme.accent }}>
            ✅ Plan last applied: {new Date(demandPlan.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            {demandPlan.summary && ` — ${demandPlan.summary.totalKg} kg across ${demandPlan.summary.bedCount} beds (${demandPlan.lastMode || 'merge'} mode)`}
          </div>
        )}
      </Card>

      {/* Frost Date Settings */}
      <Card style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontFamily: headingFont, fontSize: '16px', margin: '0 0 2px 0', color: theme.text }}>Frost Date Settings</h3>
            <p style={{ fontSize: '12px', color: theme.textMuted, margin: 0 }}>Adjust your local frost dates to calibrate planting schedules.</p>
          </div>
          {!editingFrost ? (
            <Button variant="secondary" onClick={() => { setTempLastFrost(lastFrost); setTempFirstFrost(firstFrost); setEditingFrost(true); }}>Edit Frost Dates</Button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
              <FormField label="Last Frost Week (Spring)" style={{ marginBottom: 0, minWidth: '140px' }}>
                <Input type="number" min={1} max={52} value={tempLastFrost} onChange={e => setTempLastFrost(e.target.value)} style={{ width: '100px' }} />
              </FormField>
              <FormField label="First Frost Week (Autumn)" style={{ marginBottom: 0, minWidth: '140px' }}>
                <Input type="number" min={1} max={52} value={tempFirstFrost} onChange={e => setTempFirstFrost(e.target.value)} style={{ width: '100px' }} />
              </FormField>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button onClick={saveFrostDates}>Save</Button>
                <Button variant="ghost" onClick={() => setEditingFrost(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Farm Capacity Utilization */}
      <Card style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{ fontSize: '18px' }}>📊</span>
          <h3 style={{ fontFamily: headingFont, fontSize: '16px', margin: 0, color: theme.text }}>Farm Capacity Utilization</h3>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>
            <span>Area used: {totalAreaUsed.toFixed(1)} m²</span>
            <span>Total farm: {totalFarmArea.toFixed(1)} m²</span>
          </div>
          <div style={{ height: '10px', borderRadius: '5px', background: theme.borderLight, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '5px',
              width: `${Math.min(100, totalFarmArea > 0 ? (totalAreaUsed / totalFarmArea) * 100 : 0)}%`,
              background: totalAreaUsed / totalFarmArea > 0.9 ? '#e74c3c' : totalAreaUsed / totalFarmArea > 0.7 ? '#ff9800' : theme.accent,
              transition: 'width 0.3s',
            }} />
          </div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: theme.text, textAlign: 'center', marginTop: '6px' }}>
            {totalFarmArea > 0 ? ((totalAreaUsed / totalFarmArea) * 100).toFixed(0) : 0}% utilized
          </div>
        </div>
      </Card>

      {/* Action Panels — What to do now / Coming up */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span style={{ fontSize: '18px' }}>🔥</span>
            <h3 style={{ fontFamily: headingFont, fontSize: '16px', margin: 0, color: theme.text }}>What to Do Now</h3>
            <Badge color="#fff" bg={theme.warning || '#e65100'} style={{ marginLeft: 'auto' }}>Week {currentWeek}</Badge>
          </div>
          {nowActions.length === 0 ? (
            <p style={{ fontSize: '13px', color: theme.textMuted, textAlign: 'center', padding: '16px 0' }}>No urgent planting actions this week.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {nowActions.map((item, idx) => {
                const colors = actionPriorityColor(item.priority);
                return (
                  <div key={`${item.crop.id}-${item.action}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', background: colors.bg, border: `1px solid ${theme.borderLight}` }}>
                    <span style={{ fontSize: '20px' }}>{item.crop.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: theme.text }}>{item.crop.name}</div>
                      <div style={{ fontSize: '11px', color: theme.textSecondary }}>{item.icon} {item.action}</div>
                    </div>
                    <Badge color={colors.color} bg={`${colors.color}22`} style={{ fontSize: '10px' }}>{item.priority}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span style={{ fontSize: '18px' }}>📅</span>
            <h3 style={{ fontFamily: headingFont, fontSize: '16px', margin: 0, color: theme.text }}>Coming Up Soon</h3>
            <Badge color={theme.accent} bg={theme.accentLight || '#e3f2fd'} style={{ marginLeft: 'auto' }}>Weeks {currentWeek + 1}–{currentWeek + 3}</Badge>
          </div>
          {soonActions.length === 0 ? (
            <p style={{ fontSize: '13px', color: theme.textMuted, textAlign: 'center', padding: '16px 0' }}>Nothing coming up in the next 3 weeks.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {soonActions.slice(0, 10).map((item, idx) => (
                <div key={`${item.crop.id}-${item.action}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 12px', borderRadius: '8px', background: theme.bg, border: `1px solid ${theme.borderLight}` }}>
                  <span style={{ fontSize: '18px' }}>{item.crop.icon}</span>
                  <div style={{ flex: 1, fontSize: '13px', fontWeight: '500', color: theme.text }}>{item.icon} {item.action} — {item.crop.name}</div>
                  <span style={{ fontSize: '11px', color: theme.textMuted }}>Wk {item.week}</span>
                </div>
              ))}
              {soonActions.length > 10 && <p style={{ fontSize: '11px', color: theme.textMuted, textAlign: 'center', margin: '4px 0 0' }}>+{soonActions.length - 10} more</p>}
            </div>
          )}
        </Card>
      </div>

      {/* Demand-Driven Plantings (active ones in beds) */}
      {demandPlantings.length > 0 && (
        <Card style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span style={{ fontSize: '18px' }}>🎯</span>
            <h3 style={{ fontFamily: headingFont, fontSize: '16px', margin: 0, color: theme.text }}>Active Demand Plantings</h3>
            <Badge color="#fff" bg="#e67e22" style={{ marginLeft: 'auto' }}>{demandPlantings.length} plantings</Badge>
          </div>
          {(() => {
            const criticalAlerts = timingAlerts.alerts.filter(a => a.severity === 'critical');
            const urgentAlerts = timingAlerts.alerts.filter(a => a.severity === 'urgent');
            const pastDuePlantings = demandPlantings.filter(p => p.startWeek < currentWeek && p.year === viewYear && currentWeek - p.startWeek <= 4);
            const thisWeekDemand = demandPlantings.filter(p => p.startWeek === currentWeek && p.year === viewYear);
            const nextWeeksDemand = demandPlantings.filter(p => p.startWeek > currentWeek && p.startWeek <= currentWeek + 3 && p.year === viewYear);
            return (
              <>
                {criticalAlerts.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: theme.error || '#d32f2f', marginBottom: '6px' }}>🚨 Critical — Missed Dates:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {criticalAlerts.map((a, i) => (
                        <div key={`crit-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '8px', background: theme.errorLight || '#ffebee', borderLeft: `3px solid ${theme.error || '#d32f2f'}`, fontSize: '12px' }}>
                          <span style={{ fontSize: '16px' }}>{a.cropIcon}</span>
                          <span style={{ flex: 1, color: theme.error || '#d32f2f' }}>{a.message}</span>
                          <Badge color="#fff" bg={theme.error || '#d32f2f'} style={{ fontSize: '9px' }}>{a.type === 'SOW_PAST' ? 'MISSED' : 'NURSERY'}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {urgentAlerts.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: theme.warning || '#f57c00', marginBottom: '6px' }}>⏰ Sow Soon:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {urgentAlerts.map((a, i) => (
                        <div key={`urg-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '8px', background: '#fff3e0', borderLeft: `3px solid ${theme.warning || '#f57c00'}`, fontSize: '12px' }}>
                          <span style={{ fontSize: '16px' }}>{a.cropIcon}</span>
                          <span style={{ flex: 1, color: theme.warning || '#f57c00' }}>{a.message}</span>
                          <Badge color="#fff" bg={theme.warning || '#f57c00'} style={{ fontSize: '9px' }}>IMMINENT</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {thisWeekDemand.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: theme.warning || '#e65100', marginBottom: '6px' }}>🔥 Sow THIS Week (W{currentWeek}):</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {thisWeekDemand.map(p => {
                        const crop = crops.find(c => c.id === p.cropId);
                        return (
                          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '8px', background: theme.warningLight || '#fff8e1', border: `1px solid ${theme.warning || '#f57f17'}`, fontSize: '12px' }}>
                            <span style={{ fontSize: '16px' }}>{crop?.icon || '🌱'}</span>
                            <span style={{ fontWeight: '500', color: theme.text }}>{crop?.name || p.cropId}</span>
                            <span style={{ fontSize: '10px', color: theme.textMuted }}>@ {p.bedName}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {nextWeeksDemand.length > 0 && (
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: theme.textSecondary, marginBottom: '6px' }}>📅 Coming up (W{currentWeek + 1}–W{currentWeek + 3}):</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {nextWeeksDemand.slice(0, 12).map(p => {
                        const crop = crops.find(c => c.id === p.cropId);
                        return (
                          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '6px', background: theme.bg, border: `1px solid ${theme.borderLight}`, fontSize: '11px' }}>
                            <span>{crop?.icon || '🌱'}</span>
                            <span style={{ color: theme.text }}>{crop?.name || p.cropId}</span>
                            <span style={{ color: theme.textMuted }}>W{p.startWeek} @ {p.bedName}</span>
                          </div>
                        );
                      })}
                      {nextWeeksDemand.length > 12 && <span style={{ fontSize: '11px', color: theme.textMuted, padding: '4px' }}>+{nextWeeksDemand.length - 12} more</span>}
                    </div>
                  </div>
                )}
                {thisWeekDemand.length === 0 && nextWeeksDemand.length === 0 && (
                  <p style={{ fontSize: '13px', color: theme.textMuted, margin: 0 }}>No demand-driven sowings due in the next 3 weeks.</p>
                )}
              </>
            );
          })()}
        </Card>
      )}

      {/* Annual Planting Calendar */}
      <Card style={{ overflow: 'hidden' }}>
        <div style={{ marginBottom: '14px' }}>
          <h3 style={{ fontFamily: headingFont, fontSize: '16px', margin: '0 0 4px 0', color: theme.text }}>Annual Planting Calendar</h3>
          <p style={{ fontSize: '12px', color: theme.textMuted, margin: 0 }}>Overview of planting, transplanting, and harvest windows for all crops.</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', padding: '10px 14px', background: theme.bg, borderRadius: '8px', border: `1px solid ${theme.borderLight}` }}>
          {[
            { icon: '🏠', label: 'Sow Indoors' }, { icon: '🌱', label: 'Direct Sow' },
            { icon: '🌿', label: 'Transplant' }, { icon: '🧺', label: 'Harvest' }, { icon: '🔁', label: 'Succession' },
          ].map(item => (
            <span key={item.label} style={{ fontSize: '12px', color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '14px' }}>{item.icon}</span>{item.label}
            </span>
          ))}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, zIndex: 2, background: theme.bgCard, textAlign: 'left', padding: '8px 12px', borderBottom: `2px solid ${theme.border}`, fontFamily: headingFont, fontSize: '13px', color: theme.text, minWidth: '140px' }}>Crop</th>
                {MONTH_NAMES.map((month, idx) => {
                  const { start: mStart, end: mEnd } = monthToWeekRange(idx);
                  const isCurrent = currentWeek >= mStart && currentWeek <= mEnd;
                  return (
                    <th key={month} style={{ textAlign: 'center', padding: '8px 4px', borderBottom: `2px solid ${theme.border}`, fontFamily: bodyFont, fontWeight: '600', fontSize: '11px', color: isCurrent ? theme.accent : theme.textSecondary, background: isCurrent ? (theme.accentLight || '#e3f2fd') : 'transparent', borderRadius: isCurrent ? '6px 6px 0 0' : 0, minWidth: '50px' }}>{month}</th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {calendarData.map(({ crop, months }, rowIdx) => (
                <tr key={crop.id} style={{ background: rowIdx % 2 === 0 ? 'transparent' : theme.bg }}>
                  <td style={{ position: 'sticky', left: 0, zIndex: 1, background: rowIdx % 2 === 0 ? theme.bgCard : theme.bg, padding: '6px 12px', borderBottom: `1px solid ${theme.borderLight}`, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '16px' }}>{crop.icon}</span>
                      <span style={{ fontWeight: '500', color: theme.text, fontSize: '12px' }}>{crop.name}</span>
                      <Badge color={crop.season === 'warm' ? '#e65100' : '#1565c0'} bg={crop.season === 'warm' ? '#fff3e0' : '#e3f2fd'} style={{ fontSize: '9px', padding: '1px 5px' }}>{crop.season}</Badge>
                    </div>
                  </td>
                  {months.map((actions, mIdx) => {
                    const { start: mStart, end: mEnd } = monthToWeekRange(mIdx);
                    const isCurrent = currentWeek >= mStart && currentWeek <= mEnd;
                    return (
                      <td key={mIdx} style={{ textAlign: 'center', padding: '4px 2px', borderBottom: `1px solid ${theme.borderLight}`, background: isCurrent ? `${theme.accentLight || '#e3f2fd'}44` : 'transparent', verticalAlign: 'middle' }}>
                        {actions.length > 0 ? (
                          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '1px' }} title={actions.map(a => a.label).join(', ')}>
                            {actions.map((a, aIdx) => <span key={aIdx} style={{ fontSize: '13px', lineHeight: 1, cursor: 'default' }} title={a.label}>{a.icon}</span>)}
                          </div>
                        ) : <span style={{ color: theme.borderLight }}>—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Manual Demand Modal */}
      <Modal open={showAddDemand} onClose={() => setShowAddDemand(false)} title="Add Manual Demand" width="460px">
        <FormField label="Category">
          <Select value={demandForm.category} onChange={e => setDemandForm({ ...demandForm, category: e.target.value })}>
            {DEMAND_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </FormField>
        <FormField label="Quantity (kg)">
          <Input type="number" min="0" step="0.1" value={demandForm.quantityKg} onChange={e => setDemandForm({ ...demandForm, quantityKg: e.target.value })} placeholder="e.g. 50" />
        </FormField>
        <FormField label="Specific Crop (optional)">
          <Select value={demandForm.cropId} onChange={e => setDemandForm({ ...demandForm, cropId: e.target.value })}>
            <option value="">Any crop in category</option>
            {crops.filter(c => c.category === demandForm.category).sort((a, b) => a.name.localeCompare(b.name)).map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Notes (optional)">
          <Input value={demandForm.notes} onChange={e => setDemandForm({ ...demandForm, notes: e.target.value })} placeholder="e.g. For market sales" />
        </FormField>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <Button variant="ghost" onClick={() => setShowAddDemand(false)}>Cancel</Button>
          <Button onClick={handleAddManualDemand} disabled={!demandForm.quantityKg || parseFloat(demandForm.quantityKg) <= 0}>Add Demand</Button>
        </div>
      </Modal>

      {/* Confirm Apply Modal */}
      <Modal open={showConfirmApply} onClose={() => setShowConfirmApply(false)} title="🌱 Apply Season Plan" width="500px">
        <p style={{ fontSize: '14px', color: theme.text, margin: '0 0 12px', lineHeight: '1.5' }}>
          This will allocate crops to beds based on your demand. Choose how to handle existing plantings:
        </p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {[
            { value: 'merge', label: '🔀 Merge', desc: 'Replace demand plantings only. Manual plantings are preserved.' },
            { value: 'replace', label: '🗑️ Replace All', desc: 'Clear all plantings for this year and rebuild from scratch.' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setApplyMode(opt.value)}
              style={{
                flex: 1, padding: '12px', borderRadius: '10px', textAlign: 'left', cursor: 'pointer',
                border: applyMode === opt.value ? `2px solid ${theme.accent}` : `1.5px solid ${theme.borderLight}`,
                background: applyMode === opt.value ? `${theme.accent}10` : 'transparent',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: '700', color: applyMode === opt.value ? theme.accent : theme.text, fontFamily: bodyFont }}>{opt.label}</div>
              <div style={{ fontSize: '11px', color: theme.textMuted, marginTop: '4px', fontFamily: bodyFont }}>{opt.desc}</div>
            </button>
          ))}
        </div>
        {applyMode === 'replace' && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', background: theme.warningLight || '#fff8e1', border: `1px solid ${theme.warning || '#f57f17'}`, marginBottom: '16px', fontSize: '12px', color: theme.warning || '#f57f17' }}>
            ⚠️ This will remove ALL plantings (including manual ones) for {viewYear}.
          </div>
        )}
        <div style={{ padding: '12px 14px', background: theme.bgHover, borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: theme.textSecondary }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Total demand:</span>
            <strong style={{ color: theme.text }}>{combinedDemand.totalKg} kg</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Estimated area:</span>
            <strong style={{ color: theme.text }}>{combinedDemand.totalArea} m²</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Farm capacity:</span>
            <strong style={{ color: theme.text }}>{totalFarmArea.toFixed(1)} m²</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Categories:</span>
            <strong style={{ color: theme.text }}>{combinedDemand.categories?.length || Object.keys(combinedDemand.demandMap || {}).length}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setShowConfirmApply(false)}>Cancel</Button>
          <Button onClick={handleApply} disabled={applying}>{applying ? '⏳ Applying...' : '🌱 Apply Plan'}</Button>
        </div>
      </Modal>

      {/* Preview / Result Modal */}
      <Modal open={showPreview} onClose={() => setShowPreview(false)} title="📊 Season Plan Preview" width="700px">
        {previewResult && (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
              {[
                { label: 'Total Produce', value: `${previewResult.summary.totalKg} kg`, icon: '🔬' },
                { label: 'Growing Area', value: `${previewResult.summary.totalArea} m²`, icon: '📐' },
                { label: 'Beds Used', value: previewResult.summary.bedCount, icon: '🛏️' },
                { label: 'Crop Allocations', value: previewResult.summary.cropCount, icon: '🌱' },
              ].map(s => (
                <div key={s.label} style={{ flex: '1 1 120px', padding: '10px', borderRadius: '8px', background: theme.accentLight, textAlign: 'center' }}>
                  <div style={{ fontSize: '18px' }}>{s.icon}</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: theme.text }}>{s.value}</div>
                  <div style={{ fontSize: '11px', color: theme.textSecondary }}>{s.label}</div>
                </div>
              ))}
            </div>
            {previewResult.warnings.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                {previewResult.warnings.map((w, i) => {
                  const isCritical = w.startsWith('🚨');
                  const isUrgent = w.startsWith('⏰');
                  const isFrost = w.startsWith('❄️') || w.startsWith('🌡️');
                  const bg = isCritical ? (theme.errorLight || '#ffebee') : isUrgent ? '#fff3e0' : (theme.warningLight || '#fff8e1');
                  const color = isCritical ? (theme.error || '#d32f2f') : isUrgent ? (theme.warning || '#f57c00') : (theme.warning || '#e65100');
                  const borderLeft = isCritical ? `3px solid ${theme.error || '#d32f2f'}` : isUrgent ? `3px solid ${theme.warning || '#f57c00'}` : isFrost ? `3px solid #1565c0` : 'none';
                  return (
                    <div key={i} style={{ padding: '8px 12px', borderRadius: '6px', background: bg, color, fontSize: '12px', marginBottom: '4px', borderLeft }}>{w}</div>
                  );
                })}
              </div>
            )}
            {previewResult.allocations && previewResult.allocations.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      {['Crop', 'Category', 'Demand (kg)', 'Area (m²)', 'Sow Week', 'Bed'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 10px', borderBottom: `2px solid ${theme.border}`, color: theme.textSecondary, fontSize: '10px', textTransform: 'uppercase', fontWeight: '600' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewResult.allocations.map((a, i) => (
                      <tr key={i}>
                        <td style={{ padding: '6px 10px', borderBottom: `1px solid ${theme.borderLight}` }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>{a.crop.icon}</span>
                            <span style={{ fontWeight: '500', color: theme.text }}>{a.crop.name}</span>
                          </span>
                        </td>
                        <td style={{ padding: '6px 10px', borderBottom: `1px solid ${theme.borderLight}`, color: cropCategories[a.category]?.color || theme.textSecondary }}>{cropCategories[a.category]?.label || a.category}</td>
                        <td style={{ padding: '6px 10px', borderBottom: `1px solid ${theme.borderLight}`, color: theme.text }}>{a.cropKg} kg</td>
                        <td style={{ padding: '6px 10px', borderBottom: `1px solid ${theme.borderLight}`, color: theme.text }}>{a.areaSqM} m²</td>
                        <td style={{ padding: '6px 10px', borderBottom: `1px solid ${theme.borderLight}`, color: theme.textMuted }}>W{a.sowWeek}</td>
                        <td style={{ padding: '6px 10px', borderBottom: `1px solid ${theme.borderLight}`, color: theme.textMuted, fontSize: '11px' }}>
                          {a.bedAssignment?.bedName || '—'}
                          {a.bedFraction < 1 && <span style={{ color: theme.accent, marginLeft: '4px' }}>({a.bedFraction === 0.5 ? '½' : '¼'})</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <Button variant="ghost" onClick={() => setShowPreview(false)}>Close</Button>
              {onNavigate && (
                <Button onClick={() => { setShowPreview(false); onNavigate('farm'); }}>
                  🌱 View Farm
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

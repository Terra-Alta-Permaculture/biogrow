import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Card, SummaryCard, Button, Modal, FormField, Input, Select, Badge, EmptyState } from '../components/shared';
import { generateId, formatDate, bedArea } from '../utils/helpers';
import { mealProfiles, getProfileById, cropCategories } from '../data/mealProfiles';
import { aggregateDemand, aggregateCSADemand, aggregateRestaurantDemand, mergeDemandMaps } from '../utils/demandEngine';
import { EVENT_CATEGORIES, DEFAULT_CATEGORY, getCategoryById } from '../data/eventCategories';

const THEMES = ['Summer Harvest Feast', 'Pizza Night', 'Fermentation Workshop', 'Farm Brunch', 'Salad Bar', 'Seasonal Tasting', 'Retreat', 'Course', 'Custom'];
const COURSES = ['Starter', 'Main', 'Side', 'Dessert', 'Drinks'];

const DEFAULT_BOX = {
  greens: 0.5,
  rootVeg: 0.8,
  fruitingVeg: 1.0,
  herbs: 0.1,
  legumes: 0.3,
  fruits: 0.3,
};

const DEFAULT_RESTAURANT_ORDER = {
  greens: 3,
  rootVeg: 2,
  fruitingVeg: 4,
  herbs: 0.5,
  legumes: 1,
  fruits: 1,
};

export default function EventsTab({ onNavigate }) {
  const { events: farmEvents, crops, zones, settings, demandPlan, selectedCropIds, csaSchemes, restaurantContracts, updateState, theme, showToast } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: 'event'|'csa'|'restaurant', id, name }
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [form, setForm] = useState({
    name: '', date: '', time: '18:00', description: '', eventTheme: THEMES[0],
    notes: '', menu: [],
    eventType: 'single', startDate: '', endDate: '', guestCount: '',
    mealProfileId: 'full-board', customDemand: null, useCustomDemand: false,
    category: DEFAULT_CATEGORY,
  });
  const [menuForm, setMenuForm] = useState({ course: 'Starter', dish: '', cropIds: [] });
  const [formError, setFormError] = useState('');
  const [csaFormError, setCSAFormError] = useState('');
  const [restFormError, setRestFormError] = useState('');
  const [menuFormError, setMenuFormError] = useState('');

  // CSA state
  const [showCSAModal, setShowCSAModal] = useState(false);
  const [editingCSA, setEditingCSA] = useState(null);
  const [csaForm, setCSAForm] = useState({
    name: '', boxesPerWeek: '', deliveryFrequency: 'weekly',
    capacityPercent: 100, boxContents: { ...DEFAULT_BOX }, notes: '',
  });

  // Restaurant state
  const [showRestModal, setShowRestModal] = useState(false);
  const [editingRest, setEditingRest] = useState(null);
  const [restForm, setRestForm] = useState({
    name: '', contactName: '', deliveryFrequency: 'weekly',
    startDate: '', endDate: '',
    weeklyOrder: { ...DEFAULT_RESTAURANT_ORDER }, notes: '',
  });

  const events = farmEvents || [];
  const now = new Date().toISOString().slice(0, 10);

  const getEventDate = (e) => e.eventType === 'multi' ? (e.endDate || e.startDate || e.date) : e.date;
  const getEventStartDate = (e) => e.eventType === 'multi' ? (e.startDate || e.date) : e.date;

  const upcoming = useMemo(() =>
    events.filter(e => getEventDate(e) >= now).sort((a, b) => getEventStartDate(a).localeCompare(getEventStartDate(b))),
    [events, now]
  );
  const past = useMemo(() =>
    events.filter(e => getEventDate(e) < now).sort((a, b) => getEventStartDate(b).localeCompare(getEventStartDate(a))),
    [events, now]
  );

  const filteredUpcoming = useMemo(() =>
    categoryFilter === 'all' ? upcoming : upcoming.filter(e => (e.category || DEFAULT_CATEGORY) === categoryFilter),
    [upcoming, categoryFilter]
  );
  const filteredPast = useMemo(() =>
    categoryFilter === 'all' ? past : past.filter(e => (e.category || DEFAULT_CATEGORY) === categoryFilter),
    [past, categoryFilter]
  );

  const activeCSASchemes = useMemo(() =>
    (csaSchemes || []).filter(s => !s.year || s.year === settings.currentYear),
    [csaSchemes, settings.currentYear]
  );

  const activeRestContracts = useMemo(() =>
    (restaurantContracts || []).filter(c => !c.year || c.year === settings.currentYear),
    [restaurantContracts, settings.currentYear]
  );

  const stats = useMemo(() => {
    const totalGuests = events.reduce((s, e) => s + (parseInt(e.guestCount) || 0), 0);
    const demandEvents = events.filter(e => (parseInt(e.guestCount) || 0) > 0).length;
    const csaCount = activeCSASchemes.length;
    const restCount = activeRestContracts.length;
    return { upcoming: upcoming.length, totalGuests, demandEvents, csaCount, restCount };
  }, [events, upcoming, activeCSASchemes, activeRestContracts]);

  // Demand overview (live calculation from all demand sources)
  const demandOverview = useMemo(() => {
    const lossMargin = demandPlan?.lossMargin ?? 0.30;
    const eventDemandMap = aggregateDemand(events, mealProfiles, lossMargin);
    const csaDemandMap = aggregateCSADemand(csaSchemes || [], settings, lossMargin, settings.currentYear);
    const restDemandMap = aggregateRestaurantDemand(restaurantContracts || [], settings, lossMargin, settings.currentYear);
    const demandMap = mergeDemandMaps(mergeDemandMaps(eventDemandMap, csaDemandMap), restDemandMap);

    const totalArea = zones.reduce((s, z) => s + z.beds.reduce((bs, b) => bs + bedArea(b), 0), 0);

    const categories = Object.entries(demandMap)
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
        const estimatedArea = d.totalKg / avgYield;
        // Compute planted capacity for this category
        let plantedCapacityKg = 0;
        zones.forEach(z => z.beds.forEach(b => {
          (b.plantings || []).forEach(p => {
            if (p.year !== settings.currentYear) return;
            const crop = eligible.find(c => c.id === p.cropId);
            if (!crop) return;
            const area = bedArea(b) * (p.bedFraction || 1);
            plantedCapacityKg += area * (crop.yieldPerM2 || 0);
          });
        }));

        const coveragePercent = d.totalKg > 0 ? Math.round((plantedCapacityKg / d.totalKg) * 100) : 0;

        return {
          category: cat,
          label: cropCategories[cat]?.label || cat,
          icon: cropCategories[cat]?.icon || '🌱',
          color: cropCategories[cat]?.color || theme.accent,
          totalKg: Math.round(d.totalKg * 10) / 10,
          estimatedArea: Math.round(estimatedArea * 10) / 10,
          cropCount: eligible.length,
          plantedKg: Math.round(plantedCapacityKg * 10) / 10,
          coveragePercent,
        };
      })
      .filter(c => c.cropCount > 0);

    const totalDemandKg = Math.round(categories.reduce((s, c) => s + c.totalKg, 0) * 10) / 10;
    const totalDemandArea = Math.round(categories.reduce((s, c) => s + c.estimatedArea, 0) * 10) / 10;

    return { categories, totalDemandKg, totalDemandArea, totalFarmArea: Math.round(totalArea * 10) / 10 };
  }, [events, crops, zones, demandPlan, selectedCropIds, csaSchemes, restaurantContracts, settings, theme]);

  const getAvailableCrops = (eventDate) => {
    if (!eventDate) return crops;
    const eventMonth = new Date(eventDate).getMonth();
    return crops.filter(c => {
      if (c.season === 'warm') return eventMonth >= 4 && eventMonth <= 9;
      return eventMonth <= 4 || eventMonth >= 9;
    });
  };

  // ─── Event CRUD ───

  const openAdd = () => {
    setEditing(null);
    setForm({
      name: '', date: '', time: '18:00', description: '', eventTheme: THEMES[0],
      notes: '', menu: [],
      eventType: 'single', startDate: '', endDate: '', guestCount: '',
      mealProfileId: 'full-board', customDemand: null, useCustomDemand: false,
      category: DEFAULT_CATEGORY,
    });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (ev) => {
    setEditing(ev.id);
    setForm({
      ...ev,
      eventType: ev.eventType || 'single',
      startDate: ev.startDate || '',
      endDate: ev.endDate || '',
      guestCount: ev.guestCount ?? '',
      mealProfileId: ev.mealProfileId || 'full-board',
      customDemand: ev.customDemand || null,
      useCustomDemand: !!ev.customDemand,
      category: ev.category || DEFAULT_CATEGORY,
    });
    setFormError('');
    setShowModal(true);
  };

  const save = () => {
    if (!form.name) { setFormError('Please enter an event name.'); return; }
    if (form.eventType === 'single' && !form.date) { setFormError('Please select a date.'); return; }
    if (form.eventType === 'multi' && (!form.startDate || !form.endDate)) { setFormError('Please set both start and end dates.'); return; }
    setFormError('');

    const eventData = { ...form };
    eventData.guestCount = Math.max(0, parseInt(eventData.guestCount) || 0);
    if (!eventData.useCustomDemand) eventData.customDemand = null;
    delete eventData.useCustomDemand;
    delete eventData.guests;
    delete eventData.capacity;
    delete eventData.ticketPrice;
    delete eventData.costs;
    delete eventData.actualRevenue;
    delete eventData.actualGuests;

    updateState(prev => {
      const list = [...(prev.events || [])];
      if (editing) {
        const idx = list.findIndex(e => e.id === editing);
        if (idx >= 0) list[idx] = { ...list[idx], ...eventData };
      } else {
        list.push({ id: generateId(), ...eventData });
      }
      return { ...prev, events: list };
    });
    setShowModal(false);
  };

  const remove = (id) => {
    const item = events.find(e => e.id === id);
    updateState(prev => ({ ...prev, events: (prev.events || []).filter(e => e.id !== id) }));
    setDeleteConfirm(null);
    if (item) {
      showToast(`Event "${item.name}" deleted`, {
        type: 'warning',
        undo: () => updateState(prev => ({ ...prev, events: [...(prev.events || []), item] })),
      });
    }
  };

  // ─── CSA CRUD ───

  const openAddCSA = () => {
    setEditingCSA(null);
    setCSAForm({
      name: '', boxesPerWeek: '', deliveryFrequency: 'weekly',
      capacityPercent: 100, boxContents: { ...DEFAULT_BOX }, notes: '',
    });
    setCSAFormError('');
    setShowCSAModal(true);
  };

  const openEditCSA = (scheme) => {
    setEditingCSA(scheme.id);
    setCSAForm({
      name: scheme.name || '',
      boxesPerWeek: scheme.boxesPerWeek || '',
      deliveryFrequency: scheme.deliveryFrequency || 'weekly',
      capacityPercent: scheme.capacityPercent ?? 100,
      boxContents: { ...DEFAULT_BOX, ...(scheme.boxContents || {}) },
      notes: scheme.notes || '',
    });
    setCSAFormError('');
    setShowCSAModal(true);
  };

  const saveCSA = () => {
    if (!csaForm.name) { setCSAFormError('Please enter a scheme name.'); return; }
    if (!csaForm.boxesPerWeek) { setCSAFormError('Please enter boxes per week.'); return; }
    setCSAFormError('');
    const schemeData = {
      ...csaForm,
      boxesPerWeek: Math.max(0, parseInt(csaForm.boxesPerWeek) || 0),
      capacityPercent: Math.max(0, Math.min(100, parseInt(csaForm.capacityPercent) || 100)),
      year: settings.currentYear,
    };

    updateState(prev => {
      const list = [...(prev.csaSchemes || [])];
      if (editingCSA) {
        const idx = list.findIndex(s => s.id === editingCSA);
        if (idx >= 0) list[idx] = { ...list[idx], ...schemeData };
      } else {
        list.push({ id: generateId(), ...schemeData });
      }
      return { ...prev, csaSchemes: list };
    });
    setShowCSAModal(false);
  };

  const removeCSA = (id) => {
    const item = (csaSchemes || []).find(s => s.id === id);
    updateState(prev => ({ ...prev, csaSchemes: (prev.csaSchemes || []).filter(s => s.id !== id) }));
    setDeleteConfirm(null);
    if (item) {
      showToast(`CSA scheme "${item.name}" deleted`, {
        type: 'warning',
        undo: () => updateState(prev => ({ ...prev, csaSchemes: [...(prev.csaSchemes || []), item] })),
      });
    }
  };

  // ─── Restaurant CRUD ───

  const openAddRest = () => {
    setEditingRest(null);
    setRestForm({
      name: '', contactName: '', deliveryFrequency: 'weekly',
      startDate: '', endDate: '',
      weeklyOrder: { ...DEFAULT_RESTAURANT_ORDER }, notes: '',
    });
    setRestFormError('');
    setShowRestModal(true);
  };

  const openEditRest = (contract) => {
    setEditingRest(contract.id);
    setRestForm({
      name: contract.name || '',
      contactName: contract.contactName || '',
      deliveryFrequency: contract.deliveryFrequency || 'weekly',
      startDate: contract.startDate || '',
      endDate: contract.endDate || '',
      weeklyOrder: { ...DEFAULT_RESTAURANT_ORDER, ...(contract.weeklyOrder || {}) },
      notes: contract.notes || '',
    });
    setRestFormError('');
    setShowRestModal(true);
  };

  const saveRest = () => {
    if (!restForm.name) { setRestFormError('Please enter a restaurant name.'); return; }
    setRestFormError('');
    const contractData = {
      ...restForm,
      year: settings.currentYear,
    };

    updateState(prev => {
      const list = [...(prev.restaurantContracts || [])];
      if (editingRest) {
        const idx = list.findIndex(c => c.id === editingRest);
        if (idx >= 0) list[idx] = { ...list[idx], ...contractData };
      } else {
        list.push({ id: generateId(), ...contractData });
      }
      return { ...prev, restaurantContracts: list };
    });
    setShowRestModal(false);
  };

  const removeRest = (id) => {
    const item = (restaurantContracts || []).find(c => c.id === id);
    updateState(prev => ({ ...prev, restaurantContracts: (prev.restaurantContracts || []).filter(c => c.id !== id) }));
    setDeleteConfirm(null);
    if (item) {
      showToast(`Restaurant "${item.name}" deleted`, {
        type: 'warning',
        undo: () => updateState(prev => ({ ...prev, restaurantContracts: [...(prev.restaurantContracts || []), item] })),
      });
    }
  };

  // ─── Menu ───

  const openMenuEditor = (ev) => {
    setSelectedEvent(ev);
    setMenuForm({ course: 'Starter', dish: '', cropIds: [] });
    setMenuFormError('');
    setShowMenuModal(true);
  };

  const addMenuItem = () => {
    if (!menuForm.dish) { setMenuFormError('Please enter a dish name.'); return; }
    setMenuFormError('');
    updateState(prev => {
      const list = [...(prev.events || [])];
      const idx = list.findIndex(e => e.id === selectedEvent.id);
      if (idx >= 0) {
        const menu = [...(list[idx].menu || []), { id: generateId(), ...menuForm }];
        list[idx] = { ...list[idx], menu };
      }
      return { ...prev, events: list };
    });
    setMenuForm({ course: 'Starter', dish: '', cropIds: [] });
  };

  const removeMenuItem = (eventId, menuItemId) => {
    updateState(prev => {
      const list = [...(prev.events || [])];
      const idx = list.findIndex(e => e.id === eventId);
      if (idx >= 0) {
        list[idx] = { ...list[idx], menu: (list[idx].menu || []).filter(m => m.id !== menuItemId) };
      }
      return { ...prev, events: list };
    });
  };

  const selectedProfile = getProfileById(form.mealProfileId);

  const demandSourceLabel = (() => {
    const parts = [];
    if (stats.demandEvents > 0) parts.push(`${stats.demandEvents} event${stats.demandEvents !== 1 ? 's' : ''}`);
    if (stats.csaCount > 0) parts.push(`${stats.csaCount} CSA scheme${stats.csaCount !== 1 ? 's' : ''}`);
    if (stats.restCount > 0) parts.push(`${stats.restCount} restaurant${stats.restCount !== 1 ? 's' : ''}`);
    return parts.length > 0 ? parts.join(' + ') : 'no sources';
  })();

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ margin: 0, fontFamily: "'DM Serif Display', serif", color: theme.text }}>📅 Events</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button onClick={openAddRest} style={{ fontSize: '12px', padding: '6px 14px', background: '#e91e63' }}>+ Restaurant</Button>
          <Button onClick={openAddCSA} style={{ fontSize: '12px', padding: '6px 14px', background: '#4caf50' }}>+ CSA Scheme</Button>
          <Button onClick={openAdd}>+ Create Event</Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
        <SummaryCard icon="📅" label="Upcoming" value={stats.upcoming} />
        <SummaryCard icon="👥" label="Total Guests" value={stats.totalGuests} />
        <SummaryCard icon="🎯" label="Demand Events" value={stats.demandEvents} color={theme.accent} />
        {stats.csaCount > 0 && <SummaryCard icon="📦" label="CSA Schemes" value={stats.csaCount} color="#4caf50" />}
        {stats.restCount > 0 && <SummaryCard icon="🏪" label="Restaurants" value={stats.restCount} color="#e91e63" />}
      </div>

      {/* Category Filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
        <button
          onClick={() => setCategoryFilter('all')}
          style={{
            padding: '5px 12px', borderRadius: '16px', border: `1px solid ${theme.borderLight}`,
            background: categoryFilter === 'all' ? theme.accent : 'transparent',
            color: categoryFilter === 'all' ? '#fff' : theme.textSecondary,
            fontSize: '12px', fontWeight: '600', cursor: 'pointer',
            fontFamily: "'Libre Franklin', sans-serif",
          }}
        >
          All
        </button>
        {EVENT_CATEGORIES.map(cat => {
          const count = events.filter(e => (e.category || DEFAULT_CATEGORY) === cat.id).length;
          if (count === 0) return null;
          return (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              style={{
                padding: '5px 12px', borderRadius: '16px',
                border: `1px solid ${categoryFilter === cat.id ? cat.color : theme.borderLight}`,
                background: categoryFilter === cat.id ? cat.color : 'transparent',
                color: categoryFilter === cat.id ? '#fff' : theme.textSecondary,
                fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                fontFamily: "'Libre Franklin', sans-serif",
              }}
            >
              {cat.icon} {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Season Demand Overview */}
      {demandOverview.categories.length > 0 && (
        <Card style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '16px' }}>
                🌾 Season Demand Overview
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: theme.textMuted }}>
                Total demand from {demandSourceLabel} · {(demandPlan?.lossMargin ?? 0.30) * 100}% crop loss margin applied
              </p>
            </div>
            {onNavigate && (
              <Button onClick={() => onNavigate('plan')} style={{ fontSize: '12px', padding: '6px 14px' }}>
                📋 Go to Plan →
              </Button>
            )}
          </div>

          {/* Capacity Bar */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>
              <span>Area needed: {demandOverview.totalDemandArea} m²</span>
              <span>Farm total: {demandOverview.totalFarmArea} m²</span>
            </div>
            <div style={{ height: '8px', borderRadius: '4px', background: theme.borderLight, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                borderRadius: '4px',
                width: `${Math.min(100, demandOverview.totalFarmArea > 0 ? (demandOverview.totalDemandArea / demandOverview.totalFarmArea) * 100 : 0)}%`,
                background: demandOverview.totalDemandArea > demandOverview.totalFarmArea ? '#e74c3c' : theme.accent,
                transition: 'width 0.3s',
              }} />
            </div>
            {demandOverview.totalDemandArea > demandOverview.totalFarmArea && (
              <div style={{ fontSize: '11px', color: '#e74c3c', marginTop: '4px', fontWeight: '600' }}>
                ⚠️ Demand exceeds farm capacity by {(demandOverview.totalDemandArea - demandOverview.totalFarmArea).toFixed(1)} m²
              </div>
            )}
          </div>

          {/* Category Breakdown Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {['Category', 'Total Demand (kg)', 'Est. Area (m²)', 'Coverage', 'Crops'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `2px solid ${theme.border}`, color: theme.textSecondary, fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {demandOverview.categories.map(cat => (
                  <tr key={cat.category}>
                    <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.borderLight}` }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '16px' }}>{cat.icon}</span>
                        <span style={{ fontWeight: '500', color: theme.text }}>{cat.label}</span>
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.borderLight}`, fontWeight: '600', color: cat.color }}>{cat.totalKg} kg</td>
                    <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.borderLight}`, color: theme.textSecondary }}>{cat.estimatedArea} m²</td>
                    <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.borderLight}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: theme.bgHover, overflow: 'hidden', minWidth: '40px', maxWidth: '80px' }}>
                          <div style={{
                            height: '100%', borderRadius: '3px',
                            width: `${Math.min(100, cat.coveragePercent)}%`,
                            background: cat.coveragePercent >= 80 ? '#16a34a' : cat.coveragePercent >= 50 ? '#d97706' : '#dc2626',
                          }} />
                        </div>
                        <span style={{
                          fontSize: '11px', fontWeight: '600',
                          color: cat.coveragePercent >= 80 ? '#16a34a' : cat.coveragePercent >= 50 ? '#d97706' : '#dc2626',
                        }}>
                          {cat.plantedKg > 0 ? `${cat.coveragePercent}%` : 'not planted'}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.borderLight}`, color: theme.textMuted }}>{cat.cropCount}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: '700' }}>
                  <td style={{ padding: '8px 12px', color: theme.text }}>Total</td>
                  <td style={{ padding: '8px 12px', color: theme.accent }}>{demandOverview.totalDemandKg.toFixed(1)} kg</td>
                  <td style={{ padding: '8px 12px', color: theme.textSecondary }}>{demandOverview.totalDemandArea} m²</td>
                  <td />
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          {demandPlan?.generatedAt && (
            <div style={{ marginTop: '12px', padding: '8px 12px', borderRadius: '8px', background: theme.accentLight, fontSize: '12px', color: theme.accent }}>
              ✅ Plan last generated: {formatDate(demandPlan.generatedAt.slice(0, 10))}
              {demandPlan.summary && ` — ${demandPlan.summary.bedCount} beds, ${demandPlan.summary.cropCount} crop allocations, ${demandPlan.summary.totalKg} kg total`}
            </div>
          )}
        </Card>
      )}

      {/* Empty demand state */}
      {demandOverview.categories.length === 0 && stats.demandEvents === 0 && stats.csaCount === 0 && stats.restCount === 0 && events.length > 0 && (
        <Card style={{ marginBottom: '24px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎯</div>
          <p style={{ fontSize: '13px', color: theme.textMuted, margin: 0 }}>
            Create events with guest counts, add CSA schemes, or set up restaurant contracts to unlock demand-driven season planning.
          </p>
        </Card>
      )}

      {/* CSA Box Schemes */}
      <Card style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '16px' }}>
              📦 CSA Box Schemes
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: theme.textMuted }}>
              Configure recurring box deliveries — demand integrates with the season plan
            </p>
          </div>
          <Button onClick={openAddCSA} style={{ fontSize: '12px', padding: '6px 14px' }}>+ Add Scheme</Button>
        </div>

        {activeCSASchemes.length === 0 && (
          <EmptyState icon="📦" message="No CSA schemes yet. Add a box scheme to plan recurring deliveries." />
        )}

        {activeCSASchemes.map(scheme => {
          const boxes = scheme.boxesPerWeek || 0;
          const capacity = (scheme.capacityPercent ?? 100);
          const contents = scheme.boxContents || {};
          const totalKgPerBox = Object.values(contents).reduce((s, v) => s + (parseFloat(v) || 0), 0);
          const effectiveKgPerWeek = totalKgPerBox * boxes * capacity / 100;
          const seasonWeeks = Math.max(1, (settings.firstFrostWeek - 2) - (settings.lastFrostWeek + 4) + 1);
          const totalSeasonKg = Math.round(effectiveKgPerWeek * seasonWeeks);
          const subscribers = scheme.deliveryFrequency === 'monthly' ? boxes * 4
            : scheme.deliveryFrequency === 'biweekly' ? boxes * 2 : boxes;
          const freqLabel = scheme.deliveryFrequency === 'monthly' ? 'monthly'
            : scheme.deliveryFrequency === 'biweekly' ? 'biweekly' : 'weekly';

          return (
            <div key={scheme.id} style={{ padding: '14px', borderRadius: '10px', background: theme.bgHover, border: `1px solid ${theme.borderLight}`, marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: theme.text }}>
                    {scheme.name}
                    <Badge bg="#4caf50" color="#fff" style={{ marginLeft: '8px', fontSize: '10px' }}>📦 CSA</Badge>
                  </div>
                  <div style={{ fontSize: '12px', color: theme.textSecondary, marginTop: '4px' }}>
                    {boxes} boxes/week · {freqLabel} delivery · {capacity}% capacity · ~{subscribers} subscribers
                  </div>
                  <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '2px' }}>
                    {totalKgPerBox.toFixed(1)} kg/box · {effectiveKgPerWeek.toFixed(1)} kg/week · ~{totalSeasonKg} kg/season ({seasonWeeks} weeks)
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => openEditCSA(scheme)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>✏️</button>
                  <button onClick={() => setDeleteConfirm({ type: 'csa', id: scheme.id, name: scheme.name })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>🗑️</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {Object.entries(contents).filter(([_, v]) => v > 0).map(([cat, kg]) => (
                  <span key={cat} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: theme.bgCard, color: theme.textSecondary, border: `1px solid ${theme.borderLight}` }}>
                    {cropCategories[cat]?.icon || '🌱'} {cropCategories[cat]?.label || cat}: {kg} kg
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </Card>

      {/* Restaurant Contracts */}
      <Card style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '16px' }}>
              🏪 Restaurant Contracts
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: theme.textMuted }}>
              Weekly supply agreements with restaurants — demand integrates with the season plan
            </p>
          </div>
          <Button onClick={openAddRest} style={{ fontSize: '12px', padding: '6px 14px' }}>+ Add Restaurant</Button>
        </div>

        {activeRestContracts.length === 0 && (
          <EmptyState icon="🏪" message="No restaurant contracts yet. Add a supply agreement to plan recurring orders." />
        )}

        {activeRestContracts.map(contract => {
          const order = contract.weeklyOrder || {};
          const totalKgPerWeek = Object.values(order).reduce((s, v) => s + (parseFloat(v) || 0), 0);
          const seasonWeeks = Math.max(1, (settings.firstFrostWeek - 2) - (settings.lastFrostWeek + 4) + 1);
          const totalSeasonKg = Math.round(totalKgPerWeek * seasonWeeks);
          const freqLabel = contract.deliveryFrequency === 'monthly' ? 'monthly'
            : contract.deliveryFrequency === 'biweekly' ? 'biweekly' : 'weekly';
          const dateRange = contract.startDate && contract.endDate
            ? `${formatDate(contract.startDate)} — ${formatDate(contract.endDate)}`
            : 'Growing season';

          return (
            <div key={contract.id} style={{ padding: '14px', borderRadius: '10px', background: theme.bgHover, border: `1px solid ${theme.borderLight}`, marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: theme.text }}>
                    {contract.name}
                    <Badge bg="#e91e63" color="#fff" style={{ marginLeft: '8px', fontSize: '10px' }}>🏪 Restaurant</Badge>
                  </div>
                  {contract.contactName && (
                    <div style={{ fontSize: '12px', color: theme.textSecondary, marginTop: '2px' }}>
                      Contact: {contract.contactName}
                    </div>
                  )}
                  <div style={{ fontSize: '12px', color: theme.textSecondary, marginTop: '4px' }}>
                    {freqLabel} delivery · {dateRange}
                  </div>
                  <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '2px' }}>
                    {totalKgPerWeek.toFixed(1)} kg/week · ~{totalSeasonKg} kg/season ({seasonWeeks} weeks)
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => openEditRest(contract)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>✏️</button>
                  <button onClick={() => setDeleteConfirm({ type: 'restaurant', id: contract.id, name: contract.name })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>🗑️</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {Object.entries(order).filter(([_, v]) => v > 0).map(([cat, kg]) => (
                  <span key={cat} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: theme.bgCard, color: theme.textSecondary, border: `1px solid ${theme.borderLight}` }}>
                    {cropCategories[cat]?.icon || '🌱'} {cropCategories[cat]?.label || cat}: {kg} kg/wk
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </Card>

      {/* Timeline */}
      {filteredUpcoming.length > 0 && (
        <Card style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 16px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '16px' }}>Upcoming Events Timeline</h3>
          <div style={{ position: 'relative', paddingLeft: '20px' }}>
            <div style={{ position: 'absolute', left: '8px', top: 0, bottom: 0, width: '2px', background: theme.accent }} />
            {filteredUpcoming.map(ev => {
              const guests = parseInt(ev.guestCount) || 0;
              const isMulti = ev.eventType === 'multi';
              const profile = isMulti ? getProfileById(ev.mealProfileId) : null;
              return (
                <div key={ev.id} style={{ marginBottom: '16px', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '-16px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: guests > 0 ? '#e67e22' : theme.accent, border: `2px solid ${theme.bgCard}` }} />
                  <div style={{ padding: '12px', borderRadius: '10px', background: theme.bgHover, border: `1px solid ${theme.borderLight}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: '600', color: theme.text }}>
                          {ev.name}
                          {(() => { const cat = getCategoryById(ev.category); return <Badge bg={cat.color} color="#fff" style={{ marginLeft: '8px', fontSize: '10px' }}>{cat.icon} {cat.label}</Badge>; })()}
                          {isMulti && <Badge bg="#e67e22" color="#fff" style={{ marginLeft: '4px', fontSize: '10px' }}>Multi-Day</Badge>}
                        </div>
                        <div style={{ fontSize: '12px', color: theme.textSecondary }}>
                          {isMulti
                            ? `${formatDate(ev.startDate)} — ${formatDate(ev.endDate)} | ${guests} guests | ${profile?.name || 'Full Board'}`
                            : `${formatDate(ev.date)} at ${ev.time} | ${ev.eventTheme}${guests > 0 ? ` | ${guests} guests` : ''}`
                          }
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {guests > 0 && <Badge bg="#e67e22" color="#fff">👥 {guests} guests</Badge>}
                        <button onClick={() => openEdit(ev)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>✏️</button>
                        <button onClick={() => openMenuEditor(ev)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>📋</button>
                        <button onClick={() => setDeleteConfirm({ type: 'event', id: ev.id, name: ev.name })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>🗑️</button>
                      </div>
                    </div>
                    {(ev.menu || []).length > 0 && (
                      <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {ev.menu.map(m => (
                          <span key={m.id} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '8px', background: theme.bgCard, color: theme.textSecondary, border: `1px solid ${theme.borderLight}` }}>
                            {m.course}: {m.dish}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Past events */}
      {filteredPast.length > 0 && (
        <Card style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 12px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '16px' }}>Past Events Archive</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredPast.map(ev => {
              const guests = parseInt(ev.guestCount) || 0;
              return (
              <div key={ev.id} style={{ padding: '10px', borderRadius: '8px', background: theme.bgHover, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span style={{ fontWeight: '500', color: theme.text }}>{ev.name}</span>
                  {(() => { const cat = getCategoryById(ev.category); return <Badge bg={cat.color} color="#fff" style={{ marginLeft: '6px', fontSize: '9px' }}>{cat.icon} {cat.label}</Badge>; })()}
                  <span style={{ color: theme.textMuted, fontSize: '12px', marginLeft: '8px' }}>
                    {ev.eventType === 'multi' ? `${formatDate(ev.startDate)} — ${formatDate(ev.endDate)}` : formatDate(ev.date)}
                  </span>
                  {guests > 0 && <Badge bg="#e67e22" color="#fff" style={{ marginLeft: '6px', fontSize: '9px' }}>👥 {guests}</Badge>}
                </div>
                <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                  <button onClick={() => openEdit(ev)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>✏️</button>
                  <button onClick={() => setDeleteConfirm({ type: 'event', id: ev.id, name: ev.name })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>🗑️</button>
                </div>
              </div>
              );
            })}
          </div>
        </Card>
      )}

      {events.length === 0 && activeCSASchemes.length === 0 && activeRestContracts.length === 0 && (
        <Card><EmptyState icon="📅" message="No events yet. Create your first event — dinners, markets, CSA, workshops, and more!" /></Card>
      )}

      {/* Event Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Event' : 'Create Event'} width="640px">
        <FormField label="Event Name">
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Summer Harvest Feast" />
        </FormField>

        <FormField label="Category">
          <Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
            {EVENT_CATEGORIES.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
            ))}
          </Select>
        </FormField>

        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', padding: '3px', borderRadius: '10px', background: theme.borderLight }}>
          {[
            { value: 'single', label: '📅 Single Day' },
            { value: 'multi', label: '📆 Multi-Day' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setForm({ ...form, eventType: opt.value })}
              style={{
                flex: 1, padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: '600',
                background: form.eventType === opt.value ? theme.bgCard : 'transparent',
                color: form.eventType === opt.value ? theme.accent : theme.textMuted,
                boxShadow: form.eventType === opt.value ? `0 1px 4px ${theme.shadow}` : 'none',
                transition: 'all 0.2s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {form.eventType === 'single' ? (
          <div style={{ display: 'flex', gap: '12px' }}>
            <FormField label="Date" style={{ flex: 1 }}>
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </FormField>
            <FormField label="Time" style={{ flex: 1 }}>
              <Input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
            </FormField>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '12px' }}>
            <FormField label="Start Date" style={{ flex: 1 }}>
              <Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </FormField>
            <FormField label="End Date" style={{ flex: 1 }}>
              <Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
            </FormField>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <FormField label="Guest Count" style={{ flex: 1 }}>
            <Input type="number" min="0" value={form.guestCount} onChange={e => setForm({ ...form, guestCount: e.target.value })} placeholder="e.g. 20" />
          </FormField>
          <FormField label="Theme" style={{ flex: 2 }}>
            <Select value={form.eventTheme} onChange={e => setForm({ ...form, eventTheme: e.target.value })}>
              {THEMES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </FormField>
        </div>

        <FormField label="Meal Profile">
          <Select value={form.mealProfileId} onChange={e => setForm({ ...form, mealProfileId: e.target.value })}>
            {mealProfiles.map(p => (
              <option key={p.id} value={p.id}>{p.icon} {p.name} — {p.description}</option>
            ))}
          </Select>
        </FormField>

        {selectedProfile && parseInt(form.guestCount) > 0 && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', background: theme.accentLight, marginBottom: '12px', fontSize: '12px' }}>
            <div style={{ fontWeight: '600', color: theme.accent, marginBottom: '6px' }}>{selectedProfile.icon} {selectedProfile.name} — per person{form.eventType === 'multi' ? '/day' : ''}:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {Object.entries(selectedProfile.demandPerPersonPerDay).filter(([_, v]) => v > 0).map(([cat, kg]) => (
                <span key={cat} style={{ padding: '2px 8px', borderRadius: '6px', background: theme.bgCard, color: theme.textSecondary }}>
                  {cropCategories[cat]?.icon || '🌱'} {cropCategories[cat]?.label || cat}: {kg} kg
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: '12px' }}>
          <button
            onClick={() => {
              const custom = !form.useCustomDemand;
              if (custom && !form.customDemand && selectedProfile) {
                setForm({ ...form, useCustomDemand: true, customDemand: { ...selectedProfile.demandPerPersonPerDay } });
              } else {
                setForm({ ...form, useCustomDemand: custom });
              }
            }}
            style={{
              background: 'none', border: `1px solid ${theme.borderLight}`, borderRadius: '6px',
              padding: '6px 12px', cursor: 'pointer', fontSize: '12px', color: theme.textSecondary,
            }}
          >
            {form.useCustomDemand ? '↩ Use profile defaults' : '⚙️ Customize demand amounts'}
          </button>
        </div>

        {form.useCustomDemand && form.customDemand && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            {Object.entries(form.customDemand).map(([cat, kg]) => (
              <FormField key={cat} label={`${cropCategories[cat]?.icon || ''} ${cropCategories[cat]?.label || cat} (kg/p/d)`} style={{ flex: '1 1 120px', marginBottom: '4px' }}>
                <Input type="number" step="0.01" min="0" value={kg}
                  onChange={e => setForm({ ...form, customDemand: { ...form.customDemand, [cat]: parseFloat(e.target.value) || 0 } })}
                />
              </FormField>
            ))}
          </div>
        )}

        <FormField label="Description">
          <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Event description..." />
        </FormField>
        <FormField label="Notes (logistics)">
          <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Tables, music, chef, equipment..." />
        </FormField>

        {formError && <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '8px' }}>{formError}</div>}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? 'Update' : 'Create Event'}</Button>
        </div>
      </Modal>

      {/* Menu Modal */}
      <Modal open={showMenuModal} onClose={() => setShowMenuModal(false)} title={`📋 Menu — ${selectedEvent?.name || ''}`} width="600px">
        {selectedEvent && (
          <>
            {(selectedEvent.menu || []).length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                {COURSES.filter(c => (selectedEvent.menu || []).some(m => m.course === c)).map(course => (
                  <div key={course} style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: theme.accent, marginBottom: '4px' }}>{course}</div>
                    {(selectedEvent.menu || []).filter(m => m.course === course).map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: '6px', background: theme.bgHover, marginBottom: '4px', fontSize: '13px' }}>
                        <div>
                          <span style={{ color: theme.text }}>{item.dish}</span>
                          {(item.cropIds || []).length > 0 && (
                            <span style={{ marginLeft: '8px', fontSize: '11px', color: theme.textMuted }}>
                              {item.cropIds.map(id => crops.find(c => c.id === id)).filter(Boolean).map(c => `${c.icon} ${c.name}`).join(', ')}
                            </span>
                          )}
                        </div>
                        <button onClick={() => { if (window.confirm(`Remove "${item.dish}" from menu?`)) removeMenuItem(selectedEvent.id, item.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>✕</button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {selectedEvent.date && (
              <div style={{ padding: '10px', borderRadius: '8px', background: theme.accentLight, marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: theme.accent, marginBottom: '4px' }}>🌿 In Season for {formatDate(selectedEvent.startDate || selectedEvent.date)}</div>
                <div style={{ fontSize: '11px', color: theme.textSecondary, display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {getAvailableCrops(selectedEvent.startDate || selectedEvent.date).map(c => (
                    <span key={c.id} style={{ padding: '2px 6px', borderRadius: '4px', background: theme.bgCard }}>{c.icon} {c.name}</span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ padding: '12px', borderRadius: '8px', border: `1px solid ${theme.borderLight}` }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: theme.text, marginBottom: '8px' }}>Add Menu Item</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <Select value={menuForm.course} onChange={e => setMenuForm({ ...menuForm, course: e.target.value })} style={{ flex: '0 0 120px' }}>
                  {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
                <Input value={menuForm.dish} onChange={e => setMenuForm({ ...menuForm, dish: e.target.value })} placeholder="Dish name" style={{ flex: 1, minWidth: '150px' }} />
                <Button onClick={addMenuItem} style={{ padding: '8px 14px' }}>Add</Button>
              </div>
              {menuFormError && <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>{menuFormError}</div>}
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '11px', color: theme.textMuted }}>Link to crops (optional):</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                  {crops.slice(0, 20).map(c => (
                    <button
                      key={c.id}
                      onClick={() => {
                        const ids = menuForm.cropIds.includes(c.id)
                          ? menuForm.cropIds.filter(id => id !== c.id)
                          : [...menuForm.cropIds, c.id];
                        setMenuForm({ ...menuForm, cropIds: ids });
                      }}
                      style={{
                        padding: '2px 6px', borderRadius: '4px',
                        border: `1px solid ${menuForm.cropIds.includes(c.id) ? theme.accent : theme.borderLight}`,
                        background: menuForm.cropIds.includes(c.id) ? theme.accentLight : 'transparent',
                        cursor: 'pointer', fontSize: '11px', color: theme.textSecondary,
                      }}
                    >
                      {c.icon} {c.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* CSA Modal */}
      <Modal open={showCSAModal} onClose={() => setShowCSAModal(false)} title={editingCSA ? 'Edit CSA Scheme' : 'Create CSA Scheme'} width="600px">
        <FormField label="Scheme Name">
          <Input value={csaForm.name} onChange={e => setCSAForm({ ...csaForm, name: e.target.value })} placeholder="e.g. Weekly Veggie Box" />
        </FormField>

        <div style={{ display: 'flex', gap: '12px' }}>
          <FormField label="Boxes Per Week" style={{ flex: 1 }}>
            <Input type="number" min="1" value={csaForm.boxesPerWeek}
              onChange={e => setCSAForm({ ...csaForm, boxesPerWeek: e.target.value })} placeholder="e.g. 20" />
          </FormField>
          <FormField label="Delivery Frequency" style={{ flex: 1 }}>
            <Select value={csaForm.deliveryFrequency} onChange={e => setCSAForm({ ...csaForm, deliveryFrequency: e.target.value })}>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="monthly">Monthly</option>
            </Select>
          </FormField>
        </div>

        {parseInt(csaForm.boxesPerWeek) > 0 && (
          <div style={{ padding: '8px 12px', borderRadius: '8px', background: theme.accentLight, marginBottom: '12px', fontSize: '12px', color: theme.accent }}>
            📊 {csaForm.boxesPerWeek} boxes/week × {csaForm.deliveryFrequency === 'monthly' ? '4 weeks' : csaForm.deliveryFrequency === 'biweekly' ? '2 weeks' : '1 week'} = ~{
              csaForm.deliveryFrequency === 'monthly' ? parseInt(csaForm.boxesPerWeek) * 4
              : csaForm.deliveryFrequency === 'biweekly' ? parseInt(csaForm.boxesPerWeek) * 2
              : parseInt(csaForm.boxesPerWeek)
            } subscribers
          </div>
        )}

        <FormField label={`Capacity Responsibility: ${csaForm.capacityPercent}%`}>
          <input type="range" min="10" max="100" step="5" value={csaForm.capacityPercent}
            onChange={e => setCSAForm({ ...csaForm, capacityPercent: parseInt(e.target.value) })}
            style={{ width: '100%', accentColor: '#4caf50' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: theme.textMuted, marginTop: '2px' }}>
            <span>10% — shared with others</span>
            <span>100% — full responsibility</span>
          </div>
        </FormField>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: theme.text, marginBottom: '8px' }}>Box Contents (kg per box)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {Object.entries(csaForm.boxContents).map(([cat, kg]) => (
              <FormField key={cat} label={`${cropCategories[cat]?.icon || ''} ${cropCategories[cat]?.label || cat}`} style={{ flex: '1 1 120px', marginBottom: '4px' }}>
                <Input type="number" step="0.1" min="0" value={kg}
                  onChange={e => setCSAForm({ ...csaForm, boxContents: { ...csaForm.boxContents, [cat]: parseFloat(e.target.value) || 0 } })}
                />
              </FormField>
            ))}
          </div>
          <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '4px' }}>
            Total per box: {Object.values(csaForm.boxContents).reduce((s, v) => s + (parseFloat(v) || 0), 0).toFixed(1)} kg
          </div>
        </div>

        {parseInt(csaForm.boxesPerWeek) > 0 && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', background: theme.bgHover, border: `1px solid ${theme.borderLight}`, marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: theme.text, marginBottom: '4px' }}>📊 Season Estimate</div>
            {(() => {
              const boxes = parseInt(csaForm.boxesPerWeek) || 0;
              const cap = (csaForm.capacityPercent || 100) / 100;
              const totalPerBox = Object.values(csaForm.boxContents).reduce((s, v) => s + (parseFloat(v) || 0), 0);
              const kgPerWeek = totalPerBox * boxes * cap;
              const seasonWeeks = Math.max(1, (settings.firstFrostWeek - 2) - (settings.lastFrostWeek + 4) + 1);
              const totalKg = Math.round(kgPerWeek * seasonWeeks);
              return (
                <div style={{ fontSize: '12px', color: theme.textSecondary }}>
                  {kgPerWeek.toFixed(1)} kg/week × {seasonWeeks} weeks = <strong style={{ color: theme.accent }}>{totalKg} kg total</strong> (before loss margin)
                </div>
              );
            })()}
          </div>
        )}

        <FormField label="Notes">
          <Input value={csaForm.notes} onChange={e => setCSAForm({ ...csaForm, notes: e.target.value })} placeholder="Delivery logistics, pickup points..." />
        </FormField>

        {csaFormError && <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '8px' }}>{csaFormError}</div>}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <Button variant="ghost" onClick={() => setShowCSAModal(false)}>Cancel</Button>
          <Button onClick={saveCSA}>{editingCSA ? 'Update' : 'Create Scheme'}</Button>
        </div>
      </Modal>

      {/* Restaurant Modal */}
      <Modal open={showRestModal} onClose={() => setShowRestModal(false)} title={editingRest ? 'Edit Restaurant Contract' : 'Add Restaurant Contract'} width="600px">
        <div style={{ display: 'flex', gap: '12px' }}>
          <FormField label="Restaurant Name" style={{ flex: 2 }}>
            <Input value={restForm.name} onChange={e => setRestForm({ ...restForm, name: e.target.value })} placeholder="e.g. Café Verde" />
          </FormField>
          <FormField label="Contact (optional)" style={{ flex: 1 }}>
            <Input value={restForm.contactName} onChange={e => setRestForm({ ...restForm, contactName: e.target.value })} placeholder="Chef João" />
          </FormField>
        </div>

        <FormField label="Delivery Frequency">
          <Select value={restForm.deliveryFrequency} onChange={e => setRestForm({ ...restForm, deliveryFrequency: e.target.value })}>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="monthly">Monthly</option>
          </Select>
        </FormField>

        <div style={{ display: 'flex', gap: '12px' }}>
          <FormField label="Contract Start (optional)" style={{ flex: 1 }}>
            <Input type="date" value={restForm.startDate} onChange={e => setRestForm({ ...restForm, startDate: e.target.value })} />
          </FormField>
          <FormField label="Contract End (optional)" style={{ flex: 1 }}>
            <Input type="date" value={restForm.endDate} onChange={e => setRestForm({ ...restForm, endDate: e.target.value })} />
          </FormField>
        </div>
        <div style={{ fontSize: '11px', color: theme.textMuted, marginTop: '-8px', marginBottom: '12px' }}>
          Leave empty to use the full growing season
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: theme.text, marginBottom: '8px' }}>Weekly Order (kg per week)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {Object.entries(restForm.weeklyOrder).map(([cat, kg]) => (
              <FormField key={cat} label={`${cropCategories[cat]?.icon || ''} ${cropCategories[cat]?.label || cat}`} style={{ flex: '1 1 120px', marginBottom: '4px' }}>
                <Input type="number" step="0.1" min="0" value={kg}
                  onChange={e => setRestForm({ ...restForm, weeklyOrder: { ...restForm.weeklyOrder, [cat]: parseFloat(e.target.value) || 0 } })}
                />
              </FormField>
            ))}
          </div>
          <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '4px' }}>
            Total per week: {Object.values(restForm.weeklyOrder).reduce((s, v) => s + (parseFloat(v) || 0), 0).toFixed(1)} kg
          </div>
        </div>

        {/* Season estimate */}
        {Object.values(restForm.weeklyOrder).some(v => v > 0) && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', background: theme.bgHover, border: `1px solid ${theme.borderLight}`, marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: theme.text, marginBottom: '4px' }}>📊 Season Estimate</div>
            {(() => {
              const totalPerWeek = Object.values(restForm.weeklyOrder).reduce((s, v) => s + (parseFloat(v) || 0), 0);
              const seasonWeeks = Math.max(1, (settings.firstFrostWeek - 2) - (settings.lastFrostWeek + 4) + 1);
              const totalKg = Math.round(totalPerWeek * seasonWeeks);
              return (
                <div style={{ fontSize: '12px', color: theme.textSecondary }}>
                  {totalPerWeek.toFixed(1)} kg/week × {seasonWeeks} weeks = <strong style={{ color: '#e91e63' }}>{totalKg} kg total</strong> (before loss margin)
                </div>
              );
            })()}
          </div>
        )}

        <FormField label="Notes">
          <Input value={restForm.notes} onChange={e => setRestForm({ ...restForm, notes: e.target.value })} placeholder="Special requests, delivery times, parking..." />
        </FormField>

        {restFormError && <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '8px' }}>{restFormError}</div>}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <Button variant="ghost" onClick={() => setShowRestModal(false)}>Cancel</Button>
          <Button onClick={saveRest}>{editingRest ? 'Update' : 'Add Restaurant'}</Button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title={`Delete ${deleteConfirm?.type === 'csa' ? 'CSA Scheme' : deleteConfirm?.type === 'restaurant' ? 'Restaurant' : 'Event'}?`} width="400px">
        {deleteConfirm && (
          <div>
            <p style={{ margin: '0 0 16px', color: theme.textSecondary, fontSize: '14px' }}>
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This will also remove its demand from the season plan.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <button
                onClick={() => deleteConfirm.type === 'csa' ? removeCSA(deleteConfirm.id) : deleteConfirm.type === 'restaurant' ? removeRest(deleteConfirm.id) : remove(deleteConfirm.id)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#e53935', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}
              >Delete</button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}

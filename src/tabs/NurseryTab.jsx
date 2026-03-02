import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Card, Button, Badge, Select, Input, EmptyState } from '../components/shared';
import { bedArea, getCurrentWeek } from '../utils/helpers';
import { exportNurserySchedulePdf } from '../utils/pdfExport';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function weekToMonth(week) {
  const monthIdx = Math.min(11, Math.floor((week - 1) / 4.33));
  return MONTHS[monthIdx];
}

function weekToDate(week) {
  const monthIdx = Math.min(11, Math.floor((week - 1) / 4.33));
  const dayInMonth = Math.round(((week - 1) % 4.33) / 4.33 * 28) + 1;
  return `${MONTHS[monthIdx]} ${dayInMonth}`;
}

function generateCSV(headers, rows) {
  const escape = (v) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))];
  return lines.join('\n');
}

function downloadCSV(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function NurseryTab() {
  const { zones, crops, settings, selectedCropIds, cropSettings, updateState, theme, user } = useApp();
  const [filter, setFilter] = useState('');
  const [activeSection, setActiveSection] = useState('settings'); // settings | calendar | orders

  const headingFont = "'DM Serif Display', serif";
  const bodyFont = "'Libre Franklin', sans-serif";
  const year = settings.currentYear || new Date().getFullYear();
  const currentWeek = getCurrentWeek();

  // Get crops selected for season
  const seasonCrops = useMemo(() => {
    const ids = new Set(selectedCropIds || []);
    return crops.filter(c => ids.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [crops, selectedCropIds]);

  // Get all plantings for the current year
  const allPlantings = useMemo(() => {
    const result = [];
    for (const zone of zones) {
      for (const bed of zone.beds) {
        for (const p of (bed.plantings || [])) {
          if (p.year !== year) continue;
          const crop = crops.find(c => c.id === p.cropId);
          if (!crop) continue;
          result.push({ ...p, crop, bed, zone, area: bedArea(bed) * (p.bedFraction || 1) });
        }
      }
    }
    return result;
  }, [zones, crops, year]);

  // Helper to get crop settings with smart defaults
  const getCropSetting = (cropId) => {
    const saved = cropSettings[cropId] || {};
    const crop = crops.find(c => c.id === cropId);
    return {
      propagation: saved.propagation || (crop?.season === 'warm' ? 'transplant' : 'direct-sow'),
      seedlingSource: saved.seedlingSource || 'farm',
      seedSource: saved.seedSource || 'purchased',
    };
  };

  const updateCropSetting = (cropId, field, value) => {
    updateState(prev => ({
      ...prev,
      cropSettings: {
        ...prev.cropSettings,
        [cropId]: {
          ...(prev.cropSettings[cropId] || {}),
          [field]: value,
        },
      },
    }));
  };

  // Build sowing calendar entries
  const calendarEntries = useMemo(() => {
    const entries = [];
    for (const p of allPlantings) {
      const cs = getCropSetting(p.cropId);
      const startWeek = p.startWeek || 10;
      const cellWeeks = p.crop.daysInCell
        ? Math.ceil(p.crop.daysInCell / 7)
        : Math.ceil((p.crop.daysToMaturity || 60) / 7 / 2);
      const indoorStart = Math.max(1, startWeek - cellWeeks);

      if (cs.propagation === 'transplant') {
        entries.push({
          week: indoorStart,
          type: 'sow-indoor',
          crop: p.crop,
          bed: p.bed.name,
          zone: p.zone.name,
          source: cs.seedlingSource,
          seedSource: cs.seedSource,
          area: p.area,
          fraction: p.bedFraction || 1,
        });
        entries.push({
          week: startWeek,
          type: 'transplant',
          crop: p.crop,
          bed: p.bed.name,
          zone: p.zone.name,
          source: cs.seedlingSource,
          seedSource: cs.seedSource,
          area: p.area,
          fraction: p.bedFraction || 1,
        });
      } else {
        entries.push({
          week: startWeek,
          type: 'direct-sow',
          crop: p.crop,
          bed: p.bed.name,
          zone: p.zone.name,
          source: 'farm',
          seedSource: cs.seedSource,
          area: p.area,
          fraction: p.bedFraction || 1,
        });
      }
    }
    return entries.sort((a, b) => a.week - b.week);
  }, [allPlantings, cropSettings]);

  // Group calendar by month
  const calendarByMonth = useMemo(() => {
    const grouped = {};
    for (const e of calendarEntries) {
      const m = weekToMonth(e.week);
      if (!grouped[m]) grouped[m] = [];
      grouped[m].push(e);
    }
    return grouped;
  }, [calendarEntries]);

  // Build order lists
  const seedOrders = useMemo(() => {
    const map = {};
    for (const p of allPlantings) {
      const cs = getCropSetting(p.cropId);
      if (cs.seedSource !== 'purchased') continue;
      if (!map[p.cropId]) {
        map[p.cropId] = { crop: p.crop, totalArea: 0, earliestWeek: 52, plantings: 0, propagation: cs.propagation };
      }
      map[p.cropId].totalArea += p.area;
      map[p.cropId].earliestWeek = Math.min(map[p.cropId].earliestWeek, p.startWeek || 10);
      map[p.cropId].plantings += 1;
    }
    return Object.values(map).sort((a, b) => a.earliestWeek - b.earliestWeek);
  }, [allPlantings, cropSettings]);

  const nurseryOrders = useMemo(() => {
    const map = {};
    for (const p of allPlantings) {
      const cs = getCropSetting(p.cropId);
      if (cs.propagation !== 'transplant' || cs.seedlingSource !== 'nursery') continue;
      if (!map[p.cropId]) {
        map[p.cropId] = { crop: p.crop, totalArea: 0, earliestWeek: 52, plantings: 0 };
      }
      map[p.cropId].totalArea += p.area;
      map[p.cropId].earliestWeek = Math.min(map[p.cropId].earliestWeek, p.startWeek || 10);
      map[p.cropId].plantings += 1;
    }
    return Object.values(map).sort((a, b) => a.earliestWeek - b.earliestWeek);
  }, [allPlantings, cropSettings]);

  // Calculate plant/seed quantities
  const calcPlantCount = (crop, area) => {
    const spacingM = (crop.spacing || 30) / 100;
    const rowSpacingM = (crop.rowSpacing || 30) / 100;
    return Math.ceil(area / (spacingM * rowSpacingM));
  };

  const calcSeedCount = (crop, area) => {
    const plants = calcPlantCount(crop, area);
    const germRate = crop.germinationRate || 0.8;
    return Math.ceil(plants / germRate);
  };

  const calcSeedWeight = (crop, area) => {
    const seeds = calcSeedCount(crop, area);
    const spg = crop.seedsPerGram || 100;
    return (seeds / spg).toFixed(1);
  };

  // Export handlers
  const handleExportSeeds = () => {
    const headers = ['Crop', 'Family', 'Propagation', 'Area (m²)', 'Seeds Needed', 'Weight (g)', 'Order By (Week)', 'Order By (Date)'];
    const rows = seedOrders.map(o => {
      const orderWeek = o.propagation === 'transplant'
        ? Math.max(1, o.earliestWeek - Math.ceil((o.crop.daysToMaturity || 60) / 7 / 2) - 2)
        : Math.max(1, o.earliestWeek - 2);
      return [
        o.crop.name, o.crop.family, o.propagation,
        o.totalArea.toFixed(1), calcSeedCount(o.crop, o.totalArea),
        calcSeedWeight(o.crop, o.totalArea), `W${orderWeek}`, weekToDate(orderWeek),
      ];
    });
    downloadCSV(`biogrow-seed-orders-${year}.csv`, generateCSV(headers, rows));
  };

  const handleExportNursery = () => {
    const headers = ['Crop', 'Family', 'Plants Needed', 'Area (m²)', 'Delivery By (Week)', 'Delivery By (Date)'];
    const rows = nurseryOrders.map(o => {
      const deliveryWeek = Math.max(1, o.earliestWeek - 1);
      return [
        o.crop.name, o.crop.family, calcPlantCount(o.crop, o.totalArea),
        o.totalArea.toFixed(1), `W${deliveryWeek}`, weekToDate(deliveryWeek),
      ];
    });
    downloadCSV(`biogrow-nursery-orders-${year}.csv`, generateCSV(headers, rows));
  };

  // Filtered season crops
  const filteredCrops = useMemo(() => {
    if (!filter.trim()) return seasonCrops;
    const q = filter.toLowerCase();
    return seasonCrops.filter(c =>
      c.name.toLowerCase().includes(q) || c.family.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
    );
  }, [seasonCrops, filter]);

  const sectionBtnStyle = (active) => ({
    padding: '8px 16px',
    borderRadius: '8px',
    border: `1.5px solid ${active ? theme.accent : theme.border}`,
    background: active ? theme.accentLight : 'transparent',
    color: active ? theme.accent : theme.textSecondary,
    fontWeight: active ? '700' : '500',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: bodyFont,
    transition: 'all 0.2s',
  });

  const typeIcons = {
    'sow-indoor': '🏠',
    'direct-sow': '🌱',
    'transplant': '🪴',
  };

  const typeLabels = {
    'sow-indoor': 'Sow Indoors',
    'direct-sow': 'Direct Sow',
    'transplant': 'Transplant Out',
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 4px', fontFamily: headingFont, color: theme.text, fontSize: '22px' }}>
          🪴 Nursery & Orders
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: theme.textMuted, fontFamily: bodyFont }}>
          Track propagation methods, view sowing schedules, and export order lists for seeds and seedlings.
        </p>
      </div>

      {/* Section Nav */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button onClick={() => setActiveSection('settings')} style={sectionBtnStyle(activeSection === 'settings')}>
          ⚙️ Propagation Settings
        </button>
        <button onClick={() => setActiveSection('calendar')} style={sectionBtnStyle(activeSection === 'calendar')}>
          📅 Sowing Calendar
        </button>
        <button onClick={() => setActiveSection('orders')} style={sectionBtnStyle(activeSection === 'orders')}>
          📦 Order Lists
        </button>
      </div>

      {/* Empty state */}
      {seasonCrops.length === 0 && (
        <EmptyState icon="🌾" message="No crops selected for this season. Go to the Crops tab and select crops first." />
      )}

      {seasonCrops.length > 0 && activeSection === 'settings' && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, fontFamily: headingFont, color: theme.text, fontSize: '16px' }}>
              Propagation Settings
            </h3>
            <Input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter crops..."
              style={{ width: '200px', fontSize: '12px' }}
            />
          </div>
          <p style={{ margin: '0 0 12px', fontSize: '12px', color: theme.textMuted }}>
            Set how each crop is propagated. This determines your sowing calendar and order lists.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>
                  {['Crop', 'Season', 'Propagation', 'Seedling Source', 'Seed Source'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '8px 10px', borderBottom: `2px solid ${theme.border}`,
                      color: theme.textSecondary, fontSize: '10px', textTransform: 'uppercase',
                      fontWeight: '600', fontFamily: bodyFont, whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCrops.map(crop => {
                  const cs = getCropSetting(crop.id);
                  return (
                    <tr key={crop.id} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
                      <td style={{ padding: '6px 10px', fontWeight: '500', color: theme.text }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '14px' }}>{crop.icon}</span>
                          {crop.name}
                        </span>
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        <Badge
                          bg={crop.season === 'warm' ? '#fff3e0' : '#e3f2fd'}
                          color={crop.season === 'warm' ? '#e65100' : '#1565c0'}
                        >
                          {crop.season}
                        </Badge>
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        <select
                          value={cs.propagation}
                          onChange={e => updateCropSetting(crop.id, 'propagation', e.target.value)}
                          style={{
                            padding: '4px 8px', borderRadius: '6px', border: `1px solid ${theme.border}`,
                            background: theme.bg, color: theme.text, fontSize: '12px', fontFamily: bodyFont,
                          }}
                        >
                          <option value="direct-sow">🌱 Direct Sow</option>
                          <option value="transplant">🪴 Transplant</option>
                        </select>
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        {cs.propagation === 'transplant' ? (
                          <select
                            value={cs.seedlingSource}
                            onChange={e => updateCropSetting(crop.id, 'seedlingSource', e.target.value)}
                            style={{
                              padding: '4px 8px', borderRadius: '6px', border: `1px solid ${theme.border}`,
                              background: theme.bg, color: theme.text, fontSize: '12px', fontFamily: bodyFont,
                            }}
                          >
                            <option value="farm">🏠 Farm (start from seed)</option>
                            <option value="nursery">🏪 External Nursery</option>
                          </select>
                        ) : (
                          <span style={{ color: theme.textMuted, fontSize: '11px' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        <select
                          value={cs.seedSource}
                          onChange={e => updateCropSetting(crop.id, 'seedSource', e.target.value)}
                          style={{
                            padding: '4px 8px', borderRadius: '6px', border: `1px solid ${theme.border}`,
                            background: theme.bg, color: theme.text, fontSize: '12px', fontFamily: bodyFont,
                          }}
                        >
                          <option value="own">🌻 Own / Saved</option>
                          <option value="purchased">🛒 Purchased</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '12px', fontSize: '11px', color: theme.textMuted }}>
            Showing {filteredCrops.length} of {seasonCrops.length} selected crops
          </div>
        </Card>
      )}

      {seasonCrops.length > 0 && activeSection === 'calendar' && (
        <Card>
          <h3 style={{ margin: '0 0 4px', fontFamily: headingFont, color: theme.text, fontSize: '16px' }}>
            📅 Sowing Calendar — {year}
          </h3>
          <p style={{ margin: '0 0 16px', fontSize: '12px', color: theme.textMuted }}>
            When to sow, transplant, and direct-sow based on your current plantings and propagation settings.
          </p>

          {(() => {
            const pastDue = calendarEntries.filter(e => e.week < currentWeek && currentWeek - e.week <= 4);
            const imminent = calendarEntries.filter(e => e.week >= currentWeek && e.week - currentWeek <= 2);
            if (pastDue.length === 0 && imminent.length === 0) return null;
            return (
              <div style={{
                display: 'flex', gap: '12px', flexWrap: 'wrap',
                padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
                background: pastDue.length > 0 ? (theme.errorLight || '#ffebee') : '#fff3e0',
                border: `1px solid ${pastDue.length > 0 ? (theme.error || '#d32f2f') : (theme.warning || '#f57c00')}`,
                fontSize: '13px', fontWeight: '600',
              }}>
                {pastDue.length > 0 && (
                  <span style={{ color: theme.error || '#d32f2f' }}>🚨 {pastDue.length} past due</span>
                )}
                {imminent.length > 0 && (
                  <span style={{ color: theme.warning || '#f57c00' }}>⏰ {imminent.length} due within 2 weeks</span>
                )}
              </div>
            );
          })()}

          {calendarEntries.length === 0 ? (
            <EmptyState icon="📅" message="No plantings found for this year. Add plantings to beds first." />
          ) : (
            Object.entries(calendarByMonth).map(([month, entries]) => (
              <div key={month} style={{ marginBottom: '16px' }}>
                <div style={{
                  fontWeight: '700', fontSize: '14px', color: theme.text,
                  fontFamily: headingFont, marginBottom: '8px',
                  padding: '6px 12px', borderRadius: '6px',
                  background: theme.accentLight,
                  display: 'inline-block',
                }}>
                  {month}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {entries.map((e, i) => {
                    const isPastDue = e.week < currentWeek && currentWeek - e.week <= 4;
                    const isThisWeek = e.week === currentWeek;
                    const isImminent = e.week > currentWeek && e.week - currentWeek <= 2;
                    const entryBg = isPastDue ? (theme.errorLight || '#ffebee')
                      : isThisWeek ? '#fff3e0'
                      : isImminent ? '#fffde7'
                      : (theme.bgHover || theme.bg);
                    const entryBorder = isPastDue ? `1px solid ${theme.error || '#d32f2f'}`
                      : isThisWeek ? `1px solid ${theme.warning || '#f57c00'}`
                      : `1px solid ${theme.borderLight}`;
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '6px 12px', borderRadius: '6px',
                        background: entryBg,
                        border: entryBorder,
                        fontSize: '12px',
                      }}>
                        <span style={{ fontSize: '16px' }}>{typeIcons[e.type]}</span>
                        <span style={{ fontWeight: '600', color: theme.text, minWidth: '90px' }}>
                          W{e.week} — {weekToDate(e.week)}
                        </span>
                        <span style={{ fontWeight: '500', color: theme.text }}>
                          {e.crop.icon} {e.crop.name}
                        </span>
                        <Badge
                          bg={e.type === 'sow-indoor' ? '#e3f2fd' : e.type === 'transplant' ? '#e8f5e9' : '#fff3e0'}
                          color={e.type === 'sow-indoor' ? '#1565c0' : e.type === 'transplant' ? '#2e7d32' : '#e65100'}
                        >
                          {typeLabels[e.type]}
                        </Badge>
                        {isPastDue && (
                          <Badge bg={theme.error || '#d32f2f'} color="#fff">MISSED</Badge>
                        )}
                        {isThisWeek && (
                          <Badge bg={theme.warning || '#f57c00'} color="#fff">THIS WEEK</Badge>
                        )}
                        {isImminent && (
                          <Badge bg="#fbc02d" color="#fff">IN {e.week - currentWeek}W</Badge>
                        )}
                        {e.source === 'nursery' && (
                          <Badge bg="#fce4ec" color="#c62828">🏪 Nursery</Badge>
                        )}
                        {e.fraction < 1 && (
                          <Badge bg={theme.accentLight} color={theme.accent}>
                            {e.fraction === 0.5 ? '½' : '¼'} bed
                          </Badge>
                        )}
                        <span style={{ color: theme.textMuted, marginLeft: 'auto', fontSize: '11px' }}>
                          → {e.bed} ({e.zone})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </Card>
      )}

      {seasonCrops.length > 0 && activeSection === 'orders' && (
        <>
          {/* Seed Orders */}
          <Card style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ margin: 0, fontFamily: headingFont, color: theme.text, fontSize: '16px' }}>
                🌱 Seeds to Purchase
              </h3>
              {seedOrders.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <Button onClick={handleExportSeeds} style={{ fontSize: '12px', padding: '6px 14px' }}>
                    📥 Export CSV
                  </Button>
                  <Button variant="secondary" onClick={() => exportNurserySchedulePdf({ zones, crops, settings, user })} style={{ fontSize: '12px', padding: '6px 14px' }}>
                    📄 PDF
                  </Button>
                </div>
              )}
            </div>
            {seedOrders.length === 0 ? (
              <p style={{ fontSize: '13px', color: theme.textMuted }}>
                No seeds to purchase. All crops use own/saved seeds, or no plantings exist yet.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      {['Crop', 'Method', 'Area', 'Seeds Needed', 'Weight', 'Order By'].map(h => (
                        <th key={h} style={{
                          textAlign: 'left', padding: '8px 10px', borderBottom: `2px solid ${theme.border}`,
                          color: theme.textSecondary, fontSize: '10px', textTransform: 'uppercase',
                          fontWeight: '600', fontFamily: bodyFont, whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {seedOrders.map(o => {
                      const orderWeek = o.propagation === 'transplant'
                        ? Math.max(1, o.earliestWeek - Math.ceil((o.crop.daysToMaturity || 60) / 7 / 2) - 2)
                        : Math.max(1, o.earliestWeek - 2);
                      return (
                        <tr key={o.crop.id} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
                          <td style={{ padding: '6px 10px', fontWeight: '500', color: theme.text }}>
                            {o.crop.icon} {o.crop.name}
                          </td>
                          <td style={{ padding: '6px 10px', color: theme.textSecondary }}>
                            {o.propagation === 'transplant' ? '🪴 Transplant' : '🌱 Direct'}
                          </td>
                          <td style={{ padding: '6px 10px', color: theme.text }}>
                            {o.totalArea.toFixed(1)} m²
                          </td>
                          <td style={{ padding: '6px 10px', color: theme.text, fontWeight: '600' }}>
                            {calcSeedCount(o.crop, o.totalArea).toLocaleString()}
                          </td>
                          <td style={{ padding: '6px 10px', color: theme.textSecondary }}>
                            {calcSeedWeight(o.crop, o.totalArea)} g
                          </td>
                          <td style={{ padding: '6px 10px', color: theme.text }}>
                            W{orderWeek} ({weekToDate(orderWeek)})
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Nursery Orders */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ margin: 0, fontFamily: headingFont, color: theme.text, fontSize: '16px' }}>
                🏪 Nursery Orders (Seedlings)
              </h3>
              {nurseryOrders.length > 0 && (
                <Button onClick={handleExportNursery} style={{ fontSize: '12px', padding: '6px 14px' }}>
                  📥 Export CSV
                </Button>
              )}
            </div>
            {nurseryOrders.length === 0 ? (
              <p style={{ fontSize: '13px', color: theme.textMuted }}>
                No nursery orders needed. All transplants are farm-raised, or no crops use external nurseries.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      {['Crop', 'Family', 'Area', 'Plants Needed', 'Deliver By'].map(h => (
                        <th key={h} style={{
                          textAlign: 'left', padding: '8px 10px', borderBottom: `2px solid ${theme.border}`,
                          color: theme.textSecondary, fontSize: '10px', textTransform: 'uppercase',
                          fontWeight: '600', fontFamily: bodyFont, whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {nurseryOrders.map(o => {
                      const deliveryWeek = Math.max(1, o.earliestWeek - 1);
                      return (
                        <tr key={o.crop.id} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
                          <td style={{ padding: '6px 10px', fontWeight: '500', color: theme.text }}>
                            {o.crop.icon} {o.crop.name}
                          </td>
                          <td style={{ padding: '6px 10px', color: theme.textSecondary }}>
                            {o.crop.family}
                          </td>
                          <td style={{ padding: '6px 10px', color: theme.text }}>
                            {o.totalArea.toFixed(1)} m²
                          </td>
                          <td style={{ padding: '6px 10px', color: theme.text, fontWeight: '600' }}>
                            {calcPlantCount(o.crop, o.totalArea).toLocaleString()}
                          </td>
                          <td style={{ padding: '6px 10px', color: theme.text }}>
                            W{deliveryWeek} ({weekToDate(deliveryWeek)})
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

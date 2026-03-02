import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Card } from '../components/shared';
import { getCurrentWeek, bedArea } from '../utils/helpers';
import { cropCategories, mealProfiles } from '../data/mealProfiles';
import { aggregateDemand, aggregateManualDemand, mergeDemandMaps } from '../utils/demandEngine';
import { analyzeTimingAlerts } from '../utils/timingAlerts';
import YearSelector from '../components/YearSelector';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function ScheduleTab() {
  const { zones, crops, settings, events: farmEvents, selectedCropIds, manualDemandEntries, demandPlan, theme } = useApp();
  const [viewYear, setViewYear] = useState(settings.currentYear || new Date().getFullYear());
  const currentWeek = getCurrentWeek();
  const events = farmEvents || [];

  // Build event lookup for linking plantings back to events
  const eventMap = useMemo(() => {
    const map = {};
    events.forEach(e => { map[e.id] = e; });
    return map;
  }, [events]);

  const plantings = useMemo(() => {
    const result = [];
    zones.forEach(zone => {
      zone.beds.forEach(bed => {
        (bed.plantings || []).forEach(p => {
          if (p.year !== viewYear) return;
          const crop = crops.find(c => c.id === p.cropId);
          if (!crop) return;
          const startWeek = p.startWeek || 10;
          const cellWeeks = crop.daysInCell
            ? Math.ceil(crop.daysInCell / 7)
            : Math.ceil((crop.daysToMaturity || 60) / 7 / 2);
          const indoorStart = Math.max(1, startWeek - cellWeeks);
          const growEnd = startWeek + Math.ceil((crop.daysToMaturity || 60) / 7);
          const harvestWeeks = crop.harvestWindow ? Math.ceil(crop.harvestWindow / 7) : 4;
          const harvestEnd = Math.min(52, growEnd + harvestWeeks);
          const fractionLabel = (p.bedFraction || 1) < 1
            ? (p.bedFraction === 0.5 ? ' (\u00bd)' : ' (\u00bc)')
            : '';
          const source = p.source || 'manual';
          const linkedEvents = (p.eventIds || [])
            .map(eid => eventMap[eid])
            .filter(Boolean);
          result.push({
            id: p.id,
            name: `${crop.icon} ${crop.name}${fractionLabel}`,
            bed: bed.name,
            zone: zone.name,
            crop,
            startWeek,
            indoorStart: crop.season === 'warm' ? indoorStart : null,
            growEnd,
            harvestEnd,
            plantCount: p.plantCount || '\u2014',
            source,
            linkedEvents,
            bedFraction: p.bedFraction || 1,
            bedArea: bedArea(bed),
          });
        });
      });
    });
    return result.sort((a, b) => a.startWeek - b.startWeek);
  }, [zones, crops, viewYear, eventMap]);

  // Timing alert lookup by planting id
  const alertsByPlanting = useMemo(() => {
    const mapped = plantings.map(p => ({ cropId: p.crop.id, startWeek: p.startWeek, id: p.id }));
    const alerts = analyzeTimingAlerts(mapped, crops, settings, currentWeek);
    const byId = {};
    for (const a of alerts) {
      if (!a.plantingId) continue;
      if (!byId[a.plantingId]) byId[a.plantingId] = [];
      byId[a.plantingId].push(a);
    }
    return byId;
  }, [plantings, crops, settings, currentWeek]);

  // Demand coverage: compare demand per category vs what's actually planted
  const demandCoverage = useMemo(() => {
    const lossMargin = demandPlan?.lossMargin ?? 0.30;
    const eventDemandMap = aggregateDemand(events, mealProfiles, lossMargin);
    const manualDemandMap = aggregateManualDemand(manualDemandEntries || [], crops, settings, viewYear);
    const merged = mergeDemandMaps(eventDemandMap, manualDemandMap);

    const coverage = [];
    for (const [cat, demand] of Object.entries(merged)) {
      if (demand.totalKg <= 0) continue;
      const catInfo = cropCategories[cat];
      if (!catInfo) continue;

      // Check if farm has selected crops for this category
      const eligible = crops.filter(c => {
        if (c.category !== cat) return false;
        if (selectedCropIds && selectedCropIds.length > 0 && !selectedCropIds.includes(c.id)) return false;
        return true;
      });
      if (eligible.length === 0) continue;

      // Count planted area and beds for this category
      let plantedArea = 0;
      let bedCount = 0;
      const plantedCrops = new Set();
      plantings.forEach(p => {
        if (p.crop.category === cat) {
          plantedArea += p.bedArea * p.bedFraction;
          bedCount++;
          plantedCrops.add(p.crop.name);
        }
      });

      // Estimate planned kg from area (avg yield of eligible crops)
      const avgYield = eligible.reduce((s, c) => s + (c.yieldPerM2 || 1), 0) / eligible.length;
      const plannedKg = Math.round(plantedArea * avgYield * 10) / 10;

      coverage.push({
        category: cat,
        label: catInfo.label,
        icon: catInfo.icon,
        color: catInfo.color,
        demandKg: Math.round(demand.totalKg * 10) / 10,
        plannedKg,
        plantedArea: Math.round(plantedArea * 10) / 10,
        bedCount,
        cropNames: [...plantedCrops],
        coveragePct: demand.totalKg > 0 ? Math.round((plannedKg / demand.totalKg) * 100) : 0,
      });
    }
    return coverage;
  }, [events, manualDemandEntries, crops, settings, viewYear, demandPlan, selectedCropIds, plantings]);

  const weekLabels = useMemo(() => {
    const labels = [];
    for (let w = 1; w <= 52; w++) {
      const monthIdx = Math.min(11, Math.floor((w - 1) / 4.33));
      const isFirst = w === 1 || Math.floor((w - 2) / 4.33) !== monthIdx;
      labels.push({ week: w, month: isFirst ? MONTHS[monthIdx] : null });
    }
    return labels;
  }, []);

  // Stats
  const demandCount = plantings.filter(p => p.source === 'demand').length;
  const manualCount = plantings.filter(p => p.source === 'manual').length;

  const cellW = 16;
  const labelW = 220;
  const totalW = labelW + 52 * cellW + 40;

  const sourceIcon = (source) => source === 'demand' ? '\uD83C\uDFAF' : '\u270B';
  const sourceColor = (source) => source === 'demand' ? theme.accent : theme.warning;

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontFamily: "'DM Serif Display', serif", fontSize: '18px', color: theme.text }}>
          Season Schedule {'\u2014'} {viewYear}
        </h2>
        <YearSelector value={viewYear} onChange={setViewYear} />
      </div>

      {plantings.length === 0 ? (
        <Card>
          <p style={{ color: theme.textMuted, textAlign: 'center', padding: '20px' }}>No plantings scheduled yet. Add plantings in the Beds tab or generate a Season Plan to see your schedule.</p>
        </Card>
      ) : (
        <>
          {/* Source summary badges */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {demandCount > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', borderRadius: '8px',
                background: `${theme.accent}15`, border: `1px solid ${theme.accent}30`,
                fontSize: '13px', color: theme.text,
              }}>
                <span>{'\uD83C\uDFAF'}</span>
                <span><strong>{demandCount}</strong> from Season Plan</span>
              </div>
            )}
            {manualCount > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', borderRadius: '8px',
                background: `${theme.warning}15`, border: `1px solid ${theme.warning}30`,
                fontSize: '13px', color: theme.text,
              }}>
                <span>{'\u270B'}</span>
                <span><strong>{manualCount}</strong> manual</span>
              </div>
            )}
          </div>

          {/* Demand Coverage Summary */}
          {demandCoverage.length > 0 && (
            <Card style={{ marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 12px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '16px' }}>
                Demand Coverage
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                {demandCoverage.map(c => (
                  <div key={c.category} style={{
                    padding: '12px', borderRadius: '8px',
                    border: `1px solid ${theme.borderLight}`,
                    background: theme.cardBg || theme.background,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: theme.text }}>
                        {c.icon} {c.label}
                      </span>
                      <span style={{
                        fontSize: '12px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px',
                        background: c.coveragePct >= 80 ? '#4caf5020' : c.coveragePct >= 50 ? '#ff980020' : '#e5393520',
                        color: c.coveragePct >= 80 ? '#4caf50' : c.coveragePct >= 50 ? '#ff9800' : '#e53935',
                      }}>
                        {c.coveragePct}%
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div style={{ height: '6px', borderRadius: '3px', background: `${theme.border}40`, marginBottom: '8px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: '3px',
                        width: `${Math.min(100, c.coveragePct)}%`,
                        background: c.color,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                    <div style={{ fontSize: '12px', color: theme.textSecondary, lineHeight: '1.6' }}>
                      <div>Demand: <strong style={{ color: theme.text }}>{c.demandKg} kg</strong> &rarr; Planned: <strong style={{ color: theme.text }}>{c.plannedKg} kg</strong></div>
                      <div>{c.bedCount} bed{c.bedCount !== 1 ? 's' : ''} &middot; {c.plantedArea} m&sup2; &middot; {c.cropNames.length > 0 ? c.cropNames.join(', ') : 'none allocated'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Gantt chart */}
          <Card style={{ overflowX: 'auto', marginBottom: '24px' }}>
            <div style={{ minWidth: `${totalW}px` }}>
              {/* Month headers */}
              <div style={{ display: 'flex', marginLeft: `${labelW}px` }}>
                {weekLabels.map(wl => (
                  <div key={wl.week} style={{ width: `${cellW}px`, flexShrink: 0, fontSize: '10px', color: theme.textMuted, textAlign: 'center' }}>
                    {wl.month || ''}
                  </div>
                ))}
              </div>

              {/* Week numbers */}
              <div style={{ display: 'flex', marginLeft: `${labelW}px`, borderBottom: `1px solid ${theme.borderLight}`, paddingBottom: '4px', marginBottom: '4px' }}>
                {weekLabels.map(wl => (
                  <div key={wl.week} style={{
                    width: `${cellW}px`,
                    flexShrink: 0,
                    fontSize: '8px',
                    color: wl.week === currentWeek ? theme.accent : theme.textMuted,
                    textAlign: 'center',
                    fontWeight: wl.week === currentWeek ? '700' : '400',
                  }}>
                    {wl.week % 4 === 1 ? wl.week : ''}
                  </div>
                ))}
              </div>

              {/* Rows */}
              {plantings.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', height: '28px', borderBottom: `1px solid ${theme.borderLight}` }}>
                  {/* Label with source indicator + alert dot */}
                  <div style={{ width: `${labelW}px`, flexShrink: 0, fontSize: '11px', color: theme.text, paddingRight: '8px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {(() => {
                      const pAlerts = alertsByPlanting[p.id];
                      if (pAlerts && pAlerts.length > 0) {
                        const worst = pAlerts.find(a => a.severity === 'critical') ? 'critical' : 'urgent';
                        const dotColor = worst === 'critical' ? (theme.error || '#d32f2f') : (theme.warning || '#f57c00');
                        return <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} title={pAlerts.map(a => a.message).join('; ')} />;
                      }
                      return null;
                    })()}
                    <span style={{ fontSize: '9px', flexShrink: 0 }} title={p.source === 'demand' ? 'From Season Plan' : 'Manual planting'}>
                      {sourceIcon(p.source)}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name} <span style={{ color: theme.textMuted }}>({p.bed})</span>
                    </span>
                  </div>
                  {/* Bars */}
                  <div style={{ display: 'flex', position: 'relative', flex: 1, height: '100%', alignItems: 'center' }}>
                    {Array.from({ length: 52 }, (_, i) => {
                      const w = i + 1;
                      let bg = 'transparent';
                      let borderStyle = 'none';

                      if (p.indoorStart && w >= p.indoorStart && w < p.startWeek) {
                        bg = 'transparent';
                        borderStyle = `1px dashed ${sourceColor(p.source)}`;
                      } else if (w >= p.startWeek && w <= p.growEnd) {
                        bg = sourceColor(p.source);
                      } else if (w > p.growEnd && w <= p.harvestEnd) {
                        bg = `repeating-linear-gradient(45deg, ${sourceColor(p.source)}, ${sourceColor(p.source)} 2px, transparent 2px, transparent 4px)`;
                      }

                      return (
                        <div key={w} style={{
                          width: `${cellW}px`,
                          height: '14px',
                          flexShrink: 0,
                          background: bg,
                          border: borderStyle,
                          borderRadius: w === p.startWeek ? '3px 0 0 3px' : w === p.harvestEnd ? '0 3px 3px 0' : 0,
                          boxSizing: 'border-box',
                        }} />
                      );
                    })}
                    {/* Current week line */}
                    <div style={{
                      position: 'absolute',
                      left: `${(currentWeek - 1) * cellW + cellW / 2}px`,
                      top: 0,
                      bottom: 0,
                      width: '2px',
                      background: '#e53935',
                      zIndex: 2,
                    }} />
                  </div>
                </div>
              ))}

              {/* Legend */}
              <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '11px', color: theme.textSecondary, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '16px', height: '8px', border: `1px dashed ${theme.accent}`, display: 'inline-block' }} /> Indoor Sowing
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '16px', height: '8px', background: theme.accent, display: 'inline-block', borderRadius: '2px' }} /> Growing
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '16px', height: '8px', background: `repeating-linear-gradient(45deg, ${theme.accent}, ${theme.accent} 2px, transparent 2px, transparent 4px)`, display: 'inline-block', borderRadius: '2px' }} /> Harvest
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '2px', height: '12px', background: '#e53935', display: 'inline-block' }} /> Current Week
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {'\uD83C\uDFAF'} Season Plan
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {'\u270B'} Manual
                </span>
              </div>
            </div>
          </Card>

          {/* Planting list table */}
          <Card>
            <h3 style={{ margin: '0 0 12px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '16px' }}>All Plantings</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: "'Libre Franklin', sans-serif" }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${theme.border}` }}>
                  {['Crop', 'Bed', 'Zone', 'Source', 'Start Week', 'Harvest Week', 'Status', 'Plants'].map(h => (
                    <th key={h} style={{ padding: '8px', textAlign: 'left', color: theme.textSecondary, fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plantings.map(p => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
                    <td style={{ padding: '8px', color: theme.text }}>{p.name}</td>
                    <td style={{ padding: '8px', color: theme.textSecondary }}>{p.bed}</td>
                    <td style={{ padding: '8px', color: theme.textSecondary }}>{p.zone}</td>
                    <td style={{ padding: '8px' }}>
                      {p.source === 'demand' ? (
                        <div>
                          <span style={{ fontSize: '11px', color: theme.accent, fontWeight: '600' }}>
                            {'\uD83C\uDFAF'} Plan
                          </span>
                          {p.linkedEvents.length > 0 && (
                            <div style={{ fontSize: '10px', color: theme.textMuted, marginTop: '2px' }}>
                              {p.linkedEvents.map(e => e.title || e.name || 'Event').join(', ')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '11px', color: theme.warning, fontWeight: '600' }}>
                          {'\u270B'} Manual
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '8px', color: theme.accent, fontWeight: '600' }}>W{p.startWeek}</td>
                    <td style={{ padding: '8px', color: theme.warning, fontWeight: '600' }}>W{p.growEnd}{'\u2013'}W{p.harvestEnd}</td>
                    <td style={{ padding: '8px' }}>
                      {(() => {
                        const pAlerts = alertsByPlanting[p.id];
                        if (!pAlerts || pAlerts.length === 0) return <span style={{ fontSize: '11px', color: theme.success || '#388e3c', fontWeight: '600' }}>OK</span>;
                        const hasCritical = pAlerts.some(a => a.severity === 'critical');
                        if (hasCritical) return <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: theme.errorLight || '#ffebee', color: theme.error || '#d32f2f', fontWeight: '700' }}>MISSED</span>;
                        return <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#fff3e0', color: theme.warning || '#f57c00', fontWeight: '700' }}>ALERT</span>;
                      })()}
                    </td>
                    <td style={{ padding: '8px', color: theme.textSecondary }}>{p.plantCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

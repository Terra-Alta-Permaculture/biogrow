import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Card, SummaryCard, Select, FormField } from '../components/shared';
import { soilTypes } from '../data/farm';
import { fetchWeatherData, parseDailyForecast } from '../utils/weatherService';

const DROUGHT_ICONS = { low: '💧💧💧', medium: '💧💧', high: '💧' };

export default function IrrigationTab() {
  const { zones, crops, settings, updateState, theme } = useApp();
  const [weatherET0, setWeatherET0] = useState(null);
  const [weeklyRain, setWeeklyRain] = useState(0);

  const soil = soilTypes.find(s => s.id === (settings.soilType || 'loam')) || soilTypes[2];

  useEffect(() => {
    if (settings.location?.lat && settings.location?.lng) {
      fetchWeatherData(settings.location.lat, settings.location.lng)
        .then(({ data }) => {
          const days = parseDailyForecast(data).slice(0, 7);
          const et0 = days.reduce((s, d) => s + (d.et0 || 0), 0);
          const rain = days.reduce((s, d) => s + (d.rain || 0), 0);
          setWeatherET0(et0);
          setWeeklyRain(rain);
        })
        .catch(() => {});
    }
  }, [settings.location?.lat, settings.location?.lng]);

  const bedCalcs = useMemo(() => {
    const results = [];
    zones.forEach(zone => {
      zone.beds.forEach(bed => {
        if (bed.plantings.length === 0) return;
        bed.plantings.forEach(planting => {
          const crop = crops.find(c => c.id === planting.cropId);
          if (!crop) return;
          const area = bed.width * bed.length;
          const kc = crop.kcCoeff || 1.0;
          const dailyET0 = weatherET0 ? weatherET0 / 7 : 4;
          const dailyCropDemand = dailyET0 * kc;
          const weeklyNeed = dailyCropDemand * 7;
          const effectiveRain = weeklyRain * 0.8;
          const deficit = Math.max(0, weeklyNeed - effectiveRain);
          const litresNeeded = deficit * area;
          const droughtTol = crop.droughtTolerance || 'medium';
          let freqDays;
          if (droughtTol === 'low') freqDays = soil.id.includes('sand') ? 1 : 2;
          else if (droughtTol === 'high') freqDays = soil.id.includes('clay') ? 5 : 3;
          else freqDays = soil.id.includes('sand') ? 2 : 3;

          results.push({
            bed, zone, crop, planting,
            area,
            kc,
            weeklyNeed: weeklyNeed.toFixed(1),
            effectiveRain: effectiveRain.toFixed(1),
            deficit: deficit.toFixed(1),
            litresNeeded: litresNeeded.toFixed(0),
            droughtTol,
            freqDays,
          });
        });
      });
    });
    return results;
  }, [zones, crops, weatherET0, weeklyRain, soil]);

  const totalWeeklyLitres = bedCalcs.reduce((s, b) => s + parseFloat(b.litresNeeded), 0);

  const handleSoilChange = (soilId) => {
    updateState(prev => ({ ...prev, settings: { ...prev.settings, soilType: soilId } }));
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 20px', fontFamily: "'DM Serif Display', serif", color: theme.text }}>💧 Irrigation Planner</h2>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
        <SummaryCard icon="💧" label="Weekly Water Need" value={`${totalWeeklyLitres.toFixed(0)} L`} color={theme.accent} />
        <SummaryCard icon="🌧️" label="Weekly Rainfall" value={`${weeklyRain.toFixed(1)} mm`} color="#42a5f5" />
        <SummaryCard icon="☀️" label="Weekly ET₀" value={`${weatherET0?.toFixed(1) || '—'} mm`} color="#ff9800" />
        <SummaryCard icon="🌱" label="Beds Irrigated" value={bedCalcs.length} />
      </div>

      {/* Soil type */}
      <Card style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <FormField label="Soil Type" style={{ marginBottom: 0, minWidth: '200px' }}>
            <Select value={settings.soilType || 'loam'} onChange={e => handleSoilChange(e.target.value)}>
              {soilTypes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </FormField>
          <div style={{ fontSize: '13px', color: theme.textSecondary }}>
            Water Holding Capacity: <strong>{soil.waterHoldingCapacity} mm/m</strong> | Infiltration: <strong>{soil.infiltrationRate}</strong>
          </div>
        </div>
      </Card>

      {/* Per-bed irrigation table */}
      <Card style={{ overflowX: 'auto' }}>
        <h3 style={{ margin: '0 0 12px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '16px' }}>Per-Bed Irrigation Schedule</h3>
        {bedCalcs.length === 0 ? (
          <p style={{ color: theme.textMuted, textAlign: 'center', padding: '20px', fontSize: '14px' }}>No planted beds found. Add plantings to see irrigation calculations.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: "'Libre Franklin', sans-serif" }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${theme.border}` }}>
                {['Bed', 'Crop', 'Kc', 'Weekly Need', 'Eff. Rain', 'Deficit', 'Litres', 'Drought Tol.', 'Frequency'].map(h => (
                  <th key={h} style={{ padding: '8px', textAlign: 'left', color: theme.textSecondary, fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bedCalcs.map((bc, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
                  <td style={{ padding: '8px', color: theme.text }}>
                    <div style={{ fontWeight: '500' }}>{bc.bed.name}</div>
                    <div style={{ fontSize: '11px', color: theme.textMuted }}>{bc.zone.name}</div>
                  </td>
                  <td style={{ padding: '8px', color: theme.text }}>{bc.crop.icon} {bc.crop.name}</td>
                  <td style={{ padding: '8px', color: theme.textSecondary }}>{bc.kc}</td>
                  <td style={{ padding: '8px', color: theme.text }}>{bc.weeklyNeed} mm</td>
                  <td style={{ padding: '8px', color: '#42a5f5' }}>{bc.effectiveRain} mm</td>
                  <td style={{ padding: '8px', fontWeight: '600', color: parseFloat(bc.deficit) > 0 ? theme.warning : theme.success }}>{bc.deficit} mm</td>
                  <td style={{ padding: '8px', fontWeight: '600', color: theme.accent }}>{bc.litresNeeded} L</td>
                  <td style={{ padding: '8px' }}>{DROUGHT_ICONS[bc.droughtTol]} <span style={{ fontSize: '11px', color: theme.textMuted }}>{bc.droughtTol}</span></td>
                  <td style={{ padding: '8px', color: theme.textSecondary }}>Every {bc.freqDays} day{bc.freqDays > 1 ? 's' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

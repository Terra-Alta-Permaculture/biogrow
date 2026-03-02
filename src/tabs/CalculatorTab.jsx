import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Card, SummaryCard, EmptyState } from '../components/shared';

const OVERSOW = 1.2;

export default function CalculatorTab() {
  const { zones, crops, theme } = useApp();

  const calculations = useMemo(() => {
    const results = [];
    zones.forEach(zone => {
      zone.beds.forEach(bed => {
        (bed.plantings || []).forEach(planting => {
          const crop = crops.find(c => c.id === planting.cropId);
          if (!crop) return;
          const area = bed.width * bed.length;
          const spacingM = crop.spacing / 100;
          const rowSpacingM = crop.rowSpacing / 100;
          const rows = Math.floor(bed.width / rowSpacingM) || 1;
          const plantsPerRow = Math.floor(bed.length / spacingM) || 1;
          const plantsNeeded = Math.ceil(rows * plantsPerRow * OVERSOW);
          const germRate = crop.germinationRate || 0.8;
          const seedsNeeded = Math.ceil(plantsNeeded / germRate);
          const seedsPerGram = crop.seedsPerGram || 100;
          const gramsNeeded = (seedsNeeded / seedsPerGram).toFixed(1);

          results.push({
            crop, bed, zone,
            spacing: crop.spacing,
            rowSpacing: crop.rowSpacing,
            plantsNeeded,
            seedsNeeded,
            gramsNeeded: parseFloat(gramsNeeded),
          });
        });
      });
    });
    return results;
  }, [zones, crops]);

  const seedSummary = useMemo(() => {
    const map = {};
    calculations.forEach(c => {
      if (!map[c.crop.id]) map[c.crop.id] = { crop: c.crop, totalPlants: 0, totalSeeds: 0, totalGrams: 0 };
      map[c.crop.id].totalPlants += c.plantsNeeded;
      map[c.crop.id].totalSeeds += c.seedsNeeded;
      map[c.crop.id].totalGrams += c.gramsNeeded;
    });
    return Object.values(map).sort((a, b) => b.totalGrams - a.totalGrams);
  }, [calculations]);

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 20px', fontFamily: "'DM Serif Display', serif", color: theme.text }}>🧮 Seed & Plant Calculator</h2>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
        <SummaryCard icon="🌱" label="Total Plantings" value={calculations.length} />
        <SummaryCard icon="🌿" label="Total Plants" value={calculations.reduce((s, c) => s + c.plantsNeeded, 0)} color={theme.accent} />
        <SummaryCard icon="🫘" label="Total Seeds" value={calculations.reduce((s, c) => s + c.seedsNeeded, 0)} />
        <SummaryCard icon="⚖️" label="Crops to Order" value={seedSummary.length} />
      </div>

      <p style={{ fontSize: '12px', color: theme.textMuted, marginBottom: '16px', fontFamily: "'Libre Franklin', sans-serif" }}>
        Bio-intensive spacing with {((OVERSOW - 1) * 100).toFixed(0)}% oversow factor applied.
      </p>

      {calculations.length === 0 ? (
        <Card><EmptyState icon="🧮" message="No plantings found. Add plantings in the Beds tab to calculate seed needs." /></Card>
      ) : (
        <>
          {/* Per-planting table */}
          <Card style={{ marginBottom: '24px', overflowX: 'auto' }}>
            <h3 style={{ margin: '0 0 12px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '16px' }}>Per-Planting Calculations</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: "'Libre Franklin', sans-serif" }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${theme.border}` }}>
                  {['Crop', 'Bed', 'Zone', 'Spacing (cm)', 'Row Spacing (cm)', 'Plants Needed', 'Seeds Needed', 'Grams'].map(h => (
                    <th key={h} style={{ padding: '8px', textAlign: 'left', color: theme.textSecondary, fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calculations.map((c, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
                    <td style={{ padding: '8px', color: theme.text }}>{c.crop.icon} {c.crop.name}</td>
                    <td style={{ padding: '8px', color: theme.textSecondary }}>{c.bed.name}</td>
                    <td style={{ padding: '8px', color: theme.textSecondary }}>{c.zone.name}</td>
                    <td style={{ padding: '8px', color: theme.textSecondary }}>{c.spacing}</td>
                    <td style={{ padding: '8px', color: theme.textSecondary }}>{c.rowSpacing}</td>
                    <td style={{ padding: '8px', color: theme.accent, fontWeight: '600' }}>{c.plantsNeeded}</td>
                    <td style={{ padding: '8px', color: theme.text, fontWeight: '600' }}>{c.seedsNeeded}</td>
                    <td style={{ padding: '8px', color: theme.warning, fontWeight: '600' }}>{c.gramsNeeded.toFixed(1)}g</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Seed order summary */}
          <Card>
            <h3 style={{ margin: '0 0 12px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '16px' }}>Seed Order Summary</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
              {seedSummary.map(s => (
                <div key={s.crop.id} style={{ padding: '14px', borderRadius: '10px', background: theme.bgTab, border: `1px solid ${theme.borderLight}` }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: theme.text, marginBottom: '8px' }}>{s.crop.icon} {s.crop.name}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: theme.textSecondary }}>
                    <div>Plants: <strong style={{ color: theme.accent }}>{s.totalPlants}</strong></div>
                    <div>Seeds: <strong>{s.totalSeeds}</strong></div>
                    <div>Order: <strong style={{ color: theme.warning }}>{s.totalGrams.toFixed(1)}g</strong></div>
                    <div style={{ fontSize: '11px', color: theme.textMuted }}>{s.crop.seedsPerGram} seeds/gram</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Card, Badge } from './shared';
import { getCurrentWeek } from '../utils/helpers';

export default function ThisWeekSummary() {
  const { zones, crops, settings, theme } = useApp();
  const [expanded, setExpanded] = useState(true);
  const currentWeek = getCurrentWeek();
  const currentYear = settings.currentYear || new Date().getFullYear();

  const actions = useMemo(() => {
    const sow = [];
    const transplant = [];
    const harvestReady = [];
    const seen = { sow: new Set(), transplant: new Set(), harvest: new Set() };

    zones.forEach(z => z.beds.forEach(b => {
      (b.plantings || []).forEach(p => {
        if (p.year !== currentYear) return;
        const crop = crops.find(c => c.id === p.cropId);
        if (!crop) return;
        const startWeek = parseInt(p.startWeek);
        if (isNaN(startWeek)) return;

        // Sow this week
        if (startWeek === currentWeek && !seen.sow.has(crop.id)) {
          sow.push({ crop, bed: b, zone: z });
          seen.sow.add(crop.id);
        }

        // Transplant this week
        const daysInCell = crop.daysInCell || 0;
        if (daysInCell > 0) {
          const transplantWeek = startWeek + Math.ceil(daysInCell / 7);
          if (transplantWeek === currentWeek && !seen.transplant.has(crop.id)) {
            transplant.push({ crop, bed: b, zone: z });
            seen.transplant.add(crop.id);
          }
        }

        // Harvest ready (within ±1 week)
        const maturityWeek = startWeek + Math.ceil((crop.daysToMaturity || 60) / 7);
        if (Math.abs(maturityWeek - currentWeek) <= 1 && !seen.harvest.has(crop.id)) {
          harvestReady.push({ crop, bed: b, zone: z });
          seen.harvest.add(crop.id);
        }
      });
    }));

    return { sow, transplant, harvestReady };
  }, [zones, crops, currentWeek, currentYear]);

  const totalActions = actions.sow.length + actions.transplant.length + actions.harvestReady.length;
  if (totalActions === 0) return null;

  const sections = [
    { key: 'sow', label: 'Sow / Start', icon: '🌱', color: '#16a34a', items: actions.sow },
    { key: 'transplant', label: 'Transplant', icon: '🪴', color: '#2563eb', items: actions.transplant },
    { key: 'harvest', label: 'Harvest Ready', icon: '🧺', color: '#d97706', items: actions.harvestReady },
  ].filter(s => s.items.length > 0);

  return (
    <Card style={{ marginBottom: '16px', padding: '14px 16px' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 0, fontFamily: "'DM Serif Display', serif",
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>📋</span>
          <span style={{ fontSize: '15px', color: theme.text, fontWeight: '600' }}>This Week&apos;s Actions</span>
          <Badge bg={theme.accent} color="#fff">{totalActions}</Badge>
        </div>
        <span style={{ fontSize: '14px', color: theme.textMuted, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ▼
        </span>
      </button>

      {expanded && (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sections.map(section => (
            <div key={section.key}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px',
                paddingLeft: '4px', borderLeft: `3px solid ${section.color}`,
              }}>
                <span style={{ fontSize: '14px' }}>{section.icon}</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: theme.text, fontFamily: "'Libre Franklin', sans-serif" }}>{section.label}</span>
                <Badge bg={section.color + '20'} color={section.color}>{section.items.length}</Badge>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingLeft: '8px' }}>
                {section.items.map((item, i) => (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    padding: '3px 10px', borderRadius: '12px', fontSize: '12px',
                    background: section.color + '12', color: section.color,
                    fontFamily: "'Libre Franklin', sans-serif", fontWeight: '500',
                  }}>
                    {item.crop.icon} {item.crop.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div style={{ fontSize: '11px', color: theme.textMuted, fontFamily: "'Libre Franklin', sans-serif", textAlign: 'right' }}>
            Week {currentWeek} of {currentYear}
          </div>
        </div>
      )}
    </Card>
  );
}

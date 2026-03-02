import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Card, Badge, EmptyState, Select } from '../components/shared';
import { companionRules } from '../data/companions';

const TYPE_CONFIG = {
  great: { icon: '💚', label: 'Synergistic', color: '#2e7d32', bg: '#e8f5e9' },
  good: { icon: '✅', label: 'Good Companion', color: '#558b2f', bg: '#f1f8e9' },
  bad: { icon: '⚠️', label: 'Avoid Together', color: '#c62828', bg: '#ffebee' },
};

export default function CompanionsTab() {
  const { zones, crops, selectedCropIds, theme } = useApp();
  const [lookupCropId, setLookupCropId] = useState('');

  const bedAnalysis = useMemo(() => {
    const results = [];
    zones.forEach(zone => {
      zone.beds.forEach(bed => {
        if ((bed.plantings || []).length < 2) return;
        const relationships = [];
        const plantCrops = bed.plantings.map(p => crops.find(c => c.id === p.cropId)).filter(Boolean);
        for (let i = 0; i < plantCrops.length; i++) {
          for (let j = i + 1; j < plantCrops.length; j++) {
            const a = plantCrops[i], b = plantCrops[j];
            const rule = companionRules.find(r =>
              (r.crop1 === a.id && r.crop2 === b.id) ||
              (r.crop1 === b.id && r.crop2 === a.id)
            );
            if (rule) {
              relationships.push({ cropA: a, cropB: b, ...rule });
            }
          }
        }
        if (relationships.length > 0) {
          results.push({ bed, zone, relationships });
        }
      });
    });
    return results;
  }, [zones, crops]);

  const allCropsWithPlantings = useMemo(() => {
    const used = new Set();
    zones.forEach(z => z.beds.forEach(b => (b.plantings || []).forEach(p => used.add(p.cropId))));
    return crops.filter(c => used.has(c.id));
  }, [zones, crops]);

  const matrix = useMemo(() => {
    if (allCropsWithPlantings.length === 0) return [];
    const cropsToShow = allCropsWithPlantings.length > 0 ? allCropsWithPlantings : crops.slice(0, 15);
    return cropsToShow.map(c1 => ({
      crop: c1,
      cells: cropsToShow.map(c2 => {
        if (c1.id === c2.id) return { type: 'self' };
        const rule = companionRules.find(r =>
          (r.crop1 === c1.id && r.crop2 === c2.id) ||
          (r.crop1 === c2.id && r.crop2 === c1.id)
        );
        return rule ? { type: rule.type, reason: rule.reason } : { type: 'neutral' };
      }),
    }));
  }, [allCropsWithPlantings, crops]);

  const matrixCrops = allCropsWithPlantings.length > 0 ? allCropsWithPlantings : crops.slice(0, 15);

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 20px', fontFamily: "'DM Serif Display', serif", color: theme.text }}>🤝 Companion Planting</h2>

      {/* Crop Companion Lookup */}
      <Card style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 12px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '16px' }}>🔍 Crop Companion Lookup</h3>
        <Select value={lookupCropId} onChange={e => setLookupCropId(e.target.value)}>
          <option value="">Select a crop to check companions...</option>
          {crops
            .filter(c => selectedCropIds.length === 0 || selectedCropIds.includes(c.id))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </Select>
        {lookupCropId && (() => {
          const matches = companionRules.filter(r => r.crop1 === lookupCropId || r.crop2 === lookupCropId);
          const grouped = { great: [], good: [], bad: [] };
          for (const rule of matches) {
            const otherId = rule.crop1 === lookupCropId ? rule.crop2 : rule.crop1;
            const other = crops.find(c => c.id === otherId);
            if (other) grouped[rule.type].push({ crop: other, reason: rule.reason });
          }
          const selectedCrop = crops.find(c => c.id === lookupCropId);
          return (
            <div style={{ marginTop: '12px' }}>
              {selectedCrop && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '15px', fontWeight: '600', color: theme.text }}>
                  <span style={{ fontSize: '20px' }}>{selectedCrop.icon}</span> {selectedCrop.name}
                  <span style={{ fontSize: '12px', fontWeight: '400', color: theme.textMuted }}>({selectedCrop.family})</span>
                </div>
              )}
              {grouped.great.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#2e7d32', marginBottom: '4px' }}>💚 Synergistic ({grouped.great.length})</div>
                  {grouped.great.map(g => (
                    <div key={g.crop.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '4px 8px', borderRadius: '6px', background: '#e8f5e9', marginBottom: '3px', flexWrap: 'wrap' }}>
                      <span>{g.crop.icon} <strong style={{ color: '#2e7d32' }}>{g.crop.name}</strong></span>
                      <span style={{ color: theme.textSecondary }}>— {g.reason}</span>
                    </div>
                  ))}
                </div>
              )}
              {grouped.good.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#558b2f', marginBottom: '4px' }}>✅ Good Companion ({grouped.good.length})</div>
                  {grouped.good.map(g => (
                    <div key={g.crop.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '4px 8px', borderRadius: '6px', background: '#f1f8e9', marginBottom: '3px', flexWrap: 'wrap' }}>
                      <span>{g.crop.icon} <strong style={{ color: '#558b2f' }}>{g.crop.name}</strong></span>
                      <span style={{ color: theme.textSecondary }}>— {g.reason}</span>
                    </div>
                  ))}
                </div>
              )}
              {grouped.bad.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#c62828', marginBottom: '4px' }}>⚠️ Avoid Together ({grouped.bad.length})</div>
                  {grouped.bad.map(g => (
                    <div key={g.crop.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '4px 8px', borderRadius: '6px', background: '#ffebee', marginBottom: '3px', flexWrap: 'wrap' }}>
                      <span>{g.crop.icon} <strong style={{ color: '#c62828' }}>{g.crop.name}</strong></span>
                      <span style={{ color: theme.textSecondary }}>— {g.reason}</span>
                    </div>
                  ))}
                </div>
              )}
              {matches.length === 0 && (
                <div style={{ fontSize: '13px', color: theme.textMuted, fontStyle: 'italic', padding: '12px 0' }}>
                  No companion data available for this crop.
                </div>
              )}
            </div>
          );
        })()}
      </Card>

      {/* Per-bed analysis */}
      <Card style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 12px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '16px' }}>Per-Bed Companion Analysis</h3>
        {bedAnalysis.length === 0 ? (
          <EmptyState icon="🤝" message="Add multiple crops to the same bed to see companion analysis." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {bedAnalysis.map(ba => (
              <div key={ba.bed.id} style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${theme.borderLight}`, background: theme.bgHover }}>
                <div style={{ fontWeight: '600', color: theme.text, marginBottom: '8px', fontSize: '14px' }}>
                  {ba.bed.name} <span style={{ fontWeight: '400', color: theme.textMuted }}>({ba.zone.name})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {ba.relationships.map((rel, i) => {
                    const cfg = TYPE_CONFIG[rel.type];
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '6px 8px', borderRadius: '6px', background: cfg.bg, flexWrap: 'wrap' }}>
                        <span>{cfg.icon}</span>
                        <strong style={{ color: cfg.color }}>{rel.cropA.icon} {rel.cropA.name} + {rel.cropB.icon} {rel.cropB.name}</strong>
                        <span style={{ color: theme.textSecondary }}>— {rel.reason}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Companion Matrix */}
      <Card style={{ overflowX: 'auto' }}>
        <h3 style={{ margin: '0 0 12px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '16px' }}>Companion Matrix</h3>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', fontSize: '12px', color: theme.textSecondary, flexWrap: 'wrap' }}>
          <span>💚 Synergistic (great)</span>
          <span>✅ Good companion</span>
          <span>⚠️ Avoid together</span>
          <span style={{ color: theme.textMuted }}>· Neutral</span>
        </div>
        {matrix.length === 0 ? (
          <EmptyState icon="🌱" message="Plant crops to see the companion matrix." />
        ) : (
          <table style={{ borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>
                <th style={{ padding: '4px 6px' }} />
                {matrixCrops.map(c => (
                  <th key={c.id} style={{ padding: '4px', textAlign: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: '10px', color: theme.textSecondary, whiteSpace: 'nowrap', maxWidth: '30px' }}>
                    {c.icon} {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, ri) => (
                <tr key={row.crop.id}>
                  <td style={{ padding: '4px 6px', fontWeight: '500', color: theme.text, whiteSpace: 'nowrap', fontSize: '11px' }}>{row.crop.icon} {row.crop.name}</td>
                  {row.cells.map((cell, ci) => {
                    let bg = 'transparent';
                    let content = '·';
                    if (cell.type === 'self') { bg = theme.bgTab; content = '—'; }
                    else if (cell.type === 'great') { bg = '#c8e6c9'; content = '💚'; }
                    else if (cell.type === 'good') { bg = '#dcedc8'; content = '✅'; }
                    else if (cell.type === 'bad') { bg = '#ffcdd2'; content = '⚠️'; }
                    return (
                      <td key={ci} title={cell.reason || ''} style={{
                        padding: '4px',
                        textAlign: 'center',
                        background: bg,
                        borderRadius: '2px',
                        cursor: cell.reason ? 'help' : 'default',
                        fontSize: cell.type === 'neutral' ? '10px' : '12px',
                        color: theme.textMuted,
                        minWidth: '28px',
                      }}>
                        {content}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

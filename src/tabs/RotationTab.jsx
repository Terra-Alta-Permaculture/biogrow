import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Card, SummaryCard, Button, Modal, FormField, Input, Select, Badge, EmptyState } from '../components/shared';
import { familyColors } from '../data/crops';
import { generateId } from '../utils/helpers';
import { getAllBedSuggestions } from '../utils/rotationEngine';

const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'];

export default function RotationTab() {
  const { rotationHistory, zones, crops, selectedCropIds, updateState, theme, settings, showToast } = useApp();

  const YEARS = useMemo(() => {
    const currentYear = settings.currentYear || new Date().getFullYear();
    const years = new Set();
    // From rotation history
    (rotationHistory || []).forEach(h => { if (h.year) years.add(h.year); });
    // From all plantings
    zones.forEach(z => z.beds.forEach(b => (b.plantings || []).forEach(p => { if (p.year) years.add(p.year); })));
    // Ensure current year range
    for (let y = currentYear - 3; y <= currentYear + 2; y++) years.add(y);
    return [...years].sort((a, b) => a - b);
  }, [rotationHistory, zones, settings]);

  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [form, setForm] = useState({ bedId: '', cropId: '', year: settings.currentYear || new Date().getFullYear(), season: 'Spring' });
  const [formError, setFormError] = useState('');

  const allBeds = useMemo(() => zones.flatMap(z => z.beds.map(b => ({ ...b, zoneName: z.name }))), [zones]);
  const history = rotationHistory || [];

  const warnings = useMemo(() => {
    const warns = [];
    const bedEntries = {};
    history.forEach(h => {
      if (!bedEntries[h.bedId]) bedEntries[h.bedId] = [];
      bedEntries[h.bedId].push(h);
    });

    // Also check current plantings
    zones.forEach(zone => {
      zone.beds.forEach(bed => {
        (bed.plantings || []).forEach(p => {
          if (!bedEntries[bed.id]) bedEntries[bed.id] = [];
          bedEntries[bed.id].push({ bedId: bed.id, cropId: p.cropId, year: p.year || (settings.currentYear || new Date().getFullYear()), season: 'Current' });
        });
      });
    });

    Object.entries(bedEntries).forEach(([bedId, entries]) => {
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          const a = entries[i];
          const b = entries[j];
          const cropA = crops.find(c => c.id === a.cropId);
          const cropB = crops.find(c => c.id === b.cropId);
          if (!cropA || !cropB || cropA.family !== cropB.family) continue;
          const yearDiff = Math.abs(a.year - b.year);
          if (yearDiff >= 3) continue;
          const bed = allBeds.find(bd => bd.id === bedId);
          let severity = 'LOW';
          if (yearDiff <= 1) severity = 'HIGH';
          else if (yearDiff <= 2) severity = 'MEDIUM';
          warns.push({
            bedId,
            bedName: bed?.name || bedId,
            family: cropA.family,
            cropA: `${cropA.icon} ${cropA.name} (${a.year})`,
            cropB: `${cropB.icon} ${cropB.name} (${b.year})`,
            severity,
            yearDiff,
          });
        }
      }
    });
    return warns;
  }, [history, zones, crops, allBeds, settings]);

  const heatmapData = useMemo(() => {
    const beds = allBeds.slice(0, 20);
    return beds.map(bed => {
      const yearData = {};
      YEARS.forEach(y => {
        // Check rotation history first
        const entry = history.find(h => h.bedId === bed.id && h.year === y);
        if (entry) {
          const crop = crops.find(c => c.id === entry.cropId);
          yearData[y] = crop ? { family: crop.family, name: crop.name, icon: crop.icon } : null;
        }
        // Also check actual bed plantings for this year
        if (!yearData[y]) {
          const planting = (bed.plantings || []).find(p => (p.year || settings.currentYear) === y);
          if (planting) {
            const crop = crops.find(c => c.id === planting.cropId);
            yearData[y] = crop ? { family: crop.family, name: crop.name, icon: crop.icon } : null;
          }
        }
      });
      return { bed, yearData };
    });
  }, [allBeds, history, crops, YEARS, settings]);

  const suggestions = useMemo(() => getAllBedSuggestions(
    rotationHistory, zones, crops,
    settings.currentYear || new Date().getFullYear(),
    selectedCropIds
  ), [rotationHistory, zones, crops, settings, selectedCropIds]);

  const save = () => {
    if (!form.bedId) { setFormError('Please select a bed.'); return; }
    if (!form.cropId) { setFormError('Please select a crop.'); return; }
    setFormError('');
    updateState(prev => ({
      ...prev,
      rotationHistory: [...(prev.rotationHistory || []), { id: generateId(), ...form }],
    }));
    setShowModal(false);
  };

  const remove = (id) => {
    const item = (rotationHistory || []).find(x => x.id === id);
    updateState(prev => ({ ...prev, rotationHistory: (prev.rotationHistory || []).filter(x => x.id !== id) }));
    setDeleteConfirm(null);
    if (item) {
      const crop = crops.find(c => c.id === item.cropId);
      showToast(`Rotation entry "${crop?.name || 'entry'}" deleted`, {
        type: 'warning',
        undo: () => updateState(prev => ({ ...prev, rotationHistory: [...(prev.rotationHistory || []), item] })),
      });
    }
  };

  const sevColors = { HIGH: '#e53935', MEDIUM: '#ff9800', LOW: '#ffc107' };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ margin: 0, fontFamily: "'DM Serif Display', serif", color: theme.text }}>🔄 Crop Rotation</h2>
        <Button onClick={() => { setForm({ bedId: allBeds[0]?.id || '', cropId: crops[0]?.id || '', year: settings.currentYear || new Date().getFullYear(), season: 'Spring' }); setFormError(''); setShowModal(true); }}>+ Log Past Planting</Button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
        <SummaryCard icon="📋" label="History Entries" value={history.length} />
        <SummaryCard icon="⚠️" label="Rotation Warnings" value={warnings.length} color={warnings.length > 0 ? '#e53935' : theme.accent} />
        <SummaryCard icon="💡" label="Beds with Suggestions" value={suggestions.length} />
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card style={{ marginBottom: '24px', borderLeft: `4px solid #e53935` }}>
          <h3 style={{ margin: '0 0 12px', fontFamily: "'DM Serif Display', serif", color: '#e53935', fontSize: '16px' }}>⚠️ Rotation Warnings</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {warnings.map((w, i) => (
              <div key={i} style={{ padding: '10px', borderRadius: '8px', background: theme.bgHover, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <Badge bg={sevColors[w.severity]} color="#fff">{w.severity}</Badge>
                <strong style={{ color: theme.text }}>{w.bedName}</strong>
                <span style={{ color: theme.textSecondary }}>— {w.family} family conflict: {w.cropA} → {w.cropB}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Heatmap */}
      <Card style={{ marginBottom: '24px', overflowX: 'auto' }}>
        <h3 style={{ margin: '0 0 12px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '16px' }}>Rotation Heatmap</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: "'Libre Franklin', sans-serif" }}>
          <thead>
            <tr>
              <th style={{ padding: '6px 8px', textAlign: 'left', color: theme.textSecondary, fontSize: '11px' }}>Bed</th>
              {YEARS.map(y => <th key={y} style={{ padding: '6px 8px', textAlign: 'center', color: theme.textSecondary, fontSize: '11px' }}>{y}</th>)}
            </tr>
          </thead>
          <tbody>
            {heatmapData.map(row => (
              <tr key={row.bed.id} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
                <td style={{ padding: '6px 8px', color: theme.text, fontWeight: '500', whiteSpace: 'nowrap' }}>{row.bed.name}</td>
                {YEARS.map(y => {
                  const d = row.yearData[y];
                  return (
                    <td key={y} style={{
                      padding: '4px',
                      textAlign: 'center',
                      background: d ? `${familyColors[d.family] || '#888'}20` : 'transparent',
                      borderRadius: '4px',
                    }}>
                      {d ? (
                        <span title={`${d.name} (${d.family})`} style={{ fontSize: '14px' }}>{d.icon}</span>
                      ) : (
                        <span style={{ color: theme.textMuted }}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {/* Family color legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
          {Object.entries(familyColors).map(([fam, color]) => (
            <span key={fam} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: theme.textSecondary }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: color, display: 'inline-block' }} />
              {fam}
            </span>
          ))}
        </div>
      </Card>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <Card style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 12px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '16px' }}>💡 Rotation Suggestions</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
            {suggestions.map(s => (
              <div key={s.bedId} style={{ border: `1px solid ${theme.borderLight}`, borderRadius: '10px', padding: '14px', background: theme.bgHover }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <strong style={{ color: theme.text, fontSize: '14px' }}>{s.bedName}</strong>
                  {s.zoneName && <span style={{ color: theme.textMuted, fontSize: '11px' }}>({s.zoneName})</span>}
                  {s.lastFamily && (
                    <Badge bg={`${familyColors[s.lastFamily] || '#888'}30`} color={familyColors[s.lastFamily] || '#888'}>
                      Last: {s.lastFamily}
                    </Badge>
                  )}
                </div>

                {s.avoid.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '11px', color: theme.textSecondary, marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase' }}>Avoid</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {s.avoid.map(a => (
                        <Badge key={a.family} bg="#e5393520" color="#e53935">
                          {a.family} ({a.yearsRemaining}yr)
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {s.recommended.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '11px', color: theme.textSecondary, marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase' }}>Recommended</div>
                    {s.recommended.map(r => (
                      <div key={r.family} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                        <Badge bg="#4caf5020" color="#4caf50">{r.family}</Badge>
                        <span style={{ fontSize: '11px', color: theme.textMuted }}>{r.reason}</span>
                      </div>
                    ))}
                  </div>
                )}

                {s.ideal.length > 0 && (
                  <div>
                    <div style={{ fontSize: '11px', color: theme.textSecondary, marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase' }}>Ideal Crops</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {s.ideal.map(c => (
                        <Badge key={c.cropId} bg={`${theme.accent}18`} color={theme.accent}>
                          {c.icon} {c.cropName}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {s.warnings.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    {s.warnings.map((w, i) => (
                      <div key={i} style={{ fontSize: '11px', color: '#ff9800' }}>{w}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* History table */}
      <Card>
        <h3 style={{ margin: '0 0 12px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '16px' }}>Rotation History</h3>
        {history.length === 0 ? (
          <EmptyState icon="🔄" message="No rotation history. Log past plantings to track crop rotation." />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: "'Libre Franklin', sans-serif" }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${theme.border}` }}>
                {['Bed', 'Crop', 'Year', 'Season', ''].map(h => (
                  <th key={h} style={{ padding: '8px', textAlign: 'left', color: theme.textSecondary, fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map(h => {
                const bed = allBeds.find(b => b.id === h.bedId);
                const crop = crops.find(c => c.id === h.cropId);
                return (
                  <tr key={h.id} style={{ borderBottom: `1px solid ${theme.borderLight}` }}>
                    <td style={{ padding: '8px', color: theme.text }}>{bed?.name || h.bedId}</td>
                    <td style={{ padding: '8px', color: theme.text }}>{crop ? `${crop.icon} ${crop.name}` : h.cropId}</td>
                    <td style={{ padding: '8px', color: theme.textSecondary }}>{h.year}</td>
                    <td style={{ padding: '8px', color: theme.textSecondary }}>{h.season}</td>
                    <td style={{ padding: '8px' }}>
                      <button onClick={() => setDeleteConfirm(h)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>🗑️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Rotation Entry?" width="400px">
        {deleteConfirm && (() => {
          const crop = crops.find(c => c.id === deleteConfirm.cropId);
          const bed = allBeds.find(b => b.id === deleteConfirm.bedId);
          return (
            <div>
              <p style={{ margin: '0 0 16px', color: theme.textSecondary, fontSize: '14px' }}>
                Delete rotation entry for <strong>{crop ? `${crop.icon} ${crop.name}` : 'unknown crop'}</strong> in {bed?.name || 'unknown bed'} ({deleteConfirm.year} {deleteConfirm.season})?
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
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Log Past Planting">
        <FormField label="Bed">
          <Select value={form.bedId} onChange={e => setForm({ ...form, bedId: e.target.value })}>
            {allBeds.map(b => <option key={b.id} value={b.id}>{b.name} ({b.zoneName})</option>)}
          </Select>
        </FormField>
        <FormField label="Crop">
          <Select value={form.cropId} onChange={e => setForm({ ...form, cropId: e.target.value })}>
            {crops.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </Select>
        </FormField>
        <div style={{ display: 'flex', gap: '12px' }}>
          <FormField label="Year" style={{ flex: 1 }}>
            <Select value={form.year} onChange={e => setForm({ ...form, year: parseInt(e.target.value) })}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </Select>
          </FormField>
          <FormField label="Season" style={{ flex: 1 }}>
            <Select value={form.season} onChange={e => setForm({ ...form, season: e.target.value })}>
              {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </FormField>
        </div>
        {formError && <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '8px' }}>{formError}</div>}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={save}>Log Planting</Button>
        </div>
      </Modal>
    </div>
  );
}

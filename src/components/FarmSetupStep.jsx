import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Card, Button, Input, FormField, SummaryCard, Badge } from './shared';
import { generateId, bedArea } from '../utils/helpers';
import { defaultZones } from '../data/farm';

function makeBeds(zoneId, prefix, count, width, length, section) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${zoneId}-${prefix}-${i + 1}`,
    name: `${prefix} ${i + 1}`,
    width,
    length,
    section,
    plantings: [],
  }));
}

const PRESETS = [
  {
    id: 'small',
    name: 'Small Garden',
    icon: '🌱',
    desc: '1 zone, 4 beds (0.8 × 10 m)',
    zones: [{
      id: 'garden',
      name: 'Garden',
      sunExposure: 'full-sun',
      beds: makeBeds('garden', 'B', 4, 0.8, 10, 'Main'),
    }],
  },
  {
    id: 'medium',
    name: 'Medium Farm',
    icon: '🌾',
    desc: '2 zones, 16 beds (0.8 × 10 m)',
    zones: [
      {
        id: 'zone-a',
        name: 'Zone A',
        sunExposure: 'full-sun',
        beds: makeBeds('zone-a', 'A', 8, 0.8, 10, 'Main'),
      },
      {
        id: 'zone-b',
        name: 'Zone B',
        sunExposure: 'full-sun',
        beds: makeBeds('zone-b', 'B', 8, 0.8, 10, 'Main'),
      },
    ],
  },
  {
    id: 'large',
    name: 'Large Farm',
    icon: '🏡',
    desc: '4 zones, 50 beds (various sizes)',
    zones: defaultZones,
  },
];

export default function FarmSetupStep({ expanded, onExpand, onComplete }) {
  const { theme, zones, updateState } = useApp();
  const [newZoneName, setNewZoneName] = useState('');
  const [addingBedForZone, setAddingBedForZone] = useState(null);
  const [bedForm, setBedForm] = useState({ name: '', width: '0.8', length: '10' });
  const [showAddZone, setShowAddZone] = useState(false);

  const totalBeds = zones.reduce((s, z) => s + z.beds.length, 0);
  const totalArea = zones.reduce((s, z) => s + z.beds.reduce((a, b) => a + bedArea(b), 0), 0);
  const hasMinimum = zones.some(z => z.beds.length > 0);

  const handlePreset = (preset) => {
    updateState(prev => ({
      ...prev,
      zones: [...prev.zones, ...JSON.parse(JSON.stringify(preset.zones))],
      setupProgress: { ...prev.setupProgress, farmSetupDone: true },
    }));
  };

  const handleAddZone = () => {
    if (!newZoneName.trim()) return;
    const id = newZoneName.toLowerCase().replace(/\s+/g, '-') + '-' + generateId().slice(0, 4);
    updateState(prev => ({
      ...prev,
      zones: [...prev.zones, { id, name: newZoneName.trim(), beds: [] }],
    }));
    setNewZoneName('');
    setShowAddZone(false);
  };

  const handleAddBed = (zoneId) => {
    if (!bedForm.name.trim()) return;
    const bed = {
      id: `${zoneId}-${bedForm.name.toLowerCase().replace(/\s+/g, '-')}-${generateId().slice(0, 4)}`,
      name: bedForm.name.trim(),
      width: parseFloat(bedForm.width) || 0.8,
      length: parseFloat(bedForm.length) || 10,
      section: 'Main',
      plantings: [],
    };
    updateState(prev => ({
      ...prev,
      zones: prev.zones.map(z =>
        z.id === zoneId ? { ...z, beds: [...z.beds, bed] } : z
      ),
    }));
    setBedForm({ name: '', width: '0.8', length: '10' });
    setAddingBedForZone(null);
  };

  const handleDeleteZone = (zoneId) => {
    updateState(prev => ({
      ...prev,
      zones: prev.zones.filter(z => z.id !== zoneId),
    }));
  };

  const handleContinue = () => {
    updateState(prev => ({
      ...prev,
      setupProgress: { ...prev.setupProgress, farmSetupDone: true },
    }));
    onComplete();
  };

  // Collapsed summary view
  if (!expanded) {
    return (
      <Card style={{ marginTop: '12px', cursor: 'pointer', opacity: hasMinimum ? 1 : 0.6 }} onClick={onExpand}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>🌱</span>
            <div>
              <div style={{ fontWeight: '600', fontSize: '14px', color: theme.text, fontFamily: "'Libre Franklin', sans-serif" }}>
                Farm Setup
              </div>
              {hasMinimum ? (
                <div style={{ fontSize: '12px', color: theme.textMuted }}>
                  ✅ {zones.length} zone{zones.length !== 1 ? 's' : ''}, {totalBeds} bed{totalBeds !== 1 ? 's' : ''}, {Math.round(totalArea * 10) / 10} m²
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: theme.warning }}>
                  Set up your farm zones and beds
                </div>
              )}
            </div>
          </div>
          <Button variant="ghost" style={{ fontSize: '12px', padding: '4px 12px' }}>
            {hasMinimum ? 'Edit' : 'Start'}
          </Button>
        </div>
      </Card>
    );
  }

  // Expanded view
  return (
    <Card style={{ marginTop: '12px' }}>
      <h3 style={{ margin: '0 0 4px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '18px' }}>
        🌱 Farm Setup
      </h3>
      <p style={{ margin: '0 0 16px', fontSize: '13px', color: theme.textMuted, fontFamily: "'Libre Franklin', sans-serif" }}>
        Create your growing zones and beds. You can always edit these later in the Beds tab.
      </p>

      {/* Quick Start Presets */}
      {zones.length === 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: theme.textSecondary, marginBottom: '8px', fontFamily: "'Libre Franklin', sans-serif" }}>
            Quick Start
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => handlePreset(p)}
                style={{
                  flex: '1 1 140px',
                  padding: '12px',
                  borderRadius: '10px',
                  border: `1px solid ${theme.border}`,
                  background: theme.bgHover,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  fontFamily: "'Libre Franklin', sans-serif",
                }}
              >
                <div style={{ fontSize: '24px', marginBottom: '4px' }}>{p.icon}</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: theme.text }}>{p.name}</div>
                <div style={{ fontSize: '11px', color: theme.textMuted, marginTop: '2px' }}>{p.desc}</div>
              </button>
            ))}
          </div>
          <div style={{
            textAlign: 'center',
            fontSize: '12px',
            color: theme.textMuted,
            margin: '12px 0',
            fontFamily: "'Libre Franklin', sans-serif",
          }}>
            — or build your own —
          </div>
        </div>
      )}

      {/* Existing Zones */}
      {zones.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          {zones.map(zone => (
            <div key={zone.id} style={{
              padding: '10px 12px',
              borderRadius: '8px',
              border: `1px solid ${theme.borderLight}`,
              marginBottom: '8px',
              background: theme.bg,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: zone.beds.length > 0 ? '8px' : '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: '600', fontSize: '14px', color: theme.text, fontFamily: "'Libre Franklin', sans-serif" }}>
                    {zone.name}
                  </span>
                  <Badge bg={theme.accentLight} color={theme.accent}>
                    {zone.beds.length} bed{zone.beds.length !== 1 ? 's' : ''}
                  </Badge>
                  {zone.beds.length > 0 && (
                    <span style={{ fontSize: '11px', color: theme.textMuted }}>
                      {Math.round(zone.beds.reduce((a, b) => a + bedArea(b), 0) * 10) / 10} m²
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <Button
                    variant="ghost"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                    onClick={() => {
                      setAddingBedForZone(addingBedForZone === zone.id ? null : zone.id);
                      setBedForm({ name: '', width: '0.8', length: '10' });
                    }}
                  >
                    + Bed
                  </Button>
                  {zone.beds.length === 0 && (
                    <Button
                      variant="ghost"
                      style={{ fontSize: '11px', padding: '3px 8px', color: theme.error }}
                      onClick={() => { if (window.confirm(`Delete ${zone.name || 'this zone'}?`)) handleDeleteZone(zone.id); }}
                    >
                      ✕
                    </Button>
                  )}
                </div>
              </div>

              {/* Bed list */}
              {zone.beds.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {zone.beds.map(bed => (
                    <span key={bed.id} style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: theme.bgHover,
                      color: theme.textSecondary,
                      fontFamily: "'Libre Franklin', sans-serif",
                    }}>
                      {bed.name} ({bed.width}×{bed.length}m)
                    </span>
                  ))}
                </div>
              )}

              {/* Add Bed inline form */}
              {addingBedForZone === zone.id && (
                <div style={{
                  marginTop: '10px',
                  padding: '10px',
                  borderRadius: '8px',
                  background: theme.bgHover,
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                  alignItems: 'flex-end',
                }}>
                  <FormField label="Bed Name" style={{ flex: '2 1 120px', marginBottom: 0 }}>
                    <Input
                      value={bedForm.name}
                      onChange={e => setBedForm({ ...bedForm, name: e.target.value })}
                      placeholder="e.g. B-1"
                      style={{ fontSize: '13px' }}
                    />
                  </FormField>
                  <FormField label="Width (m)" style={{ flex: '1 1 70px', marginBottom: 0 }}>
                    <Input
                      type="number"
                      step="0.1"
                      value={bedForm.width}
                      onChange={e => setBedForm({ ...bedForm, width: e.target.value })}
                      style={{ fontSize: '13px' }}
                    />
                  </FormField>
                  <FormField label="Length (m)" style={{ flex: '1 1 70px', marginBottom: 0 }}>
                    <Input
                      type="number"
                      step="0.5"
                      value={bedForm.length}
                      onChange={e => setBedForm({ ...bedForm, length: e.target.value })}
                      style={{ fontSize: '13px' }}
                    />
                  </FormField>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <Button onClick={() => handleAddBed(zone.id)} style={{ fontSize: '12px', padding: '7px 14px' }}>Add</Button>
                    <Button variant="ghost" onClick={() => setAddingBedForZone(null)} style={{ fontSize: '12px', padding: '7px 14px' }}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Zone */}
      {showAddZone ? (
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-end',
          marginBottom: '16px',
        }}>
          <FormField label="Zone Name" style={{ flex: 1, marginBottom: 0 }}>
            <Input
              value={newZoneName}
              onChange={e => setNewZoneName(e.target.value)}
              placeholder="e.g. North Garden, Greenhouse"
              onKeyDown={e => e.key === 'Enter' && handleAddZone()}
              autoFocus
            />
          </FormField>
          <Button onClick={handleAddZone} style={{ fontSize: '12px' }}>Add Zone</Button>
          <Button variant="ghost" onClick={() => { setShowAddZone(false); setNewZoneName(''); }} style={{ fontSize: '12px' }}>Cancel</Button>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setShowAddZone(true)} style={{ marginBottom: '16px', fontSize: '13px' }}>
          + Add Zone
        </Button>
      )}

      {/* Summary + Continue */}
      {zones.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '16px',
        }}>
          <SummaryCard icon="📐" label="Total Zones" value={zones.length} />
          <SummaryCard icon="🛏️" label="Total Beds" value={totalBeds} />
          <SummaryCard icon="📏" label="Growing Area" value={`${Math.round(totalArea * 10) / 10} m²`} />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <Button
          onClick={handleContinue}
          disabled={!hasMinimum}
          style={{
            opacity: hasMinimum ? 1 : 0.5,
            cursor: hasMinimum ? 'pointer' : 'not-allowed',
          }}
        >
          Continue to Crop Selection →
        </Button>
      </div>
    </Card>
  );
}

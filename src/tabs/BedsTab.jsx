import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Card, SummaryCard, Button, Modal, FormField, Input, Select, Badge } from '../components/shared';
import { familyColors, sunExposureLabels, sunExposureOptions } from '../data/crops';
import { generateId, bedArea, getCurrentWeek, getSeasonPhase, generateSuccessionSequence } from '../utils/helpers';
import { companionRules } from '../data/companions';
import { getCompanionHealth, getCompanionHealthLevel, getCropCompanionStatus, getCompanionSuggestions } from '../utils/companionHealth';
import { getQuickSuggestion } from '../utils/rotationEngine';
import FarmMap from '../components/FarmMap';
import YearSelector from '../components/YearSelector';
import ThisWeekSummary from '../components/ThisWeekSummary';
import WeatherAlertBanner from '../components/WeatherAlertBanner';
import FrostDateSuggestion from '../components/FrostDateSuggestion';

function getBedFamilyColor(bed, crops) {
  if (!bed.plantings || bed.plantings.length === 0) return '#c8bfb4';
  const firstPlanting = bed.plantings[0];
  const crop = crops.find(c => c.id === firstPlanting.cropId);
  if (!crop) return '#c8bfb4';
  return familyColors[crop.family] || '#c8bfb4';
}

function getRotationWarnings(bed, crops) {
  if (!bed.plantings || bed.plantings.length < 2) return [];
  const warnings = [];
  const familyMap = {};
  for (const planting of bed.plantings) {
    const crop = crops.find(c => c.id === planting.cropId);
    if (!crop) continue;
    if (familyMap[crop.family]) {
      warnings.push({
        family: crop.family,
        crops: [familyMap[crop.family], crop.name],
      });
    } else {
      familyMap[crop.family] = crop.name;
    }
  }
  return warnings;
}

function getCompanionWarnings(bed, crops) {
  if (!bed.plantings || bed.plantings.length < 2) return [];
  const warnings = [];
  const cropIds = bed.plantings.map(p => p.cropId).filter(Boolean);
  for (let i = 0; i < cropIds.length; i++) {
    for (let j = i + 1; j < cropIds.length; j++) {
      const rule = companionRules.find(
        r => r.type === 'bad' &&
          ((r.crop1 === cropIds[i] && r.crop2 === cropIds[j]) ||
           (r.crop1 === cropIds[j] && r.crop2 === cropIds[i]))
      );
      if (rule) {
        const crop1 = crops.find(c => c.id === cropIds[i]);
        const crop2 = crops.find(c => c.id === cropIds[j]);
        warnings.push({
          crop1: crop1?.name || cropIds[i],
          crop2: crop2?.name || cropIds[j],
          reason: rule.reason,
        });
      }
    }
  }
  return warnings;
}

export default function BedsTab({ onNavigate }) {
  const { zones, crops, settings, rotationHistory, selectedCropIds, updateState, theme, showToast } = useApp();
  const [viewYear, setViewYear] = useState(settings.currentYear || new Date().getFullYear());

  const [showAddZone, setShowAddZone] = useState(false);
  const [showAddBed, setShowAddBed] = useState(false);
  const [showAddPlanting, setShowAddPlanting] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [selectedBedId, setSelectedBedId] = useState(null);

  // Delete confirmation state
  const [confirmDeleteZone, setConfirmDeleteZone] = useState(null);
  const [confirmDeleteBed, setConfirmDeleteBed] = useState(null);

  // Zone form state
  const [zoneName, setZoneName] = useState('');
  const [zoneSunExposure, setZoneSunExposure] = useState('full-sun');

  // Bed form state
  const [bedName, setBedName] = useState('');
  const [bedWidth, setBedWidth] = useState('0.8');
  const [bedLength, setBedLength] = useState('10');
  const [bedSection, setBedSection] = useState('');
  const [bedSunExposure, setBedSunExposure] = useState('');

  // Planting form state
  const [plantingCropId, setPlantingCropId] = useState('');
  const [plantingStartWeek, setPlantingStartWeek] = useState('');
  const [plantingNotes, setPlantingNotes] = useState('');
  const [plantingBedFraction, setPlantingBedFraction] = useState('1');

  // Succession planting state
  const [successionEnabled, setSuccessionEnabled] = useState(false);
  const [successionInterval, setSuccessionInterval] = useState('');
  const [successionEndMode, setSuccessionEndMode] = useState('endWeek');
  const [successionEndWeek, setSuccessionEndWeek] = useState('');
  const [successionCount, setSuccessionCount] = useState('4');

  // Summary stats (filtered by viewYear)
  const stats = useMemo(() => {
    const totalBeds = zones.reduce((sum, z) => sum + z.beds.length, 0);
    const totalArea = zones.reduce(
      (sum, z) => sum + z.beds.reduce((bSum, b) => bSum + bedArea(b), 0),
      0
    );
    const allPlantings = zones.flatMap(z => z.beds.flatMap(b => (b.plantings || []).filter(p => p.year === viewYear)));
    const uniqueCrops = new Set(allPlantings.map(p => p.cropId)).size;
    return {
      zoneCount: zones.length,
      totalBeds,
      totalArea: totalArea.toFixed(1),
      totalPlantings: allPlantings.length,
      uniqueCrops,
    };
  }, [zones, viewYear]);

  const rotationHint = useMemo(() => {
    if (!selectedZoneId || !selectedBedId) return null;
    return getQuickSuggestion(selectedBedId, rotationHistory || [], zones, crops,
      settings.currentYear || new Date().getFullYear());
  }, [selectedBedId, selectedZoneId, rotationHistory, zones, crops, settings]);

  // Companion suggestions for the Add Planting modal
  const companionSuggestions = useMemo(() => {
    if (!selectedZoneId || !selectedBedId) return null;
    const zone = zones.find(z => z.id === selectedZoneId);
    const bed = zone?.beds.find(b => b.id === selectedBedId);
    if (!bed || !bed.plantings || bed.plantings.length === 0) return null;
    const existingCropIds = bed.plantings
      .filter(p => p.year === viewYear)
      .map(p => p.cropId)
      .filter(Boolean);
    if (existingCropIds.length === 0) return null;
    const candidates = selectedCropIds.length > 0
      ? crops.filter(c => selectedCropIds.includes(c.id))
      : crops;
    return getCompanionSuggestions(existingCropIds, candidates, companionRules);
  }, [selectedZoneId, selectedBedId, zones, crops, viewYear, selectedCropIds]);

  // Succession preview
  const successionPreview = useMemo(() => {
    if (!successionEnabled || !plantingStartWeek || !successionInterval) return [];
    const startWk = parseInt(plantingStartWeek);
    const interval = parseInt(successionInterval);
    if (!startWk || !interval) return [];
    const crop = crops.find(c => c.id === plantingCropId);
    const opts = {
      season: crop?.season,
      firstFrostWeek: settings.firstFrostWeek,
      daysToMaturity: crop?.daysToMaturity,
    };
    if (successionEndMode === 'endWeek') {
      opts.endWeek = parseInt(successionEndWeek) || (settings.firstFrostWeek - Math.ceil((crop?.daysToMaturity || 60) / 7));
    } else {
      opts.count = parseInt(successionCount) || 4;
    }
    return generateSuccessionSequence(startWk, interval, opts);
  }, [successionEnabled, plantingStartWeek, successionInterval, successionEndMode, successionEndWeek, successionCount, plantingCropId, crops, settings]);

  // Handlers
  const handleAddZone = () => {
    if (!zoneName.trim()) return;
    const newZone = {
      id: generateId(),
      name: zoneName.trim(),
      sunExposure: zoneSunExposure,
      beds: [],
    };
    updateState(prev => ({
      ...prev,
      zones: [...prev.zones, newZone],
    }));
    setZoneName('');
    setZoneSunExposure('full-sun');
    setShowAddZone(false);
  };

  const handleAddBed = () => {
    if (!bedName.trim() || !selectedZoneId) return;
    const newBed = {
      id: generateId(),
      name: bedName.trim(),
      width: parseFloat(bedWidth) || 0.8,
      length: parseFloat(bedLength) || 6,
      section: bedSection.trim() || 'Main',
      sunExposure: bedSunExposure || null,
      plantings: [],
    };
    updateState(prev => ({
      ...prev,
      zones: prev.zones.map(z =>
        z.id === selectedZoneId
          ? { ...z, beds: [...z.beds, newBed] }
          : z
      ),
    }));
    setBedName('');
    setBedWidth('0.8');
    setBedLength('10');
    setBedSection('');
    setBedSunExposure('');
    setShowAddBed(false);
  };

  const [plantingError, setPlantingError] = useState('');

  const handleCropChange = (cropId) => {
    setPlantingCropId(cropId);
    const crop = crops.find(c => c.id === cropId);
    if (crop && crop.successionInterval > 0) {
      setSuccessionInterval(String(crop.successionInterval));
    } else {
      setSuccessionInterval('');
      setSuccessionEnabled(false);
    }
  };

  const handleAddPlanting = () => {
    if (!plantingCropId) { setPlantingError('Please select a crop.'); return; }
    if (!selectedZoneId || !selectedBedId) { setPlantingError('No bed selected.'); return; }
    setPlantingError('');
    const fraction = parseFloat(plantingBedFraction) || 1;
    const notes = plantingNotes.trim();

    if (successionEnabled && successionPreview.length > 1) {
      const batchId = generateId();
      const newPlantings = successionPreview.map((wk, idx) => ({
        id: generateId(),
        cropId: plantingCropId,
        startWeek: wk,
        year: viewYear,
        notes: notes || `Succession ${idx + 1}/${successionPreview.length}`,
        source: 'manual',
        bedFraction: fraction,
        batchId,
      }));
      updateState(prev => ({
        ...prev,
        zones: prev.zones.map(z =>
          z.id === selectedZoneId
            ? { ...z, beds: z.beds.map(b => b.id === selectedBedId ? { ...b, plantings: [...(b.plantings || []), ...newPlantings] } : b) }
            : z
        ),
      }));
      const crop = crops.find(c => c.id === plantingCropId);
      showToast(`Added ${newPlantings.length} succession plantings for ${crop?.name || 'crop'}`, { type: 'success' });
    } else {
      const newPlanting = {
        id: generateId(),
        cropId: plantingCropId,
        startWeek: parseInt(plantingStartWeek) || 1,
        year: viewYear,
        notes,
        source: 'manual',
        bedFraction: fraction,
        batchId: null,
      };
      updateState(prev => ({
        ...prev,
        zones: prev.zones.map(z =>
          z.id === selectedZoneId
            ? { ...z, beds: z.beds.map(b => b.id === selectedBedId ? { ...b, plantings: [...(b.plantings || []), newPlanting] } : b) }
            : z
        ),
      }));
    }

    setPlantingCropId('');
    setPlantingStartWeek('');
    setPlantingNotes('');
    setPlantingBedFraction('1');
    setSuccessionEnabled(false);
    setSuccessionInterval('');
    setSuccessionEndWeek('');
    setSuccessionCount('4');
    setSuccessionEndMode('endWeek');
    setShowAddPlanting(false);
  };

  const [confirmDeletePlanting, setConfirmDeletePlanting] = useState(null);

  const handleDeletePlanting = (zoneId, bedId, plantingId) => {
    const zone = zones.find(z => z.id === zoneId);
    const bed = zone?.beds.find(b => b.id === bedId);
    const planting = bed?.plantings?.find(p => p.id === plantingId);
    updateState(prev => ({
      ...prev,
      zones: prev.zones.map(z =>
        z.id === zoneId
          ? {
              ...z,
              beds: z.beds.map(b =>
                b.id === bedId
                  ? { ...b, plantings: (b.plantings || []).filter(p => p.id !== plantingId) }
                  : b
              ),
            }
          : z
      ),
    }));
    setConfirmDeletePlanting(null);
    if (planting) {
      const crop = crops.find(c => c.id === planting.cropId);
      showToast(`Planting "${crop?.name || 'entry'}" removed`, {
        type: 'warning',
        undo: () => updateState(prev => ({
          ...prev,
          zones: prev.zones.map(z =>
            z.id === zoneId
              ? { ...z, beds: z.beds.map(b => b.id === bedId ? { ...b, plantings: [...(b.plantings || []), planting] } : b) }
              : z
          ),
        })),
      });
    }
  };

  const handleDeleteBatch = (zoneId, bedId, batchId) => {
    const zone = zones.find(z => z.id === zoneId);
    const bed = zone?.beds.find(b => b.id === bedId);
    const batchPlantings = bed?.plantings?.filter(p => p.batchId === batchId) || [];
    updateState(prev => ({
      ...prev,
      zones: prev.zones.map(z =>
        z.id === zoneId
          ? { ...z, beds: z.beds.map(b => b.id === bedId ? { ...b, plantings: (b.plantings || []).filter(p => p.batchId !== batchId) } : b) }
          : z
      ),
    }));
    const crop = crops.find(c => c.id === batchPlantings[0]?.cropId);
    showToast(`Removed ${batchPlantings.length} "${crop?.name || ''}" succession plantings`, {
      type: 'warning',
      undo: () => updateState(prev => ({
        ...prev,
        zones: prev.zones.map(z =>
          z.id === zoneId
            ? { ...z, beds: z.beds.map(b => b.id === bedId ? { ...b, plantings: [...(b.plantings || []), ...batchPlantings] } : b) }
            : z
        ),
      })),
    });
  };

  const handleDeleteZone = (zoneId) => {
    const zone = zones.find(z => z.id === zoneId);
    updateState(prev => ({
      ...prev,
      zones: prev.zones.filter(z => z.id !== zoneId),
    }));
    setConfirmDeleteZone(null);
    if (zone) {
      showToast(`Zone "${zone.name}" and all its beds deleted`, {
        type: 'warning',
        undo: () => updateState(prev => ({ ...prev, zones: [...prev.zones, zone] })),
      });
    }
  };

  const handleDeleteBed = (zoneId, bedId) => {
    const zone = zones.find(z => z.id === zoneId);
    const bed = zone?.beds.find(b => b.id === bedId);
    updateState(prev => ({
      ...prev,
      zones: prev.zones.map(z =>
        z.id === zoneId
          ? { ...z, beds: z.beds.filter(b => b.id !== bedId) }
          : z
      ),
    }));
    setConfirmDeleteBed(null);
    if (bed) {
      showToast(`Bed "${bed.name}" deleted`, {
        type: 'warning',
        undo: () => updateState(prev => ({
          ...prev,
          zones: prev.zones.map(z =>
            z.id === zoneId ? { ...z, beds: [...z.beds, bed] } : z
          ),
        })),
      });
    }
  };

  const handleUpdateZoneSun = (zoneId, value) => {
    updateState(prev => ({
      ...prev,
      zones: prev.zones.map(z => z.id === zoneId ? { ...z, sunExposure: value } : z),
    }));
  };

  const openAddBed = (zoneId) => {
    setSelectedZoneId(zoneId);
    setBedName('');
    setBedWidth('0.8');
    setBedLength('10');
    setBedSection('');
    setBedSunExposure('');
    setShowAddBed(true);
  };

  const openAddPlanting = (zoneId, bedId) => {
    setSelectedZoneId(zoneId);
    setSelectedBedId(bedId);
    setPlantingCropId('');
    setPlantingStartWeek('');
    setPlantingNotes('');
    setPlantingBedFraction('1');
    setSuccessionEnabled(false);
    setSuccessionInterval('');
    setSuccessionEndWeek('');
    setSuccessionCount('4');
    setSuccessionEndMode('endWeek');
    setShowAddPlanting(true);
  };

  const headingFont = "'DM Serif Display', serif";
  const bodyFont = "'Libre Franklin', sans-serif";

  const currentWeek = getCurrentWeek();
  const seasonPhase = getSeasonPhase(currentWeek, settings.lastFrostWeek || 12, settings.firstFrostWeek || 44);

  const seasonTips = {
    'Winter': 'Plan your beds, order seeds, and review last season.',
    'Pre-Spring': 'Start indoor seedlings and prepare beds for the season.',
    'Spring': 'Transplant seedlings, direct-sow hardy crops, and watch for late frosts.',
    'Summer': 'Keep up with watering, harvesting, and succession planting.',
    'Fall': 'Plant cover crops, harvest storage crops, and extend the season.',
    'Late Fall': 'Mulch beds, clean up, and start planning next year.',
  };

  return (
    <div style={{ fontFamily: bodyFont }}>
      {/* Season Banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '16px',
        padding: '14px 20px', borderRadius: '12px', marginBottom: '20px',
        background: `linear-gradient(135deg, ${seasonPhase.color}22, ${seasonPhase.color}11)`,
        border: `1px solid ${seasonPhase.color}44`,
      }}>
        <span style={{ fontSize: '32px' }}>{seasonPhase.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '16px', color: theme.text, fontFamily: headingFont }}>{seasonPhase.name}</strong>
            <span style={{ fontSize: '13px', color: theme.textSecondary }}>Week {currentWeek} of 52</span>
          </div>
          <div style={{ fontSize: '13px', color: theme.textSecondary, marginTop: '2px' }}>
            {seasonTips[seasonPhase.name] || ''}
          </div>
        </div>
      </div>

      {/* Year Selector + Summary Cards */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <YearSelector value={viewYear} onChange={setViewYear} />
        <span style={{ fontSize: '13px', color: theme.textMuted }}>Season {viewYear}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
        <SummaryCard icon="🗺️" label="Zones" value={stats.zoneCount} />
        <SummaryCard icon="🛏️" label="Total Beds" value={stats.totalBeds} />
        <SummaryCard icon="📐" label="Growing Area (m²)" value={stats.totalArea} />
        <SummaryCard icon="🌱" label="Active Plantings" value={stats.totalPlantings} />
        <SummaryCard icon="🌿" label="Crop Varieties" value={stats.uniqueCrops} />
      </div>

      {/* This Week's Actions */}
      <ThisWeekSummary />

      {/* Weather alerts + frost date suggestion */}
      <WeatherAlertBanner onNavigate={onNavigate} />
      <FrostDateSuggestion />

      {/* Farm Map */}
      <Card style={{ marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}>
          <h2 style={{
            margin: 0,
            fontFamily: headingFont,
            fontSize: '18px',
            color: theme.text,
          }}>
            Farm Map
          </h2>
          <Button onClick={() => setShowAddZone(true)} style={{ fontSize: '12px', padding: '6px 14px' }}>
            + Add Zone
          </Button>
        </div>
        {zones.length > 0 ? (
          <FarmMap />
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: theme.textMuted,
            fontSize: '13px',
            fontStyle: 'italic',
          }}>
            Add zones and beds to see them on the map
          </div>
        )}
      </Card>

      {/* Zone Details */}
      {zones.map((zone) => {
        const sections = {};
        for (const bed of zone.beds) {
          const sec = bed.section || 'Main';
          if (!sections[sec]) sections[sec] = [];
          sections[sec].push(bed);
        }
        const sectionEntries = Object.entries(sections);
        const zoneArea = zone.beds.reduce((sum, b) => sum + bedArea(b), 0).toFixed(1);

        return (
          <Card key={zone.id} style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h2 style={{
                    margin: 0,
                    fontFamily: headingFont,
                    fontSize: '18px',
                    color: theme.text,
                  }}>
                    {zone.name}
                  </h2>
                  {zone.sunExposure && sunExposureLabels[zone.sunExposure] && (
                    <Badge
                      bg={sunExposureLabels[zone.sunExposure].color}
                      color="#fff"
                      style={{ fontSize: '10px' }}
                    >
                      {sunExposureLabels[zone.sunExposure].icon} {sunExposureLabels[zone.sunExposure].label}
                    </Badge>
                  )}
                  <select
                    value={zone.sunExposure || 'full-sun'}
                    onChange={e => handleUpdateZoneSun(zone.id, e.target.value)}
                    style={{
                      fontSize: '11px', padding: '2px 6px', borderRadius: '6px',
                      border: `1px solid ${theme.borderLight}`, background: theme.bgInput || theme.bg,
                      color: theme.textSecondary, cursor: 'pointer',
                    }}
                  >
                    {sunExposureOptions.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <span style={{
                  fontSize: '12px',
                  color: theme.textMuted,
                }}>
                  {zone.beds.length} bed{zone.beds.length !== 1 ? 's' : ''} &middot; {zoneArea} m²
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <Button
                  onClick={() => setConfirmDeleteZone(zone.id)}
                  variant="ghost"
                  style={{ fontSize: '11px', padding: '5px 10px', color: theme.error || '#e74c3c' }}
                >
                  🗑️ Delete
                </Button>
                <Button
                  onClick={() => openAddBed(zone.id)}
                  variant="secondary"
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  + Add Bed
                </Button>
              </div>
            </div>

            {sectionEntries.map(([sectionName, beds]) => (
              <div key={sectionName} style={{ marginBottom: '16px' }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: theme.textSecondary,
                  marginBottom: '8px',
                  paddingBottom: '4px',
                  borderBottom: `1px solid ${theme.borderLight}`,
                  fontFamily: bodyFont,
                  letterSpacing: '0.3px',
                  textTransform: 'uppercase',
                }}>
                  {sectionName}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {beds.map((bed) => {
                    const area = bedArea(bed);
                    const rotationWarns = getRotationWarnings(bed, crops);
                    const companionWarns = getCompanionWarnings(bed, crops);
                    const yearPlantingsForHealth = (bed.plantings || []).filter(p => p.year === viewYear);
                    const companionHealth = getCompanionHealth(yearPlantingsForHealth, crops, companionRules);
                    const healthLevel = getCompanionHealthLevel(companionHealth);
                    const hasWarnings = rotationWarns.length > 0 || companionWarns.length > 0;
                    const bedColor = getBedFamilyColor(bed, crops);

                    return (
                      <div
                        key={bed.id}
                        style={{
                          background: theme.bgHover || theme.bg,
                          borderRadius: '8px',
                          padding: '12px 14px',
                          border: `1px solid ${hasWarnings ? theme.warning : theme.borderLight}`,
                          borderLeft: `4px solid ${bedColor}`,
                        }}
                      >
                        {/* Bed Header */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: bed.plantings?.length || hasWarnings ? '8px' : '0',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              fontWeight: '600',
                              fontSize: '14px',
                              color: theme.text,
                              fontFamily: headingFont,
                            }}>
                              {bed.name}
                            </span>
                            <span style={{
                              fontSize: '11px',
                              color: theme.textMuted,
                            }}>
                              {bed.width}m &times; {bed.length}m
                            </span>
                            <Badge
                              bg={theme.accentLight}
                              color={theme.accent}
                              style={{ fontSize: '10px' }}
                            >
                              {area} m²
                            </Badge>
                            {(() => {
                              const effectiveSun = bed.sunExposure || zone.sunExposure;
                              const sunInfo = effectiveSun && sunExposureLabels[effectiveSun];
                              return sunInfo ? (
                                <Badge bg={sunInfo.color + '30'} color={sunInfo.color} style={{ fontSize: '9px' }}>
                                  {sunInfo.icon}
                                </Badge>
                              ) : null;
                            })()}
                            {healthLevel !== 'gray' && (() => {
                              const synergies = companionHealth.great + companionHealth.good;
                              const conflicts = companionHealth.bad;
                              const cfg = {
                                green:  { bg: '#e8f5e9', color: '#2e7d32', icon: '💚' },
                                orange: { bg: '#fff3e0', color: '#f57c00', icon: '⚠️' },
                                red:    { bg: '#ffebee', color: '#c62828', icon: '⚠️' },
                              }[healthLevel];
                              const label = healthLevel === 'green'
                                ? `${synergies} synerg${synergies === 1 ? 'y' : 'ies'}`
                                : healthLevel === 'orange'
                                ? `${conflicts} conflict${conflicts !== 1 ? 's' : ''} · ${synergies} synerg${synergies === 1 ? 'y' : 'ies'}`
                                : `${conflicts} conflict${conflicts !== 1 ? 's' : ''}`;
                              return (
                                <Badge bg={cfg.bg} color={cfg.color} style={{ fontSize: '9px' }}>
                                  {cfg.icon} {label}
                                </Badge>
                              );
                            })()}
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <Button
                              onClick={() => setConfirmDeleteBed({ zoneId: zone.id, bedId: bed.id })}
                              variant="ghost"
                              style={{ fontSize: '11px', padding: '4px 8px', color: theme.error || '#e74c3c' }}
                            >
                              🗑️
                            </Button>
                            <Button
                              onClick={() => openAddPlanting(zone.id, bed.id)}
                              variant="ghost"
                              style={{ fontSize: '11px', padding: '4px 10px' }}
                            >
                              + Plant
                            </Button>
                          </div>
                        </div>

                        {/* Bed Capacity Bar */}
                        {(() => {
                          const yp = (bed.plantings || []).filter(p => p.year === viewYear);
                          if (yp.length === 0) return null;
                          const used = yp.reduce((s, p) => s + (p.bedFraction || 1), 0);
                          const pct = Math.min(used * 100, 100);
                          const over = used > 1;
                          return (
                            <div style={{ marginBottom: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                <div style={{
                                  flex: 1, height: '4px', borderRadius: '2px',
                                  background: theme.borderLight,
                                  overflow: 'hidden',
                                }}>
                                  <div style={{
                                    width: `${pct}%`, height: '100%', borderRadius: '2px',
                                    background: over ? (theme.error || '#e74c3c') : theme.accent,
                                    transition: 'width 0.3s',
                                  }} />
                                </div>
                                <span style={{ fontSize: '10px', color: over ? (theme.error || '#e74c3c') : theme.textMuted, fontWeight: over ? '700' : '400', whiteSpace: 'nowrap' }}>
                                  {Math.round(used * 100)}% used
                                </span>
                              </div>
                              {over && (
                                <div style={{ fontSize: '10px', color: theme.error || '#e74c3c', fontWeight: '600' }}>
                                  ⚠️ Over-allocated ({(used * 100).toFixed(0)}% — exceeds bed capacity)
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Warnings */}
                        {rotationWarns.length > 0 && (
                          <div style={{ marginBottom: '6px' }}>
                            {rotationWarns.map((w, idx) => (
                              <div key={idx} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '11px',
                                color: theme.warning,
                                background: theme.warningLight,
                                borderRadius: '6px',
                                padding: '4px 8px',
                                marginBottom: '3px',
                              }}>
                                <span>🔄</span>
                                <span>
                                  Rotation warning: {w.crops.join(' & ')} are both <strong>{w.family}</strong>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {companionWarns.length > 0 && (
                          <div style={{ marginBottom: '6px' }}>
                            {companionWarns.map((w, idx) => (
                              <div key={idx} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '11px',
                                color: theme.error,
                                background: theme.errorLight,
                                borderRadius: '6px',
                                padding: '4px 8px',
                                marginBottom: '3px',
                              }}>
                                <span>⚠️</span>
                                <span>
                                  {w.crop1} + {w.crop2}: {w.reason}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Plantings (filtered by year) with batch grouping */}
                        {(() => {
                          const yearPlantings = (bed.plantings || []).filter(p => p.year === viewYear);
                          if (yearPlantings.length === 0) return (
                            <div style={{ fontSize: '11px', color: theme.textMuted, fontStyle: 'italic' }}>
                              No plantings for {viewYear}
                            </div>
                          );

                          // Group by batchId
                          const batches = {};
                          const singles = [];
                          for (const p of yearPlantings) {
                            if (p.batchId) {
                              if (!batches[p.batchId]) batches[p.batchId] = [];
                              batches[p.batchId].push(p);
                            } else {
                              singles.push(p);
                            }
                          }
                          for (const key of Object.keys(batches)) {
                            batches[key].sort((a, b) => a.startWeek - b.startWeek);
                          }

                          const renderPlantingChip = (planting) => {
                            const crop = crops.find(c => c.id === planting.cropId);
                            const fColor = crop ? (familyColors[crop.family] || theme.accent) : theme.textMuted;
                            const otherCropIds = yearPlantings.filter(p => p.id !== planting.id).map(p => p.cropId).filter(Boolean);
                            const companionStatus = getCropCompanionStatus(planting.cropId, otherCropIds, companionRules);
                            return (
                              <div key={planting.id} style={{
                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                background: theme.bgCard, borderRadius: '6px', padding: '4px 8px',
                                border: `1px solid ${theme.borderLight}`, fontSize: '12px',
                              }}>
                                <span style={{ fontSize: '14px' }}>{crop?.icon || '🌱'}</span>
                                <span style={{ fontWeight: '500', color: fColor }}>{crop?.name || planting.cropId}</span>
                                {companionStatus.worst && (() => {
                                  const cfg = { great: { icon: '💚', color: '#2e7d32' }, good: { icon: '✅', color: '#558b2f' }, bad: { icon: '⚠️', color: '#c62828' } }[companionStatus.worst];
                                  const tip = companionStatus.relationships.map(r => {
                                    const other = crops.find(c => c.id === r.otherCropId);
                                    return `${r.type === 'great' ? 'Synergistic' : r.type === 'good' ? 'Good' : 'Conflict'} with ${other?.name || r.otherCropId}: ${r.reason}`;
                                  }).join('\n');
                                  return <span title={tip} style={{ fontSize: '11px', cursor: 'help', color: cfg.color }}>{cfg.icon}</span>;
                                })()}
                                {planting.source === 'demand' && (
                                  <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', background: '#e67e22', color: '#fff', fontWeight: '700' }}>🎯 Demand</span>
                                )}
                                {(planting.bedFraction || 1) < 1 && (
                                  <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', background: theme.accentLight || '#e8f5e9', color: theme.accent, fontWeight: '700' }}>
                                    {planting.bedFraction === 0.5 ? '½' : '¼'}
                                  </span>
                                )}
                                {planting.startWeek && <span style={{ fontSize: '10px', color: theme.textMuted }}>W{planting.startWeek}</span>}
                                {planting.notes && (
                                  <span title={planting.notes} style={{ fontSize: '10px', color: theme.textMuted, maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {planting.notes}
                                  </span>
                                )}
                                <button onClick={() => setConfirmDeletePlanting({ zoneId: zone.id, bedId: bed.id, plantingId: planting.id, cropId: planting.cropId })}
                                  title="Remove planting"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, fontSize: '13px', padding: '0 2px', lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                                  &times;
                                </button>
                              </div>
                            );
                          };

                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {/* Succession batches */}
                              {Object.entries(batches).map(([batchId, plantings]) => {
                                const crop = crops.find(c => c.id === plantings[0].cropId);
                                return (
                                  <div key={batchId} style={{
                                    border: `1px dashed ${theme.accent}66`,
                                    borderRadius: '8px', padding: '6px 8px',
                                    background: `${theme.accent}08`,
                                  }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                      <span style={{ fontSize: '11px', fontWeight: '600', color: theme.accent }}>
                                        🔄 {crop?.icon} {crop?.name} &times;{plantings.length} succession
                                      </span>
                                      <button onClick={() => handleDeleteBatch(zone.id, bed.id, batchId)}
                                        style={{
                                          background: 'none', border: `1px solid #fecaca`, borderRadius: '4px',
                                          color: '#dc2626', fontSize: '10px', cursor: 'pointer', padding: '1px 6px',
                                          fontWeight: '600',
                                        }}>
                                        Delete all
                                      </button>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', alignItems: 'center' }}>
                                      {plantings.map((p, idx) => (
                                        <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                          {idx > 0 && <span style={{ color: theme.textMuted, fontSize: '10px' }}>&rarr;</span>}
                                          <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                                            padding: '2px 6px', borderRadius: '4px', fontSize: '10px',
                                            background: theme.bgCard, border: `1px solid ${theme.borderLight}`,
                                            color: theme.text,
                                          }}>
                                            W{p.startWeek}
                                            <button onClick={() => setConfirmDeletePlanting({ zoneId: zone.id, bedId: bed.id, plantingId: p.id, cropId: p.cropId })}
                                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, fontSize: '11px', padding: 0, lineHeight: 1 }}>
                                              &times;
                                            </button>
                                          </span>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Regular plantings */}
                              {singles.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                  {singles.map(renderPlantingChip)}
                                </div>
                              )}

                              {/* Pairs well with hint */}
                              {(() => {
                                const existingIds = yearPlantings.map(p => p.cropId).filter(Boolean);
                                const candidates = selectedCropIds.length > 0
                                  ? crops.filter(c => selectedCropIds.includes(c.id))
                                  : crops;
                                const sugg = getCompanionSuggestions(existingIds, candidates, companionRules);
                                const topSuggestions = [...sugg.great, ...sugg.good].slice(0, 3);
                                if (topSuggestions.length === 0) return null;
                                return (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                                    <span style={{ fontSize: '10px', color: theme.textMuted, fontWeight: '600' }}>Pairs well with:</span>
                                    {topSuggestions.map(s => (
                                      <span key={s.cropId} title={s.relationships.map(r => r.reason).join('; ')}
                                        style={{
                                          fontSize: '11px', cursor: 'help',
                                          color: s.relationships.some(r => r.type === 'great') ? '#2e7d32' : '#558b2f',
                                        }}>
                                        {s.cropIcon} {s.cropName}
                                      </span>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {zone.beds.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '24px',
                color: theme.textMuted,
                fontSize: '13px',
                fontStyle: 'italic',
              }}>
                No beds in this zone yet. Click "+ Add Bed" to get started.
              </div>
            )}
          </Card>
        );
      })}

      {zones.length === 0 && (
        <Card>
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: theme.textMuted,
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🗺️</div>
            <h3 style={{ fontFamily: "'DM Serif Display', serif", color: theme.text, margin: '0 0 8px', fontSize: '20px' }}>
              Welcome to Your Farm
            </h3>
            <p style={{
              fontSize: '14px',
              fontFamily: bodyFont,
              margin: '0 0 24px 0',
              color: theme.textSecondary,
              lineHeight: '1.6',
            }}>
              Get started by creating a sample farm layout or building from scratch.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button onClick={() => {
                const starterCropIds = ['lettuce','tomato','carrot','basil','zucchini','kale','green-bean','sweet-pepper','cucumber','beet'];
                const sampleBeds = Array.from({ length: 4 }, (_, i) => ({
                  id: generateId(),
                  name: `Bed ${i + 1}`,
                  width: 0.75,
                  length: 10,
                  section: '',
                  sunExposure: 'full-sun',
                  plantings: [],
                }));
                const sampleZone = {
                  id: generateId(),
                  name: 'Zone 1',
                  sunExposure: 'full-sun',
                  beds: sampleBeds,
                };
                const validIds = starterCropIds.filter(id => crops.some(c => c.id === id));
                updateState(prev => ({
                  ...prev,
                  zones: [sampleZone],
                  selectedCropIds: [...new Set([...(prev.selectedCropIds || []), ...validIds])],
                  setupProgress: { ...prev.setupProgress, farmSetupDone: true },
                }));
                showToast('Sample farm created with 1 zone, 4 beds, and 10 starter crops!', { type: 'success' });
              }}>
                🌱 Create Sample Farm
              </Button>
              <Button variant="secondary" onClick={() => setShowAddZone(true)}>+ Start from Scratch</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Add Zone Modal */}
      <Modal open={showAddZone} onClose={() => setShowAddZone(false)} title="Add Growing Zone">
        <FormField label="Zone Name">
          <Input
            value={zoneName}
            onChange={e => setZoneName(e.target.value)}
            placeholder="e.g. North Garden, Greenhouse"
          />
        </FormField>
        <FormField label="Sun Exposure">
          <Select value={zoneSunExposure} onChange={e => setZoneSunExposure(e.target.value)}>
            {sunExposureOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </FormField>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <Button variant="ghost" onClick={() => setShowAddZone(false)}>Cancel</Button>
          <Button onClick={handleAddZone}>Add Zone</Button>
        </div>
      </Modal>

      {/* Add Bed Modal */}
      <Modal open={showAddBed} onClose={() => setShowAddBed(false)} title="Add Bed">
        <FormField label="Bed Name">
          <Input
            value={bedName}
            onChange={e => setBedName(e.target.value)}
            placeholder="e.g. B-7, GH-Center 3"
          />
        </FormField>
        <div style={{ display: 'flex', gap: '12px' }}>
          <FormField label="Width (m)" style={{ flex: 1 }}>
            <Input
              type="number"
              value={bedWidth}
              onChange={e => setBedWidth(e.target.value)}
              step="0.1"
              min="0.1"
            />
          </FormField>
          <FormField label="Length (m)" style={{ flex: 1 }}>
            <Input
              type="number"
              value={bedLength}
              onChange={e => setBedLength(e.target.value)}
              step="0.5"
              min="0.5"
            />
          </FormField>
        </div>
        <FormField label="Section">
          <Input
            value={bedSection}
            onChange={e => setBedSection(e.target.value)}
            placeholder="e.g. South, North, Central"
          />
        </FormField>
        <FormField label="Sun Exposure (override)">
          <Select value={bedSunExposure} onChange={e => setBedSunExposure(e.target.value)}>
            <option value="">Inherit from zone</option>
            {sunExposureOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </FormField>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <Button variant="ghost" onClick={() => setShowAddBed(false)}>Cancel</Button>
          <Button onClick={handleAddBed}>Add Bed</Button>
        </div>
      </Modal>

      {/* Add Planting Modal */}
      <Modal open={showAddPlanting} onClose={() => setShowAddPlanting(false)} title="Add Planting">
        {rotationHint && (rotationHint.recommended.length > 0 || rotationHint.avoid.length > 0) && (
          <div style={{
            marginBottom: '14px',
            borderRadius: '8px',
            border: `1px solid ${theme.borderLight}`,
            background: theme.bgHover,
            padding: '10px 12px',
          }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: theme.text, marginBottom: '6px' }}>
              💡 Rotation Suggestion
            </div>
            {rotationHint.recommended.length > 0 && (
              <div style={{ marginBottom: '4px' }}>
                {rotationHint.recommended.map(r => (
                  <div key={r.family} style={{ fontSize: '11px', color: '#4caf50', marginBottom: '2px' }}>
                    ✓ {r.family} — {r.reason}
                  </div>
                ))}
              </div>
            )}
            {rotationHint.avoid.length > 0 && (
              <div>
                {rotationHint.avoid.map(a => (
                  <div key={a.family} style={{ fontSize: '11px', color: '#e53935', marginBottom: '2px' }}>
                    ✗ Avoid {a.family} ({a.yearsRemaining}yr remaining)
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Companion Suggestions */}
        {companionSuggestions && (companionSuggestions.great.length > 0 || companionSuggestions.good.length > 0) && (
          <div style={{
            marginBottom: '14px', borderRadius: '8px',
            border: `1px solid ${theme.borderLight}`, background: theme.bgHover,
            padding: '10px 12px',
          }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: theme.text, marginBottom: '6px' }}>
              🤝 Companion Suggestions
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: companionSuggestions.bad.length > 0 ? '6px' : '0' }}>
              {companionSuggestions.great.map(s => (
                <span key={s.cropId}
                  onClick={() => handleCropChange(s.cropId)}
                  title={s.relationships.map(r => r.reason).join('; ')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                    padding: '3px 8px', borderRadius: '10px', fontSize: '11px',
                    background: '#e8f5e9', color: '#2e7d32', cursor: 'pointer',
                    border: '1px solid #c8e6c9', fontWeight: '500',
                  }}>
                  💚 {s.cropIcon} {s.cropName}
                </span>
              ))}
              {companionSuggestions.good.map(s => (
                <span key={s.cropId}
                  onClick={() => handleCropChange(s.cropId)}
                  title={s.relationships.map(r => r.reason).join('; ')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                    padding: '3px 8px', borderRadius: '10px', fontSize: '11px',
                    background: '#f1f8e9', color: '#558b2f', cursor: 'pointer',
                    border: '1px solid #dcedc8', fontWeight: '500',
                  }}>
                  ✅ {s.cropIcon} {s.cropName}
                </span>
              ))}
            </div>
            {companionSuggestions.bad.length > 0 && (
              <div style={{ fontSize: '11px', color: '#c62828' }}>
                ⚠️ Avoid: {companionSuggestions.bad.map(s => s.cropName).join(', ')}
              </div>
            )}
          </div>
        )}

        <FormField label="Crop">
          <Select
            value={plantingCropId}
            onChange={e => handleCropChange(e.target.value)}
          >
            <option value="">Select a crop...</option>
            {[...crops]
              .sort((a, b) => a.family.localeCompare(b.family) || a.name.localeCompare(b.name))
              .map(crop => (
                <option key={crop.id} value={crop.id}>
                  {crop.icon} {crop.name} ({crop.family})
                </option>
              ))
            }
          </Select>
        </FormField>
        <FormField label="Start Week (1-52)">
          <Input
            type="number"
            value={plantingStartWeek}
            onChange={e => setPlantingStartWeek(e.target.value)}
            min="1"
            max="52"
            placeholder="e.g. 12"
          />
        </FormField>
        {/* Succession Planting Toggle */}
        {(() => {
          const crop = crops.find(c => c.id === plantingCropId);
          if (!crop || !crop.successionInterval || crop.successionInterval <= 0) return null;
          return (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', marginTop: '4px' }}>
                <input
                  type="checkbox" checked={successionEnabled}
                  onChange={e => setSuccessionEnabled(e.target.checked)}
                  id="succession-toggle"
                  style={{ accentColor: theme.accent }}
                />
                <label htmlFor="succession-toggle" style={{ fontSize: '13px', fontWeight: '500', color: theme.text, cursor: 'pointer' }}>
                  🔄 Create succession sequence
                </label>
              </div>
              {successionEnabled && (
                <div style={{
                  padding: '10px 12px', borderRadius: '8px',
                  border: `1px solid ${theme.borderLight}`, background: theme.bgHover,
                  marginBottom: '12px',
                }}>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                    <FormField label="Interval (days)" style={{ flex: 1, marginBottom: 0 }}>
                      <Input type="number" value={successionInterval}
                        onChange={e => setSuccessionInterval(e.target.value)}
                        min="7" step="7" />
                    </FormField>
                    <FormField label="End by" style={{ flex: 1, marginBottom: 0 }}>
                      <Select value={successionEndMode} onChange={e => setSuccessionEndMode(e.target.value)}>
                        <option value="endWeek">Last sow week</option>
                        <option value="count">Number of sowings</option>
                      </Select>
                    </FormField>
                  </div>
                  {successionEndMode === 'endWeek' ? (
                    <FormField label="Last Sow Week" style={{ marginBottom: 0 }}>
                      <Input type="number" value={successionEndWeek}
                        onChange={e => setSuccessionEndWeek(e.target.value)}
                        min="1" max="52"
                        placeholder={`Default: W${settings.firstFrostWeek - Math.ceil((crop.daysToMaturity || 60) / 7)}`} />
                    </FormField>
                  ) : (
                    <FormField label="Number of Sowings" style={{ marginBottom: 0 }}>
                      <Input type="number" value={successionCount}
                        onChange={e => setSuccessionCount(e.target.value)}
                        min="2" max="26" />
                    </FormField>
                  )}
                  {successionPreview.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: theme.textSecondary, marginBottom: '4px' }}>
                        Preview: {successionPreview.length} sowings
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                        {successionPreview.map((wk, i) => (
                          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                            {i > 0 && <span style={{ color: theme.textMuted, fontSize: '10px' }}>&rarr;</span>}
                            <Badge bg={theme.accentLight || '#e8f5e9'} color={theme.accent}>W{wk}</Badge>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          );
        })()}

        <FormField label="Bed Portion">
          <Select value={plantingBedFraction} onChange={e => setPlantingBedFraction(e.target.value)}>
            <option value="1">Full bed</option>
            <option value="0.5">Half bed (½)</option>
            <option value="0.25">Quarter bed (¼)</option>
          </Select>
        </FormField>
        <FormField label="Notes (optional)">
          <Input
            value={plantingNotes}
            onChange={e => setPlantingNotes(e.target.value)}
            placeholder="e.g. succession #2, direct sow"
          />
        </FormField>

        {/* Preview companion checks */}
        {plantingCropId && selectedZoneId && selectedBedId && (() => {
          const zone = zones.find(z => z.id === selectedZoneId);
          const bed = zone?.beds.find(b => b.id === selectedBedId);
          if (!bed || !bed.plantings || bed.plantings.length === 0) return null;

          const existingCropIds = bed.plantings.map(p => p.cropId);
          const newCrop = crops.find(c => c.id === plantingCropId);
          const issues = [];

          // Rotation check
          if (newCrop) {
            for (const pid of existingCropIds) {
              const existing = crops.find(c => c.id === pid);
              if (existing && existing.family === newCrop.family) {
                issues.push({
                  type: 'rotation',
                  message: `Same family (${newCrop.family}) as ${existing.name}`,
                });
              }
            }
          }

          // Companion check
          for (const pid of existingCropIds) {
            const rule = companionRules.find(
              r => r.type === 'bad' &&
                ((r.crop1 === plantingCropId && r.crop2 === pid) ||
                 (r.crop1 === pid && r.crop2 === plantingCropId))
            );
            if (rule) {
              const other = crops.find(c => c.id === pid);
              issues.push({
                type: 'companion',
                message: `Bad companion with ${other?.name || pid}: ${rule.reason}`,
              });
            }
          }

          if (issues.length === 0) return null;

          return (
            <div style={{
              marginTop: '8px',
              borderRadius: '8px',
              border: `1px solid ${theme.warning}`,
              background: theme.warningLight,
              padding: '10px 12px',
            }}>
              <div style={{
                fontSize: '12px',
                fontWeight: '600',
                color: theme.warning,
                marginBottom: '4px',
              }}>
                Planting Alerts
              </div>
              {issues.map((issue, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  color: issue.type === 'rotation' ? theme.warning : theme.error,
                  marginBottom: '2px',
                }}>
                  <span>{issue.type === 'rotation' ? '🔄' : '⚠️'}</span>
                  <span>{issue.message}</span>
                </div>
              ))}
            </div>
          );
        })()}

        {plantingError && <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '8px' }}>{plantingError}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <Button variant="ghost" onClick={() => setShowAddPlanting(false)}>Cancel</Button>
          <Button onClick={handleAddPlanting} disabled={!plantingCropId}>Add Planting</Button>
        </div>
      </Modal>

      {/* Delete Zone Confirmation Modal */}
      <Modal open={!!confirmDeleteZone} onClose={() => setConfirmDeleteZone(null)} title="Delete Zone?" width="400px">
        {(() => {
          const zone = zones.find(z => z.id === confirmDeleteZone);
          if (!zone) return null;
          const plantingCount = zone.beds.reduce((sum, b) => sum + (b.plantings?.length || 0), 0);
          return (
            <div>
              <p style={{ fontSize: '13px', color: theme.text, margin: '0 0 12px 0', fontFamily: bodyFont }}>
                Are you sure you want to delete <strong>{zone.name}</strong>?
              </p>
              <div style={{
                background: theme.errorLight || '#fde8e8',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '12px',
                color: theme.error || '#e74c3c',
                marginBottom: '16px',
              }}>
                This will permanently remove:
                <ul style={{ margin: '6px 0 0 0', paddingLeft: '18px' }}>
                  <li>{zone.beds.length} bed{zone.beds.length !== 1 ? 's' : ''}</li>
                  <li>{plantingCount} planting{plantingCount !== 1 ? 's' : ''}</li>
                </ul>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <Button variant="ghost" onClick={() => setConfirmDeleteZone(null)}>Cancel</Button>
                <Button
                  onClick={() => handleDeleteZone(zone.id)}
                  style={{ background: theme.error || '#e74c3c', borderColor: theme.error || '#e74c3c' }}
                >
                  Delete Zone
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Delete Bed Confirmation Modal */}
      <Modal open={!!confirmDeleteBed} onClose={() => setConfirmDeleteBed(null)} title="Delete Bed?" width="400px">
        {(() => {
          if (!confirmDeleteBed) return null;
          const zone = zones.find(z => z.id === confirmDeleteBed.zoneId);
          const bed = zone?.beds.find(b => b.id === confirmDeleteBed.bedId);
          if (!bed) return null;
          const plantingCount = bed.plantings?.length || 0;
          return (
            <div>
              <p style={{ fontSize: '13px', color: theme.text, margin: '0 0 12px 0', fontFamily: bodyFont }}>
                Are you sure you want to delete <strong>{bed.name}</strong> from {zone.name}?
              </p>
              {plantingCount > 0 && (
                <div style={{
                  background: theme.errorLight || '#fde8e8',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '12px',
                  color: theme.error || '#e74c3c',
                  marginBottom: '16px',
                }}>
                  This bed has {plantingCount} planting{plantingCount !== 1 ? 's' : ''} that will be lost.
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <Button variant="ghost" onClick={() => setConfirmDeleteBed(null)}>Cancel</Button>
                <Button
                  onClick={() => handleDeleteBed(confirmDeleteBed.zoneId, confirmDeleteBed.bedId)}
                  style={{ background: theme.error || '#e74c3c', borderColor: theme.error || '#e74c3c' }}
                >
                  Delete Bed
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Delete Planting Confirmation Modal */}
      <Modal open={!!confirmDeletePlanting} onClose={() => setConfirmDeletePlanting(null)} title="Remove Planting?" width="400px">
        {confirmDeletePlanting && (() => {
          const crop = crops.find(c => c.id === confirmDeletePlanting.cropId);
          return (
            <div>
              <p style={{ margin: '0 0 16px', color: theme.textSecondary, fontSize: '14px' }}>
                Remove <strong>{crop ? `${crop.icon} ${crop.name}` : 'this planting'}</strong> from the bed?
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <Button variant="ghost" onClick={() => setConfirmDeletePlanting(null)}>Cancel</Button>
                <button onClick={() => handleDeletePlanting(confirmDeletePlanting.zoneId, confirmDeletePlanting.bedId, confirmDeletePlanting.plantingId)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#e53935', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>Remove</button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

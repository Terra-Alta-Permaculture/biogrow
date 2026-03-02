import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Card, Button, Input, Badge } from './shared';
import { cropCategories } from '../data/mealProfiles';

export default function CropSelectionStep({ expanded, locked, onExpand, onComplete }) {
  const { theme, crops, selectedCropIds, updateState } = useApp();
  const [search, setSearch] = useState('');
  const [collapsedCats, setCollapsedCats] = useState({});

  const selectedSet = useMemo(() => new Set(selectedCropIds || []), [selectedCropIds]);

  // Group crops by category
  const grouped = useMemo(() => {
    const map = {};
    for (const key of Object.keys(cropCategories)) {
      map[key] = [];
    }
    for (const crop of crops) {
      if (map[crop.category]) {
        map[crop.category].push(crop);
      }
    }
    // Sort each category alphabetically
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.name.localeCompare(b.name));
    }
    return map;
  }, [crops]);

  // Filtered by search
  const filteredGrouped = useMemo(() => {
    if (!search.trim()) return grouped;
    const q = search.toLowerCase();
    const result = {};
    for (const [cat, cropList] of Object.entries(grouped)) {
      result[cat] = cropList.filter(c => c.name.toLowerCase().includes(q));
    }
    return result;
  }, [grouped, search]);

  const totalSelected = selectedSet.size;
  const totalCrops = crops.length;

  const toggleCrop = (cropId) => {
    const next = new Set(selectedSet);
    if (next.has(cropId)) {
      next.delete(cropId);
    } else {
      next.add(cropId);
    }
    updateState(prev => ({ ...prev, selectedCropIds: [...next] }));
  };

  const selectAllInCategory = (cat) => {
    const next = new Set(selectedSet);
    for (const crop of grouped[cat]) {
      next.add(crop.id);
    }
    updateState(prev => ({ ...prev, selectedCropIds: [...next] }));
  };

  const deselectAllInCategory = (cat) => {
    const next = new Set(selectedSet);
    for (const crop of grouped[cat]) {
      next.delete(crop.id);
    }
    updateState(prev => ({ ...prev, selectedCropIds: [...next] }));
  };

  const selectAll = () => {
    updateState(prev => ({ ...prev, selectedCropIds: crops.map(c => c.id) }));
  };

  const deselectAll = () => {
    updateState(prev => ({ ...prev, selectedCropIds: [] }));
  };

  const toggleCatCollapse = (cat) => {
    setCollapsedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleContinue = () => {
    updateState(prev => ({
      ...prev,
      setupProgress: { ...prev.setupProgress, cropSelectionDone: true },
    }));
    onComplete();
  };

  // Category breakdown for collapsed summary
  const catBreakdown = useMemo(() => {
    const result = [];
    for (const [key, info] of Object.entries(cropCategories)) {
      const total = grouped[key]?.length || 0;
      const selected = grouped[key]?.filter(c => selectedSet.has(c.id)).length || 0;
      if (selected > 0) {
        result.push({ ...info, key, selected, total });
      }
    }
    return result;
  }, [grouped, selectedSet]);

  // Collapsed summary view
  if (!expanded) {
    return (
      <Card style={{
        marginTop: '12px',
        cursor: locked ? 'default' : 'pointer',
        opacity: locked ? 0.4 : 1,
      }} onClick={() => !locked && onExpand()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>🌾</span>
            <div>
              <div style={{ fontWeight: '600', fontSize: '14px', color: theme.text, fontFamily: "'Libre Franklin', sans-serif" }}>
                Crop Selection
              </div>
              {totalSelected > 0 ? (
                <div style={{ fontSize: '12px', color: theme.textMuted }}>
                  ✅ {totalSelected} crop{totalSelected !== 1 ? 's' : ''} selected across {catBreakdown.length} categor{catBreakdown.length !== 1 ? 'ies' : 'y'}
                </div>
              ) : locked ? (
                <div style={{ fontSize: '12px', color: theme.textMuted }}>Complete farm setup first</div>
              ) : (
                <div style={{ fontSize: '12px', color: theme.warning }}>Select which crops you want to grow</div>
              )}
            </div>
          </div>
          {!locked && (
            <Button variant="ghost" style={{ fontSize: '12px', padding: '4px 12px' }}>
              {totalSelected > 0 ? 'Edit' : 'Select'}
            </Button>
          )}
        </div>
        {/* Category breakdown bar */}
        {catBreakdown.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
            {catBreakdown.map(cat => (
              <span key={cat.key} style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '4px',
                background: cat.color + '20',
                color: cat.color,
                fontWeight: '600',
                fontFamily: "'Libre Franklin', sans-serif",
              }}>
                {cat.icon} {cat.selected}
              </span>
            ))}
          </div>
        )}
      </Card>
    );
  }

  // Expanded view
  return (
    <Card style={{ marginTop: '12px' }}>
      <h3 style={{ margin: '0 0 4px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '18px' }}>
        🌾 Crop Selection
      </h3>
      <p style={{ margin: '0 0 12px', fontSize: '13px', color: theme.textMuted, fontFamily: "'Libre Franklin', sans-serif" }}>
        Choose which crops you grow. The demand planner will only use your selected crops.
      </p>

      {/* Search + Bulk actions */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${totalCrops} crops...`}
            style={{ fontSize: '13px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <Button variant="ghost" onClick={selectAll} style={{ fontSize: '11px', padding: '5px 10px' }}>
            Select All ({totalCrops})
          </Button>
          <Button variant="ghost" onClick={deselectAll} style={{ fontSize: '11px', padding: '5px 10px' }}>
            Deselect All
          </Button>
        </div>
      </div>

      {/* Selected counter */}
      <div style={{
        padding: '8px 12px',
        borderRadius: '8px',
        background: totalSelected > 0 ? theme.accentLight : theme.bgHover,
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          fontSize: '13px',
          fontWeight: '600',
          color: totalSelected > 0 ? theme.accent : theme.textMuted,
          fontFamily: "'Libre Franklin', sans-serif",
        }}>
          {totalSelected > 0 ? `${totalSelected} crop${totalSelected !== 1 ? 's' : ''} selected` : 'No crops selected yet'}
        </span>
      </div>

      {/* Category sections */}
      {Object.entries(cropCategories).map(([catKey, catInfo]) => {
        const catCrops = filteredGrouped[catKey] || [];
        const allCatCrops = grouped[catKey] || [];
        const catSelected = allCatCrops.filter(c => selectedSet.has(c.id)).length;
        const isCollapsed = collapsedCats[catKey];

        if (catCrops.length === 0 && search.trim()) return null;

        return (
          <div key={catKey} style={{
            marginBottom: '10px',
            borderRadius: '8px',
            border: `1px solid ${theme.borderLight}`,
            overflow: 'hidden',
          }}>
            {/* Category header */}
            <div
              onClick={() => toggleCatCollapse(catKey)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: theme.bgHover,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>{catInfo.icon}</span>
                <span style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: theme.text,
                  fontFamily: "'Libre Franklin', sans-serif",
                }}>
                  {catInfo.label}
                </span>
                <Badge
                  bg={catSelected > 0 ? catInfo.color + '20' : theme.bgHover}
                  color={catSelected > 0 ? catInfo.color : theme.textMuted}
                >
                  {catSelected}/{allCatCrops.length}
                </Badge>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); catSelected < allCatCrops.length ? selectAllInCategory(catKey) : deselectAllInCategory(catKey); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '11px',
                    color: theme.accent,
                    cursor: 'pointer',
                    fontFamily: "'Libre Franklin', sans-serif",
                    fontWeight: '500',
                    padding: '2px 6px',
                  }}
                >
                  {catSelected < allCatCrops.length ? 'All' : 'None'}
                </button>
                <span style={{ fontSize: '12px', color: theme.textMuted, transition: 'transform 0.2s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)' }}>▼</span>
              </div>
            </div>

            {/* Crop pills */}
            {!isCollapsed && (
              <div style={{
                padding: '8px 10px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
              }}>
                {catCrops.map(crop => {
                  const isSelected = selectedSet.has(crop.id);
                  return (
                    <button
                      key={crop.id}
                      onClick={() => toggleCrop(crop.id)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        borderRadius: '16px',
                        border: `1.5px solid ${isSelected ? theme.accent : theme.borderLight}`,
                        background: isSelected ? theme.accentLight : 'transparent',
                        color: isSelected ? theme.accent : theme.textSecondary,
                        fontSize: '12px',
                        fontFamily: "'Libre Franklin', sans-serif",
                        fontWeight: isSelected ? '600' : '400',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ fontSize: '13px' }}>{crop.icon}</span>
                      {crop.name}
                    </button>
                  );
                })}
                {catCrops.length === 0 && (
                  <span style={{ fontSize: '12px', color: theme.textMuted, padding: '4px', fontFamily: "'Libre Franklin', sans-serif" }}>
                    No matches for "{search}"
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Continue button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
        <Button
          onClick={handleContinue}
          disabled={totalSelected === 0}
          style={{
            opacity: totalSelected > 0 ? 1 : 0.5,
            cursor: totalSelected > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          Continue to Events & Planning →
        </Button>
      </div>
    </Card>
  );
}

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { familyColors, sunExposureLabels } from '../data/crops';
import { bedArea } from '../utils/helpers';
import { companionRules } from '../data/companions';
import { getCompanionHealth, getCompanionHealthLevel } from '../utils/companionHealth';

const SCALE = 20; // px per meter
const GAP = 40;
const BED_PAD = 8;
const MIN_BED_W = 14;
const MIN_BED_H = 20;
const DEFAULT_VB = { x: 0, y: 0, w: 1200, h: 600 };

// Safe number helper — prevents NaN/Infinity from corrupting SVG
function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getBedColor(bed, crops, colorMode) {
  if (colorMode === 'companion') {
    const health = getCompanionHealth(bed.plantings, crops, companionRules);
    const level = getCompanionHealthLevel(health);
    return { green: '#4caf50', orange: '#ff9800', red: '#f44336', gray: '#c8bfb4' }[level];
  }
  if (colorMode === 'sun') {
    const sun = bed.sunExposure || bed._zoneSun;
    return sunExposureLabels[sun]?.color || '#c8bfb4';
  }
  if (!bed.plantings || bed.plantings.length === 0) return '#c8bfb4';
  const crop = crops.find(c => c.id === bed.plantings[0].cropId);
  return crop ? (familyColors[crop.family] || '#c8bfb4') : '#c8bfb4';
}

function shelfPackBeds(beds, zoneW, startX, startY) {
  const positions = [];
  let cx = startX + BED_PAD;
  let cy = startY + 30; // leave room for zone label
  let rowH = 0;
  const maxX = startX + zoneW - BED_PAD;

  for (const bed of beds) {
    const bw = Math.max(MIN_BED_W, Math.round(bed.width * SCALE));
    const bh = Math.max(MIN_BED_H, Math.round(bed.length * SCALE));

    if (cx + bw > maxX && cx > startX + BED_PAD) {
      cx = startX + BED_PAD;
      cy += rowH + BED_PAD;
      rowH = 0;
    }

    positions.push({ bedId: bed.id, x: cx, y: cy, w: bw, h: bh });
    cx += bw + BED_PAD;
    rowH = Math.max(rowH, bh);
  }

  const totalH = (cy + rowH + BED_PAD) - startY;
  return { positions, totalH: Math.max(totalH, 80) };
}

function autoLayout(zones) {
  const result = { zones: {}, beds: {} };
  let cx = GAP;

  for (const zone of zones) {
    const bedCount = zone.beds.length;
    const estW = Math.max(160, Math.min(400, (bedCount || 1) * 60 + 40));
    const { positions, totalH } = shelfPackBeds(zone.beds, estW, cx, GAP);

    result.zones[zone.id] = { x: cx, y: GAP, w: estW, h: totalH };
    for (const p of positions) {
      result.beds[p.bedId] = { x: p.x, y: p.y, w: p.w, h: p.h };
    }

    cx += estW + GAP;
  }

  return result;
}

export default function FarmMap({ onSelectBed }) {
  const { zones, crops, updateState, theme } = useApp();
  const svgRef = useRef(null);
  const layoutDone = useRef(false);
  const dragRef = useRef(null);

  const [viewBox, setViewBox] = useState(DEFAULT_VB);
  const [colorMode, setColorMode] = useState('family');
  const [tooltip, setTooltip] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef(null);

  const headingFont = "'DM Serif Display', serif";
  const bodyFont = "'Libre Franklin', sans-serif";

  // Auto-layout zones/beds that don't have positions yet
  // IMPORTANT: Layout computation happens inside updateState to avoid stale-closure loops
  const layoutPending = useRef(false);
  useEffect(() => {
    if (zones.length === 0) return;
    if (layoutPending.current) return; // prevent re-entry

    const needsLayout = zones.some(z =>
      z.mapX === undefined || z.beds.some(b => b.mapX === undefined)
    );
    if (!needsLayout) return;

    layoutPending.current = true;
    updateState(prev => {
      // Re-check with prev state (avoids stale closure)
      const currentZones = prev.zones;
      const stillNeeds = currentZones.some(z =>
        z.mapX === undefined || z.beds.some(b => b.mapX === undefined)
      );
      if (!stillNeeds) return prev; // return same ref → no re-render

      const layout = autoLayout(currentZones);
      return {
        ...prev,
        zones: currentZones.map(z => {
          const zl = layout.zones[z.id];
          if (!zl) return z;

          const actualZoneX = z.mapX ?? zl.x;
          const actualZoneY = z.mapY ?? zl.y;
          const offsetX = actualZoneX - zl.x;
          const offsetY = actualZoneY - zl.y;

          return {
            ...z,
            mapX: safeNum(actualZoneX),
            mapY: safeNum(actualZoneY),
            mapWidth: zl.w,
            mapHeight: zl.h,
            beds: z.beds.map(b => {
              const bl = layout.beds[b.id];
              if (!bl) return b;
              return {
                ...b,
                mapX: safeNum(b.mapX ?? (bl.x + offsetX)),
                mapY: safeNum(b.mapY ?? (bl.y + offsetY)),
              };
            }),
          };
        }),
      };
    });
    // Reset guard after a tick so future layout requests work
    requestAnimationFrame(() => { layoutPending.current = false; });
  }, [zones, updateState]);

  // Convert screen coords to SVG coords
  const screenToSvg = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }, []);

  // Drag handlers
  const handleMouseDown = useCallback((e, type, id, zoneId) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const pt = screenToSvg(e.clientX, e.clientY);
    dragRef.current = { type, id, zoneId, startX: pt.x, startY: pt.y, moved: false };
  }, [screenToSvg]);

  const handleTouchStart = useCallback((e, type, id, zoneId) => {
    e.stopPropagation();
    const touch = e.touches[0];
    const pt = screenToSvg(touch.clientX, touch.clientY);
    dragRef.current = { type, id, zoneId, startX: pt.x, startY: pt.y, moved: false };
  }, [screenToSvg]);

  const handlePointerMove = useCallback((clientX, clientY) => {
    // Panning
    if (isPanning && panStart.current) {
      const dx = clientX - panStart.current.cx;
      const dy = clientY - panStart.current.cy;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = viewBox.w / rect.width;
      const scaleY = viewBox.h / rect.height;
      setViewBox(prev => ({
        ...prev,
        x: panStart.current.vbX - dx * scaleX,
        y: panStart.current.vbY - dy * scaleY,
      }));
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;

    // Track last client coords for touch end
    drag._lastCX = clientX;
    drag._lastCY = clientY;

    const pt = screenToSvg(clientX, clientY);
    const dx = pt.x - drag.startX;
    const dy = pt.y - drag.startY;

    // Guard against NaN from screenToSvg edge cases
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) drag.moved = true;
    if (!drag.moved) return;

    // Direct DOM manipulation for smooth dragging
    const svg = svgRef.current;
    if (!svg) return;

    if (drag.type === 'bed') {
      const el = svg.querySelector(`[data-bed-id="${drag.id}"]`);
      if (el) {
        const origX = parseFloat(el.getAttribute('data-orig-x'));
        const origY = parseFloat(el.getAttribute('data-orig-y'));
        el.setAttribute('transform', `translate(${origX + dx}, ${origY + dy})`);
      }
    } else if (drag.type === 'zone') {
      const el = svg.querySelector(`[data-zone-id="${drag.id}"]`);
      if (el) {
        const origX = parseFloat(el.getAttribute('data-orig-x'));
        const origY = parseFloat(el.getAttribute('data-orig-y'));
        el.setAttribute('transform', `translate(${origX + dx}, ${origY + dy})`);
      }
    }
  }, [isPanning, viewBox, screenToSvg]);

  const handleMouseMove = useCallback((e) => {
    handlePointerMove(e.clientX, e.clientY);
  }, [handlePointerMove]);

  const handleTouchMove = useCallback((e) => {
    if (dragRef.current || isPanning) e.preventDefault();
    const touch = e.touches[0];
    handlePointerMove(touch.clientX, touch.clientY);
  }, [handlePointerMove, isPanning]);

  const commitDrag = useCallback((clientX, clientY) => {
    const drag = dragRef.current;
    if (!drag || !drag.moved) {
      dragRef.current = null;
      return;
    }

    const pt = screenToSvg(clientX, clientY);
    const dx = pt.x - drag.startX;
    const dy = pt.y - drag.startY;

    // Guard: if dx/dy is NaN or Infinity, abort — don't corrupt state
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
      dragRef.current = null;
      return;
    }

    updateState(prev => ({
      ...prev,
      zones: prev.zones.map(z => {
        if (drag.type === 'zone' && z.id === drag.id) {
          return {
            ...z,
            mapX: safeNum(z.mapX, 0) + dx,
            mapY: safeNum(z.mapY, 0) + dy,
            beds: z.beds.map(b => ({
              ...b,
              mapX: safeNum(b.mapX, 0) + dx,
              mapY: safeNum(b.mapY, 0) + dy,
            })),
          };
        }
        if (drag.type === 'bed' && z.id === drag.zoneId) {
          return {
            ...z,
            beds: z.beds.map(b =>
              b.id === drag.id
                ? { ...b, mapX: safeNum(b.mapX, 0) + dx, mapY: safeNum(b.mapY, 0) + dy }
                : b
            ),
          };
        }
        return z;
      }),
    }));

    dragRef.current = null;
  }, [screenToSvg, updateState]);

  const handleMouseUp = useCallback((e) => {
    if (isPanning) {
      setIsPanning(false);
      panStart.current = null;
      return;
    }
    commitDrag(e.clientX, e.clientY);
  }, [commitDrag, isPanning]);

  const handleTouchEnd = useCallback((e) => {
    if (isPanning) {
      setIsPanning(false);
      panStart.current = null;
      return;
    }
    const drag = dragRef.current;
    if (drag) {
      // Use tracked touch coords from handlePointerMove, or abort if never moved
      if (drag._lastCX != null && drag._lastCY != null) {
        commitDrag(drag._lastCX, drag._lastCY);
      } else {
        // Never moved → just clear the drag
        dragRef.current = null;
      }
    }
  }, [commitDrag, isPanning]);

  // Panning (background)
  const handleBgMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    if (dragRef.current) return;
    setIsPanning(true);
    panStart.current = { cx: e.clientX, cy: e.clientY, vbX: viewBox.x, vbY: viewBox.y };
  }, [viewBox]);

  // Zoom
  const handleZoom = useCallback((direction) => {
    setViewBox(prev => {
      const factor = direction === 'in' ? 0.8 : 1.25;
      const newW = prev.w * factor;
      const newH = prev.h * factor;
      const cx = prev.x + prev.w / 2;
      const cy = prev.y + prev.h / 2;
      return { x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH };
    });
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    handleZoom(e.deltaY < 0 ? 'in' : 'out');
  }, [handleZoom]);

  const handleFitView = useCallback(() => {
    if (zones.length === 0) { setViewBox(DEFAULT_VB); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const z of zones) {
      const zx = safeNum(z.mapX), zy = safeNum(z.mapY);
      if (z.beds.length > 0) {
        for (const b of z.beds) {
          const bx = safeNum(b.mapX), by = safeNum(b.mapY);
          const bw = Math.max(MIN_BED_W, Math.round(safeNum(b.width, 0.8) * SCALE));
          const bh = Math.max(MIN_BED_H, Math.round(safeNum(b.length, 10) * SCALE));
          minX = Math.min(minX, bx);
          minY = Math.min(minY, by);
          maxX = Math.max(maxX, bx + bw);
          maxY = Math.max(maxY, by + bh);
        }
        minX = Math.min(minX, zx);
        minY = Math.min(minY, zy);
      } else {
        const zw = safeNum(z.mapWidth, 160), zh = safeNum(z.mapHeight, 80);
        minX = Math.min(minX, zx);
        minY = Math.min(minY, zy);
        maxX = Math.max(maxX, zx + zw);
        maxY = Math.max(maxY, zy + zh);
      }
    }
    // Final safety check: if bounds are invalid, use default
    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
      setViewBox(DEFAULT_VB);
      return;
    }
    const pad = 60;
    const w = Math.max(200, (maxX - minX) + pad * 2);
    const h = Math.max(200, (maxY - minY) + pad * 2);
    setViewBox({ x: minX - pad, y: minY - pad, w, h });
  }, [zones]);

  // Flat bed list for rendering
  const allBeds = useMemo(() => {
    const result = [];
    for (const zone of zones) {
      for (const bed of zone.beds) {
        result.push({
          ...bed,
          _zoneId: zone.id,
          _zoneName: zone.name,
          _zoneSun: zone.sunExposure,
          _zoneX: zone.mapX ?? 0,
          _zoneY: zone.mapY ?? 0,
        });
      }
    }
    return result;
  }, [zones]);

  // Grid pattern
  const gridSize = SCALE * 5; // 5m grid

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '10px', flexWrap: 'wrap', gap: '8px',
      }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => {
              const modes = ['family', 'sun', 'companion'];
              setColorMode(modes[(modes.indexOf(colorMode) + 1) % modes.length]);
            }}
            style={{
              fontSize: '11px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
              border: `1px solid ${theme.borderLight}`, background: theme.bgInput || theme.bg,
              color: theme.textSecondary, fontFamily: bodyFont,
            }}
          >
            {colorMode === 'family' ? '☀️ Sun View' : colorMode === 'sun' ? '🤝 Companion' : '🌿 Family View'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={handleFitView}
            title="Fit to view"
            style={{
              fontSize: '12px', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer',
              border: `1px solid ${theme.borderLight}`, background: theme.bgInput || theme.bg,
              color: theme.textSecondary, lineHeight: 1,
            }}
          >
            ⊞
          </button>
          <button
            onClick={() => handleZoom('in')}
            title="Zoom in"
            style={{
              fontSize: '14px', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer',
              border: `1px solid ${theme.borderLight}`, background: theme.bgInput || theme.bg,
              color: theme.textSecondary, lineHeight: 1, fontWeight: '700',
            }}
          >
            +
          </button>
          <button
            onClick={() => handleZoom('out')}
            title="Zoom out"
            style={{
              fontSize: '14px', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer',
              border: `1px solid ${theme.borderLight}`, background: theme.bgInput || theme.bg,
              color: theme.textSecondary, lineHeight: 1, fontWeight: '700',
            }}
          >
            &minus;
          </button>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`${safeNum(viewBox.x)} ${safeNum(viewBox.y)} ${safeNum(viewBox.w, 1200)} ${safeNum(viewBox.h, 600)}`}
        width="100%"
        height="500px"
        style={{
          borderRadius: '10px',
          border: `1px solid ${theme.borderLight}`,
          background: theme.bgHover || theme.bg,
          cursor: isPanning ? 'grabbing' : 'grab',
          touchAction: 'none',
          userSelect: 'none',
        }}
        onMouseDown={handleBgMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        {/* Grid */}
        <defs>
          <pattern id="farmGrid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
            <path
              d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
              fill="none"
              stroke={theme.borderLight}
              strokeWidth="0.5"
              opacity="0.6"
            />
          </pattern>
          <pattern id="farmGridSm" width={SCALE} height={SCALE} patternUnits="userSpaceOnUse">
            <path
              d={`M ${SCALE} 0 L 0 0 0 ${SCALE}`}
              fill="none"
              stroke={theme.borderLight}
              strokeWidth="0.25"
              opacity="0.3"
            />
          </pattern>
        </defs>
        {/* Grid — capped at 6000px total to avoid browser perf issues */}
        {(() => {
          const gw = Math.min(safeNum(viewBox.w, 1200) + 2000, 6000);
          const gh = Math.min(safeNum(viewBox.h, 600) + 2000, 6000);
          const gx = safeNum(viewBox.x) - 500;
          const gy = safeNum(viewBox.y) - 500;
          return (
            <>
              <rect x={gx} y={gy} width={gw} height={gh} fill="url(#farmGridSm)" />
              <rect x={gx} y={gy} width={gw} height={gh} fill="url(#farmGrid)" />
            </>
          );
        })()}

        {/* Zones — dynamically sized from bed positions */}
        {zones.map(zone => {
          const zx = safeNum(zone.mapX);
          const zy = safeNum(zone.mapY);
          const sunInfo = sunExposureLabels[zone.sunExposure];

          // Compute zone bounds dynamically from its beds
          let zw, zh;
          if (zone.beds.length > 0) {
            let maxBedRight = 0;
            let maxBedBottom = 0;
            for (const bed of zone.beds) {
              const bx = safeNum(bed.mapX) - zx;
              const by = safeNum(bed.mapY) - zy;
              const bw = Math.max(MIN_BED_W, Math.round(safeNum(bed.width, 0.8) * SCALE));
              const bh = Math.max(MIN_BED_H, Math.round(safeNum(bed.length, 10) * SCALE));
              maxBedRight = Math.max(maxBedRight, bx + bw);
              maxBedBottom = Math.max(maxBedBottom, by + bh);
            }
            zw = Math.max(160, maxBedRight + BED_PAD);
            zh = Math.max(80, maxBedBottom + BED_PAD);
          } else {
            zw = safeNum(zone.mapWidth, 160);
            zh = safeNum(zone.mapHeight, 80);
          }

          return (
            <g
              key={zone.id}
              data-zone-id={zone.id}
              data-orig-x={zx}
              data-orig-y={zy}
              transform={`translate(${zx}, ${zy})`}
              onMouseDown={(e) => handleMouseDown(e, 'zone', zone.id)}
              onTouchStart={(e) => handleTouchStart(e, 'zone', zone.id)}
              style={{ cursor: 'move' }}
            >
              <rect
                x={0} y={0} width={zw} height={zh}
                rx={6} ry={6}
                fill={theme.accentLight}
                fillOpacity={0.5}
                stroke={theme.accent}
                strokeWidth={1.5}
                strokeDasharray="6 3"
              />
              <text
                x={zw / 2} y={16}
                textAnchor="middle"
                fill={theme.accent}
                fontSize={11}
                fontWeight="700"
                fontFamily={headingFont}
                style={{ pointerEvents: 'none' }}
              >
                {zone.name}
                {sunInfo ? ` ${sunInfo.icon}` : ''}
              </text>
            </g>
          );
        })}

        {/* Beds */}
        {allBeds.map(bed => {
          const bx = safeNum(bed.mapX);
          const by = safeNum(bed.mapY);
          const bw = Math.max(MIN_BED_W, Math.round(safeNum(bed.width, 0.8) * SCALE));
          const bh = Math.max(MIN_BED_H, Math.round(safeNum(bed.length, 10) * SCALE));
          const color = getBedColor(bed, crops, colorMode);
          const hasPlantings = bed.plantings && bed.plantings.length > 0;

          return (
            <g
              key={bed.id}
              data-bed-id={bed.id}
              data-orig-x={bx}
              data-orig-y={by}
              transform={`translate(${bx}, ${by})`}
              onMouseDown={(e) => handleMouseDown(e, 'bed', bed.id, bed._zoneId)}
              onTouchStart={(e) => handleTouchStart(e, 'bed', bed.id, bed._zoneId)}
              onMouseEnter={(e) => {
                const effectiveSun = bed.sunExposure || bed._zoneSun;
                const sunLabel = sunExposureLabels[effectiveSun]?.label || 'Unknown';
                const area = bedArea(bed);
                const plantNames = (bed.plantings || []).map(p => {
                  const c = crops.find(cr => cr.id === p.cropId);
                  return c ? c.name : p.cropId;
                });
                let companion = '';
                if (colorMode === 'companion') {
                  const health = getCompanionHealth(bed.plantings, crops, companionRules);
                  const level = getCompanionHealthLevel(health);
                  const syn = health.great + health.good;
                  if (level === 'green') companion = `💚 ${syn} synerg${syn === 1 ? 'y' : 'ies'}`;
                  else if (level === 'orange') companion = `⚠️ ${health.bad} conflict${health.bad !== 1 ? 's' : ''} · ${syn} synerg${syn === 1 ? 'y' : 'ies'}`;
                  else if (level === 'red') companion = `⚠️ ${health.bad} conflict${health.bad !== 1 ? 's' : ''}`;
                  else companion = 'No companion data';
                }
                setTooltip({
                  x: bx + bw + 8,
                  y: by,
                  name: bed.name,
                  zone: bed._zoneName,
                  dims: `${bed.width}m x ${bed.length}m (${area} m${String.fromCharCode(178)})`,
                  sun: `${sunExposureLabels[effectiveSun]?.icon || ''} ${sunLabel}`,
                  plantings: plantNames.length > 0 ? plantNames.join(', ') : 'Empty',
                  companion,
                });
              }}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: 'move' }}
            >
              <rect
                x={0} y={0} width={bw} height={bh}
                rx={3} ry={3}
                fill={color}
                fillOpacity={hasPlantings ? 0.85 : 0.35}
                stroke={hasPlantings ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.1)'}
                strokeWidth={1}
              />
              {/* Bed name — rotated for narrow beds, horizontal for wide ones */}
              {(() => {
                const label = bed.name.length > 10 ? bed.name.slice(0, 9) + '..' : bed.name;
                const narrow = bw < 28 && bh > 28;
                const fs = narrow ? Math.min(9, bh / 7) : Math.min(10, bw / 3.5);
                if (fs < 5) return null; // too small to read
                const rot = narrow ? `rotate(-90, ${bw / 2}, ${bh / 2})` : undefined;
                return (
                  <>
                    {/* Outline stroke for contrast on any background */}
                    <text
                      x={bw / 2} y={bh / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="none"
                      stroke={hasPlantings ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)'}
                      strokeWidth={2.5}
                      fontSize={fs}
                      fontWeight="700"
                      fontFamily={bodyFont}
                      transform={rot}
                      style={{ pointerEvents: 'none' }}
                    >
                      {label}
                    </text>
                    <text
                      x={bw / 2} y={bh / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={hasPlantings ? '#fff' : '#2c2416'}
                      fontSize={fs}
                      fontWeight="700"
                      fontFamily={bodyFont}
                      transform={rot}
                      style={{ pointerEvents: 'none' }}
                    >
                      {label}
                    </text>
                  </>
                );
              })()}
            </g>
          );
        })}

        {/* Tooltip */}
        {tooltip && (
          <foreignObject x={tooltip.x} y={tooltip.y} width={180} height={120} style={{ pointerEvents: 'none', overflow: 'visible' }}>
            <div
              xmlns="http://www.w3.org/1999/xhtml"
              style={{
                background: theme.bgCard,
                border: `1px solid ${theme.borderLight}`,
                borderRadius: '8px',
                padding: '8px 10px',
                boxShadow: theme.shadowMd,
                fontSize: '10px',
                color: theme.text,
                fontFamily: bodyFont,
                lineHeight: 1.5,
                whiteSpace: 'nowrap',
              }}
            >
              <div style={{ fontWeight: '700', fontSize: '11px', fontFamily: headingFont, marginBottom: '3px' }}>
                {tooltip.name}
              </div>
              <div style={{ color: theme.textMuted }}>Zone: {tooltip.zone}</div>
              <div style={{ color: theme.textMuted }}>{tooltip.dims}</div>
              <div style={{ color: theme.textMuted }}>{tooltip.sun}</div>
              <div style={{
                color: tooltip.plantings === 'Empty' ? theme.textMuted : theme.accent,
                fontStyle: tooltip.plantings === 'Empty' ? 'italic' : 'normal',
                maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {tooltip.plantings}
              </div>
              {tooltip.companion && (
                <div style={{ fontWeight: '600', marginTop: '2px' }}>
                  {tooltip.companion}
                </div>
              )}
            </div>
          </foreignObject>
        )}

        {/* Scale indicator */}
        <g transform={`translate(${viewBox.x + 10}, ${viewBox.y + viewBox.h - 20})`}>
          <line x1={0} y1={0} x2={SCALE * 5} y2={0} stroke={theme.textMuted} strokeWidth={1.5} />
          <line x1={0} y1={-4} x2={0} y2={4} stroke={theme.textMuted} strokeWidth={1} />
          <line x1={SCALE * 5} y1={-4} x2={SCALE * 5} y2={4} stroke={theme.textMuted} strokeWidth={1} />
          <text x={SCALE * 2.5} y={-5} textAnchor="middle" fill={theme.textMuted} fontSize={9} fontFamily={bodyFont}>
            5 m
          </text>
        </g>
      </svg>

      {/* Legend */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px',
        paddingTop: '10px', borderTop: `1px solid ${theme.borderLight}`,
      }}>
        {colorMode === 'family' ? (
          <>
            {Object.entries(familyColors).map(([family, color]) => (
              <div key={family} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: color, border: '1px solid rgba(0,0,0,0.1)' }} />
                <span style={{ fontSize: '10px', color: theme.textMuted }}>{family}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#c8bfb4', border: '1px solid rgba(0,0,0,0.1)', opacity: 0.45 }} />
              <span style={{ fontSize: '10px', color: theme.textMuted }}>Unplanted</span>
            </div>
          </>
        ) : colorMode === 'sun' ? (
          Object.entries(sunExposureLabels).map(([key, info]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: info.color, border: '1px solid rgba(0,0,0,0.1)' }} />
              <span style={{ fontSize: '10px', color: theme.textMuted }}>{info.icon} {info.label}</span>
            </div>
          ))
        ) : (
          <>
            {[
              { color: '#4caf50', label: '💚 All synergies' },
              { color: '#ff9800', label: '⚠️ Mixed' },
              { color: '#f44336', label: '⚠️ Conflicts only' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: item.color, border: '1px solid rgba(0,0,0,0.1)' }} />
                <span style={{ fontSize: '10px', color: theme.textMuted }}>{item.label}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#c8bfb4', border: '1px solid rgba(0,0,0,0.1)', opacity: 0.45 }} />
              <span style={{ fontSize: '10px', color: theme.textMuted }}>No data / single crop</span>
            </div>
          </>
        )}
        <span style={{ fontSize: '10px', color: theme.textMuted, fontStyle: 'italic', marginLeft: '8px' }}>
          Drag beds & zones to reposition | Scroll to zoom | Drag background to pan
        </span>
      </div>
    </div>
  );
}

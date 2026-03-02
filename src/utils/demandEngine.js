import { cropCategories } from '../data/mealProfiles';
import { dateToWeek, daysBetween, bedArea, generateId, getCurrentWeek } from './helpers';

/**
 * Step 5a — Aggregate total demand across all multi-day events
 * Returns: Map<category, { totalKg, harvestWindows: [{ weekStart, weekEnd, eventId }] }>
 * (Kept for ScheduleTab/EventsTab demand coverage display)
 */
export function aggregateDemand(events, mealProfiles, lossMargin = 0.30) {
  const demandMap = {};

  // Initialize categories
  Object.keys(cropCategories).forEach(cat => {
    demandMap[cat] = { totalKg: 0, harvestWindows: [] };
  });

  const multiDayEvents = events.filter(e =>
    e.eventType === 'multi' && e.guestCount > 0 && e.startDate && e.endDate
  );

  for (const event of multiDayEvents) {
    const eventDays = daysBetween(event.startDate, event.endDate) + 1;
    const weekStart = dateToWeek(event.startDate);
    const weekEnd = dateToWeek(event.endDate);

    // Use custom demand if set, otherwise profile demand
    const profile = mealProfiles.find(p => p.id === event.mealProfileId);
    const demand = event.customDemand || (profile ? profile.demandPerPersonPerDay : null);
    if (!demand) continue;

    for (const cat of Object.keys(demand)) {
      if (!demandMap[cat]) continue;
      const kgNeeded = demand[cat] * event.guestCount * eventDays * (1 + lossMargin);
      if (kgNeeded > 0) {
        demandMap[cat].totalKg += kgNeeded;
        demandMap[cat].harvestWindows.push({ weekStart, weekEnd, eventId: event.id });
      }
    }
  }

  return demandMap;
}

/**
 * Aggregate manual demand entries into the same demand map format as event demand.
 * (Kept for ScheduleTab demand coverage display)
 */
export function aggregateManualDemand(manualDemandEntries, crops, settings, year) {
  const demandMap = {};
  Object.keys(cropCategories).forEach(cat => {
    demandMap[cat] = { totalKg: 0, harvestWindows: [] };
  });

  const { lastFrostWeek, firstFrostWeek } = settings;

  for (const entry of manualDemandEntries) {
    if (entry.year !== year || !entry.quantityKg || entry.quantityKg <= 0) continue;
    const cat = entry.category;
    if (!demandMap[cat]) continue;

    demandMap[cat].totalKg += entry.quantityKg;
    demandMap[cat].harvestWindows.push({
      weekStart: lastFrostWeek + 4,
      weekEnd: firstFrostWeek - 2,
      eventId: `manual-${entry.id}`,
    });
  }
  return demandMap;
}

/**
 * Merge two demand maps (event + manual) into one combined map
 * (Kept for ScheduleTab demand coverage display)
 */
export function mergeDemandMaps(eventDemand, manualDemand) {
  const merged = {};
  const allKeys = new Set([...Object.keys(eventDemand), ...Object.keys(manualDemand)]);

  for (const cat of allKeys) {
    merged[cat] = {
      totalKg: (eventDemand[cat]?.totalKg || 0) + (manualDemand[cat]?.totalKg || 0),
      harvestWindows: [
        ...(eventDemand[cat]?.harvestWindows || []),
        ...(manualDemand[cat]?.harvestWindows || []),
      ],
    };
  }
  return merged;
}

/**
 * Aggregate CSA box scheme demand into the same demand map format.
 * Returns: Map<category, { totalKg, harvestWindows: [{ weekStart, weekEnd, eventId }] }>
 */
export function aggregateCSADemand(csaSchemes, settings, lossMargin = 0.30, year) {
  const demandMap = {};
  Object.keys(cropCategories).forEach(cat => {
    demandMap[cat] = { totalKg: 0, harvestWindows: [] };
  });

  const { lastFrostWeek, firstFrostWeek } = settings;

  for (const scheme of (csaSchemes || [])) {
    if (scheme.year && scheme.year !== year) continue;
    const boxes = scheme.boxesPerWeek || 0;
    if (boxes <= 0) continue;

    const capacity = (scheme.capacityPercent ?? 100) / 100;
    const contents = scheme.boxContents || {};
    const weekStart = lastFrostWeek + 4;
    const weekEnd = firstFrostWeek - 2;
    const seasonWeeks = Math.max(1, weekEnd - weekStart + 1);

    for (const cat of Object.keys(contents)) {
      if (!demandMap[cat] || !contents[cat]) continue;
      const kgNeeded = contents[cat] * boxes * capacity * seasonWeeks * (1 + lossMargin);
      if (kgNeeded > 0) {
        demandMap[cat].totalKg += kgNeeded;
        demandMap[cat].harvestWindows.push({
          weekStart,
          weekEnd,
          eventId: `csa-${scheme.id}`,
        });
      }
    }
  }

  return demandMap;
}

/**
 * Aggregate restaurant contract demand into the same demand map format.
 * Weekly orders represent what the restaurant needs per week — delivery frequency is logistics only.
 * Returns: Map<category, { totalKg, harvestWindows: [{ weekStart, weekEnd, eventId }] }>
 */
export function aggregateRestaurantDemand(restaurantContracts, settings, lossMargin = 0.30, year) {
  const demandMap = {};
  Object.keys(cropCategories).forEach(cat => {
    demandMap[cat] = { totalKg: 0, harvestWindows: [] };
  });

  const { lastFrostWeek, firstFrostWeek } = settings;

  for (const contract of (restaurantContracts || [])) {
    if (contract.year && contract.year !== year) continue;
    const order = contract.weeklyOrder || {};
    const hasOrder = Object.values(order).some(v => v > 0);
    if (!hasOrder) continue;

    // Determine harvest window from dates or default to growing season
    let weekStart, weekEnd;
    if (contract.startDate && contract.endDate) {
      weekStart = dateToWeek(contract.startDate);
      weekEnd = dateToWeek(contract.endDate);
    } else {
      weekStart = lastFrostWeek + 4;
      weekEnd = firstFrostWeek - 2;
    }
    // Clamp to growing season
    weekStart = Math.max(weekStart, lastFrostWeek + 4);
    weekEnd = Math.min(weekEnd, firstFrostWeek - 2);
    const seasonWeeks = Math.max(1, weekEnd - weekStart + 1);

    for (const cat of Object.keys(order)) {
      if (!demandMap[cat] || !order[cat]) continue;
      const kgNeeded = order[cat] * seasonWeeks * (1 + lossMargin);
      if (kgNeeded > 0) {
        demandMap[cat].totalKg += kgNeeded;
        demandMap[cat].harvestWindows.push({
          weekStart,
          weekEnd,
          eventId: `rest-${contract.id}`,
        });
      }
    }
  }

  return demandMap;
}

/**
 * Step 5b — Select crops for a given category
 * Filters by season viability using frost dates, splits demand for diversity
 */
export function selectCropsForCategory(category, crops, settings, selectedCropIds = []) {
  const eligible = crops.filter(c => {
    if (c.category !== category) return false;
    if (selectedCropIds.length > 0 && !selectedCropIds.includes(c.id)) return false;
    return true;
  });

  if (eligible.length === 0) return [];

  // Sort by yield descending for best picks
  const sorted = [...eligible].sort((a, b) => (b.yieldPerM2 || 0) - (a.yieldPerM2 || 0));

  // Diversity split
  if (sorted.length === 1) {
    return [{ crop: sorted[0], share: 1.0 }];
  } else if (sorted.length === 2) {
    return [
      { crop: sorted[0], share: 0.6 },
      { crop: sorted[1], share: 0.4 },
    ];
  } else {
    return [
      { crop: sorted[0], share: 0.50 },
      { crop: sorted[1], share: 0.30 },
      { crop: sorted[2], share: 0.20 },
    ];
  }
}

/**
 * Calculate area needed for a crop given its demand in kg.
 * Returns total area AND per-succession area for cascade allocation.
 */
export function calculateArea(cropDemandKg, crop, harvestWindow) {
  if (cropDemandKg <= 0 || !crop.yieldPerM2) return { areaSqM: 0, harvestCycles: 1, areaPerCycle: 0 };

  const yieldPerM2 = crop.yieldPerM2;
  const maturityWeeks = Math.ceil(crop.daysToMaturity / 7);
  const succWeeks = crop.successionInterval > 0 ? Math.ceil(crop.successionInterval / 7) : 0;

  const harvestSpan = harvestWindow.weekEnd - harvestWindow.weekStart + 1;

  let harvestCycles = 1;
  if (succWeeks > 0 && harvestSpan > maturityWeeks) {
    harvestCycles = Math.max(1, 1 + Math.floor((harvestSpan - maturityWeeks) / succWeeks));
  }

  const effectiveYield = yieldPerM2 * harvestCycles;
  const areaSqM = Math.ceil((cropDemandKg / effectiveYield) * 10) / 10;
  const areaPerCycle = Math.ceil((areaSqM / harvestCycles) * 10) / 10;

  return { areaSqM, harvestCycles, areaPerCycle };
}

/**
 * Calculate planting weeks (sow dates) working backward from a SINGLE harvest window.
 */
export function calculatePlantingWeeks(crop, harvestWindow, settings) {
  const { lastFrostWeek, firstFrostWeek } = settings;
  const maturityWeeks = Math.ceil(crop.daysToMaturity / 7);
  const succWeeks = crop.successionInterval > 0 ? Math.ceil(crop.successionInterval / 7) : 0;

  const firstSowWeek = harvestWindow.weekStart - maturityWeeks;
  const weeks = [firstSowWeek];

  if (succWeeks > 0) {
    let nextSow = firstSowWeek + succWeeks;
    const lastUsefulSow = harvestWindow.weekEnd - maturityWeeks;
    while (nextSow <= lastUsefulSow) {
      weeks.push(nextSow);
      nextSow += succWeeks;
    }
  }

  // Clamp to frost-safe window
  const safeStart = crop.season === 'warm' ? lastFrostWeek : lastFrostWeek - 6;
  const safeEnd = crop.season === 'warm' ? firstFrostWeek - maturityWeeks : firstFrostWeek;

  return weeks
    .map(w => Math.max(w, safeStart))
    .filter(w => w <= safeEnd && w >= 1 && w <= 52);
}

// ─── BedSchedule: Temporal Occupancy Tracker ───────────────────────────

function sunMatchScore(bedSun, cropSun) {
  if (!bedSun || !cropSun) return 0;
  if (bedSun === cropSun) return 2;
  const levels = ['full-shade', 'partial-shade', 'partial-sun', 'full-sun'];
  const diff = Math.abs(levels.indexOf(bedSun) - levels.indexOf(cropSun));
  if (diff === 1) return 1;
  return -1;
}

function snapFraction(raw) {
  if (raw >= 0.875) return 1;
  if (raw >= 0.375) return 0.5;
  return 0.25;
}

class BedSchedule {
  constructor(zones, year, crops) {
    this.beds = [];
    for (const zone of zones) {
      for (const bed of zone.beds) {
        const entry = {
          zoneId: zone.id,
          zoneName: zone.name,
          bedId: bed.id,
          bedName: bed.name,
          area: bedArea(bed),
          sunExposure: bed.sunExposure || zone.sunExposure || null,
          occupancy: [], // { startWeek, endWeek, fraction }
        };
        // Seed with existing manual plantings
        for (const p of (bed.plantings || [])) {
          if (p.year !== year || p.source === 'demand') continue;
          const crop = crops.find(c => c.id === p.cropId);
          const dtmWeeks = crop ? Math.ceil((crop.daysToMaturity || 60) / 7) : 9;
          const hwWeeks = crop?.harvestWindow ? Math.ceil(crop.harvestWindow / 7) : 4;
          entry.occupancy.push({
            startWeek: p.startWeek || 10,
            endWeek: (p.startWeek || 10) + dtmWeeks + hwWeeks,
            fraction: p.bedFraction || 1,
          });
        }
        this.beds.push(entry);
      }
    }
  }

  /** Get available fraction for a bed during a time range */
  availableFraction(bed, sowWeek, endWeek) {
    let occupied = 0;
    for (const occ of bed.occupancy) {
      // Overlaps if ranges intersect
      if (sowWeek < occ.endWeek && endWeek > occ.startWeek) {
        occupied += occ.fraction;
      }
    }
    return Math.max(0, 1 - occupied);
  }

  /** Find beds with available space for a planting during [sowWeek, endWeek] */
  findAvailable(sowWeek, endWeek, cropSunReq) {
    return this.beds
      .map(bed => ({
        bed,
        available: this.availableFraction(bed, sowWeek, endWeek),
        availableArea: this.availableFraction(bed, sowWeek, endWeek) * bed.area,
        sunScore: sunMatchScore(bed.sunExposure, cropSunReq),
      }))
      .filter(b => b.available > 0.01)
      .sort((a, b) => {
        if (b.sunScore !== a.sunScore) return b.sunScore - a.sunScore;
        return b.availableArea - a.availableArea;
      });
  }

  /** Mark a bed as occupied for a time range */
  allocate(bed, sowWeek, endWeek, fraction) {
    bed.occupancy.push({ startWeek: sowWeek, endWeek, fraction });
  }
}

// ─── Core Planning Engine (Per-Event Cascade) ──────────────────────────

/**
 * Compute allocations using per-event cascade allocation.
 * Each event drives its own back-calculated sow dates.
 * Succession plantings are distributed across beds temporally.
 * Beds freed after harvest are reused by later events.
 */
export function computeSeasonPlan(state, mealProfilesList, year) {
  const { events, crops, zones, settings, selectedCropIds, manualDemandEntries, csaSchemes, restaurantContracts } = state;
  const planYear = year || settings.currentYear || new Date().getFullYear();
  const lossMargin = state.demandPlan?.lossMargin ?? 0.30;

  // Build temporal bed schedule (seeded with manual plantings)
  const schedule = new BedSchedule(zones, planYear, crops);

  // Collect all demand sources: events + manual entries as virtual events
  const demandSources = [];

  // Multi-day events (sorted by start date for chronological processing)
  const multiDayEvents = (events || []).filter(e =>
    e.eventType === 'multi' && e.guestCount > 0 && e.startDate && e.endDate
  ).sort((a, b) => a.startDate.localeCompare(b.startDate));

  for (const event of multiDayEvents) {
    const eventDays = daysBetween(event.startDate, event.endDate) + 1;
    const weekStart = dateToWeek(event.startDate);
    const weekEnd = dateToWeek(event.endDate);

    const profile = mealProfilesList.find(p => p.id === event.mealProfileId);
    const demand = event.customDemand || (profile ? profile.demandPerPersonPerDay : null);
    if (!demand) continue;

    const catDemands = {};
    for (const cat of Object.keys(demand)) {
      if (!cropCategories[cat]) continue;
      const kgNeeded = demand[cat] * event.guestCount * eventDays * (1 + lossMargin);
      if (kgNeeded > 0) {
        catDemands[cat] = kgNeeded;
      }
    }

    if (Object.keys(catDemands).length > 0) {
      demandSources.push({
        id: event.id,
        label: event.name || 'Event',
        harvestWindow: { weekStart, weekEnd },
        catDemands,
      });
    }
  }

  // Manual demand entries as virtual events spanning the growing season
  const { lastFrostWeek, firstFrostWeek } = settings;
  const manualByCategory = {};
  for (const entry of (manualDemandEntries || [])) {
    if (entry.year !== planYear || !entry.quantityKg || entry.quantityKg <= 0) continue;
    const cat = entry.category;
    if (!cropCategories[cat]) continue;
    manualByCategory[cat] = (manualByCategory[cat] || 0) + entry.quantityKg;
  }
  if (Object.keys(manualByCategory).length > 0) {
    demandSources.push({
      id: 'manual-demand',
      label: 'Manual Demand',
      harvestWindow: { weekStart: lastFrostWeek + 4, weekEnd: firstFrostWeek - 2 },
      catDemands: manualByCategory,
    });
  }

  // CSA box scheme demand — continuous season delivery
  for (const scheme of (csaSchemes || [])) {
    if (scheme.year && scheme.year !== planYear) continue;
    const boxes = scheme.boxesPerWeek || 0;
    if (boxes <= 0) continue;

    const capacity = (scheme.capacityPercent ?? 100) / 100;
    const contents = scheme.boxContents || {};
    const csaStart = lastFrostWeek + 4;
    const csaEnd = firstFrostWeek - 2;
    const seasonWeeks = Math.max(1, csaEnd - csaStart + 1);

    const catDemands = {};
    for (const cat of Object.keys(contents)) {
      if (!cropCategories[cat] || !contents[cat]) continue;
      const kgNeeded = contents[cat] * boxes * capacity * seasonWeeks * (1 + lossMargin);
      if (kgNeeded > 0) {
        catDemands[cat] = kgNeeded;
      }
    }

    if (Object.keys(catDemands).length > 0) {
      demandSources.push({
        id: `csa-${scheme.id}`,
        label: scheme.name || 'CSA Box',
        harvestWindow: { weekStart: csaStart, weekEnd: csaEnd },
        catDemands,
      });
    }
  }

  // Restaurant contract demand — recurring weekly orders
  for (const contract of (restaurantContracts || [])) {
    if (contract.year && contract.year !== planYear) continue;
    const order = contract.weeklyOrder || {};
    const hasOrder = Object.values(order).some(v => v > 0);
    if (!hasOrder) continue;

    let restStart, restEnd;
    if (contract.startDate && contract.endDate) {
      restStart = dateToWeek(contract.startDate);
      restEnd = dateToWeek(contract.endDate);
    } else {
      restStart = lastFrostWeek + 4;
      restEnd = firstFrostWeek - 2;
    }
    restStart = Math.max(restStart, lastFrostWeek + 4);
    restEnd = Math.min(restEnd, firstFrostWeek - 2);
    const seasonWeeks = Math.max(1, restEnd - restStart + 1);

    const catDemands = {};
    for (const cat of Object.keys(order)) {
      if (!cropCategories[cat] || !order[cat]) continue;
      const kgNeeded = order[cat] * seasonWeeks * (1 + lossMargin);
      if (kgNeeded > 0) {
        catDemands[cat] = kgNeeded;
      }
    }

    if (Object.keys(catDemands).length > 0) {
      demandSources.push({
        id: `rest-${contract.id}`,
        label: contract.name || 'Restaurant',
        harvestWindow: { weekStart: restStart, weekEnd: restEnd },
        catDemands,
      });
    }
  }

  // Check if there's any demand at all
  if (demandSources.length === 0) {
    return {
      summary: { totalKg: 0, totalArea: 0, bedCount: 0, eventCount: 0, cropCount: 0 },
      warnings: ['No demand found. Add events, manual demand, CSA schemes, or restaurant contracts.'],
      allocations: [],
    };
  }

  // ─── Per-event cascade allocation ───
  const allAllocations = [];
  const allWarnings = [];
  let totalKg = 0;

  for (const source of demandSources) {
    for (const [category, demandKg] of Object.entries(source.catDemands)) {
      totalKg += demandKg;

      const selections = selectCropsForCategory(category, crops, settings, selectedCropIds || []);
      if (selections.length === 0) {
        allWarnings.push(`\u26a0\ufe0f No crops for "${cropCategories[category]?.label || category}" (${source.label}). ${demandKg.toFixed(1)} kg unplanned.`);
        continue;
      }

      for (const { crop, share } of selections) {
        const cropKg = demandKg * share;
        const { areaSqM, harvestCycles, areaPerCycle } = calculateArea(cropKg, crop, source.harvestWindow);
        const plantingWeeks = calculatePlantingWeeks(crop, source.harvestWindow, settings);

        if (plantingWeeks.length === 0) {
          const matW = Math.ceil((crop.daysToMaturity || 60) / 7);
          const needed = source.harvestWindow.weekStart - matW;
          const safeStart = crop.season === 'warm' ? lastFrostWeek : lastFrostWeek - 6;
          const safeEnd = crop.season === 'warm' ? firstFrostWeek - matW : firstFrostWeek;
          const reason = needed < safeStart
            ? `sow needed by W${needed} but frost-safe window starts W${safeStart}`
            : needed > safeEnd
            ? `sow W${needed} is past the frost cutoff W${safeEnd}`
            : `no weeks pass frost-safety filters`;
          allWarnings.push(`⚠️ ${crop.name}: no viable sow dates for ${source.label} — ${reason}.`);
          continue;
        }

        // Distribute area evenly across succession sow weeks
        const areaPerSow = plantingWeeks.length > 1
          ? Math.ceil((areaSqM / plantingWeeks.length) * 10) / 10
          : areaSqM;

        const maturityWeeks = Math.ceil((crop.daysToMaturity || 60) / 7);
        const harvestWeeks = crop.harvestWindow ? Math.ceil(crop.harvestWindow / 7) : 4;

        // For each sow week, find available beds and allocate
        for (const sowWeek of plantingWeeks) {
          const endWeek = sowWeek + maturityWeeks + harvestWeeks;
          let remaining = areaPerSow;

          const candidates = schedule.findAvailable(sowWeek, endWeek, crop.sunRequirement);

          for (const cand of candidates) {
            if (remaining <= 0.05) break;
            const maxArea = cand.availableArea;
            if (maxArea <= 0.05) continue;

            const useArea = Math.min(maxArea, remaining);
            const rawFraction = useArea / cand.bed.area;
            const fraction = snapFraction(rawFraction);
            const actualArea = fraction * cand.bed.area;

            schedule.allocate(cand.bed, sowWeek, endWeek, fraction);
            remaining -= actualArea;

            allAllocations.push({
              crop,
              category,
              cropKg: Math.round(cropKg / plantingWeeks.length * 10) / 10,
              areaSqM: Math.round(actualArea * 10) / 10,
              sowWeek,
              bedFraction: fraction,
              eventId: source.id,
              eventLabel: source.label,
              bedAssignment: {
                zoneId: cand.bed.zoneId,
                zoneName: cand.bed.zoneName,
                bedId: cand.bed.bedId,
                bedName: cand.bed.bedName,
              },
            });
          }

          if (remaining > 0.1) {
            allWarnings.push(`\u26a0\ufe0f ${crop.name} W${sowWeek} (${source.label}): ${remaining.toFixed(1)} m\u00b2 overflow \u2014 not enough beds available.`);
          }
        }

        // Timing checks on allocated sow weeks
        const nowWeek = getCurrentWeek();
        const cellWeeks = crop.daysInCell ? Math.ceil(crop.daysInCell / 7) : 0;
        for (const sowWeek of plantingWeeks) {
          // SOW_PAST — missed sow date (within 4 weeks)
          if (nowWeek > sowWeek && nowWeek - sowWeek <= 4) {
            allWarnings.push(`🚨 MISSED: ${crop.name} W${sowWeek} (${source.label}) — sow date passed ${nowWeek - sowWeek} week(s) ago`);
          }
          // SOW_IMMINENT — sow within 0-2 weeks
          else if (sowWeek >= nowWeek && sowWeek - nowWeek <= 2) {
            allWarnings.push(`⏰ URGENT: ${crop.name} W${sowWeek} (${source.label}) — sow ${sowWeek === nowWeek ? 'THIS week' : `in ${sowWeek - nowWeek} week(s)`}`);
          }
          // INDOOR_PAST — transplant crop missed nursery window
          if (cellWeeks > 0) {
            const indoorStart = sowWeek - cellWeeks;
            if (nowWeek > indoorStart && nowWeek <= sowWeek) {
              allWarnings.push(`🚨 MISSED: ${crop.name} (${source.label}) — indoor start missed by ${nowWeek - indoorStart} week(s) (needed W${indoorStart})`);
            }
          }
          // FROST_RISK — warm crop harvest after first frost
          if (crop.season === 'warm') {
            const harvestStart = sowWeek + maturityWeeks;
            if (harvestStart > firstFrostWeek) {
              allWarnings.push(`❄️ FROST RISK: ${crop.name} W${sowWeek} (${source.label}) — harvest starts W${harvestStart}, after first frost W${firstFrostWeek}`);
            }
          }
          // COOL_TOO_LATE — cool crop sown in peak summer
          if (crop.season === 'cool') {
            const summerStart = lastFrostWeek + 10;
            const summerEnd = firstFrostWeek - 10;
            if (sowWeek >= summerStart && sowWeek <= summerEnd) {
              allWarnings.push(`🌡️ HEAT RISK: ${crop.name} W${sowWeek} (${source.label}) — cool crop sown mid-summer, heat stress likely`);
            }
          }
        }
      }
    }
  }

  // Compute summary stats
  let totalArea = 0;
  const bedIds = new Set();
  const cropIds = new Set();
  for (const alloc of allAllocations) {
    totalArea += alloc.areaSqM;
    bedIds.add(alloc.bedAssignment.bedId);
    cropIds.add(alloc.crop.id);
  }

  const summary = {
    totalKg: Math.round(totalKg * 10) / 10,
    totalArea: Math.round(totalArea * 10) / 10,
    bedCount: bedIds.size,
    eventCount: multiDayEvents.length,
    cropCount: cropIds.size,
  };

  return { summary, warnings: allWarnings, allocations: allAllocations };
}

/**
 * Apply computed allocations to zones, returning new zone clones.
 * Now handles flat allocation list (each allocation = one bed + one sow week).
 */
export function applySeasonPlan(zones, allocations, year, mode = 'merge') {
  const newZones = JSON.parse(JSON.stringify(zones));

  for (const zone of newZones) {
    for (const bed of zone.beds) {
      if (mode === 'merge') {
        bed.plantings = (bed.plantings || []).filter(
          p => !(p.source === 'demand' && p.year === year)
        );
      } else {
        bed.plantings = (bed.plantings || []).filter(p => p.year !== year);
      }
    }
  }

  // Insert demand-driven plantings (one per allocation)
  for (const alloc of allocations) {
    const ba = alloc.bedAssignment;
    const zone = newZones.find(z => z.id === ba.zoneId);
    if (!zone) continue;
    const bed = zone.beds.find(b => b.id === ba.bedId);
    if (!bed) continue;

    bed.plantings.push({
      id: generateId(),
      cropId: alloc.crop.id,
      startWeek: alloc.sowWeek,
      year: year,
      bedFraction: alloc.bedFraction,
      notes: `${alloc.eventLabel}: ${alloc.cropKg} kg ${alloc.crop.name}`,
      source: 'demand',
      eventIds: [alloc.eventId],
    });
  }

  return newZones;
}

/**
 * Legacy wrapper — kept for backwards compatibility.
 */
export function generateSeasonPlan(state, mealProfilesList, year) {
  const planYear = year || state.settings?.currentYear || new Date().getFullYear();
  const result = computeSeasonPlan(state, mealProfilesList, planYear);
  const newZones = applySeasonPlan(state.zones, result.allocations, planYear, 'merge');
  return { newZones, ...result };
}

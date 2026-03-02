import { describe, it, expect } from 'vitest';
import {
  aggregateDemand,
  aggregateManualDemand,
  mergeDemandMaps,
  aggregateCSADemand,
  aggregateRestaurantDemand,
  selectCropsForCategory,
  calculateArea,
  calculatePlantingWeeks,
  computeSeasonPlan,
  applySeasonPlan,
} from './demandEngine';
import { mealProfiles, cropCategories } from '../data/mealProfiles';

const settings = {
  lastFrostWeek: 12,
  firstFrostWeek: 44,
  currentYear: 2026,
};

const makeCrop = (id, name, category, opts = {}) => ({
  id,
  name,
  icon: '',
  family: 'Asteraceae',
  category,
  yieldPerM2: 3,
  daysToMaturity: 60,
  harvestWindow: 28,
  daysInCell: 0,
  successionInterval: 14,
  season: 'cool',
  sunRequirement: 'full-sun',
  spacing: 30,
  rowSpacing: 30,
  ...opts,
});

const testCrops = [
  makeCrop('lettuce', 'Lettuce', 'greens', { yieldPerM2: 4, daysToMaturity: 45 }),
  makeCrop('spinach', 'Spinach', 'greens', { yieldPerM2: 2.5, daysToMaturity: 40 }),
  makeCrop('kale', 'Kale', 'greens', { yieldPerM2: 3, daysToMaturity: 55 }),
  makeCrop('carrot', 'Carrot', 'rootVeg', { yieldPerM2: 4, daysToMaturity: 70, family: 'Apiaceae' }),
  makeCrop('tomato', 'Tomato', 'fruitingVeg', { yieldPerM2: 6, daysToMaturity: 80, season: 'warm', family: 'Solanaceae' }),
  makeCrop('basil', 'Basil', 'herbs', { yieldPerM2: 1.5, daysToMaturity: 30 }),
  makeCrop('beans', 'Beans', 'legumes', { yieldPerM2: 2, daysToMaturity: 55, season: 'warm', family: 'Fabaceae' }),
];

// --- aggregateDemand ---

describe('aggregateDemand', () => {
  it('returns zero for no events', () => {
    const result = aggregateDemand([], mealProfiles);
    for (const cat of Object.keys(cropCategories)) {
      expect(result[cat].totalKg).toBe(0);
      expect(result[cat].harvestWindows).toHaveLength(0);
    }
  });

  it('calculates demand for a multi-day event', () => {
    const events = [{
      id: 'e1',
      eventType: 'multi',
      guestCount: 10,
      startDate: '2026-06-01',
      endDate: '2026-06-07',
      mealProfileId: 'full-board',
    }];
    const result = aggregateDemand(events, mealProfiles, 0.30);
    // 7 days * 10 guests * 0.25 kg/person/day * 1.30 loss margin for greens
    const expectedGreens = 0.25 * 10 * 7 * 1.30;
    expect(result.greens.totalKg).toBeCloseTo(expectedGreens, 1);
    expect(result.greens.harvestWindows).toHaveLength(1);
  });

  it('skips events without guest count or dates', () => {
    const events = [
      { id: 'e1', eventType: 'multi', guestCount: 0, startDate: '2026-06-01', endDate: '2026-06-07', mealProfileId: 'full-board' },
      { id: 'e2', eventType: 'multi', guestCount: 10, startDate: '', endDate: '2026-06-07', mealProfileId: 'full-board' },
    ];
    const result = aggregateDemand(events, mealProfiles);
    expect(result.greens.totalKg).toBe(0);
  });

  it('uses customDemand when set', () => {
    const events = [{
      id: 'e1',
      eventType: 'multi',
      guestCount: 5,
      startDate: '2026-06-01',
      endDate: '2026-06-01',
      customDemand: { greens: 1.0 },
    }];
    const result = aggregateDemand(events, mealProfiles, 0);
    // 1 day * 5 guests * 1.0 kg * 1.0 (no loss)
    expect(result.greens.totalKg).toBeCloseTo(5.0, 1);
  });
});

// --- aggregateManualDemand ---

describe('aggregateManualDemand', () => {
  it('aggregates manual entries for matching year', () => {
    const entries = [
      { id: 'm1', category: 'greens', quantityKg: 50, year: 2026 },
      { id: 'm2', category: 'rootVeg', quantityKg: 30, year: 2026 },
      { id: 'm3', category: 'greens', quantityKg: 10, year: 2025 },  // wrong year
    ];
    const result = aggregateManualDemand(entries, testCrops, settings, 2026);
    expect(result.greens.totalKg).toBe(50);
    expect(result.rootVeg.totalKg).toBe(30);
  });

  it('skips zero/negative quantities', () => {
    const entries = [
      { id: 'm1', category: 'greens', quantityKg: 0, year: 2026 },
      { id: 'm2', category: 'greens', quantityKg: -5, year: 2026 },
    ];
    const result = aggregateManualDemand(entries, testCrops, settings, 2026);
    expect(result.greens.totalKg).toBe(0);
  });
});

// --- mergeDemandMaps ---

describe('mergeDemandMaps', () => {
  it('combines two demand maps', () => {
    const a = { greens: { totalKg: 10, harvestWindows: [{ weekStart: 16, weekEnd: 42 }] } };
    const b = { greens: { totalKg: 5, harvestWindows: [{ weekStart: 20, weekEnd: 30 }] } };
    const merged = mergeDemandMaps(a, b);
    expect(merged.greens.totalKg).toBe(15);
    expect(merged.greens.harvestWindows).toHaveLength(2);
  });
});

// --- aggregateCSADemand ---

describe('aggregateCSADemand', () => {
  it('calculates CSA demand correctly', () => {
    const schemes = [{
      id: 'csa1',
      name: 'Test CSA',
      boxesPerWeek: 10,
      capacityPercent: 100,
      boxContents: { greens: 0.5 },
    }];
    const result = aggregateCSADemand(schemes, settings, 0.30, 2026);
    const seasonWeeks = (44 - 2) - (12 + 4) + 1; // 27 weeks
    const expected = 0.5 * 10 * 1 * seasonWeeks * 1.30;
    expect(result.greens.totalKg).toBeCloseTo(expected, 1);
  });

  it('respects year filter', () => {
    const schemes = [{ id: 'csa1', year: 2025, boxesPerWeek: 10, boxContents: { greens: 0.5 } }];
    const result = aggregateCSADemand(schemes, settings, 0.30, 2026);
    expect(result.greens.totalKg).toBe(0);
  });
});

// --- aggregateRestaurantDemand ---

describe('aggregateRestaurantDemand', () => {
  it('calculates restaurant demand', () => {
    const contracts = [{
      id: 'r1',
      name: 'Test Restaurant',
      weeklyOrder: { greens: 5 },
    }];
    const result = aggregateRestaurantDemand(contracts, settings, 0.30, 2026);
    const seasonWeeks = (44 - 2) - (12 + 4) + 1;
    const expected = 5 * seasonWeeks * 1.30;
    expect(result.greens.totalKg).toBeCloseTo(expected, 1);
  });
});

// --- selectCropsForCategory ---

describe('selectCropsForCategory', () => {
  it('returns empty for no matching crops', () => {
    expect(selectCropsForCategory('grains', testCrops, settings)).toEqual([]);
  });

  it('returns single crop with 100% share', () => {
    const result = selectCropsForCategory('rootVeg', testCrops, settings);
    expect(result).toHaveLength(1);
    expect(result[0].share).toBe(1.0);
    expect(result[0].crop.name).toBe('Carrot');
  });

  it('returns 3 crops with diversity split for greens', () => {
    const result = selectCropsForCategory('greens', testCrops, settings);
    expect(result).toHaveLength(3);
    expect(result[0].share).toBe(0.50);
    expect(result[1].share).toBe(0.30);
    expect(result[2].share).toBe(0.20);
    // Sorted by yield descending
    expect(result[0].crop.yieldPerM2).toBeGreaterThanOrEqual(result[1].crop.yieldPerM2);
  });

  it('filters by selectedCropIds', () => {
    const result = selectCropsForCategory('greens', testCrops, settings, ['lettuce']);
    expect(result).toHaveLength(1);
    expect(result[0].crop.id).toBe('lettuce');
  });
});

// --- calculateArea ---

describe('calculateArea', () => {
  it('returns zero for zero demand', () => {
    const result = calculateArea(0, testCrops[0], { weekStart: 16, weekEnd: 42 });
    expect(result.areaSqM).toBe(0);
  });

  it('calculates area for a simple crop', () => {
    // 10 kg needed, yield 4 kg/m2, long harvest window with succession
    const result = calculateArea(10, testCrops[0], { weekStart: 16, weekEnd: 42 });
    expect(result.areaSqM).toBeGreaterThan(0);
    expect(result.harvestCycles).toBeGreaterThanOrEqual(1);
  });

  it('accounts for succession cycles', () => {
    const crop = testCrops[0]; // lettuce: 45 DTM, 14-day succession
    const narrow = calculateArea(10, crop, { weekStart: 16, weekEnd: 22 });
    const wide = calculateArea(10, crop, { weekStart: 16, weekEnd: 42 });
    // More cycles should reduce total area needed
    expect(wide.harvestCycles).toBeGreaterThanOrEqual(narrow.harvestCycles);
  });
});

// --- calculatePlantingWeeks ---

describe('calculatePlantingWeeks', () => {
  it('generates sow weeks working backward from harvest window', () => {
    const crop = testCrops[0]; // lettuce: 45 DTM
    const weeks = calculatePlantingWeeks(crop, { weekStart: 20, weekEnd: 35 }, settings);
    expect(weeks.length).toBeGreaterThan(0);
    // First sow should be before harvest start
    expect(weeks[0]).toBeLessThan(20);
  });

  it('clamps warm-season crops to frost-safe window', () => {
    const tomato = testCrops.find(c => c.id === 'tomato');
    const weeks = calculatePlantingWeeks(tomato, { weekStart: 20, weekEnd: 40 }, settings);
    for (const w of weeks) {
      expect(w).toBeGreaterThanOrEqual(settings.lastFrostWeek);
    }
  });

  it('clamps cool-season crops to extended frost window', () => {
    // Cool crops can start 6 weeks before last frost
    const coolCrop = makeCrop('pea', 'Pea', 'greens', { daysToMaturity: 60, season: 'cool' });
    const weeks = calculatePlantingWeeks(coolCrop, { weekStart: 16, weekEnd: 30 }, settings);
    for (const w of weeks) {
      expect(w).toBeGreaterThanOrEqual(settings.lastFrostWeek - 6);
    }
  });
});

// --- computeSeasonPlan ---

describe('computeSeasonPlan', () => {
  const makeState = (events = [], manualDemandEntries = []) => ({
    events,
    crops: testCrops,
    zones: [{
      id: 'z1',
      name: 'Zone 1',
      beds: [
        { id: 'b1', name: 'Bed 1', width: 0.75, length: 10, plantings: [] },
        { id: 'b2', name: 'Bed 2', width: 0.75, length: 10, plantings: [] },
      ],
    }],
    settings,
    selectedCropIds: ['lettuce', 'carrot', 'tomato', 'basil', 'beans'],
    manualDemandEntries,
    csaSchemes: [],
    restaurantContracts: [],
    demandPlan: { lossMargin: 0.30 },
  });

  it('returns empty plan with no demand', () => {
    const result = computeSeasonPlan(makeState(), mealProfiles, 2026);
    expect(result.summary.totalKg).toBe(0);
    expect(result.allocations).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('generates allocations for manual demand', () => {
    const state = makeState([], [
      { id: 'm1', category: 'greens', quantityKg: 10, year: 2026 },
    ]);
    const result = computeSeasonPlan(state, mealProfiles, 2026);
    expect(result.summary.totalKg).toBeGreaterThan(0);
    expect(result.allocations.length).toBeGreaterThan(0);
  });

  it('generates allocations for events', () => {
    const state = makeState([{
      id: 'e1',
      eventType: 'multi',
      guestCount: 5,
      startDate: '2026-07-01',
      endDate: '2026-07-07',
      mealProfileId: 'full-board',
      name: 'Test Event',
    }]);
    const result = computeSeasonPlan(state, mealProfiles, 2026);
    expect(result.summary.totalKg).toBeGreaterThan(0);
    expect(result.allocations.length).toBeGreaterThan(0);
    expect(result.summary.eventCount).toBe(1);
  });
});

// --- applySeasonPlan ---

describe('applySeasonPlan', () => {
  const zones = [{
    id: 'z1',
    name: 'Zone 1',
    beds: [{
      id: 'b1',
      name: 'Bed 1',
      plantings: [
        { id: 'p1', cropId: 'lettuce', year: 2026, source: 'manual', bedFraction: 1 },
        { id: 'p2', cropId: 'carrot', year: 2026, source: 'demand', bedFraction: 0.5 },
      ],
    }],
  }];

  const allocations = [{
    crop: { id: 'tomato', name: 'Tomato' },
    category: 'fruitingVeg',
    cropKg: 5,
    areaSqM: 3,
    sowWeek: 14,
    bedFraction: 0.5,
    eventId: 'e1',
    eventLabel: 'Test',
    bedAssignment: { zoneId: 'z1', zoneName: 'Zone 1', bedId: 'b1', bedName: 'Bed 1' },
  }];

  it('merge mode: keeps manual plantings, removes old demand', () => {
    const result = applySeasonPlan(zones, allocations, 2026, 'merge');
    const bed = result[0].beds[0];
    // Should keep manual planting + add new demand
    const manual = bed.plantings.filter(p => p.source === 'manual');
    const demand = bed.plantings.filter(p => p.source === 'demand');
    expect(manual).toHaveLength(1);
    expect(demand).toHaveLength(1);
    expect(demand[0].cropId).toBe('tomato');
  });

  it('replace mode: removes all plantings for the year', () => {
    const result = applySeasonPlan(zones, allocations, 2026, 'replace');
    const bed = result[0].beds[0];
    // Only the new demand planting should remain
    expect(bed.plantings).toHaveLength(1);
    expect(bed.plantings[0].source).toBe('demand');
  });

  it('does not mutate original zones', () => {
    const originalPlantingCount = zones[0].beds[0].plantings.length;
    applySeasonPlan(zones, allocations, 2026, 'merge');
    expect(zones[0].beds[0].plantings.length).toBe(originalPlantingCount);
  });
});

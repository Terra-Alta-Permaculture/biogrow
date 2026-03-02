import { describe, it, expect } from 'vitest';
import { getBedHistory, getRotationSuggestions, getQuickSuggestion } from './rotationEngine';

const makeCrop = (id, name, family) => ({ id, name, family, icon: '' });

const crops = [
  makeCrop('tomato', 'Tomato', 'Solanaceae'),
  makeCrop('peas', 'Peas', 'Fabaceae'),
  makeCrop('lettuce', 'Lettuce', 'Asteraceae'),
  makeCrop('carrot', 'Carrot', 'Apiaceae'),
  makeCrop('onion', 'Onion', 'Amaryllidaceae'),
  makeCrop('cabbage', 'Cabbage', 'Brassicaceae'),
];

const zones = [
  {
    name: 'Zone 1',
    beds: [
      {
        id: 'bed-1',
        name: 'Bed A',
        plantings: [
          { cropId: 'tomato', year: 2025, source: 'manual', bedFraction: 1 },
        ],
      },
      {
        id: 'bed-2',
        name: 'Bed B',
        plantings: [],
      },
    ],
  },
];

describe('getBedHistory', () => {
  it('extracts plantings from zones', () => {
    const history = getBedHistory('bed-1', [], zones, crops);
    expect(history).toHaveLength(1);
    expect(history[0].cropName).toBe('Tomato');
    expect(history[0].family).toBe('Solanaceae');
    expect(history[0].year).toBe(2025);
  });

  it('merges rotation history with plantings', () => {
    const rotationHistory = [
      { bedId: 'bed-1', cropId: 'peas', year: 2024, season: 'Spring' },
    ];
    const history = getBedHistory('bed-1', rotationHistory, zones, crops);
    expect(history).toHaveLength(2);
    // Sorted by year descending
    expect(history[0].year).toBe(2025);
    expect(history[1].year).toBe(2024);
  });

  it('deduplicates by cropId + year', () => {
    const rotationHistory = [
      { bedId: 'bed-1', cropId: 'tomato', year: 2025 },
    ];
    const history = getBedHistory('bed-1', rotationHistory, zones, crops);
    expect(history).toHaveLength(1);
  });

  it('returns empty array for unknown bed', () => {
    expect(getBedHistory('no-bed', [], zones, crops)).toEqual([]);
  });
});

describe('getRotationSuggestions', () => {
  it('returns avoid list for recently planted families', () => {
    const result = getRotationSuggestions('bed-1', [], zones, crops, 2026, []);
    expect(result.lastFamily).toBe('Solanaceae');
    // Solanaceae has 4-year minimum, planted in 2025 → should be avoided
    const solan = result.avoid.find(a => a.family === 'Solanaceae');
    expect(solan).toBeTruthy();
    expect(solan.yearsRemaining).toBe(3); // 4 - 1
  });

  it('recommends legumes after heavy feeders (Solanaceae)', () => {
    const result = getRotationSuggestions('bed-1', [], zones, crops, 2026, []);
    const legume = result.recommended.find(r => r.family === 'Fabaceae');
    expect(legume).toBeTruthy();
    expect(legume.reason).toContain('nitrogen');
  });

  it('returns warnings for no history', () => {
    const result = getRotationSuggestions('bed-2', [], zones, crops, 2026, []);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.lastFamily).toBeNull();
  });

  it('suggests ideal crops from selected pool', () => {
    const selected = ['peas', 'lettuce', 'carrot'];
    const result = getRotationSuggestions('bed-1', [], zones, crops, 2026, selected);
    // Should suggest peas (Fabaceae) as ideal after Solanaceae
    if (result.ideal.length > 0) {
      expect(result.ideal.some(c => c.cropName === 'Peas')).toBe(true);
    }
  });

  it('warns about back-to-back same family', () => {
    const zonesBackToBack = [{
      name: 'Z1',
      beds: [{
        id: 'bed-x',
        name: 'X',
        plantings: [
          { cropId: 'tomato', year: 2025 },
          { cropId: 'tomato', year: 2024 },
        ],
      }],
    }];
    const result = getRotationSuggestions('bed-x', [], zonesBackToBack, crops, 2026, []);
    expect(result.warnings.some(w => w.includes('back-to-back'))).toBe(true);
  });
});

describe('getQuickSuggestion', () => {
  it('returns avoid and recommended lists', () => {
    const result = getQuickSuggestion('bed-1', [], zones, crops, 2026);
    expect(result.lastFamily).toBe('Solanaceae');
    expect(result.avoid.length).toBeGreaterThan(0);
    expect(result.recommended.length).toBeGreaterThan(0);
  });

  it('returns empty for unknown bed', () => {
    const result = getQuickSuggestion('nope', [], zones, crops, 2026);
    expect(result.lastFamily).toBeNull();
    expect(result.avoid).toEqual([]);
    expect(result.recommended).toEqual([]);
  });
});

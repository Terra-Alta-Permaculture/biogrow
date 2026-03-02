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

export const defaultZones = [
  {
    id: 'zone-1',
    name: 'Zone 1',
    sunExposure: 'full-sun',
    beds: [
      ...makeBeds('zone-1', 'Z1-A', 6, 0.8, 10, 'Section A'),
      ...makeBeds('zone-1', 'Z1-B', 6, 0.8, 10, 'Section B'),
      ...makeBeds('zone-1', 'Z1-C', 7, 0.8, 10, 'Section C'),
    ],
  },
  {
    id: 'zone-2',
    name: 'Zone 2',
    sunExposure: 'partial-sun',
    beds: [
      { id: 'zone-2-Z2-A-short', name: 'Z2-A Short', width: 0.8, length: 5, section: 'Section A', plantings: [] },
      ...makeBeds('zone-2', 'Z2-A', 9, 0.8, 10, 'Section A'),
      ...makeBeds('zone-2', 'Z2-B', 7, 0.8, 10, 'Section B'),
    ],
  },
  {
    id: 'zone-3',
    name: 'Zone 3',
    sunExposure: 'partial-sun',
    beds: [
      ...makeBeds('zone-3', 'Z3-A', 5, 0.8, 10, 'Section A'),
      ...makeBeds('zone-3', 'Z3-B', 5, 0.8, 10, 'Section B'),
    ],
  },
  {
    id: 'greenhouse',
    name: 'Greenhouse',
    sunExposure: 'full-sun',
    beds: [
      { id: 'greenhouse-GH-1', name: 'GH-1', width: 0.5, length: 8, section: 'Side', plantings: [] },
      { id: 'greenhouse-GH-2', name: 'GH-2', width: 0.5, length: 8, section: 'Side', plantings: [] },
      { id: 'greenhouse-GH-3', name: 'GH-3', width: 0.4, length: 6, section: 'Central', plantings: [] },
      { id: 'greenhouse-GH-4', name: 'GH-4', width: 0.4, length: 6, section: 'Central', plantings: [] },
    ],
  },
];

export const soilTypes = [
  { id: 'sandy', name: 'Sandy', waterHoldingCapacity: 25, infiltrationRate: 'fast' },
  { id: 'sandy-loam', name: 'Sandy Loam', waterHoldingCapacity: 35, infiltrationRate: 'moderate-fast' },
  { id: 'loam', name: 'Loam', waterHoldingCapacity: 45, infiltrationRate: 'moderate' },
  { id: 'clay-loam', name: 'Clay Loam', waterHoldingCapacity: 55, infiltrationRate: 'moderate-slow' },
  { id: 'clay', name: 'Clay', waterHoldingCapacity: 60, infiltrationRate: 'slow' },
  { id: 'raised-bed-mix', name: 'Raised Bed Mix', waterHoldingCapacity: 50, infiltrationRate: 'moderate' },
];

// Crop categories used by the demand engine
export const cropCategories = {
  greens: { label: 'Greens & Leaves', icon: '🥬', color: '#4caf50' },
  rootVeg: { label: 'Root Vegetables', icon: '🥕', color: '#e67e22' },
  fruitingVeg: { label: 'Fruiting Vegetables', icon: '🍅', color: '#e74c3c' },
  herbs: { label: 'Fresh Herbs', icon: '🌿', color: '#26a69a' },
  legumes: { label: 'Legumes', icon: '🫘', color: '#8d6e63' },
  grains: { label: 'Grains', icon: '🌽', color: '#f9a825' },
  fruits: { label: 'Fruits & Berries', icon: '🍓', color: '#e91e63' },
};

// demandPerPersonPerDay values are in kg
// Calibrated from 17 Terra Alta plant-based recipes (35 ppl each)
// + cross-referenced against Heirloom game plan bed allocations (1,525 bed m, 28 crops)
// Conservative values — err toward surplus rather than shortage
export const mealProfiles = [
  {
    id: 'full-board',
    name: 'Full Board',
    description: '3 full meals/day — breakfast, lunch, dinner with diverse produce',
    icon: '🍽️',
    demandPerPersonPerDay: {
      greens: 0.25,
      rootVeg: 0.25,
      fruitingVeg: 0.50,
      herbs: 0.05,
      legumes: 0.10,
      fruits: 0.15,
    },
  },
  {
    id: 'half-board',
    name: 'Half Board',
    description: 'Lunch and dinner — lighter breakfast not included',
    icon: '🥗',
    demandPerPersonPerDay: {
      greens: 0.15,
      rootVeg: 0.15,
      fruitingVeg: 0.35,
      herbs: 0.03,
      legumes: 0.07,
      fruits: 0.10,
    },
  },
  {
    id: 'light-salads',
    name: 'Light / Salads',
    description: 'Salad-focused meals — events like juice retreats, raw food courses',
    icon: '🥬',
    demandPerPersonPerDay: {
      greens: 0.35,
      rootVeg: 0.10,
      fruitingVeg: 0.20,
      herbs: 0.05,
      legumes: 0.05,
      fruits: 0.10,
    },
  },
  {
    id: 'workshop',
    name: 'Workshop',
    description: 'Light catering — snacks and one shared meal per day',
    icon: '🔧',
    demandPerPersonPerDay: {
      greens: 0.12,
      rootVeg: 0.12,
      fruitingVeg: 0.25,
      herbs: 0.03,
      legumes: 0.05,
      fruits: 0.08,
    },
  },
];

export function getProfileById(id) {
  return mealProfiles.find(p => p.id === id) || mealProfiles[0];
}

/**
 * Event category definitions for the demand/events system.
 */

export const EVENT_CATEGORIES = [
  { id: 'farm-to-table', label: 'Farm to Table', icon: '🍽️', color: '#e67e22' },
  { id: 'farmers-market', label: "Farmers' Market", icon: '🧺', color: '#8d6e63' },
  { id: 'csa', label: 'CSA', icon: '📦', color: '#4caf50' },
  { id: 'workshop', label: 'Workshop', icon: '🔧', color: '#5c6bc0' },
  { id: 'restaurant', label: 'Restaurant', icon: '🏪', color: '#e91e63' },
  { id: 'catering', label: 'Catering', icon: '🍳', color: '#ff7043' },
  { id: 'other', label: 'Other', icon: '📋', color: '#78909c' },
];

export const DEFAULT_CATEGORY = 'farm-to-table';

export function getCategoryById(id) {
  return EVENT_CATEGORIES.find(c => c.id === id) || EVENT_CATEGORIES[0];
}

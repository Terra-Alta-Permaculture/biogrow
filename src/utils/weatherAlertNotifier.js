/**
 * Smart frost toast notification — fires once on app load when frost
 * is forecast within 48 hours and user has warm-season crops planted.
 */

const LAST_ALERT_KEY = 'biogrow-frost-alert-last';
const ALERT_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check weather and fire a frost alert toast if conditions are met.
 * @param {object} params
 * @param {Array} params.days - parsed daily forecast from weatherService
 * @param {Array} params.warmPlantings - warm-season planting objects with crop/bed info
 * @param {Function} params.showToast - from useApp()
 * @param {string} params.source - data source ('api'|'memory'|'localStorage'|'stale')
 * @returns {boolean} whether an alert was shown
 */
export function checkAndNotifyFrost({ days, warmPlantings, showToast, source }) {
  // Never fire on stale data (could be outdated)
  if (source === 'stale') return false;

  // Check cooldown
  try {
    const last = localStorage.getItem(LAST_ALERT_KEY);
    if (last && (Date.now() - parseInt(last)) < ALERT_COOLDOWN) return false;
  } catch {}

  // Check for frost in next 48 hours (first 2 days)
  const frostDays = days.slice(0, 2).filter(d => d.tempMin <= 2);
  if (frostDays.length === 0) return false;

  // Must have warm-season crops at risk
  if (!warmPlantings || warmPlantings.length === 0) return false;

  // Build message
  const cropNames = [...new Set(warmPlantings.map(p => p.cropName))];
  const cropList = cropNames.length <= 3
    ? cropNames.join(', ')
    : `${cropNames.slice(0, 3).join(', ')} +${cropNames.length - 3} more`;

  const frostDay = frostDays[0];
  const dayName = new Date(frostDay.date).toLocaleDateString('en-GB', { weekday: 'long' });

  showToast(
    `Frost alert: ${frostDay.tempMin}°C expected ${dayName}. ${warmPlantings.length} warm-season plantings at risk (${cropList}). Consider protection!`,
    { type: 'warning', duration: 10000 }
  );

  // Record timestamp
  try { localStorage.setItem(LAST_ALERT_KEY, Date.now().toString()); } catch {}
  return true;
}

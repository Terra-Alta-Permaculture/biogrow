import { getCurrentWeek } from './helpers';

const SEVERITY = { CRITICAL: 'critical', URGENT: 'urgent', CAUTION: 'caution' };

/**
 * Analyze timing alerts for an array of plantings.
 * @param {Array} plantings - [{ cropId, startWeek, year, id, source, eventIds }]
 * @param {Array} crops - full crop definitions
 * @param {Object} settings - { lastFrostWeek, firstFrostWeek }
 * @param {number} currentWeek - ISO week number
 * @returns {Array} alert objects
 */
export function analyzeTimingAlerts(plantings, crops, settings, currentWeek) {
  const { lastFrostWeek = 12, firstFrostWeek = 44 } = settings || {};
  const alerts = [];

  for (const p of plantings) {
    const crop = crops.find(c => c.id === p.cropId);
    if (!crop) continue;

    const sowWeek = p.startWeek;
    const maturityWeeks = Math.ceil((crop.daysToMaturity || 60) / 7);
    const cellWeeks = crop.daysInCell ? Math.ceil(crop.daysInCell / 7) : 0;
    const indoorStartWeek = cellWeeks > 0 ? sowWeek - cellWeeks : null;

    // 1. SOW_PAST — missed sow date (only within last 4 weeks to reduce noise)
    if (currentWeek > sowWeek && currentWeek - sowWeek <= 4) {
      alerts.push({
        severity: SEVERITY.CRITICAL,
        type: 'SOW_PAST',
        cropName: crop.name,
        cropIcon: crop.icon || '🌱',
        sowWeek,
        message: `${crop.name} W${sowWeek} — sow date passed ${currentWeek - sowWeek} week(s) ago`,
        plantingId: p.id || null,
      });
    }

    // 2. SOW_IMMINENT — sow within 0-2 weeks
    else if (sowWeek >= currentWeek && sowWeek - currentWeek <= 2) {
      alerts.push({
        severity: SEVERITY.URGENT,
        type: 'SOW_IMMINENT',
        cropName: crop.name,
        cropIcon: crop.icon || '🌱',
        sowWeek,
        message: `${crop.name} W${sowWeek} — sow ${sowWeek === currentWeek ? 'THIS week' : `in ${sowWeek - currentWeek} week(s)`}`,
        plantingId: p.id || null,
      });
    }

    // 3. INDOOR_PAST — transplant crop missed nursery window but outdoor sow still possible
    if (indoorStartWeek && currentWeek > indoorStartWeek && currentWeek <= sowWeek) {
      alerts.push({
        severity: SEVERITY.CRITICAL,
        type: 'INDOOR_PAST',
        cropName: crop.name,
        cropIcon: crop.icon || '🌱',
        sowWeek,
        message: `${crop.name} — indoor start missed by ${currentWeek - indoorStartWeek} week(s) (needed W${indoorStartWeek})`,
        plantingId: p.id || null,
      });
    }

    // 4. FROST_RISK — warm crop harvest starts after first frost
    if (crop.season === 'warm') {
      const harvestStart = sowWeek + maturityWeeks;
      if (harvestStart > firstFrostWeek) {
        alerts.push({
          severity: SEVERITY.CAUTION,
          type: 'FROST_RISK',
          cropName: crop.name,
          cropIcon: crop.icon || '🌱',
          sowWeek,
          message: `${crop.name} W${sowWeek} — harvest starts W${harvestStart}, after first frost W${firstFrostWeek}`,
          plantingId: p.id || null,
        });
      }
    }

    // 5. COOL_TOO_LATE — cool crop sown in peak summer heat
    if (crop.season === 'cool') {
      const summerStart = lastFrostWeek + 10;
      const summerEnd = firstFrostWeek - 10;
      if (sowWeek >= summerStart && sowWeek <= summerEnd) {
        alerts.push({
          severity: SEVERITY.CAUTION,
          type: 'COOL_TOO_LATE',
          cropName: crop.name,
          cropIcon: crop.icon || '🌱',
          sowWeek,
          message: `${crop.name} W${sowWeek} — cool crop sown mid-summer, heat stress likely`,
          plantingId: p.id || null,
        });
      }
    }
  }

  return alerts;
}

/**
 * Summarize alerts into counts by severity.
 */
export function summarizeAlerts(alerts) {
  const critical = alerts.filter(a => a.severity === 'critical').length;
  const urgent = alerts.filter(a => a.severity === 'urgent').length;
  const caution = alerts.filter(a => a.severity === 'caution').length;
  return {
    critical,
    urgent,
    caution,
    total: alerts.length,
    worstSeverity: critical > 0 ? 'critical' : urgent > 0 ? 'urgent' : caution > 0 ? 'caution' : 'ok',
  };
}

/**
 * Shared companion planting health analysis utilities.
 * Used by BedsTab (bed badges + per-crop icons) and FarmMap (companion color mode).
 */

/**
 * Analyze companion health for a set of plantings in a bed.
 * @param {Array} plantings - bed.plantings (or year-filtered subset)
 * @param {Array} crops - full crops array from AppContext
 * @param {Array} rules - companionRules from data/companions.js
 * @returns {{ great: number, good: number, bad: number, details: Array }}
 */
export function getCompanionHealth(plantings, crops, rules) {
  const empty = { great: 0, good: 0, bad: 0, details: [] };
  if (!plantings || plantings.length < 2) return empty;

  const cropIds = [...new Set(plantings.map(p => p.cropId).filter(Boolean))];
  if (cropIds.length < 2) return empty;

  const result = { great: 0, good: 0, bad: 0, details: [] };

  for (let i = 0; i < cropIds.length; i++) {
    for (let j = i + 1; j < cropIds.length; j++) {
      const rule = rules.find(
        r => (r.crop1 === cropIds[i] && r.crop2 === cropIds[j]) ||
             (r.crop1 === cropIds[j] && r.crop2 === cropIds[i])
      );
      if (rule) {
        result[rule.type]++;
        const c1 = crops.find(c => c.id === cropIds[i]);
        const c2 = crops.find(c => c.id === cropIds[j]);
        result.details.push({
          crop1Id: cropIds[i],
          crop2Id: cropIds[j],
          crop1Name: c1?.name || cropIds[i],
          crop2Name: c2?.name || cropIds[j],
          type: rule.type,
          reason: rule.reason,
        });
      }
    }
  }

  return result;
}

/**
 * Determine overall health level from companion health counts.
 * @returns {'green' | 'orange' | 'red' | 'gray'}
 */
export function getCompanionHealthLevel(health) {
  const { great, good, bad } = health;
  const hasPositive = great > 0 || good > 0;
  if (!hasPositive && bad === 0) return 'gray';
  if (bad === 0) return 'green';
  if (hasPositive && bad > 0) return 'orange';
  return 'red';
}

/**
 * Get companion status for one crop relative to other crops in the same bed.
 * @param {string} cropId
 * @param {string[]} otherCropIds
 * @param {Array} rules - companionRules
 * @returns {{ worst: 'bad'|'great'|'good'|null, relationships: Array }}
 */
export function getCropCompanionStatus(cropId, otherCropIds, rules) {
  if (!cropId || !otherCropIds || otherCropIds.length === 0) {
    return { worst: null, relationships: [] };
  }

  const relationships = [];
  for (const otherId of otherCropIds) {
    if (otherId === cropId) continue;
    const rule = rules.find(
      r => (r.crop1 === cropId && r.crop2 === otherId) ||
           (r.crop1 === otherId && r.crop2 === cropId)
    );
    if (rule) {
      relationships.push({
        otherCropId: otherId,
        type: rule.type,
        reason: rule.reason,
      });
    }
  }

  if (relationships.length === 0) return { worst: null, relationships };

  // Worst wins: bad > good > great (bad is always surfaced)
  let worst = null;
  if (relationships.some(r => r.type === 'bad')) worst = 'bad';
  else if (relationships.some(r => r.type === 'great')) worst = 'great';
  else if (relationships.some(r => r.type === 'good')) worst = 'good';

  return { worst, relationships };
}

/**
 * Get companion planting suggestions for a bed based on its existing plantings.
 * @param {string[]} existingCropIds - crop IDs already in the bed
 * @param {Array} candidateCrops - crops to evaluate as suggestions
 * @param {Array} rules - companionRules
 * @returns {{ great: Array, good: Array, neutral: Array, bad: Array }}
 */
export function getCompanionSuggestions(existingCropIds, candidateCrops, rules) {
  const result = { great: [], good: [], neutral: [], bad: [] };
  if (!existingCropIds || existingCropIds.length === 0) return result;

  const uniqueExisting = [...new Set(existingCropIds)];

  for (const crop of candidateCrops) {
    if (uniqueExisting.includes(crop.id)) continue;

    const relationships = [];
    for (const existingId of uniqueExisting) {
      const rule = rules.find(
        r => (r.crop1 === crop.id && r.crop2 === existingId) ||
             (r.crop1 === existingId && r.crop2 === crop.id)
      );
      if (rule) {
        relationships.push({ otherCropId: existingId, type: rule.type, reason: rule.reason });
      }
    }

    if (relationships.length === 0) {
      result.neutral.push({ cropId: crop.id, cropName: crop.name, cropIcon: crop.icon, relationships });
      continue;
    }

    const hasBad = relationships.some(r => r.type === 'bad');
    const hasGreat = relationships.some(r => r.type === 'great');

    if (hasBad) result.bad.push({ cropId: crop.id, cropName: crop.name, cropIcon: crop.icon, relationships });
    else if (hasGreat) result.great.push({ cropId: crop.id, cropName: crop.name, cropIcon: crop.icon, relationships });
    else result.good.push({ cropId: crop.id, cropName: crop.name, cropIcon: crop.icon, relationships });
  }

  return result;
}

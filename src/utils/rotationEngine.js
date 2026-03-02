/**
 * Rotation suggestion engine.
 * Merges planting history and generates per-bed rotation recommendations.
 */
import {
  familyRotationMinimums,
  DEFAULT_ROTATION_MIN,
  familyRoles,
  roleCycle,
  specialSuccessors,
} from '../data/rotationRules';

/**
 * Merge rotationHistory + bed.plantings into a unified timeline for one bed.
 * Returns array sorted by year descending (most recent first).
 */
export function getBedHistory(bedId, rotationHistory, zones, crops) {
  const entries = [];
  const seen = new Set();

  // From manual rotation history
  for (const h of (rotationHistory || [])) {
    if (h.bedId !== bedId) continue;
    const crop = crops.find(c => c.id === h.cropId);
    if (!crop) continue;
    const key = `${h.cropId}-${h.year}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({
      year: h.year,
      season: h.season || 'Unknown',
      cropId: h.cropId,
      family: crop.family,
      cropName: crop.name,
    });
  }

  // From bed.plantings
  for (const zone of (zones || [])) {
    for (const bed of (zone.beds || [])) {
      if (bed.id !== bedId) continue;
      for (const p of (bed.plantings || [])) {
        if (!p.cropId || !p.year) continue;
        const key = `${p.cropId}-${p.year}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const crop = crops.find(c => c.id === p.cropId);
        if (!crop) continue;
        entries.push({
          year: p.year,
          season: 'Current',
          cropId: p.cropId,
          family: crop.family,
          cropName: crop.name,
        });
      }
    }
  }

  return entries.sort((a, b) => b.year - a.year);
}

/**
 * Generate rotation suggestions for a single bed.
 */
export function getRotationSuggestions(bedId, rotationHistory, zones, crops, currentYear, selectedCropIds) {
  // Find bed info
  let bedName = bedId;
  let zoneName = '';
  for (const zone of (zones || [])) {
    const bed = (zone.beds || []).find(b => b.id === bedId);
    if (bed) {
      bedName = bed.name;
      zoneName = zone.name;
      break;
    }
  }

  const history = getBedHistory(bedId, rotationHistory, zones, crops);

  if (history.length === 0) {
    return {
      bedId, bedName, zoneName,
      lastFamily: null, lastCropName: null, lastYear: null,
      avoid: [], recommended: [], ideal: [], warnings: ['No planting history for this bed.'],
    };
  }

  // Last planted info
  const lastEntry = history[0];
  const lastFamily = lastEntry.family;
  const lastCropName = lastEntry.cropName;
  const lastYear = lastEntry.year;

  // Build avoid list: families planted within their rotation window
  const familyLastYear = {};
  for (const entry of history) {
    if (!familyLastYear[entry.family] || entry.year > familyLastYear[entry.family]) {
      familyLastYear[entry.family] = entry.year;
    }
  }

  const avoid = [];
  for (const [family, plantedYear] of Object.entries(familyLastYear)) {
    const yearsAgo = currentYear - plantedYear;
    const minYears = familyRotationMinimums[family] || DEFAULT_ROTATION_MIN;
    if (yearsAgo < minYears) {
      avoid.push({ family, yearsRemaining: minYears - yearsAgo, lastPlantedYear: plantedYear });
    }
  }
  avoid.sort((a, b) => b.yearsRemaining - a.yearsRemaining);

  const avoidFamilies = new Set(avoid.map(a => a.family));

  // Build recommended list
  const recommended = [];
  const recommendedFamilies = new Set();

  // Role-based cycle
  const lastRole = familyRoles[lastFamily];
  if (lastRole) {
    const cycleEntry = roleCycle.find(c => c.role === lastRole);
    if (cycleEntry) {
      const nextRole = cycleEntry.nextRole;
      for (const [fam, role] of Object.entries(familyRoles)) {
        if (role === nextRole && !avoidFamilies.has(fam) && !recommendedFamilies.has(fam)) {
          recommended.push({ family: fam, reason: cycleEntry.reason });
          recommendedFamilies.add(fam);
        }
      }
    }
  }

  // Special successors
  for (const ss of specialSuccessors) {
    if (ss.after === lastFamily && !avoidFamilies.has(ss.recommend) && !recommendedFamilies.has(ss.recommend)) {
      recommended.push({ family: ss.recommend, reason: ss.reason });
      recommendedFamilies.add(ss.recommend);
    }
  }

  // Build ideal crop list from recommended families
  const ideal = [];
  if (recommendedFamilies.size > 0) {
    const pool = selectedCropIds && selectedCropIds.length > 0
      ? crops.filter(c => selectedCropIds.includes(c.id))
      : crops;
    for (const crop of pool) {
      if (recommendedFamilies.has(crop.family) && ideal.length < 6) {
        ideal.push({ cropId: crop.id, cropName: crop.name, icon: crop.icon, family: crop.family });
      }
    }
  }

  // Warnings
  const warnings = [];
  // Check for back-to-back same family
  for (let i = 0; i < history.length - 1; i++) {
    if (history[i].family === history[i + 1].family && history[i].year - history[i + 1].year <= 1) {
      warnings.push(`⚠️ ${history[i].family} planted in back-to-back years (${history[i + 1].year}-${history[i].year}).`);
      break;
    }
  }
  if (avoid.length > 3) {
    warnings.push('This bed has limited rotation options. Consider cover cropping.');
  }

  return {
    bedId, bedName, zoneName,
    lastFamily, lastCropName, lastYear,
    avoid, recommended, ideal, warnings,
  };
}

/**
 * Generate suggestions for all beds with planting history.
 */
export function getAllBedSuggestions(rotationHistory, zones, crops, currentYear, selectedCropIds) {
  const results = [];
  const processedBeds = new Set();

  // From zones → beds
  for (const zone of (zones || [])) {
    for (const bed of (zone.beds || [])) {
      if (processedBeds.has(bed.id)) continue;
      processedBeds.add(bed.id);
      const hasPlantings = (bed.plantings || []).length > 0;
      const hasHistory = (rotationHistory || []).some(h => h.bedId === bed.id);
      if (hasPlantings || hasHistory) {
        const suggestion = getRotationSuggestions(bed.id, rotationHistory, zones, crops, currentYear, selectedCropIds);
        if (suggestion.lastFamily) results.push(suggestion);
      }
    }
  }

  return results;
}

/**
 * Lightweight version for BedsTab modal hint.
 * Returns just avoid + recommended + lastFamily.
 */
export function getQuickSuggestion(bedId, rotationHistory, zones, crops, currentYear) {
  const history = getBedHistory(bedId, rotationHistory, zones, crops);
  if (history.length === 0) return { avoid: [], recommended: [], lastFamily: null };

  const lastFamily = history[0].family;

  // Avoid
  const familyLastYear = {};
  for (const entry of history) {
    if (!familyLastYear[entry.family] || entry.year > familyLastYear[entry.family]) {
      familyLastYear[entry.family] = entry.year;
    }
  }

  const avoid = [];
  for (const [family, plantedYear] of Object.entries(familyLastYear)) {
    const yearsAgo = currentYear - plantedYear;
    const minYears = familyRotationMinimums[family] || DEFAULT_ROTATION_MIN;
    if (yearsAgo < minYears) {
      avoid.push({ family, yearsRemaining: minYears - yearsAgo });
    }
  }

  const avoidFamilies = new Set(avoid.map(a => a.family));

  // Recommended
  const recommended = [];
  const recommendedFamilies = new Set();

  const lastRole = familyRoles[lastFamily];
  if (lastRole) {
    const cycleEntry = roleCycle.find(c => c.role === lastRole);
    if (cycleEntry) {
      for (const [fam, role] of Object.entries(familyRoles)) {
        if (role === cycleEntry.nextRole && !avoidFamilies.has(fam) && !recommendedFamilies.has(fam)) {
          recommended.push({ family: fam, reason: cycleEntry.reason });
          recommendedFamilies.add(fam);
        }
      }
    }
  }

  for (const ss of specialSuccessors) {
    if (ss.after === lastFamily && !avoidFamilies.has(ss.recommend) && !recommendedFamilies.has(ss.recommend)) {
      recommended.push({ family: ss.recommend, reason: ss.reason });
      recommendedFamilies.add(ss.recommend);
    }
  }

  return { avoid, recommended, lastFamily };
}

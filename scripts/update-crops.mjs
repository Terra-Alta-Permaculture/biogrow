#!/usr/bin/env node
// One-time script: Update crops.js with Heirloom reference data
// Run: node scripts/update-crops.mjs

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const heirloom = JSON.parse(readFileSync(join(root, 'src/data/heirloom-reference.json'), 'utf8'));
let cropsText = readFileSync(join(root, 'src/data/crops.js'), 'utf8');

const BED_AREA = 7.5; // 10m x 0.75m

// Map Heirloom names → BioGrow crop IDs
const nameToId = {
  'Arugula': 'arugula',
  'Artichoke': 'artichoke',
  'Asparagus': 'asparagus',
  'Beets': 'beets',
  'Belgian endive': 'belgian-endive',
  'Bok Choy': 'bok-choy',
  'Broad beans': 'broad-beans',
  'Broccoli': 'broccoli',
  'Brussels Sprout': 'brussels-sprout',
  'Bush beans': 'bush-beans',
  'Cabbage (chinese)': 'cabbage-chinese',
  'Cabbage (savoy)': 'cabbage-savoy',
  'Cabbage (storage)': 'cabbage-storage',
  'Cabbage (summer)': 'cabbage-summer',
  'Cardoon': 'cardoon',
  'Carrots (fresh)': 'carrots',
  'Carrots (storage)': 'carrots-storage',
  'Cauliflower / Romanesco': 'cauliflower',
  'Celeriac': 'celeriac',
  'Celeriac (mini)': 'celeriac-mini',
  'Celery (cut-and-come-again)': 'celery',
  'Cherry tomatoes': 'cherry-tomatoes',
  'Claytonia': 'claytonia',
  'Collard': 'collard',
  'Corn': 'corn',
  'Corn salad': 'corn-salad',
  'Cress': 'cress',
  'Cucumber (field)': 'cucumber-field',
  'Cucumber (greenhouse)': 'cucumber',
  'Dandelion': 'dandelion',
  'Edamame': 'edamame',
  'Eggplant': 'eggplant',
  'Fennel': 'fennel',
  'Fennel (mini)': 'fennel-mini',
  'Frisee (chicory)': 'frisee',
  'Garlic': 'garlic',
  'Ginger (baby)': 'ginger-baby',
  'Green Onion': 'green-onion',
  'Ground cherry': 'ground-cherry',
  'Heirloom tomatoes': 'heirloom-tomatoes',
  'Hot peppers': 'hot-peppers',
  'Jerusalem artichoke': 'jerusalem-artichoke',
  'Kale': 'kale',
  'Kohlrabi': 'kohlrabi',
  'Kohlrabi (storage)': 'kohlrabi-storage',
  'Leek (storage)': 'leek-storage',
  'Leek (summer)': 'leek-summer',
  'Lettuce': 'lettuce',
  'Lettuce mix': 'lettuce-mix',
  'Little Gem Lettuce': 'little-gem-lettuce',
  'Mesclun mix (salanova)': 'mesclun-mix',
  'Mustard (baby)': 'mustard-baby',
  'Okra': 'okra',
  'Onion (fresh)': 'onion-fresh',
  'Onion (storage)': 'onion-storage',
  'Parsnip': 'parsnip',
  'Patty pan': 'patty-pan',
  'Peas': 'peas',
  'Peppers (field)': 'peppers',
  'Peppers (greenhouse)': 'peppers-greenhouse',
  'Pole beans': 'pole-beans',
  'Potato (new)': 'potato-new',
  'Potato (storage)': 'potato-storage',
  'Pumpkin': 'pumpkin',
  'Radicchio': 'radicchio',
  'Radishes': 'radishes',
  'Rapini': 'rapini',
  'Rhubarb': 'rhubarb',
  'Rutabagas': 'rutabagas',
  'Salad turnips (hakurei)': 'salad-turnips',
  'Salsify': 'salsify',
  'Scarole': 'scarole',
  'Shallot': 'shallot',
  'Snap peas': 'snap-peas',
  'Sorrel': 'sorrel',
  'Spinach': 'spinach',
  'Summer Squash': 'summer-squash',
  'Sugarloaf chicory': 'sugarloaf-chicory',
  'Sweet Peppers': 'sweet-peppers',
  'Sweet Potato': 'sweet-potato',
  'Swiss Chard': 'swiss-chard',
  'Tatsoi': 'tatsoi',
  'Tatsoi (mini)': 'tatsoi-mini',
  'Tomatoes': 'tomatoes',
  'Turmeric': 'turmeric',
  'Turnip': 'turnip',
  'Watermelon': 'watermelon',
  'Winter Squash': 'winter-squash',
  'Zucchini': null, // same as summer-squash, skip
};

// Weight per unit (kg) for unit-harvested crops
const unitWeights = {
  'Artichoke': 0.20, 'Bok Choy': 0.25, 'Broccoli': 0.40,
  'Cabbage (chinese)': 1.00, 'Cabbage (savoy)': 1.50, 'Cabbage (storage)': 2.00,
  'Cabbage (summer)': 1.50, 'Cauliflower / Romanesco': 0.80,
  'Celeriac': 0.50, 'Celeriac (mini)': 0.25, 'Corn': 0.30,
  'Cucumber (field)': 0.25, 'Cucumber (greenhouse)': 0.30,
  'Fennel': 0.30, 'Fennel (mini)': 0.15, 'Garlic': 0.05,
  'Kale': 0.35, 'Kohlrabi': 0.30, 'Kohlrabi (storage)': 0.40,
  'Leek (storage)': 0.30, 'Leek (summer)': 0.30,
  'Lettuce': 0.30, 'Little Gem Lettuce': 0.15,
  'Pumpkin': 4.00, 'Radicchio': 0.30, 'Rutabagas': 0.40,
  'Scarole': 0.40, 'Sugarloaf chicory': 0.50, 'Watermelon': 4.00,
};

// Weight per bunch (kg) for bunch-harvested crops
const bunchWeights = {
  'Beets': 0.45, 'Carrots (fresh)': 0.40, 'Celery (cut-and-come-again)': 0.35,
  'Green Onion': 0.12, 'Onion (fresh)': 0.50, 'Parsnip': 0.60,
  'Radishes': 0.30, 'Rapini': 0.25, 'Salad turnips (hakurei)': 0.40,
  'Sorrel': 0.10, 'Swiss Chard': 0.30, 'Turnip': 0.30,
};

// Known data anomalies to override
const yieldOverrides = {
  'tatsoi': { treatAsUnit: true, unitWeight: 0.25 },
};

function computeYieldPerM2(crop) {
  const id = nameToId[crop.name];
  if (yieldOverrides[id]?.treatAsUnit) {
    return +(crop.yieldPer10m * yieldOverrides[id].unitWeight / BED_AREA).toFixed(1);
  }
  if (crop.harvestUnit === 'kg') return +(crop.yieldPer10m / BED_AREA).toFixed(1);
  if (crop.harvestUnit === 'gram') return +((crop.yieldPer10m / 1000) / BED_AREA).toFixed(1);
  if (crop.harvestUnit === 'unit') {
    const w = unitWeights[crop.name];
    if (!w) { console.warn(`No unit weight for: ${crop.name}`); return null; }
    return +(crop.yieldPer10m * w / BED_AREA).toFixed(1);
  }
  if (crop.harvestUnit === 'bunch') {
    const w = bunchWeights[crop.name];
    if (!w) { console.warn(`No bunch weight for: ${crop.name}`); return null; }
    return +(crop.yieldPer10m * w / BED_AREA).toFixed(1);
  }
  return null;
}

let updated = 0;
let yieldOnly = 0;
let skipped = 0;

for (const crop of heirloom) {
  const id = nameToId[crop.name];
  if (!id) { skipped++; continue; }

  // Find this crop's object in crops.js
  const idPattern = new RegExp(`(\\{[^}]*id:\\s*'${id}'[^}]*\\})`, 's');
  const match = cropsText.match(idPattern);
  if (!match) {
    console.warn(`Crop ID '${id}' not found in crops.js`);
    skipped++;
    continue;
  }

  let line = match[1];
  let original = line;

  // Compute yieldPerM2
  const yieldPerM2 = computeYieldPerM2(crop);
  if (yieldPerM2 !== null && yieldPerM2 > 0) {
    line = line.replace(/yieldPerM2:\s*[\d.]+/, `yieldPerM2: ${yieldPerM2}`);
  }

  // Only update spacing/dtm/harvestWindow/daysInCell if Heirloom has growing data
  if (crop.method !== 'none' && crop.dtm > 0) {
    // daysToMaturity
    line = line.replace(/daysToMaturity:\s*\d+/, `daysToMaturity: ${crop.dtm}`);

    // spacing (in-row)
    if (crop.spacingCm > 0) {
      const sp = Math.round(crop.spacingCm);
      // Clamp peas/snap-peas to minimum 5cm
      const finalSp = (id === 'peas' || id === 'snap-peas') ? Math.max(sp, 5) : sp;
      line = line.replace(/spacing:\s*\d+/, `spacing: ${finalSp}`);
    }

    // rowSpacing - only update for multi-row crops with actual row spacing data
    if (crop.rows > 1 && crop.rowSpacingCm > 0) {
      const rs = Math.round(crop.rowSpacingCm);
      line = line.replace(/rowSpacing:\s*\d+/, `rowSpacing: ${rs}`);
    }

    // harvestWindow (days) — inject or update
    if (crop.harvestWindow > 0) {
      if (line.includes('harvestWindow:')) {
        line = line.replace(/harvestWindow:\s*\d+/, `harvestWindow: ${crop.harvestWindow}`);
      } else {
        // Insert after daysToMaturity
        line = line.replace(
          /daysToMaturity:\s*\d+/,
          `daysToMaturity: ${crop.dtm}, harvestWindow: ${crop.harvestWindow}`
        );
      }
    }

    // daysInCell (transplant nursery time) — inject or update
    if (crop.tr_daysInCell > 0) {
      if (line.includes('daysInCell:')) {
        line = line.replace(/daysInCell:\s*\d+/, `daysInCell: ${crop.tr_daysInCell}`);
      } else {
        // Insert before seedsPerGram
        line = line.replace(
          /seedsPerGram:\s*/,
          `daysInCell: ${crop.tr_daysInCell}, seedsPerGram: `
        );
      }
    }

    updated++;
  } else if (yieldPerM2 !== null && yieldPerM2 > 0) {
    yieldOnly++;
  } else {
    skipped++;
  }

  if (line !== original) {
    cropsText = cropsText.replace(original, line);
  }
}

writeFileSync(join(root, 'src/data/crops.js'), cropsText);

console.log(`\nDone!`);
console.log(`  Updated (yield + spacing + dtm + harvestWindow + daysInCell): ${updated}`);
console.log(`  Yield only (no growing data): ${yieldOnly}`);
console.log(`  Skipped: ${skipped}`);

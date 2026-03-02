/**
 * Historical frost date estimation using Open-Meteo Archive API.
 * Analyzes past 5 years of daily minimum temperatures to estimate
 * last spring frost and first fall frost weeks.
 */

const HISTORY_YEARS = 5;

/**
 * Estimate frost dates for a location from historical weather data.
 * @param {number} lat - latitude
 * @param {number} lng - longitude
 * @returns {Promise<{ lastFrostWeek: number, firstFrostWeek: number, confidence: string, yearsAnalyzed: number }>}
 */
export async function estimateFrostDates(lat, lng) {
  const endYear = new Date().getFullYear() - 1;
  const startYear = endYear - HISTORY_YEARS + 1;

  const url = `https://archive-api.open-meteo.com/v1/archive`
    + `?latitude=${lat}&longitude=${lng}`
    + `&start_date=${startYear}-01-01&end_date=${endYear}-12-31`
    + `&daily=temperature_2m_min&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch historical data');
  const data = await res.json();

  if (!data.daily?.time || !data.daily?.temperature_2m_min) {
    throw new Error('No historical data available');
  }

  const yearlyLastFrost = [];
  const yearlyFirstFrost = [];

  for (let yr = startYear; yr <= endYear; yr++) {
    let lastSpring = null;
    let firstFall = null;

    data.daily.time.forEach((dateStr, i) => {
      const d = new Date(dateStr);
      if (d.getFullYear() !== yr) return;
      const temp = data.daily.temperature_2m_min[i];
      if (temp === null || temp === undefined) return;

      const dayOfYear = Math.floor((d - new Date(yr, 0, 1)) / 86400000) + 1;

      if (temp <= 0) {
        if (dayOfYear < 182) { // Before July 1 — spring frost
          lastSpring = dayOfYear;
        } else if (!firstFall) { // After July 1 — first fall frost
          firstFall = dayOfYear;
        }
      }
    });

    if (lastSpring) yearlyLastFrost.push(lastSpring);
    if (firstFall) yearlyFirstFrost.push(firstFall);
  }

  // Average day-of-year and convert to ISO week
  const avgLastDay = yearlyLastFrost.length > 0
    ? Math.round(yearlyLastFrost.reduce((s, v) => s + v, 0) / yearlyLastFrost.length)
    : null;
  const avgFirstDay = yearlyFirstFrost.length > 0
    ? Math.round(yearlyFirstFrost.reduce((s, v) => s + v, 0) / yearlyFirstFrost.length)
    : null;

  const lastFrostWeek = avgLastDay ? Math.ceil(avgLastDay / 7) : 12;
  const firstFrostWeek = avgFirstDay ? Math.ceil(avgFirstDay / 7) : 44;

  const frostYears = Math.max(yearlyLastFrost.length, yearlyFirstFrost.length);
  const confidence = frostYears >= 3 ? 'high' : frostYears >= 1 ? 'medium' : 'low';

  return { lastFrostWeek, firstFrostWeek, confidence, yearsAnalyzed: HISTORY_YEARS, frostFreeClimate: frostYears === 0 };
}

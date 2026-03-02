export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function getCurrentWeek() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

export function getWeekDates(year, week) {
  const jan1 = new Date(year, 0, 1);
  const days = (week - 1) * 7;
  const start = new Date(jan1);
  start.setDate(jan1.getDate() + days - jan1.getDay() + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

export function bedArea(bed) {
  return +(bed.width * bed.length).toFixed(2);
}

export function getSeasonPhase(weekNum, lastFrostWeek, firstFrostWeek) {
  if (weekNum < lastFrostWeek - 6) return { name: 'Winter', icon: '❄️', color: '#90caf9' };
  if (weekNum < lastFrostWeek - 2) return { name: 'Pre-Spring', icon: '🌸', color: '#ce93d8' };
  if (weekNum < lastFrostWeek + 8) return { name: 'Spring', icon: '🌱', color: '#a5d6a7' };
  if (weekNum < firstFrostWeek - 8) return { name: 'Summer', icon: '☀️', color: '#fff176' };
  if (weekNum < firstFrostWeek) return { name: 'Fall', icon: '🍂', color: '#ffcc80' };
  return { name: 'Late Fall', icon: '🍁', color: '#bcaaa4' };
}

export function weekToMonth(week) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = Math.min(11, Math.floor((week - 1) / 4.33));
  return months[monthIdx];
}

export function monthToWeekRange(monthIdx) {
  const start = Math.round(monthIdx * 4.33) + 1;
  const end = Math.round((monthIdx + 1) * 4.33);
  return { start, end };
}

export function dateToWeek(dateStr) {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - start) / 86400000 + 1) / 7);
}

export function getCurrentYear() {
  return new Date().getFullYear();
}

export function daysUntil(dateStr) {
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / 86400000);
}

export function daysBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  return Math.round(Math.abs(d2 - d1) / 86400000);
}

/**
 * Generate succession sow weeks from a start week and interval.
 * @param {number} startWeek - first sow week
 * @param {number} intervalDays - succession interval in days
 * @param {object} options
 * @param {number} [options.endWeek] - last possible sow week (inclusive)
 * @param {number} [options.count] - number of sowings (alternative to endWeek)
 * @param {number} [options.firstFrostWeek] - frost cutoff for warm-season crops
 * @param {number} [options.daysToMaturity] - crop DTM for frost safety
 * @param {string} [options.season] - 'warm' or 'cool'
 * @returns {number[]} array of sow week numbers
 */
export function generateSuccessionSequence(startWeek, intervalDays, options = {}) {
  const intervalWeeks = Math.max(1, Math.ceil(intervalDays / 7));
  const weeks = [startWeek];
  const maxWeek = options.endWeek || 52;
  const maxCount = options.count || 26;

  let next = startWeek + intervalWeeks;
  while (next <= maxWeek && weeks.length < maxCount) {
    if (options.season === 'warm' && options.firstFrostWeek && options.daysToMaturity) {
      const matWeeks = Math.ceil(options.daysToMaturity / 7);
      if (next + matWeeks > options.firstFrostWeek) break;
    }
    weeks.push(next);
    next += intervalWeeks;
  }

  return weeks;
}

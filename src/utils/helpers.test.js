import { describe, it, expect } from 'vitest';
import {
  generateId,
  formatDate,
  formatDateShort,
  getCurrentWeek,
  getWeekDates,
  bedArea,
  getSeasonPhase,
  weekToMonth,
  monthToWeekRange,
  dateToWeek,
  getCurrentYear,
  daysUntil,
  daysBetween,
  generateSuccessionSequence,
} from './helpers';

describe('generateId', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateId()).toBe('string');
    expect(generateId().length).toBeGreaterThan(0);
  });

  it('returns unique values on successive calls', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateId()));
    expect(ids.size).toBe(50);
  });
});

describe('formatDate', () => {
  it('formats a date string', () => {
    const result = formatDate('2026-03-15');
    expect(result).toContain('15');
    expect(result).toContain('Mar');
    expect(result).toContain('2026');
  });

  it('returns empty string for falsy input', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
  });
});

describe('formatDateShort', () => {
  it('formats without year', () => {
    const result = formatDateShort('2026-06-01');
    expect(result).toContain('Jun');
    expect(result).not.toContain('2026');
  });

  it('returns empty string for falsy input', () => {
    expect(formatDateShort('')).toBe('');
  });
});

describe('getCurrentWeek', () => {
  it('returns a number between 1 and 53', () => {
    const week = getCurrentWeek();
    expect(week).toBeGreaterThanOrEqual(1);
    expect(week).toBeLessThanOrEqual(53);
  });
});

describe('getWeekDates', () => {
  it('returns start and end dates for a given week', () => {
    const { start, end } = getWeekDates(2026, 10);
    expect(start instanceof Date).toBe(true);
    expect(end instanceof Date).toBe(true);
    expect(end > start).toBe(true);
    // 6-day span (Mon-Sun)
    const diffDays = (end - start) / 86400000;
    expect(diffDays).toBe(6);
  });
});

describe('bedArea', () => {
  it('calculates width * length', () => {
    expect(bedArea({ width: 0.75, length: 10 })).toBe(7.5);
  });

  it('rounds to 2 decimal places', () => {
    expect(bedArea({ width: 0.33, length: 3.33 })).toBe(1.1);
  });
});

describe('getSeasonPhase', () => {
  const lastFrost = 12;
  const firstFrost = 44;

  it('returns Winter for early weeks', () => {
    expect(getSeasonPhase(2, lastFrost, firstFrost).name).toBe('Winter');
  });

  it('returns Pre-Spring before frost', () => {
    expect(getSeasonPhase(8, lastFrost, firstFrost).name).toBe('Pre-Spring');
  });

  it('returns Spring after last frost', () => {
    expect(getSeasonPhase(14, lastFrost, firstFrost).name).toBe('Spring');
  });

  it('returns Summer in mid-season', () => {
    expect(getSeasonPhase(28, lastFrost, firstFrost).name).toBe('Summer');
  });

  it('returns Fall before first frost', () => {
    expect(getSeasonPhase(40, lastFrost, firstFrost).name).toBe('Fall');
  });

  it('returns Late Fall after first frost', () => {
    expect(getSeasonPhase(46, lastFrost, firstFrost).name).toBe('Late Fall');
  });

  it('always returns an icon and color', () => {
    for (let w = 1; w <= 52; w++) {
      const phase = getSeasonPhase(w, lastFrost, firstFrost);
      expect(phase.icon).toBeTruthy();
      expect(phase.color).toMatch(/^#/);
    }
  });
});

describe('weekToMonth', () => {
  it('maps week 1 to Jan', () => {
    expect(weekToMonth(1)).toBe('Jan');
  });

  it('maps week 26 to Jun or Jul', () => {
    const month = weekToMonth(26);
    expect(['Jun', 'Jul']).toContain(month);
  });

  it('maps week 52 to Dec', () => {
    expect(weekToMonth(52)).toBe('Dec');
  });
});

describe('monthToWeekRange', () => {
  it('returns start and end weeks for January', () => {
    const { start, end } = monthToWeekRange(0);
    expect(start).toBe(1);
    expect(end).toBeGreaterThan(start);
  });
});

describe('dateToWeek', () => {
  it('returns a number between 1 and 53', () => {
    const week = dateToWeek('2026-06-15');
    expect(week).toBeGreaterThanOrEqual(1);
    expect(week).toBeLessThanOrEqual(53);
  });

  it('first week of Jan is week 1', () => {
    expect(dateToWeek('2026-01-02')).toBeLessThanOrEqual(2);
  });
});

describe('getCurrentYear', () => {
  it('returns the current year', () => {
    expect(getCurrentYear()).toBe(new Date().getFullYear());
  });
});

describe('daysUntil', () => {
  it('returns positive for future dates', () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    expect(daysUntil(future.toISOString())).toBeGreaterThanOrEqual(9);
  });

  it('returns negative for past dates', () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    expect(daysUntil(past.toISOString())).toBeLessThanOrEqual(-4);
  });
});

describe('daysBetween', () => {
  it('returns absolute difference', () => {
    expect(daysBetween('2026-01-01', '2026-01-11')).toBe(10);
    expect(daysBetween('2026-01-11', '2026-01-01')).toBe(10);
  });
});

describe('generateSuccessionSequence', () => {
  it('generates weekly intervals', () => {
    const weeks = generateSuccessionSequence(10, 7, { endWeek: 20 });
    expect(weeks).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it('generates biweekly intervals', () => {
    const weeks = generateSuccessionSequence(10, 14, { endWeek: 20 });
    expect(weeks).toEqual([10, 12, 14, 16, 18, 20]);
  });

  it('respects count limit', () => {
    const weeks = generateSuccessionSequence(1, 7, { count: 3 });
    expect(weeks).toHaveLength(3);
  });

  it('respects frost cutoff for warm-season crops', () => {
    const weeks = generateSuccessionSequence(20, 14, {
      endWeek: 52,
      season: 'warm',
      firstFrostWeek: 44,
      daysToMaturity: 70,
    });
    // Last sow + 10 weeks maturity must be before week 44
    for (const w of weeks) {
      expect(w + Math.ceil(70 / 7)).toBeLessThanOrEqual(44);
    }
  });

  it('always includes start week', () => {
    const weeks = generateSuccessionSequence(5, 30);
    expect(weeks[0]).toBe(5);
  });
});

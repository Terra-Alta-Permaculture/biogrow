import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock supabase to null so auth tests run in local-only mode
vi.mock('../lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: () => false,
}));

import {
  hashPassword,
  signUp,
  signIn,
  signOut,
  getCurrentUser,
  persistUser,
  getTrialDaysRemaining,
  isSubscriptionActive,
  validatePromoCode,
  getAvatarEmoji,
  verifySubscriptionFromSupabase,
} from './auth';

beforeEach(() => {
  localStorage.clear();
});

describe('hashPassword', () => {
  it('returns a hex string', async () => {
    const hash = await hashPassword('test123');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic', async () => {
    const a = await hashPassword('hello');
    const b = await hashPassword('hello');
    expect(a).toBe(b);
  });

  it('different inputs produce different hashes', async () => {
    const a = await hashPassword('abc');
    const b = await hashPassword('xyz');
    expect(a).not.toBe(b);
  });
});

describe('signUp', () => {
  it('creates a new user successfully', async () => {
    const result = await signUp({ email: 'test@farm.com', password: 'pass123', name: 'Test', farmName: 'Farm' });
    expect(result.success).toBe(true);
    expect(result.data.email).toBe('test@farm.com');
    expect(result.data.profile.name).toBe('Test');
    expect(result.data.subscription.plan).toBe('trial');
  });

  it('rejects duplicate email', async () => {
    await signUp({ email: 'test@farm.com', password: 'pass123', name: 'A' });
    const result = await signUp({ email: 'test@farm.com', password: 'pass456', name: 'B' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already exists');
  });

  it('rejects short passwords', async () => {
    const result = await signUp({ email: 'x@y.com', password: '123', name: 'X' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('6 characters');
  });

  it('normalizes email to lowercase', async () => {
    const result = await signUp({ email: ' Test@Farm.COM ', password: 'pass123', name: 'T' });
    expect(result.data.email).toBe('test@farm.com');
  });
});

describe('signIn', () => {
  beforeEach(async () => {
    await signUp({ email: 'farmer@bio.com', password: 'grow123', name: 'Farmer' });
  });

  it('signs in with correct credentials', async () => {
    const result = await signIn({ email: 'farmer@bio.com', password: 'grow123' });
    expect(result.success).toBe(true);
    expect(result.data.email).toBe('farmer@bio.com');
  });

  it('rejects wrong password', async () => {
    const result = await signIn({ email: 'farmer@bio.com', password: 'wrong' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Incorrect password');
  });

  it('rejects unknown email', async () => {
    const result = await signIn({ email: 'nobody@bio.com', password: 'grow123' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('No account');
  });
});

describe('signOut / getCurrentUser', () => {
  it('clears auth and returns null', async () => {
    await signUp({ email: 'a@b.com', password: 'pass123', name: 'A' });
    expect(getCurrentUser()).not.toBeNull();
    signOut();
    expect(getCurrentUser()).toBeNull();
  });
});

describe('persistUser', () => {
  it('saves and retrieves user', () => {
    const user = { id: 'u1', email: 'a@b.com', profile: {}, subscription: {} };
    persistUser(user);
    expect(getCurrentUser()).toEqual(user);
  });

  it('clears user when null', () => {
    persistUser({ id: 'u1', email: 'a@b.com' });
    persistUser(null);
    expect(getCurrentUser()).toBeNull();
  });
});

describe('getTrialDaysRemaining', () => {
  it('returns positive for future end date', () => {
    const future = new Date(Date.now() + 15 * 86400000).toISOString();
    const days = getTrialDaysRemaining(future);
    expect(days).toBeGreaterThanOrEqual(14);
    expect(days).toBeLessThanOrEqual(16);
  });

  it('returns 0 for past end date', () => {
    const past = new Date(Date.now() - 5 * 86400000).toISOString();
    expect(getTrialDaysRemaining(past)).toBe(0);
  });

  it('returns 0 for null/undefined', () => {
    expect(getTrialDaysRemaining(null)).toBe(0);
    expect(getTrialDaysRemaining(undefined)).toBe(0);
  });
});

describe('isSubscriptionActive', () => {
  it('returns true for paid plan', () => {
    expect(isSubscriptionActive({ plan: 'paid' })).toBe(true);
  });

  it('returns true for active trial', () => {
    const future = new Date(Date.now() + 10 * 86400000).toISOString();
    expect(isSubscriptionActive({ plan: 'trial', trialEndDate: future })).toBe(true);
  });

  it('returns false for expired trial', () => {
    const past = new Date(Date.now() - 1 * 86400000).toISOString();
    expect(isSubscriptionActive({ plan: 'trial', trialEndDate: past })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isSubscriptionActive(null)).toBe(false);
  });
});

describe('validatePromoCode', () => {
  it('validates known codes', () => {
    const result = validatePromoCode('BIOGROW50');
    expect(result).not.toBeNull();
    expect(result.discount).toBe(0.5);
  });

  it('is case-insensitive', () => {
    expect(validatePromoCode('biogrow50')).not.toBeNull();
    expect(validatePromoCode('  BioGrow50  ')).not.toBeNull();
  });

  it('returns null for invalid codes', () => {
    expect(validatePromoCode('INVALID')).toBeNull();
    expect(validatePromoCode('')).toBeNull();
    expect(validatePromoCode(null)).toBeNull();
  });
});

describe('getAvatarEmoji', () => {
  it('returns emoji for known avatar', () => {
    expect(getAvatarEmoji('seedling')).toBe('\u{1F331}');
  });

  it('returns seedling for unknown avatar', () => {
    expect(getAvatarEmoji('nonexistent')).toBe('\u{1F331}');
  });
});

describe('verifySubscriptionFromSupabase', () => {
  it('returns null when Supabase is not configured', async () => {
    const result = await verifySubscriptionFromSupabase('some-user-id');
    expect(result).toBeNull();
  });

  it('returns null for null userId', async () => {
    const result = await verifySubscriptionFromSupabase(null);
    expect(result).toBeNull();
  });

  it('returns null for undefined userId', async () => {
    const result = await verifySubscriptionFromSupabase(undefined);
    expect(result).toBeNull();
  });
});

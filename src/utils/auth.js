import { generateId } from './helpers';
import { PROMO_CODES, TRIAL_DAYS } from '../data/promoCodes';

const USERS_KEY = 'biogrow-users';
const AUTH_KEY = 'biogrow-auth';

// --- Password hashing (SHA-256 via SubtleCrypto) ---

export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- User registry helpers ---

function getUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// --- Auth functions (all return { success, data?, error? }) ---

export async function signUp({ email, password, name, farmName }) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const users = getUsers();

    if (users.find(u => u.email === normalizedEmail)) {
      return { success: false, error: 'An account with this email already exists' };
    }

    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    const pwHash = await hashPassword(password);
    const id = generateId();
    const now = new Date().toISOString();
    const trialEnd = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString();

    const user = {
      id,
      email: normalizedEmail,
      passwordHash: pwHash,
      createdAt: now,
      profile: {
        name: name.trim(),
        farmName: farmName?.trim() || '',
        location: '',
        farmSize: '',
        growingPhilosophy: 'biointensive',
        avatar: 'seedling',
        bio: '',
      },
      subscription: {
        plan: 'trial',
        trialStartDate: now,
        trialEndDate: trialEnd,
        paidAt: null,
        promoCode: null,
        promoDiscount: 0,
      },
    };

    // Save to user registry (minimal data for login lookup)
    users.push({ id, email: normalizedEmail, passwordHash: pwHash });
    saveUsers(users);

    // Save full user data under per-user key + active session
    localStorage.setItem(`biogrow-user-${id}`, JSON.stringify(user));
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));

    return { success: true, data: user };
  } catch (e) {
    return { success: false, error: e.message || 'Sign up failed' };
  }
}

export async function signIn({ email, password }) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const users = getUsers();
    const userEntry = users.find(u => u.email === normalizedEmail);

    if (!userEntry) {
      return { success: false, error: 'No account found with this email' };
    }

    const pwHash = await hashPassword(password);
    if (pwHash !== userEntry.passwordHash) {
      return { success: false, error: 'Incorrect password' };
    }

    // Load full user data from per-user storage, then active session fallback
    let user;
    try {
      const perUserRaw = localStorage.getItem(`biogrow-user-${userEntry.id}`);
      const perUser = perUserRaw ? JSON.parse(perUserRaw) : null;
      if (perUser && perUser.id === userEntry.id) {
        user = perUser;
      } else {
        const raw = localStorage.getItem(AUTH_KEY);
        const saved = raw ? JSON.parse(raw) : null;
        if (saved && saved.id === userEntry.id) {
          user = saved;
        }
      }
    } catch {}

    if (!user) {
      // Rebuild minimal user object (profile data may have been lost)
      const now = new Date().toISOString();
      user = {
        id: userEntry.id,
        email: normalizedEmail,
        passwordHash: userEntry.passwordHash,
        createdAt: now,
        profile: { name: '', farmName: '', location: '', farmSize: '', growingPhilosophy: 'biointensive', avatar: 'seedling', bio: '' },
        subscription: { plan: 'trial', trialStartDate: now, trialEndDate: new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString(), paidAt: null, promoCode: null, promoDiscount: 0 },
      };
    }

    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    return { success: true, data: user };
  } catch (e) {
    return { success: false, error: e.message || 'Sign in failed' };
  }
}

export function signOut() {
  localStorage.removeItem(AUTH_KEY);
  return { success: true };
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function persistUser(user) {
  if (user) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    // Also save to per-user key so data survives sign-out
    localStorage.setItem(`biogrow-user-${user.id}`, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_KEY);
  }
}

// --- Subscription helpers ---

export function getTrialDaysRemaining(trialEndDate) {
  if (!trialEndDate) return 0;
  const end = new Date(trialEndDate);
  const now = new Date();
  const diff = Math.ceil((end - now) / 86400000);
  return Math.max(0, diff);
}

export function isSubscriptionActive(subscription) {
  if (!subscription) return false;
  if (subscription.plan === 'paid') return true;
  if (subscription.plan === 'trial') {
    return getTrialDaysRemaining(subscription.trialEndDate) > 0;
  }
  return false;
}

export function validatePromoCode(code) {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  return PROMO_CODES[normalized] || null;
}

// --- Avatar data ---

export const AVATARS = [
  { id: 'farmer-man', emoji: '\u{1F468}\u200D\u{1F33E}', label: 'Farmer' },
  { id: 'farmer-woman', emoji: '\u{1F469}\u200D\u{1F33E}', label: 'Farmer' },
  { id: 'seedling', emoji: '\u{1F331}', label: 'Seedling' },
  { id: 'tree', emoji: '\u{1F333}', label: 'Tree' },
  { id: 'sunflower', emoji: '\u{1F33B}', label: 'Sunflower' },
  { id: 'tractor', emoji: '\u{1F69C}', label: 'Tractor' },
  { id: 'herb', emoji: '\u{1F33F}', label: 'Herb' },
  { id: 'mushroom', emoji: '\u{1F344}', label: 'Mushroom' },
  { id: 'bee', emoji: '\u{1F41D}', label: 'Bee' },
  { id: 'butterfly', emoji: '\u{1F98B}', label: 'Butterfly' },
  { id: 'earth', emoji: '\u{1F30D}', label: 'Earth' },
  { id: 'garden', emoji: '\u{1F3E1}', label: 'Homestead' },
];

export function getAvatarEmoji(avatarId) {
  const a = AVATARS.find(av => av.id === avatarId);
  return a ? a.emoji : '\u{1F331}';
}

export const GROWING_PHILOSOPHIES = [
  { value: 'biointensive', label: 'Bio-Intensive', icon: '\u{1F33F}' },
  { value: 'permaculture', label: 'Permaculture', icon: '\u{1F300}' },
  { value: 'organic', label: 'Organic', icon: '\u{1F331}' },
  { value: 'regenerative', label: 'Regenerative', icon: '\u267B\uFE0F' },
  { value: 'no-dig', label: 'No-Dig', icon: '\u{1FAB1}' },
  { value: 'hydroponic', label: 'Hydroponic', icon: '\u{1F4A7}' },
  { value: 'conventional', label: 'Conventional', icon: '\u{1F69C}' },
  { value: 'other', label: 'Other', icon: '\u{1F33E}' },
];

import { generateId } from './helpers';
import { PROMO_CODES, TRIAL_DAYS } from '../data/promoCodes';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { uploadLocalData } from '../lib/syncEngine';

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

    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    // --- Supabase mode ---
    if (isSupabaseConfigured()) {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });

      if (authError) return { success: false, error: authError.message };

      const supaUser = authData.user;
      if (!supaUser) return { success: false, error: 'Sign up failed — please try again' };

      // Update profile with name/farm
      await supabase.from('profiles').update({
        name: name.trim(),
        farm_name: farmName?.trim() || '',
      }).eq('id', supaUser.id);

      const now = new Date().toISOString();
      const trialEnd = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString();

      const user = {
        id: supaUser.id,
        email: normalizedEmail,
        createdAt: now,
        authMode: 'supabase',
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

      localStorage.setItem(AUTH_KEY, JSON.stringify(user));
      return { success: true, data: user };
    }

    // --- Local mode (fallback) ---
    const users = getUsers();

    if (users.find(u => u.email === normalizedEmail)) {
      return { success: false, error: 'An account with this email already exists' };
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

    users.push({ id, email: normalizedEmail, passwordHash: pwHash });
    saveUsers(users);

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

    // --- Supabase mode ---
    if (isSupabaseConfigured()) {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (authError) return { success: false, error: authError.message };

      const supaUser = authData.user;
      if (!supaUser) return { success: false, error: 'Sign in failed' };

      // Load profile from Supabase
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, farm_name, avatar')
        .eq('id', supaUser.id)
        .single();

      // Load subscription from Supabase
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', supaUser.id)
        .single();

      const user = {
        id: supaUser.id,
        email: normalizedEmail,
        createdAt: supaUser.created_at,
        authMode: 'supabase',
        profile: {
          name: profile?.name || '',
          farmName: profile?.farm_name || '',
          location: '',
          farmSize: '',
          growingPhilosophy: 'biointensive',
          avatar: profile?.avatar || 'seedling',
          bio: '',
        },
        subscription: {
          plan: sub?.plan || 'trial',
          trialStartDate: sub?.trial_start || supaUser.created_at,
          trialEndDate: sub?.trial_end || new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString(),
          paidAt: sub?.paid_at || null,
          promoCode: null,
          promoDiscount: 0,
        },
      };

      localStorage.setItem(AUTH_KEY, JSON.stringify(user));
      return { success: true, data: user };
    }

    // --- Local mode (fallback) ---
    const users = getUsers();
    const userEntry = users.find(u => u.email === normalizedEmail);

    if (!userEntry) {
      return { success: false, error: 'No account found with this email' };
    }

    const pwHash = await hashPassword(password);
    if (pwHash !== userEntry.passwordHash) {
      return { success: false, error: 'Incorrect password' };
    }

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

export async function signOut() {
  if (isSupabaseConfigured()) {
    await supabase.auth.signOut().catch(() => {});
  }
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

// --- Supabase migration for existing localStorage users ---

export async function migrateToSupabase({ email, password }) {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase is not configured' };
  }

  // Create Supabase auth account
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) return { success: false, error: authError.message };

  const supaUser = authData.user;
  if (!supaUser) return { success: false, error: 'Migration failed — could not create account' };

  // Load existing local user data
  const localUser = getCurrentUser();
  if (localUser?.profile) {
    await supabase.from('profiles').update({
      name: localUser.profile.name || '',
      farm_name: localUser.profile.farmName || '',
      avatar: localUser.profile.avatar || 'seedling',
    }).eq('id', supaUser.id);
  }

  // Upload local farm data to Supabase
  await uploadLocalData();

  // Update local session to reflect Supabase auth
  const user = {
    ...localUser,
    id: supaUser.id,
    email,
    authMode: 'supabase',
  };
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));

  return { success: true, data: user };
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

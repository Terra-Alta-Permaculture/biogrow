import { supabase, isSupabaseConfigured } from './supabase';

const STORAGE_KEY = 'biogrow-data';
const DIRTY_KEY = 'biogrow-dirty';
const LAST_SYNC_KEY = 'biogrow-last-sync';

let debounceTimer = null;
let syncInterval = null;
let listeners = [];

// --- Status ---

function getLocalTimestamp() {
  try {
    const raw = localStorage.getItem(LAST_SYNC_KEY);
    return raw ? new Date(raw) : null;
  } catch { return null; }
}

function setLocalTimestamp(date) {
  localStorage.setItem(LAST_SYNC_KEY, date.toISOString());
}

function isDirty() {
  return localStorage.getItem(DIRTY_KEY) === 'true';
}

function notifyListeners(status) {
  listeners.forEach(fn => fn(status));
}

// --- Public API ---

export function onSyncStatus(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}

export function markDirty() {
  if (!isSupabaseConfigured()) return;
  localStorage.setItem(DIRTY_KEY, 'true');

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    pushToSupabase().catch(() => {});
  }, 2000);
}

export async function pushToSupabase() {
  if (!isSupabaseConfigured()) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  notifyListeners({ syncing: true, error: null });

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const farmData = JSON.parse(raw);
    const now = new Date();

    const { error } = await supabase
      .from('farm_data')
      .upsert({
        user_id: user.id,
        data: farmData,
        updated_at: now.toISOString(),
      });

    if (error) throw error;

    localStorage.removeItem(DIRTY_KEY);
    setLocalTimestamp(now);
    notifyListeners({ syncing: false, lastSynced: now, error: null });
  } catch (err) {
    console.warn('Sync push failed:', err.message);
    notifyListeners({ syncing: false, error: err.message });
  }
}

export async function pullFromSupabase() {
  if (!isSupabaseConfigured()) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  try {
    const { data, error } = await supabase
      .from('farm_data')
      .select('data, updated_at')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No row yet
      throw error;
    }

    if (!data?.data) return null;

    const serverTime = new Date(data.updated_at);
    const localTime = getLocalTimestamp();

    // Only overwrite local if server is newer and local is not dirty
    if (!isDirty() && (!localTime || serverTime > localTime)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.data));
      setLocalTimestamp(serverTime);
      return data.data;
    }

    // Local is dirty — push takes priority
    if (isDirty()) {
      pushToSupabase().catch(() => {});
    }

    return null;
  } catch (err) {
    console.warn('Sync pull failed:', err.message);
    return null;
  }
}

export function startAutoSync() {
  if (!isSupabaseConfigured()) return;

  // Sync every 60 seconds
  syncInterval = setInterval(() => {
    if (isDirty()) {
      pushToSupabase().catch(() => {});
    }
  }, 60000);

  // Sync when tab becomes visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (isDirty()) {
        pushToSupabase().catch(() => {});
      } else {
        pullFromSupabase().catch(() => {});
      }
    }
  });

  // Sync when coming back online
  window.addEventListener('online', () => {
    if (isDirty()) {
      pushToSupabase().catch(() => {});
    }
  });
}

export function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

export async function syncOnce() {
  if (!isSupabaseConfigured()) return;
  if (isDirty()) {
    await pushToSupabase();
  } else {
    await pullFromSupabase();
  }
}

export async function uploadLocalData() {
  // Used during migration: push current localStorage to Supabase
  if (!isSupabaseConfigured()) return;
  localStorage.setItem(DIRTY_KEY, 'true');
  await pushToSupabase();
}

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { defaultCrops } from '../data/crops';
// import { defaultZones } from '../data/farm'; // Available for "Load Example Farm" feature
import { lightTheme, darkTheme } from '../utils/theme';
import { getCurrentUser, persistUser, signUp as authSignUp, signIn as authSignIn, signOut as authSignOut } from '../utils/auth';
import { saveBackup, loadBackup } from '../utils/indexedDB';
import { isSupabaseConfigured } from '../lib/supabase';
import { markDirty, pullFromSupabase, startAutoSync, stopAutoSync, syncOnce, onSyncStatus } from '../lib/syncEngine';

const AppContext = createContext();

const STORAGE_KEY = 'biogrow-data';

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load data from localStorage, will try IndexedDB backup', e);
    // Will attempt IndexedDB recovery after mount
    return { _corrupted: true };
  }
  return null;
}

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    // Also backup to IndexedDB (fire-and-forget)
    saveBackup(data).catch(() => {});
    // Mark dirty for Supabase sync
    markDirty();
    return true;
  } catch (e) {
    console.warn('Failed to save data', e);
    return false;
  }
}

const defaultState = {
  zones: [],
  crops: defaultCrops,
  tasks: [],
  harvests: [],
  pestLogs: [],
  rotationHistory: [],
  expenses: [],
  laborLogs: [],
  events: [],
  manualDemandEntries: [],
  csaSchemes: [],
  restaurantContracts: [],
  selectedCropIds: [],
  cropSettings: {},
  setupProgress: {
    farmSetupDone: false,
    cropSelectionDone: false,
    guideSeen: false,
  },
  demandPlan: {
    generatedAt: null,
    lossMargin: 0.30,
    summary: null,
    lastMode: 'merge',
  },
  settings: {
    currentYear: new Date().getFullYear(),
    lastFrostWeek: 12,
    firstFrostWeek: 44,
    soilType: 'loam',
    location: { lat: 38.72, lng: -9.14 },
    locationName: 'Lisbon, Portugal',
  },
};

export function AppProvider({ children }) {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem('biogrow-dark') === 'true';
    } catch { return false; }
  });
  const [saveStatus, setSaveStatus] = useState('saved');
  const saveTimer = useRef(null);

  const [state, setState] = useState(() => {
    const saved = loadFromStorage();
    if (!saved) return defaultState;
    if (saved._corrupted) return defaultState; // Will recover from IndexedDB in effect
    // Merge new default crop fields (category, yieldPerM2) into saved crops
    const mergedCrops = (saved.crops || defaultCrops).map(savedCrop => {
      const defaultCrop = defaultCrops.find(dc => dc.id === savedCrop.id);
      if (defaultCrop) {
        return {
          ...defaultCrop, ...savedCrop,
          // Always sync data fields from defaults (recalibrated from Heirloom/JMF data)
          yieldPerM2: defaultCrop.yieldPerM2,
          spacing: defaultCrop.spacing,
          rowSpacing: defaultCrop.rowSpacing,
          daysToMaturity: defaultCrop.daysToMaturity,
          harvestWindow: defaultCrop.harvestWindow || 0,
          daysInCell: defaultCrop.daysInCell || 0,
          successionInterval: defaultCrop.successionInterval,
          category: savedCrop.category || defaultCrop.category,
          sunRequirement: savedCrop.sunRequirement || defaultCrop.sunRequirement,
        };
      }
      return savedCrop;
    });
    // Add any new default crops not present in saved data
    const savedIds = new Set(mergedCrops.map(c => c.id));
    const newCrops = defaultCrops.filter(dc => !savedIds.has(dc.id));
    const allCrops = [...mergedCrops, ...newCrops];
    // Auto-detect setup progress for existing users
    const setupProgress = saved.setupProgress || {
      farmSetupDone: saved.zones?.length > 0 && saved.zones.some(z => z.beds?.length > 0),
      cropSelectionDone: Array.isArray(saved.selectedCropIds) && saved.selectedCropIds.length > 0,
    };
    const selectedCropIds = saved.selectedCropIds || [];
    // Migrate plantings: add year field if missing
    const thisYear = new Date().getFullYear();
    const migratedZones = (saved.zones || []).map(z => ({
      ...z,
      beds: (z.beds || []).map(b => ({
        ...b,
        plantings: (b.plantings || []).map(p => ({
          ...p,
          year: p.year || thisYear,
          source: p.source || 'manual',
          bedFraction: p.bedFraction || 1,
          batchId: p.batchId || null,
        })),
      })),
    }));
    // Ensure settings has currentYear
    const mergedSettings = { ...defaultState.settings, ...(saved.settings || {}), currentYear: saved.settings?.currentYear || thisYear };
    return { ...defaultState, ...saved, zones: migratedZones, crops: allCrops, settings: mergedSettings, setupProgress, selectedCropIds, manualDemandEntries: saved.manualDemandEntries || [], csaSchemes: saved.csaSchemes || [], restaurantContracts: saved.restaurantContracts || [], cropSettings: saved.cropSettings || {}, expenses: saved.expenses || [], laborLogs: saved.laborLogs || [] };
  });

  // --- User/Auth state (separate from farm data) ---
  const [user, setUser] = useState(() => getCurrentUser());

  useEffect(() => {
    persistUser(user);
  }, [user]);

  const login = useCallback(async (email, password) => {
    const result = await authSignIn({ email, password });
    if (result.success) setUser(result.data);
    return result;
  }, []);

  const logout = useCallback(async () => {
    stopAutoSync();
    await authSignOut();
    setUser(null);
  }, []);

  const register = useCallback(async (signUpData) => {
    const result = await authSignUp(signUpData);
    if (result.success) setUser(result.data);
    return result;
  }, []);

  const updateUserProfile = useCallback((profileUpdates) => {
    setUser(prev => prev ? { ...prev, profile: { ...prev.profile, ...profileUpdates } } : null);
  }, []);

  const updateSubscription = useCallback((subUpdates) => {
    setUser(prev => prev ? { ...prev, subscription: { ...prev.subscription, ...subUpdates } } : null);
  }, []);

  // --- Supabase sync ---
  const [syncStatus, setSyncStatus] = useState({ syncing: false, lastSynced: null, error: null });

  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return;

    // Listen for sync status updates
    const unsub = onSyncStatus(setSyncStatus);

    // Pull latest data from Supabase on mount
    pullFromSupabase().then(serverData => {
      if (serverData) {
        setState(prev => ({ ...prev, ...serverData }));
      }
      startAutoSync();
    });

    return () => {
      unsub();
      stopAutoSync();
    };
  }, [user]);

  const syncNow = useCallback(async () => {
    await syncOnce();
  }, []);

  // --- Recover from IndexedDB if localStorage was corrupted ---
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    let corrupted = false;
    if (raw) {
      try { JSON.parse(raw); } catch { corrupted = true; }
    }
    if (corrupted) {
      loadBackup().then(backup => {
        if (backup?.data) {
          console.warn('Recovered data from IndexedDB backup');
          setState(prev => ({ ...defaultState, ...backup.data }));
        }
      });
    }
  }, []);

  const theme = darkMode ? darkTheme : lightTheme;

  // --- Toast notifications ---
  const [toasts, setToasts] = useState([]);
  const toastTimers = useRef({});

  const dismissToast = useCallback((id) => {
    if (toastTimers.current[id]) { clearTimeout(toastTimers.current[id]); delete toastTimers.current[id]; }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message, options = {}) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const toast = { id, message, type: options.type || 'info', undo: options.undo || null };
    setToasts(prev => [...prev, toast]);
    toastTimers.current[id] = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      delete toastTimers.current[id];
    }, options.duration || 5000);
    return id;
  }, []);

  const triggerSave = useCallback(() => {
    setSaveStatus('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveToStorage(state);
      setSaveStatus('saved');
    }, 500);
  }, [state]);

  useEffect(() => {
    triggerSave();
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [state, triggerSave]);

  useEffect(() => {
    try { localStorage.setItem('biogrow-dark', darkMode); } catch {}
  }, [darkMode]);

  const updateState = useCallback((updater) => {
    setState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      return next;
    });
  }, []);

  const manualSave = useCallback(() => {
    setSaveStatus('saving');
    saveToStorage(state);
    setTimeout(() => setSaveStatus('saved'), 300);
  }, [state]);

  const exportData = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `biogrow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  const validateImport = useCallback((json) => {
    try {
      const data = JSON.parse(json);
      const errors = [];
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        return { valid: false, errors: ['File does not contain valid BioGrow data'], preview: null, data: null };
      }
      // Check for expected top-level keys
      const expected = ['zones', 'crops', 'tasks', 'harvests', 'settings'];
      const found = expected.filter(k => k in data);
      if (found.length === 0) {
        errors.push('No recognizable BioGrow data found (missing zones, crops, tasks, etc.)');
      }
      // Validate arrays
      if (data.zones && !Array.isArray(data.zones)) errors.push('"zones" is not an array');
      if (data.crops && !Array.isArray(data.crops)) errors.push('"crops" is not an array');
      if (data.tasks && !Array.isArray(data.tasks)) errors.push('"tasks" is not an array');
      if (data.harvests && !Array.isArray(data.harvests)) errors.push('"harvests" is not an array');
      const preview = {
        zones: Array.isArray(data.zones) ? data.zones.length : 0,
        beds: Array.isArray(data.zones) ? data.zones.reduce((s, z) => s + (z.beds?.length || 0), 0) : 0,
        crops: Array.isArray(data.crops) ? data.crops.length : 0,
        tasks: Array.isArray(data.tasks) ? data.tasks.length : 0,
        harvests: Array.isArray(data.harvests) ? data.harvests.length : 0,
        events: Array.isArray(data.events) ? data.events.length : 0,
      };
      return { valid: errors.length === 0, errors, preview, data };
    } catch (e) {
      return { valid: false, errors: ['Invalid JSON file: ' + e.message], preview: null, data: null };
    }
  }, []);

  const importData = useCallback((data) => {
    try {
      // Backup current state before import
      saveBackup(state).catch(() => {});
      setState(prev => ({ ...prev, ...data }));
      return true;
    } catch {
      return false;
    }
  }, [state]);

  return (
    <AppContext.Provider value={{
      ...state,
      state,
      updateState,
      darkMode,
      setDarkMode,
      theme,
      saveStatus,
      manualSave,
      exportData,
      importData,
      validateImport,
      // Auth/User
      user,
      setUser,
      login,
      logout,
      register,
      updateUserProfile,
      updateSubscription,
      // Sync
      syncStatus,
      syncNow,
      // Toast
      toasts,
      showToast,
      dismissToast,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

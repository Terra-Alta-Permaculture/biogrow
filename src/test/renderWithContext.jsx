import { render } from '@testing-library/react';
import { AppProvider } from '../context/AppContext';

/**
 * Render a component wrapped in AppProvider.
 * Optionally seed localStorage with initial state before rendering.
 */
export function renderWithContext(ui, { initialState, initialUser } = {}) {
  if (initialState) {
    localStorage.setItem('biogrow-data', JSON.stringify(initialState));
  }
  if (initialUser) {
    localStorage.setItem('biogrow-auth', JSON.stringify(initialUser));
  }
  return render(<AppProvider>{ui}</AppProvider>);
}

/** Factory for a minimal valid user object. */
export function makeUser(overrides = {}) {
  const now = new Date().toISOString();
  const trialEnd = new Date(Date.now() + 30 * 86400000).toISOString();
  return {
    id: 'test-user-1',
    email: 'test@example.com',
    passwordHash: 'abc123',
    createdAt: now,
    profile: {
      name: 'Test Farmer',
      farmName: 'Test Farm',
      location: '',
      farmSize: '',
      growingPhilosophy: 'biointensive',
      avatar: 'seedling',
      bio: '',
      ...overrides.profile,
    },
    subscription: {
      plan: 'trial',
      trialStartDate: now,
      trialEndDate: trialEnd,
      paidAt: null,
      promoCode: null,
      promoDiscount: 0,
      ...overrides.subscription,
    },
    ...overrides,
  };
}

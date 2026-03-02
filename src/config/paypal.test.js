import { describe, it, expect, vi } from 'vitest';

vi.stubEnv('VITE_PAYPAL_CLIENT_ID', '');

describe('PAYPAL_CONFIG', () => {
  it('exports config with clientId', async () => {
    const { PAYPAL_CONFIG } = await import('./paypal.js');
    expect(PAYPAL_CONFIG).toBeDefined();
    expect(PAYPAL_CONFIG.clientId).toBeDefined();
    expect(PAYPAL_CONFIG.currency).toBe('EUR');
    expect(PAYPAL_CONFIG.intent).toBe('capture');
  });

  it('exports fallback PayPal.me URL', async () => {
    const { PAYPAL_ME_URL } = await import('./paypal.js');
    expect(PAYPAL_ME_URL).toContain('paypal.me');
  });
});

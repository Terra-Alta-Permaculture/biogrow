import { describe, it, expect, vi } from 'vitest';

// Mock import.meta.env
vi.stubEnv('VITE_STRIPE_PAYMENT_LINK', '');

describe('STRIPE_CONFIG', () => {
  it('exports config with payment link URL', async () => {
    const { STRIPE_CONFIG } = await import('./stripe.js');
    expect(STRIPE_CONFIG).toBeDefined();
    expect(STRIPE_CONFIG.paymentLinkUrl).toBeDefined();
    expect(STRIPE_CONFIG.successUrl).toContain('payment_success=true');
    expect(STRIPE_CONFIG.cancelUrl).toContain('payment_cancelled=true');
  });

  it('successUrl uses current origin', async () => {
    const { STRIPE_CONFIG } = await import('./stripe.js');
    expect(STRIPE_CONFIG.successUrl).toMatch(/^https?:\/\//);
  });
});

// PayPal Smart Buttons configuration for BioGrow
//
// SETUP:
// 1. Get your Client ID from https://developer.paypal.com/dashboard/applications
// 2. Add it to .env.local as VITE_PAYPAL_CLIENT_ID
// 3. Set PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_MODE in Supabase function secrets
// 4. For testing, use sandbox mode (PAYPAL_MODE=sandbox)

export const PAYPAL_CONFIG = {
  clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || '',
  currency: 'EUR',
  intent: 'capture',
};

// Fallback for local-only mode (no Supabase)
export const PAYPAL_ME_URL = 'https://paypal.me/TerraAltaPermaculture';

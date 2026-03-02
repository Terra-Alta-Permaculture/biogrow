// Stripe Payment Link configuration for BioGrow
//
// SETUP:
// 1. Create a Payment Link in Stripe Dashboard (https://dashboard.stripe.com/payment-links)
// 2. Set the price to €99.99 one-time
// 3. Enable promotion codes on the Payment Link
// 4. Add the Payment Link URL to your .env.local as VITE_STRIPE_PAYMENT_LINK
// 5. Promo codes in promoCodes.js should match codes created in Stripe Dashboard

export const STRIPE_CONFIG = {
  paymentLinkUrl: import.meta.env.VITE_STRIPE_PAYMENT_LINK || 'https://buy.stripe.com/5kQbJ25p0gxMgKS3N30sU00',
  successUrl: window.location.origin + '?payment_success=true',
  cancelUrl: window.location.origin + '?payment_cancelled=true',
};

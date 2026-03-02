// Payment configuration for BioGrow
//
// STRIPE SETUP:
// 1. Create a Payment Link in Stripe Dashboard (https://dashboard.stripe.com/payment-links)
// 2. Set the price to your desired amount (e.g., €99.99 one-time)
// 3. Enable promotion codes on the Payment Link if you want promo code support
// 4. Replace the placeholder URL below with your real Payment Link URL
// 5. Promo codes in promoCodes.js should match codes created in Stripe Dashboard
//
// PAYPAL SETUP:
// 1. Create a PayPal.me link or Payment Button at https://www.paypal.com/buttons
// 2. Replace the placeholder URL below with your real PayPal link
// 3. For PayPal.me: use format https://paypal.me/YourName/99.99EUR

export const STRIPE_CONFIG = {
  paymentLinkUrl: 'https://buy.stripe.com/PLACEHOLDER',
  successUrl: window.location.origin + '?payment_success=true',
  cancelUrl: window.location.origin + '?payment_cancelled=true',
};

export const PAYPAL_CONFIG = {
  paymentUrl: 'https://paypal.me/PLACEHOLDER',
};

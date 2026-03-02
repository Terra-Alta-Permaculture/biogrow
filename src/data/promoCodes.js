// Promo codes for local validation/display.
// For real billing, create matching promotion codes in Stripe Dashboard
// so the actual discount is enforced by Stripe at checkout.
export const PROMO_CODES = {
  'BIOGROW100':  { discount: 1.00, label: '100% Free Access' },
  'BIOGROW50':   { discount: 0.50, label: '50% Discount' },
  'BIOGROW25':   { discount: 0.25, label: '25% Discount' },
  'TEACHER2026': { discount: 0.50, label: '50% Teacher Discount' },
  'EARLYFARM':   { discount: 0.50, label: '50% Early Adopter' },
  'STUDENT50':   { discount: 0.50, label: '50% Student Special' },
};

export const BASE_PRICE = 99.99;
export const TRIAL_DAYS = 30;

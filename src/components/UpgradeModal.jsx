import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Modal, Button } from './shared';
import { validatePromoCode } from '../utils/auth';
import { BASE_PRICE } from '../data/promoCodes';
import { STRIPE_CONFIG } from '../config/stripe';
import { PAYPAL_CONFIG, PAYPAL_ME_URL } from '../config/paypal';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Lazy-loaded PayPal components (loaded on first modal open)
let PayPalScriptProvider = null;
let PayPalButtons = null;
let paypalLoadAttempted = false;

function usePayPalSDK(shouldLoad) {
  const [loaded, setLoaded] = useState(!!PayPalButtons);

  useEffect(() => {
    if (!shouldLoad || paypalLoadAttempted || PayPalButtons) return;
    paypalLoadAttempted = true;

    import('@paypal/react-paypal-js').then(mod => {
      PayPalScriptProvider = mod.PayPalScriptProvider;
      PayPalButtons = mod.PayPalButtons;
      setLoaded(true);
    }).catch(() => {
      // SDK unavailable — will use fallback
    });
  }, [shouldLoad]);

  return loaded;
}

export default function UpgradeModal({ open, onClose }) {
  const { user, updateSubscription, theme, showToast } = useApp();
  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState('');
  const [promoSuccess, setPromoSuccess] = useState('');
  const [paid, setPaid] = useState(false);
  const [paypalError, setPaypalError] = useState('');

  // Only attempt to load PayPal SDK when modal is open, Supabase is configured, and client ID exists
  const shouldLoadPayPal = open && isSupabaseConfigured() && !!PAYPAL_CONFIG.clientId;
  const paypalReady = usePayPalSDK(shouldLoadPayPal);

  if (!user) return null;
  const sub = user.subscription;
  const discount = sub.promoDiscount || 0;
  const finalPrice = (BASE_PRICE * (1 - discount)).toFixed(2);

  const applyPromo = () => {
    setPromoError('');
    setPromoSuccess('');
    const code = validatePromoCode(promoInput);
    if (!code) {
      setPromoError('Invalid promo code');
      return;
    }
    updateSubscription({ promoCode: promoInput.trim().toUpperCase(), promoDiscount: code.discount });
    setPromoSuccess(`${code.label} applied! Price: €${(BASE_PRICE * (1 - code.discount)).toFixed(2)}`);
    setPromoInput('');
  };

  const handleStripePay = () => {
    const url = new URL(STRIPE_CONFIG.paymentLinkUrl);
    url.searchParams.set('client_reference_id', user.id);
    if (sub.promoCode) {
      url.searchParams.set('prefilled_promo_code', sub.promoCode);
    }
    window.location.href = url.toString();
  };

  // Fallback PayPal.me redirect (for local-only mode or when SDK unavailable)
  const handlePayPalFallback = () => {
    const url = `${PAYPAL_ME_URL}/${finalPrice}EUR`;
    window.open(url, '_blank');
  };

  const useSmartButtons = paypalReady && PayPalButtons && PayPalScriptProvider;

  const handleClose = () => {
    setPaid(false);
    setPromoInput('');
    setPromoError('');
    setPromoSuccess('');
    setPaypalError('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={paid ? '🎉 Welcome to BioGrow!' : 'Upgrade to BioGrow'} width="440px">
      {paid ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🌱</div>
          <h3 style={{ fontFamily: "'DM Serif Display', serif", color: theme.text, marginBottom: '8px', fontSize: '22px' }}>
            You're all set!
          </h3>
          <p style={{ color: theme.textSecondary, fontSize: '14px', marginBottom: '24px' }}>
            Thank you for supporting BioGrow. You now have full access to all features.
          </p>
          <Button onClick={handleClose}>Start Growing</Button>
        </div>
      ) : (
        <div>
          {/* Plan card */}
          <div style={{
            padding: '20px',
            borderRadius: '12px',
            border: `2px solid ${theme.accent}`,
            background: `${theme.accent}08`,
            marginBottom: '20px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: theme.accent, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
              Full Access Plan
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px' }}>
              {discount > 0 && (
                <span style={{ fontSize: '18px', color: theme.textMuted, textDecoration: 'line-through' }}>
                  €{BASE_PRICE}
                </span>
              )}
              <span style={{ fontSize: '36px', fontWeight: '700', color: theme.text, fontFamily: "'DM Serif Display', serif" }}>
                €{finalPrice}
              </span>
              <span style={{ fontSize: '13px', color: theme.textSecondary }}>/lifetime</span>
            </div>
            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '13px', color: theme.textSecondary, textAlign: 'left', padding: '0 12px' }}>
              {[
                'Demand-to-bed engine — events & orders auto-plan your beds',
                '265+ crop database with calibrated yield data',
                'Visual farm map with drag-and-drop bed layout',
                'Profit & expense tracking with exportable PDF reports',
                'Weather-smart frost dates & irrigation scheduling',
                'Succession planting, rotation & companion guides',
                '100% offline — your data never leaves your device',
              ].map(f => (
                <div key={f}>✅ {f}</div>
              ))}
            </div>
          </div>

          {/* Promo code */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: theme.textSecondary, marginBottom: '6px' }}>
              Have a promo code?
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={promoInput}
                onChange={e => setPromoInput(e.target.value)}
                placeholder="Enter code"
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: `1.5px solid ${theme.border}`,
                  background: theme.bgInput,
                  color: theme.text,
                  fontSize: '14px',
                  fontFamily: "'Libre Franklin', sans-serif",
                  outline: 'none',
                  textTransform: 'uppercase',
                }}
                onKeyDown={e => e.key === 'Enter' && applyPromo()}
              />
              <Button variant="secondary" onClick={applyPromo}>Apply</Button>
            </div>
            {promoError && <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '6px' }}>{promoError}</div>}
            {promoSuccess && <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '6px' }}>{promoSuccess}</div>}
            {sub.promoCode && !promoSuccess && (
              <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '6px' }}>
                ✅ Code <strong>{sub.promoCode}</strong> applied — {(sub.promoDiscount * 100).toFixed(0)}% off
              </div>
            )}
          </div>

          {/* Payment buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Stripe Payment Link */}
            <button
              onClick={handleStripePay}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #5d4e37, #3e6b48)',
                color: '#fff',
                fontSize: '15px',
                fontWeight: '700',
                cursor: 'pointer',
                fontFamily: "'Libre Franklin', sans-serif",
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              Pay €{finalPrice} — Card / Stripe
            </button>

            {/* PayPal Smart Buttons or fallback */}
            {useSmartButtons ? (
              <div style={{ minHeight: '48px' }}>
                <PayPalScriptProvider options={{
                  'client-id': PAYPAL_CONFIG.clientId,
                  currency: PAYPAL_CONFIG.currency,
                  intent: PAYPAL_CONFIG.intent,
                }}>
                  <PayPalButtons
                    style={{
                      layout: 'horizontal',
                      color: 'gold',
                      shape: 'rect',
                      label: 'pay',
                      height: 48,
                      tagline: false,
                    }}
                    createOrder={async () => {
                      setPaypalError('');
                      const { data, error } = await supabase.functions.invoke('paypal-create-order', {
                        body: { promoCode: sub.promoCode || '' },
                      });
                      if (error) {
                        setPaypalError('Failed to create PayPal order. Please try again.');
                        throw error;
                      }
                      return data.orderId;
                    }}
                    onApprove={async (data) => {
                      setPaypalError('');
                      const { data: captureData, error } = await supabase.functions.invoke('paypal-capture-order', {
                        body: { orderId: data.orderID },
                      });
                      if (error || !captureData?.success) {
                        setPaypalError('Payment capture failed. Please contact support.');
                        return;
                      }
                      updateSubscription({ plan: 'paid', paidAt: new Date().toISOString() });
                      setPaid(true);
                      if (showToast) {
                        showToast('Payment confirmed! Welcome to BioGrow Premium.', { type: 'success', duration: 8000 });
                      }
                    }}
                    onError={(err) => {
                      console.error('PayPal error:', err);
                      setPaypalError('PayPal encountered an error. Please try again or use card payment.');
                    }}
                    onCancel={() => {
                      setPaypalError('');
                    }}
                  />
                </PayPalScriptProvider>
                {paypalError && (
                  <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '6px', textAlign: 'center' }}>
                    {paypalError}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handlePayPalFallback}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '10px',
                  border: `1.5px solid ${theme.border}`,
                  background: '#ffc439',
                  color: '#003087',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontFamily: "'Libre Franklin', sans-serif",
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                Pay with PayPal
              </button>
            )}
          </div>
          <div style={{ textAlign: 'center', fontSize: '11px', color: theme.textMuted, marginTop: '10px' }}>
            🔒 Secure payment — choose your preferred method
          </div>
        </div>
      )}
    </Modal>
  );
}

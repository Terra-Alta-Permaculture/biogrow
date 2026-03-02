-- Add PayPal order tracking to subscriptions table
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;

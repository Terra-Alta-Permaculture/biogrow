-- BioGrow initial schema
-- Uses JSONB blob approach: one farm_data row per user

-- Profiles (extends auth.users with app-specific fields)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  farm_name TEXT,
  avatar TEXT DEFAULT 'seedling',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Farm data blob (one row per user, entire state object)
CREATE TABLE public.farm_data (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  version INTEGER DEFAULT 1
);

-- Subscription tracking
CREATE TABLE public.subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT DEFAULT 'trial',
  trial_start TIMESTAMPTZ DEFAULT now(),
  trial_end TIMESTAMPTZ DEFAULT now() + INTERVAL '30 days',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  paid_at TIMESTAMPTZ
);

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Farm data policies
CREATE POLICY "Users read own farm data"
  ON public.farm_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own farm data"
  ON public.farm_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own farm data"
  ON public.farm_data FOR UPDATE
  USING (auth.uid() = user_id);

-- Subscription policies
CREATE POLICY "Users read own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own subscription"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own subscription"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- Auto-create profile + subscription on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);

  INSERT INTO public.subscriptions (user_id)
  VALUES (NEW.id);

  INSERT INTO public.farm_data (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

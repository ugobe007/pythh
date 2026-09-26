-- Shareable Scout access codes.
-- A founder redeems one code. Scout features stay on until the match
-- count or the time window on that grant runs out.

CREATE TABLE IF NOT EXISTS public.pythh_scout_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  label TEXT,
  match_limit INTEGER,
  duration_days INTEGER,
  max_redemptions INTEGER,
  redemption_count INTEGER NOT NULL DEFAULT 0,
  redeem_by TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INTEGER REFERENCES public.pythh_users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pythh_scout_coupons_match_limit_check
    CHECK (match_limit IS NULL OR match_limit > 0),
  CONSTRAINT pythh_scout_coupons_duration_check
    CHECK (duration_days IS NULL OR duration_days > 0),
  CONSTRAINT pythh_scout_coupons_has_limit_check
    CHECK (match_limit IS NOT NULL OR duration_days IS NOT NULL),
  CONSTRAINT pythh_scout_coupons_max_redemptions_check
    CHECK (max_redemptions IS NULL OR max_redemptions > 0)
);

CREATE TABLE IF NOT EXISTS public.pythh_scout_coupon_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.pythh_scout_coupons (id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES public.pythh_users (id) ON DELETE CASCADE,
  match_limit INTEGER,
  matches_used INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (coupon_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pythh_scout_coupon_grants_user
  ON public.pythh_scout_coupon_grants (user_id, redeemed_at DESC);

CREATE TABLE IF NOT EXISTS public.pythh_scout_coupon_match_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES public.pythh_scout_coupon_grants (id) ON DELETE CASCADE,
  startup_id UUID NOT NULL,
  investor_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (grant_id, startup_id, investor_id)
);

ALTER TABLE public.pythh_scout_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pythh_scout_coupon_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pythh_scout_coupon_match_uses ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.pythh_scout_coupons IS
  'Admin-issued Scout codes. match_limit and duration_days are optional, but one of them is required.';
COMMENT ON TABLE public.pythh_scout_coupon_grants IS
  'One founder redemption. Access ends when matches_used hits match_limit or expires_at passes.';

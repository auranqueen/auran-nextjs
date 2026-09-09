-- 194: coupons auto_apply - checkout can present without user_coupons issue
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS auto_apply boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.coupons.auto_apply IS
  'When true, checkout may virtual-present this coupon without prior user_coupons issuance';

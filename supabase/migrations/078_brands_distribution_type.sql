-- 078_brands_distribution_type.sql
ALTER TABLE public.brands
  ADD COLUMN distribution_type TEXT NOT NULL DEFAULT 'none'
  CHECK (distribution_type IN ('none', 'cross_sell', 'tier_contract'));

COMMENT ON COLUMN public.brands.distribution_type IS
  'none=미입점/일반, cross_sell=오렌입점O 지사계약X(교차판매풀), tier_contract=오렌 지사계약(뱃지시스템 적용)';

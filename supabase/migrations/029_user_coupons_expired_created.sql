-- 수동 발급 시 만료 시각 · 생성 시각 (기존 스키마 호환)
ALTER TABLE public.user_coupons
  ADD COLUMN IF NOT EXISTS expired_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

COMMENT ON COLUMN public.user_coupons.expired_at IS '발급된 쿠폰의 개별 만료 시각';
COMMENT ON COLUMN public.user_coupons.created_at IS 'user_coupons 행 생성 시각';

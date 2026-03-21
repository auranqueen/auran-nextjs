-- 상시쿠폰 vs 특별이벤트 (할인 타입 enum `coupon_type` 과 별개 — 컬럼명은 요구사항대로 text)
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS coupon_type text NOT NULL DEFAULT 'regular';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coupons_coupon_kind_chk'
  ) THEN
    ALTER TABLE public.coupons
      ADD CONSTRAINT coupons_coupon_kind_chk
      CHECK (coupon_type IN ('regular', 'special_event'));
  END IF;
END $$;

COMMENT ON COLUMN public.coupons.coupon_type IS 'regular=상시, special_event=특별이벤트';

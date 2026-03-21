-- 쿠폰 적용 범위 · 생일 · 정률 메타 · 특정인 발급
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS scope text DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS scope_brand_ids uuid[],
  ADD COLUMN IF NOT EXISTS scope_product_ids uuid[],
  ADD COLUMN IF NOT EXISTS scope_user_ids uuid[],
  ADD COLUMN IF NOT EXISTS birthday_days_before int4 DEFAULT 7,
  ADD COLUMN IF NOT EXISTS birthday_days_after int4 DEFAULT 7,
  ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'amount',
  ADD COLUMN IF NOT EXISTS discount_value int4 DEFAULT 0;

COMMENT ON COLUMN public.coupons.scope IS 'all | brand | product';
COMMENT ON COLUMN public.coupons.scope_user_ids IS '특정인 발급 대상 auth.users(id) UUID 배열';

UPDATE public.coupons
SET
  discount_type = CASE WHEN type::text = 'rate' THEN 'rate' ELSE 'amount' END,
  discount_value = COALESCE(
    CASE WHEN type::text = 'rate' THEN ROUND(COALESCE(discount_rate, 0))::int ELSE COALESCE(discount_amount, 0) END,
    0
  )
WHERE discount_value IS NULL OR discount_value = 0;

INSERT INTO public.admin_settings (category, key, value, label, unit, value_type)
VALUES
  ('coupon', 'birthday_days_before', '7', '생일쿠폰 발급 시작', '일전', 'number'),
  ('coupon', 'birthday_days_after', '7', '생일쿠폰 유효기간', '일후', 'number'),
  ('coupon', 'max_percent_discount', '70', '최대 정률 할인', '%', 'number'),
  ('coupon', 'scope_enabled', '1', '쿠폰 적용범위 설정', '', 'number'),
  ('coupon', 'specific_user_enabled', '1', '특정인 발급 기능', '', 'number'),
  ('coupon', 'manual_issue_enabled', '1', '수동 발급 기능', '', 'number')
ON CONFLICT (category, key)
DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  unit = EXCLUDED.unit,
  value_type = EXCLUDED.value_type,
  updated_at = NOW();

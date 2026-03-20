ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_flash_sale BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS flash_sale_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS flash_sale_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS flash_sale_price INTEGER;

INSERT INTO public.admin_settings (category, key, value, label, unit, value_type)
VALUES
  ('flash_sale', 'default_duration_hours', '24', '기본 타임세일 시간', '시간', 'number'),
  ('flash_sale', 'max_discount_rate', '70', '최대 할인율', '%', 'number'),
  ('flash_sale', 'auto_end_notification', '1', '종료 1시간 전 알림', '', 'number'),
  ('product_hook', 'review_threshold', '10', '리뷰 기반 멘트 전환 기준', '개', 'number'),
  ('product_hook', 'buyer_badge_min', '10', '구매자 배지 최소 기준', '명', 'number'),
  ('product_hook', 'ai_hook_enabled', '1', 'AI 후킹 멘트 활성화', '', 'number')
ON CONFLICT (category, key)
DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  unit = EXCLUDED.unit,
  value_type = EXCLUDED.value_type,
  updated_at = NOW();

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_flash_sale BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS flash_sale_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS flash_sale_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS flash_sale_price INT4;

INSERT INTO public.admin_settings (category, key, value, label, unit, value_type)
VALUES
  ('flash_sale', 'default_duration_hours', '24', '기본 타임세일 시간', '시간', 'number'),
  ('flash_sale', 'max_discount_rate', '70', '최대 할인율', '%', 'number'),
  ('flash_sale', 'end_alert_hours', '1', '종료 전 알림 시간', '시간', 'number'),
  ('flash_sale', 'max_active_count', '8', '동시 진행 최대 수', '개', 'number'),
  ('flash_sale', 'badge_urgent_minutes', '60', '긴급배지 전환 시간', '분', 'number')
ON CONFLICT (category, key)
DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  unit = EXCLUDED.unit,
  value_type = EXCLUDED.value_type,
  updated_at = NOW();

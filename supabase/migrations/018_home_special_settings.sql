INSERT INTO public.admin_settings (category, key, value, label, unit, value_type)
VALUES
  ('home_special', 'title', '오늘의 특가', '섹션 제목', '', 'text'),
  ('home_special', 'enabled', '1', '특가 섹션 활성화', '', 'number'),
  ('home_special', 'max_items', '8', '표시 상품 수', '개', 'number'),
  ('home_special', 'rolling_interval_sec', '6', '롤링 간격', '초', 'number'),
  ('home_special', 'show_timer', '1', '카운트다운 표시', '', 'number')
ON CONFLICT (category, key) DO UPDATE
SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  unit = EXCLUDED.unit,
  value_type = EXCLUDED.value_type,
  updated_at = now();

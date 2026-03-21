INSERT INTO public.admin_settings (category, key, value, label, unit, value_type)
VALUES
  ('notification', 'max_display_count', '50', '최대 표시 알림 수', '개', 'number'),
  ('notification', 'auto_read_days', '30', '자동 읽음 처리', '일', 'number'),
  ('notification', 'datetime_format', 'YYYY. MM. DD. HH:mm:ss', '날짜 표시 형식', '', 'text')
ON CONFLICT (category, key)
DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  unit = EXCLUDED.unit,
  value_type = EXCLUDED.value_type,
  updated_at = NOW();

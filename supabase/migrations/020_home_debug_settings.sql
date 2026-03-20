INSERT INTO public.admin_settings (category, key, value, label, unit, value_type)
VALUES
  ('home_debug', 'show_query_debug', '1', '쿼리 디버그 노출', '', 'number'),
  ('home_debug', 'show_action_debug', '1', '액션 디버그 노출', '', 'number')
ON CONFLICT (category, key) DO UPDATE
SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  unit = EXCLUDED.unit,
  value_type = EXCLUDED.value_type,
  updated_at = now();

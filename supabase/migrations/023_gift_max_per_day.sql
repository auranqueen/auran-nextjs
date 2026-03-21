INSERT INTO public.admin_settings (category, key, value, label, unit, value_type)
VALUES
  ('gift', 'max_gift_per_day', '10', '하루 최대 선물 수', '건', 'number')
ON CONFLICT (category, key)
DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  unit = EXCLUDED.unit,
  value_type = EXCLUDED.value_type,
  updated_at = NOW();

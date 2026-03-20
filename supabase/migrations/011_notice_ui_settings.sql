INSERT INTO public.admin_settings (category, key, value, label, unit, value_type)
VALUES
  ('notice_ui', 'chalk_effect_enabled', '1', '칠판 효과 활성화', '', 'number'),
  ('notice_ui', 'typing_animation_speed', '30', '타이핑 애니메이션 속도', 'ms/글자', 'number'),
  ('notice_ui', 'highlight_color', '#F5E642', '강조 분필 색상', '', 'text')
ON CONFLICT (category, key)
DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  unit = EXCLUDED.unit,
  value_type = EXCLUDED.value_type;

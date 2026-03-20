UPDATE public.admin_settings
SET value = '8888', label = '회원가입 환영 포인트', unit = 'P', value_type = 'number', updated_at = NOW()
WHERE category = 'points_action' AND key = 'signup_welcome';

INSERT INTO public.admin_settings (category, key, value, label, unit, value_type)
VALUES
  ('toast', 'exchange_rate', '100', '1T당 원화', '원', 'number'),
  ('toast', 'min_charge', '100', '최소 충전 토스트', 'T', 'number'),
  ('toast', 'bonus_threshold_1', '1000', '보너스 기준 1', 'T', 'number'),
  ('toast', 'bonus_amount_1', '50', '보너스 지급 1', 'T', 'number'),
  ('toast', 'bonus_threshold_2', '3000', '보너스 기준 2', 'T', 'number'),
  ('toast', 'bonus_amount_2', '200', '보너스 지급 2', 'T', 'number'),
  ('toast', 'point_max_usage_rate', '20', '포인트 최대 사용 비율', '%', 'number')
ON CONFLICT (category, key)
DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  unit = EXCLUDED.unit,
  value_type = EXCLUDED.value_type,
  updated_at = NOW();

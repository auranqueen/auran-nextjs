INSERT INTO public.admin_settings (category, key, value, label, unit, value_type)
VALUES ('alimtalk', 'wallet_charge_alimtalk', '0', '토스트 충전 완료 알림톡(뿌리오, 결제 완료 시만)', '', 'number')
ON CONFLICT (category, key)
DO UPDATE SET
  label = EXCLUDED.label,
  unit = EXCLUDED.unit,
  value_type = EXCLUDED.value_type,
  updated_at = NOW();

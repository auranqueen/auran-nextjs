ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS gift_receiver_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gift_message TEXT,
  ADD COLUMN IF NOT EXISTS payment_applied BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gift_created BOOLEAN NOT NULL DEFAULT false;

INSERT INTO public.admin_settings (category, key, value, label, unit, value_type)
VALUES
  ('checkout', 'toast_first_priority', '1', '토스트 우선 차감', '', 'number'),
  ('checkout', 'point_max_ratio', '20', '포인트 최대 사용 비율', '%', 'number'),
  ('checkout', 'show_charge_option', '1', '충전 옵션 표시', '', 'number'),
  ('checkout', 'min_order_amount', '0', '최소 주문 금액', '원', 'number')
ON CONFLICT (category, key)
DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  unit = EXCLUDED.unit,
  value_type = EXCLUDED.value_type,
  updated_at = NOW();

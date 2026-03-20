CREATE TABLE IF NOT EXISTS public.gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  receiver_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  message TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.admin_settings (category, key, value, label, unit, value_type)
VALUES
  ('gift', 'gift_enabled', '1', '선물 기능 활성화', '', 'number'),
  ('gift', 'gift_message_max_length', '100', '선물 메시지 최대 길이', '자', 'number'),
  ('gift', 'gift_notification_enabled', '1', '선물 알림 활성화', '', 'number')
ON CONFLICT (category, key)
DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  unit = EXCLUDED.unit,
  value_type = EXCLUDED.value_type,
  updated_at = NOW();

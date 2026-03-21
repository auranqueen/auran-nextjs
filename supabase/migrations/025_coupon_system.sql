-- 앱 전용 user_coupons + 주문 연결 (기존 public.coupons 테이블 활용)
CREATE TABLE IF NOT EXISTS public.user_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'unused',
  issued_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  CONSTRAINT user_coupons_status_chk CHECK (status IN ('unused', 'used', 'expired')),
  CONSTRAINT user_coupons_user_coupon_uq UNIQUE (user_id, coupon_id)
);

CREATE INDEX IF NOT EXISTS idx_user_coupons_user ON public.user_coupons(user_id);
CREATE INDEX IF NOT EXISTS idx_user_coupons_coupon ON public.user_coupons(coupon_id);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS user_coupon_id uuid REFERENCES public.user_coupons(id) ON DELETE SET NULL;

ALTER TABLE public.user_coupons
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS signup_alimtalk_sent_at timestamptz;

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS issue_trigger text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS max_issue_count int4,
  ADD COLUMN IF NOT EXISTS issued_count int4 DEFAULT 0;

-- 웰컴 쿠폰 (code 고정 — 기존 coupons.code NOT NULL 유지)
INSERT INTO public.coupons (
  code, name, description, type, discount_amount, min_order, start_at, end_at,
  issue_trigger, is_active, usage_limit, used_count
)
VALUES (
  'APP-WELCOME-5000',
  '웰컴 쿠폰 5,000원',
  '첫 가입 감사 쿠폰 · 5만원 이상 구매시 사용',
  'amount',
  5000,
  50000,
  now(),
  '2026-12-31 23:59:59+09'::timestamptz,
  'signup',
  true,
  NULL,
  0
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  discount_amount = EXCLUDED.discount_amount,
  min_order = EXCLUDED.min_order,
  end_at = EXCLUDED.end_at,
  issue_trigger = EXCLUDED.issue_trigger,
  is_active = EXCLUDED.is_active;

ALTER TABLE public.user_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coupons_active_read" ON public.coupons;
CREATE POLICY "coupons_active_read"
  ON public.coupons FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

DROP POLICY IF EXISTS "coupons_admin_all" ON public.coupons;
CREATE POLICY "coupons_admin_all"
  ON public.coupons FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'admin')
  );

DROP POLICY IF EXISTS "user_coupons_own" ON public.user_coupons;
DROP POLICY IF EXISTS "user_coupons_own_select" ON public.user_coupons;
CREATE POLICY "user_coupons_own_select"
  ON public.user_coupons FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_coupons_admin_all" ON public.user_coupons;
CREATE POLICY "user_coupons_admin_all"
  ON public.user_coupons FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'admin')
  );

INSERT INTO public.admin_settings (category, key, value, label, unit, value_type)
VALUES
  ('coupon', 'signup_coupon_enabled', '1', '가입 쿠폰 자동 발급', '', 'number'),
  ('coupon', 'max_coupons_per_order', '1', '주문당 최대 쿠폰 수', '장', 'number'),
  ('coupon', 'welcome_coupon_amount', '5000', '웰컴 쿠폰 금액', '원', 'number'),
  ('coupon', 'welcome_min_order', '50000', '웰컴 쿠폰 최소 주문', '원', 'number'),
  ('alimtalk', 'enabled', '1', '알림톡 발송', '', 'number'),
  ('alimtalk', 'signup_enabled', '1', '가입 알림톡', '', 'number'),
  ('alimtalk', 'coupon_enabled', '1', '쿠폰 알림톡', '', 'number'),
  ('alimtalk', 'order_enabled', '1', '주문 알림톡', '', 'number'),
  ('alimtalk', 'gift_enabled', '1', '선물 알림톡', '', 'number')
ON CONFLICT (category, key)
DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  unit = EXCLUDED.unit,
  value_type = EXCLUDED.value_type,
  updated_at = NOW();

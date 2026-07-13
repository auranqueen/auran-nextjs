-- 094_subscription_plans_store_showcase_annual.sql
-- 원장 스토어 이용료: 레이어1(store) + 레이어2(showcase) 연간 플랜 4종
-- 전제: public.subscription_plans (id, mode, plan, name, price, features, is_active, sort_order, created_at, slug)
-- 실행: 윰탱님 Supabase SQL Editor에서 직접

-- ============================================================
-- 0. slug UNIQUE (repo에 기존 제약 없음 — 안전하게 추가)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_plans_slug_unique
  ON public.subscription_plans(slug)
  WHERE slug IS NOT NULL;

-- ============================================================
-- 1. 공통 컬럼: billing_period, layer, trial_days
-- ============================================================
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS billing_period TEXT NOT NULL DEFAULT 'monthly';

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS layer TEXT;

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS trial_days INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscription_plans_billing_period_check'
  ) THEN
    ALTER TABLE public.subscription_plans
      ADD CONSTRAINT subscription_plans_billing_period_check
      CHECK (billing_period IN ('monthly', 'annual'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscription_plans_layer_check'
  ) THEN
    ALTER TABLE public.subscription_plans
      ADD CONSTRAINT subscription_plans_layer_check
      CHECK (layer IS NULL OR layer IN ('store', 'showcase'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscription_plans_trial_days_check'
  ) THEN
    ALTER TABLE public.subscription_plans
      ADD CONSTRAINT subscription_plans_trial_days_check
      CHECK (trial_days >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.subscription_plans.billing_period IS
  '청구 주기: monthly | annual';

COMMENT ON COLUMN public.subscription_plans.layer IS
  'store=레이어1 스토어유지비, showcase=레이어2 제품노출권+SNS+라이브';

COMMENT ON COLUMN public.subscription_plans.trial_days IS
  '무료체험 일수. 0이면 즉시유료. store/showcase 연간 플랜별 정책';

UPDATE public.subscription_plans
SET
  billing_period = COALESCE(billing_period, 'monthly'),
  trial_days = COALESCE(trial_days, 0)
WHERE billing_period IS NULL OR trial_days IS NULL;

-- ============================================================
-- 2. 레이어1-A: 스토어유지비 (트랙A, 90일 체험)
-- ============================================================
INSERT INTO public.subscription_plans (
  slug,
  plan,
  mode,
  name,
  price,
  billing_period,
  layer,
  trial_days,
  features,
  is_active,
  sort_order
)
VALUES (
  'track_a_store_annual',
  'track_a_store_annual',
  NULL,
  '스토어 유지비 연간 (트랙A)',
  220000,
  'annual',
  'store',
  90,
  '["예약 관리", "예약 스토어"]'::jsonb,
  true,
  110
)
ON CONFLICT (slug) DO UPDATE SET
  plan = EXCLUDED.plan,
  mode = EXCLUDED.mode,
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  billing_period = EXCLUDED.billing_period,
  layer = EXCLUDED.layer,
  trial_days = EXCLUDED.trial_days,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- 3. 레이어1-B: 스토어유지비 (트랙B, 90일 체험)
-- ============================================================
INSERT INTO public.subscription_plans (
  slug,
  plan,
  mode,
  name,
  price,
  billing_period,
  layer,
  trial_days,
  features,
  is_active,
  sort_order
)
VALUES (
  'track_b_store_annual',
  'track_b_store_annual',
  NULL,
  '스토어 유지비 연간 (트랙B)',
  120000,
  'annual',
  'store',
  90,
  '["예약 관리", "예약 스토어"]'::jsonb,
  true,
  111
)
ON CONFLICT (slug) DO UPDATE SET
  plan = EXCLUDED.plan,
  mode = EXCLUDED.mode,
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  billing_period = EXCLUDED.billing_period,
  layer = EXCLUDED.layer,
  trial_days = EXCLUDED.trial_days,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- 4. 레이어2-A: 제품노출권+SNS+라이브 (트랙A, 즉시유료)
-- ============================================================
INSERT INTO public.subscription_plans (
  slug,
  plan,
  mode,
  name,
  price,
  billing_period,
  layer,
  trial_days,
  features,
  is_active,
  sort_order
)
VALUES (
  'track_a_showcase_annual',
  'track_a_showcase_annual',
  NULL,
  '쇼케이스 연간 (트랙A)',
  330000,
  'annual',
  'showcase',
  0,
  '["브랜드 제품 진열", "오렌피드", "스토리", "SNS 공유", "오렌 라이브"]'::jsonb,
  true,
  210
)
ON CONFLICT (slug) DO UPDATE SET
  plan = EXCLUDED.plan,
  mode = EXCLUDED.mode,
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  billing_period = EXCLUDED.billing_period,
  layer = EXCLUDED.layer,
  trial_days = EXCLUDED.trial_days,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- 5. 레이어2-B: 제품노출권+SNS+라이브 (트랙B, 90일 체험)
-- ============================================================
INSERT INTO public.subscription_plans (
  slug,
  plan,
  mode,
  name,
  price,
  billing_period,
  layer,
  trial_days,
  features,
  is_active,
  sort_order
)
VALUES (
  'track_b_showcase_annual',
  'track_b_showcase_annual',
  NULL,
  '쇼케이스 연간 (트랙B)',
  220000,
  'annual',
  'showcase',
  90,
  '["브랜드 제품 진열", "오렌피드", "스토리", "SNS 공유", "오렌 라이브"]'::jsonb,
  true,
  211
)
ON CONFLICT (slug) DO UPDATE SET
  plan = EXCLUDED.plan,
  mode = EXCLUDED.mode,
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  billing_period = EXCLUDED.billing_period,
  layer = EXCLUDED.layer,
  trial_days = EXCLUDED.trial_days,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- 6. admin_settings: 결제 금액 (subscription/page.tsx priceFor 키)
--    키 패턴: price_{slug}
-- ============================================================
INSERT INTO public.admin_settings (category, key, value)
VALUES
  ('subscription', 'price_track_a_store_annual', '220000'),
  ('subscription', 'price_track_b_store_annual', '120000'),
  ('subscription', 'price_track_a_showcase_annual', '330000'),
  ('subscription', 'price_track_b_showcase_annual', '220000')
ON CONFLICT (category, key)
DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- 079_sponsor_commission_system.sql
-- 원장 전문점 그레이드 · 스폰서 커미션 시스템 (스키마만, 앱/트리거 연동은 후속)
-- ID 체계: owner/sponsor 참조는 전부 profiles.id (users.id 사용 금지)
-- 전제: public.brand_owner_grades 테이블이 운영 DB에 존재 (repo 마이그레이션 드리프트)
-- 참고: public.current_user_id()는 users.id 반환 — profiles FK RLS에는 auth.uid() 경유 사용

-- ============================================================
-- 1. brand_owner_grades 확장
-- ============================================================

ALTER TABLE public.brand_owner_grades
  ADD COLUMN IF NOT EXISTS sponsor_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS care_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS purchase_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS grade_purchased_at TIMESTAMPTZ;

ALTER TABLE public.brand_owner_grades
  DROP CONSTRAINT IF EXISTS brand_owner_grades_payment_status_check;

ALTER TABLE public.brand_owner_grades
  ADD CONSTRAINT brand_owner_grades_payment_status_check
  CHECK (payment_status IN ('pending', 'paid'));

ALTER TABLE public.brand_owner_grades
  DROP CONSTRAINT IF EXISTS brand_owner_grades_grade_check;

ALTER TABLE public.brand_owner_grades
  ADD CONSTRAINT brand_owner_grades_grade_check
  CHECK (grade IN ('취급점', '전문점', '프리미엄전문점', '메디슈티컬'));

COMMENT ON COLUMN public.brand_owner_grades.sponsor_owner_id IS
  '최초 1회 고정 스폰서(profiles.id). NULL=미지정. 앱에서 최초 구매 시 SET 후 변경 금지.';

COMMENT ON COLUMN public.brand_owner_grades.care_enabled IS
  '케어(후속 커미션) 활성 여부. sponsor_eligibility 판정과 연동 예정.';

COMMENT ON COLUMN public.brand_owner_grades.purchase_amount IS
  '전문점 그레이드 패키지 구매 금액(원).';

COMMENT ON COLUMN public.brand_owner_grades.payment_status IS
  '그레이드 구매 결제 상태: pending | paid';

COMMENT ON COLUMN public.brand_owner_grades.grade_purchased_at IS
  '그레이드 결제 완료 시각';

CREATE INDEX IF NOT EXISTS idx_brand_owner_grades_sponsor_owner_id
  ON public.brand_owner_grades(sponsor_owner_id);

-- ============================================================
-- 2. brand_tier_packages
-- ============================================================

CREATE TABLE IF NOT EXISTS public.brand_tier_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL CHECK (tier_name IN ('취급점', '전문점', '프리미엄전문점', '메디슈티컬')),
  price NUMERIC(12, 2) NOT NULL,
  commission_rate NUMERIC(5, 2) NOT NULL,
  product_scope TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_id, tier_name)
);

COMMENT ON TABLE public.brand_tier_packages IS
  '브랜드별 전문점 그레이드 패키지. tier_contract 브랜드만 운영 예정.';

COMMENT ON COLUMN public.brand_tier_packages.commission_rate IS
  '스폰서 커미션율. 예: 20.00 = 20%';

COMMENT ON COLUMN public.brand_tier_packages.product_scope IS
  '적용 품목 범위(전 품목/일부품목 등). nullable.';

CREATE INDEX IF NOT EXISTS idx_brand_tier_packages_brand_id
  ON public.brand_tier_packages(brand_id);

CREATE INDEX IF NOT EXISTS idx_brand_tier_packages_brand_active
  ON public.brand_tier_packages(brand_id, is_active);

-- ============================================================
-- 3. brand_tier_orders
-- ============================================================

CREATE TABLE IF NOT EXISTS public.brand_tier_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  tier_package_id UUID NOT NULL REFERENCES public.brand_tier_packages(id) ON DELETE RESTRICT,
  amount NUMERIC(12, 2) NOT NULL,
  fee_amount NUMERIC(12, 2),
  net_amount NUMERIC(12, 2),
  payment_intent_id UUID REFERENCES public.payment_intents(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT brand_tier_orders_status_check
    CHECK (status IN ('pending', 'paid', 'failed', 'cancelled'))
);

COMMENT ON TABLE public.brand_tier_orders IS
  '원장(profiles.id)의 브랜드 전문점 그레이드 구매 주문. PayApp payment_intents 연동 예정.';

COMMENT ON COLUMN public.brand_tier_orders.fee_amount IS
  '결제 수수료(예: 8.8%).';

COMMENT ON COLUMN public.brand_tier_orders.net_amount IS
  '수수료 차감 후 순액.';

CREATE INDEX IF NOT EXISTS idx_brand_tier_orders_owner_id
  ON public.brand_tier_orders(owner_id);

CREATE INDEX IF NOT EXISTS idx_brand_tier_orders_brand_id
  ON public.brand_tier_orders(brand_id);

CREATE INDEX IF NOT EXISTS idx_brand_tier_orders_payment_intent_id
  ON public.brand_tier_orders(payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_brand_tier_orders_status
  ON public.brand_tier_orders(status);

-- ============================================================
-- 4. sponsor_commission_ledger
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sponsor_commission_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  brand_tier_order_id UUID REFERENCES public.brand_tier_orders(id) ON DELETE SET NULL,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  commission_amount NUMERIC(12, 2) NOT NULL,
  commission_rate NUMERIC(5, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sponsor_commission_ledger_status_check
    CHECK (status IN ('pending', 'approved', 'paid', 'cancelled'))
);

COMMENT ON TABLE public.sponsor_commission_ledger IS
  '스폰서(유치 원장) 커미션 원장. 1단계 지급만 허용: referred_owner_id의 직근 상위 1인만 sponsor_owner_id로 적재. 체인/upline walk 금지 — 앱 레벨 강제, DB 트리거는 후속 단계.';

CREATE INDEX IF NOT EXISTS idx_sponsor_commission_ledger_sponsor
  ON public.sponsor_commission_ledger(sponsor_owner_id);

CREATE INDEX IF NOT EXISTS idx_sponsor_commission_ledger_referred
  ON public.sponsor_commission_ledger(referred_owner_id);

CREATE INDEX IF NOT EXISTS idx_sponsor_commission_ledger_brand_id
  ON public.sponsor_commission_ledger(brand_id);

CREATE INDEX IF NOT EXISTS idx_sponsor_commission_ledger_status
  ON public.sponsor_commission_ledger(status);

CREATE INDEX IF NOT EXISTS idx_sponsor_commission_ledger_tier_order
  ON public.sponsor_commission_ledger(brand_tier_order_id);

-- ============================================================
-- 5. sponsor_eligibility (스켈레톤)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sponsor_eligibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  is_eligible BOOLEAN NOT NULL DEFAULT true,
  lost_reason TEXT,
  last_checked_at TIMESTAMPTZ,
  months_threshold INTEGER NOT NULL DEFAULT 6,
  UNIQUE (owner_id, brand_id)
);

COMMENT ON TABLE public.sponsor_eligibility IS
  '스폰서 커미션 자격 스켈레톤. A/B/C 상실 조건 판정 로직은 후속 구현.';

COMMENT ON COLUMN public.sponsor_eligibility.lost_reason IS
  '자격 상실 사유 코드/메모 (A/B/C 조건). nullable.';

COMMENT ON COLUMN public.sponsor_eligibility.months_threshold IS
  '판정 기준 개월 수. 콘솔 조정 가능 예정. 기본 6.';

CREATE INDEX IF NOT EXISTS idx_sponsor_eligibility_owner_brand
  ON public.sponsor_eligibility(owner_id, brand_id);

-- ============================================================
-- 6. RLS (074 brands 패턴: 본인 SELECT + admin ALL + brand write)
-- profiles.id FK 컬럼 비교: profiles.auth_id = auth.uid() 경유
-- brands.user_id 비교: current_user_id() / auth.uid() (users·auth 체계)
-- ============================================================

-- 6-a) brand_owner_grades
ALTER TABLE public.brand_owner_grades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brand_owner_grades_owner_select ON public.brand_owner_grades;
CREATE POLICY brand_owner_grades_owner_select ON public.brand_owner_grades
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.auth_id = auth.uid()
        AND (
          p.id = brand_owner_grades.owner_id
          OR p.id = brand_owner_grades.sponsor_owner_id
        )
    )
  );

DROP POLICY IF EXISTS brand_owner_grades_brand_write ON public.brand_owner_grades;
CREATE POLICY brand_owner_grades_brand_write ON public.brand_owner_grades
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_owner_grades.brand_id
        AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_owner_grades.brand_id
        AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS brand_owner_grades_admin_all ON public.brand_owner_grades;
CREATE POLICY brand_owner_grades_admin_all ON public.brand_owner_grades
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- 6-b) brand_tier_packages
ALTER TABLE public.brand_tier_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brand_tier_packages_brand_select ON public.brand_tier_packages;
CREATE POLICY brand_tier_packages_brand_select ON public.brand_tier_packages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_tier_packages.brand_id
        AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS brand_tier_packages_admin_all ON public.brand_tier_packages;
CREATE POLICY brand_tier_packages_admin_all ON public.brand_tier_packages
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- 6-c) brand_tier_orders
ALTER TABLE public.brand_tier_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brand_tier_orders_owner_select ON public.brand_tier_orders;
CREATE POLICY brand_tier_orders_owner_select ON public.brand_tier_orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = brand_tier_orders.owner_id
        AND p.auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS brand_tier_orders_admin_all ON public.brand_tier_orders;
CREATE POLICY brand_tier_orders_admin_all ON public.brand_tier_orders
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- 6-d) sponsor_commission_ledger
ALTER TABLE public.sponsor_commission_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sponsor_commission_ledger_party_select ON public.sponsor_commission_ledger;
CREATE POLICY sponsor_commission_ledger_party_select ON public.sponsor_commission_ledger
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.auth_id = auth.uid()
        AND (
          p.id = sponsor_commission_ledger.sponsor_owner_id
          OR p.id = sponsor_commission_ledger.referred_owner_id
        )
    )
  );

DROP POLICY IF EXISTS sponsor_commission_ledger_admin_all ON public.sponsor_commission_ledger;
CREATE POLICY sponsor_commission_ledger_admin_all ON public.sponsor_commission_ledger
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- 6-e) sponsor_eligibility
ALTER TABLE public.sponsor_eligibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sponsor_eligibility_owner_select ON public.sponsor_eligibility;
CREATE POLICY sponsor_eligibility_owner_select ON public.sponsor_eligibility
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = sponsor_eligibility.owner_id
        AND p.auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS sponsor_eligibility_admin_all ON public.sponsor_eligibility;
CREATE POLICY sponsor_eligibility_admin_all ON public.sponsor_eligibility
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  );

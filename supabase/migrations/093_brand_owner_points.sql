-- 093_brand_owner_points.sql
-- 원장 적립금(T): 회사(brand_companies) · ledger · balance · RLS
-- 백필(시바산그룹+씨아클라르제 company_id)은 scripts/backfill_093_civasan_company.sql — 본 파일은 스키마만
-- 전제: public.profiles, public.brands, public.users, public.brand_members 존재
--       092_brand_owner_links_rls.sql 적용 권장 (brand_members 패턴 동일)

-- ============================================================
-- A. brand_companies + brands.company_id
-- ============================================================

CREATE TABLE IF NOT EXISTS public.brand_companies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.brand_companies IS
  '브랜드 회사(허브+세컨브랜드) 단위. 적립금(T) ledger/balance의 company_id FK.';

COMMENT ON COLUMN public.brand_companies.name IS
  '회사 표시명. 예: 시바산그룹';

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS company_id UUID
  REFERENCES public.brand_companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_brands_company_id
  ON public.brands(company_id)
  WHERE company_id IS NOT NULL;

COMMENT ON COLUMN public.brands.company_id IS
  '소속 회사 FK. 세컨브랜드는 허브와 동일 company_id. 백필·brand/page.tsx 연동은 후속.';

-- ============================================================
-- B. brand_owner_point_ledger (append-only)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.brand_owner_point_ledger (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL
    REFERENCES public.brand_companies(id) ON DELETE RESTRICT,
  owner_id         UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount           INTEGER NOT NULL,
  type             TEXT NOT NULL,
  memo             TEXT,
  billing_month    DATE,
  reference_type   TEXT,
  reference_id     UUID,
  idempotency_key  TEXT,
  brand_id         UUID
    REFERENCES public.brands(id) ON DELETE SET NULL,
  created_by       UUID
    REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT brand_owner_point_ledger_type_check
    CHECK (type IN (
      'manual_init',
      'order_earned',
      'used',
      'carried_forward',
      'adjustment'
    )),

  CONSTRAINT brand_owner_point_ledger_idempotency_key_key
    UNIQUE (idempotency_key)
);

COMMENT ON TABLE public.brand_owner_point_ledger IS
  '원장별·회사별 T 적립금 원장(append-only). 잔액은 brand_owner_point_balance와 동기.';

COMMENT ON COLUMN public.brand_owner_point_ledger.amount IS
  'signed integer. 양수=적립·이월, 음수=사용·차감.';

COMMENT ON COLUMN public.brand_owner_point_ledger.type IS
  'manual_init | order_earned | used | carried_forward | adjustment';

COMMENT ON COLUMN public.brand_owner_point_ledger.billing_month IS
  '월청구서 기준월(월 1일). brand_billing_invoices.billing_month과 동일 형식.';

COMMENT ON COLUMN public.brand_owner_point_ledger.reference_type IS
  '연관 엔티티 종류. 예: brand_order, billing_invoice, manual';

COMMENT ON COLUMN public.brand_owner_point_ledger.reference_id IS
  'reference_type에 대응하는 UUID (FK 강제 없음 — 다형 참조).';

COMMENT ON COLUMN public.brand_owner_point_ledger.idempotency_key IS
  '중복 insert 방지. NULL 허용, non-null은 전역 unique.';

COMMENT ON COLUMN public.brand_owner_point_ledger.brand_id IS
  '감사용 — 어느 서브브랜드 발주/이벤트에서 발생했는지. 잔액 집계는 company_id 기준.';

COMMENT ON COLUMN public.brand_owner_point_ledger.created_by IS
  '기록 주체 users.id (brand/admin API). service role bulk 시 NULL 가능.';

CREATE INDEX IF NOT EXISTS idx_brand_owner_point_ledger_company_owner
  ON public.brand_owner_point_ledger(company_id, owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_brand_owner_point_ledger_billing_month
  ON public.brand_owner_point_ledger(company_id, owner_id, billing_month);

CREATE INDEX IF NOT EXISTS idx_brand_owner_point_ledger_reference
  ON public.brand_owner_point_ledger(reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

-- ============================================================
-- C. brand_owner_point_balance (요약)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.brand_owner_point_balance (
  company_id  UUID NOT NULL
    REFERENCES public.brand_companies(id) ON DELETE RESTRICT,
  owner_id    UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  balance     INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (company_id, owner_id),

  CONSTRAINT brand_owner_point_balance_balance_check
    CHECK (balance >= 0)
);

COMMENT ON TABLE public.brand_owner_point_balance IS
  '원장별·회사별 T 잔액 요약. ledger INSERT와 같은 트랜잭션/API에서 갱신.';

COMMENT ON COLUMN public.brand_owner_point_balance.balance IS
  '현재 사용 가능 T. brand_owner_point_ledger.amount 누적과 주기적 reconcile 권장.';

CREATE INDEX IF NOT EXISTS idx_brand_owner_point_balance_owner
  ON public.brand_owner_point_balance(owner_id);

-- ============================================================
-- D. RLS — ledger / balance (092 패턴, client INSERT 없음)
-- ============================================================

-- ---------- brand_companies (조회: brand/admin) ----------

ALTER TABLE public.brand_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brand_companies_brand_select ON public.brand_companies;
CREATE POLICY brand_companies_brand_select ON public.brand_companies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.company_id = brand_companies.id
        AND (
          b.user_id = public.current_user_id()
          OR b.user_id = auth.uid()
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.brands b
      INNER JOIN public.brand_members bm ON bm.brand_id = b.id
      WHERE b.company_id = brand_companies.id
        AND (
          bm.user_id = public.current_user_id()
          OR bm.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS brand_companies_admin_all ON public.brand_companies;
CREATE POLICY brand_companies_admin_all ON public.brand_companies
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- ---------- brand_owner_point_ledger ----------

ALTER TABLE public.brand_owner_point_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brand_owner_point_ledger_owner_select ON public.brand_owner_point_ledger;
CREATE POLICY brand_owner_point_ledger_owner_select ON public.brand_owner_point_ledger
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.auth_id = auth.uid()
        AND p.id = brand_owner_point_ledger.owner_id
    )
  );

DROP POLICY IF EXISTS brand_owner_point_ledger_brand_select ON public.brand_owner_point_ledger;
CREATE POLICY brand_owner_point_ledger_brand_select ON public.brand_owner_point_ledger
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.company_id = brand_owner_point_ledger.company_id
        AND (
          b.user_id = public.current_user_id()
          OR b.user_id = auth.uid()
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.brands b
      INNER JOIN public.brand_members bm ON bm.brand_id = b.id
      WHERE b.company_id = brand_owner_point_ledger.company_id
        AND (
          bm.user_id = public.current_user_id()
          OR bm.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS brand_owner_point_ledger_admin_all ON public.brand_owner_point_ledger;
CREATE POLICY brand_owner_point_ledger_admin_all ON public.brand_owner_point_ledger
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- owner/brand/client INSERT·UPDATE·DELETE 정책 없음 → service role API 전용

-- ---------- brand_owner_point_balance ----------

ALTER TABLE public.brand_owner_point_balance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brand_owner_point_balance_owner_select ON public.brand_owner_point_balance;
CREATE POLICY brand_owner_point_balance_owner_select ON public.brand_owner_point_balance
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.auth_id = auth.uid()
        AND p.id = brand_owner_point_balance.owner_id
    )
  );

DROP POLICY IF EXISTS brand_owner_point_balance_brand_select ON public.brand_owner_point_balance;
CREATE POLICY brand_owner_point_balance_brand_select ON public.brand_owner_point_balance
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.company_id = brand_owner_point_balance.company_id
        AND (
          b.user_id = public.current_user_id()
          OR b.user_id = auth.uid()
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.brands b
      INNER JOIN public.brand_members bm ON bm.brand_id = b.id
      WHERE b.company_id = brand_owner_point_balance.company_id
        AND (
          bm.user_id = public.current_user_id()
          OR bm.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS brand_owner_point_balance_admin_all ON public.brand_owner_point_balance;
CREATE POLICY brand_owner_point_balance_admin_all ON public.brand_owner_point_balance
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- owner/brand/client INSERT·UPDATE·DELETE 정책 없음 → service role API 전용

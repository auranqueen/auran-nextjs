-- 197_owner_rls_company_scope.sql
-- 원장 SELECT에 company 스코프 적용 (타 회사 제품·가격·거래조건 차단)
-- 실행: 운영자가 Supabase SQL Editor에서 직접 적용. 앱에서 자동 적용하지 않음.
--
-- 스코프 정의:
--   A: active brand_owner_links → brands.company_id 일치
--   B: users.origin_track='B' 이고, 해당 company에 distribution_type='tier_contract' 브랜드가 1개 이상
-- 패턴: 133 hq_forced_campaigns_owner_select

-- ============================================================
-- 0) 스키마 드리프트 보완 (레포 CREATE에 없던 company_id)
-- ============================================================

ALTER TABLE public.brand_tier_packages
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.brand_companies(id);

ALTER TABLE public.brand_tier_promo_rules
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.brand_companies(id);

ALTER TABLE public.brand_tier_promo_rules
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.brand_tier_promo_rules ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 1) brand_products — A / B owner SELECT 교체
-- ============================================================

-- 트랙A: 연결(active link) 회사의 active 제품만 (타 회사 공급가 차단)
DROP POLICY IF EXISTS brand_products_select_active_owner ON public.brand_products;
CREATE POLICY brand_products_select_active_owner ON public.brand_products
  FOR SELECT
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1
      FROM public.brand_owner_links bol
      JOIN public.brands link_b ON link_b.id = bol.brand_id
      JOIN public.brands prod_b ON prod_b.id = brand_products.brand_id
      JOIN public.users u ON u.id = bol.owner_id
      WHERE u.auth_id = auth.uid()
        AND u.role = 'owner'
        AND u.origin_track = 'A'
        AND bol.status = 'active'
        AND link_b.company_id IS NOT NULL
        AND link_b.company_id = prod_b.company_id
    )
  );

-- 트랙B: 지사계약(tier_contract) 회사의 active 제품만 (비지사 회사 카탈로그 차단)
DROP POLICY IF EXISTS brand_products_select_active_owner_b ON public.brand_products;
CREATE POLICY brand_products_select_active_owner_b ON public.brand_products
  FOR SELECT
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.role = 'owner'
        AND u.origin_track = 'B'
    )
    AND EXISTS (
      SELECT 1
      FROM public.brands prod_b
      JOIN public.brands tc ON tc.company_id = prod_b.company_id
      WHERE prod_b.id = brand_products.brand_id
        AND prod_b.company_id IS NOT NULL
        AND tc.distribution_type = 'tier_contract'
    )
  );

-- ============================================================
-- 2) brand_tier_packages — owner SELECT 교체 (A/B OR)
-- ============================================================

-- 원장: 연결 회사(A) 또는 지사계약 회사(B)의 활성 패키지만 (타 회사 등급·가격 차단)
DROP POLICY IF EXISTS brand_tier_packages_owner_select ON public.brand_tier_packages;
CREATE POLICY brand_tier_packages_owner_select ON public.brand_tier_packages
  FOR SELECT
  USING (
    is_active = true
    AND brand_tier_packages.company_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.brand_owner_links bol
        JOIN public.brands b ON b.id = bol.brand_id
        JOIN public.users u ON u.id = bol.owner_id
        WHERE u.auth_id = auth.uid()
          AND u.role = 'owner'
          AND u.origin_track = 'A'
          AND bol.status = 'active'
          AND b.company_id = brand_tier_packages.company_id
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.auth_id = auth.uid()
            AND u.role = 'owner'
            AND u.origin_track = 'B'
        )
        AND EXISTS (
          SELECT 1 FROM public.brands tc
          WHERE tc.company_id = brand_tier_packages.company_id
            AND tc.distribution_type = 'tier_contract'
        )
      )
    )
  );

-- ============================================================
-- 3) brand_tier_promo_rules — owner SELECT (+ 브랜드 SELECT 신규)
-- ============================================================

-- 원장: 연결/지사계약 회사의 활성 프로모 규칙만 (타 회사 N+M 조건 차단)
DROP POLICY IF EXISTS brand_tier_promo_rules_owner_select ON public.brand_tier_promo_rules;
CREATE POLICY brand_tier_promo_rules_owner_select ON public.brand_tier_promo_rules
  FOR SELECT
  USING (
    is_active = true
    AND brand_tier_promo_rules.company_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.brand_owner_links bol
        JOIN public.brands b ON b.id = bol.brand_id
        JOIN public.users u ON u.id = bol.owner_id
        WHERE u.auth_id = auth.uid()
          AND u.role = 'owner'
          AND u.origin_track = 'A'
          AND bol.status = 'active'
          AND b.company_id = brand_tier_promo_rules.company_id
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.auth_id = auth.uid()
            AND u.role = 'owner'
            AND u.origin_track = 'B'
        )
        AND EXISTS (
          SELECT 1 FROM public.brands tc
          WHERE tc.company_id = brand_tier_promo_rules.company_id
            AND tc.distribution_type = 'tier_contract'
        )
      )
    )
  );

-- 브랜드 소유·멤버: 자사 company 프로모 규칙 조회 (허브 BrandTierPromoRulesSection)
DROP POLICY IF EXISTS brand_tier_promo_rules_brand_select ON public.brand_tier_promo_rules;
CREATE POLICY brand_tier_promo_rules_brand_select ON public.brand_tier_promo_rules
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.company_id = brand_tier_promo_rules.company_id
        AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.brand_members bm
      JOIN public.brands b ON b.id = bm.brand_id
      WHERE b.company_id = brand_tier_promo_rules.company_id
        AND (
          bm.user_id = public.current_user_id()
          OR bm.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        )
    )
  );

-- ============================================================
-- 4) supply_promos — USING(true) 제거, owner + brand SELECT
-- ============================================================

DROP POLICY IF EXISTS supply_promos_read_authenticated ON public.supply_promos;

-- 원장: 연결/지사계약 회사 소속 브랜드의 프로모만 (타 회사 거래조건 차단)
DROP POLICY IF EXISTS supply_promos_owner_select ON public.supply_promos;
CREATE POLICY supply_promos_owner_select ON public.supply_promos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.brands promo_b
      WHERE promo_b.id = supply_promos.brand_id
        AND promo_b.company_id IS NOT NULL
        AND (
          EXISTS (
            SELECT 1
            FROM public.brand_owner_links bol
            JOIN public.brands link_b ON link_b.id = bol.brand_id
            JOIN public.users u ON u.id = bol.owner_id
            WHERE u.auth_id = auth.uid()
              AND u.role = 'owner'
              AND u.origin_track = 'A'
              AND bol.status = 'active'
              AND link_b.company_id = promo_b.company_id
          )
          OR (
            EXISTS (
              SELECT 1 FROM public.users u
              WHERE u.auth_id = auth.uid()
                AND u.role = 'owner'
                AND u.origin_track = 'B'
            )
            AND EXISTS (
              SELECT 1 FROM public.brands tc
              WHERE tc.company_id = promo_b.company_id
                AND tc.distribution_type = 'tier_contract'
            )
          )
        )
    )
  );

-- 브랜드 소유·멤버: 자사 brand_id 프로모 조회 (BrandOrdersPromoSettings)
DROP POLICY IF EXISTS supply_promos_brand_select ON public.supply_promos;
CREATE POLICY supply_promos_brand_select ON public.supply_promos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = supply_promos.brand_id
        AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.brand_members bm
      WHERE bm.brand_id = supply_promos.brand_id
        AND (
          bm.user_id = public.current_user_id()
          OR bm.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        )
    )
  );

-- ============================================================
-- 5) brand_grade_point_rates — USING(true) 제거, owner + brand SELECT
-- ============================================================

DROP POLICY IF EXISTS brand_grade_point_rates_read_authenticated ON public.brand_grade_point_rates;

-- 원장: 연결/지사계약 회사의 등급 적립율만 (타 회사 rate 차단)
DROP POLICY IF EXISTS brand_grade_point_rates_owner_select ON public.brand_grade_point_rates;
CREATE POLICY brand_grade_point_rates_owner_select ON public.brand_grade_point_rates
  FOR SELECT
  USING (
    brand_grade_point_rates.company_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.brand_owner_links bol
        JOIN public.brands b ON b.id = bol.brand_id
        JOIN public.users u ON u.id = bol.owner_id
        WHERE u.auth_id = auth.uid()
          AND u.role = 'owner'
          AND u.origin_track = 'A'
          AND bol.status = 'active'
          AND b.company_id = brand_grade_point_rates.company_id
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.auth_id = auth.uid()
            AND u.role = 'owner'
            AND u.origin_track = 'B'
        )
        AND EXISTS (
          SELECT 1 FROM public.brands tc
          WHERE tc.company_id = brand_grade_point_rates.company_id
            AND tc.distribution_type = 'tier_contract'
        )
      )
    )
  );

-- 브랜드 소유·멤버: 자사 company 적립율 조회 (BrandGradePointRatesCard / PromoSettings)
DROP POLICY IF EXISTS brand_grade_point_rates_brand_select ON public.brand_grade_point_rates;
CREATE POLICY brand_grade_point_rates_brand_select ON public.brand_grade_point_rates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.company_id = brand_grade_point_rates.company_id
        AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.brand_members bm
      JOIN public.brands b ON b.id = bm.brand_id
      WHERE b.company_id = brand_grade_point_rates.company_id
        AND (
          bm.user_id = public.current_user_id()
          OR bm.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        )
    )
  );

-- ============================================================
-- 롤백 (수동 — 필요 시 아래만 실행. 컬럼 DROP은 데이터 보존을 위해 생략)
-- ============================================================
/*
-- brand_products
DROP POLICY IF EXISTS brand_products_select_active_owner ON public.brand_products;
CREATE POLICY brand_products_select_active_owner ON public.brand_products
  FOR SELECT
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.role = 'owner'
        AND u.origin_track = 'A'
    )
  );

DROP POLICY IF EXISTS brand_products_select_active_owner_b ON public.brand_products;
CREATE POLICY brand_products_select_active_owner_b ON public.brand_products
  FOR SELECT
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.role = 'owner'
        AND u.origin_track = 'B'
    )
  );

-- brand_tier_packages
DROP POLICY IF EXISTS brand_tier_packages_owner_select ON public.brand_tier_packages;
CREATE POLICY brand_tier_packages_owner_select ON public.brand_tier_packages
  FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'owner'
    )
  );

-- brand_tier_promo_rules
DROP POLICY IF EXISTS brand_tier_promo_rules_owner_select ON public.brand_tier_promo_rules;
DROP POLICY IF EXISTS brand_tier_promo_rules_brand_select ON public.brand_tier_promo_rules;

-- supply_promos
DROP POLICY IF EXISTS supply_promos_owner_select ON public.supply_promos;
DROP POLICY IF EXISTS supply_promos_brand_select ON public.supply_promos;
CREATE POLICY supply_promos_read_authenticated ON public.supply_promos
  FOR SELECT
  TO authenticated
  USING (true);

-- brand_grade_point_rates
DROP POLICY IF EXISTS brand_grade_point_rates_owner_select ON public.brand_grade_point_rates;
DROP POLICY IF EXISTS brand_grade_point_rates_brand_select ON public.brand_grade_point_rates;
CREATE POLICY brand_grade_point_rates_read_authenticated ON public.brand_grade_point_rates
  FOR SELECT
  TO authenticated
  USING (true);
*/

-- 127_brand_order_batches.sql
-- DB에 brand_order_batches / brand_order_batch_checklist_items 테이블은 이미 생성됨.
-- 본 마이그레이션은 RLS만 문서화·추가.
--
-- brand_orders RLS 원문은 레포 마이그레이션에 없음.
-- 패턴 출처:
--   - 원장 profile: hq_stock_orders / brand_billing_invoices (085, 120)
--   - 브랜드 소유자: brands.user_id = current_user_id() OR auth.uid()
--   - 브랜드 멤버: brand_members (125_supply_promos_write_rls)

-- ============================================================
-- brand_order_batches
-- ============================================================

ALTER TABLE public.brand_order_batches ENABLE ROW LEVEL SECURITY;

-- SELECT: 원장 본인
DROP POLICY IF EXISTS brand_order_batches_owner_select ON public.brand_order_batches;
CREATE POLICY brand_order_batches_owner_select ON public.brand_order_batches
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.auth_id = auth.uid()
        AND p.id = brand_order_batches.profile_id
    )
  );

-- SELECT: 배치에 속한 brand_orders.brand_id 의 소유자/멤버
DROP POLICY IF EXISTS brand_order_batches_brand_select ON public.brand_order_batches;
CREATE POLICY brand_order_batches_brand_select ON public.brand_order_batches
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.brand_orders bo
      WHERE bo.batch_id = brand_order_batches.id
        AND (
          EXISTS (
            SELECT 1 FROM public.brands b
            WHERE b.id = bo.brand_id
              AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
          )
          OR EXISTS (
            SELECT 1 FROM public.brand_members bm
            WHERE bm.brand_id = bo.brand_id
              AND (
                bm.user_id = public.current_user_id()
                OR bm.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
              )
          )
        )
    )
  );

-- INSERT: 원장 본인 profile_id
DROP POLICY IF EXISTS brand_order_batches_owner_insert ON public.brand_order_batches;
CREATE POLICY brand_order_batches_owner_insert ON public.brand_order_batches
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.auth_id = auth.uid()
        AND p.id = brand_order_batches.profile_id
    )
  );

-- UPDATE: 브랜드 소유자/멤버만 (승인 처리)
DROP POLICY IF EXISTS brand_order_batches_brand_update ON public.brand_order_batches;
CREATE POLICY brand_order_batches_brand_update ON public.brand_order_batches
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.brand_orders bo
      WHERE bo.batch_id = brand_order_batches.id
        AND (
          EXISTS (
            SELECT 1 FROM public.brands b
            WHERE b.id = bo.brand_id
              AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
          )
          OR EXISTS (
            SELECT 1 FROM public.brand_members bm
            WHERE bm.brand_id = bo.brand_id
              AND (
                bm.user_id = public.current_user_id()
                OR bm.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
              )
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.brand_orders bo
      WHERE bo.batch_id = brand_order_batches.id
        AND (
          EXISTS (
            SELECT 1 FROM public.brands b
            WHERE b.id = bo.brand_id
              AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
          )
          OR EXISTS (
            SELECT 1 FROM public.brand_members bm
            WHERE bm.brand_id = bo.brand_id
              AND (
                bm.user_id = public.current_user_id()
                OR bm.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
              )
          )
        )
    )
  );

-- admin ALL
DROP POLICY IF EXISTS brand_order_batches_admin_all ON public.brand_order_batches;
CREATE POLICY brand_order_batches_admin_all ON public.brand_order_batches
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- brand_order_batch_checklist_items
-- ============================================================

ALTER TABLE public.brand_order_batch_checklist_items ENABLE ROW LEVEL SECURITY;

-- SELECT: 배치 원장 본인
DROP POLICY IF EXISTS brand_order_batch_checklist_owner_select ON public.brand_order_batch_checklist_items;
CREATE POLICY brand_order_batch_checklist_owner_select ON public.brand_order_batch_checklist_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.brand_order_batches bob
      JOIN public.profiles p ON p.id = bob.profile_id
      WHERE bob.id = brand_order_batch_checklist_items.batch_id
        AND p.auth_id = auth.uid()
    )
  );

-- SELECT: 배치 내 brand_orders 브랜드 소유자/멤버
DROP POLICY IF EXISTS brand_order_batch_checklist_brand_select ON public.brand_order_batch_checklist_items;
CREATE POLICY brand_order_batch_checklist_brand_select ON public.brand_order_batch_checklist_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.brand_orders bo
      WHERE bo.batch_id = brand_order_batch_checklist_items.batch_id
        AND (
          EXISTS (
            SELECT 1 FROM public.brands b
            WHERE b.id = bo.brand_id
              AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
          )
          OR EXISTS (
            SELECT 1 FROM public.brand_members bm
            WHERE bm.brand_id = bo.brand_id
              AND (
                bm.user_id = public.current_user_id()
                OR bm.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
              )
          )
        )
    )
  );

-- INSERT: 원장(배치 본인) — 체크리스트 행 생성 시
DROP POLICY IF EXISTS brand_order_batch_checklist_owner_insert ON public.brand_order_batch_checklist_items;
CREATE POLICY brand_order_batch_checklist_owner_insert ON public.brand_order_batch_checklist_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.brand_order_batches bob
      JOIN public.profiles p ON p.id = bob.profile_id
      WHERE bob.id = brand_order_batch_checklist_items.batch_id
        AND p.auth_id = auth.uid()
    )
  );

-- UPDATE: 브랜드 소유자/멤버만 (체크 처리)
DROP POLICY IF EXISTS brand_order_batch_checklist_brand_update ON public.brand_order_batch_checklist_items;
CREATE POLICY brand_order_batch_checklist_brand_update ON public.brand_order_batch_checklist_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.brand_orders bo
      WHERE bo.batch_id = brand_order_batch_checklist_items.batch_id
        AND (
          EXISTS (
            SELECT 1 FROM public.brands b
            WHERE b.id = bo.brand_id
              AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
          )
          OR EXISTS (
            SELECT 1 FROM public.brand_members bm
            WHERE bm.brand_id = bo.brand_id
              AND (
                bm.user_id = public.current_user_id()
                OR bm.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
              )
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.brand_orders bo
      WHERE bo.batch_id = brand_order_batch_checklist_items.batch_id
        AND (
          EXISTS (
            SELECT 1 FROM public.brands b
            WHERE b.id = bo.brand_id
              AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
          )
          OR EXISTS (
            SELECT 1 FROM public.brand_members bm
            WHERE bm.brand_id = bo.brand_id
              AND (
                bm.user_id = public.current_user_id()
                OR bm.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
              )
          )
        )
    )
  );

-- admin ALL
DROP POLICY IF EXISTS brand_order_batch_checklist_admin_all ON public.brand_order_batch_checklist_items;
CREATE POLICY brand_order_batch_checklist_admin_all ON public.brand_order_batch_checklist_items
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  );

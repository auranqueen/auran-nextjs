-- 126_brand_grade_point_rates_rls_fix.sql
-- 기록용: brand_grade_point_rates RLS 정책 5개 고정. DB에 이미 반영됨.
-- (RLS만 켜지고 정책이 없어서 전체 차단되던 사고 재발 방지)

ALTER TABLE public.brand_grade_point_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brand_grade_point_rates_read_authenticated ON public.brand_grade_point_rates;
CREATE POLICY brand_grade_point_rates_read_authenticated ON public.brand_grade_point_rates
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS brand_grade_point_rates_brand_insert ON public.brand_grade_point_rates;
CREATE POLICY brand_grade_point_rates_brand_insert ON public.brand_grade_point_rates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_grade_point_rates.brand_id
        AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.brand_members bm
      WHERE bm.brand_id = brand_grade_point_rates.brand_id
        AND (
          bm.user_id = public.current_user_id()
          OR bm.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS brand_grade_point_rates_brand_update ON public.brand_grade_point_rates;
CREATE POLICY brand_grade_point_rates_brand_update ON public.brand_grade_point_rates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_grade_point_rates.brand_id
        AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.brand_members bm
      WHERE bm.brand_id = brand_grade_point_rates.brand_id
        AND (
          bm.user_id = public.current_user_id()
          OR bm.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_grade_point_rates.brand_id
        AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.brand_members bm
      WHERE bm.brand_id = brand_grade_point_rates.brand_id
        AND (
          bm.user_id = public.current_user_id()
          OR bm.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS brand_grade_point_rates_brand_delete ON public.brand_grade_point_rates;
CREATE POLICY brand_grade_point_rates_brand_delete ON public.brand_grade_point_rates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_grade_point_rates.brand_id
        AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.brand_members bm
      WHERE bm.brand_id = brand_grade_point_rates.brand_id
        AND (
          bm.user_id = public.current_user_id()
          OR bm.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS brand_grade_point_rates_admin_all ON public.brand_grade_point_rates;
CREATE POLICY brand_grade_point_rates_admin_all ON public.brand_grade_point_rates
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  );

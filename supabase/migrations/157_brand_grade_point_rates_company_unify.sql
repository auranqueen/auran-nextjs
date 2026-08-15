-- 157_brand_grade_point_rates_company_unify.sql
-- brand_grade_point_rates: brand_id → company_id 전환 (기록용, DB 반영 병행)

ALTER TABLE public.brand_grade_point_rates
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.brand_companies(id);

UPDATE public.brand_grade_point_rates r
SET company_id = b.company_id
FROM public.brands b
WHERE r.brand_id = b.id AND r.company_id IS NULL;

-- 동일 company_id+grade 중복 시 id가 가장 최근인 행만 남김
DELETE FROM public.brand_grade_point_rates a
USING public.brand_grade_point_rates b
WHERE a.company_id IS NOT NULL
  AND a.company_id = b.company_id
  AND a.grade = b.grade
  AND a.id < b.id;

ALTER TABLE public.brand_grade_point_rates
  DROP CONSTRAINT IF EXISTS brand_grade_point_rates_brand_id_grade_key;

ALTER TABLE public.brand_grade_point_rates
  DROP CONSTRAINT IF EXISTS brand_grade_point_rates_company_id_grade_key;

ALTER TABLE public.brand_grade_point_rates
  ADD CONSTRAINT brand_grade_point_rates_company_id_grade_key
  UNIQUE (company_id, grade);

ALTER TABLE public.brand_grade_point_rates
  ALTER COLUMN brand_id DROP NOT NULL;

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
      WHERE b.company_id = brand_grade_point_rates.company_id
        AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.brand_members bm
      JOIN public.brands b ON b.id = bm.brand_id
      WHERE b.company_id = brand_grade_point_rates.company_id
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
      WHERE b.company_id = brand_grade_point_rates.company_id
        AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.brand_members bm
      JOIN public.brands b ON b.id = bm.brand_id
      WHERE b.company_id = brand_grade_point_rates.company_id
        AND (
          bm.user_id = public.current_user_id()
          OR bm.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.company_id = brand_grade_point_rates.company_id
        AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.brand_members bm
      JOIN public.brands b ON b.id = bm.brand_id
      WHERE b.company_id = brand_grade_point_rates.company_id
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
      WHERE b.company_id = brand_grade_point_rates.company_id
        AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.brand_members bm
      JOIN public.brands b ON b.id = bm.brand_id
      WHERE b.company_id = brand_grade_point_rates.company_id
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

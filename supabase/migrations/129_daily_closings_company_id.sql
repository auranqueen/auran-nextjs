-- 129_daily_closings_company_id.sql
-- DB already applied; this file documents schema + RLS for company-scoped daily closings.
--
-- Changes:
--   - company_id UUID REFERENCES brand_companies(id)
--   - UNIQUE (company_id, closing_date) replacing UNIQUE (brand_id, closing_date)
--   - RLS: access via any owned/member brand sharing the same company_id
--     (legacy brand_id-only rows still readable via brand_id fallback)

ALTER TABLE public.brand_logistics_daily_closings
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.brand_companies(id);

ALTER TABLE public.brand_logistics_daily_closings
  DROP CONSTRAINT IF EXISTS brand_logistics_daily_closings_brand_id_closing_date_key;

ALTER TABLE public.brand_logistics_daily_closings
  DROP CONSTRAINT IF EXISTS brand_logistics_daily_closings_company_date_key;

ALTER TABLE public.brand_logistics_daily_closings
  ADD CONSTRAINT brand_logistics_daily_closings_company_date_key
  UNIQUE (company_id, closing_date);

ALTER TABLE public.brand_logistics_daily_closings ENABLE ROW LEVEL SECURITY;

-- Drop 128 policies (brand_id-only) and recreate with company_id (+ brand_id legacy)
DROP POLICY IF EXISTS brand_logistics_daily_closings_select ON public.brand_logistics_daily_closings;
DROP POLICY IF EXISTS brand_logistics_daily_closings_insert ON public.brand_logistics_daily_closings;
DROP POLICY IF EXISTS brand_logistics_daily_closings_update ON public.brand_logistics_daily_closings;

CREATE POLICY brand_logistics_daily_closings_select ON public.brand_logistics_daily_closings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin'
    )
    OR (
      brand_logistics_daily_closings.company_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.brands b
          WHERE b.company_id = brand_logistics_daily_closings.company_id
            AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
        )
        OR EXISTS (
          SELECT 1
          FROM public.brand_members bm
          JOIN public.brands b ON b.id = bm.brand_id
          WHERE b.company_id = brand_logistics_daily_closings.company_id
            AND (
              bm.user_id = public.current_user_id()
              OR bm.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
            )
        )
      )
    )
    OR (
      brand_logistics_daily_closings.brand_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.brands b
          WHERE b.id = brand_logistics_daily_closings.brand_id
            AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
        )
        OR EXISTS (
          SELECT 1 FROM public.brand_members bm
          WHERE bm.brand_id = brand_logistics_daily_closings.brand_id
            AND (
              bm.user_id = public.current_user_id()
              OR bm.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
            )
        )
      )
    )
  );

CREATE POLICY brand_logistics_daily_closings_insert ON public.brand_logistics_daily_closings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin'
    )
    OR (
      brand_logistics_daily_closings.company_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.brands b
          WHERE b.company_id = brand_logistics_daily_closings.company_id
            AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
        )
        OR EXISTS (
          SELECT 1
          FROM public.brand_members bm
          JOIN public.brands b ON b.id = bm.brand_id
          WHERE b.company_id = brand_logistics_daily_closings.company_id
            AND (
              bm.user_id = public.current_user_id()
              OR bm.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
            )
        )
      )
    )
  );

CREATE POLICY brand_logistics_daily_closings_update ON public.brand_logistics_daily_closings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin'
    )
    OR (
      brand_logistics_daily_closings.company_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.brands b
          WHERE b.company_id = brand_logistics_daily_closings.company_id
            AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
        )
        OR EXISTS (
          SELECT 1
          FROM public.brand_members bm
          JOIN public.brands b ON b.id = bm.brand_id
          WHERE b.company_id = brand_logistics_daily_closings.company_id
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
      SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin'
    )
    OR (
      brand_logistics_daily_closings.company_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.brands b
          WHERE b.company_id = brand_logistics_daily_closings.company_id
            AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
        )
        OR EXISTS (
          SELECT 1
          FROM public.brand_members bm
          JOIN public.brands b ON b.id = bm.brand_id
          WHERE b.company_id = brand_logistics_daily_closings.company_id
            AND (
              bm.user_id = public.current_user_id()
              OR bm.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
            )
        )
      )
    )
  );
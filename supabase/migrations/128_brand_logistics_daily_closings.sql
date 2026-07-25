-- 128_brand_logistics_daily_closings.sql
-- DB table already exists; this migration documents/adds RLS only.
-- INSERT roles intended: ops_manager/ops_staff/ceo/director (enforced by BrandPinGate on logi hub).
-- UPDATE confirm intended: HQ only (ops excluded in confirm UI). RLS uses brands/brand_members/admin like 127.

ALTER TABLE public.brand_logistics_daily_closings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brand_logistics_daily_closings_select ON public.brand_logistics_daily_closings;
CREATE POLICY brand_logistics_daily_closings_select ON public.brand_logistics_daily_closings
  FOR SELECT
  USING (
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
    OR EXISTS (
      SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS brand_logistics_daily_closings_insert ON public.brand_logistics_daily_closings;
CREATE POLICY brand_logistics_daily_closings_insert ON public.brand_logistics_daily_closings
  FOR INSERT
  WITH CHECK (
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
    OR EXISTS (
      SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS brand_logistics_daily_closings_update ON public.brand_logistics_daily_closings;
CREATE POLICY brand_logistics_daily_closings_update ON public.brand_logistics_daily_closings
  FOR UPDATE
  USING (
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
    OR EXISTS (
      SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
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
    OR EXISTS (
      SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin'
    )
  );
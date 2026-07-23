-- 125_supply_promos_write_rls.sql
-- 기록용: supply_promos INSERT/UPDATE/DELETE RLS (소유자/멤버). DB에 이미 반영됨.

DROP POLICY IF EXISTS supply_promos_brand_insert ON public.supply_promos;
CREATE POLICY supply_promos_brand_insert ON public.supply_promos
  FOR INSERT
  WITH CHECK (
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

DROP POLICY IF EXISTS supply_promos_brand_update ON public.supply_promos;
CREATE POLICY supply_promos_brand_update ON public.supply_promos
  FOR UPDATE
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
  )
  WITH CHECK (
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

DROP POLICY IF EXISTS supply_promos_brand_delete ON public.supply_promos;
CREATE POLICY supply_promos_brand_delete ON public.supply_promos
  FOR DELETE
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

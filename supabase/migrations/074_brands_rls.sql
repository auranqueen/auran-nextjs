-- 074_brands_rls.sql
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS brands_select_all ON public.brands;
CREATE POLICY brands_select_all ON public.brands
  FOR SELECT
  USING (true);
DROP POLICY IF EXISTS brands_update_own ON public.brands;
CREATE POLICY brands_update_own ON public.brands
  FOR UPDATE
  USING (user_id = public.current_user_id() OR user_id = auth.uid())
  WITH CHECK (user_id = public.current_user_id() OR user_id = auth.uid());
DROP POLICY IF EXISTS brands_insert_own ON public.brands;
CREATE POLICY brands_insert_own ON public.brands
  FOR INSERT
  WITH CHECK (user_id = public.current_user_id() OR user_id = auth.uid());
DROP POLICY IF EXISTS admin_all_brands ON public.brands;
CREATE POLICY admin_all_brands ON public.brands
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  );

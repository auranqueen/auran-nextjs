-- 075_salons_admin_update_policy.sql
DROP POLICY IF EXISTS admin_all_salons ON public.salons;
CREATE POLICY admin_all_salons ON public.salons
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- 092_brand_owner_links_rls_rollback.sql
-- 092_brand_owner_links_rls.sql 역순 롤백 (실행은 수동)

DROP POLICY IF EXISTS brand_owner_links_admin_all ON public.brand_owner_links;
DROP POLICY IF EXISTS brand_owner_links_brand_update ON public.brand_owner_links;
DROP POLICY IF EXISTS brand_owner_links_brand_select ON public.brand_owner_links;
DROP POLICY IF EXISTS brand_owner_links_owner_select ON public.brand_owner_links;

ALTER TABLE public.brand_owner_links DISABLE ROW LEVEL SECURITY;

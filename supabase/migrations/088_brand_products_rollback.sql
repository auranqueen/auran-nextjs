-- 088_brand_products_rollback.sql

DROP POLICY IF EXISTS brand_products_admin_all ON public.brand_products;
DROP POLICY IF EXISTS brand_products_brand_delete_own ON public.brand_products;
DROP POLICY IF EXISTS brand_products_brand_update_own ON public.brand_products;
DROP POLICY IF EXISTS brand_products_brand_insert_own ON public.brand_products;
DROP POLICY IF EXISTS brand_products_brand_select_own ON public.brand_products;
DROP POLICY IF EXISTS brand_products_select_active ON public.brand_products;

DROP INDEX IF EXISTS idx_brand_products_category_id;
DROP INDEX IF EXISTS idx_brand_products_brand_user_id;
DROP INDEX IF EXISTS idx_brand_products_brand_status;
DROP INDEX IF EXISTS idx_brand_products_brand_id;

DROP TABLE IF EXISTS public.brand_products;

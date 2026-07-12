-- 091_brand_products_rls_owner_bind_rollback.sql
-- 091_brand_products_rls_owner_bind.sql 역순 롤백 (실행은 수동)

DROP POLICY IF EXISTS brand_products_select_active_owner ON public.brand_products;
DROP POLICY IF EXISTS brand_products_select_active_brand ON public.brand_products;

-- 089 상태로 복원
DROP POLICY IF EXISTS brand_products_select_active ON public.brand_products;
CREATE POLICY brand_products_select_active ON public.brand_products
  FOR SELECT
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.role IN ('owner', 'brand', 'admin')
    )
  );

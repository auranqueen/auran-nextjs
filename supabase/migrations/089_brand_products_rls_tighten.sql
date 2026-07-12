-- 089_brand_products_rls_tighten.sql
-- 088 적용 후 select_active 정책 교체 (customer role SELECT 차단)

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

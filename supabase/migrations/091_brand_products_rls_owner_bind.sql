-- 091_brand_products_rls_owner_bind.sql
-- 089 brand_products_select_active 역할별 분리
-- brand: 자기 brand_user_id active만 / owner(트랙A): active 전체 / admin: 기존 admin_all

DROP POLICY IF EXISTS brand_products_select_active ON public.brand_products;

-- brand 계정: active + 본인 등록 제품만
DROP POLICY IF EXISTS brand_products_select_active_brand ON public.brand_products;
CREATE POLICY brand_products_select_active_brand ON public.brand_products
  FOR SELECT
  USING (
    status = 'active'
    AND (
      brand_user_id = public.current_user_id()
      OR brand_user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.role = 'brand'
    )
  );

-- owner 계정(트랙A): active 전체 브랜드 열람 (발주 화면)
DROP POLICY IF EXISTS brand_products_select_active_owner ON public.brand_products;
CREATE POLICY brand_products_select_active_owner ON public.brand_products
  FOR SELECT
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.role = 'owner'
        AND u.origin_track = 'A'
    )
  );

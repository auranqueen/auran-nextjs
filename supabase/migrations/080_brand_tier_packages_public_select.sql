-- 080_brand_tier_packages_public_select.sql
-- brand_tier_packages: 로그인 원장(owner)이 활성 패키지 목록을 SELECT 할 수 있도록 정책 추가
-- 기존 brand_tier_packages_brand_select, brand_tier_packages_admin_all 는 유지

DROP POLICY IF EXISTS brand_tier_packages_owner_select ON public.brand_tier_packages;

CREATE POLICY brand_tier_packages_owner_select ON public.brand_tier_packages
  FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'owner'
    )
  );

COMMENT ON POLICY brand_tier_packages_owner_select ON public.brand_tier_packages IS
  '원장 홈 뱃지 구매 UI: is_active=true 패키지를 role=owner 로그인 사용자에게 공개 SELECT';

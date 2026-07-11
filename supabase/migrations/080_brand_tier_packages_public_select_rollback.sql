-- 080_brand_tier_packages_public_select_rollback.sql
-- 080_brand_tier_packages_public_select.sql 역순 롤백 (실행은 수동)

DROP POLICY IF EXISTS brand_tier_packages_owner_select ON public.brand_tier_packages;

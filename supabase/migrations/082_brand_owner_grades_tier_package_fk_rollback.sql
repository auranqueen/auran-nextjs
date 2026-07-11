-- 082_brand_owner_grades_tier_package_fk_rollback.sql
-- 082_brand_owner_grades_tier_package_fk.sql 역순 롤백 (실행은 수동)

DROP INDEX IF EXISTS public.idx_brand_owner_grades_tier_package_id;

ALTER TABLE public.brand_owner_grades
  DROP COLUMN IF EXISTS tier_package_id;

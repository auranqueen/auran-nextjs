-- 081_free_tier_names_rollback.sql
-- 081_free_tier_names.sql 역순 롤백 (실행은 수동)

ALTER TABLE public.brand_tier_packages
  DROP CONSTRAINT IF EXISTS brand_tier_packages_tier_name_check;

ALTER TABLE public.brand_tier_packages
  ADD CONSTRAINT brand_tier_packages_tier_name_check
  CHECK (tier_name IN ('취급점', '전문점', '프리미엄전문점', '메디슈티컬'));

ALTER TABLE public.brand_owner_grades
  DROP CONSTRAINT IF EXISTS brand_owner_grades_grade_check;

ALTER TABLE public.brand_owner_grades
  ADD CONSTRAINT brand_owner_grades_grade_check
  CHECK (grade IN ('취급점', '전문점', '프리미엄전문점', '메디슈티컬'));

-- 081_free_tier_names.sql
-- 브랜드별 자유 tier_name / grade 허용 (고정 4단계 CHECK 제거)
-- 전제: 079_sponsor_commission_system.sql 적용됨

ALTER TABLE public.brand_tier_packages
  DROP CONSTRAINT IF EXISTS brand_tier_packages_tier_name_check;

ALTER TABLE public.brand_owner_grades
  DROP CONSTRAINT IF EXISTS brand_owner_grades_grade_check;

COMMENT ON COLUMN public.brand_tier_packages.tier_name IS
  '브랜드별 자유 등급명 (개수·명칭 제한 없음). 업그레이드 순서는 price로 판단.';

COMMENT ON COLUMN public.brand_owner_grades.grade IS
  '브랜드별 자유 등급명. 업그레이드·다운그레이드 판단은 tier_package_id → price 기준.';

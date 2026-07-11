-- 082_brand_owner_grades_tier_package_fk.sql
-- brand_owner_grades: 구매 시점 패키지 FK (커미션율·업그레이드 판단 기준)
-- 전제: 079, 081 적용됨

ALTER TABLE public.brand_owner_grades
  ADD COLUMN IF NOT EXISTS tier_package_id UUID REFERENCES public.brand_tier_packages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_brand_owner_grades_tier_package_id
  ON public.brand_owner_grades(tier_package_id);

COMMENT ON COLUMN public.brand_owner_grades.tier_package_id IS
  '구매 시점의 정확한 패키지 참조. 커미션율·업그레이드 판단 기준. 가격/이름 변경과 무관하게 고정.';

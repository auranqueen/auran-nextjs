-- 090_brands_name_en.sql
-- brands 영문명 (세컨브랜드 등록 UI name_en 저장용)

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS name_en TEXT;

COMMENT ON COLUMN public.brands.name_en IS
  '브랜드 영문명 (nullable). 예: CIVASAN';

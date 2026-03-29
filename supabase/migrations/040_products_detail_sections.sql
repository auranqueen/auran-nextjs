-- 상세페이지 섹션: KEY INGREDIENTS, CLINICAL, CERTIFICATIONS, PERFECT TOGETHER
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS key_ingredients TEXT,
  ADD COLUMN IF NOT EXISTS clinical_result TEXT,
  ADD COLUMN IF NOT EXISTS certifications TEXT,
  ADD COLUMN IF NOT EXISTS perfect_together UUID[] DEFAULT '{}'::uuid[];

COMMENT ON COLUMN public.products.key_ingredients IS 'KEY INGREDIENTS 섹션 본문 (textarea)';
COMMENT ON COLUMN public.products.clinical_result IS 'CLINICAL RESULT 섹션 본문 (textarea)';
COMMENT ON COLUMN public.products.certifications IS 'CERTIFICATIONS 섹션 본문 (줄바꿈 구분 가능)';
COMMENT ON COLUMN public.products.perfect_together IS '함께 쓰면 좋은 제품 ID 목록';

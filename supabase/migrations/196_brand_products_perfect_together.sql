-- 196_brand_products_perfect_together.sql
-- 브랜드 제품 함께 쓰기 좋은 제품 — brand_products.id[] (오렌몰 products와 분리)

ALTER TABLE public.brand_products
  ADD COLUMN IF NOT EXISTS perfect_together UUID[] NOT NULL DEFAULT '{}'::uuid[];

COMMENT ON COLUMN public.brand_products.perfect_together IS
  '함께 쓰기 좋은 제품 ID 목록(brand_products.id). 같은 company 소속 브랜드 제품만 앱에서 선택.';
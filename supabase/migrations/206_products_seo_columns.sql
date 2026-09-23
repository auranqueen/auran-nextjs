-- products SEO 컬럼 추가 (2026-09-23)
-- 라이브 DB에는 이미 직접 실행 완료. 이 파일은 기록용.
ALTER TABLE products
ADD COLUMN IF NOT EXISTS meta_title TEXT,
ADD COLUMN IF NOT EXISTS meta_description TEXT,
ADD COLUMN IF NOT EXISTS meta_keywords TEXT;
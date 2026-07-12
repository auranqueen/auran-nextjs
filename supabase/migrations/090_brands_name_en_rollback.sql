-- 090_brands_name_en_rollback.sql
-- 090_brands_name_en.sql 역순 롤백 (실행은 수동)

ALTER TABLE public.brands
  DROP COLUMN IF EXISTS name_en;

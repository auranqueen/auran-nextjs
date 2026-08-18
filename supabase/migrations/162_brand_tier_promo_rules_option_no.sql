-- 162_brand_tier_promo_rules_option_no.sql
-- brand_tier_promo_rules: 등급×브랜드당 옵션 여러 행 (예: 5+1, 10+4)

ALTER TABLE public.brand_tier_promo_rules
  ADD COLUMN IF NOT EXISTS option_no integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.brand_tier_promo_rules.option_no IS
  '같은 등급×브랜드 안 옵션 번호 (1=5+1, 2=10+4 등)';

-- 기존 UNIQUE (tier_package_id, brand_id) — 기본 이름 + 실제 컬럼 매칭
ALTER TABLE public.brand_tier_promo_rules
  DROP CONSTRAINT IF EXISTS brand_tier_promo_rules_tier_package_id_brand_id_key;

DROP INDEX IF EXISTS public.brand_tier_promo_rules_tier_package_id_brand_id_key;

DO $$
DECLARE
  con_name text;
  idx_name text;
BEGIN
  FOR con_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'brand_tier_promo_rules'
      AND c.contype = 'u'
      AND (
        SELECT array_agg(a.attname::text ORDER BY x.ordinality)
        FROM unnest(c.conkey) WITH ORDINALITY AS x(attnum, ordinality)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = x.attnum
      ) = ARRAY['tier_package_id', 'brand_id']::text[]
  LOOP
    EXECUTE format('ALTER TABLE public.brand_tier_promo_rules DROP CONSTRAINT IF EXISTS %I', con_name);
  END LOOP;

  FOR idx_name IN
    SELECT i.relname
    FROM pg_index x
    JOIN pg_class t ON t.oid = x.indrelid
    JOIN pg_class i ON i.oid = x.indexrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'brand_tier_promo_rules'
      AND x.indisunique
      AND NOT x.indisprimary
      AND NOT EXISTS (
        SELECT 1 FROM pg_constraint c WHERE c.conindid = x.indexrelid
      )
      AND (
        SELECT array_agg(a.attname::text ORDER BY u.ord)
        FROM unnest(x.indkey::smallint[]) WITH ORDINALITY AS u(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = u.attnum
      ) = ARRAY['tier_package_id', 'brand_id']::text[]
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', idx_name);
  END LOOP;
END $$;

ALTER TABLE public.brand_tier_promo_rules
  DROP CONSTRAINT IF EXISTS brand_tier_promo_rules_tier_package_id_brand_id_option_no_key;

ALTER TABLE public.brand_tier_promo_rules
  ADD CONSTRAINT brand_tier_promo_rules_tier_package_id_brand_id_option_no_key
  UNIQUE (tier_package_id, brand_id, option_no);

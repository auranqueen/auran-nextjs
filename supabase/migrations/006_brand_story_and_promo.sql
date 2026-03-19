-- ============================================================
-- 006. Brand story & promotions (brands table extension)
-- ============================================================

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS story_title TEXT,
  ADD COLUMN IF NOT EXISTS story_body TEXT,
  ADD COLUMN IF NOT EXISTS story_image_url TEXT,
  ADD COLUMN IF NOT EXISTS promo_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promo_title TEXT,
  ADD COLUMN IF NOT EXISTS promo_body TEXT,
  ADD COLUMN IF NOT EXISTS promo_image_url TEXT,
  ADD COLUMN IF NOT EXISTS promo_link_url TEXT,
  ADD COLUMN IF NOT EXISTS promo_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promo_ends_at TIMESTAMPTZ;

-- Keep updated_at current (reuse update_updated_at() from 001_initial_schema.sql)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at') THEN
    DROP TRIGGER IF EXISTS brands_updated_at ON public.brands;
    CREATE TRIGGER brands_updated_at
    BEFORE UPDATE ON public.brands
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;


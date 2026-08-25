-- 170_oren_scene_referral_tracking.sql
-- 예약/관리권 구매 ← 오렌씬 유입 추적. 실행은 운영에서 별도 적용.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS source_scene_post_id UUID
    REFERENCES public.oren_scene_posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_source_scene_post_id
  ON public.bookings (source_scene_post_id)
  WHERE source_scene_post_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'purchases'
  ) THEN
    ALTER TABLE public.purchases
      ADD COLUMN IF NOT EXISTS source_scene_post_id UUID
        REFERENCES public.oren_scene_posts(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_purchases_source_scene_post_id
      ON public.purchases (source_scene_post_id)
      WHERE source_scene_post_id IS NOT NULL;
  END IF;
END $$;

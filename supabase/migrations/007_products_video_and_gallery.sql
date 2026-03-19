-- ============================================================
-- 007. Products: video + gallery (max 5 images in UI)
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS video_url TEXT;


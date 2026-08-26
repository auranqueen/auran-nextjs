-- 174_oren_scene_posts_title.sql
-- Add nullable title for owner/customer scene posts.
-- Keep NULLABLE (existing rows). App/upload will require title; optional NOT NULL later after backfill.

ALTER TABLE public.oren_scene_posts
  ADD COLUMN IF NOT EXISTS title TEXT NULL;

COMMENT ON COLUMN public.oren_scene_posts.title IS 'Scene reel title (required at upload UI; DB nullable for legacy rows)';
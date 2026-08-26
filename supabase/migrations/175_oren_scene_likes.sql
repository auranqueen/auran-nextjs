-- 175_oren_scene_likes.sql
-- Per-user like rows for oren scene posts (toggle). Apply separately in ops.

CREATE TABLE IF NOT EXISTS public.oren_scene_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  scene_post_id UUID NOT NULL REFERENCES public.oren_scene_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT oren_scene_likes_pkey PRIMARY KEY (id),
  CONSTRAINT oren_scene_likes_post_user_unique UNIQUE (scene_post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_oren_scene_likes_scene_post_id
  ON public.oren_scene_likes (scene_post_id);

CREATE INDEX IF NOT EXISTS idx_oren_scene_likes_user_id
  ON public.oren_scene_likes (user_id);

ALTER TABLE public.oren_scene_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS oren_scene_likes_select_own ON public.oren_scene_likes;
CREATE POLICY oren_scene_likes_select_own ON public.oren_scene_likes
  FOR SELECT
  USING (user_id = public.current_user_id());

DROP POLICY IF EXISTS oren_scene_likes_insert_own ON public.oren_scene_likes;
CREATE POLICY oren_scene_likes_insert_own ON public.oren_scene_likes
  FOR INSERT
  WITH CHECK (user_id = public.current_user_id());

DROP POLICY IF EXISTS oren_scene_likes_delete_own ON public.oren_scene_likes;
CREATE POLICY oren_scene_likes_delete_own ON public.oren_scene_likes
  FOR DELETE
  USING (user_id = public.current_user_id());

DROP POLICY IF EXISTS oren_scene_likes_admin_all ON public.oren_scene_likes;
CREATE POLICY oren_scene_likes_admin_all ON public.oren_scene_likes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
        AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
        AND users.role = 'admin'
    )
  );
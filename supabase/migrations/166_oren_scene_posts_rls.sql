-- 166_oren_scene_posts_rls.sql
-- DB already applied (SQL Editor). Record-only migration — documents live RLS.

ALTER TABLE public.oren_scene_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS oren_scene_posts_admin_all ON public.oren_scene_posts;
CREATE POLICY oren_scene_posts_admin_all ON public.oren_scene_posts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
        AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS oren_scene_posts_delete_own ON public.oren_scene_posts;
CREATE POLICY oren_scene_posts_delete_own ON public.oren_scene_posts
  FOR DELETE
  USING (uploader_user_id = public.current_user_id());

DROP POLICY IF EXISTS oren_scene_posts_insert_customer ON public.oren_scene_posts;
CREATE POLICY oren_scene_posts_insert_customer ON public.oren_scene_posts
  FOR INSERT
  WITH CHECK (
    uploader_type = 'customer'
    AND uploader_user_id = public.current_user_id()
  );

DROP POLICY IF EXISTS oren_scene_posts_insert_owner ON public.oren_scene_posts;
CREATE POLICY oren_scene_posts_insert_owner ON public.oren_scene_posts
  FOR INSERT
  WITH CHECK (
    uploader_type = 'owner'
    AND uploader_user_id = public.current_user_id()
    AND salon_id IN (
      SELECT salons.id
      FROM public.salons
      WHERE salons.owner_id = public.current_user_id()
    )
  );

DROP POLICY IF EXISTS oren_scene_posts_select_own_salon ON public.oren_scene_posts;
CREATE POLICY oren_scene_posts_select_own_salon ON public.oren_scene_posts
  FOR SELECT
  USING (
    salon_id IN (
      SELECT salons.id
      FROM public.salons
      WHERE salons.owner_id = public.current_user_id()
    )
  );

DROP POLICY IF EXISTS oren_scene_posts_select_published ON public.oren_scene_posts;
CREATE POLICY oren_scene_posts_select_published ON public.oren_scene_posts
  FOR SELECT
  USING (is_published = true);

DROP POLICY IF EXISTS oren_scene_posts_update_own ON public.oren_scene_posts;
CREATE POLICY oren_scene_posts_update_own ON public.oren_scene_posts
  FOR UPDATE
  USING (uploader_user_id = public.current_user_id());

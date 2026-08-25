-- 173_oren_scene_comments_rls.sql
-- oren scene comments / reports / blocks RLS (apply separately in ops)

-- ========== oren_scene_comments ==========
ALTER TABLE public.oren_scene_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS oren_scene_comments_select_visible ON public.oren_scene_comments;
CREATE POLICY oren_scene_comments_select_visible ON public.oren_scene_comments
  FOR SELECT
  USING (is_hidden = false);

DROP POLICY IF EXISTS oren_scene_comments_insert_own ON public.oren_scene_comments;
CREATE POLICY oren_scene_comments_insert_own ON public.oren_scene_comments
  FOR INSERT
  WITH CHECK (
    author_user_id = public.current_user_id()
    AND author_type IN ('owner', 'customer')
  );

DROP POLICY IF EXISTS oren_scene_comments_update_own ON public.oren_scene_comments;
CREATE POLICY oren_scene_comments_update_own ON public.oren_scene_comments
  FOR UPDATE
  USING (author_user_id = public.current_user_id())
  WITH CHECK (author_user_id = public.current_user_id());

DROP POLICY IF EXISTS oren_scene_comments_delete_own ON public.oren_scene_comments;
CREATE POLICY oren_scene_comments_delete_own ON public.oren_scene_comments
  FOR DELETE
  USING (author_user_id = public.current_user_id());

DROP POLICY IF EXISTS oren_scene_comments_admin_all ON public.oren_scene_comments;
CREATE POLICY oren_scene_comments_admin_all ON public.oren_scene_comments
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

-- ========== oren_scene_comment_reports ==========
ALTER TABLE public.oren_scene_comment_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS oren_scene_comment_reports_select_own ON public.oren_scene_comment_reports;
CREATE POLICY oren_scene_comment_reports_select_own ON public.oren_scene_comment_reports
  FOR SELECT
  USING (reporter_user_id = public.current_user_id());

DROP POLICY IF EXISTS oren_scene_comment_reports_insert_own ON public.oren_scene_comment_reports;
CREATE POLICY oren_scene_comment_reports_insert_own ON public.oren_scene_comment_reports
  FOR INSERT
  WITH CHECK (reporter_user_id = public.current_user_id());

DROP POLICY IF EXISTS oren_scene_comment_reports_admin_all ON public.oren_scene_comment_reports;
CREATE POLICY oren_scene_comment_reports_admin_all ON public.oren_scene_comment_reports
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

-- ========== oren_scene_blocks ==========
ALTER TABLE public.oren_scene_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS oren_scene_blocks_select_own ON public.oren_scene_blocks;
CREATE POLICY oren_scene_blocks_select_own ON public.oren_scene_blocks
  FOR SELECT
  USING (blocker_user_id = public.current_user_id());

DROP POLICY IF EXISTS oren_scene_blocks_insert_own ON public.oren_scene_blocks;
CREATE POLICY oren_scene_blocks_insert_own ON public.oren_scene_blocks
  FOR INSERT
  WITH CHECK (
    blocker_user_id = public.current_user_id()
    AND blocker_user_id <> blocked_user_id
  );

DROP POLICY IF EXISTS oren_scene_blocks_delete_own ON public.oren_scene_blocks;
CREATE POLICY oren_scene_blocks_delete_own ON public.oren_scene_blocks
  FOR DELETE
  USING (blocker_user_id = public.current_user_id());

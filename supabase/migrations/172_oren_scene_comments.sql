-- 172_oren_scene_comments.sql
-- oren scene comments / replies / reports / blocks (apply separately in ops)

CREATE TABLE IF NOT EXISTS public.oren_scene_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_post_id UUID NOT NULL REFERENCES public.oren_scene_posts(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('owner', 'customer')),
  author_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.oren_scene_comments(id) ON DELETE CASCADE,
  mentioned_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  like_count INT NOT NULL DEFAULT 0,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.oren_scene_comments IS
  'oren scene comments. parent_comment_id NULL = top-level; value = reply (depth 1 only).';

CREATE INDEX IF NOT EXISTS idx_oren_scene_comments_scene_post_id
  ON public.oren_scene_comments (scene_post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oren_scene_comments_parent_id
  ON public.oren_scene_comments (parent_comment_id)
  WHERE parent_comment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_oren_scene_comments_author_user_id
  ON public.oren_scene_comments (author_user_id);

-- Prevent nested replies: parent.parent_comment_id must be NULL
CREATE OR REPLACE FUNCTION public.trg_oren_scene_comments_no_nested_reply()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_grandparent UUID;
BEGIN
  IF NEW.parent_comment_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT parent_comment_id INTO v_grandparent
  FROM public.oren_scene_comments
  WHERE id = NEW.parent_comment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'parent_comment_not_found';
  END IF;

  IF v_grandparent IS NOT NULL THEN
    RAISE EXCEPTION 'nested_reply_not_allowed';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_oren_scene_comments_no_nested_reply ON public.oren_scene_comments;
CREATE TRIGGER trg_oren_scene_comments_no_nested_reply
  BEFORE INSERT OR UPDATE OF parent_comment_id ON public.oren_scene_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_oren_scene_comments_no_nested_reply();

CREATE TABLE IF NOT EXISTS public.oren_scene_comment_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.oren_scene_comments(id) ON DELETE CASCADE,
  reporter_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (comment_id, reporter_user_id)
);

COMMENT ON TABLE public.oren_scene_comment_reports IS
  'oren scene comment reports. UNIQUE(comment_id, reporter_user_id) blocks duplicates.';

CREATE INDEX IF NOT EXISTS idx_oren_scene_comment_reports_comment_id
  ON public.oren_scene_comment_reports (comment_id);

-- Auto-hide comment when report count reaches 3+
CREATE OR REPLACE FUNCTION public.trg_oren_scene_comment_reports_auto_hide()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_cnt INT;
BEGIN
  SELECT COUNT(*)::INT INTO v_cnt
  FROM public.oren_scene_comment_reports
  WHERE comment_id = NEW.comment_id;

  IF v_cnt >= 3 THEN
    UPDATE public.oren_scene_comments
    SET is_hidden = true,
        updated_at = now()
    WHERE id = NEW.comment_id
      AND is_hidden = false;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_oren_scene_comment_reports_auto_hide ON public.oren_scene_comment_reports;
CREATE TRIGGER trg_oren_scene_comment_reports_auto_hide
  AFTER INSERT ON public.oren_scene_comment_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_oren_scene_comment_reports_auto_hide();


CREATE TABLE IF NOT EXISTS public.oren_scene_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_user_id, blocked_user_id),
  CHECK (blocker_user_id <> blocked_user_id)
);

COMMENT ON TABLE public.oren_scene_blocks IS
  'oren scene user-to-user blocks.';

CREATE INDEX IF NOT EXISTS idx_oren_scene_blocks_blocker
  ON public.oren_scene_blocks (blocker_user_id);

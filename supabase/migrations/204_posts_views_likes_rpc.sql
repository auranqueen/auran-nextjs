-- 204_posts_views_likes_rpc.sql
-- 이 마이그레이션은 이미 운영 DB에 SQL Editor로 직접 실행되어 반영된 상태를
-- 레포에 기록하기 위한 것임. 재실행해도 안전하도록 CREATE OR REPLACE + DROP IF EXISTS.
-- 실행 불필요. (197~203과 동일: 운영 스키마와 git 기록을 맞추는 문서화)
--
-- posts: increment_post_views RPC, sync_posts_likes_count 트리거,
-- authenticated_update_posts(USING true) 제거.
-- 트랙A oren_scene_posts / brand_posts 에 이 패턴을 복사하지 말 것.

CREATE OR REPLACE FUNCTION public.increment_post_views(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.posts SET views = COALESCE(views, 0) + 1 WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.increment_post_views(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_post_views(uuid) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.sync_posts_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid;
BEGIN
  pid := COALESCE(NEW.post_id, OLD.post_id);
  UPDATE public.posts
     SET likes = (SELECT COUNT(*) FROM public.post_likes WHERE post_id = pid)
   WHERE id = pid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_posts_likes ON public.post_likes;
CREATE TRIGGER trg_sync_posts_likes
AFTER INSERT OR DELETE ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.sync_posts_likes_count();

DROP POLICY IF EXISTS authenticated_update_posts ON public.posts;

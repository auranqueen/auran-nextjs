-- 컨테스트 공개·활성화 시 전체 고객 알림 (notifications.user_id = public.users.id)
-- 사전 조건: public.contests, public.contest_votes 테이블이 이미 있어야 합니다.

CREATE OR REPLACE FUNCTION public.notify_contest_start()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND COALESCE(NEW.is_public, false) = true AND NEW.status = 'active' THEN
    INSERT INTO public.notifications (user_id, title, body, type, icon, is_read, link)
    SELECT u.id,
      '새 컨테스트 시작됐어요 🏆',
      COALESCE(NEW.title, '') || ' · 투표하면 반값 혜택!',
      'contest',
      '🏆',
      false,
      '/community?tab=contest'
    FROM public.users u
    WHERE u.id IS NOT NULL;
  ELSIF TG_OP = 'UPDATE'
    AND COALESCE(NEW.is_public, false) = true
    AND NEW.status = 'active'
    AND (
      COALESCE(OLD.is_public, false) IS DISTINCT FROM true
      OR COALESCE(OLD.status, '') IS DISTINCT FROM 'active'
    )
  THEN
    INSERT INTO public.notifications (user_id, title, body, type, icon, is_read, link)
    SELECT u.id,
      '새 컨테스트 시작됐어요 🏆',
      COALESCE(NEW.title, '') || ' · 투표하면 반값 혜택!',
      'contest',
      '🏆',
      false,
      '/community?tab=contest'
    FROM public.users u
    WHERE u.id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contest_start_notify ON public.contests;
CREATE TRIGGER contest_start_notify
  AFTER INSERT OR UPDATE ON public.contests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_contest_start();

COMMENT ON FUNCTION public.notify_contest_start() IS 'is_public+active 전환 시 users 전원에게 인앱 알림';

-- 이달 TOP10 투표자 → profiles 큐레이터 뱃지 (매월 1일 cron 등에서 호출)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS curator_badge boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS curator_score integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.refresh_monthly_curator_badges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m0 timestamptz;
  m1 timestamptz;
BEGIN
  m0 := date_trunc('month', now() - interval '1 month');
  m1 := date_trunc('month', now());

  UPDATE public.profiles SET curator_badge = false, curator_score = 0;

  WITH top_voters AS (
    SELECT cv.voter_user_id AS uid, COUNT(*)::integer AS cnt
    FROM public.contest_votes cv
    WHERE cv.created_at >= m0 AND cv.created_at < m1
    GROUP BY cv.voter_user_id
    ORDER BY cnt DESC
    LIMIT 10
  ),
  with_auth AS (
    SELECT tv.uid, tv.cnt, u.auth_id
    FROM top_voters tv
    JOIN public.users u ON u.id = tv.uid
    WHERE u.auth_id IS NOT NULL
  )
  UPDATE public.profiles p
  SET curator_badge = true,
      curator_score = w.cnt
  FROM with_auth w
  WHERE p.auth_id = w.auth_id;

  INSERT INTO public.notifications (user_id, title, body, type, icon, is_read, link)
  SELECT tv.uid,
    '큐레이터 선정',
    '이달의 큐레이터로 선정됐어요! 🏆',
    'contest',
    '🏆',
    false,
    '/community?tab=contest'
  FROM (
    SELECT cv.voter_user_id AS uid, COUNT(*)::integer AS cnt
    FROM public.contest_votes cv
    WHERE cv.created_at >= m0 AND cv.created_at < m1
    GROUP BY cv.voter_user_id
    ORDER BY cnt DESC
    LIMIT 10
  ) tv;
END;
$$;

COMMENT ON FUNCTION public.refresh_monthly_curator_badges() IS '전월 contest_votes 기준 TOP10 → profiles.curator_badge; Supabase cron: 0 0 1 * * (KST 조정)';

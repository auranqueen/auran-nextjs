-- ============================================================
-- 8. 스타 시스템 알림 조건 정리 (스펙 대응)
-- ============================================================

-- streak days 설정을 admin_settings로 분리 (조건 하드코딩 제거)
INSERT INTO public.admin_settings (category, key, value)
VALUES
  ('star_system', 'streak_7_days', '7'),
  ('star_system', 'streak_30_days', '30')
ON CONFLICT (category, key)
DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- 1) 공감은 "공감 10개 달성"일 때만 notifications 삽입
-- 2) 연속 저널 5일 달성만 notifications 삽입 (7/30은 포인트만)

CREATE OR REPLACE FUNCTION public._handle_skin_journal_streak(p_user_id UUID, p_journal_date DATE)
RETURNS VOID AS $$
DECLARE
  v_prev_streak INTEGER := 0;
  v_prev_last DATE;
  v_new_streak INTEGER := 1;
  v_notify_at INTEGER := 5;
  v_streak_7_bonus INTEGER := 300;
  v_streak_30_bonus INTEGER := 1000;
  v_streak_7_days INTEGER := 7;
  v_streak_30_days INTEGER := 30;
BEGIN
  SELECT current_streak, last_journal_date
  INTO v_prev_streak, v_prev_last
  FROM public.activity_streaks
  WHERE user_id = p_user_id;

  v_prev_streak := COALESCE(v_prev_streak, 0);

  IF v_prev_last IS NULL THEN
    v_new_streak := 1;
  ELSIF v_prev_last = (p_journal_date - INTERVAL '1 day')::DATE THEN
    v_new_streak := v_prev_streak + 1;
  ELSIF v_prev_last = p_journal_date THEN
    v_new_streak := v_prev_streak;
  ELSE
    v_new_streak := 1;
  END IF;

  v_notify_at := public._get_admin_int('star_system', 'streak_notify_at', 5);
  v_streak_7_bonus := public._get_admin_int('star_system', 'streak_7_bonus', 300);
  v_streak_30_bonus := public._get_admin_int('star_system', 'streak_30_bonus', 1000);
  v_streak_7_days := public._get_admin_int('star_system', 'streak_7_days', 7);
  v_streak_30_days := public._get_admin_int('star_system', 'streak_30_days', 30);

  INSERT INTO public.activity_streaks (user_id, current_streak, last_journal_date, updated_at)
  VALUES (p_user_id, v_new_streak, p_journal_date, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    current_streak = EXCLUDED.current_streak,
    last_journal_date = EXCLUDED.last_journal_date,
    updated_at = NOW();

  IF v_new_streak = v_notify_at THEN
    INSERT INTO public.notifications (user_id, type, title, body, icon, is_read)
    VALUES (p_user_id, 'system', '연속 저널 달성', CONCAT(v_notify_at, '일 연속으로 저널을 작성했어요!'), '🔥', false);
  END IF;

  -- 7/30은 포인트만 (알림은 스펙대로 5일만)
  IF v_new_streak = v_streak_7_days THEN
    PERFORM award_points(p_user_id, v_streak_7_bonus, '연속 저널 보너스', '🔥', NULL);
  ELSIF v_new_streak = v_streak_30_days THEN
    PERFORM award_points(p_user_id, v_streak_30_bonus, '연속 저널 보너스', '🏆', NULL);
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.trg_skin_journal_likes_after_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_points INTEGER := 0;
  v_like_notify INTEGER := 0;
  v_author_id UUID;
  v_total_likes INTEGER := 0;
BEGIN
  SELECT j.user_id INTO v_author_id
  FROM public.skin_journals j
  WHERE j.id = NEW.journal_id;

  v_points := public._get_admin_int('star_system', 'like_points_per', 10);
  v_like_notify := public._get_admin_int('star_system', 'like_notify_reach', 10);

  IF v_author_id IS NOT NULL THEN
    -- 포인트 지급은 매 공감마다
    PERFORM award_points(v_author_id, v_points, '공감 받기', '❤️', NULL);

    -- 스타/누적치 업데이트
    PERFORM public.recalc_user_star_levels(v_author_id);

    SELECT COALESCE(total_likes, 0) INTO v_total_likes
    FROM public.users
    WHERE id = v_author_id;

    -- 알림은 "공감 10개 달성"일 때만
    IF v_total_likes = v_like_notify THEN
      INSERT INTO public.notifications (user_id, type, title, body, icon, is_read)
      VALUES
        (v_author_id, 'system', '공감 10개 달성!', '좋아요 누적 10개를 달성했어요!', '✨', false);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


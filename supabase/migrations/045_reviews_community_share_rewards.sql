-- 리뷰 커뮤니티 공유 연동 + 팔로우 시 추가 보상(admin_settings)

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS is_shared_community boolean NOT NULL DEFAULT false;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS community_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL;

INSERT INTO public.admin_settings (category, key, value)
VALUES
  ('review', 'review_share_like_reward', '10'),
  ('review', 'review_share_follower_reward', '30')
ON CONFLICT (category, key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.trg_follows_after_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_points INTEGER := 0;
  v_rw INTEGER := 0;
  v_followee_auth uuid;
  v_follower_name text;
BEGIN
  v_points := public._get_admin_int('star_system', 'follow_points_per', 30);

  PERFORM award_points(NEW.following_id, v_points, '팔로워 생김', '👤', NULL);

  INSERT INTO public.notifications (user_id, type, title, body, icon, is_read)
  VALUES
    (NEW.following_id, 'system', '새 팔로워!', CONCAT('새로운 팔로워가 생겼어요. +', v_points::TEXT, 'P'), '✨', false);

  v_rw := public._get_admin_int('review', 'review_share_follower_reward', 0);
  IF v_rw > 0 THEN
    SELECT auth_id INTO v_followee_auth FROM public.users WHERE id = NEW.following_id;
    SELECT COALESCE(NULLIF(TRIM(name), ''), '회원') INTO v_follower_name FROM public.users WHERE id = NEW.follower_id;
    IF v_followee_auth IS NOT NULL THEN
      UPDATE public.users SET points = COALESCE(points, 0) + v_rw WHERE id = NEW.following_id;
      BEGIN
        INSERT INTO public.point_transactions (user_id, amount, type, description)
        VALUES (v_followee_auth, v_rw, 'follower_reward', '팔로워 보상');
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
      BEGIN
        INSERT INTO public.notifications (user_id, type, title, body, icon, is_read)
        VALUES (
          NEW.following_id,
          'promo',
          '팔로워가 생겼어요 👯',
          CONCAT(v_follower_name, '님이 나를 팔로우했어요! +', v_rw::TEXT, 'T 적립됐어요'),
          '👯',
          false
        );
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
    END IF;
  END IF;

  PERFORM public.recalc_user_star_levels(NEW.following_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

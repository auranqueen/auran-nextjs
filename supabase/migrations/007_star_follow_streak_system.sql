-- ============================================================
-- 7. 팔로우 / 스타 레벨 / 활동 연속 스택 / 포인트 적립
-- ============================================================

-- ------------------------------------------------------------
-- Columns on users (cache)
-- ------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS star_level INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_likes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_followers INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchase_leads INTEGER NOT NULL DEFAULT 0;

-- ------------------------------------------------------------
-- Follows
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- 공개(관계 리스트가 노출되긴 하지만, 피드/랭킹 기능 안정성 우선)
DROP POLICY IF EXISTS "follows_public_read" ON public.follows;
CREATE POLICY "follows_public_read" ON public.follows
  FOR SELECT USING (true);

-- 현재 사용자가 follower_id로만 팔로우 생성/삭제 가능
DROP POLICY IF EXISTS "follows_owner_write" ON public.follows;
CREATE POLICY "follows_owner_write" ON public.follows
  FOR ALL
  USING (
    follower_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    follower_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- ------------------------------------------------------------
-- Streak
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_streaks (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  last_journal_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.activity_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_streaks_public_read" ON public.activity_streaks;
CREATE POLICY "activity_streaks_public_read" ON public.activity_streaks
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "activity_streaks_owner_write" ON public.activity_streaks;
CREATE POLICY "activity_streaks_owner_write" ON public.activity_streaks
  FOR ALL
  USING (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- ------------------------------------------------------------
-- View: user_star_levels (computed)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.user_star_levels AS
SELECT
  u.id AS user_id,
  u.star_level,
  COALESCE(u.total_followers, 0) AS total_followers,
  COALESCE(u.total_likes, 0) AS total_likes,
  COALESCE(u.purchase_leads, 0) AS purchase_leads,
  (
    SELECT COUNT(*) FROM public.follows f WHERE f.following_id = u.id
  ) AS followers_count,
  (
    SELECT COUNT(*) FROM public.skin_journals j WHERE j.user_id = u.id
  ) AS journal_count,
  (
    SELECT COUNT(*)
    FROM public.reviews r
    WHERE r.author_id = u.id AND r.review_type = 'product' AND r.status = '게시'
  ) AS purchase_review_count,
  (
    SELECT COUNT(*)
    FROM public.skin_journal_likes jl
    JOIN public.skin_journals j ON j.id = jl.journal_id
    WHERE j.user_id = u.id
  )
  +
  (
    SELECT COUNT(*)
    FROM public.product_review_likes prl
    JOIN public.reviews r ON r.id = prl.review_id
    WHERE r.author_id = u.id AND r.review_type = 'product' AND r.status = '게시'
  ) AS likes_count
FROM public.users u;

-- ------------------------------------------------------------
-- Settings seed for star system (admin_settings)
-- ------------------------------------------------------------
INSERT INTO public.admin_settings (category, key, value)
VALUES
  ('star_system', 'base_journal_points', '50'),
  ('star_system', 'photo_journal_extra_points', '100'),
  ('star_system', 'review_product_points', '200'),
  ('star_system', 'like_points_per', '10'),
  ('star_system', 'follow_points_per', '30'),
  ('star_system', 'like_notify_reach', '10'),

  ('star_system', 'streak_notify_at', '5'),
  ('star_system', 'streak_7_bonus', '300'),
  ('star_system', 'streak_30_bonus', '1000'),

  ('star_system', 'lv2_journal_min', '5'),
  ('star_system', 'lv2_followers_min', '10'),
  ('star_system', 'lv3_journal_min', '20'),
  ('star_system', 'lv3_followers_min', '50'),
  ('star_system', 'lv3_purchase_review_min', '3'),
  ('star_system', 'lv4_journal_min', '50'),
  ('star_system', 'lv4_followers_min', '200'),
  ('star_system', 'lv4_like_min', '500'),
  ('star_system', 'lv5_followers_min', '500'),
  ('star_system', 'lv5_like_min', '2000'),
  ('star_system', 'lv5_purchase_leads_min', '50'),

  ('star_system', 'lv2_charge_bonus_pct', '3'),
  ('star_system', 'charge_base_points_pct', '5')
ON CONFLICT (category, key)
DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._get_admin_int(p_category TEXT, p_key TEXT, p_default INTEGER)
RETURNS INTEGER AS $$
DECLARE v INTEGER;
BEGIN
  SELECT NULLIF(value, '')::INTEGER INTO v
  FROM public.admin_settings
  WHERE category = p_category AND key = p_key
  LIMIT 1;

  RETURN COALESCE(v, p_default);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- Star level recalculation + upgrade notification
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalc_user_star_levels(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_old_level INTEGER;
  v_new_level INTEGER := 1;

  v_follower_count INTEGER := 0;
  v_journal_count INTEGER := 0;
  v_review_count INTEGER := 0;
  v_like_count INTEGER := 0;
  v_purchase_leads INTEGER := 0;

  lv2_journal_min INTEGER := 0;
  lv2_followers_min INTEGER := 0;
  lv3_journal_min INTEGER := 0;
  lv3_followers_min INTEGER := 0;
  lv3_review_min INTEGER := 0;
  lv4_journal_min INTEGER := 0;
  lv4_followers_min INTEGER := 0;
  lv4_like_min INTEGER := 0;
  lv5_followers_min INTEGER := 0;
  lv5_like_min INTEGER := 0;
  lv5_purchase_leads_min INTEGER := 0;
BEGIN
  SELECT star_level, COALESCE(purchase_leads, 0) INTO v_old_level, v_purchase_leads
  FROM public.users
  WHERE id = p_user_id;

  -- followers
  SELECT COUNT(*) INTO v_follower_count
  FROM public.follows
  WHERE following_id = p_user_id;

  -- journals
  SELECT COUNT(*) INTO v_journal_count
  FROM public.skin_journals
  WHERE user_id = p_user_id;

  -- purchase reviews (product)
  SELECT COUNT(*) INTO v_review_count
  FROM public.reviews r
  WHERE r.author_id = p_user_id
    AND r.review_type = 'product'
    AND r.status = '게시';

  -- likes across journals + product reviews
  SELECT
    COALESCE(
      (
        SELECT COUNT(*)
        FROM public.skin_journal_likes jl
        JOIN public.skin_journals j ON j.id = jl.journal_id
        WHERE j.user_id = p_user_id
      ), 0
    )
    +
    COALESCE(
      (
        SELECT COUNT(*)
        FROM public.product_review_likes prl
        JOIN public.reviews r ON r.id = prl.review_id
        WHERE r.author_id = p_user_id
          AND r.review_type = 'product'
          AND r.status = '게시'
      ), 0
    )
  INTO v_like_count;

  -- thresholds
  lv2_journal_min := public._get_admin_int('star_system', 'lv2_journal_min', 5);
  lv2_followers_min := public._get_admin_int('star_system', 'lv2_followers_min', 10);

  lv3_journal_min := public._get_admin_int('star_system', 'lv3_journal_min', 20);
  lv3_followers_min := public._get_admin_int('star_system', 'lv3_followers_min', 50);
  lv3_review_min := public._get_admin_int('star_system', 'lv3_purchase_review_min', 3);

  lv4_journal_min := public._get_admin_int('star_system', 'lv4_journal_min', 50);
  lv4_followers_min := public._get_admin_int('star_system', 'lv4_followers_min', 200);
  lv4_like_min := public._get_admin_int('star_system', 'lv4_like_min', 500);

  lv5_followers_min := public._get_admin_int('star_system', 'lv5_followers_min', 500);
  lv5_like_min := public._get_admin_int('star_system', 'lv5_like_min', 2000);
  lv5_purchase_leads_min := public._get_admin_int('star_system', 'lv5_purchase_leads_min', 50);

  -- compute level (evaluate high -> low)
  IF v_follower_count >= lv5_followers_min
     AND v_like_count >= lv5_like_min
     AND v_purchase_leads >= lv5_purchase_leads_min
  THEN
    v_new_level := 5;
  ELSIF v_journal_count >= lv4_journal_min
     AND v_follower_count >= lv4_followers_min
     AND v_like_count >= lv4_like_min
  THEN
    v_new_level := 4;
  ELSIF v_journal_count >= lv3_journal_min
     AND v_follower_count >= lv3_followers_min
     AND v_review_count >= lv3_review_min
  THEN
    v_new_level := 3;
  ELSIF v_journal_count >= lv2_journal_min
     AND v_follower_count >= lv2_followers_min
  THEN
    v_new_level := 2;
  ELSE
    v_new_level := 1;
  END IF;

  UPDATE public.users
  SET
    star_level = v_new_level,
    total_followers = v_follower_count,
    total_likes = v_like_count
  WHERE id = p_user_id;

  IF v_new_level > v_old_level THEN
    INSERT INTO public.notifications (user_id, type, title, body, icon, is_read)
    VALUES
      (
        p_user_id,
        'system',
        '스타 등급 업!',
        CONCAT('축하합니다. 스타 ', v_new_level, '에 도달했어요!'),
        '🏅',
        false
      );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- Streak handler
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._handle_skin_journal_streak(p_user_id UUID, p_journal_date DATE)
RETURNS VOID AS $$
DECLARE
  v_prev_streak INTEGER := 0;
  v_prev_last DATE;
  v_new_streak INTEGER := 1;
  v_notify_at INTEGER := 5;
  v_streak_7_bonus INTEGER := 300;
  v_streak_30_bonus INTEGER := 1000;
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
    v_new_streak := v_prev_streak; -- 같은 날짜 재작성은 의미 없음
  ELSE
    v_new_streak := 1;
  END IF;

  v_notify_at := public._get_admin_int('star_system', 'streak_notify_at', 5);
  v_streak_7_bonus := public._get_admin_int('star_system', 'streak_7_bonus', 300);
  v_streak_30_bonus := public._get_admin_int('star_system', 'streak_30_bonus', 1000);

  INSERT INTO public.activity_streaks (user_id, current_streak, last_journal_date, updated_at)
  VALUES (p_user_id, v_new_streak, p_journal_date, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    current_streak = EXCLUDED.current_streak,
    last_journal_date = EXCLUDED.last_journal_date,
    updated_at = NOW();

  IF v_new_streak = v_notify_at THEN
    INSERT INTO public.notifications (user_id, type, title, body, icon, is_read)
    VALUES (p_user_id, 'system', '연속 저널 달성', '5일 연속으로 저널을 작성했어요!', '🔥', false);
  END IF;

  IF v_new_streak = 7 THEN
    PERFORM award_points(p_user_id, v_streak_7_bonus, '연속 저널 보너스', '🔥', NULL);
    INSERT INTO public.notifications (user_id, type, title, body, icon, is_read)
    VALUES (p_user_id, 'system', '7일 연속 보너스', CONCAT(v_streak_7_bonus, 'P를 적립했어요!'), '🔥', false);
  ELSIF v_new_streak = 30 THEN
    PERFORM award_points(p_user_id, v_streak_30_bonus, '30일 연속 보너스', '🏆', NULL);
    INSERT INTO public.notifications (user_id, type, title, body, icon, is_read)
    VALUES (p_user_id, 'system', '30일 연속 보너스', CONCAT(v_streak_30_bonus, 'P를 적립했어요!'), '🏆', false);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- Triggers: follow / like / journal / review
-- ------------------------------------------------------------
-- Follow insert
CREATE OR REPLACE FUNCTION public.trg_follows_after_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_points INTEGER := 0;
BEGIN
  v_points := public._get_admin_int('star_system', 'follow_points_per', 30);

  -- followe(=following_id) 포인트 지급
  PERFORM award_points(NEW.following_id, v_points, '팔로워 생김', '👤', NULL);

  INSERT INTO public.notifications (user_id, type, title, body, icon, is_read)
  VALUES
    (NEW.following_id, 'system', '새 팔로워!', '새로운 팔로워가 생겼어요. +', v_points::TEXT || 'P', '✨', false);

  PERFORM public.recalc_user_star_levels(NEW.following_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_follows_after_insert ON public.follows;
CREATE TRIGGER on_follows_after_insert
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.trg_follows_after_insert();

-- Follow delete -> just recalc
CREATE OR REPLACE FUNCTION public.trg_follows_after_delete()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.recalc_user_star_levels(OLD.following_id);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_follows_after_delete ON public.follows;
CREATE TRIGGER on_follows_after_delete
  AFTER DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.trg_follows_after_delete();

-- Journal insert
CREATE OR REPLACE FUNCTION public.trg_skin_journals_after_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_base INTEGER := 0;
  v_extra INTEGER := 0;
BEGIN
  v_base := public._get_admin_int('star_system', 'base_journal_points', 50);
  v_extra := public._get_admin_int('star_system', 'photo_journal_extra_points', 100);

  PERFORM award_points(NEW.user_id, v_base, '저널 작성', '💧', NULL);

  IF NEW.photo_url IS NOT NULL AND LENGTH(TRIM(NEW.photo_url)) > 0 THEN
    PERFORM award_points(NEW.user_id, v_extra, '사진 저널 추가', '📸', NULL);
  END IF;

  PERFORM public._handle_skin_journal_streak(NEW.user_id, NEW.date);
  PERFORM public.recalc_user_star_levels(NEW.user_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_skin_journals_after_insert ON public.skin_journals;
CREATE TRIGGER on_skin_journals_after_insert
  AFTER INSERT ON public.skin_journals
  FOR EACH ROW EXECUTE FUNCTION public.trg_skin_journals_after_insert();

-- Review insert (product, 게시)
CREATE OR REPLACE FUNCTION public.trg_reviews_after_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_points INTEGER := 0;
BEGIN
  IF NEW.review_type = 'product' AND NEW.status = '게시' THEN
    v_points := public._get_admin_int('star_system', 'review_product_points', 200);
    PERFORM award_points(NEW.author_id, v_points, '후기 작성', '⭐', NULL);
    PERFORM public.recalc_user_star_levels(NEW.author_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_reviews_after_insert_stars ON public.reviews;
CREATE TRIGGER on_reviews_after_insert_stars
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.trg_reviews_after_insert();

-- Like insert (journal likes)
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
    PERFORM award_points(v_author_id, v_points, '공감 받기', '❤️', NULL);

    INSERT INTO public.notifications (user_id, type, title, body, icon, is_read)
    VALUES
      (v_author_id, 'system', '공감이 늘었어요', '공감 +', v_points::TEXT || 'P', '❤️', false);

    PERFORM public.recalc_user_star_levels(v_author_id);

    SELECT COALESCE(total_likes, 0) INTO v_total_likes
    FROM public.users
    WHERE id = v_author_id;

    IF v_total_likes = v_like_notify THEN
      INSERT INTO public.notifications (user_id, type, title, body, icon, is_read)
      VALUES
        (v_author_id, 'system', '공감 10개 달성!', '좋아요 누적 10개를 달성했어요!', '✨', false);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_skin_journal_likes_after_insert ON public.skin_journal_likes;
CREATE TRIGGER on_skin_journal_likes_after_insert
  AFTER INSERT ON public.skin_journal_likes
  FOR EACH ROW EXECUTE FUNCTION public.trg_skin_journal_likes_after_insert();

CREATE OR REPLACE FUNCTION public.trg_skin_journal_likes_after_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_author_id UUID;
BEGIN
  SELECT j.user_id INTO v_author_id
  FROM public.skin_journals j
  WHERE j.id = OLD.journal_id;

  IF v_author_id IS NOT NULL THEN
    PERFORM public.recalc_user_star_levels(v_author_id);
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_skin_journal_likes_after_delete ON public.skin_journal_likes;
CREATE TRIGGER on_skin_journal_likes_after_delete
  AFTER DELETE ON public.skin_journal_likes
  FOR EACH ROW EXECUTE FUNCTION public.trg_skin_journal_likes_after_delete();

-- Like insert (product review likes)
CREATE OR REPLACE FUNCTION public.trg_product_review_likes_after_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_points INTEGER := 0;
  v_like_notify INTEGER := 0;
  v_author_id UUID;
  v_total_likes INTEGER := 0;
BEGIN
  SELECT r.author_id INTO v_author_id
  FROM public.reviews r
  WHERE r.id = NEW.review_id;

  v_points := public._get_admin_int('star_system', 'like_points_per', 10);
  v_like_notify := public._get_admin_int('star_system', 'like_notify_reach', 10);

  IF v_author_id IS NOT NULL THEN
    PERFORM award_points(v_author_id, v_points, '공감 받기', '❤️', NULL);
    PERFORM public.recalc_user_star_levels(v_author_id);

    SELECT COALESCE(total_likes, 0) INTO v_total_likes
    FROM public.users
    WHERE id = v_author_id;

    IF v_total_likes = v_like_notify THEN
      INSERT INTO public.notifications (user_id, type, title, body, icon, is_read)
      VALUES
        (v_author_id, 'system', '공감 10개 달성!', '좋아요 누적 10개를 달성했어요!', '✨', false);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_product_review_likes_after_insert ON public.product_review_likes;
CREATE TRIGGER on_product_review_likes_after_insert
  AFTER INSERT ON public.product_review_likes
  FOR EACH ROW EXECUTE FUNCTION public.trg_product_review_likes_after_insert();

CREATE OR REPLACE FUNCTION public.trg_product_review_likes_after_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_author_id UUID;
BEGIN
  SELECT r.author_id INTO v_author_id
  FROM public.reviews r
  WHERE r.id = OLD.review_id;

  IF v_author_id IS NOT NULL THEN
    PERFORM public.recalc_user_star_levels(v_author_id);
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_product_review_likes_after_delete ON public.product_review_likes;
CREATE TRIGGER on_product_review_likes_after_delete
  AFTER DELETE ON public.product_review_likes
  FOR EACH ROW EXECUTE FUNCTION public.trg_product_review_likes_after_delete();

-- ------------------------------------------------------------
-- Backfill star levels for existing users
-- ------------------------------------------------------------
DO $$
DECLARE rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM public.users LOOP
    PERFORM public.recalc_user_star_levels(rec.id);
  END LOOP;
END
$$;


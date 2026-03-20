-- ============================================================
-- 10. Unified platform settings (admin_settings 통합)
-- ============================================================

-- admin_settings 확장: label/unit/value_type/updated_by
ALTER TABLE public.admin_settings
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS unit TEXT,
  ADD COLUMN IF NOT EXISTS value_type TEXT,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- value_type 기본 보정
UPDATE public.admin_settings
SET value_type = COALESCE(NULLIF(value_type, ''), 'number')
WHERE value_type IS NULL OR value_type = '';

-- -------------------------
-- Seed: points_action
-- -------------------------
INSERT INTO public.admin_settings (category, key, value, label, unit, value_type)
VALUES
  ('points_action', 'journal_write', '50', '저널 작성 포인트', 'P', 'number'),
  ('points_action', 'journal_with_photo', '100', '사진포함 저널 포인트', 'P', 'number'),
  ('points_action', 'review_write', '200', '후기 작성 포인트', 'P', 'number'),
  ('points_action', 'receive_like', '10', '공감 받기 포인트', 'P', 'number'),
  ('points_action', 'get_follower', '30', '팔로워 생길 때 포인트', 'P', 'number'),
  ('points_action', 'share_purchase', '500', '내 링크로 구매 발생 포인트', 'P', 'number'),
  ('points_action', 'streak_7days', '300', '7일 연속 저널 보너스', 'P', 'number'),
  ('points_action', 'streak_30days', '1000', '30일 연속 저널 보너스', 'P', 'number'),
  ('points_action', 'ai_analysis_complete', '500', 'AI 피부분석 완료 포인트', 'P', 'number'),
  ('points_action', 'signup_welcome', '500', '회원가입 환영 포인트', 'P', 'number')
ON CONFLICT (category, key)
DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  unit = EXCLUDED.unit,
  value_type = EXCLUDED.value_type,
  updated_at = NOW();

-- -------------------------
-- Seed: points_payment
-- -------------------------
INSERT INTO public.admin_settings (category, key, value, label, unit, value_type)
VALUES
  ('points_payment', 'wallet_charge_rate', '5', '지갑 충전 적립률', '%', 'number'),
  ('points_payment', 'purchase_reward_rate', '3', '구매 적립률', '%', 'number'),
  ('points_payment', 'review_purchase_bonus', '100', '구매후기 추가 포인트', 'P', 'number')
ON CONFLICT (category, key)
DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  unit = EXCLUDED.unit,
  value_type = EXCLUDED.value_type,
  updated_at = NOW();

-- -------------------------
-- Seed: star_level
-- -------------------------
INSERT INTO public.admin_settings (category, key, value, label, unit, value_type)
VALUES
  ('star_level', 'lv2_journals', '5', '글로우 등급 저널 수', '개', 'number'),
  ('star_level', 'lv2_followers', '10', '글로우 등급 팔로워 수', '명', 'number'),
  ('star_level', 'lv3_journals', '20', '뷰티스타 저널 수', '개', 'number'),
  ('star_level', 'lv3_followers', '50', '뷰티스타 팔로워 수', '명', 'number'),
  ('star_level', 'lv3_reviews', '3', '뷰티스타 후기 수', '개', 'number'),
  ('star_level', 'lv4_journals', '50', '인플루언서 저널 수', '개', 'number'),
  ('star_level', 'lv4_followers', '200', '인플루언서 팔로워 수', '명', 'number'),
  ('star_level', 'lv4_likes', '500', '인플루언서 공감 수', '개', 'number'),
  ('star_level', 'lv5_followers', '500', 'AURAN퀸 팔로워 수', '명', 'number'),
  ('star_level', 'lv5_likes', '2000', 'AURAN퀸 공감 수', '개', 'number'),
  ('star_level', 'lv5_purchase_leads', '50', 'AURAN퀸 구매유도 수', '건', 'number')
ON CONFLICT (category, key)
DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  unit = EXCLUDED.unit,
  value_type = EXCLUDED.value_type,
  updated_at = NOW();

-- -------------------------
-- Seed: star_benefit
-- -------------------------
INSERT INTO public.admin_settings (category, key, value, label, unit, value_type)
VALUES
  ('star_benefit', 'lv2_charge_bonus', '3', '글로우 충전 보너스', '%', 'number'),
  ('star_benefit', 'lv4_revenue_share', '10', '인플루언서 수익쉐어', '%', 'number'),
  ('star_benefit', 'lv5_revenue_share', '20', 'AURAN퀸 수익쉐어', '%', 'number')
ON CONFLICT (category, key)
DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  unit = EXCLUDED.unit,
  value_type = EXCLUDED.value_type,
  updated_at = NOW();

-- -------------------------
-- Seed: referral
-- -------------------------
INSERT INTO public.admin_settings (category, key, value, label, unit, value_type)
VALUES
  ('referral', 'referrer_reward', '3000', '추천인 보상 포인트', 'P', 'number'),
  ('referral', 'referee_reward', '1000', '피추천인 보상 포인트', 'P', 'number'),
  ('referral', 'owner_recruit_reward', '10000', '원장님 추천 보상', 'P', 'number')
ON CONFLICT (category, key)
DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  unit = EXCLUDED.unit,
  value_type = EXCLUDED.value_type,
  updated_at = NOW();

-- ------------------------------------------------------------
-- Helper (기존 함수 재사용)
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
-- Signup welcome points: admin_settings points_action.signup_welcome 우선
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE v_welcome_pts INTEGER;
BEGIN
  v_welcome_pts := public._get_admin_int('points_action', 'signup_welcome', 500);
  PERFORM award_points(NEW.id, v_welcome_pts, '회원가입 환영 포인트', '🎁');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- Referral rewards
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_referral_rewards()
RETURNS TRIGGER AS $$
DECLARE
  v_referrer_reward INTEGER;
  v_referee_reward INTEGER;
  v_owner_recruit_reward INTEGER;
  v_referrer_id UUID;
  v_reward INTEGER;
BEGIN
  IF NEW.referred_by IS NULL THEN
    RETURN NEW;
  END IF;

  v_referrer_id := NEW.referred_by;
  v_referrer_reward := public._get_admin_int('referral', 'referrer_reward', 3000);
  v_referee_reward := public._get_admin_int('referral', 'referee_reward', 1000);
  v_owner_recruit_reward := public._get_admin_int('referral', 'owner_recruit_reward', 10000);

  v_reward := CASE WHEN NEW.role = 'owner' THEN v_owner_recruit_reward ELSE v_referrer_reward END;

  PERFORM award_points(v_referrer_id, v_reward, '추천인 보상', '🎁', NULL);
  PERFORM award_points(NEW.id, v_referee_reward, '피추천인 보상', '🎉', NULL);

  INSERT INTO public.notifications (user_id, type, title, body, icon, is_read)
  VALUES
    (v_referrer_id, 'system', '추천 보상 지급', CONCAT('추천 보상 ', v_reward::TEXT, 'P가 지급되었습니다.'), '🎁', false),
    (NEW.id, 'system', '가입 보상 지급', CONCAT('추천 가입 보상 ', v_referee_reward::TEXT, 'P가 지급되었습니다.'), '🎉', false);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_referral_rewards ON public.users;
CREATE TRIGGER on_user_referral_rewards
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_referral_rewards();

-- ------------------------------------------------------------
-- Star recalc: category/key 통합 반영
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
BEGIN
  SELECT star_level, COALESCE(purchase_leads, 0)
  INTO v_old_level, v_purchase_leads
  FROM public.users
  WHERE id = p_user_id;

  SELECT COUNT(*) INTO v_follower_count FROM public.follows WHERE following_id = p_user_id;
  SELECT COUNT(*) INTO v_journal_count FROM public.skin_journals WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_review_count
  FROM public.reviews r
  WHERE r.author_id = p_user_id
    AND r.review_type = 'product'
    AND r.status = '게시';

  SELECT
    COALESCE(
      (SELECT COUNT(*) FROM public.skin_journal_likes jl JOIN public.skin_journals j ON j.id = jl.journal_id WHERE j.user_id = p_user_id), 0
    )
    +
    COALESCE(
      (SELECT COUNT(*) FROM public.product_review_likes prl JOIN public.reviews r ON r.id = prl.review_id WHERE r.author_id = p_user_id AND r.review_type = 'product' AND r.status = '게시'), 0
    )
  INTO v_like_count;

  IF v_follower_count >= public._get_admin_int('star_level', 'lv5_followers', 500)
     AND v_like_count >= public._get_admin_int('star_level', 'lv5_likes', 2000)
     AND v_purchase_leads >= public._get_admin_int('star_level', 'lv5_purchase_leads', 50)
  THEN
    v_new_level := 5;
  ELSIF v_journal_count >= public._get_admin_int('star_level', 'lv4_journals', 50)
     AND v_follower_count >= public._get_admin_int('star_level', 'lv4_followers', 200)
     AND v_like_count >= public._get_admin_int('star_level', 'lv4_likes', 500)
  THEN
    v_new_level := 4;
  ELSIF v_journal_count >= public._get_admin_int('star_level', 'lv3_journals', 20)
     AND v_follower_count >= public._get_admin_int('star_level', 'lv3_followers', 50)
     AND v_review_count >= public._get_admin_int('star_level', 'lv3_reviews', 3)
  THEN
    v_new_level := 3;
  ELSIF v_journal_count >= public._get_admin_int('star_level', 'lv2_journals', 5)
     AND v_follower_count >= public._get_admin_int('star_level', 'lv2_followers', 10)
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

  IF v_new_level > COALESCE(v_old_level, 1) THEN
    INSERT INTO public.notifications (user_id, type, title, body, icon, is_read)
    VALUES (p_user_id, 'system', '스타 등급 업!', CONCAT('축하합니다. 스타 ', v_new_level::TEXT, '에 도달했어요!'), '🏅', false);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- Streak + points_action
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
    v_new_streak := v_prev_streak;
  ELSE
    v_new_streak := 1;
  END IF;

  v_notify_at := public._get_admin_int('star_system', 'streak_notify_at', 5);
  v_streak_7_bonus := public._get_admin_int('points_action', 'streak_7days', 300);
  v_streak_30_bonus := public._get_admin_int('points_action', 'streak_30days', 1000);

  INSERT INTO public.activity_streaks (user_id, current_streak, last_journal_date, updated_at)
  VALUES (p_user_id, v_new_streak, p_journal_date, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET current_streak = EXCLUDED.current_streak, last_journal_date = EXCLUDED.last_journal_date, updated_at = NOW();

  IF v_new_streak = v_notify_at THEN
    INSERT INTO public.notifications (user_id, type, title, body, icon, is_read)
    VALUES (p_user_id, 'system', '연속 저널 달성', CONCAT(v_notify_at::TEXT, '일 연속으로 저널을 작성했어요!'), '🔥', false);
  END IF;

  IF v_new_streak = public._get_admin_int('star_system', 'streak_7_days', 7) THEN
    PERFORM award_points(p_user_id, v_streak_7_bonus, '연속 저널 보너스', '🔥', NULL);
  ELSIF v_new_streak = public._get_admin_int('star_system', 'streak_30_days', 30) THEN
    PERFORM award_points(p_user_id, v_streak_30_bonus, '연속 저널 보너스', '🏆', NULL);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- Trigger functions remap to points_action
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_follows_after_insert()
RETURNS TRIGGER AS $$
DECLARE v_points INTEGER := 0;
BEGIN
  v_points := public._get_admin_int('points_action', 'get_follower', 30);
  PERFORM award_points(NEW.following_id, v_points, '팔로워 생김', '👤', NULL);
  INSERT INTO public.notifications (user_id, type, title, body, icon, is_read)
  VALUES (NEW.following_id, 'system', '새 팔로워!', CONCAT('새로운 팔로워가 생겼어요. +', v_points::TEXT, 'P'), '✨', false);
  PERFORM public.recalc_user_star_levels(NEW.following_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.trg_skin_journals_after_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_base INTEGER := 0;
  v_extra INTEGER := 0;
BEGIN
  v_base := public._get_admin_int('points_action', 'journal_write', 50);
  v_extra := public._get_admin_int('points_action', 'journal_with_photo', 100);
  PERFORM award_points(NEW.user_id, v_base, '저널 작성', '💧', NULL);
  IF NEW.photo_url IS NOT NULL AND LENGTH(TRIM(NEW.photo_url)) > 0 THEN
    PERFORM award_points(NEW.user_id, v_extra, '사진 저널 추가', '📸', NULL);
  END IF;
  PERFORM public._handle_skin_journal_streak(NEW.user_id, NEW.date);
  PERFORM public.recalc_user_star_levels(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.trg_reviews_after_insert()
RETURNS TRIGGER AS $$
DECLARE v_points INTEGER := 0;
BEGIN
  IF NEW.review_type = 'product' AND NEW.status = '게시' THEN
    v_points := public._get_admin_int('points_action', 'review_write', 200);
    PERFORM award_points(NEW.author_id, v_points, '후기 작성', '⭐', NULL);
    PERFORM public.recalc_user_star_levels(NEW.author_id);
  END IF;
  RETURN NEW;
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
  SELECT j.user_id INTO v_author_id FROM public.skin_journals j WHERE j.id = NEW.journal_id;
  v_points := public._get_admin_int('points_action', 'receive_like', 10);
  v_like_notify := public._get_admin_int('star_system', 'like_notify_reach', 10);
  IF v_author_id IS NOT NULL THEN
    PERFORM award_points(v_author_id, v_points, '공감 받기', '❤️', NULL);
    PERFORM public.recalc_user_star_levels(v_author_id);
    SELECT COALESCE(total_likes, 0) INTO v_total_likes FROM public.users WHERE id = v_author_id;
    IF v_total_likes = v_like_notify THEN
      INSERT INTO public.notifications (user_id, type, title, body, icon, is_read)
      VALUES (v_author_id, 'system', '공감 10개 달성!', '좋아요 누적 10개를 달성했어요!', '✨', false);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.trg_product_review_likes_after_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_points INTEGER := 0;
  v_like_notify INTEGER := 0;
  v_author_id UUID;
  v_total_likes INTEGER := 0;
BEGIN
  SELECT r.author_id INTO v_author_id FROM public.reviews r WHERE r.id = NEW.review_id;
  v_points := public._get_admin_int('points_action', 'receive_like', 10);
  v_like_notify := public._get_admin_int('star_system', 'like_notify_reach', 10);
  IF v_author_id IS NOT NULL THEN
    PERFORM award_points(v_author_id, v_points, '공감 받기', '❤️', NULL);
    PERFORM public.recalc_user_star_levels(v_author_id);
    SELECT COALESCE(total_likes, 0) INTO v_total_likes FROM public.users WHERE id = v_author_id;
    IF v_total_likes = v_like_notify THEN
      INSERT INTO public.notifications (user_id, type, title, body, icon, is_read)
      VALUES (v_author_id, 'system', '공감 10개 달성!', '좋아요 누적 10개를 달성했어요!', '✨', false);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


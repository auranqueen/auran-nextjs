-- 가입 시 public.users 프로필 생성 직후 웰컴 쿠폰 자동 지급 + 알림 (auth.users id = user_coupons.user_id)
-- issue_trigger=signup 또는 코드/이름에 웰컴 템플릿 1건 선택

CREATE OR REPLACE FUNCTION public.issue_welcome_coupon_after_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon_id uuid;
  v_uc_id uuid;
BEGIN
  IF NEW.auth_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM 'customer' THEN
    RETURN NEW;
  END IF;

  SELECT c.id
  INTO v_coupon_id
  FROM public.coupons c
  WHERE c.is_active = true
    AND (
      c.issue_trigger = 'signup'
      OR c.code ILIKE '%WELCOME%'
      OR c.name ILIKE '%웰컴%'
    )
  ORDER BY c.created_at ASC NULLS LAST
  LIMIT 1;

  IF v_coupon_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_coupons (user_id, coupon_id, status, issued_at, expired_at)
  VALUES (NEW.auth_id, v_coupon_id, 'unused', now(), now() + interval '30 days')
  ON CONFLICT (user_id, coupon_id) DO NOTHING
  RETURNING id INTO v_uc_id;

  IF v_uc_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, icon, is_read, link)
    VALUES (
      NEW.id,
      'coupon_issued',
      '🎁 웰컴 쿠폰이 도착했어요!',
      'AURAN에 오신 것을 환영해요! 쿠폰함을 확인해보세요 ✨',
      '🎁',
      false,
      '/my/coupons'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_issue_welcome_coupon_user_profile ON public.users;
CREATE TRIGGER tr_issue_welcome_coupon_user_profile
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.issue_welcome_coupon_after_user_profile();

-- Referral reward redesign (072)
-- handle_referral_rewards() 재정의 — 010 원본 파일은 수정하지 않고 여기서 덮어씀
-- 정책: customer 추천인만 가입 시 locked 1000T 예약, 피추천인 즉시 보상·owner 모집 보상 제거
-- 전제: 071 적용 완료 (toast_transactions.status 컬럼)

CREATE OR REPLACE FUNCTION public.handle_referral_rewards()
RETURNS TRIGGER AS $$
DECLARE
  v_referrer_id UUID;
  v_referrer_role TEXT;
BEGIN
  -- 1. referred_by 없으면 종료
  IF NEW.referred_by IS NULL THEN
    RETURN NEW;
  END IF;

  v_referrer_id := NEW.referred_by;

  -- 2. 추천인 role 조회
  SELECT role INTO v_referrer_role
  FROM public.users
  WHERE id = v_referrer_id;

  -- 3. 추천인이 customer가 아니면 보상 없이 종료
  IF v_referrer_role IS NULL OR v_referrer_role <> 'customer' THEN
    RETURN NEW;
  END IF;

  -- 4. customer 추천인: locked 1000T 예약 (포인트 P 지급 없음)
  INSERT INTO public.toast_transactions (
    user_id,
    amount,
    transaction_type,
    source_type,
    reference_id,
    status
  )
  VALUES (
    v_referrer_id,
    1000,
    'referral',
    'referral_reward_locked',
    NEW.id,
    'locked'
  );

  INSERT INTO public.notifications (user_id, type, title, body, icon, is_read)
  VALUES (
    v_referrer_id,
    'system',
    '친구가 가입했어요 💜',
    '내 추천으로 친구가 가입했어요! 첫 구매하면 1000T가 풀려요 💜',
    '🎁',
    false
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_referral_rewards ON public.users;
CREATE TRIGGER on_user_referral_rewards
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_referral_rewards();

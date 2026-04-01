-- 구매확정/반품 회수/부채 상환 지원

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_confirm_at timestamptz,
  ADD COLUMN IF NOT EXISTS referrer_user_id uuid,
  ADD COLUMN IF NOT EXISTS share_toast_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_toast_amount integer NOT NULL DEFAULT 0;

ALTER TABLE public.point_transactions
  ADD COLUMN IF NOT EXISTS order_id uuid,
  ADD COLUMN IF NOT EXISTS status text;

CREATE TABLE IF NOT EXISTS public.point_debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  cleared_amount integer NOT NULL DEFAULT 0 CHECK (cleared_amount >= 0),
  reason text NOT NULL DEFAULT '반품 토스트 부채',
  order_id uuid,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_point_debts_user_status ON public.point_debts(user_id, status, created_at DESC);

INSERT INTO public.admin_settings(category, key, value)
VALUES ('order', 'auto_confirm_days', '7')
ON CONFLICT (category, key) DO NOTHING;

CREATE OR REPLACE FUNCTION public._reclaim_with_debt(
  p_auth_id uuid,
  p_amount integer,
  p_reason text,
  p_order_id uuid
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid;
  v_points int := 0;
  v_take int := 0;
  v_need int := 0;
BEGIN
  IF p_auth_id IS NULL OR p_amount <= 0 THEN
    RETURN;
  END IF;

  SELECT id, COALESCE(points, 0) INTO v_user_id, v_points
  FROM public.users
  WHERE auth_id = p_auth_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  v_take := LEAST(v_points, p_amount);
  v_need := GREATEST(p_amount - v_take, 0);

  IF v_take > 0 THEN
    UPDATE public.users
    SET points = COALESCE(points, 0) - v_take
    WHERE id = v_user_id;

    BEGIN
      INSERT INTO public.point_transactions(user_id, amount, type, description, order_id, status)
      VALUES (p_auth_id, -v_take, 'refund_deduct', p_reason, p_order_id, 'confirmed');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.point_transactions(user_id, amount, type, description)
      VALUES (p_auth_id, -v_take, 'refund_deduct', p_reason);
    END;
  END IF;

  IF v_need > 0 THEN
    INSERT INTO public.point_debts(user_id, amount, reason, order_id, status, expires_at)
    VALUES (p_auth_id, v_need, p_reason, p_order_id, 'pending', now() + interval '1 year');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_orders_refund_debt()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_purchase int := 0;
  v_share int := 0;
  v_user_id uuid;
  v_ref_id uuid;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> '반품확정' OR OLD.status = '반품확정' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_purchase
  FROM public.point_transactions
  WHERE user_id = NEW.customer_id
    AND type = 'purchase_confirm'
    AND (order_id = NEW.id OR order_id IS NULL);

  IF v_purchase > 0 THEN
    PERFORM public._reclaim_with_debt(NEW.customer_id, v_purchase, '반품 토스트 회수', NEW.id);
    SELECT id INTO v_user_id FROM public.users WHERE auth_id = NEW.customer_id LIMIT 1;
    IF v_user_id IS NOT NULL THEN
      BEGIN
        INSERT INTO public.notifications(user_id, type, title, body, icon, is_read)
        VALUES (v_user_id, 'promo', '반품 처리됐어요', '적립 토스트가 회수됐어요', '⚠️', false);
      EXCEPTION WHEN OTHERS THEN
      END;
    END IF;
  END IF;

  IF COALESCE(NEW.share_toast_paid, false) THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_share
    FROM public.point_transactions
    WHERE user_id = NEW.referrer_user_id
      AND type = 'share_reward'
      AND (order_id = NEW.id OR order_id IS NULL);

    IF v_share > 0 AND NEW.referrer_user_id IS NOT NULL THEN
      PERFORM public._reclaim_with_debt(NEW.referrer_user_id, v_share, '반품 추천 보상 회수', NEW.id);
      SELECT id INTO v_ref_id FROM public.users WHERE auth_id = NEW.referrer_user_id LIMIT 1;
      IF v_ref_id IS NOT NULL THEN
        BEGIN
          INSERT INTO public.notifications(user_id, type, title, body, icon, is_read)
          VALUES (v_ref_id, 'promo', '반품이 발생했어요 😢', '추천 보상 토스트가 회수됐어요', '⚠️', false);
        EXCEPTION WHEN OTHERS THEN
        END;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_refund_debt ON public.orders;
CREATE TRIGGER trg_orders_refund_debt
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_orders_refund_debt();

CREATE OR REPLACE FUNCTION public.trg_point_debt_auto_repay()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_debt record;
  v_room int;
  v_take int;
  v_user_id uuid;
BEGIN
  IF NEW.amount <= 0 THEN
    RETURN NEW;
  END IF;

  v_room := NEW.amount;
  FOR v_debt IN
    SELECT id, amount, cleared_amount
    FROM public.point_debts
    WHERE user_id = NEW.user_id
      AND status = 'pending'
    ORDER BY created_at ASC
  LOOP
    EXIT WHEN v_room <= 0;
    v_take := LEAST(v_room, GREATEST(v_debt.amount - COALESCE(v_debt.cleared_amount, 0), 0));
    IF v_take <= 0 THEN
      CONTINUE;
    END IF;

    UPDATE public.point_debts
    SET
      cleared_amount = COALESCE(cleared_amount, 0) + v_take,
      status = CASE WHEN COALESCE(cleared_amount, 0) + v_take >= amount THEN 'cleared' ELSE 'pending' END,
      updated_at = now()
    WHERE id = v_debt.id;

    BEGIN
      INSERT INTO public.point_transactions(user_id, amount, type, description, order_id, status)
      VALUES (NEW.user_id, -v_take, 'debt_repayment', '반품 부채 상환', NEW.order_id, 'confirmed');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.point_transactions(user_id, amount, type, description)
      VALUES (NEW.user_id, -v_take, 'debt_repayment', '반품 부채 상환');
    END;

    v_room := v_room - v_take;

    IF COALESCE(v_debt.cleared_amount, 0) + v_take >= v_debt.amount THEN
      SELECT id INTO v_user_id FROM public.users WHERE auth_id = NEW.user_id LIMIT 1;
      IF v_user_id IS NOT NULL THEN
        BEGIN
          INSERT INTO public.notifications(user_id, type, title, body, icon, is_read)
          VALUES (v_user_id, 'promo', '반품 부채가 모두 상환됐어요 💜', '다음 적립금에서 자동 차감이 완료됐어요', '💜', false);
        EXCEPTION WHEN OTHERS THEN
        END;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_point_debt_auto_repay ON public.point_transactions;
CREATE TRIGGER trg_point_debt_auto_repay
AFTER INSERT ON public.point_transactions
FOR EACH ROW
EXECUTE FUNCTION public.trg_point_debt_auto_repay();

-- cs_requests 상태 전환 알림 + 반품 시 커미션 조정

CREATE OR REPLACE FUNCTION public.trg_cs_requests_notify_and_adjust()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_order record;
  v_customer_user_id uuid;
  v_owner_auth uuid;
  v_owner_user_id uuid;
  v_partner_user_id uuid;
  v_customer_name text;
  v_cs_type text;
  v_body text;
  v_cnt int := 0;
  v_admin record;
BEGIN
  v_cs_type := COALESCE(to_jsonb(NEW)->>'type', to_jsonb(NEW)->>'cs_type', 'CS');

  SELECT id, customer_id, owner_id, referrer_user_id, owner_commission
  INTO v_order
  FROM public.orders
  WHERE id = NEW.order_id
  LIMIT 1;

  IF v_order.id IS NOT NULL THEN
    SELECT id, COALESCE(NULLIF(TRIM(name), ''), '고객') INTO v_customer_user_id, v_customer_name
    FROM public.users
    WHERE auth_id = v_order.customer_id
    LIMIT 1;
  ELSE
    v_customer_name := '고객';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_customer_user_id IS NOT NULL THEN
      BEGIN
        INSERT INTO public.notifications(user_id, type, title, body, icon, is_read)
        VALUES (v_customer_user_id, 'promo', 'CS 접수됐어요 💜', v_cs_type || ' 요청이 접수됐어요' || E'\n' || '영업일 1~2일 내 처리해드려요', '💜', false);
      EXCEPTION WHEN OTHERS THEN
      END;
    END IF;

    IF v_order.owner_id IS NOT NULL THEN
      SELECT id INTO v_owner_user_id FROM public.users WHERE id = v_order.owner_id LIMIT 1;
      IF v_owner_user_id IS NOT NULL THEN
        BEGIN
          INSERT INTO public.notifications(user_id, type, title, body, icon, is_read)
          VALUES (v_owner_user_id, 'promo', '고객 CS 접수 알림 📋', v_customer_name || '님이 ' || v_cs_type || ' 신청했어요', '📋', false);
        EXCEPTION WHEN OTHERS THEN
        END;
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.status, '') <> COALESCE(NEW.status, '') THEN
    IF v_customer_user_id IS NOT NULL THEN
      v_body := CASE
        WHEN NEW.status = 'approved' THEN '처리 시작됐어요 💜' || E'\n' || '진행상황은 마이페이지에서 확인하세요'
        WHEN NEW.status = 'pickup_completed' THEN '상품 수령했어요' || E'\n' || '환불/재발송 처리 시작해요'
        WHEN NEW.status = 'completed' THEN '처리가 완료됐어요' || E'\n' || '궁금한 점은 고객센터로 문의해주세요'
        ELSE NULL
      END;
      IF v_body IS NOT NULL THEN
        BEGIN
          INSERT INTO public.notifications(user_id, type, title, body, icon, is_read)
          VALUES (
            v_customer_user_id,
            'promo',
            CASE
              WHEN NEW.status = 'approved' THEN 'CS 승인됐어요 ✅'
              WHEN NEW.status = 'pickup_completed' THEN '회수 확인됐어요 📦'
              ELSE 'CS 처리 완료됐어요 💜'
            END,
            v_body,
            '📋',
            false
          );
        EXCEPTION WHEN OTHERS THEN
        END;
      END IF;
    END IF;

    IF v_cs_type LIKE '%반품%' AND NEW.status IN ('approved', 'completed') AND v_order.owner_id IS NOT NULL THEN
      SELECT auth_id, id INTO v_owner_auth, v_owner_user_id FROM public.users WHERE id = v_order.owner_id LIMIT 1;
      IF v_owner_auth IS NOT NULL AND COALESCE(v_order.owner_commission, 0) > 0 THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.point_transactions
          WHERE user_id = v_owner_auth
            AND type = 'commission_cancel'
            AND order_id = NEW.order_id
          LIMIT 1
        ) THEN
          BEGIN
            INSERT INTO public.point_transactions(user_id, amount, type, description, order_id, status)
            VALUES (v_owner_auth, -ABS(COALESCE(v_order.owner_commission, 0)::int), 'commission_cancel', '반품으로 인한 커미션 취소', NEW.order_id, 'confirmed');
          EXCEPTION WHEN OTHERS THEN
            INSERT INTO public.point_transactions(user_id, amount, type, description)
            VALUES (v_owner_auth, -ABS(COALESCE(v_order.owner_commission, 0)::int), 'commission_cancel', '반품으로 인한 커미션 취소');
          END;
          IF v_owner_user_id IS NOT NULL THEN
            BEGIN
              INSERT INTO public.notifications(user_id, type, title, body, icon, is_read)
              VALUES (v_owner_user_id, 'promo', '고객 반품 발생 📋', v_customer_name || '님 반품 접수됐어요 · 커미션 ' || ABS(COALESCE(v_order.owner_commission, 0)::int)::text || 'T 조정됐어요', '📋', false);
            EXCEPTION WHEN OTHERS THEN
            END;
          END IF;
        END IF;
      END IF;
    END IF;

    IF v_cs_type LIKE '%반품%' AND NEW.status IN ('approved', 'completed') AND v_order.referrer_user_id IS NOT NULL THEN
      SELECT id INTO v_partner_user_id FROM public.users WHERE auth_id = v_order.referrer_user_id LIMIT 1;
      IF v_partner_user_id IS NOT NULL THEN
        BEGIN
          INSERT INTO public.notifications(user_id, type, title, body, icon, is_read)
          VALUES (v_partner_user_id, 'promo', '추천 고객 반품 알림 😢', v_customer_name || '님 반품으로' || E'\n' || '공유토스트 회수 예정이에요', '😢', false);
        EXCEPTION WHEN OTHERS THEN
        END;
      END IF;
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_cnt
  FROM public.cs_requests
  WHERE status = 'pending'
    AND created_at < (now() - interval '48 hours');

  IF v_cnt > 0 THEN
    FOR v_admin IN
      SELECT id FROM public.users WHERE role IN ('admin', 'master')
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE user_id = v_admin.id
          AND title = '⚠️ CS 미처리 경고'
          AND body = (v_cnt::text || '건이 48시간 초과됐어요' || E'\n' || '지금 바로 처리해주세요')
          AND created_at::date = now()::date
        LIMIT 1
      ) THEN
        BEGIN
          INSERT INTO public.notifications(user_id, type, title, body, icon, is_read)
          VALUES (v_admin.id, 'promo', '⚠️ CS 미처리 경고', v_cnt::text || '건이 48시간 초과됐어요' || E'\n' || '지금 바로 처리해주세요', '⚠️', false);
        EXCEPTION WHEN OTHERS THEN
        END;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cs_requests_notify_and_adjust ON public.cs_requests;
CREATE TRIGGER trg_cs_requests_notify_and_adjust
AFTER INSERT OR UPDATE ON public.cs_requests
FOR EACH ROW
EXECUTE FUNCTION public.trg_cs_requests_notify_and_adjust();

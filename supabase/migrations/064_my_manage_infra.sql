-- 064: 내관리 인프라 — bookings RLS, owner_customers, skin_cycle RLS, complete_service RPC

-- 1. current_user_id() 헬퍼 함수
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- 2. bookings updated_at 컬럼 + 트리거
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS bookings_updated_at ON public.bookings;
CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. bookings RLS 정책 추가
DROP POLICY IF EXISTS bookings_customer_select ON public.bookings;
DROP POLICY IF EXISTS bookings_customer_insert ON public.bookings;
DROP POLICY IF EXISTS bookings_customer_update ON public.bookings;
DROP POLICY IF EXISTS bookings_owner_select ON public.bookings;
DROP POLICY IF EXISTS bookings_owner_update ON public.bookings;
DROP POLICY IF EXISTS bookings_admin_all ON public.bookings;

CREATE POLICY bookings_customer_select ON public.bookings
  FOR SELECT USING (
    customer_id = public.current_user_id()
  );

CREATE POLICY bookings_customer_insert ON public.bookings
  FOR INSERT WITH CHECK (
    customer_id = public.current_user_id()
  );

CREATE POLICY bookings_customer_update ON public.bookings
  FOR UPDATE USING (
    customer_id = public.current_user_id()
  );

CREATE POLICY bookings_owner_select ON public.bookings
  FOR SELECT USING (
    owner_id = public.current_user_id()
    OR salon_id IN (
      SELECT id FROM public.salons WHERE owner_id = public.current_user_id()
    )
  );

CREATE POLICY bookings_owner_update ON public.bookings
  FOR UPDATE USING (
    owner_id = public.current_user_id()
    OR salon_id IN (
      SELECT id FROM public.salons WHERE owner_id = public.current_user_id()
    )
  );

CREATE POLICY bookings_admin_all ON public.bookings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid() AND u.role = 'admin'
    )
  );

-- 4. body_care_cards RLS 분리 (기존 ALL true 제거)
DROP POLICY IF EXISTS "body_care_cards_all" ON public.body_care_cards;
DROP POLICY IF EXISTS body_care_cards_read ON public.body_care_cards;
DROP POLICY IF EXISTS body_care_cards_write ON public.body_care_cards;

CREATE POLICY body_care_cards_read ON public.body_care_cards
  FOR SELECT USING (is_active = true);

CREATE POLICY body_care_cards_write ON public.body_care_cards
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.role IN ('admin', 'owner')
    )
  );

-- 5. owner_customers 테이블 신규
CREATE TABLE IF NOT EXISTS public.owner_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  salon_id UUID REFERENCES public.salons(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  first_visit_at TIMESTAMPTZ DEFAULT NOW(),
  last_visit_at TIMESTAMPTZ,
  visit_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, customer_id, salon_id)
);

CREATE INDEX IF NOT EXISTS idx_owner_customers_owner
  ON public.owner_customers(owner_id);

CREATE INDEX IF NOT EXISTS idx_owner_customers_customer
  ON public.owner_customers(customer_id);

ALTER TABLE public.owner_customers ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS owner_customers_updated_at ON public.owner_customers;
CREATE TRIGGER owner_customers_updated_at
  BEFORE UPDATE ON public.owner_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP POLICY IF EXISTS owner_customers_owner_all ON public.owner_customers;
DROP POLICY IF EXISTS owner_customers_customer_read ON public.owner_customers;
DROP POLICY IF EXISTS owner_customers_admin_all ON public.owner_customers;

CREATE POLICY owner_customers_owner_all ON public.owner_customers
  FOR ALL USING (
    owner_id = public.current_user_id()
  )
  WITH CHECK (
    owner_id = public.current_user_id()
  );

CREATE POLICY owner_customers_customer_read ON public.owner_customers
  FOR SELECT USING (
    customer_id = public.current_user_id()
  );

CREATE POLICY owner_customers_admin_all ON public.owner_customers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid() AND u.role = 'admin'
    )
  );

-- 6. skin_cycle_analysis · skin_cycle_daily CREATE IF NOT EXISTS + RLS
CREATE TABLE IF NOT EXISTS public.skin_cycle_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID NOT NULL,
  record_date DATE NOT NULL,
  cycle_day INTEGER,
  hormone_stage TEXT,
  checkin_condition TEXT,
  recommended_products JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(auth_id, record_date)
);

CREATE TABLE IF NOT EXISTS public.skin_cycle_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID NOT NULL,
  record_date DATE NOT NULL,
  note TEXT,
  routine_completed BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(auth_id, record_date)
);

ALTER TABLE public.skin_cycle_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skin_cycle_daily ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY skin_cycle_analysis_own ON public.skin_cycle_analysis
    FOR ALL USING (auth.uid() = auth_id) WITH CHECK (auth.uid() = auth_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY skin_cycle_daily_own ON public.skin_cycle_daily
    FOR ALL USING (auth.uid() = auth_id) WITH CHECK (auth.uid() = auth_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 7. user_coupons updated_at 추가
ALTER TABLE public.user_coupons
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS user_coupons_updated_at ON public.user_coupons;
CREATE TRIGGER user_coupons_updated_at
  BEFORE UPDATE ON public.user_coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 8. complete_service RPC 함수
CREATE OR REPLACE FUNCTION public.complete_service(
  p_booking_id UUID,
  p_user_coupon_id UUID DEFAULT NULL,
  p_care_card JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_owner_user_id UUID;
  v_customer_user_id UUID;
  v_customer_notif_id UUID;
  v_care_card_id UUID;
BEGIN
  v_owner_user_id := public.current_user_id();
  IF v_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking not found';
  END IF;

  IF v_booking.owner_id IS DISTINCT FROM v_owner_user_id
     AND NOT EXISTS (
       SELECT 1 FROM public.salons
       WHERE id = v_booking.salon_id
         AND owner_id = v_owner_user_id
     ) THEN
    RAISE EXCEPTION 'not your booking';
  END IF;

  v_customer_user_id := v_booking.customer_id;

  UPDATE public.bookings
  SET status = '완료', updated_at = NOW()
  WHERE id = p_booking_id;

  IF p_user_coupon_id IS NOT NULL THEN
    UPDATE public.user_coupons
    SET status = 'used', used_at = NOW(), updated_at = NOW()
    WHERE id = p_user_coupon_id
      AND user_id = (
        SELECT auth_id FROM public.users WHERE id = v_customer_user_id LIMIT 1
      );
  END IF;

  IF p_care_card IS NOT NULL THEN
    INSERT INTO public.body_care_cards (
      title, care, quote, phase_tags, category_tags,
      is_active, sort_order
    ) VALUES (
      COALESCE(p_care_card->>'title', '시술 완료'),
      COALESCE(p_care_card->>'care', ''),
      COALESCE(p_care_card->>'quote', ''),
      COALESCE(
        ARRAY(
          SELECT jsonb_array_elements_text(COALESCE(p_care_card->'phase_tags', '[]'::jsonb))
        ),
        ARRAY[]::text[]
      ),
      COALESCE(
        ARRAY(
          SELECT jsonb_array_elements_text(COALESCE(p_care_card->'category_tags', '[]'::jsonb))
        ),
        ARRAY[]::text[]
      ),
      true,
      0
    ) RETURNING id INTO v_care_card_id;
  END IF;

  INSERT INTO public.owner_customers (
    owner_id, customer_id, salon_id,
    last_visit_at, visit_count
  ) VALUES (
    v_owner_user_id, v_customer_user_id, v_booking.salon_id,
    NOW(), 1
  )
  ON CONFLICT (owner_id, customer_id, salon_id)
  DO UPDATE SET
    last_visit_at = NOW(),
    visit_count = owner_customers.visit_count + 1,
    updated_at = NOW();

  INSERT INTO public.notifications (
    user_id, type, title, body, link, is_read
  ) VALUES (
    v_customer_user_id,
    'reservation',
    '시술이 완료되었어요 💜',
    v_booking.service_name || ' 케어카드를 확인해보세요.',
    '/my/manage',
    false
  ) RETURNING id INTO v_customer_notif_id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'care_card_id', v_care_card_id,
    'notification_id', v_customer_notif_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_service(UUID, UUID, JSONB) TO authenticated;

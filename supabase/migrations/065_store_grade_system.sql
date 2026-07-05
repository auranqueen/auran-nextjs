-- 065: 스토어 등급 5단계(enum v2) + 자동 계산 함수 + 양방향 트리거 + salons RLS

-- 1) enum 교체
CREATE TYPE public.store_grade_v2 AS ENUM ('debut', 'essor', 'prestige', 'couronne', 'empire');

ALTER TYPE public.store_grade RENAME TO old_store_grade_unused;

ALTER TABLE public.users
  ALTER COLUMN store_grade DROP DEFAULT;

ALTER TABLE public.users
  ALTER COLUMN store_grade TYPE public.store_grade_v2
  USING 'debut'::public.store_grade_v2;

ALTER TABLE public.users
  ALTER COLUMN store_grade SET DEFAULT 'debut'::public.store_grade_v2;

-- 2) 등급 계산 함수
CREATE OR REPLACE FUNCTION public.calculate_store_grade(p_salon_id UUID)
RETURNS public.store_grade_v2
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_monthly_sales INTEGER := 0;
  v_review_count INTEGER := 0;
  v_avg_rating NUMERIC := 0;
  v_total_orders INTEGER := 0;
  v_sales_score NUMERIC := 0;
  v_rating_score NUMERIC := 0;
  v_review_score NUMERIC := 0;
  v_order_score NUMERIC := 0;
  v_total_score NUMERIC := 0;
BEGIN
  SELECT
    COALESCE(s.monthly_sales, 0),
    COALESCE(s.review_count, 0),
    COALESCE(s.avg_rating, 0),
    COALESCE(u.total_orders, 0)
  INTO v_monthly_sales, v_review_count, v_avg_rating, v_total_orders
  FROM public.salons s
  LEFT JOIN public.users u ON u.id = s.owner_id
  WHERE s.id = p_salon_id;

  IF NOT FOUND THEN
    RETURN 'debut'::public.store_grade_v2;
  END IF;

  v_sales_score := LEAST(COALESCE(v_monthly_sales, 0)::numeric / 3000000 * 100, 100) * 0.35;
  v_rating_score := (COALESCE(v_avg_rating, 0)::numeric / 5.0 * 100) * 0.25;
  v_review_score := LEAST(COALESCE(v_review_count, 0)::numeric / 50 * 100, 100) * 0.20;
  v_order_score := LEAST(COALESCE(v_total_orders, 0)::numeric / 30 * 100, 100) * 0.20;
  v_total_score := v_sales_score + v_rating_score + v_review_score + v_order_score;

  RETURN CASE
    WHEN v_total_score <= 20 THEN 'debut'::public.store_grade_v2
    WHEN v_total_score <= 40 THEN 'essor'::public.store_grade_v2
    WHEN v_total_score <= 60 THEN 'prestige'::public.store_grade_v2
    WHEN v_total_score <= 80 THEN 'couronne'::public.store_grade_v2
    ELSE 'empire'::public.store_grade_v2
  END;
END;
$$;

-- store_grade 자동 갱신 시에만 users.store_grade UPDATE 허용 (수동 편집 차단)
CREATE OR REPLACE FUNCTION public.guard_store_grade_manual_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.store_grade IS DISTINCT FROM OLD.store_grade
     AND COALESCE(current_setting('app.store_grade_auto', true), '') <> '1' THEN
    NEW.store_grade := OLD.store_grade;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_store_grade_manual_edit ON public.users;
CREATE TRIGGER trg_guard_store_grade_manual_edit
  BEFORE UPDATE OF store_grade ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_store_grade_manual_edit();

-- 3-a) salons 변경 → users.store_grade 갱신
CREATE OR REPLACE FUNCTION public.trg_auto_update_store_grade_salons_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_grade public.store_grade_v2;
BEGIN
  IF NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_new_grade := public.calculate_store_grade(NEW.id);

  PERFORM set_config('app.store_grade_auto', '1', true);

  UPDATE public.users
  SET store_grade = v_new_grade
  WHERE id = NEW.owner_id
    AND store_grade IS DISTINCT FROM v_new_grade;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_update_store_grade_salons ON public.salons;
CREATE TRIGGER trg_auto_update_store_grade_salons
  AFTER UPDATE OF review_count, avg_rating, monthly_sales ON public.salons
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auto_update_store_grade_salons_fn();

-- 3-b) users.total_orders 변경 → salon 기준 store_grade 재계산
CREATE OR REPLACE FUNCTION public.trg_auto_update_store_grade_orders_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_salon_id UUID;
  v_new_grade public.store_grade_v2;
BEGIN
  SELECT s.id
  INTO v_salon_id
  FROM public.salons s
  WHERE s.owner_id = NEW.id
  LIMIT 1;

  IF v_salon_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_new_grade := public.calculate_store_grade(v_salon_id);

  IF v_new_grade IS DISTINCT FROM NEW.store_grade THEN
    PERFORM set_config('app.store_grade_auto', '1', true);

    UPDATE public.users
    SET store_grade = v_new_grade
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_update_store_grade_orders ON public.users;
CREATE TRIGGER trg_auto_update_store_grade_orders
  AFTER UPDATE OF total_orders ON public.users
  FOR EACH ROW
  WHEN (NEW.total_orders IS DISTINCT FROM OLD.total_orders)
  EXECUTE FUNCTION public.trg_auto_update_store_grade_orders_fn();

-- 4) salons RLS
ALTER TABLE public.salons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS salons_select_all ON public.salons;
CREATE POLICY salons_select_all ON public.salons
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS salons_update_own ON public.salons;
CREATE POLICY salons_update_own ON public.salons
  FOR UPDATE
  USING (owner_id = public.current_user_id())
  WITH CHECK (owner_id = public.current_user_id());

-- users.store_grade: users_own 정책(FOR ALL, auth_id=auth.uid())으로 본인 SELECT 가능.
-- store_grade 직접 수정은 trg_guard_store_grade_manual_edit가 차단, 자동 갱신은 SECURITY DEFINER + session flag로 허용.

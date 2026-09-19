-- 203_orders_rls_rebuild.sql
-- 이 마이그레이션은 이미 운영 DB에 SQL Editor로 직접 실행되어 반영된 상태를
-- 레포에 기록하기 위한 것임. 재실행해도 안전하도록 DROP IF EXISTS + CREATE 순서.
-- 실행 불필요. (197~202와 동일: 운영 스키마와 git 기록을 맞추는 문서화)
--
-- 1차: 원장/파트너 SELECT 신설, "결제완료 페이지 주문조회"(qual:true) 제거.
-- 긴급후속: orders_own / admin_all_orders 는 001에 정의만 있고 운영에 없던 누락을 보완.
-- INSERT "주문 생성 허용", users_update_own_orders, service_role_orders_update 는 미변경.
-- 트랙A brand_product_orders 에 이 패턴을 복사하지 말 것.

-- 1차
DROP POLICY IF EXISTS orders_owner_select ON public.orders;
CREATE POLICY orders_owner_select
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (owner_id = public.current_user_id());

DROP POLICY IF EXISTS orders_referrer_select ON public.orders;
CREATE POLICY orders_referrer_select
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (referrer_user_id = auth.uid());

DROP POLICY IF EXISTS "결제완료 페이지 주문조회" ON public.orders;

-- 긴급후속 (001 정의와 동일, 운영 누락 보완)
DROP POLICY IF EXISTS orders_own ON public.orders;
CREATE POLICY "orders_own" ON public.orders
  FOR SELECT
  USING (
    customer_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS admin_all_orders ON public.orders;
CREATE POLICY "admin_all_orders" ON public.orders
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  );

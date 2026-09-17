-- 199_external_customers_rls_rebuild.sql
-- 이 마이그레이션은 이미 운영 DB에 SQL Editor로 직접 실행되어 반영된 상태를
-- 레포에 기록하기 위한 것임. 재실행해도 안전하도록 DROP IF EXISTS + CREATE 순서.
-- 실행 불필요. (197/198과 동일: 운영 스키마와 git 기록을 맞추는 문서화)
--
-- C1: admin_all(true) 및 admin_all_external_customers(role owner 포함 ALL) 제거.
-- 신규: admin 전용 ALL, chat_channels 경유 원장 SELECT, 고객 본인 SELECT.
-- bookings.external_customer_id 컬럼이 운영에 없어 해당 EXISTS는 넣지 않음.

DROP POLICY IF EXISTS "admin_all" ON public.external_customers;
DROP POLICY IF EXISTS "admin_all_external_customers" ON public.external_customers;
DROP POLICY IF EXISTS external_customers_admin_all ON public.external_customers;
DROP POLICY IF EXISTS external_customers_owner_via_bookings_select ON public.external_customers;
DROP POLICY IF EXISTS external_customers_self_select ON public.external_customers;
CREATE POLICY external_customers_admin_all
  ON public.external_customers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid() AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid() AND u.role = 'admin'
    )
  );
CREATE POLICY external_customers_owner_via_bookings_select
  ON public.external_customers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_channels cc
      WHERE cc.external_customer_id = external_customers.id
        AND cc.owner_id = public.current_user_id()
    )
  );
CREATE POLICY external_customers_self_select
  ON public.external_customers
  FOR SELECT
  TO authenticated
  USING (
    auran_user_id = auth.uid()
    OR auran_user_id = public.current_user_id()
  );

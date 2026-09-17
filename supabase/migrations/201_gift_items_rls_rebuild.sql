-- 201_gift_items_rls_rebuild.sql
-- 이 마이그레이션은 이미 운영 DB에 SQL Editor로 직접 실행되어 반영된 상태를
-- 레포에 기록하기 위한 것임. 재실행해도 안전하도록 DROP IF EXISTS + CREATE 순서.
-- 실행 불필요. (197~200과 동일: 운영 스키마와 git 기록을 맞추는 문서화)
--
-- C3: ALL(true) "어드민 전체" 제거. SELECT "전체 조회 가능"은 미변경(결제완료 또또 읽기).
-- 신규: gift_items_admin_write ALL(users.role=admin 또는 JWT super_admin).
-- 고객 당첨은 gift_items에 쓰지 않음(order_gifts). stock RPC 없음.

DROP POLICY IF EXISTS gift_items_admin_write ON public.gift_items;
CREATE POLICY gift_items_admin_write
  ON public.gift_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid() AND u.role = 'admin'
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid() AND u.role = 'admin'
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );
DROP POLICY IF EXISTS "어드민 전체" ON public.gift_items;

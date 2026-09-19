-- 202_help_tooltips_rls_rebuild.sql
-- 이 마이그레이션은 이미 운영 DB에 SQL Editor로 직접 실행되어 반영된 상태를
-- 레포에 기록하기 위한 것임. 재실행해도 안전하도록 DROP IF EXISTS + CREATE 순서.
-- 실행 불필요. (197~201과 동일: 운영 스키마와 git 기록을 맞추는 문서화)
--
-- C4: ALL(true) "어드민만 수정 가능"(이름은 admin전용, 실제 qual:true) 제거.
-- SELECT "누구나 조회 가능"은 미변경(홈·/my period_start 안내).
-- 신규: help_tooltips_admin_write ALL(users.role=admin 또는 JWT super_admin).
-- 앱에 help_tooltips 쓰기 코드 없음.

DROP POLICY IF EXISTS help_tooltips_admin_write ON public.help_tooltips;
CREATE POLICY help_tooltips_admin_write
  ON public.help_tooltips
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
DROP POLICY IF EXISTS "어드민만 수정 가능" ON public.help_tooltips;

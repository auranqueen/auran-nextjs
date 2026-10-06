-- Migration 214: group_buy_requests 어드민 보완 정책 (super_admin 포함)
CREATE POLICY "admin_all_requests_super" ON public.group_buy_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );
-- Supabase에서 직접 실행 완료

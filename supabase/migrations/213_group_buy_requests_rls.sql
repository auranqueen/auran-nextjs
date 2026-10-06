ALTER TABLE public.group_buy_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "editor_insert_own_request" ON public.group_buy_requests
  FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "editor_select_own_request" ON public.group_buy_requests
  FOR SELECT USING (auth.uid() = requester_id);
CREATE POLICY "admin_all_requests" ON public.group_buy_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE auth_id = auth.uid() AND role = 'admin'
    )
  );

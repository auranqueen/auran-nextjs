-- salons INSERT: 본인 users.id를 owner_id로 넣을 때만 생성 허용
-- 기존 salons_select_all / salons_update_own 정책은 변경하지 않음
-- 전제: public.current_user_id() (064 마이그레이션)

CREATE POLICY salons_insert_own ON public.salons
  FOR INSERT
  WITH CHECK (owner_id = public.current_user_id());

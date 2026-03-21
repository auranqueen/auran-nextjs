-- user_coupons: 본인 행 전체 관리 (SELECT/INSERT/UPDATE/DELETE) + 기존 어드민 정책 유지
DROP POLICY IF EXISTS "user_coupons_own_select" ON public.user_coupons;
DROP POLICY IF EXISTS "users manage own coupons" ON public.user_coupons;

CREATE POLICY "users manage own coupons"
  ON public.user_coupons FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 쿠폰함/체크아웃: 보유 user_coupon 이 있으면 해당 coupons 행도 조회 가능 (비활성 템플릿 포함)
DROP POLICY IF EXISTS "coupons_readable_if_held" ON public.coupons;
CREATE POLICY "coupons_readable_if_held"
  ON public.coupons FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_coupons uc
      WHERE uc.coupon_id = coupons.id AND uc.user_id = auth.uid()
    )
  );

-- 알림 탭 이동용 (기존 스키마는 body 유지, link 추가)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS link text;

COMMENT ON COLUMN public.notifications.link IS '탭 시 이동 경로 (예: /my/coupons)';

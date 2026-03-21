-- 선물 예정 장바구니 (받는 사람 = public.users.id, checkout의 gift_to와 동일)
-- 참고: auth.users 가 아닌 앱 프로필 users.id 를 씁니다.
ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS gift_to uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gift_message text;

COMMENT ON COLUMN public.cart_items.gift_to IS '선물 받는 사람 users.id (NULL이면 일반 장바구니)';

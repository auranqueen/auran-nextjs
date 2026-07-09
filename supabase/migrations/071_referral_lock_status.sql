-- toast_transactions: 추천보상 등 조건부 지급 건의 사용 가능 여부
-- status: active=사용가능, locked=조건 미충족으로 잠김(예: 추천보상 - 피추천인 첫구매 전)
-- 기존 row는 DEFAULT 'active'로 백필되어 과거 데이터 영향 없음

ALTER TABLE public.toast_transactions
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

COMMENT ON COLUMN public.toast_transactions.status IS
  'active=사용가능, locked=조건 미충족으로 잠김(예: 추천보상 - 피추천인 첫구매 전)';

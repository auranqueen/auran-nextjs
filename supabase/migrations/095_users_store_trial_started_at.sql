-- 095_users_store_trial_started_at.sql
-- 레이어1(스토어유지비)+레이어2(쇼케이스) 통합 90일 무료체험 시작일
-- NULL이면 앱에서 users.created_at fallback (기존 원장 동작 유지)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS store_trial_started_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.users.store_trial_started_at IS
  '레이어1+2 통합 무료체험 시작일. NULL이면 created_at fallback. 예외 재부여(예: 스킨파우더룸) 시 이 컬럼만 UPDATE.';

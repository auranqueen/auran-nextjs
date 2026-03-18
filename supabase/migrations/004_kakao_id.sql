-- Kakao: identify account by provider unique id (not email scope)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS kakao_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_kakao_id_unique ON public.users(kakao_id);


-- 083_users_origin_track_rollback.sql
-- 083_users_origin_track.sql 역순 롤백 (실행은 수동)

DROP TRIGGER IF EXISTS trg_guard_users_origin_track_immutable ON public.users;
DROP FUNCTION IF EXISTS public.guard_users_origin_track_immutable();

ALTER TABLE public.users
  DROP COLUMN IF EXISTS origin_track;

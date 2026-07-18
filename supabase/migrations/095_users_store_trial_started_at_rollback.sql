-- 095_users_store_trial_started_at_rollback.sql
-- 095_users_store_trial_started_at.sql 역순 롤백 (실행은 수동)

ALTER TABLE public.users
  DROP COLUMN IF EXISTS store_trial_started_at;

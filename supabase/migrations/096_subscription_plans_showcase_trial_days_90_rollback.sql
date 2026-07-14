-- 096_subscription_plans_showcase_trial_days_90_rollback.sql
-- 096_subscription_plans_showcase_trial_days_90.sql 역순 롤백 (실행은 수동)
-- 094 시드 시점 값(0)으로 복구

UPDATE public.subscription_plans
SET trial_days = 0
WHERE slug = 'track_a_showcase_annual';

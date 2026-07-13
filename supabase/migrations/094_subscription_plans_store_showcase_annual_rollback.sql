-- 094_subscription_plans_store_showcase_annual_rollback.sql
-- 094_subscription_plans_store_showcase_annual.sql 역순 롤백 (실행은 수동)

DELETE FROM public.admin_settings
WHERE category = 'subscription'
  AND key IN (
    'price_track_a_store_annual',
    'price_track_b_store_annual',
    'price_track_a_showcase_annual',
    'price_track_b_showcase_annual'
  );

DELETE FROM public.subscription_plans
WHERE slug IN (
  'track_a_store_annual',
  'track_b_store_annual',
  'track_a_showcase_annual',
  'track_b_showcase_annual'
);

ALTER TABLE public.subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_trial_days_check;

ALTER TABLE public.subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_layer_check;

ALTER TABLE public.subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_billing_period_check;

ALTER TABLE public.subscription_plans
  DROP COLUMN IF EXISTS trial_days;

ALTER TABLE public.subscription_plans
  DROP COLUMN IF EXISTS layer;

ALTER TABLE public.subscription_plans
  DROP COLUMN IF EXISTS billing_period;

DROP INDEX IF EXISTS idx_subscription_plans_slug_unique;

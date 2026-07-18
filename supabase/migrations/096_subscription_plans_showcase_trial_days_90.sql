-- 096_subscription_plans_showcase_trial_days_90.sql
-- 094 후속: track_a_showcase_annual trial_days 0 → 90 (레이어1+2 통합 체험과 카탈로그 정합)
-- 나머지 3플랜(track_a/b_store_annual, track_b_showcase_annual)은 이미 90

UPDATE public.subscription_plans
SET trial_days = 90
WHERE slug = 'track_a_showcase_annual'
  AND trial_days IS DISTINCT FROM 90;

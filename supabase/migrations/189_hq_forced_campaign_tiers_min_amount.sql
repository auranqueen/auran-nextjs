-- 189: hq_forced_campaign_tiers min_amount 컬럼 추가(금액기준 구간), min_qty nullable로 변경
-- Already applied directly on Supabase; recorded here for repo history.

alter table public.hq_forced_campaign_tiers
  add column if not exists min_amount integer;

alter table public.hq_forced_campaign_tiers
  alter column min_qty drop not null;

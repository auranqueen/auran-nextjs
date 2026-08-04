-- 135: hq_forced_campaigns / hq_forced_campaign_tiers schema expand
-- Already applied on Supabase; recorded for repo history. Do not re-run unless needed.

alter table hq_forced_campaigns
  add column if not exists description text,
  add column if not exists image_url text;

alter table hq_forced_campaign_tiers
  add column if not exists fixed_price integer,
  add column if not exists gift_product_id uuid references brand_products(id),
  add column if not exists gift_qty integer;

-- 133_hq_forced_campaigns_rls.sql
-- 기록용: DB에 이미 적용됨. 다른 환경 셋업 누락 방지.

-- RLS enable
alter table hq_forced_campaigns enable row level security;
alter table hq_forced_campaign_tiers enable row level security;
-- 기존 정책 있으면 삭제 후 재생성
drop policy if exists hq_forced_campaigns_company_select on hq_forced_campaigns;
drop policy if exists hq_forced_campaigns_owner_select on hq_forced_campaigns;
drop policy if exists hq_forced_campaign_tiers_select on hq_forced_campaign_tiers;
create policy hq_forced_campaigns_company_select
on hq_forced_campaigns for select
using (
  exists (
    select 1 from brands b
    where b.company_id = hq_forced_campaigns.company_id
      and (b.user_id = current_user_id() or b.user_id = auth.uid())
  )
  or exists (
    select 1 from brand_members bm
    join brands b2 on b2.id = bm.brand_id
    where b2.company_id = hq_forced_campaigns.company_id
      and bm.user_id = current_user_id()
  )
  or exists (
    select 1 from users
    where users.auth_id = auth.uid() and users.role = 'admin'::user_role
  )
);
create policy hq_forced_campaigns_owner_select
on hq_forced_campaigns for select
using (
  is_active = true
  and exists (
    select 1
    from brand_owner_links bol
    join brands b on b.id = bol.brand_id
    join users u on u.id = bol.owner_id
    where u.auth_id = auth.uid()
      and u.role = 'owner'::user_role
      and bol.status = 'active'
      and b.company_id = hq_forced_campaigns.company_id
  )
);
create policy hq_forced_campaign_tiers_select
on hq_forced_campaign_tiers for select
using (
  exists (
    select 1 from hq_forced_campaigns c
    where c.id = hq_forced_campaign_tiers.campaign_id
  )
);
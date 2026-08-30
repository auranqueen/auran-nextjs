-- 185: brand_staff.username + brand_companies 근무시간 + brand_admin_alerts (PIN게이트 아이디로그인+근무시간제한+CEO알림함)
-- Already applied directly on Supabase; recorded here for repo history.
alter table public.brand_companies
  add column if not exists work_hours_start time not null default '09:00',
  add column if not exists work_hours_end time not null default '18:00';
alter table public.brand_staff
  add column if not exists username text;
create unique index if not exists idx_brand_staff_company_username
  on public.brand_staff(company_id, username)
  where username is not null;
create table if not exists public.brand_admin_alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.brand_companies(id) on delete cascade,
  type text not null,
  message text not null,
  staff_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_brand_admin_alerts_company on public.brand_admin_alerts(company_id, created_at desc);
alter table public.brand_admin_alerts enable row level security;
drop policy if exists "brand_admin_alerts_owner_only" on public.brand_admin_alerts;
create policy "brand_admin_alerts_owner_only" on public.brand_admin_alerts for all
using (exists (
  select 1 from public.brands b
  where b.company_id = brand_admin_alerts.company_id
    and (b.user_id = current_user_id() or b.user_id = auth.uid())
));

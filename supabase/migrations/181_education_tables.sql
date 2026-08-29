-- 181: education (에듀케이션) tables + RLS
-- Already applied directly on Supabase; recorded here for repo history.
-- 181-1: education_sessions
create table if not exists public.education_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.brand_companies(id) on delete cascade,
  title text not null,
  session_date date not null,
  start_time time not null,
  end_time time not null,
  format text not null check (format in ('offline','online')),
  location text,
  link text,
  capacity integer not null default 30,
  zoom_meeting_id text,
  zoom_host_start_url text,
  created_by_staff_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_education_sessions_company on public.education_sessions(company_id, session_date);
-- 181-2: education_applications
create table if not exists public.education_applications (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.education_sessions(id) on delete cascade,
  owner_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'applied' check (status in ('applied','cancelled')),
  applied_at timestamptz not null default now(),
  unique (session_id, owner_id)
);
create index if not exists idx_education_applications_owner on public.education_applications(owner_id);
-- 181-3: company_integrations (줌 등 앱용 연동 설정 — client_secret은 서버 전용, 절대 프론트에 노출 금지)
create table if not exists public.company_integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.brand_companies(id) on delete cascade,
  provider text not null,
  client_id text,
  client_secret text,
  account_id text,
  is_active boolean not null default false,
  connected_by_staff_id uuid,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  unique (company_id, provider)
);
-- 181-4: education_sessions RLS (134번 패턴 — 회사 소유자만 직접쓰기, 스태프는 API단 assertStaffPermission으로 별도 통제)
alter table public.education_sessions enable row level security;
drop policy if exists "education_sessions_owner_write" on public.education_sessions;
create policy "education_sessions_owner_write" on public.education_sessions for all
using (exists (
  select 1 from public.brands b
  where b.company_id = education_sessions.company_id
    and (b.user_id = current_user_id() or b.user_id = auth.uid())
));
drop policy if exists "education_sessions_owner_read" on public.education_sessions;
create policy "education_sessions_owner_read" on public.education_sessions for select
using (
  exists (
    select 1 from public.brand_owner_links bol
    join public.brands b on b.id = bol.brand_id
    where b.company_id = education_sessions.company_id
      and bol.owner_id = current_user_id()
      and bol.status = 'active'
  )
  or exists (
    select 1 from public.brand_owner_grades g
    where g.company_id = education_sessions.company_id
      and g.owner_id = (select id from public.profiles where auth_id = auth.uid())
      and g.origin_track = 'B'
      and g.payment_status = 'paid'
  )
);
-- 181-5: education_applications RLS
alter table public.education_applications enable row level security;
drop policy if exists "education_applications_self" on public.education_applications;
create policy "education_applications_self" on public.education_applications for all
using (owner_id = current_user_id() or owner_id in (select id from public.users where auth_id = auth.uid()))
with check (owner_id = current_user_id() or owner_id in (select id from public.users where auth_id = auth.uid()));
drop policy if exists "education_applications_company_read" on public.education_applications;
create policy "education_applications_company_read" on public.education_applications for select
using (exists (
  select 1 from public.education_sessions es
  join public.brands b on b.company_id = es.company_id
  where es.id = education_applications.session_id
    and (b.user_id = current_user_id() or b.user_id = auth.uid())
));
-- 181-6: company_integrations RLS (민감정보라 회사 소유자 전용, API에서도 client_secret은 응답에 절대 포함 금지)
alter table public.company_integrations enable row level security;
drop policy if exists "company_integrations_owner_only" on public.company_integrations;
create policy "company_integrations_owner_only" on public.company_integrations for all
using (exists (
  select 1 from public.brands b
  where b.company_id = company_integrations.company_id
    and (b.user_id = current_user_id() or b.user_id = auth.uid())
));
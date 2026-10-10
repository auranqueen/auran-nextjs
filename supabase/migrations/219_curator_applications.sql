-- 큐레이터 신청서 (고객 마이페이지 → 어드민 매거진 '신청 관리' 탭에서 승인/거절)
create table if not exists curator_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  display_name text not null,
  email text not null,
  instagram text,
  channel_url text,
  categories text[] not null,
  intro text not null,
  portfolio_url text,
  bank_holder text not null,
  bank_name text not null,
  bank_account text not null,
  rrn_front text not null,
  rrn_back_first text not null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  admin_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table curator_applications enable row level security;
create policy "curator_applications_select_own"
  on curator_applications for select
  using (auth.uid() = user_id);
create policy "curator_applications_insert_own"
  on curator_applications for insert
  with check (auth.uid() = user_id);

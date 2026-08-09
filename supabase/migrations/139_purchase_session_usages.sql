-- 다회권 회차소진 이력 + 회차별 정산확정용 신규 테이블. DB는 이미 반영됨 — 레포 기록용
create table if not exists public.purchase_session_usages (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id),
  booking_id uuid references public.bookings(id),
  session_number int not null,
  used_at timestamptz not null default now(),
  amount integer,
  platform_fee integer,
  owner_amount integer,
  settlement_status text not null default 'pending',
  settled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_psu_purchase_id on public.purchase_session_usages(purchase_id);
create index if not exists idx_psu_settlement_status on public.purchase_session_usages(settlement_status);
alter table public.purchase_session_usages enable row level security;
drop policy if exists psu_customer_select on public.purchase_session_usages;
create policy psu_customer_select on public.purchase_session_usages
  for select using (
    purchase_id in (
      select id from public.purchases
      where customer_id = (select users.id from users where users.auth_id = auth.uid())
    )
  );
drop policy if exists psu_owner_select on public.purchase_session_usages;
create policy psu_owner_select on public.purchase_session_usages
  for select using (
    purchase_id in (
      select id from public.purchases
      where salon_id in (
        select salons.id from salons
        where salons.owner_id = (select users.id from users where users.auth_id = auth.uid())
      )
    )
  );
drop policy if exists psu_owner_insert on public.purchase_session_usages;
create policy psu_owner_insert on public.purchase_session_usages
  for insert with check (
    purchase_id in (
      select id from public.purchases
      where salon_id in (
        select salons.id from salons
        where salons.owner_id = (select users.id from users where users.auth_id = auth.uid())
      )
    )
  );
drop policy if exists psu_admin_all on public.purchase_session_usages;
create policy psu_admin_all on public.purchase_session_usages
  for all using (
    exists (select 1 from users where users.auth_id = auth.uid() and users.role = 'admin')
  );

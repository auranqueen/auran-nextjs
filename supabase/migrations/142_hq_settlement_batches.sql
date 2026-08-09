-- 정산배치 이력(정산번호+기간 스냅샷). 트랙B 스폰서커미션 전용으로 시작, settlement_type으로 향후 확장 가능. DB는 이미 반영됨 — 레포 기록용
create table if not exists public.hq_settlement_batches (
  id uuid primary key default gen_random_uuid(),
  settlement_type text not null,
  track text not null default 'B',
  batch_seq int not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  item_count int not null,
  total_amount bigint not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id)
);
create unique index if not exists uq_hq_settlement_batches_type_seq
  on public.hq_settlement_batches(settlement_type, batch_seq);
alter table public.hq_commission_ledger
  add column if not exists batch_id uuid references public.hq_settlement_batches(id);
alter table public.hq_settlement_batches enable row level security;
drop policy if exists hq_settlement_batches_admin_all on public.hq_settlement_batches;
create policy hq_settlement_batches_admin_all on public.hq_settlement_batches
  for all using (
    exists (select 1 from users where users.auth_id = auth.uid() and users.role = 'admin')
  );
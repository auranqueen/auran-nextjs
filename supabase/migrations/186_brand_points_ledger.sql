-- brand_points mutation ledger (append-only) for applyPointsDelta
create table if not exists public.brand_points_ledger (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.brand_companies(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  track text not null,
  amount integer not null,
  balance_after integer not null,
  reason text not null,
  source_type text not null,
  created_by_staff_id uuid references public.brand_staff(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint brand_points_ledger_track_check
    check (track = any (array['A', 'B', 'ARETE', 'REWARD'])),
  constraint brand_points_ledger_source_type_check
    check (source_type = any (array['manual', 'invoice_webhook', 'arete_payment', 'monthly_billing']))
);

create index if not exists idx_brand_points_ledger_owner_track_created
  on public.brand_points_ledger (company_id, owner_id, track, created_at desc);

alter table public.brand_points_ledger enable row level security;

create policy brand_points_ledger_owner_select on public.brand_points_ledger
  for select
  using (
    owner_id in (select id from public.profiles where auth_id = auth.uid())
  );

create policy brand_points_ledger_brand_select on public.brand_points_ledger
  for select
  using (
    exists (
      select 1 from public.brands b
      where b.company_id = brand_points_ledger.company_id
        and (
          b.user_id = auth.uid()
          or b.user_id = public.current_user_id()
          or exists (
            select 1 from public.brand_members bm
            where bm.brand_id = b.id
              and (bm.user_id = public.current_user_id() or bm.user_id = auth.uid())
          )
        )
    )
  );

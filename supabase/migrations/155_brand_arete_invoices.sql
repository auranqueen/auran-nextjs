-- 아레테 매월 청구서 자동생성 관련. DB는 이미 반영됨 — 레포 기록용
create table if not exists brand_arete_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references brand_companies(id),
  owner_id uuid references profiles(id),
  billing_month date not null,
  amount integer not null default 1000000,
  status text not null default 'unpaid',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (company_id, owner_id, billing_month)
);
alter table brand_arete_invoices enable row level security;
create policy brand_arete_invoices_access on brand_arete_invoices
  for select
  using (
    exists (
      select 1 from public.brands b
      where b.company_id = brand_arete_invoices.company_id
        and (b.user_id = public.current_user_id() or b.user_id = auth.uid())
    )
    or owner_id in (
      select id from public.profiles where auth_id = auth.uid()
    )
  );
alter table brand_payment_intents drop constraint if exists brand_payment_intents_kind_check;
alter table brand_payment_intents
  add constraint brand_payment_intents_kind_check check (kind = ANY (ARRAY['tier', 'invoice', 'arete']));
alter table brand_payment_intents
  add column if not exists arete_invoice_id uuid references brand_arete_invoices(id) on delete set null;

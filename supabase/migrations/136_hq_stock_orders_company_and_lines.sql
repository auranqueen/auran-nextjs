-- 136_hq_stock_orders_company_and_lines.sql
-- Already applied on Supabase; recorded for repo history. Do not re-run unless needed.
-- hq_stock_orders.company_id + hq_stock_order_lines (per-brand lines/shipping)

alter table hq_stock_orders
  add column if not exists company_id uuid references brand_companies(id);

create table if not exists hq_stock_order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references hq_stock_orders(id) on delete cascade,
  brand_id uuid not null references brands(id),
  items jsonb not null default '[]'::jsonb,
  line_amount integer not null default 0,
  courier text,
  tracking_no text,
  shipped_at timestamptz,
  status text not null default '결제완료',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hq_stock_order_lines_order_id on hq_stock_order_lines(order_id);
create index if not exists idx_hq_stock_order_lines_brand_id on hq_stock_order_lines(brand_id);

alter table hq_stock_order_lines enable row level security;

create policy "hq_stock_order_lines_owner_select"
on hq_stock_order_lines for select
using (
  exists (
    select 1 from hq_stock_orders o
    join profiles p on p.id = o.profile_id
    where o.id = hq_stock_order_lines.order_id
      and p.auth_id = auth.uid()
  )
  or exists (
    select 1 from users u
    where u.auth_id = auth.uid() and u.role = 'admin'
  )
);

create policy "hq_stock_order_lines_brand_access"
on hq_stock_order_lines for all
using (
  exists (
    select 1 from brands b
    where b.id = hq_stock_order_lines.brand_id
      and (b.user_id = current_user_id() or b.user_id = auth.uid())
  )
  or exists (
    select 1 from brand_members bm
    join users u on u.id = bm.user_id
    where bm.brand_id = hq_stock_order_lines.brand_id
      and u.auth_id = auth.uid()
  )
  or exists (
    select 1 from users u
    where u.auth_id = auth.uid() and u.role = 'admin'
  )
);

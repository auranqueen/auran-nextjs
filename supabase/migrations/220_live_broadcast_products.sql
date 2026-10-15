-- 220: 라이브 방송 제품 연결 테이블
create table if not exists public.oren_live_broadcast_products (
  id bigint generated always as identity primary key,
  broadcast_id bigint references public.oren_live_broadcasts(id) on delete cascade not null,
  brand_product_id uuid references public.brand_products(id) on delete cascade not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique(broadcast_id, brand_product_id)
);
create index if not exists oren_live_broadcast_products_broadcast_id_idx
  on public.oren_live_broadcast_products (broadcast_id);
alter table public.oren_live_broadcast_products enable row level security;
drop policy if exists "oren_live_broadcast_products_select_public" on public.oren_live_broadcast_products;
create policy "oren_live_broadcast_products_select_public"
  on public.oren_live_broadcast_products for select
  using (true);
drop policy if exists "oren_live_broadcast_products_insert_owner" on public.oren_live_broadcast_products;
create policy "oren_live_broadcast_products_insert_owner"
  on public.oren_live_broadcast_products for insert
  with check (exists (
    select 1 from public.oren_live_broadcasts b
    join public.profiles p on p.id = b.owner_id
    where b.id = broadcast_id and p.auth_id = auth.uid()
  ));
drop policy if exists "oren_live_broadcast_products_delete_owner" on public.oren_live_broadcast_products;
create policy "oren_live_broadcast_products_delete_owner"
  on public.oren_live_broadcast_products for delete
  using (exists (
    select 1 from public.oren_live_broadcasts b
    join public.profiles p on p.id = b.owner_id
    where b.id = broadcast_id and p.auth_id = auth.uid()
  ));

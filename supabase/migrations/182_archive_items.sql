-- 182: brand_archive_items (에듀케이션/자료관리 - 트리트먼트/제품교육자료) table + RLS
-- Already applied directly on Supabase; recorded here for repo history.
-- 182-1: brand_archive_items
create table if not exists public.brand_archive_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.brand_companies(id) on delete cascade,
  category text not null check (category in ('treatment','material')),
  source text not null default 'general' check (source in ('general','arete')),
  title text not null,
  body_html text not null,
  asset_url text,
  is_public boolean not null default false,
  created_by_staff_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_brand_archive_items_company on public.brand_archive_items(company_id, category);
-- 182-2: brand_archive_items RLS
alter table public.brand_archive_items enable row level security;
drop policy if exists "brand_archive_items_owner_write" on public.brand_archive_items;
create policy "brand_archive_items_owner_write" on public.brand_archive_items for all
using (exists (
  select 1 from public.brands b
  where b.company_id = brand_archive_items.company_id
    and (b.user_id = current_user_id() or b.user_id = auth.uid())
));
drop policy if exists "brand_archive_items_owner_read" on public.brand_archive_items;
create policy "brand_archive_items_owner_read" on public.brand_archive_items for select
using (
  (
    exists (
      select 1 from public.brand_owner_links bol
      join public.brands b on b.id = bol.brand_id
      where b.company_id = brand_archive_items.company_id
        and bol.owner_id = current_user_id()
        and bol.status = 'active'
    )
    or exists (
      select 1 from public.brand_owner_grades g
      where g.company_id = brand_archive_items.company_id
        and g.owner_id = (select id from public.profiles where auth_id = auth.uid())
        and g.origin_track = 'B'
        and g.payment_status = 'paid'
    )
  )
  and (
    brand_archive_items.source = 'general'
    or exists (
      select 1 from public.brand_arete_members m
      where m.company_id = brand_archive_items.company_id
        and m.owner_id = (select id from public.profiles where auth_id = auth.uid())
        and m.status = 'active'
    )
  )
);
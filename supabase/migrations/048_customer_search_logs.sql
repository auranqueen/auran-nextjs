create table if not exists public.customer_search_logs (
  id uuid primary key default gen_random_uuid(),
  search_keyword text not null,
  source text not null default '검색',
  count int not null default 1,
  is_promoted boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_customer_search_logs_created_at
  on public.customer_search_logs(created_at desc);

create index if not exists idx_customer_search_logs_keyword_source
  on public.customer_search_logs(search_keyword, source);

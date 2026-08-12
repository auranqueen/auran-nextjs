-- 아레테클럽 번들/가이드 테이블. DB는 이미 반영됨 — 레포 기록용
create table if not exists brand_arete_monthly_bundles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references brand_companies(id),
  billing_month date not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, billing_month)
);
create table if not exists brand_arete_guide_images (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references brand_companies(id),
  billing_month date not null,
  image_url text not null,
  title text,
  created_at timestamptz not null default now(),
  unique (company_id, billing_month)
);

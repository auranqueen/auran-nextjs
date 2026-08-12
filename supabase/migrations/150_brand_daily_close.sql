-- 일일마감 확인 기록 테이블. DB는 이미 반영됨 — 레포 기록용
create table if not exists brand_daily_close (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id),
  close_date date not null,
  confirmed_by text,
  confirmed_at timestamptz not null default now(),
  memo text,
  unique (brand_id, close_date)
);

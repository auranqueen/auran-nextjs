-- 183: brand_companies.auto_approve_owner_invite (already live, repo record only — 8/9 작업 당시 번호 꼬임으로 누락됐던 것 뒤늦게 기록)
alter table public.brand_companies
  add column if not exists auto_approve_owner_invite boolean not null default false;

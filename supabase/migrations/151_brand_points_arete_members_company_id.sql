-- brand_points/brand_arete_members company_id 전환. DB는 이미 반영됨 — 레포 기록용
alter table brand_points
  add column if not exists company_id uuid references brand_companies(id);
alter table brand_arete_members
  add column if not exists company_id uuid references brand_companies(id);

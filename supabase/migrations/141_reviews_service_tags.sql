-- reviews.service_tags 컬럼(현재 미사용, helpful_concerns로 대체 확정). DB는 이미 반영됨 — 레포 기록용
alter table public.reviews
  add column if not exists service_tags text[];

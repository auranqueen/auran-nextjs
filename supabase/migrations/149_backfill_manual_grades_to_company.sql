-- 구버전(brand_id,owner_id 기준) 수기등급을 신버전(company_id,owner_id,origin_track) 자리로 백필. DB는 이미 반영됨 — 레포 기록용
insert into brand_owner_grades (company_id, brand_id, owner_id, origin_track, grade, payment_status, grade_purchased_at)
select b.company_id, null, g.owner_id, 'A', g.grade, 'paid', now()
from brand_owner_grades g
join brands b on b.id = g.brand_id
where g.origin_track is null
  and b.company_id is not null
on conflict (company_id, owner_id, origin_track) do nothing;

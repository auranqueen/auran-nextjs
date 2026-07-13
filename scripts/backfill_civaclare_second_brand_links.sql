-- backfill_civaclare_second_brand_links.sql
-- 수동 실행 1회: 시바산그룹 active link 트랙A 원장 → 씨아클라르제 link 복제
-- 전제: brand_owner_links (brand_id, owner_id) UNIQUE

-- 허브: 시바산그룹
-- 세컨: 씨아클라르제

INSERT INTO public.brand_owner_links (brand_id, owner_id, status, approved_at)
SELECT
  'bbac6f2d-e009-49bd-8d89-443b1e8087f8'::uuid AS brand_id,
  bol.owner_id,
  'active'::text AS status,
  COALESCE(bol.approved_at, now()) AS approved_at
FROM public.brand_owner_links bol
INNER JOIN public.users u ON u.id = bol.owner_id
WHERE bol.brand_id = '60413ded-91f4-4004-b677-ae684cb0677e'::uuid
  AND bol.status = 'active'
  AND u.role = 'owner'
  AND u.origin_track = 'A'
ON CONFLICT (brand_id, owner_id) DO NOTHING;

-- 확인: 허브 active vs 세컨 active 건수
SELECT
  (SELECT COUNT(*) FROM public.brand_owner_links
   WHERE brand_id = '60413ded-91f4-4004-b677-ae684cb0677e' AND status = 'active') AS hub_active,
  (SELECT COUNT(*) FROM public.brand_owner_links
   WHERE brand_id = 'bbac6f2d-e009-49bd-8d89-443b1e8087f8' AND status = 'active') AS second_active;

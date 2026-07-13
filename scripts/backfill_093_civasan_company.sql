-- backfill_093_civasan_company.sql
-- 093_brand_owner_points.sql 적용 후 수동 실행
-- 시바산그룹 + 씨아클라르제를 하나의 brand_companies row로 묶음

-- 1) 회사 row (이름 중복 없을 때만 insert)
INSERT INTO public.brand_companies (name)
SELECT '시바산그룹'
WHERE NOT EXISTS (
  SELECT 1 FROM public.brand_companies WHERE name = '시바산그룹'
);

-- 2) 두 브랜드에 company_id 연결
UPDATE public.brands b
SET company_id = c.id
FROM public.brand_companies c
WHERE c.name = '시바산그룹'
  AND b.id IN (
    '60413ded-91f4-4004-b677-ae684cb0677e',  -- 시바산그룹
    'bbac6f2d-e009-49bd-8d89-443b1e8087f8'   -- 씨아클라르제
  );

-- 확인
SELECT b.id, b.name, b.company_id, c.name AS company_name
FROM public.brands b
LEFT JOIN public.brand_companies c ON c.id = b.company_id
WHERE b.id IN (
  '60413ded-91f4-4004-b677-ae684cb0677e',
  'bbac6f2d-e009-49bd-8d89-443b1e8087f8'
);

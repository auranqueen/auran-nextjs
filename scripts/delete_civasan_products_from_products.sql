-- 1회성 수동 실행 (088 적용·테스트 완료 후).
-- brand_products는 빈 테이블로 시작 → 브랜드 V2로 신규 등록만.

BEGIN;

DELETE FROM public.products
WHERE brand_id = '60413ded-91f4-4004-b677-ae684cb0677e';

COMMIT;

-- 확인:
-- SELECT count(*) FROM products WHERE brand_id = '60413ded-91f4-4004-b677-ae684cb0677e';
-- SELECT count(*) FROM brand_products;

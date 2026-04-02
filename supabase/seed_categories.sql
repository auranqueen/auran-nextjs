-- categories 5단계 시드 (대→중→소→세부, 스킨태그는 parent_id NULL::uuid · level 5)
-- Supabase SQL 에디터에서 실행. 기존 동일 id가 있으면 충돌하므로 필요 시 먼저 정리하세요.
-- 예: DELETE FROM categories WHERE id IN (SELECT id FROM categories WHERE ...);
--
-- 전제 컬럼: id (uuid PK), name (text), parent_id (uuid NULL::uuid), level (int), sort_order (int)
-- created_at 등이 있고 NOT NULL이면 테이블 DEFAULT를 맞추거나 아래 INSERT에 컬럼을 추가하세요.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- Level 1 · 대분류
-- ═══════════════════════════════════════════════════════════════════════════
WITH k AS (
  SELECT
    'c1111111-1111-4111-8111-000000000001'::uuid AS id_basic,
    'c1111111-1111-4111-8111-000000000002'::uuid AS id_cleansing,
    'c1111111-1111-4111-8111-000000000003'::uuid AS id_exfo,
    'c1111111-1111-4111-8111-000000000004'::uuid AS id_sun,
    'c1111111-1111-4111-8111-000000000005'::uuid AS id_body,
    'c1111111-1111-4111-8111-000000000006'::uuid AS id_aroma,
    'c1111111-1111-4111-8111-000000000007'::uuid AS id_hair
)
INSERT INTO categories (id, name, parent_id, level, sort_order)
SELECT id_basic, '기초케어', NULL::uuid, 1, 0 FROM k
UNION ALL SELECT id_cleansing, '클렌징', NULL::uuid, 1, 1 FROM k
UNION ALL SELECT id_exfo, '각질·스페셜케어', NULL::uuid, 1, 2 FROM k
UNION ALL SELECT id_sun, '선케어', NULL::uuid, 1, 3 FROM k
UNION ALL SELECT id_body, '바디케어', NULL::uuid, 1, 4 FROM k
UNION ALL SELECT id_aroma, '아로마·호르몬케어', NULL::uuid, 1, 5 FROM k
UNION ALL SELECT id_hair, '헤어케어', NULL::uuid, 1, 6 FROM k;

-- ═══════════════════════════════════════════════════════════════════════════
-- Level 2 · 중분류 (기초케어)
-- ═══════════════════════════════════════════════════════════════════════════
WITH k AS (
  SELECT
    'c1111111-1111-4111-8111-000000000001'::uuid AS id_basic,
    'c1111111-1111-4111-8111-000000000008'::uuid AS id_serum_ampoule,
    'c1111111-1111-4111-8111-000000000009'::uuid AS id_cream_mid,
    'c1111111-1111-4111-8111-000000000010'::uuid AS id_toner_essence,
    'c1111111-1111-4111-8111-000000000011'::uuid AS id_eye_cream_mid,
    'c1111111-1111-4111-8111-000000000012'::uuid AS id_mask_mid
)
INSERT INTO categories (id, name, parent_id, level, sort_order)
SELECT id_serum_ampoule, '세럼·앰플', id_basic, 2, 0 FROM k
UNION ALL SELECT id_cream_mid, '크림', id_basic, 2, 1 FROM k
UNION ALL SELECT id_toner_essence, '토너·에센스', id_basic, 2, 2 FROM k
UNION ALL SELECT id_eye_cream_mid, '아이크림', id_basic, 2, 3 FROM k
UNION ALL SELECT id_mask_mid, '마스크팩', id_basic, 2, 4 FROM k;

-- ═══════════════════════════════════════════════════════════════════════════
-- Level 3–4 · 세럼·앰플 (소 → 세부)
-- ═══════════════════════════════════════════════════════════════════════════
WITH k AS (
  SELECT
    'c1111111-1111-4111-8111-000000000008'::uuid AS p_serum,
    'c1111111-1111-4111-8111-000000000013'::uuid AS id_s3_moist,
    'c1111111-1111-4111-8111-000000000014'::uuid AS id_s3_white,
    'c1111111-1111-4111-8111-000000000015'::uuid AS id_s3_elastic,
    'c1111111-1111-4111-8111-000000000016'::uuid AS id_s3_calm,
    'c1111111-1111-4111-8111-000000000017'::uuid AS id_s3_regen,
    'c1111111-1111-4111-8111-000000000018'::uuid AS id_s3_hormone,
    'c1111111-1111-4111-8111-000000000019'::uuid AS id_s4_moist,
    'c1111111-1111-4111-8111-000000000020'::uuid AS id_s4_white,
    'c1111111-1111-4111-8111-000000000021'::uuid AS id_s4_elastic,
    'c1111111-1111-4111-8111-000000000022'::uuid AS id_s4_calm,
    'c1111111-1111-4111-8111-000000000023'::uuid AS id_s4_regen,
    'c1111111-1111-4111-8111-000000000024'::uuid AS id_s4_hormone
)
INSERT INTO categories (id, name, parent_id, level, sort_order)
SELECT id_s3_moist, '수분', p_serum, 3, 0 FROM k
UNION ALL SELECT id_s3_white, '미백', p_serum, 3, 1 FROM k
UNION ALL SELECT id_s3_elastic, '탄력', p_serum, 3, 2 FROM k
UNION ALL SELECT id_s3_calm, '진정', p_serum, 3, 3 FROM k
UNION ALL SELECT id_s3_regen, '재생', p_serum, 3, 4 FROM k
UNION ALL SELECT id_s3_hormone, '호르몬밸런스', p_serum, 3, 5 FROM k
UNION ALL SELECT id_s4_moist, '수분세럼', id_s3_moist, 4, 0 FROM k
UNION ALL SELECT id_s4_white, '미백세럼', id_s3_white, 4, 0 FROM k
UNION ALL SELECT id_s4_elastic, '탄력세럼', id_s3_elastic, 4, 0 FROM k
UNION ALL SELECT id_s4_calm, '진정세럼', id_s3_calm, 4, 0 FROM k
UNION ALL SELECT id_s4_regen, '재생세럼', id_s3_regen, 4, 0 FROM k
UNION ALL SELECT id_s4_hormone, '호르몬밸런스세럼', id_s3_hormone, 4, 0 FROM k;

-- ═══════════════════════════════════════════════════════════════════════════
-- Level 3–4 · 크림
-- ═══════════════════════════════════════════════════════════════════════════
WITH k AS (
  SELECT
    'c1111111-1111-4111-8111-000000000009'::uuid AS p_cream,
    'c1111111-1111-4111-8111-000000000025'::uuid AS id_c3_moist,
    'c1111111-1111-4111-8111-000000000026'::uuid AS id_c3_nutri,
    'c1111111-1111-4111-8111-000000000027'::uuid AS id_c3_elastic,
    'c1111111-1111-4111-8111-000000000028'::uuid AS id_c3_calm,
    'c1111111-1111-4111-8111-000000000029'::uuid AS id_c3_regen,
    'c1111111-1111-4111-8111-000000000030'::uuid AS id_c4_moist,
    'c1111111-1111-4111-8111-000000000031'::uuid AS id_c4_nutri,
    'c1111111-1111-4111-8111-000000000032'::uuid AS id_c4_elastic,
    'c1111111-1111-4111-8111-000000000033'::uuid AS id_c4_calm,
    'c1111111-1111-4111-8111-000000000034'::uuid AS id_c4_regen
)
INSERT INTO categories (id, name, parent_id, level, sort_order)
SELECT id_c3_moist, '수분', p_cream, 3, 0 FROM k
UNION ALL SELECT id_c3_nutri, '영양', p_cream, 3, 1 FROM k
UNION ALL SELECT id_c3_elastic, '탄력', p_cream, 3, 2 FROM k
UNION ALL SELECT id_c3_calm, '진정', p_cream, 3, 3 FROM k
UNION ALL SELECT id_c3_regen, '재생', p_cream, 3, 4 FROM k
UNION ALL SELECT id_c4_moist, '수분크림', id_c3_moist, 4, 0 FROM k
UNION ALL SELECT id_c4_nutri, '영양크림', id_c3_nutri, 4, 0 FROM k
UNION ALL SELECT id_c4_elastic, '탄력크림', id_c3_elastic, 4, 0 FROM k
UNION ALL SELECT id_c4_calm, '진정크림', id_c3_calm, 4, 0 FROM k
UNION ALL SELECT id_c4_regen, '재생크림', id_c3_regen, 4, 0 FROM k;

-- ═══════════════════════════════════════════════════════════════════════════
-- Level 3–4 · 토너·에센스
-- ═══════════════════════════════════════════════════════════════════════════
WITH k AS (
  SELECT
    'c1111111-1111-4111-8111-000000000010'::uuid AS p_toner,
    'c1111111-1111-4111-8111-000000000035'::uuid AS id_t3_moist,
    'c1111111-1111-4111-8111-000000000036'::uuid AS id_t3_white,
    'c1111111-1111-4111-8111-000000000037'::uuid AS id_t3_peeling,
    'c1111111-1111-4111-8111-000000000038'::uuid AS id_t4_moist,
    'c1111111-1111-4111-8111-000000000039'::uuid AS id_t4_white,
    'c1111111-1111-4111-8111-000000000040'::uuid AS id_t4_peeling
)
INSERT INTO categories (id, name, parent_id, level, sort_order)
SELECT id_t3_moist, '수분', p_toner, 3, 0 FROM k
UNION ALL SELECT id_t3_white, '미백', p_toner, 3, 1 FROM k
UNION ALL SELECT id_t3_peeling, '각질', p_toner, 3, 2 FROM k
UNION ALL SELECT id_t4_moist, '수분토너', id_t3_moist, 4, 0 FROM k
UNION ALL SELECT id_t4_white, '미백토너', id_t3_white, 4, 0 FROM k
UNION ALL SELECT id_t4_peeling, '각질토너', id_t3_peeling, 4, 0 FROM k;

-- ═══════════════════════════════════════════════════════════════════════════
-- Level 3–4 · 아이크림
-- ═══════════════════════════════════════════════════════════════════════════
WITH k AS (
  SELECT
    'c1111111-1111-4111-8111-000000000011'::uuid AS p_eye,
    'c1111111-1111-4111-8111-000000000041'::uuid AS id_e3_wrinkle,
    'c1111111-1111-4111-8111-000000000042'::uuid AS id_e3_dark,
    'c1111111-1111-4111-8111-000000000043'::uuid AS id_e3_puff,
    'c1111111-1111-4111-8111-000000000044'::uuid AS id_e4_wrinkle,
    'c1111111-1111-4111-8111-000000000045'::uuid AS id_e4_dark,
    'c1111111-1111-4111-8111-000000000046'::uuid AS id_e4_puff
)
INSERT INTO categories (id, name, parent_id, level, sort_order)
SELECT id_e3_wrinkle, '주름', p_eye, 3, 0 FROM k
UNION ALL SELECT id_e3_dark, '다크서클', p_eye, 3, 1 FROM k
UNION ALL SELECT id_e3_puff, '붓기', p_eye, 3, 2 FROM k
UNION ALL SELECT id_e4_wrinkle, '주름 아이크림', id_e3_wrinkle, 4, 0 FROM k
UNION ALL SELECT id_e4_dark, '다크서클 아이크림', id_e3_dark, 4, 0 FROM k
UNION ALL SELECT id_e4_puff, '붓기 아이크림', id_e3_puff, 4, 0 FROM k;

-- ═══════════════════════════════════════════════════════════════════════════
-- Level 3–4 · 마스크팩
-- ═══════════════════════════════════════════════════════════════════════════
WITH k AS (
  SELECT
    'c1111111-1111-4111-8111-000000000012'::uuid AS p_mask,
    'c1111111-1111-4111-8111-000000000047'::uuid AS id_m3_cream,
    'c1111111-1111-4111-8111-000000000048'::uuid AS id_m3_model,
    'c1111111-1111-4111-8111-000000000049'::uuid AS id_m3_sheet,
    'c1111111-1111-4111-8111-000000000050'::uuid AS id_m4_cream,
    'c1111111-1111-4111-8111-000000000051'::uuid AS id_m4_model,
    'c1111111-1111-4111-8111-000000000052'::uuid AS id_m4_sheet
)
INSERT INTO categories (id, name, parent_id, level, sort_order)
SELECT id_m3_cream, '크림', p_mask, 3, 0 FROM k
UNION ALL SELECT id_m3_model, '모델링', p_mask, 3, 1 FROM k
UNION ALL SELECT id_m3_sheet, '시트', p_mask, 3, 2 FROM k
UNION ALL SELECT id_m4_cream, '크림팩', id_m3_cream, 4, 0 FROM k
UNION ALL SELECT id_m4_model, '모델링팩', id_m3_model, 4, 0 FROM k
UNION ALL SELECT id_m4_sheet, '시트팩', id_m3_sheet, 4, 0 FROM k;

-- ═══════════════════════════════════════════════════════════════════════════
-- Level 2–4 · 클렌징
-- ═══════════════════════════════════════════════════════════════════════════
WITH k AS (
  SELECT
    'c1111111-1111-4111-8111-000000000002'::uuid AS p_clean,
    'c1111111-1111-4111-8111-000000000053'::uuid AS id_cl_foam,
    'c1111111-1111-4111-8111-000000000054'::uuid AS id_cl_oil,
    'c1111111-1111-4111-8111-000000000055'::uuid AS id_cl_balm,
    'c1111111-1111-4111-8111-000000000056'::uuid AS id_cl_water,
    'c1111111-1111-4111-8111-000000000057'::uuid AS id_cl_foam_l3,
    'c1111111-1111-4111-8111-000000000058'::uuid AS id_cl_foam_l4,
    'c1111111-1111-4111-8111-000000000059'::uuid AS id_cl_oil_l3,
    'c1111111-1111-4111-8111-000000000060'::uuid AS id_cl_oil_l4,
    'c1111111-1111-4111-8111-000000000061'::uuid AS id_cl_balm_l3,
    'c1111111-1111-4111-8111-000000000062'::uuid AS id_cl_balm_l4,
    'c1111111-1111-4111-8111-000000000063'::uuid AS id_cl_water_l3,
    'c1111111-1111-4111-8111-000000000064'::uuid AS id_cl_water_l4
)
INSERT INTO categories (id, name, parent_id, level, sort_order)
SELECT id_cl_foam, '폼클렌저', p_clean, 2, 0 FROM k
UNION ALL SELECT id_cl_oil, '오일클렌저', p_clean, 2, 1 FROM k
UNION ALL SELECT id_cl_balm, '클렌징밤', p_clean, 2, 2 FROM k
UNION ALL SELECT id_cl_water, '클렌징워터', p_clean, 2, 3 FROM k
UNION ALL SELECT id_cl_foam_l3, '기본', id_cl_foam, 3, 0 FROM k
UNION ALL SELECT id_cl_foam_l4, '폼클렌저', id_cl_foam_l3, 4, 0 FROM k
UNION ALL SELECT id_cl_oil_l3, '기본', id_cl_oil, 3, 0 FROM k
UNION ALL SELECT id_cl_oil_l4, '오일클렌저', id_cl_oil_l3, 4, 0 FROM k
UNION ALL SELECT id_cl_balm_l3, '기본', id_cl_balm, 3, 0 FROM k
UNION ALL SELECT id_cl_balm_l4, '클렌징밤', id_cl_balm_l3, 4, 0 FROM k
UNION ALL SELECT id_cl_water_l3, '기본', id_cl_water, 3, 0 FROM k
UNION ALL SELECT id_cl_water_l4, '클렌징워터', id_cl_water_l3, 4, 0 FROM k;

-- ═══════════════════════════════════════════════════════════════════════════
-- Level 2–4 · 각질·스페셜케어
-- ═══════════════════════════════════════════════════════════════════════════
WITH k AS (
  SELECT
    'c1111111-1111-4111-8111-000000000003'::uuid AS p_exfo,
    'c1111111-1111-4111-8111-000000000065'::uuid AS id_ex_peel,
    'c1111111-1111-4111-8111-000000000066'::uuid AS id_ex_amp,
    'c1111111-1111-4111-8111-000000000067'::uuid AS id_ex_aha,
    'c1111111-1111-4111-8111-000000000068'::uuid AS id_ex_bha,
    'c1111111-1111-4111-8111-000000000069'::uuid AS id_ex_enzyme,
    'c1111111-1111-4111-8111-000000000070'::uuid AS id_ex_l4_aha,
    'c1111111-1111-4111-8111-000000000071'::uuid AS id_ex_l4_bha,
    'c1111111-1111-4111-8111-000000000072'::uuid AS id_ex_l4_enzyme,
    'c1111111-1111-4111-8111-000000000073'::uuid AS id_ex_w,
    'c1111111-1111-4111-8111-000000000074'::uuid AS id_ex_e,
    'c1111111-1111-4111-8111-000000000075'::uuid AS id_ex_r,
    'c1111111-1111-4111-8111-000000000076'::uuid AS id_ex_l4_w,
    'c1111111-1111-4111-8111-000000000077'::uuid AS id_ex_l4_e,
    'c1111111-1111-4111-8111-000000000078'::uuid AS id_ex_l4_r
)
INSERT INTO categories (id, name, parent_id, level, sort_order)
SELECT id_ex_peel, '각질제거', p_exfo, 2, 0 FROM k
UNION ALL SELECT id_ex_amp, '앰플집중케어', p_exfo, 2, 1 FROM k
UNION ALL SELECT id_ex_aha, 'AHA', id_ex_peel, 3, 0 FROM k
UNION ALL SELECT id_ex_bha, 'BHA', id_ex_peel, 3, 1 FROM k
UNION ALL SELECT id_ex_enzyme, '효소', id_ex_peel, 3, 2 FROM k
UNION ALL SELECT id_ex_l4_aha, 'AHA 각질케어', id_ex_aha, 4, 0 FROM k
UNION ALL SELECT id_ex_l4_bha, 'BHA 각질케어', id_ex_bha, 4, 0 FROM k
UNION ALL SELECT id_ex_l4_enzyme, '효소 각질케어', id_ex_enzyme, 4, 0 FROM k
UNION ALL SELECT id_ex_w, '미백집중', id_ex_amp, 3, 0 FROM k
UNION ALL SELECT id_ex_e, '탄력집중', id_ex_amp, 3, 1 FROM k
UNION ALL SELECT id_ex_r, '재생집중', id_ex_amp, 3, 2 FROM k
UNION ALL SELECT id_ex_l4_w, '미백집중 앰플케어', id_ex_w, 4, 0 FROM k
UNION ALL SELECT id_ex_l4_e, '탄력집중 앰플케어', id_ex_e, 4, 0 FROM k
UNION ALL SELECT id_ex_l4_r, '재생집중 앰플케어', id_ex_r, 4, 0 FROM k;

-- ═══════════════════════════════════════════════════════════════════════════
-- Level 2–4 · 선케어
-- ═══════════════════════════════════════════════════════════════════════════
WITH k AS (
  SELECT
    'c1111111-1111-4111-8111-000000000004'::uuid AS p_sun,
    'c1111111-1111-4111-8111-000000000079'::uuid AS id_sun_cream,
    'c1111111-1111-4111-8111-000000000080'::uuid AS id_sun_stick,
    'c1111111-1111-4111-8111-000000000081'::uuid AS id_sun_serum,
    'c1111111-1111-4111-8111-000000000082'::uuid AS id_sun_cream_l3,
    'c1111111-1111-4111-8111-000000000083'::uuid AS id_sun_stick_l3,
    'c1111111-1111-4111-8111-000000000084'::uuid AS id_sun_serum_l3,
    'c1111111-1111-4111-8111-000000000085'::uuid AS id_sun_cream_l4,
    'c1111111-1111-4111-8111-000000000086'::uuid AS id_sun_stick_l4,
    'c1111111-1111-4111-8111-000000000087'::uuid AS id_sun_serum_l4
)
INSERT INTO categories (id, name, parent_id, level, sort_order)
SELECT id_sun_cream, '선크림', p_sun, 2, 0 FROM k
UNION ALL SELECT id_sun_stick, '선스틱', p_sun, 2, 1 FROM k
UNION ALL SELECT id_sun_serum, '선세럼', p_sun, 2, 2 FROM k
UNION ALL SELECT id_sun_cream_l3, '기본', id_sun_cream, 3, 0 FROM k
UNION ALL SELECT id_sun_stick_l3, '기본', id_sun_stick, 3, 0 FROM k
UNION ALL SELECT id_sun_serum_l3, '기본', id_sun_serum, 3, 0 FROM k
UNION ALL SELECT id_sun_cream_l4, '선크림', id_sun_cream_l3, 4, 0 FROM k
UNION ALL SELECT id_sun_stick_l4, '선스틱', id_sun_stick_l3, 4, 0 FROM k
UNION ALL SELECT id_sun_serum_l4, '선세럼', id_sun_serum_l3, 4, 0 FROM k;

-- ═══════════════════════════════════════════════════════════════════════════
-- Level 2–4 · 바디케어
-- ═══════════════════════════════════════════════════════════════════════════
WITH k AS (
  SELECT
    'c1111111-1111-4111-8111-000000000005'::uuid AS p_body,
    'c1111111-1111-4111-8111-000000000088'::uuid AS id_bd_lotion,
    'c1111111-1111-4111-8111-000000000089'::uuid AS id_bd_oil,
    'c1111111-1111-4111-8111-000000000090'::uuid AS id_bd_scrub,
    'c1111111-1111-4111-8111-000000000091'::uuid AS id_bd_lotion_l3,
    'c1111111-1111-4111-8111-000000000092'::uuid AS id_bd_oil_l3,
    'c1111111-1111-4111-8111-000000000093'::uuid AS id_bd_scrub_l3,
    'c1111111-1111-4111-8111-000000000094'::uuid AS id_bd_lotion_l4,
    'c1111111-1111-4111-8111-000000000095'::uuid AS id_bd_oil_l4,
    'c1111111-1111-4111-8111-000000000096'::uuid AS id_bd_scrub_l4
)
INSERT INTO categories (id, name, parent_id, level, sort_order)
SELECT id_bd_lotion, '바디로션·크림', p_body, 2, 0 FROM k
UNION ALL SELECT id_bd_oil, '바디오일', p_body, 2, 1 FROM k
UNION ALL SELECT id_bd_scrub, '바디스크럽', p_body, 2, 2 FROM k
UNION ALL SELECT id_bd_lotion_l3, '케어', id_bd_lotion, 3, 0 FROM k
UNION ALL SELECT id_bd_oil_l3, '케어', id_bd_oil, 3, 0 FROM k
UNION ALL SELECT id_bd_scrub_l3, '케어', id_bd_scrub, 3, 0 FROM k
UNION ALL SELECT id_bd_lotion_l4, '바디로션·크림', id_bd_lotion_l3, 4, 0 FROM k
UNION ALL SELECT id_bd_oil_l4, '바디오일', id_bd_oil_l3, 4, 0 FROM k
UNION ALL SELECT id_bd_scrub_l4, '바디스크럽', id_bd_scrub_l3, 4, 0 FROM k;

-- ═══════════════════════════════════════════════════════════════════════════
-- Level 2–4 · 아로마·호르몬케어
-- ═══════════════════════════════════════════════════════════════════════════
WITH k AS (
  SELECT
    'c1111111-1111-4111-8111-000000000006'::uuid AS p_aroma,
    'c1111111-1111-4111-8111-000000000097'::uuid AS id_ar_face,
    'c1111111-1111-4111-8111-000000000098'::uuid AS id_ar_body,
    'c1111111-1111-4111-8111-000000000099'::uuid AS id_ar_diff,
    'c1111111-1111-4111-8111-000000000100'::uuid AS id_ar_f1,
    'c1111111-1111-4111-8111-000000000101'::uuid AS id_ar_f2,
    'c1111111-1111-4111-8111-000000000102'::uuid AS id_ar_f3,
    'c1111111-1111-4111-8111-000000000103'::uuid AS id_ar_f1l4,
    'c1111111-1111-4111-8111-000000000104'::uuid AS id_ar_f2l4,
    'c1111111-1111-4111-8111-000000000105'::uuid AS id_ar_f3l4,
    'c1111111-1111-4111-8111-000000000106'::uuid AS id_ar_b1,
    'c1111111-1111-4111-8111-000000000107'::uuid AS id_ar_b2,
    'c1111111-1111-4111-8111-000000000108'::uuid AS id_ar_b3,
    'c1111111-1111-4111-8111-000000000109'::uuid AS id_ar_b1l4,
    'c1111111-1111-4111-8111-000000000110'::uuid AS id_ar_b2l4,
    'c1111111-1111-4111-8111-000000000111'::uuid AS id_ar_b3l4,
    'c1111111-1111-4111-8111-000000000112'::uuid AS id_ar_d_l3,
    'c1111111-1111-4111-8111-000000000113'::uuid AS id_ar_d_l4
)
INSERT INTO categories (id, name, parent_id, level, sort_order)
SELECT id_ar_face, '페이셜아로마', p_aroma, 2, 0 FROM k
UNION ALL SELECT id_ar_body, '바디아로마', p_aroma, 2, 1 FROM k
UNION ALL SELECT id_ar_diff, '디퓨저·향', p_aroma, 2, 2 FROM k
UNION ALL SELECT id_ar_f1, '열감·홍조케어', id_ar_face, 3, 0 FROM k
UNION ALL SELECT id_ar_f2, '진정·릴렉싱', id_ar_face, 3, 1 FROM k
UNION ALL SELECT id_ar_f3, '수면케어', id_ar_face, 3, 2 FROM k
UNION ALL SELECT id_ar_f1l4, '페이셜아로마 · 열감·홍조', id_ar_f1, 4, 0 FROM k
UNION ALL SELECT id_ar_f2l4, '페이셜아로마 · 진정·릴렉싱', id_ar_f2, 4, 0 FROM k
UNION ALL SELECT id_ar_f3l4, '페이셜아로마 · 수면케어', id_ar_f3, 4, 0 FROM k
UNION ALL SELECT id_ar_b1, '순환·림프', id_ar_body, 3, 0 FROM k
UNION ALL SELECT id_ar_b2, '릴렉싱', id_ar_body, 3, 1 FROM k
UNION ALL SELECT id_ar_b3, '에너지업', id_ar_body, 3, 2 FROM k
UNION ALL SELECT id_ar_b1l4, '바디아로마 · 순환·림프', id_ar_b1, 4, 0 FROM k
UNION ALL SELECT id_ar_b2l4, '바디아로마 · 릴렉싱', id_ar_b2, 4, 0 FROM k
UNION ALL SELECT id_ar_b3l4, '바디아로마 · 에너지업', id_ar_b3, 4, 0 FROM k
UNION ALL SELECT id_ar_d_l3, '공간향', id_ar_diff, 3, 0 FROM k
UNION ALL SELECT id_ar_d_l4, '디퓨저·향', id_ar_d_l3, 4, 0 FROM k;

-- ═══════════════════════════════════════════════════════════════════════════
-- Level 2–4 · 헤어케어
-- ═══════════════════════════════════════════════════════════════════════════
WITH k AS (
  SELECT
    'c1111111-1111-4111-8111-000000000007'::uuid AS p_hair,
    'c1111111-1111-4111-8111-000000000114'::uuid AS id_h_shampoo,
    'c1111111-1111-4111-8111-000000000115'::uuid AS id_h_treat,
    'c1111111-1111-4111-8111-000000000116'::uuid AS id_h_scalp,
    'c1111111-1111-4111-8111-000000000117'::uuid AS id_h_shampoo_l3,
    'c1111111-1111-4111-8111-000000000118'::uuid AS id_h_treat_l3,
    'c1111111-1111-4111-8111-000000000119'::uuid AS id_h_scalp_l3,
    'c1111111-1111-4111-8111-000000000120'::uuid AS id_h_shampoo_l4,
    'c1111111-1111-4111-8111-000000000121'::uuid AS id_h_treat_l4,
    'c1111111-1111-4111-8111-000000000122'::uuid AS id_h_scalp_l4
)
INSERT INTO categories (id, name, parent_id, level, sort_order)
SELECT id_h_shampoo, '샴푸', p_hair, 2, 0 FROM k
UNION ALL SELECT id_h_treat, '트리트먼트', p_hair, 2, 1 FROM k
UNION ALL SELECT id_h_scalp, '두피케어', p_hair, 2, 2 FROM k
UNION ALL SELECT id_h_shampoo_l3, '케어', id_h_shampoo, 3, 0 FROM k
UNION ALL SELECT id_h_treat_l3, '케어', id_h_treat, 3, 0 FROM k
UNION ALL SELECT id_h_scalp_l3, '케어', id_h_scalp, 3, 0 FROM k
UNION ALL SELECT id_h_shampoo_l4, '샴푸', id_h_shampoo_l3, 4, 0 FROM k
UNION ALL SELECT id_h_treat_l4, '트리트먼트', id_h_treat_l3, 4, 0 FROM k
UNION ALL SELECT id_h_scalp_l4, '두피케어', id_h_scalp_l3, 4, 0 FROM k;

-- ═══════════════════════════════════════════════════════════════════════════
-- Level 5 · 스킨태그 (parent_id NULL::uuid, 요청대로)
-- ═══════════════════════════════════════════════════════════════════════════
WITH k AS (
  SELECT
    'c1111111-1111-4111-8111-000000000125'::uuid AS id_t01,
    'c1111111-1111-4111-8111-000000000126'::uuid AS id_t02,
    'c1111111-1111-4111-8111-000000000127'::uuid AS id_t03,
    'c1111111-1111-4111-8111-000000000128'::uuid AS id_t04,
    'c1111111-1111-4111-8111-000000000129'::uuid AS id_t05,
    'c1111111-1111-4111-8111-000000000130'::uuid AS id_t06,
    'c1111111-1111-4111-8111-000000000131'::uuid AS id_t07,
    'c1111111-1111-4111-8111-000000000132'::uuid AS id_t08,
    'c1111111-1111-4111-8111-000000000133'::uuid AS id_t09,
    'c1111111-1111-4111-8111-000000000134'::uuid AS id_t10,
    'c1111111-1111-4111-8111-000000000135'::uuid AS id_t11,
    'c1111111-1111-4111-8111-000000000136'::uuid AS id_t12,
    'c1111111-1111-4111-8111-000000000137'::uuid AS id_t13,
    'c1111111-1111-4111-8111-000000000138'::uuid AS id_t14,
    'c1111111-1111-4111-8111-000000000139'::uuid AS id_t15,
    'c1111111-1111-4111-8111-000000000140'::uuid AS id_t16,
    'c1111111-1111-4111-8111-000000000141'::uuid AS id_t17,
    'c1111111-1111-4111-8111-000000000142'::uuid AS id_t18,
    'c1111111-1111-4111-8111-000000000143'::uuid AS id_t19,
    'c1111111-1111-4111-8111-000000000144'::uuid AS id_t20,
    'c1111111-1111-4111-8111-000000000145'::uuid AS id_t21,
    'c1111111-1111-4111-8111-000000000146'::uuid AS id_t22,
    'c1111111-1111-4111-8111-000000000147'::uuid AS id_t23,
    'c1111111-1111-4111-8111-000000000148'::uuid AS id_t24,
    'c1111111-1111-4111-8111-000000000149'::uuid AS id_t25,
    'c1111111-1111-4111-8111-000000000150'::uuid AS id_t26,
    'c1111111-1111-4111-8111-000000000151'::uuid AS id_t27,
    'c1111111-1111-4111-8111-000000000152'::uuid AS id_t28,
    'c1111111-1111-4111-8111-000000000153'::uuid AS id_t29,
    'c1111111-1111-4111-8111-000000000154'::uuid AS id_t30,
    'c1111111-1111-4111-8111-000000000155'::uuid AS id_t31,
    'c1111111-1111-4111-8111-000000000156'::uuid AS id_t32,
    'c1111111-1111-4111-8111-000000000157'::uuid AS id_t33,
    'c1111111-1111-4111-8111-000000000158'::uuid AS id_t34,
    'c1111111-1111-4111-8111-000000000159'::uuid AS id_t35
)
INSERT INTO categories (id, name, parent_id, level, sort_order)
SELECT id_t01, '#건성', NULL::uuid, 5, 0 FROM k
UNION ALL SELECT id_t02, '#지성', NULL::uuid, 5, 1 FROM k
UNION ALL SELECT id_t03, '#복합성', NULL::uuid, 5, 2 FROM k
UNION ALL SELECT id_t04, '#민감성', NULL::uuid, 5, 3 FROM k
UNION ALL SELECT id_t05, '#탄력', NULL::uuid, 5, 4 FROM k
UNION ALL SELECT id_t06, '#미백', NULL::uuid, 5, 5 FROM k
UNION ALL SELECT id_t07, '#수분', NULL::uuid, 5, 6 FROM k
UNION ALL SELECT id_t08, '#트러블', NULL::uuid, 5, 7 FROM k
UNION ALL SELECT id_t09, '#모공', NULL::uuid, 5, 8 FROM k
UNION ALL SELECT id_t10, '#홍조', NULL::uuid, 5, 9 FROM k
UNION ALL SELECT id_t11, '#재생', NULL::uuid, 5, 10 FROM k
UNION ALL SELECT id_t12, '#각질', NULL::uuid, 5, 11 FROM k
UNION ALL SELECT id_t13, '#갱년기', NULL::uuid, 5, 12 FROM k
UNION ALL SELECT id_t14, '#열감', NULL::uuid, 5, 13 FROM k
UNION ALL SELECT id_t15, '#호르몬밸런스', NULL::uuid, 5, 14 FROM k
UNION ALL SELECT id_t16, '#황체기', NULL::uuid, 5, 15 FROM k
UNION ALL SELECT id_t17, '#여포기', NULL::uuid, 5, 16 FROM k
UNION ALL SELECT id_t18, '#황금기', NULL::uuid, 5, 17 FROM k
UNION ALL SELECT id_t19, '#집중케어', NULL::uuid, 5, 18 FROM k
UNION ALL SELECT id_t20, '#데일리', NULL::uuid, 5, 19 FROM k
UNION ALL SELECT id_t21, '#야간케어', NULL::uuid, 5, 20 FROM k
UNION ALL SELECT id_t22, '#40대', NULL::uuid, 5, 21 FROM k
UNION ALL SELECT id_t23, '#50대', NULL::uuid, 5, 22 FROM k
UNION ALL SELECT id_t24, '#60대이상', NULL::uuid, 5, 23 FROM k
UNION ALL SELECT id_t25, '#펩타이드', NULL::uuid, 5, 24 FROM k
UNION ALL SELECT id_t26, '#레티놀', NULL::uuid, 5, 25 FROM k
UNION ALL SELECT id_t27, '#비타민C', NULL::uuid, 5, 26 FROM k
UNION ALL SELECT id_t28, '#히알루론산', NULL::uuid, 5, 27 FROM k
UNION ALL SELECT id_t29, '#세라마이드', NULL::uuid, 5, 28 FROM k
UNION ALL SELECT id_t30, '#라벤더', NULL::uuid, 5, 29 FROM k
UNION ALL SELECT id_t31, '#로즈', NULL::uuid, 5, 30 FROM k
UNION ALL SELECT id_t32, '#클라리세이지', NULL::uuid, 5, 31 FROM k
UNION ALL SELECT id_t33, '#장벽강화', NULL::uuid, 5, 32 FROM k
UNION ALL SELECT id_t34, '#각질케어', NULL::uuid, 5, 33 FROM k
UNION ALL SELECT id_t35, '#갱년기탈모', NULL::uuid, 5, 34 FROM k;

COMMIT;

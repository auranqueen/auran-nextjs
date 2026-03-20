INSERT INTO public.admin_settings (category, key, value, label, unit, value_type)
VALUES
  ('home_search', 'enabled', '1', '검색바 활성화', '', 'number'),
  ('home_search', 'placeholder', '전체상품 검색 (브랜드/상품명/설명)', '검색 안내 문구', '', 'text'),
  ('home_search', 'fields', 'name,description,brand', '검색 대상 필드(csv)', '', 'text'),
  ('home_search', 'min_chars', '1', '최소 검색 글자수', '자', 'number'),
  ('home_search', 'show_result_count', '1', '검색 결과 개수 표시', '', 'number')
ON CONFLICT (category, key) DO UPDATE
SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  unit = EXCLUDED.unit,
  value_type = EXCLUDED.value_type,
  updated_at = now();

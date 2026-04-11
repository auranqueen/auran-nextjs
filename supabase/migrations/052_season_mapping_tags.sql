-- season_product_mapping에 단계·기능 태그 추가
ALTER TABLE public.season_product_mapping
  ADD COLUMN IF NOT EXISTS step_tag TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS func_tag TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.season_product_mapping.step_tag
  IS '루틴 단계: 클렌징|토너|앰플|크림|선크림|기타';

COMMENT ON COLUMN public.season_product_mapping.func_tag
  IS '기능: 미백|탄력|수분|진정|장벽|기타';

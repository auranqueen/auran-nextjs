CREATE TABLE IF NOT EXISTS public.weather_product_mapping (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  weather_tags  TEXT[] NOT NULL DEFAULT '{}',
  hormone_tags  TEXT[] NOT NULL DEFAULT '{}',
  skin_tags     TEXT[] NOT NULL DEFAULT '{}',
  season_tags   TEXT[] NOT NULL DEFAULT '{}',
  product_id    UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  reason_text   TEXT NOT NULL DEFAULT '',
  priority      INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.weather_product_mapping.weather_tags
  IS '날씨조건: 자외선높음|자외선매우높음|미세먼지나쁨|황사|일교차큼|건조';

COMMENT ON COLUMN public.weather_product_mapping.hormone_tags
  IS '호르몬단계: 달빛기|황금기|만개기|물들기|갱년기|남성|전체';

COMMENT ON COLUMN public.weather_product_mapping.skin_tags
  IS '피부타입: 건성|지성|복합|민감|중성|전체';

COMMENT ON COLUMN public.weather_product_mapping.season_tags
  IS '계절: 봄|여름|가을|겨울|전체';

COMMENT ON COLUMN public.weather_product_mapping.reason_text
  IS '원장 작성 추천 이유 (? 버튼 노출용)';

CREATE INDEX IF NOT EXISTS
  weather_product_mapping_weather_tags_idx
  ON public.weather_product_mapping
  USING GIN (weather_tags);

CREATE INDEX IF NOT EXISTS
  weather_product_mapping_hormone_tags_idx
  ON public.weather_product_mapping
  USING GIN (hormone_tags);

CREATE INDEX IF NOT EXISTS
  weather_product_mapping_active_idx
  ON public.weather_product_mapping
  (is_active, priority);

ALTER TABLE public.weather_product_mapping
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weather_product_mapping_all"
  ON public.weather_product_mapping
  FOR ALL USING (true) WITH CHECK (true);

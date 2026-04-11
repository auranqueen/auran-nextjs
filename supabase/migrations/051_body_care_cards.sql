CREATE TABLE IF NOT EXISTS public.body_care_cards (
  id            UUID PRIMARY KEY
                DEFAULT uuid_generate_v4(),
  phase_tags    TEXT[]  NOT NULL DEFAULT '{}',
  category_tags TEXT[]  NOT NULL DEFAULT '{}',
  title         TEXT    NOT NULL DEFAULT '',
  care          TEXT    NOT NULL DEFAULT '',
  quote         TEXT    NOT NULL DEFAULT '',
  product_ids   UUID[]  NOT NULL DEFAULT '{}',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.body_care_cards.product_ids
  IS 'FK → public.products(id) 배열';

COMMENT ON COLUMN public.body_care_cards.phase_tags
  IS '달빛기|황금기|만개기|물들기|갱년기|남성|all';

CREATE INDEX IF NOT EXISTS
  body_care_cards_phase_tags_idx
  ON public.body_care_cards
  USING GIN (phase_tags);

CREATE INDEX IF NOT EXISTS
  body_care_cards_active_idx
  ON public.body_care_cards (is_active, sort_order);

ALTER TABLE public.body_care_cards
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "body_care_cards_all"
  ON public.body_care_cards
  FOR ALL USING (true) WITH CHECK (true);

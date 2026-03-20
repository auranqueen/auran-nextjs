-- ============================================================
-- 4. admin_settings (AURAN dev-rule 기반 동적 설정)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_settings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category    TEXT NOT NULL,
  key         TEXT NOT NULL,
  value       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_settings_category_key_uq
  ON public.admin_settings(category, key);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- public select 허용 (어드민 UI/유저 화면에서 읽기)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_settings' AND policyname = 'admin_settings_public_read'
  ) THEN
    CREATE POLICY "admin_settings_public_read" ON public.admin_settings
      FOR SELECT USING (true);
  END IF;
END $$;

-- admin만 insert/update/delete 허용
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_settings' AND policyname = 'admin_settings_admin_write'
  ) THEN
    CREATE POLICY "admin_settings_admin_write" ON public.admin_settings
      FOR ALL
      USING (
        EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- ============================================================
-- Seed: skin quiz + myworld limits
-- ============================================================

INSERT INTO public.admin_settings (category, key, value)
VALUES
  -- skin quiz
  ('skin_quiz', 'reward_points', '500'),
  ('skin_quiz', 'recommend_product_limit', '5'),
  ('skin_quiz', 'product_search_limit', '200'),
  ('skin_quiz', 'product_min_price', '0'),
  (
    'skin_quiz',
    'quiz_deltas_json',
    '{
      "dry3": {"dry": 3},
      "dry1_combo1": {"dry": 1, "combo": 1},
      "combo2": {"combo": 2},
      "combo2_from_normal": {"combo": 2},
      "oily3": {"oily": 3},

      "dry2": {"dry": 2},
      "acne2": {"acne": 2},
      "oily1_acne1": {"oily": 1, "acne": 1},
      "pigment2": {"pigment": 2},
      "sensitive2": {"sensitive": 2},
      "aging2": {"aging": 2},

      "q3_dry2": {"dry": 2},
      "q3_normal2": {"combo": 2},
      "q3_combo2": {"combo": 2},
      "q3_oily3": {"oily": 3},

      "q4_normal1": {"combo": 1},
      "q4_pigment2": {"pigment": 2},
      "q4_acne3": {"acne": 3},
      "q4_acne2_pigment2": {"acne": 2, "pigment": 2},

      "diet_unbalanced_acne1": {"acne": 1},
      "diet_mid": {},
      "diet_balanced_normal1": {"combo": 1},

      "sunscreen_none_pigment1_aging1": {"pigment": 1, "aging": 1},
      "sunscreen_some_mid": {},
      "sunscreen_daily_normal1": {"combo": 1}
    }'
  ),

  -- myworld
  ('myworld', 'guestbook_max_chars', '300'),
  ('myworld', 'journals_fetch_limit', '30'),
  ('myworld', 'guestbook_fetch_limit', '50'),
  ('myworld', 'orders_fetch_limit', '30'),
  ('myworld', 'review_max_images', '5'),
  ('myworld', 'review_preview_max', '4'),
  ('myworld', 'review_star_min', '1'),
  ('myworld', 'review_star_max', '5'),
  ('myworld', 'journal_score_min', '1'),
  ('myworld', 'journal_score_max', '5'),
  ('myworld', 'journal_score_default', '3')
ON CONFLICT (category, key)
DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();


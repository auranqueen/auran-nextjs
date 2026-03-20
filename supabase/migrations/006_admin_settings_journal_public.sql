-- ============================================================
-- 6. admin_settings (Journal Public Page limits)
-- ============================================================

INSERT INTO public.admin_settings (category, key, value)
VALUES
  ('journal_public', 'guestbook_fetch_limit', '20'),
  ('journal_public', 'used_products_preview_max', '4'),
  ('journal_public', 'guestbook_preview_max', '6')
ON CONFLICT (category, key)
DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();


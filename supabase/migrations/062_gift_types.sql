-- 멤버십 선물 타입 마스터 + membership_gifts FK

CREATE TABLE IF NOT EXISTS public.gift_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🎁',
  is_active BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gift_types_order ON public.gift_types ("order");
CREATE INDEX IF NOT EXISTS idx_gift_types_active ON public.gift_types (is_active);

ALTER TABLE public.membership_gifts
  ADD COLUMN IF NOT EXISTS gift_type_id UUID REFERENCES public.gift_types(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_membership_gifts_gift_type_id ON public.membership_gifts (gift_type_id);

INSERT INTO public.gift_types (name, emoji, "order")
SELECT v.name, v.emoji, v.ord
FROM (
  VALUES
    ('생일 축하', '🎂', 1),
    ('환영 선물', '🎉', 2),
    ('기념일 선물', '💝', 3),
    ('감사 선물', '🌟', 4),
    ('멤버십 특별', '🎁', 5),
    ('축하 선물', '💐', 6),
    ('이벤트 선물', '🎊', 7),
    ('오랜 선물', '💜', 8)
) AS v(name, emoji, ord)
WHERE NOT EXISTS (SELECT 1 FROM public.gift_types LIMIT 1);

ALTER TABLE public.gift_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gift_types_select_active ON public.gift_types;
CREATE POLICY gift_types_select_active ON public.gift_types
  FOR SELECT TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS gift_types_admin_all ON public.gift_types;
CREATE POLICY gift_types_admin_all ON public.gift_types
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid() AND u.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.auth_id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid() AND u.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.auth_id = auth.uid() AND p.role = 'admin'
    )
  );

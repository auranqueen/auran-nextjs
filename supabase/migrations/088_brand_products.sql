-- 088_brand_products.sql
-- 브랜드 재고발주 전용 제품 (products와 물리 분리). 빈 테이블로 시작.

CREATE TABLE IF NOT EXISTS public.brand_products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id          UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  brand_user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  supply_price      INTEGER NOT NULL DEFAULT 0,
  origin_country    TEXT NOT NULL DEFAULT '대한민국',
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'hidden', 'discontinued')),
  thumb_img         TEXT,
  images            TEXT[] DEFAULT '{}',
  description       TEXT,
  category_id       UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  category          TEXT,
  tag               TEXT,
  event_banner      JSONB,
  ingredient_main   TEXT,
  ingredient_full   TEXT,
  detail_content    TEXT,
  detail_images     TEXT[] DEFAULT '{}',
  skin_concern      TEXT[] DEFAULT '{}',
  skin_type         TEXT[] DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.brand_products IS
  '브랜드 자체 등록 재고발주 전용. 오렌 쇼핑몰 products와 완전 분리.';

COMMENT ON COLUMN public.brand_products.brand_user_id IS
  '등록 브랜드 계정 users.id';

COMMENT ON COLUMN public.brand_products.origin_country IS
  '서버 BRAND_ORIGIN_MAP 자동 결정. 클라이언트 입력 불가.';

COMMENT ON COLUMN public.brand_products.event_banner IS
  '이벤트 배너 JSON: { emoji, title, desc, starts_at, ends_at, image_url }';

COMMENT ON COLUMN public.brand_products.ingredient_main IS '주요 성분';
COMMENT ON COLUMN public.brand_products.ingredient_full IS '전성분';
COMMENT ON COLUMN public.brand_products.detail_content IS '상세 설명 HTML/텍스트';
COMMENT ON COLUMN public.brand_products.detail_images IS '상세 이미지 URL 배열';
COMMENT ON COLUMN public.brand_products.skin_concern IS '피부 고민 태그';
COMMENT ON COLUMN public.brand_products.skin_type IS '피부 타입 태그';

CREATE INDEX IF NOT EXISTS idx_brand_products_brand_id
  ON public.brand_products(brand_id);

CREATE INDEX IF NOT EXISTS idx_brand_products_brand_status
  ON public.brand_products(brand_id, status);

CREATE INDEX IF NOT EXISTS idx_brand_products_brand_user_id
  ON public.brand_products(brand_user_id);

CREATE INDEX IF NOT EXISTS idx_brand_products_category_id
  ON public.brand_products(category_id)
  WHERE category_id IS NOT NULL;

ALTER TABLE public.brand_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brand_products_select_active ON public.brand_products;
CREATE POLICY brand_products_select_active ON public.brand_products
  FOR SELECT
  USING (status = 'active' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS brand_products_brand_select_own ON public.brand_products;
CREATE POLICY brand_products_brand_select_own ON public.brand_products
  FOR SELECT
  USING (
    brand_user_id = public.current_user_id()
    OR brand_user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS brand_products_brand_insert_own ON public.brand_products;
CREATE POLICY brand_products_brand_insert_own ON public.brand_products
  FOR INSERT
  WITH CHECK (
    brand_user_id = public.current_user_id()
    OR brand_user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS brand_products_brand_update_own ON public.brand_products;
CREATE POLICY brand_products_brand_update_own ON public.brand_products
  FOR UPDATE
  USING (
    brand_user_id = public.current_user_id()
    OR brand_user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    brand_user_id = public.current_user_id()
    OR brand_user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS brand_products_brand_delete_own ON public.brand_products;
CREATE POLICY brand_products_brand_delete_own ON public.brand_products
  FOR DELETE
  USING (
    brand_user_id = public.current_user_id()
    OR brand_user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS brand_products_admin_all ON public.brand_products;
CREATE POLICY brand_products_admin_all ON public.brand_products
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  );

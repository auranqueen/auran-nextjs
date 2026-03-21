-- Public bucket for migrated product thumbnails (duchess.kr → Supabase Storage)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Idempotent policies
DROP POLICY IF EXISTS "공개 읽기" ON storage.objects;
DROP POLICY IF EXISTS "서비스롤 업로드" ON storage.objects;
DROP POLICY IF EXISTS "product_images_upsert" ON storage.objects;

CREATE POLICY "공개 읽기"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Scripts use service role (bypasses RLS). Policies below help authenticated dashboard uploads / upsert.
CREATE POLICY "서비스롤 업로드"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "product_images_upsert"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-images')
  WITH CHECK (bucket_id = 'product-images');

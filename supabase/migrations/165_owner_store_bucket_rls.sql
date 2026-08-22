DROP POLICY IF EXISTS "owner_store_공개읽기" ON storage.objects;
DROP POLICY IF EXISTS "owner_store_인증사용자업로드" ON storage.objects;
DROP POLICY IF EXISTS "owner_store_인증사용자수정" ON storage.objects;

INSERT INTO storage.buckets (id, name, public)
VALUES ('owner-store', 'owner-store', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "owner_store_공개읽기"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'owner-store');

CREATE POLICY "owner_store_인증사용자업로드"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'owner-store');

CREATE POLICY "owner_store_인증사용자수정"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'owner-store')
  WITH CHECK (bucket_id = 'owner-store');

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'products'
      AND policyname = 'public read products'
  ) THEN
    CREATE POLICY "public read products"
    ON public.products
    FOR SELECT
    TO anon, authenticated
    USING (true);
  END IF;
END $$;

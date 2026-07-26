-- 1) brand_billing_invoices 컴퍼니 통합
ALTER TABLE public.brand_billing_invoices
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.brand_companies(id);

UPDATE public.brand_billing_invoices bi
SET company_id = b.company_id
FROM public.brands b
WHERE bi.brand_id = b.id AND bi.company_id IS NULL;

ALTER TABLE public.brand_billing_invoices
  DROP CONSTRAINT IF EXISTS brand_billing_invoices_brand_id_owner_id_billing_month_key;

ALTER TABLE public.brand_billing_invoices
  ADD CONSTRAINT brand_billing_invoices_company_owner_month_key
  UNIQUE (company_id, owner_id, billing_month);

ALTER TABLE public.brand_billing_invoices
  ALTER COLUMN brand_id DROP NOT NULL;

-- 2) brand_companies PayApp + 로고
ALTER TABLE public.brand_companies
  ADD COLUMN IF NOT EXISTS payapp_active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payapp_user_id TEXT,
  ADD COLUMN IF NOT EXISTS payapp_key TEXT,
  ADD COLUMN IF NOT EXISTS payapp_linkval TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 3) brand_payment_intents 컴퍼니 통합
ALTER TABLE public.brand_payment_intents
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.brand_companies(id);

ALTER TABLE public.brand_payment_intents
  ALTER COLUMN brand_id DROP NOT NULL;

-- 4) RLS: 브랜드사가 컴퍼니 단위로 청구서/결제intent 조회 가능하도록
CREATE POLICY brand_billing_invoices_company_select ON public.brand_billing_invoices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.company_id = brand_billing_invoices.company_id
        AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
    )
  );

CREATE POLICY brand_payment_intents_company_select ON public.brand_payment_intents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.company_id = brand_payment_intents.company_id
        AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
    )
  );

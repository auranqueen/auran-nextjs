-- 084_brand_self_payment_rollback.sql

DROP TRIGGER IF EXISTS brand_payment_intents_updated_at ON public.brand_payment_intents;

DROP POLICY IF EXISTS brand_payment_intents_admin_all ON public.brand_payment_intents;
DROP POLICY IF EXISTS brand_payment_intents_brand_select ON public.brand_payment_intents;
DROP POLICY IF EXISTS brand_payment_intents_owner_select ON public.brand_payment_intents;

DROP TABLE IF EXISTS public.brand_payment_intents;

ALTER TABLE public.brands DROP COLUMN IF EXISTS payapp_linkval;

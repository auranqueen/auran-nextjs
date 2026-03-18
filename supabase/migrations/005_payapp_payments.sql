-- ============================================================
-- 005. PayApp Payments (payment_intents + webhook logs)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payment_intents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  provider TEXT NOT NULL DEFAULT 'payapp',               -- payapp
  kind TEXT NOT NULL,                                    -- charge | order | booking | ...
  status TEXT NOT NULL DEFAULT 'pending',                -- pending | paid | failed | cancelled

  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  target_id UUID,                                        -- domain record id (order/booking/etc)

  amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'KRW',

  -- PayApp identifiers
  provider_trade_id TEXT,                                -- mul_no
  pay_url TEXT,

  -- audit times
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_provider_trade
  ON public.payment_intents(provider, provider_trade_id)
  WHERE provider_trade_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_intents_user_created
  ON public.payment_intents(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_intents_status
  ON public.payment_intents(status);

CREATE TABLE IF NOT EXISTS public.payment_webhook_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  provider TEXT NOT NULL DEFAULT 'payapp',
  provider_trade_id TEXT,                                -- mul_no if present
  event_type TEXT,                                       -- pay_state etc

  raw_body TEXT,
  headers JSONB,

  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified BOOLEAN NOT NULL DEFAULT false,
  handled BOOLEAN NOT NULL DEFAULT false,
  handle_result TEXT
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_logs_trade
  ON public.payment_webhook_logs(provider, provider_trade_id);


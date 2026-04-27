-- 1) Campos extras em orders para Mercado Pago
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_provider text NOT NULL DEFAULT 'mercadopago',
  ADD COLUMN IF NOT EXISTS mp_preference_id text,
  ADD COLUMN IF NOT EXISTS mp_payment_id text,
  ADD COLUMN IF NOT EXISTS mp_merchant_order_id text,
  ADD COLUMN IF NOT EXISTS external_reference text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS checkout_url text,
  ADD COLUMN IF NOT EXISTS payment_error text;

-- external_reference único quando presente
CREATE UNIQUE INDEX IF NOT EXISTS orders_external_reference_unique
  ON public.orders(external_reference)
  WHERE external_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_mp_payment_id_idx ON public.orders(mp_payment_id);
CREATE INDEX IF NOT EXISTS orders_mp_preference_id_idx ON public.orders(mp_preference_id);

-- 2) Tabela de auditoria de webhooks
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'mercadopago',
  event_id text,
  action text,
  type text,
  data_id text,
  live_mode boolean,
  payload jsonb NOT NULL,
  headers jsonb,
  processed boolean NOT NULL DEFAULT false,
  processing_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_webhook_events_data_id_idx ON public.payment_webhook_events(data_id);
CREATE INDEX IF NOT EXISTS payment_webhook_events_created_at_idx ON public.payment_webhook_events(created_at DESC);

ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ler; gravação só via service role (bypass RLS)
DROP POLICY IF EXISTS payment_webhook_events_admin_read ON public.payment_webhook_events;
CREATE POLICY payment_webhook_events_admin_read
  ON public.payment_webhook_events
  FOR SELECT
  USING (public.is_admin(auth.uid()));
-- Onda 2: Campos financeiros do Mercado Pago em orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS mp_payment_method text,
  ADD COLUMN IF NOT EXISTS mp_payment_type text,
  ADD COLUMN IF NOT EXISTS mp_gross_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS mp_fee_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS mp_net_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS mp_fee_details jsonb,
  ADD COLUMN IF NOT EXISTS estimated_fee_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS estimated_net_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS payment_fee_source text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS payment_fee_calculated_at timestamptz,
  ADD COLUMN IF NOT EXISTS mp_last_webhook_at timestamptz,
  ADD COLUMN IF NOT EXISTS mp_webhook_status text,
  ADD COLUMN IF NOT EXISTS mp_webhook_error text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_fee_source_chk'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_payment_fee_source_chk
      CHECK (payment_fee_source IN ('mercado_pago_real','estimated','unknown'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_orders_payment_fee_source ON public.orders(payment_fee_source);
CREATE INDEX IF NOT EXISTS idx_orders_mp_last_webhook_at ON public.orders(mp_last_webhook_at);

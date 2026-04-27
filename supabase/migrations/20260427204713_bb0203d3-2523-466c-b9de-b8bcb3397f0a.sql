CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  customer_email text NOT NULL,
  type text NOT NULL,
  subject text NOT NULL,
  provider text NOT NULL DEFAULT 'resend',
  provider_message_id text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  payload jsonb,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_events_order_id ON public.email_events(order_id);
CREATE INDEX IF NOT EXISTS idx_email_events_created_at ON public.email_events(created_at DESC);

-- Idempotência: apenas 1 envio "sent" por (order_id, type)
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_events_sent_order_type
  ON public.email_events(order_id, type)
  WHERE status = 'sent' AND order_id IS NOT NULL;

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_events_admin_read
  ON public.email_events
  FOR SELECT
  USING (public.is_admin(auth.uid()));
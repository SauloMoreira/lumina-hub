-- Tabela de histórico de eventos do pedido (timeline administrativa)
CREATE TABLE IF NOT EXISTS public.order_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  type text NOT NULL,
  status text,
  description text,
  metadata jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_status_events_order_created
  ON public.order_status_events (order_id, created_at DESC);

ALTER TABLE public.order_status_events ENABLE ROW LEVEL SECURITY;

-- Admin pode ler tudo; dono do pedido pode ler eventos do próprio pedido
CREATE POLICY "order_status_events_admin_read"
  ON public.order_status_events
  FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "order_status_events_owner_read"
  ON public.order_status_events
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_status_events.order_id
      AND o.user_id = auth.uid()
  ));

-- Apenas admin insere via cliente (server functions usam service role e bypass RLS)
CREATE POLICY "order_status_events_admin_insert"
  ON public.order_status_events
  FOR INSERT
  WITH CHECK (is_admin(auth.uid()));
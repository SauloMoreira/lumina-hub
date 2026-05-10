CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL UNIQUE,
  display_name text NOT NULL,
  subject text,
  preheader text,
  headline text,
  intro_html text,
  cta_label text,
  cta_url text,
  secondary_cta_label text,
  secondary_cta_url text,
  is_active boolean NOT NULL DEFAULT true,
  auto_send boolean NOT NULL DEFAULT true,
  allow_manual_resend boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_templates_admin_all
ON public.email_templates
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE TRIGGER email_templates_set_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TRIGGER audit_email_templates
AFTER INSERT OR UPDATE OR DELETE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.audit_table_changes();

INSERT INTO public.email_templates (type, display_name, is_active, auto_send, allow_manual_resend)
VALUES
  ('order_created',     'Pedido recebido',     true, true,  true),
  ('payment_approved',  'Pagamento aprovado',  true, true,  true),
  ('payment_pending',   'Pagamento pendente',  true, true,  true),
  ('payment_failed',    'Pagamento recusado',  true, true,  true),
  ('order_processing',  'Pedido em separação', true, true,  true),
  ('order_shipped',     'Pedido enviado',      true, true,  true),
  ('order_delivered',   'Pedido entregue',     true, true,  true),
  ('order_cancelled',   'Pedido cancelado',    true, true,  true),
  ('order_refunded',    'Pedido reembolsado',  true, false, true)
ON CONFLICT (type) DO NOTHING;
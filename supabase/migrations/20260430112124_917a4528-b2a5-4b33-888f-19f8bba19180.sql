-- ============================================================
-- 1) Campos de nota fiscal em orders
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS invoice_status text NOT NULL DEFAULT 'nao_necessaria',
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS invoice_series text,
  ADD COLUMN IF NOT EXISTS invoice_access_key text,
  ADD COLUMN IF NOT EXISTS invoice_danfe_url text,
  ADD COLUMN IF NOT EXISTS invoice_xml_url text,
  ADD COLUMN IF NOT EXISTS invoice_issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_notes text,
  ADD COLUMN IF NOT EXISTS invoice_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice_registered_by uuid,
  ADD COLUMN IF NOT EXISTS invoice_registered_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_updated_at timestamptz;

-- Validação simples de status (trigger, não check, p/ permitir evolução)
CREATE OR REPLACE FUNCTION public.validate_invoice_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_status IS NOT NULL AND NEW.invoice_status NOT IN (
    'nao_necessaria','pendente_emissao','emitida','erro_emissao','cancelada'
  ) THEN
    RAISE EXCEPTION 'invalid invoice_status: %', NEW.invoice_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_validate_invoice_status ON public.orders;
CREATE TRIGGER trg_orders_validate_invoice_status
BEFORE INSERT OR UPDATE OF invoice_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.validate_invoice_status();

-- Quando o pedido for marcado como pago, deixa a nota como pendente_emissao
-- (a menos que já esteja emitida/cancelada). Não bloqueia logística.
CREATE OR REPLACE FUNCTION public.set_invoice_pending_on_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status = 'paid'
     AND (OLD.payment_status IS DISTINCT FROM 'paid')
     AND COALESCE(NEW.invoice_status,'nao_necessaria') IN ('nao_necessaria') THEN
    NEW.invoice_status := 'pendente_emissao';
    NEW.invoice_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_invoice_pending_on_paid ON public.orders;
CREATE TRIGGER trg_orders_invoice_pending_on_paid
BEFORE UPDATE OF payment_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_invoice_pending_on_paid();

-- Índices para a listagem
CREATE INDEX IF NOT EXISTS idx_orders_invoice_status ON public.orders(invoice_status);
CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON public.orders(paid_at);

-- ============================================================
-- 2) Auditoria de notas fiscais
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_invoice_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  event_type text NOT NULL,
  previous_status text,
  new_status text,
  previous_data jsonb,
  new_data jsonb,
  notes text,
  changed_by uuid,
  changed_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_invoice_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_invoice_audit_admin_read ON public.order_invoice_audit;
CREATE POLICY order_invoice_audit_admin_read
  ON public.order_invoice_audit
  FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS order_invoice_audit_admin_insert ON public.order_invoice_audit;
CREATE POLICY order_invoice_audit_admin_insert
  ON public.order_invoice_audit
  FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_order_invoice_audit_order ON public.order_invoice_audit(order_id, created_at DESC);

-- ============================================================
-- 3) Configurações fiscais (estrutura para integração futura)
-- ============================================================
ALTER TABLE public.finance_settings
  ADD COLUMN IF NOT EXISTS invoice_required_policy text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS invoice_required_min_value numeric,
  ADD COLUMN IF NOT EXISTS invoice_provider text,
  ADD COLUMN IF NOT EXISTS invoice_environment text NOT NULL DEFAULT 'homologacao',
  ADD COLUMN IF NOT EXISTS invoice_default_series text,
  ADD COLUMN IF NOT EXISTS invoice_default_cfop text,
  ADD COLUMN IF NOT EXISTS invoice_default_nature text,
  ADD COLUMN IF NOT EXISTS invoice_tax_regime text;

-- Normaliza pedidos existentes pagos sem status fiscal coerente
UPDATE public.orders
   SET invoice_status = 'pendente_emissao',
       invoice_updated_at = COALESCE(invoice_updated_at, now())
 WHERE payment_status = 'paid'
   AND COALESCE(invoice_status,'nao_necessaria') = 'nao_necessaria';

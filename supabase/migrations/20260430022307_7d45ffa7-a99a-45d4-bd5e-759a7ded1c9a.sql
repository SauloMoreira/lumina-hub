-- 1) products: cost_price + min_margin_percent
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost_price numeric,
  ADD COLUMN IF NOT EXISTS min_margin_percent numeric;

COMMENT ON COLUMN public.products.cost_price IS 'Custo do produto (uso interno admin). Nunca expor publicamente.';
COMMENT ON COLUMN public.products.min_margin_percent IS 'Margem mínima desejada (%) para alertas. Se nulo usa o padrão de finance_settings.';

-- 2) order_items: snapshot de custo + margem
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS unit_cost numeric,
  ADD COLUMN IF NOT EXISTS total_cost numeric,
  ADD COLUMN IF NOT EXISTS gross_margin_amount numeric,
  ADD COLUMN IF NOT EXISTS gross_margin_percent numeric,
  ADD COLUMN IF NOT EXISTS cost_source text NOT NULL DEFAULT 'none';

COMMENT ON COLUMN public.order_items.unit_cost IS 'Custo unitário gravado no momento do pedido (snapshot). Nunca recalcular com cost_price atual.';
COMMENT ON COLUMN public.order_items.cost_source IS 'product | none | manual';

-- 3) finance_settings (singleton)
CREATE TABLE IF NOT EXISTS public.finance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_min_margin_percent numeric NOT NULL DEFAULT 25,
  consider_shipping_in_margin boolean NOT NULL DEFAULT false,
  consider_coupon_in_margin boolean NOT NULL DEFAULT true,
  consider_b2b_discount_in_margin boolean NOT NULL DEFAULT true,
  critical_margin_alert_enabled boolean NOT NULL DEFAULT true,
  critical_margin_threshold_percent numeric NOT NULL DEFAULT 10,
  -- placeholders para próximas ondas (Mercado Pago real + estimado)
  mp_fee_pix_percent numeric NOT NULL DEFAULT 0.99,
  mp_fee_pix_fixed numeric NOT NULL DEFAULT 0,
  mp_fee_credit_percent numeric NOT NULL DEFAULT 4.99,
  mp_fee_credit_fixed numeric NOT NULL DEFAULT 0,
  mp_fee_boleto_percent numeric NOT NULL DEFAULT 3.49,
  mp_fee_boleto_fixed numeric NOT NULL DEFAULT 0,
  mp_fee_default_percent numeric NOT NULL DEFAULT 4.99,
  default_currency text NOT NULL DEFAULT 'BRL',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.finance_settings DEFAULT VALUES
ON CONFLICT DO NOTHING;

ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_settings_admin_all ON public.finance_settings;
CREATE POLICY finance_settings_admin_all
  ON public.finance_settings
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_finance_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_finance_settings ON public.finance_settings;
CREATE TRIGGER trg_touch_finance_settings
  BEFORE UPDATE ON public.finance_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_finance_settings();

-- 4) Índice útil para relatórios financeiros (pedidos pagos por data)
CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON public.orders (paid_at) WHERE payment_status = 'paid';
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at);
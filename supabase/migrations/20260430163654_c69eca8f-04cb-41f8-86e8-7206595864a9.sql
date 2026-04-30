-- Onda 9E.4b: aplicação real do desconto de combo
-- Adiciona campos em orders e order_items para registrar desconto de combo,
-- preservando applied_unit_price (sem rateio destrutivo).

-- ORDERS
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS bundle_discount_total numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bundle_discount_details jsonb,
  ADD COLUMN IF NOT EXISTS has_bundle_discount boolean NOT NULL DEFAULT false;

-- ORDER_ITEMS
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS bundle_id uuid,
  ADD COLUMN IF NOT EXISTS bundle_name text,
  ADD COLUMN IF NOT EXISTS bundle_applied boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bundle_discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bundle_discount_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bundle_block_reason text;

-- Índice para relatórios futuros (combos mais usados, receita por combo)
CREATE INDEX IF NOT EXISTS idx_order_items_bundle_id
  ON public.order_items (bundle_id)
  WHERE bundle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_has_bundle_discount
  ON public.orders (has_bundle_discount)
  WHERE has_bundle_discount = true;

-- Garantir consistência: bundle_discount_total não pode ser negativo
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_bundle_discount_total_nonneg;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_bundle_discount_total_nonneg
  CHECK (bundle_discount_total >= 0);

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_bundle_discount_amount_nonneg;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_bundle_discount_amount_nonneg
  CHECK (bundle_discount_amount >= 0);
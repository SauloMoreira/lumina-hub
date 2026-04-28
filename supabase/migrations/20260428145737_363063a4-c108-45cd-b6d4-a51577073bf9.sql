ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS free_shipping_eligible boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_free_shipping_eligible
  ON public.products (free_shipping_eligible)
  WHERE free_shipping_eligible = true;
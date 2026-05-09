
ALTER TABLE public.product_bundles
  ADD COLUMN IF NOT EXISTS kit_type text NOT NULL DEFAULT 'combinado',
  ADD COLUMN IF NOT EXISTS pricing_method text NOT NULL DEFAULT 'sum',
  ADD COLUMN IF NOT EXISTS fixed_price numeric NULL,
  ADD COLUMN IF NOT EXISTS discount_percent numeric NULL,
  ADD COLUMN IF NOT EXISTS discount_amount numeric NULL,
  ADD COLUMN IF NOT EXISTS available_retail boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS available_b2b boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS b2b_pricing_method text NOT NULL DEFAULT 'inherit',
  ADD COLUMN IF NOT EXISTS b2b_fixed_price numeric NULL,
  ADD COLUMN IF NOT EXISTS b2b_extra_discount_percent numeric NULL,
  ADD COLUMN IF NOT EXISTS b2b_min_quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS accepts_coupon boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS stack_with_b2b boolean NOT NULL DEFAULT false;

ALTER TABLE public.product_bundles
  DROP CONSTRAINT IF EXISTS product_bundles_kit_type_check;
ALTER TABLE public.product_bundles
  ADD CONSTRAINT product_bundles_kit_type_check
    CHECK (kit_type IN ('combinado','promocional','b2b','estrutural'));

ALTER TABLE public.product_bundles
  DROP CONSTRAINT IF EXISTS product_bundles_pricing_method_check;
ALTER TABLE public.product_bundles
  ADD CONSTRAINT product_bundles_pricing_method_check
    CHECK (pricing_method IN ('sum','percent_discount','fixed_discount','fixed_price'));

ALTER TABLE public.product_bundles
  DROP CONSTRAINT IF EXISTS product_bundles_b2b_pricing_method_check;
ALTER TABLE public.product_bundles
  ADD CONSTRAINT product_bundles_b2b_pricing_method_check
    CHECK (b2b_pricing_method IN ('inherit','fixed_price','extra_discount'));

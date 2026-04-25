-- Tabela dedicada de imagens de produto
CREATE TABLE IF NOT EXISTS public.product_images (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order      INT NOT NULL DEFAULT 0,
  is_primary      BOOLEAN NOT NULL DEFAULT false,

  original_url    TEXT NOT NULL,
  original_size   INT,
  original_format TEXT,

  url_full        TEXT,
  url_card        TEXT,
  url_thumb       TEXT,
  url_og          TEXT,
  optimized       BOOLEAN NOT NULL DEFAULT false,

  alt_text        TEXT,
  title_text      TEXT,
  caption         TEXT,
  seo_filename    TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product
  ON public.product_images(product_id, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_primary
  ON public.product_images(product_id)
  WHERE is_primary = true;

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_images_public_read"
  ON public.product_images FOR SELECT
  USING (true);

CREATE POLICY "product_images_admin_all"
  ON public.product_images FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Trigger: garantir exatamente uma principal por produto
CREATE OR REPLACE FUNCTION public.ensure_primary_product_image()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.product_images
    WHERE product_id = NEW.product_id
      AND is_primary = true
      AND id <> NEW.id
  ) THEN
    NEW.is_primary := true;
  END IF;

  IF NEW.is_primary = true THEN
    UPDATE public.product_images
       SET is_primary = false
     WHERE product_id = NEW.product_id
       AND id <> NEW.id
       AND is_primary = true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_primary_product_image ON public.product_images;
CREATE TRIGGER trg_ensure_primary_product_image
  BEFORE INSERT OR UPDATE ON public.product_images
  FOR EACH ROW EXECUTE FUNCTION public.ensure_primary_product_image();

-- Backfill: migrar imagens do array products.images para product_images
INSERT INTO public.product_images (product_id, sort_order, is_primary, original_url, optimized)
SELECT
  p.id,
  idx - 1                   AS sort_order,
  (idx = 1)                 AS is_primary,
  img                       AS original_url,
  false                     AS optimized
FROM public.products p
CROSS JOIN LATERAL unnest(COALESCE(p.images, '{}'::text[])) WITH ORDINALITY AS t(img, idx)
WHERE img IS NOT NULL
  AND length(trim(img)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.product_images pi WHERE pi.product_id = p.id
  );
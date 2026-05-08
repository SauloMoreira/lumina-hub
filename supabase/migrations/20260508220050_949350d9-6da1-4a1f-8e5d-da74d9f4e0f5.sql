-- 1. Tabela de imagens do combo
CREATE TABLE public.product_bundle_images (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bundle_id uuid NOT NULL REFERENCES public.product_bundles(id) ON DELETE CASCADE,
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual_url',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_bundle_images_source_check CHECK (source IN ('manual_upload','manual_url','ai_generated'))
);

CREATE INDEX idx_product_bundle_images_bundle ON public.product_bundle_images(bundle_id, sort_order);
CREATE UNIQUE INDEX uniq_product_bundle_images_primary
  ON public.product_bundle_images(bundle_id) WHERE is_primary = true;

ALTER TABLE public.product_bundle_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_bundle_images_admin_all
  ON public.product_bundle_images FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY product_bundle_images_public_read
  ON public.product_bundle_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.product_bundles b
      WHERE b.id = product_bundle_images.bundle_id
        AND b.is_active = true
        AND (b.start_date IS NULL OR b.start_date <= now())
        AND (b.end_date IS NULL OR b.end_date >= now())
    )
  );

-- 2. Trigger: limite de 4 imagens por kit
CREATE OR REPLACE FUNCTION public.enforce_product_bundle_images_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cnt integer;
BEGIN
  SELECT count(*) INTO cnt FROM public.product_bundle_images WHERE bundle_id = NEW.bundle_id;
  IF cnt >= 4 THEN
    RAISE EXCEPTION 'bundle_images_limit_reached';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_product_bundle_images_limit
BEFORE INSERT ON public.product_bundle_images
FOR EACH ROW EXECUTE FUNCTION public.enforce_product_bundle_images_limit();

-- 3. Trigger: timestamps + sync de image_url do bundle com a capa
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_product_bundle_images_updated_at
BEFORE UPDATE ON public.product_bundle_images
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.sync_bundle_primary_image()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_bundle uuid;
  primary_url text;
BEGIN
  target_bundle := COALESCE(NEW.bundle_id, OLD.bundle_id);
  SELECT url INTO primary_url
    FROM public.product_bundle_images
    WHERE bundle_id = target_bundle AND is_primary = true
    LIMIT 1;
  IF primary_url IS NULL THEN
    SELECT url INTO primary_url
      FROM public.product_bundle_images
      WHERE bundle_id = target_bundle
      ORDER BY sort_order ASC, created_at ASC
      LIMIT 1;
  END IF;
  UPDATE public.product_bundles
    SET image_url = primary_url
    WHERE id = target_bundle;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_bundle_primary_image_iud
AFTER INSERT OR UPDATE OR DELETE ON public.product_bundle_images
FOR EACH ROW EXECUTE FUNCTION public.sync_bundle_primary_image();

-- 4. Migração: kits que já tinham image_url ganham uma entrada como capa
INSERT INTO public.product_bundle_images (bundle_id, url, sort_order, is_primary, source)
SELECT id, image_url, 0, true, 'manual_url'
FROM public.product_bundles
WHERE image_url IS NOT NULL AND length(trim(image_url)) > 0
ON CONFLICT DO NOTHING;

-- 5. Auditoria
CREATE TRIGGER trg_audit_product_bundle_images
AFTER INSERT OR UPDATE OR DELETE ON public.product_bundle_images
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

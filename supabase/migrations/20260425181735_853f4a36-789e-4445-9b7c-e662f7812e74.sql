DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'product_images'
      AND constraint_name = 'product_images_product_id_fkey'
  ) THEN
    ALTER TABLE public.product_images
      ADD CONSTRAINT product_images_product_id_fkey
      FOREIGN KEY (product_id)
      REFERENCES public.products(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS product_images_one_primary_per_product
  ON public.product_images (product_id)
  WHERE is_primary = true;

CREATE OR REPLACE FUNCTION public.ensure_primary_product_image()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NOT EXISTS (
    SELECT 1
    FROM public.product_images
    WHERE product_id = NEW.product_id
      AND is_primary = true
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

DROP TRIGGER IF EXISTS ensure_primary_product_image_trigger ON public.product_images;
CREATE TRIGGER ensure_primary_product_image_trigger
BEFORE INSERT OR UPDATE OF is_primary ON public.product_images
FOR EACH ROW
EXECUTE FUNCTION public.ensure_primary_product_image();

CREATE OR REPLACE FUNCTION public.sync_product_images_array(_product_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.products p
     SET images = COALESCE((
       SELECT array_agg(COALESCE(pi.url_card, pi.url_thumb, pi.original_url) ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.created_at ASC)
       FROM public.product_images pi
       WHERE pi.product_id = _product_id
     ), ARRAY[]::text[]),
         updated_at = now()
   WHERE p.id = _product_id;
$$;

CREATE OR REPLACE FUNCTION public.sync_product_images_array_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected_product_id uuid;
BEGIN
  affected_product_id := COALESCE(NEW.product_id, OLD.product_id);
  PERFORM public.sync_product_images_array(affected_product_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_product_images_array_after_change ON public.product_images;
CREATE TRIGGER sync_product_images_array_after_change
AFTER INSERT OR UPDATE OR DELETE ON public.product_images
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_images_array_trigger();
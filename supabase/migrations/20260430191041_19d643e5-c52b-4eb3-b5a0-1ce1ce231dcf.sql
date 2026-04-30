-- Tabela de atributos técnicos dos produtos
CREATE TABLE IF NOT EXISTS public.product_attributes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  attribute_key text NOT NULL,
  attribute_label text NOT NULL,
  attribute_value text NOT NULL,
  attribute_unit text,
  sort_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  is_filterable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_attributes_key_not_empty CHECK (length(trim(attribute_key)) > 0),
  CONSTRAINT product_attributes_label_not_empty CHECK (length(trim(attribute_label)) > 0),
  CONSTRAINT product_attributes_value_not_empty CHECK (length(trim(attribute_value)) > 0),
  CONSTRAINT product_attributes_key_length CHECK (length(attribute_key) <= 80),
  CONSTRAINT product_attributes_label_length CHECK (length(attribute_label) <= 120),
  CONSTRAINT product_attributes_value_length CHECK (length(attribute_value) <= 500),
  CONSTRAINT product_attributes_unit_length CHECK (attribute_unit IS NULL OR length(attribute_unit) <= 20)
);

-- Único atributo por chave em cada produto
CREATE UNIQUE INDEX IF NOT EXISTS product_attributes_product_key_uniq
  ON public.product_attributes(product_id, lower(attribute_key));

CREATE INDEX IF NOT EXISTS product_attributes_product_id_idx
  ON public.product_attributes(product_id, sort_order);

CREATE INDEX IF NOT EXISTS product_attributes_filterable_idx
  ON public.product_attributes(attribute_key, attribute_value)
  WHERE is_filterable = true AND is_visible = true;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_product_attributes()
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

DROP TRIGGER IF EXISTS trg_touch_product_attributes ON public.product_attributes;
CREATE TRIGGER trg_touch_product_attributes
BEFORE UPDATE ON public.product_attributes
FOR EACH ROW EXECUTE FUNCTION public.touch_product_attributes();

-- RLS
ALTER TABLE public.product_attributes ENABLE ROW LEVEL SECURITY;

-- Admin pode tudo
CREATE POLICY product_attributes_admin_all
  ON public.product_attributes
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Leitura pública apenas de atributos visíveis de produtos ativos
CREATE POLICY product_attributes_public_read
  ON public.product_attributes
  FOR SELECT
  USING (
    is_visible = true
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_attributes.product_id
        AND p.active = true
    )
  );
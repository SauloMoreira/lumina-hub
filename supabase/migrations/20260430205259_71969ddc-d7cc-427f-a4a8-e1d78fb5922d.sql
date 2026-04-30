-- Função utilitária para updated_at (idempotente)
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.product_attribute_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_key text NOT NULL,
  raw_value text NOT NULL,
  display_label text NOT NULL,
  helper_text text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX product_attribute_labels_key_value_uidx
  ON public.product_attribute_labels (lower(attribute_key), lower(raw_value));

CREATE INDEX product_attribute_labels_active_idx
  ON public.product_attribute_labels (attribute_key, is_active);

CREATE TRIGGER trg_product_attribute_labels_updated_at
  BEFORE UPDATE ON public.product_attribute_labels
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.product_attribute_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_attribute_labels_admin_all
  ON public.product_attribute_labels
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY product_attribute_labels_public_read
  ON public.product_attribute_labels
  FOR SELECT
  USING (is_active = true);

INSERT INTO public.product_attribute_labels (attribute_key, raw_value, display_label, helper_text, sort_order) VALUES
  ('color_temperature', '3000', 'Luz quente', 'Ideal para ambientes aconchegantes.', 1),
  ('color_temperature', '4000', 'Luz neutra', 'Equilíbrio entre conforto e claridade.', 2),
  ('color_temperature', '6500', 'Luz fria', 'Ideal para ambientes que precisam de mais claridade.', 3),
  ('voltage', '127V', '127V', 'Tensão residencial padrão em parte do Brasil.', 1),
  ('voltage', '220V', '220V', 'Tensão residencial padrão em parte do Brasil.', 2),
  ('voltage', 'Bivolt', 'Bivolt — 127V e 220V', 'Compatível com as principais tensões residenciais.', 3),
  ('ip_rating', 'IP20', 'IP20 — Uso interno', 'Proteção básica para uso em ambientes internos secos.', 1),
  ('ip_rating', 'IP44', 'IP44 — Proteção moderada', 'Proteção contra respingos de água.', 2),
  ('ip_rating', 'IP65', 'IP65 — Área externa', 'Proteção total contra poeira e jatos de água.', 3),
  ('ip_rating', 'IP66', 'IP66 — Área externa reforçada', 'Proteção elevada contra poeira e jatos fortes de água.', 4)
ON CONFLICT DO NOTHING;
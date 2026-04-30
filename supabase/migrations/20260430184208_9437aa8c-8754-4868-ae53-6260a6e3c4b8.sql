-- =========================================================
-- Onda Homepage D: Vitrines de produtos configuráveis
-- =========================================================

-- Enums
CREATE TYPE public.homepage_showcase_type AS ENUM
  ('featured','offers','best_sellers','new_arrivals','category','bundles','custom');

CREATE TYPE public.homepage_showcase_mode AS ENUM ('auto','manual');

CREATE TYPE public.homepage_showcase_visual AS ENUM ('default','premium','compact','highlighted');

CREATE TYPE public.homepage_showcase_item_type AS ENUM ('product','combo');

-- =========================================================
-- Tabela principal
-- =========================================================
CREATE TABLE public.homepage_product_showcases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  subtitle text,
  showcase_type public.homepage_showcase_type NOT NULL DEFAULT 'featured',
  mode public.homepage_showcase_mode NOT NULL DEFAULT 'auto',
  product_limit smallint NOT NULL DEFAULT 8,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  visual_variant public.homepage_showcase_visual NOT NULL DEFAULT 'default',
  show_view_all_button boolean NOT NULL DEFAULT false,
  view_all_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT homepage_showcases_limit_range CHECK (product_limit BETWEEN 1 AND 24),
  CONSTRAINT homepage_showcases_title_len CHECK (length(title) BETWEEN 1 AND 120),
  CONSTRAINT homepage_showcases_subtitle_len CHECK (subtitle IS NULL OR length(subtitle) <= 240),
  CONSTRAINT homepage_showcases_view_all_url_safe CHECK (
    view_all_url IS NULL
    OR (length(view_all_url) <= 500
        AND view_all_url !~* '<|javascript:|data:')
  ),
  CONSTRAINT homepage_showcases_category_required CHECK (
    showcase_type <> 'category' OR category_id IS NOT NULL
  )
);

CREATE INDEX idx_homepage_showcases_active_sort
  ON public.homepage_product_showcases (is_active, sort_order, created_at);

ALTER TABLE public.homepage_product_showcases ENABLE ROW LEVEL SECURITY;

CREATE POLICY homepage_showcases_admin_all
  ON public.homepage_product_showcases
  FOR ALL TO public
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY homepage_showcases_public_read
  ON public.homepage_product_showcases
  FOR SELECT TO public
  USING (is_active = true);

CREATE OR REPLACE FUNCTION public.touch_homepage_product_showcases()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE TRIGGER trg_touch_homepage_product_showcases
  BEFORE UPDATE ON public.homepage_product_showcases
  FOR EACH ROW EXECUTE FUNCTION public.touch_homepage_product_showcases();

-- =========================================================
-- Itens manuais
-- =========================================================
CREATE TABLE public.homepage_showcase_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  showcase_id uuid NOT NULL REFERENCES public.homepage_product_showcases(id) ON DELETE CASCADE,
  item_type public.homepage_showcase_item_type NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  combo_id uuid REFERENCES public.product_bundles(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT homepage_showcase_items_xor CHECK (
    (item_type = 'product' AND product_id IS NOT NULL AND combo_id IS NULL)
    OR (item_type = 'combo' AND combo_id IS NOT NULL AND product_id IS NULL)
  )
);

-- Sem duplicar produto/combo na mesma vitrine
CREATE UNIQUE INDEX uq_homepage_showcase_items_product
  ON public.homepage_showcase_items (showcase_id, product_id)
  WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX uq_homepage_showcase_items_combo
  ON public.homepage_showcase_items (showcase_id, combo_id)
  WHERE combo_id IS NOT NULL;

CREATE INDEX idx_homepage_showcase_items_showcase
  ON public.homepage_showcase_items (showcase_id, is_active, sort_order);

ALTER TABLE public.homepage_showcase_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY homepage_showcase_items_admin_all
  ON public.homepage_showcase_items
  FOR ALL TO public
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY homepage_showcase_items_public_read
  ON public.homepage_showcase_items
  FOR SELECT TO public
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.homepage_product_showcases s
      WHERE s.id = showcase_id AND s.is_active = true
    )
  );

CREATE OR REPLACE FUNCTION public.touch_homepage_showcase_items()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE TRIGGER trg_touch_homepage_showcase_items
  BEFORE UPDATE ON public.homepage_showcase_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_homepage_showcase_items();

-- =============================================
-- 1) PRODUCT_RELATIONS
-- =============================================
CREATE TYPE public.product_relation_type AS ENUM (
  'related',
  'frequently_bought_together',
  'accessory',
  'replacement',
  'upsell',
  'cross_sell',
  'b2b_recommendation'
);

CREATE TABLE public.product_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  related_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  relation_type public.product_relation_type NOT NULL DEFAULT 'related',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_relations_no_self CHECK (product_id <> related_product_id),
  CONSTRAINT product_relations_unique UNIQUE (product_id, related_product_id, relation_type)
);

CREATE INDEX idx_product_relations_product ON public.product_relations(product_id, is_active, sort_order);
CREATE INDEX idx_product_relations_related ON public.product_relations(related_product_id);

ALTER TABLE public.product_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_relations_admin_all ON public.product_relations
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Leitura pública via RPCs (não permitir SELECT direto público — força uso das funções com filtros de segurança)
-- Mas permitimos SELECT para qualquer um para que o admin via supabase-js também leia direto.
-- (ainda assim, a loja pública usará as RPCs que filtram preço B2B etc.)
CREATE POLICY product_relations_public_read ON public.product_relations
  FOR SELECT USING (is_active = true OR public.is_admin(auth.uid()));

CREATE TRIGGER touch_product_relations
  BEFORE UPDATE ON public.product_relations
  FOR EACH ROW EXECUTE FUNCTION public.update_home_banners_updated_at();

-- =============================================
-- 2) PRODUCT_BUNDLES (fundação)
-- =============================================
CREATE TYPE public.bundle_discount_type AS ENUM ('none', 'fixed_amount', 'percentage');

CREATE TABLE public.product_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  slug text UNIQUE,
  image_url text,
  discount_type public.bundle_discount_type NOT NULL DEFAULT 'none',
  discount_value numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  start_date timestamptz,
  end_date timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_bundles_discount_value_nonneg CHECK (discount_value >= 0),
  CONSTRAINT product_bundles_period CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_product_bundles_active ON public.product_bundles(is_active, is_featured);

ALTER TABLE public.product_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_bundles_admin_all ON public.product_bundles
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY product_bundles_public_read ON public.product_bundles
  FOR SELECT USING (
    is_active = true
    AND (start_date IS NULL OR start_date <= now())
    AND (end_date IS NULL OR end_date >= now())
    OR public.is_admin(auth.uid())
  );

CREATE TRIGGER touch_product_bundles
  BEFORE UPDATE ON public.product_bundles
  FOR EACH ROW EXECUTE FUNCTION public.update_home_banners_updated_at();

-- =============================================
-- 3) PRODUCT_BUNDLE_ITEMS
-- =============================================
CREATE TABLE public.product_bundle_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id uuid NOT NULL REFERENCES public.product_bundles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_bundle_items_qty_positive CHECK (quantity >= 1),
  CONSTRAINT product_bundle_items_unique UNIQUE (bundle_id, product_id)
);

CREATE INDEX idx_product_bundle_items_bundle ON public.product_bundle_items(bundle_id, sort_order);

ALTER TABLE public.product_bundle_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_bundle_items_admin_all ON public.product_bundle_items
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY product_bundle_items_public_read ON public.product_bundle_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.product_bundles b
      WHERE b.id = product_bundle_items.bundle_id
        AND (b.is_active = true OR public.is_admin(auth.uid()))
    )
  );

CREATE TRIGGER touch_product_bundle_items
  BEFORE UPDATE ON public.product_bundle_items
  FOR EACH ROW EXECUTE FUNCTION public.update_home_banners_updated_at();

-- =============================================
-- 4) RPC: get_product_relations_public
-- =============================================
CREATE OR REPLACE FUNCTION public.get_product_relations_public(
  _product_id uuid,
  _user_id uuid DEFAULT NULL,
  _limit integer DEFAULT 12
)
RETURNS TABLE(
  relation_id uuid,
  relation_type public.product_relation_type,
  sort_order integer,
  product_id uuid,
  name text,
  slug text,
  brand text,
  image text,
  retail_price numeric,
  sale_price numeric,
  applied_price numeric,
  pricing_source text,
  b2b_min_quantity integer,
  stock_qty integer,
  free_shipping_eligible boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_approved boolean := false;
  v_now timestamptz := now();
BEGIN
  IF _user_id IS NOT NULL AND public.get_user_approved_company_id(_user_id) IS NOT NULL THEN
    v_company_approved := true;
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.relation_type,
    r.sort_order,
    p.id,
    p.name,
    p.slug,
    p.brand,
    CASE WHEN array_length(p.images, 1) > 0 THEN p.images[1] ELSE NULL END,
    p.price,
    p.sale_price,
    CASE
      WHEN v_company_approved
       AND p.b2b_enabled = true
       AND p.b2b_price IS NOT NULL
       AND p.b2b_price > 0
       AND (p.b2b_valid_until IS NULL OR p.b2b_valid_until >= v_now)
      THEN p.b2b_price
      ELSE COALESCE(p.sale_price, p.price)
    END,
    CASE
      WHEN v_company_approved
       AND p.b2b_enabled = true
       AND p.b2b_price IS NOT NULL
       AND p.b2b_price > 0
       AND (p.b2b_valid_until IS NULL OR p.b2b_valid_until >= v_now)
      THEN 'b2b'
      ELSE 'retail'
    END,
    CASE
      WHEN v_company_approved
       AND p.b2b_enabled = true
       AND p.b2b_price IS NOT NULL
       AND p.b2b_price > 0
      THEN COALESCE(p.b2b_min_qty, 1)
      ELSE NULL
    END,
    p.stock_qty,
    COALESCE(p.free_shipping_eligible, false)
  FROM public.product_relations r
  JOIN public.products p ON p.id = r.related_product_id
  WHERE r.product_id = _product_id
    AND r.is_active = true
    AND p.active = true
    AND COALESCE(p.sale_price, p.price) IS NOT NULL
    AND COALESCE(p.sale_price, p.price) > 0
  ORDER BY r.sort_order ASC, r.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 12), 24));
END;
$$;

-- =============================================
-- 5) RPC: get_cart_complementary_products
-- =============================================
CREATE OR REPLACE FUNCTION public.get_cart_complementary_products(
  _product_ids uuid[],
  _user_id uuid DEFAULT NULL,
  _limit integer DEFAULT 6
)
RETURNS TABLE(
  product_id uuid,
  name text,
  slug text,
  brand text,
  image text,
  retail_price numeric,
  sale_price numeric,
  applied_price numeric,
  pricing_source text,
  stock_qty integer,
  free_shipping_eligible boolean,
  match_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_approved boolean := false;
  v_now timestamptz := now();
BEGIN
  IF _user_id IS NOT NULL AND public.get_user_approved_company_id(_user_id) IS NOT NULL THEN
    v_company_approved := true;
  END IF;

  IF _product_ids IS NULL OR array_length(_product_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT
      r.related_product_id AS pid,
      count(*) AS hits,
      min(r.sort_order) AS best_sort
    FROM public.product_relations r
    WHERE r.product_id = ANY(_product_ids)
      AND r.is_active = true
      AND r.relation_type IN (
        'frequently_bought_together',
        'accessory',
        'cross_sell',
        'related',
        'b2b_recommendation'
      )
      AND r.related_product_id <> ALL(_product_ids)
    GROUP BY r.related_product_id
  )
  SELECT
    p.id,
    p.name,
    p.slug,
    p.brand,
    CASE WHEN array_length(p.images, 1) > 0 THEN p.images[1] ELSE NULL END,
    p.price,
    p.sale_price,
    CASE
      WHEN v_company_approved
       AND p.b2b_enabled = true
       AND p.b2b_price IS NOT NULL
       AND p.b2b_price > 0
       AND (p.b2b_valid_until IS NULL OR p.b2b_valid_until >= v_now)
      THEN p.b2b_price
      ELSE COALESCE(p.sale_price, p.price)
    END,
    CASE
      WHEN v_company_approved
       AND p.b2b_enabled = true
       AND p.b2b_price IS NOT NULL
       AND p.b2b_price > 0
       AND (p.b2b_valid_until IS NULL OR p.b2b_valid_until >= v_now)
      THEN 'b2b'
      ELSE 'retail'
    END,
    p.stock_qty,
    COALESCE(p.free_shipping_eligible, false),
    c.hits
  FROM candidates c
  JOIN public.products p ON p.id = c.pid
  WHERE p.active = true
    AND COALESCE(p.sale_price, p.price) IS NOT NULL
    AND COALESCE(p.sale_price, p.price) > 0
  ORDER BY c.hits DESC, c.best_sort ASC, p.featured DESC, p.name ASC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 6), 12));
END;
$$;
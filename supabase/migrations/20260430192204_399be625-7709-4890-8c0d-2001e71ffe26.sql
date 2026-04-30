-- Onda B (Atributos técnicos): integra product_attributes na busca pública e no autocomplete.

CREATE INDEX IF NOT EXISTS product_attributes_search_idx
  ON public.product_attributes (product_id)
  WHERE is_visible = true;

CREATE INDEX IF NOT EXISTS product_attributes_value_idx
  ON public.product_attributes (lower(attribute_value))
  WHERE is_visible = true;

DROP FUNCTION IF EXISTS public.search_products_public(text[], uuid, text, numeric, numeric, boolean, boolean, boolean, text, integer, integer, boolean, integer);

CREATE OR REPLACE FUNCTION public.search_products_public(
  _terms text[] DEFAULT NULL,
  _category_id uuid DEFAULT NULL,
  _brand text DEFAULT NULL,
  _price_min numeric DEFAULT NULL,
  _price_max numeric DEFAULT NULL,
  _in_stock boolean DEFAULT NULL,
  _on_sale boolean DEFAULT NULL,
  _free_shipping boolean DEFAULT NULL,
  _sort text DEFAULT 'relevance',
  _limit integer DEFAULT 24,
  _offset integer DEFAULT 0,
  _b2b_only boolean DEFAULT false,
  _min_qty_max integer DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  price numeric,
  sale_price numeric,
  stock_qty integer,
  brand text,
  tags text[],
  images text[],
  featured boolean,
  free_shipping_eligible boolean,
  category_id uuid,
  b2b_enabled boolean,
  b2b_price numeric,
  b2b_min_qty integer,
  b2b_qty_multiple integer,
  b2b_show_in_vitrine boolean,
  b2b_valid_until timestamptz,
  total_count bigint,
  relevance integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_terms boolean := _terms IS NOT NULL AND array_length(_terms, 1) IS NOT NULL;
  v_now timestamptz := now();
BEGIN
  RETURN QUERY
  WITH
  attr_index AS (
    SELECT
      a.product_id,
      string_agg(
        public.search_normalize(
          coalesce(a.attribute_label,'') || ' ' ||
          coalesce(a.attribute_value,'') || ' ' ||
          coalesce(a.attribute_unit,'') || ' ' ||
          coalesce(a.attribute_value,'') || coalesce(a.attribute_unit,'')
        ),
        ' '
      ) AS norm_text
    FROM public.product_attributes a
    WHERE a.is_visible = true
    GROUP BY a.product_id
  ),
  scored AS (
    SELECT
      p.id, p.name, p.slug, p.price, p.sale_price, p.stock_qty,
      p.brand, p.tags, p.images, p.featured, p.free_shipping_eligible, p.category_id,
      p.b2b_enabled, p.b2b_price, p.b2b_min_qty, p.b2b_qty_multiple,
      p.b2b_show_in_vitrine, p.b2b_valid_until,
      p.created_at, p.updated_at,
      CASE WHEN v_has_terms THEN (
        SELECT coalesce(sum(
          CASE WHEN public.search_normalize(p.name) LIKE '%'||t||'%' THEN 100 ELSE 0 END +
          CASE WHEN public.search_normalize(coalesce(p.sku,'') || ' ' || coalesce(p.gtin_ean,'') || ' ' || coalesce(p.ncm,'')) LIKE '%'||t||'%' THEN 90 ELSE 0 END +
          CASE WHEN public.search_normalize(coalesce(p.brand,'')) LIKE '%'||t||'%' THEN 40 ELSE 0 END +
          CASE WHEN public.search_normalize(
            coalesce(p.description,'') || ' ' ||
            coalesce(p.seo_title,'') || ' ' ||
            coalesce(p.seo_description,'') || ' ' ||
            coalesce(p.seo_keywords,'') || ' ' ||
            coalesce(array_to_string(p.tags,' '),'')
          ) LIKE '%'||t||'%' THEN 10 ELSE 0 END +
          CASE WHEN ai.norm_text IS NOT NULL AND ai.norm_text LIKE '%'||t||'%' THEN 60 ELSE 0 END
        ), 0)::int
        FROM unnest(_terms) AS t
        WHERE length(t) > 0
      ) ELSE 0 END AS rel
    FROM public.products p
    LEFT JOIN attr_index ai ON ai.product_id = p.id
    WHERE p.active = true
      AND (_category_id IS NULL OR p.category_id = _category_id)
      AND (_brand IS NULL OR public.search_normalize(p.brand) = public.search_normalize(_brand))
      AND (_price_min IS NULL OR coalesce(p.sale_price, p.price) >= _price_min)
      AND (_price_max IS NULL OR coalesce(p.sale_price, p.price) <= _price_max)
      AND (_in_stock IS NULL OR (_in_stock = false) OR p.stock_qty > 0)
      AND (_on_sale IS NULL OR (_on_sale = false) OR (p.sale_price IS NOT NULL AND p.sale_price < p.price))
      AND (_free_shipping IS NULL OR (_free_shipping = false) OR p.free_shipping_eligible = true)
      AND (
        coalesce(_b2b_only, false) = false
        OR (
          p.b2b_enabled = true
          AND p.b2b_price IS NOT NULL
          AND p.b2b_price > 0
          AND (p.b2b_valid_until IS NULL OR p.b2b_valid_until >= v_now)
          AND coalesce(p.b2b_show_in_vitrine, true) = true
        )
      )
      AND (
        _min_qty_max IS NULL
        OR coalesce(p.b2b_min_qty, 1) <= _min_qty_max
      )
  ),
  filtered AS (
    SELECT * FROM scored
    WHERE NOT v_has_terms OR rel > 0
  ),
  counted AS (
    SELECT count(*)::bigint AS total FROM filtered
  )
  SELECT
    f.id, f.name, f.slug, f.price, f.sale_price, f.stock_qty,
    f.brand, f.tags, f.images, f.featured, f.free_shipping_eligible, f.category_id,
    f.b2b_enabled, f.b2b_price, f.b2b_min_qty, f.b2b_qty_multiple,
    f.b2b_show_in_vitrine, f.b2b_valid_until,
    (SELECT total FROM counted) AS total_count,
    f.rel AS relevance
  FROM filtered f
  ORDER BY
    CASE WHEN _sort = 'price_asc'    THEN coalesce(f.sale_price, f.price) END ASC NULLS LAST,
    CASE WHEN _sort = 'price_desc'   THEN coalesce(f.sale_price, f.price) END DESC NULLS LAST,
    CASE WHEN _sort = 'newest'       THEN f.created_at END DESC NULLS LAST,
    CASE WHEN _sort = 'best_sellers' THEN (CASE WHEN f.featured THEN 1 ELSE 0 END) END DESC,
    CASE WHEN _sort = 'best_sellers' THEN f.updated_at END DESC NULLS LAST,
    CASE WHEN _sort = 'name_asc'     THEN f.name END ASC NULLS LAST,
    CASE WHEN _sort = 'stock_first'  THEN (CASE WHEN f.stock_qty > 0 THEN 1 ELSE 0 END) END DESC,
    CASE WHEN _sort = 'stock_first'  THEN f.featured END DESC NULLS LAST,
    CASE WHEN _sort = 'b2b_min_qty_asc' THEN coalesce(f.b2b_min_qty, 1) END ASC NULLS LAST,
    CASE WHEN _sort = 'b2b_discount_desc' THEN
      CASE
        WHEN f.b2b_price IS NULL OR f.b2b_price <= 0 THEN 0
        WHEN coalesce(f.sale_price, f.price) IS NULL OR coalesce(f.sale_price, f.price) <= 0 THEN 0
        ELSE GREATEST(0, (coalesce(f.sale_price, f.price) - f.b2b_price) / coalesce(f.sale_price, f.price))
      END
    END DESC NULLS LAST,
    CASE WHEN _sort = 'relevance' OR _sort IS NULL OR _sort = 'featured' THEN f.rel END DESC NULLS LAST,
    CASE WHEN _sort = 'relevance' OR _sort IS NULL OR _sort = 'featured' THEN (CASE WHEN f.featured THEN 1 ELSE 0 END) END DESC,
    f.created_at DESC NULLS LAST
  LIMIT greatest(1, least(coalesce(_limit, 24), 100))
  OFFSET greatest(0, coalesce(_offset, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_products_public(
  text[], uuid, text, numeric, numeric, boolean, boolean, boolean, text, integer, integer, boolean, integer
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.autocomplete_products_public(
  _terms text[],
  _limit integer DEFAULT 6
)
RETURNS TABLE (
  kind text,
  id uuid,
  name text,
  slug text,
  brand text,
  image text,
  price numeric,
  sale_price numeric,
  relevance int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 'category'::text, c.id, c.name, c.slug, NULL::text, NULL::text, NULL::numeric, NULL::numeric,
    (SELECT coalesce(sum(CASE WHEN public.search_normalize(c.name) LIKE '%'||t||'%' THEN 50 ELSE 0 END),0)::int
       FROM unnest(_terms) AS t WHERE length(t) > 0) AS rel
  FROM public.categories c
  WHERE c.active = true
    AND (SELECT bool_or(public.search_normalize(c.name) LIKE '%'||t||'%')
           FROM unnest(_terms) AS t WHERE length(t) > 0)
  ORDER BY rel DESC
  LIMIT 3;

  RETURN QUERY
  WITH attr_index AS (
    SELECT
      a.product_id,
      string_agg(
        public.search_normalize(
          coalesce(a.attribute_label,'') || ' ' ||
          coalesce(a.attribute_value,'') || ' ' ||
          coalesce(a.attribute_unit,'') || ' ' ||
          coalesce(a.attribute_value,'') || coalesce(a.attribute_unit,'')
        ),
        ' '
      ) AS norm_text
    FROM public.product_attributes a
    WHERE a.is_visible = true
    GROUP BY a.product_id
  )
  SELECT 'product'::text, p.id, p.name, p.slug, p.brand,
    coalesce((p.images)[1], NULL) AS image,
    p.price, p.sale_price,
    (SELECT coalesce(sum(
      CASE WHEN public.search_normalize(p.name) LIKE '%'||t||'%' THEN 100 ELSE 0 END +
      CASE WHEN public.search_normalize(coalesce(p.sku,'') || ' ' || coalesce(p.gtin_ean,'')) LIKE '%'||t||'%' THEN 90 ELSE 0 END +
      CASE WHEN public.search_normalize(coalesce(p.brand,'')) LIKE '%'||t||'%' THEN 40 ELSE 0 END +
      CASE WHEN ai.norm_text IS NOT NULL AND ai.norm_text LIKE '%'||t||'%' THEN 60 ELSE 0 END
    ),0)::int FROM unnest(_terms) AS t WHERE length(t) > 0) AS rel
  FROM public.products p
  LEFT JOIN attr_index ai ON ai.product_id = p.id
  WHERE p.active = true
    AND (SELECT bool_or(
      public.search_normalize(p.name) LIKE '%'||t||'%'
      OR public.search_normalize(coalesce(p.sku,'') || ' ' || coalesce(p.gtin_ean,'')) LIKE '%'||t||'%'
      OR public.search_normalize(coalesce(p.brand,'')) LIKE '%'||t||'%'
      OR (ai.norm_text IS NOT NULL AND ai.norm_text LIKE '%'||t||'%')
    ) FROM unnest(_terms) AS t WHERE length(t) > 0)
  ORDER BY rel DESC, p.featured DESC, p.name ASC
  LIMIT greatest(1, least(coalesce(_limit, 6), 12));
END;
$$;

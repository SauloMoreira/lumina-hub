
-- ============================================================
-- search_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_term text NOT NULL,
  normalized_term text NOT NULL,
  results_count integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'public_store',
  user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON public.search_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_normalized ON public.search_logs (normalized_term);
CREATE INDEX IF NOT EXISTS idx_search_logs_zero ON public.search_logs (created_at DESC) WHERE results_count = 0;

ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "search_logs_admin_select" ON public.search_logs;
CREATE POLICY "search_logs_admin_select" ON public.search_logs
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "search_logs_public_insert" ON public.search_logs;
CREATE POLICY "search_logs_public_insert" ON public.search_logs
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(coalesce(search_term, '')) BETWEEN 1 AND 200
    AND length(coalesce(normalized_term, '')) BETWEEN 1 AND 200
    AND source IN ('public_store', 'admin', 'b2b_store')
  );

-- ============================================================
-- Helper: normalização (mesma fórmula do JS)
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_normalize(_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(regexp_replace(
    regexp_replace(
      lower(
        translate(
          coalesce(_text, ''),
          'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
          'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
        )
      ),
      '[^a-z0-9]+', ' ', 'g'
    ),
    '\s+', ' ', 'g'
  ))
$$;

-- ============================================================
-- search_products_public
--   _terms text[]  -> tokens já expandidos com sinônimos pelo cliente
--   filtros opcionais
-- ============================================================
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
  _offset integer DEFAULT 0
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
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      p.id, p.name, p.slug, p.price, p.sale_price, p.stock_qty,
      p.brand, p.tags, p.images, p.featured, p.free_shipping_eligible, p.category_id,
      p.created_at, p.updated_at,
      -- haystacks normalizados por campo
      public.search_normalize(p.name)               AS h_name,
      public.search_normalize(coalesce(p.brand,'')) AS h_brand,
      public.search_normalize(
        coalesce(p.sku,'') || ' ' ||
        coalesce(p.gtin_ean,'') || ' ' ||
        coalesce(p.ncm,'')
      ) AS h_codes,
      public.search_normalize(
        coalesce(p.description,'') || ' ' ||
        coalesce(p.seo_title,'') || ' ' ||
        coalesce(p.seo_description,'') || ' ' ||
        coalesce(p.seo_keywords,'') || ' ' ||
        coalesce(array_to_string(p.tags,' '),'')
      ) AS h_long
    FROM public.products p
    WHERE p.active = true
      AND (_category_id IS NULL OR p.category_id = _category_id)
      AND (_brand IS NULL OR public.search_normalize(p.brand) = public.search_normalize(_brand))
      AND (_price_min IS NULL OR coalesce(p.sale_price, p.price) >= _price_min)
      AND (_price_max IS NULL OR coalesce(p.sale_price, p.price) <= _price_max)
      AND (_in_stock IS NULL OR (_in_stock = false) OR p.stock_qty > 0)
      AND (_on_sale IS NULL OR (_on_sale = false) OR (p.sale_price IS NOT NULL AND p.sale_price < p.price))
      AND (_free_shipping IS NULL OR (_free_shipping = false) OR p.free_shipping_eligible = true)
  ),
  scored AS (
    SELECT b.*,
      CASE WHEN v_has_terms THEN (
        SELECT
          coalesce(sum(
            CASE WHEN b.h_name  LIKE '%'||t||'%' THEN 100 ELSE 0 END +
            CASE WHEN b.h_codes LIKE '%'||t||'%' THEN  90 ELSE 0 END +
            CASE WHEN b.h_brand LIKE '%'||t||'%' THEN  40 ELSE 0 END +
            CASE WHEN b.h_long  LIKE '%'||t||'%' THEN  10 ELSE 0 END
          ), 0)::int
        FROM unnest(_terms) AS t
        WHERE length(t) > 0
      ) ELSE 0 END AS rel
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
    (SELECT total FROM counted) AS total_count,
    f.rel AS relevance
  FROM filtered f
  ORDER BY
    CASE WHEN _sort = 'price_asc'    THEN coalesce(f.sale_price, f.price) END ASC NULLS LAST,
    CASE WHEN _sort = 'price_desc'   THEN coalesce(f.sale_price, f.price) END DESC NULLS LAST,
    CASE WHEN _sort = 'newest'       THEN f.created_at END DESC NULLS LAST,
    CASE WHEN _sort = 'best_sellers' THEN (CASE WHEN f.featured THEN 1 ELSE 0 END) END DESC,
    CASE WHEN _sort = 'best_sellers' THEN f.updated_at END DESC NULLS LAST,
    -- relevance (default)
    CASE WHEN _sort = 'relevance' OR _sort IS NULL OR _sort = 'featured' THEN f.rel END DESC NULLS LAST,
    CASE WHEN _sort = 'relevance' OR _sort IS NULL OR _sort = 'featured' THEN (CASE WHEN f.featured THEN 1 ELSE 0 END) END DESC,
    f.created_at DESC NULLS LAST
  LIMIT greatest(1, least(coalesce(_limit, 24), 100))
  OFFSET greatest(0, coalesce(_offset, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_products_public(text[], uuid, text, numeric, numeric, boolean, boolean, boolean, text, integer, integer) TO anon, authenticated;

-- ============================================================
-- autocomplete_products_public
-- ============================================================
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
  -- categorias
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
  WITH base AS (
    SELECT
      p.id, p.name, p.slug, p.brand,
      coalesce((p.images)[1], NULL) AS image,
      p.price, p.sale_price,
      public.search_normalize(p.name)               AS h_name,
      public.search_normalize(coalesce(p.brand,'')) AS h_brand,
      public.search_normalize(coalesce(p.sku,'') || ' ' || coalesce(p.gtin_ean,'')) AS h_codes,
      p.featured
    FROM public.products p
    WHERE p.active = true
  ),
  scored AS (
    SELECT b.*, (
      SELECT coalesce(sum(
        CASE WHEN b.h_name  LIKE '%'||t||'%' THEN 100 ELSE 0 END +
        CASE WHEN b.h_codes LIKE '%'||t||'%' THEN  90 ELSE 0 END +
        CASE WHEN b.h_brand LIKE '%'||t||'%' THEN  40 ELSE 0 END
      ), 0)::int
      FROM unnest(_terms) AS t WHERE length(t) > 0
    ) AS rel
    FROM base b
  )
  SELECT 'product'::text, s.id, s.name, s.slug, s.brand, s.image, s.price, s.sale_price, s.rel
  FROM scored s
  WHERE s.rel > 0
  ORDER BY s.rel DESC, s.featured DESC, s.name ASC
  LIMIT greatest(1, least(coalesce(_limit, 6), 12));
END;
$$;

GRANT EXECUTE ON FUNCTION public.autocomplete_products_public(text[], integer) TO anon, authenticated;

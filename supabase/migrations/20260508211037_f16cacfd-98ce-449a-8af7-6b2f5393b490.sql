CREATE OR REPLACE FUNCTION public.get_cart_complementary_products(_product_ids uuid[], _user_id uuid DEFAULT NULL::uuid, _limit integer DEFAULT 6)
 RETURNS TABLE(product_id uuid, name text, slug text, brand text, image text, retail_price numeric, sale_price numeric, applied_price numeric, pricing_source text, stock_qty integer, free_shipping_eligible boolean, match_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      AND (
        r.relation_type IN (
          'frequently_bought_together',
          'accessory',
          'cross_sell',
          'related',
          'upsell'
        )
        OR (r.relation_type = 'b2b_recommendation' AND v_company_approved)
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
    AND p.stock_qty > 0
  ORDER BY c.hits DESC, c.best_sort ASC, p.name ASC
  LIMIT _limit;
END;
$function$;
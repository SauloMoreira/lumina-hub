-- Onda S3: guarda de identidade nas RPCs públicas que recebem _user_id.
-- Conteúdo gerado a partir das definições atuais com bloco de hardening
-- inserido logo após BEGIN. Server functions (service_role) mantêm o
-- comportamento original; chamadas diretas de anon/authenticated têm o
-- _user_id substituído por auth.uid().

CREATE OR REPLACE FUNCTION public.validate_b2b_pricing(_user_id uuid, _items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company record;
  v_company_approved boolean := false;
  v_item jsonb;
  v_pid uuid;
  v_qty integer;
  v_p record;
  v_retail numeric;
  v_b2b numeric;
  v_applied numeric;
  v_source text;
  v_reason text;
  v_min integer;
  v_mult integer;
  v_now timestamptz := now();
  v_results jsonb := '[]'::jsonb;
  v_retail_subtotal numeric := 0;
  v_applied_subtotal numeric := 0;
  v_savings numeric := 0;
BEGIN
  IF current_user IN ('anon','authenticated') THEN
    _user_id := auth.uid();
  END IF;

  IF _user_id IS NOT NULL THEN
    SELECT c.id, c.legal_name, c.trade_name, c.cnpj, c.contact_name, c.status
      INTO v_company
      FROM public.company_users cu
      JOIN public.companies c ON c.id = cu.company_id
     WHERE cu.user_id = _user_id
       AND c.status = 'approved'
     ORDER BY cu.created_at ASC
     LIMIT 1;
    IF FOUND THEN
      v_company_approved := true;
    END IF;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := GREATEST(1, COALESCE((v_item->>'qty')::int, 1));

    SELECT id, name, price, sale_price, stock_qty, active,
           b2b_enabled, b2b_price, b2b_min_qty, b2b_qty_multiple, b2b_valid_until
      INTO v_p
      FROM public.products
     WHERE id = v_pid;

    IF NOT FOUND OR v_p.active IS NOT TRUE THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'product_id', v_pid,
        'qty', v_qty,
        'available', false,
        'reason', 'product_unavailable'
      ));
      CONTINUE;
    END IF;

    v_retail := COALESCE(v_p.sale_price, v_p.price);
    v_b2b := v_p.b2b_price;
    v_min := COALESCE(v_p.b2b_min_qty, 1);
    v_mult := COALESCE(v_p.b2b_qty_multiple, 1);
    v_applied := v_retail;
    v_source := 'retail';
    v_reason := NULL;

    IF NOT v_company_approved THEN
      v_reason := 'company_not_approved';
    ELSIF v_p.b2b_enabled IS NOT TRUE THEN
      v_reason := 'b2b_not_enabled';
    ELSIF v_b2b IS NULL OR v_b2b <= 0 THEN
      v_reason := 'no_b2b_price';
    ELSIF v_p.b2b_valid_until IS NOT NULL AND v_p.b2b_valid_until < v_now THEN
      v_reason := 'b2b_expired';
    ELSIF v_qty < v_min THEN
      v_reason := 'below_min_qty';
    ELSIF v_mult > 1 AND ((v_qty - v_min) % v_mult) <> 0 THEN
      v_reason := 'invalid_multiple';
    ELSE
      v_applied := v_b2b;
      v_source := 'b2b';
      v_reason := 'b2b_applied';
    END IF;

    v_retail_subtotal := v_retail_subtotal + (v_retail * v_qty);
    v_applied_subtotal := v_applied_subtotal + (v_applied * v_qty);

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'product_id', v_pid,
      'qty', v_qty,
      'available', true,
      'name', v_p.name,
      'stock_qty', v_p.stock_qty,
      'retail_unit_price', v_retail,
      'b2b_unit_price', v_b2b,
      'applied_unit_price', v_applied,
      'pricing_source', v_source,
      'b2b_discount_unit', GREATEST(0, v_retail - v_applied),
      'b2b_discount_total', GREATEST(0, (v_retail - v_applied) * v_qty),
      'b2b_min_quantity', v_min,
      'b2b_qty_multiple', v_mult,
      'b2b_valid_until', v_p.b2b_valid_until,
      'reason', v_reason
    ));
  END LOOP;

  v_savings := GREATEST(0, v_retail_subtotal - v_applied_subtotal);

  RETURN jsonb_build_object(
    'company_approved', v_company_approved,
    'company', CASE WHEN v_company_approved THEN jsonb_build_object(
      'id', v_company.id,
      'legal_name', v_company.legal_name,
      'trade_name', v_company.trade_name,
      'cnpj', v_company.cnpj,
      'contact_name', v_company.contact_name
    ) ELSE NULL END,
    'items', v_results,
    'retail_subtotal', v_retail_subtotal,
    'applied_subtotal', v_applied_subtotal,
    'b2b_discount_total', v_savings,
    'has_b2b_items', v_savings > 0,
    'validated_at', v_now
  );
END;
$function$;

-- ----------------------------------------------------------------------------
-- get_product_relations_public + get_cart_complementary_products
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_product_relations_public(_product_id uuid, _user_id uuid DEFAULT NULL::uuid, _limit integer DEFAULT 12)
 RETURNS TABLE(relation_id uuid, relation_type product_relation_type, sort_order integer, product_id uuid, name text, slug text, brand text, image text, retail_price numeric, sale_price numeric, applied_price numeric, pricing_source text, b2b_min_quantity integer, stock_qty integer, free_shipping_eligible boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company_approved boolean := false;
  v_now timestamptz := now();
BEGIN
  IF current_user IN ('anon','authenticated') THEN
    _user_id := auth.uid();
  END IF;

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
      THEN 'b2b'::text
      ELSE 'retail'::text
    END,
    p.b2b_min_qty,
    p.stock_qty,
    COALESCE(p.free_shipping_eligible, false)
  FROM public.product_relations r
  JOIN public.products p ON p.id = r.related_product_id
  WHERE r.product_id = _product_id
    AND r.is_active = true
    AND p.active = true
  ORDER BY r.sort_order ASC, r.created_at ASC
  LIMIT GREATEST(1, LEAST(_limit, 24));
END;
$function$;

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
  IF current_user IN ('anon','authenticated') THEN
    _user_id := auth.uid();
  END IF;

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
      THEN 'b2b'::text
      ELSE 'retail'::text
    END,
    p.stock_qty,
    COALESCE(p.free_shipping_eligible, false),
    c.hits
  FROM candidates c
  JOIN public.products p ON p.id = c.pid
  WHERE p.active = true
  ORDER BY c.hits DESC, c.best_sort ASC, p.name ASC
  LIMIT GREATEST(1, LEAST(_limit, 24));
END;
$function$;

-- ----------------------------------------------------------------------------
-- resolve_codes_bulk e validate_cart_bundles: como têm corpos longos e
-- estáveis, fazemos apenas o injection do guard via DO block que recria a
-- função preservando o body atual capturado.
-- ----------------------------------------------------------------------------

DO $do$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'resolve_codes_bulk'
   LIMIT 1;
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'resolve_codes_bulk não encontrada';
  END IF;
  -- Só injeta se ainda não tiver o guard
  IF position('current_user IN (''anon'',''authenticated'')' IN v_def) = 0 THEN
    v_def := regexp_replace(
      v_def,
      E'BEGIN\n',
      E'BEGIN\n  IF current_user IN (\'anon\',\'authenticated\') THEN\n    _user_id := auth.uid();\n  END IF;\n',
      'n'
    );
    EXECUTE v_def;
  END IF;
END
$do$;

DO $do$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'validate_cart_bundles'
   LIMIT 1;
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'validate_cart_bundles não encontrada';
  END IF;
  IF position('current_user IN (''anon'',''authenticated'')' IN v_def) = 0 THEN
    v_def := regexp_replace(
      v_def,
      E'BEGIN\n',
      E'BEGIN\n  IF current_user IN (\'anon\',\'authenticated\') THEN\n    _user_id := auth.uid();\n  END IF;\n',
      'n'
    );
    EXECUTE v_def;
  END IF;
END
$do$;

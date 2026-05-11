-- Fix S3: usar session_user em vez de current_user, porque dentro de
-- funções SECURITY DEFINER current_user é o dono (postgres), não o caller.

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
  IF session_user IN ('anon','authenticated') THEN
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
        'product_id', v_pid, 'qty', v_qty, 'available', false,
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
      'product_id', v_pid, 'qty', v_qty, 'available', true,
      'name', v_p.name, 'stock_qty', v_p.stock_qty,
      'retail_unit_price', v_retail, 'b2b_unit_price', v_b2b,
      'applied_unit_price', v_applied, 'pricing_source', v_source,
      'b2b_discount_unit', GREATEST(0, v_retail - v_applied),
      'b2b_discount_total', GREATEST(0, (v_retail - v_applied) * v_qty),
      'b2b_min_quantity', v_min, 'b2b_qty_multiple', v_mult,
      'b2b_valid_until', v_p.b2b_valid_until, 'reason', v_reason
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

-- Para resolve_codes_bulk e validate_cart_bundles, faz patch in-place
-- substituindo current_user por session_user.
DO $do$
DECLARE
  v_def text;
  v_fname text;
BEGIN
  FOREACH v_fname IN ARRAY ARRAY['resolve_codes_bulk','validate_cart_bundles','get_product_relations_public','get_cart_complementary_products']
  LOOP
    SELECT pg_get_functiondef(p.oid)
      INTO v_def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = v_fname
     LIMIT 1;
    IF v_def IS NULL THEN
      RAISE EXCEPTION '% não encontrada', v_fname;
    END IF;
    v_def := replace(v_def,
      'current_user IN (''anon'',''authenticated'')',
      'session_user IN (''anon'',''authenticated'')');
    EXECUTE v_def;
  END LOOP;
END
$do$;

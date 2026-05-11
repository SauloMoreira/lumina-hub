CREATE OR REPLACE FUNCTION public.validate_b2b_pricing(_user_id uuid, _items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
  v_company_legal text;
  v_company_trade text;
  v_company_cnpj text;
  v_company_contact text;
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
  IF COALESCE(auth.role(), 'anon') <> 'service_role' THEN
    _user_id := auth.uid();
  END IF;

  IF _user_id IS NOT NULL THEN
    SELECT c.id, c.legal_name, c.trade_name, c.cnpj, c.contact_name
      INTO v_company_id, v_company_legal, v_company_trade, v_company_cnpj, v_company_contact
      FROM public.company_users cu
      JOIN public.companies c ON c.id = cu.company_id
     WHERE cu.user_id = _user_id AND c.status = 'approved'
     ORDER BY cu.created_at ASC
     LIMIT 1;
    v_company_approved := v_company_id IS NOT NULL;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := GREATEST(1, COALESCE((v_item->>'qty')::int, 1));
    SELECT id,name,price,sale_price,stock_qty,active,b2b_enabled,b2b_price,b2b_min_qty,b2b_qty_multiple,b2b_valid_until
      INTO v_p FROM public.products WHERE id = v_pid;
    IF NOT FOUND OR v_p.active IS NOT TRUE THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object('product_id',v_pid,'qty',v_qty,'available',false,'reason','product_unavailable'));
      CONTINUE;
    END IF;
    v_retail := COALESCE(v_p.sale_price, v_p.price);
    v_b2b := v_p.b2b_price;
    v_min := COALESCE(v_p.b2b_min_qty,1);
    v_mult := COALESCE(v_p.b2b_qty_multiple,1);
    v_applied := v_retail; v_source := 'retail'; v_reason := NULL;
    IF NOT v_company_approved THEN v_reason := 'company_not_approved';
    ELSIF v_p.b2b_enabled IS NOT TRUE THEN v_reason := 'b2b_not_enabled';
    ELSIF v_b2b IS NULL OR v_b2b <= 0 THEN v_reason := 'no_b2b_price';
    ELSIF v_p.b2b_valid_until IS NOT NULL AND v_p.b2b_valid_until < v_now THEN v_reason := 'b2b_expired';
    ELSIF v_qty < v_min THEN v_reason := 'below_min_qty';
    ELSIF v_mult > 1 AND ((v_qty - v_min) % v_mult) <> 0 THEN v_reason := 'invalid_multiple';
    ELSE v_applied := v_b2b; v_source := 'b2b'; v_reason := 'b2b_applied';
    END IF;
    v_retail_subtotal := v_retail_subtotal + (v_retail * v_qty);
    v_applied_subtotal := v_applied_subtotal + (v_applied * v_qty);
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'product_id',v_pid,'qty',v_qty,'available',true,'name',v_p.name,'stock_qty',v_p.stock_qty,
      'retail_unit_price',v_retail,'b2b_unit_price',v_b2b,'applied_unit_price',v_applied,'pricing_source',v_source,
      'b2b_discount_unit',GREATEST(0,v_retail-v_applied),'b2b_discount_total',GREATEST(0,(v_retail-v_applied)*v_qty),
      'b2b_min_quantity',v_min,'b2b_qty_multiple',v_mult,'b2b_valid_until',v_p.b2b_valid_until,'reason',v_reason));
  END LOOP;
  v_savings := GREATEST(0, v_retail_subtotal - v_applied_subtotal);
  RETURN jsonb_build_object(
    'company_approved', v_company_approved,
    'company', CASE WHEN v_company_approved THEN jsonb_build_object(
      'id',v_company_id,'legal_name',v_company_legal,'trade_name',v_company_trade,
      'cnpj',v_company_cnpj,'contact_name',v_company_contact) ELSE NULL END,
    'items', v_results,
    'retail_subtotal', v_retail_subtotal,
    'applied_subtotal', v_applied_subtotal,
    'b2b_discount_total', v_savings,
    'has_b2b_items', v_savings > 0,
    'validated_at', v_now);
END;
$function$;

-- Fix resolve_codes_bulk:
-- 1) Resetar TODAS as colunas OUT a cada iteração (evita vazamento de dados da linha anterior em CONTINUE antecipado)
-- 2) Tratar quantidade não-numérica (texto) sem quebrar o lote inteiro
CREATE OR REPLACE FUNCTION public.resolve_codes_bulk(_user_id uuid, _items jsonb)
 RETURNS TABLE(line_index integer, original_code text, normalized_code text, requested_quantity integer, match_status text, product_id uuid, product_name text, product_slug text, sku text, ean text, brand text, category_id uuid, image_url text, retail_price numeric, sale_price numeric, applied_preview_price numeric, pricing_source_preview text, b2b_enabled boolean, b2b_price numeric, b2b_min_quantity integer, b2b_qty_multiple integer, b2b_discount_amount numeric, b2b_discount_percent numeric, has_stock boolean, available_stock integer, warnings text[], matched_via text, multiple_options jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
  v_company_approved boolean := false;
  v_now timestamptz := now();
  v_item jsonb;
  v_idx int := 0;
  v_code text;
  v_orig text;
  v_qty int;
  v_qty_raw text;
  v_norm text;
  v_digits text;
  v_p record;
  v_count int;
  v_options jsonb;
  v_matched_via text;
  v_warnings text[];
  v_status text;
  v_retail numeric;
  v_b2b numeric;
  v_min int;
  v_mult int;
  v_b2b_eligible boolean;
  v_applied numeric;
  v_source text;
  v_discount_amount numeric;
  v_discount_pct numeric;
BEGIN
  IF _user_id IS NOT NULL THEN
    v_company_id := public.get_user_approved_company_id(_user_id);
    v_company_approved := v_company_id IS NOT NULL;
  END IF;

  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' THEN
    RETURN;
  END IF;

  IF jsonb_array_length(_items) > 100 THEN
    RAISE EXCEPTION 'too_many_items' USING HINT = 'Máximo 100 linhas por chamada';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    v_idx := v_idx + 1;

    -- RESET de TODAS as colunas OUT (evita vazamento de dados da linha anterior)
    line_index := v_idx;
    original_code := NULL;
    normalized_code := NULL;
    requested_quantity := 0;
    match_status := NULL;
    product_id := NULL;
    product_name := NULL;
    product_slug := NULL;
    sku := NULL;
    ean := NULL;
    brand := NULL;
    category_id := NULL;
    image_url := NULL;
    retail_price := NULL;
    sale_price := NULL;
    applied_preview_price := NULL;
    pricing_source_preview := 'unavailable';
    b2b_enabled := NULL;
    b2b_price := NULL;
    b2b_min_quantity := NULL;
    b2b_qty_multiple := NULL;
    b2b_discount_amount := NULL;
    b2b_discount_percent := NULL;
    has_stock := NULL;
    available_stock := NULL;
    warnings := ARRAY[]::text[];
    matched_via := 'none';
    multiple_options := NULL;

    v_orig := COALESCE(v_item->>'code', '');
    v_qty_raw := v_item->>'qty';

    -- Quantidade defensiva: aceita inteiro; texto ou inválido => invalid_quantity
    BEGIN
      v_qty := COALESCE(v_qty_raw::int, 0);
    EXCEPTION WHEN OTHERS THEN
      v_qty := 0;
    END;

    v_warnings := ARRAY[]::text[];
    v_options := NULL;
    v_matched_via := 'none';
    v_p := NULL;
    v_status := NULL;

    v_code := btrim(v_orig);
    v_norm := public.search_normalize(v_code);
    v_digits := regexp_replace(COALESCE(v_code, ''), '[^0-9]', '', 'g');

    original_code := v_orig;
    normalized_code := v_norm;
    requested_quantity := COALESCE(v_qty, 0);

    -- Quantidade inválida
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 99999 THEN
      match_status := 'invalid_quantity';
      warnings := ARRAY['Informe uma quantidade válida.']::text[];
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Código vazio
    IF v_code IS NULL OR length(v_code) = 0 THEN
      match_status := 'not_found';
      warnings := ARRAY['Código vazio.']::text[];
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- 1ª prioridade: SKU exato
    SELECT p.* INTO v_p
      FROM public.products p
     WHERE p.sku IS NOT NULL
       AND lower(btrim(p.sku)) = lower(v_code)
     LIMIT 1;

    IF FOUND THEN
      v_matched_via := 'sku';
    ELSE
      -- 2ª prioridade: EAN/GTIN exato
      IF length(v_digits) BETWEEN 8 AND 14 THEN
        SELECT p.* INTO v_p
          FROM public.products p
         WHERE p.gtin_ean IS NOT NULL
           AND regexp_replace(p.gtin_ean, '[^0-9]', '', 'g') = v_digits
         LIMIT 1;
        IF FOUND THEN
          v_matched_via := 'ean';
        END IF;
      END IF;

      -- 3ª prioridade: nome
      IF v_p.id IS NULL AND length(v_norm) >= 3 THEN
        SELECT p.* INTO v_p
          FROM public.products p
         WHERE p.active = true
           AND public.search_normalize(p.name) = v_norm
         LIMIT 1;
        IF FOUND THEN
          v_matched_via := 'name';
        ELSE
          SELECT count(*) INTO v_count
            FROM public.products p
           WHERE p.active = true
             AND public.search_normalize(p.name) LIKE '%' || v_norm || '%';

          IF v_count = 1 THEN
            SELECT p.* INTO v_p
              FROM public.products p
             WHERE p.active = true
               AND public.search_normalize(p.name) LIKE '%' || v_norm || '%'
             LIMIT 1;
            v_matched_via := 'name';
          ELSIF v_count > 1 THEN
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                     'product_id', p.id,
                     'name', p.name,
                     'slug', p.slug,
                     'sku', p.sku,
                     'ean', p.gtin_ean,
                     'brand', p.brand,
                     'image_url', CASE WHEN array_length(p.images,1) > 0 THEN p.images[1] ELSE NULL END,
                     'retail_price', COALESCE(p.sale_price, p.price)
                   )), '[]'::jsonb)
              INTO v_options
              FROM (
                SELECT p.*
                  FROM public.products p
                 WHERE p.active = true
                   AND public.search_normalize(p.name) LIKE '%' || v_norm || '%'
                 ORDER BY p.featured DESC, p.name ASC
                 LIMIT 5
              ) p;

            match_status := 'multiple_matches';
            warnings := ARRAY['Vários produtos correspondem a esse termo. Selecione um.']::text[];
            matched_via := 'name';
            multiple_options := v_options;
            RETURN NEXT;
            CONTINUE;
          END IF;
        END IF;
      END IF;
    END IF;

    -- Não encontrado
    IF v_p.id IS NULL THEN
      match_status := 'not_found';
      warnings := ARRAY['Produto não encontrado.']::text[];
      matched_via := 'none';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Inativo
    IF v_p.active IS NOT TRUE THEN
      match_status := 'inactive_product';
      product_id := v_p.id;
      product_name := v_p.name;
      product_slug := v_p.slug;
      sku := v_p.sku;
      ean := v_p.gtin_ean;
      warnings := ARRAY['Produto indisponível.']::text[];
      matched_via := v_matched_via;
      RETURN NEXT;
      CONTINUE;
    END IF;

    v_retail := COALESCE(v_p.sale_price, v_p.price);

    -- Sem preço
    IF v_retail IS NULL OR v_retail <= 0 THEN
      match_status := 'no_price';
      product_id := v_p.id;
      product_name := v_p.name;
      product_slug := v_p.slug;
      sku := v_p.sku;
      ean := v_p.gtin_ean;
      brand := v_p.brand;
      category_id := v_p.category_id;
      image_url := CASE WHEN array_length(v_p.images,1) > 0 THEN v_p.images[1] ELSE NULL END;
      warnings := ARRAY['Produto sem preço cadastrado.']::text[];
      matched_via := v_matched_via;
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- B2B preview
    v_b2b := v_p.b2b_price;
    v_min := COALESCE(v_p.b2b_min_qty, 1);
    v_mult := COALESCE(v_p.b2b_qty_multiple, 1);
    v_b2b_eligible :=
      v_company_approved
      AND v_p.b2b_enabled = true
      AND v_b2b IS NOT NULL AND v_b2b > 0
      AND (v_p.b2b_valid_until IS NULL OR v_p.b2b_valid_until >= v_now);

    v_applied := v_retail;
    v_source := 'retail';
    v_discount_amount := 0;
    v_discount_pct := 0;

    IF v_b2b_eligible THEN
      IF v_qty < v_min THEN
        v_warnings := v_warnings || ('Para acessar o preço empresa deste produto, compre a partir de '
                                     || v_min || ' unidades. Com a quantidade atual, será aplicado o preço de varejo.');
      ELSIF v_mult > 1 AND ((v_qty - v_min) % v_mult) <> 0 THEN
        v_warnings := v_warnings || ('Quantidade deve ser múltipla de ' || v_mult || ' (a partir de ' || v_min || ').');
      ELSE
        v_applied := v_b2b;
        v_source := 'b2b';
        v_discount_amount := GREATEST(0, v_retail - v_b2b);
        IF v_retail > 0 THEN
          v_discount_pct := round(((v_retail - v_b2b) / v_retail) * 100, 2);
        END IF;
      END IF;
    END IF;

    -- Estoque
    IF v_p.stock_qty IS NULL OR v_p.stock_qty <= 0 THEN
      v_status := 'out_of_stock';
      v_warnings := v_warnings || 'Sem estoque no momento.';
    ELSIF v_qty > v_p.stock_qty THEN
      v_warnings := v_warnings || ('Estoque atual: ' || v_p.stock_qty || ' un.');
      v_status := 'found';
    ELSE
      v_status := 'found';
    END IF;

    match_status := v_status;
    product_id := v_p.id;
    product_name := v_p.name;
    product_slug := v_p.slug;
    sku := v_p.sku;
    ean := v_p.gtin_ean;
    brand := v_p.brand;
    category_id := v_p.category_id;
    image_url := CASE WHEN array_length(v_p.images,1) > 0 THEN v_p.images[1] ELSE NULL END;
    retail_price := v_p.price;
    sale_price := v_p.sale_price;
    applied_preview_price := v_applied;
    pricing_source_preview := v_source;
    b2b_enabled := v_p.b2b_enabled = true;
    b2b_price := CASE WHEN v_b2b_eligible THEN v_b2b ELSE NULL END;
    b2b_min_quantity := CASE WHEN v_b2b_eligible THEN v_min ELSE NULL END;
    b2b_qty_multiple := CASE WHEN v_b2b_eligible THEN v_mult ELSE NULL END;
    b2b_discount_amount := CASE WHEN v_b2b_eligible THEN v_discount_amount ELSE NULL END;
    b2b_discount_percent := CASE WHEN v_b2b_eligible THEN v_discount_pct ELSE NULL END;
    has_stock := COALESCE(v_p.stock_qty, 0) > 0;
    available_stock := COALESCE(v_p.stock_qty, 0);
    warnings := v_warnings;
    matched_via := v_matched_via;
    multiple_options := NULL;
    RETURN NEXT;
  END LOOP;
END;
$function$;
-- ============================================================================
-- resolve_codes_bulk: resolve códigos (SKU, EAN/GTIN, nome) em lote
-- para a feature de Compra Rápida (/compra-rapida).
--
-- Entrada: array de jsonb { code: text, qty: int }
-- Saída: uma linha por entrada, na MESMA ORDEM, com status de match e
--        preview de preço (B2B exposto somente se a empresa do usuário
--        estiver aprovada — chave get_user_approved_company_id).
--
-- O carrinho/checkout continuam sendo a fonte da verdade para preço,
-- estoque e B2B (validate_b2b_pricing).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_codes_bulk(
  _user_id uuid,
  _items   jsonb
)
RETURNS TABLE (
  line_index            int,
  original_code         text,
  normalized_code       text,
  requested_quantity    int,
  match_status          text,        -- found | not_found | multiple_matches | invalid_quantity | inactive_product | no_price | out_of_stock
  product_id            uuid,
  product_name          text,
  product_slug          text,
  sku                   text,
  ean                   text,
  brand                 text,
  category_id           uuid,
  image_url             text,
  retail_price          numeric,
  sale_price            numeric,
  applied_preview_price numeric,
  pricing_source_preview text,       -- retail | b2b | unavailable
  b2b_enabled           boolean,
  b2b_price             numeric,
  b2b_min_quantity      int,
  b2b_qty_multiple      int,
  b2b_discount_amount   numeric,
  b2b_discount_percent  numeric,
  has_stock             boolean,
  available_stock       int,
  warnings              text[],
  matched_via           text,        -- sku | ean | name | none
  multiple_options      jsonb        -- até 5 sugestões quando match_status = multiple_matches
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_company_approved boolean := false;
  v_now timestamptz := now();
  v_item jsonb;
  v_idx int := 0;
  v_code text;
  v_orig text;
  v_qty int;
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
  -- 1) Empresa aprovada do usuário
  IF _user_id IS NOT NULL THEN
    v_company_id := public.get_user_approved_company_id(_user_id);
    v_company_approved := v_company_id IS NOT NULL;
  END IF;

  -- 2) Limite defensivo: no máx. 100 itens
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' THEN
    RETURN;
  END IF;

  IF jsonb_array_length(_items) > 100 THEN
    RAISE EXCEPTION 'too_many_items' USING HINT = 'Máximo 100 linhas por chamada';
  END IF;

  -- 3) Para cada item de entrada
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    v_idx := v_idx + 1;
    v_orig := COALESCE(v_item->>'code', '');
    v_qty := COALESCE((v_item->>'qty')::int, 0);
    v_warnings := ARRAY[]::text[];
    v_options := NULL;
    v_matched_via := 'none';
    v_p := NULL;
    v_status := NULL;

    -- Normalização: trim + remove separadores; mantém dígitos para EAN
    v_code := btrim(v_orig);
    v_norm := public.search_normalize(v_code);
    v_digits := regexp_replace(COALESCE(v_code, ''), '[^0-9]', '', 'g');

    -- Quantidade inválida
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 99999 THEN
      line_index := v_idx;
      original_code := v_orig;
      normalized_code := v_norm;
      requested_quantity := COALESCE(v_qty, 0);
      match_status := 'invalid_quantity';
      pricing_source_preview := 'unavailable';
      warnings := ARRAY['Informe uma quantidade válida.']::text[];
      matched_via := 'none';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Código vazio
    IF v_code IS NULL OR length(v_code) = 0 THEN
      line_index := v_idx;
      original_code := v_orig;
      normalized_code := v_norm;
      requested_quantity := v_qty;
      match_status := 'not_found';
      pricing_source_preview := 'unavailable';
      warnings := ARRAY['Código vazio.']::text[];
      matched_via := 'none';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- 1ª prioridade: SKU exato (case-insensitive)
    SELECT p.* INTO v_p
      FROM public.products p
     WHERE p.sku IS NOT NULL
       AND lower(btrim(p.sku)) = lower(v_code)
     LIMIT 1;

    IF FOUND THEN
      v_matched_via := 'sku';
    ELSE
      -- 2ª prioridade: EAN/GTIN exato (somente dígitos)
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

      -- 3ª prioridade: nome (exato normalizado, depois aproximado)
      IF v_p.id IS NULL AND length(v_norm) >= 3 THEN
        -- exato por nome normalizado
        SELECT p.* INTO v_p
          FROM public.products p
         WHERE p.active = true
           AND public.search_normalize(p.name) = v_norm
         LIMIT 1;
        IF FOUND THEN
          v_matched_via := 'name';
        ELSE
          -- aproximado: conta quantos batem por LIKE
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
            -- múltiplos: devolve até 5 opções
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

            line_index := v_idx;
            original_code := v_orig;
            normalized_code := v_norm;
            requested_quantity := v_qty;
            match_status := 'multiple_matches';
            pricing_source_preview := 'unavailable';
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
      line_index := v_idx;
      original_code := v_orig;
      normalized_code := v_norm;
      requested_quantity := v_qty;
      match_status := 'not_found';
      pricing_source_preview := 'unavailable';
      warnings := ARRAY['Produto não encontrado.']::text[];
      matched_via := 'none';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Inativo
    IF v_p.active IS NOT TRUE THEN
      line_index := v_idx;
      original_code := v_orig;
      normalized_code := v_norm;
      requested_quantity := v_qty;
      match_status := 'inactive_product';
      product_id := v_p.id;
      product_name := v_p.name;
      product_slug := v_p.slug;
      sku := v_p.sku;
      ean := v_p.gtin_ean;
      pricing_source_preview := 'unavailable';
      warnings := ARRAY['Produto indisponível.']::text[];
      matched_via := v_matched_via;
      RETURN NEXT;
      CONTINUE;
    END IF;

    v_retail := COALESCE(v_p.sale_price, v_p.price);

    -- Sem preço
    IF v_retail IS NULL OR v_retail <= 0 THEN
      line_index := v_idx;
      original_code := v_orig;
      normalized_code := v_norm;
      requested_quantity := v_qty;
      match_status := 'no_price';
      product_id := v_p.id;
      product_name := v_p.name;
      product_slug := v_p.slug;
      sku := v_p.sku;
      ean := v_p.gtin_ean;
      brand := v_p.brand;
      category_id := v_p.category_id;
      image_url := CASE WHEN array_length(v_p.images,1) > 0 THEN v_p.images[1] ELSE NULL END;
      pricing_source_preview := 'unavailable';
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

    -- Linha final
    line_index := v_idx;
    original_code := v_orig;
    normalized_code := v_norm;
    requested_quantity := v_qty;
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
$$;

-- Permissões: usada via server function (admin client). Exposição pública não é necessária,
-- mas concedemos execute para o role de servidor.
REVOKE ALL ON FUNCTION public.resolve_codes_bulk(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_codes_bulk(uuid, jsonb) TO authenticated, anon, service_role;
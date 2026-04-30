-- 1) Configuração: combo + cupom acumulam?
ALTER TABLE public.b2b_settings
  ADD COLUMN IF NOT EXISTS allow_bundle_discount_with_coupon boolean NOT NULL DEFAULT false;

-- 2) RPC: prévia de descontos de combo para um carrinho
--   Retorna uma linha por combo CANDIDATO (todo combo ativo que tem ao menos
--   1 item presente no carrinho do cliente). Status indica elegibilidade.
--   NÃO altera nada — apenas leitura/cálculo.
CREATE OR REPLACE FUNCTION public.validate_cart_bundles(
  _user_id uuid,
  _items jsonb,            -- [{product_id, qty}]
  _has_coupon boolean DEFAULT false
)
RETURNS TABLE (
  bundle_id uuid,
  bundle_slug text,
  bundle_name text,
  bundle_image text,
  discount_type text,
  discount_value numeric,
  status text,             -- eligible_preview | not_eligible | blocked_by_b2b | blocked_by_coupon | missing_items | expired | inactive | needs_review
  eligible_subtotal numeric,
  estimated_discount numeric,
  considered_items jsonb,  -- itens do carrinho que pertencem ao combo (com qty/preco)
  missing_items jsonb,     -- itens obrigatórios que faltam ou estão com qty insuficiente
  reason text,
  warnings text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_approved boolean := false;
  v_now timestamptz := now();
  v_allow_with_coupon boolean := false;
  v_product_ids uuid[];
  r record;
  v_b record;
  v_items_json jsonb;
  v_missing_json jsonb;
  v_eligible_subtotal numeric;
  v_b2b_subtotal numeric;
  v_retail_subtotal numeric;
  v_total_units int;
  v_required_ok boolean;
  v_status text;
  v_reason text;
  v_warnings text[];
  v_discount numeric;
  v_pct numeric;
  v_some_b2b boolean;
  v_all_b2b boolean;
BEGIN
  -- Settings de cupom + combo
  SELECT COALESCE(s.allow_bundle_discount_with_coupon, false)
    INTO v_allow_with_coupon
    FROM public.b2b_settings s
    LIMIT 1;
  v_allow_with_coupon := COALESCE(v_allow_with_coupon, false);

  -- Empresa aprovada?
  IF _user_id IS NOT NULL THEN
    IF public.get_user_approved_company_id(_user_id) IS NOT NULL THEN
      v_company_approved := true;
    END IF;
  END IF;

  -- Defesa
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RETURN;
  END IF;

  -- Coleta product_ids do carrinho
  SELECT array_agg(DISTINCT (i->>'product_id')::uuid)
    INTO v_product_ids
    FROM jsonb_array_elements(_items) i
   WHERE i->>'product_id' IS NOT NULL;

  IF v_product_ids IS NULL OR array_length(v_product_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Itera nos combos ativos que contêm pelo menos um produto do carrinho
  FOR v_b IN
    SELECT DISTINCT b.id, b.slug, b.name, b.image_url,
           b.discount_type::text AS discount_type,
           b.discount_value, b.is_active, b.start_date, b.end_date
      FROM public.product_bundles b
      JOIN public.product_bundle_items bi ON bi.bundle_id = b.id
     WHERE bi.product_id = ANY(v_product_ids)
  LOOP
    v_status := 'eligible_preview';
    v_reason := NULL;
    v_warnings := ARRAY[]::text[];
    v_discount := 0;
    v_eligible_subtotal := 0;
    v_b2b_subtotal := 0;
    v_retail_subtotal := 0;
    v_total_units := 0;
    v_some_b2b := false;
    v_all_b2b := true;

    -- Inativo
    IF v_b.is_active IS NOT TRUE THEN
      v_status := 'inactive';
      v_reason := 'Combo inativo.';
    END IF;

    -- Validade
    IF v_status = 'eligible_preview' THEN
      IF (v_b.start_date IS NOT NULL AND v_b.start_date > v_now)
         OR (v_b.end_date IS NOT NULL AND v_b.end_date < v_now) THEN
        v_status := 'expired';
        v_reason := 'Combo fora da validade.';
      END IF;
    END IF;

    -- Considerados / faltantes
    --   Para cada item do combo, junta com a quantidade do carrinho e dados do produto
    WITH bundle_items AS (
      SELECT bi.product_id, bi.quantity AS required_qty, bi.is_required, bi.sort_order
        FROM public.product_bundle_items bi
       WHERE bi.bundle_id = v_b.id
    ),
    cart_items AS (
      SELECT (i->>'product_id')::uuid AS product_id,
             GREATEST(1, COALESCE((i->>'qty')::int, 1)) AS qty
        FROM jsonb_array_elements(_items) i
    ),
    joined AS (
      SELECT bi.product_id,
             bi.required_qty,
             bi.is_required,
             bi.sort_order,
             COALESCE(ci.qty, 0) AS cart_qty,
             p.name AS product_name,
             p.slug AS product_slug,
             p.active AS product_active,
             p.price,
             p.sale_price,
             p.b2b_enabled,
             p.b2b_price,
             p.b2b_min_qty,
             p.b2b_qty_multiple,
             p.b2b_valid_until,
             CASE WHEN array_length(p.images,1) > 0 THEN p.images[1] ELSE NULL END AS image
        FROM bundle_items bi
        LEFT JOIN cart_items ci ON ci.product_id = bi.product_id
        LEFT JOIN public.products p ON p.id = bi.product_id
    )
    SELECT
      COALESCE(jsonb_agg(jsonb_build_object(
        'product_id', j.product_id,
        'product_name', j.product_name,
        'product_slug', j.product_slug,
        'image', j.image,
        'required_qty', j.required_qty,
        'cart_qty', j.cart_qty,
        'is_required', j.is_required,
        'unit_price',
          CASE
            WHEN v_company_approved
             AND j.b2b_enabled = true
             AND j.b2b_price IS NOT NULL AND j.b2b_price > 0
             AND (j.b2b_valid_until IS NULL OR j.b2b_valid_until >= v_now)
             AND j.cart_qty >= COALESCE(j.b2b_min_qty, 1)
            THEN j.b2b_price
            ELSE COALESCE(j.sale_price, j.price)
          END,
        'pricing_source',
          CASE
            WHEN v_company_approved
             AND j.b2b_enabled = true
             AND j.b2b_price IS NOT NULL AND j.b2b_price > 0
             AND (j.b2b_valid_until IS NULL OR j.b2b_valid_until >= v_now)
             AND j.cart_qty >= COALESCE(j.b2b_min_qty, 1)
            THEN 'b2b' ELSE 'retail'
          END
      ) ORDER BY j.sort_order)
        FILTER (WHERE j.cart_qty > 0),
        '[]'::jsonb
      ),
      COALESCE(jsonb_agg(jsonb_build_object(
        'product_id', j.product_id,
        'product_name', j.product_name,
        'product_slug', j.product_slug,
        'required_qty', j.required_qty,
        'cart_qty', j.cart_qty,
        'is_required', j.is_required,
        'reason',
          CASE
            WHEN j.product_active IS NOT TRUE THEN 'inactive'
            WHEN COALESCE(j.sale_price, j.price) IS NULL OR COALESCE(j.sale_price, j.price) <= 0 THEN 'no_price'
            WHEN j.cart_qty = 0 THEN 'missing'
            WHEN j.cart_qty < j.required_qty THEN 'low_qty'
            ELSE 'ok'
          END
      ) ORDER BY j.sort_order)
        FILTER (WHERE
          j.is_required = true
          AND (
            j.product_active IS NOT TRUE
            OR COALESCE(j.sale_price, j.price) IS NULL
            OR COALESCE(j.sale_price, j.price) <= 0
            OR j.cart_qty < j.required_qty
          )
        ),
        '[]'::jsonb
      ),
      -- subtotal elegível para desconto = itens presentes que NÃO são B2B
      COALESCE(SUM(
        CASE
          WHEN j.cart_qty > 0
           AND NOT (
             v_company_approved
             AND j.b2b_enabled = true
             AND j.b2b_price IS NOT NULL AND j.b2b_price > 0
             AND (j.b2b_valid_until IS NULL OR j.b2b_valid_until >= v_now)
             AND j.cart_qty >= COALESCE(j.b2b_min_qty, 1)
           )
          THEN COALESCE(j.sale_price, j.price) * LEAST(j.cart_qty, j.required_qty)
          ELSE 0
        END
      ), 0),
      -- subtotal B2B (apenas para diagnóstico)
      COALESCE(SUM(
        CASE
          WHEN j.cart_qty > 0
           AND v_company_approved
           AND j.b2b_enabled = true
           AND j.b2b_price IS NOT NULL AND j.b2b_price > 0
           AND (j.b2b_valid_until IS NULL OR j.b2b_valid_until >= v_now)
           AND j.cart_qty >= COALESCE(j.b2b_min_qty, 1)
          THEN j.b2b_price * LEAST(j.cart_qty, j.required_qty)
          ELSE 0
        END
      ), 0),
      COALESCE(SUM(
        CASE WHEN j.cart_qty > 0 THEN COALESCE(j.sale_price, j.price) * LEAST(j.cart_qty, j.required_qty) ELSE 0 END
      ), 0),
      COALESCE(SUM(LEAST(j.cart_qty, j.required_qty)) FILTER (WHERE j.cart_qty > 0), 0),
      bool_and(
        CASE
          WHEN j.is_required = false THEN true
          WHEN j.product_active IS NOT TRUE THEN false
          WHEN COALESCE(j.sale_price, j.price) IS NULL OR COALESCE(j.sale_price, j.price) <= 0 THEN false
          WHEN j.cart_qty < j.required_qty THEN false
          ELSE true
        END
      )
    INTO v_items_json, v_missing_json, v_eligible_subtotal, v_b2b_subtotal, v_retail_subtotal, v_total_units, v_required_ok
    FROM joined j;

    -- Diagnóstico B2B
    IF v_b2b_subtotal > 0 THEN
      v_some_b2b := true;
      IF v_eligible_subtotal = 0 THEN
        v_all_b2b := true;
      ELSE
        v_all_b2b := false;
      END IF;
    ELSE
      v_some_b2b := false;
      v_all_b2b := false;
    END IF;

    -- Itens obrigatórios faltando?
    IF v_status = 'eligible_preview' AND v_required_ok IS NOT TRUE THEN
      v_status := 'missing_items';
      v_reason := 'Adicione os itens obrigatórios para ativar o desconto deste combo.';
    END IF;

    -- Sem desconto configurado: ainda assim é elegível, mas com 0
    IF v_status = 'eligible_preview' AND v_b.discount_type = 'none' THEN
      v_status := 'not_eligible';
      v_reason := 'Combo sem desconto configurado.';
    END IF;

    -- B2B "vence": se TODOS os itens elegíveis estão em B2B, combo bloqueado
    IF v_status = 'eligible_preview' AND v_company_approved AND v_all_b2b THEN
      v_status := 'blocked_by_b2b';
      v_reason := 'Os itens deste combo já receberam o preço empresa. O desconto de combo não é acumulativo com B2B.';
      v_warnings := v_warnings || 'O preço empresa já foi aplicado. Descontos de combo não são acumulativos com condição B2B.';
    END IF;

    -- Cupom aplicado e configuração não permite acumular
    IF v_status = 'eligible_preview' AND _has_coupon AND v_allow_with_coupon = false THEN
      v_status := 'blocked_by_coupon';
      v_reason := 'Há um cupom aplicado. O desconto de combo não é acumulativo com cupom.';
      v_warnings := v_warnings || 'Desconto de combo não é acumulativo com cupom promocional.';
    END IF;

    -- Calcula desconto estimado se ainda elegível
    IF v_status = 'eligible_preview' THEN
      IF v_b.discount_type = 'fixed_amount' THEN
        v_discount := LEAST(GREATEST(0, COALESCE(v_b.discount_value, 0)), v_eligible_subtotal);
      ELSIF v_b.discount_type = 'percentage' THEN
        v_pct := LEAST(GREATEST(0, COALESCE(v_b.discount_value, 0)), 100);
        v_discount := round(v_eligible_subtotal * (v_pct / 100.0), 2);
        v_discount := LEAST(v_discount, v_eligible_subtotal);
      END IF;

      IF v_discount <= 0 THEN
        v_status := 'not_eligible';
        v_reason := 'Desconto resultante é zero.';
      END IF;
    END IF;

    -- Aviso adicional se há mistura B2B + varejo no combo
    IF v_status = 'eligible_preview' AND v_some_b2b AND NOT v_all_b2b THEN
      v_warnings := v_warnings ||
        'Itens com preço empresa neste combo não recebem o desconto adicional — o cálculo considera apenas os itens de varejo.';
    END IF;

    bundle_id := v_b.id;
    bundle_slug := v_b.slug;
    bundle_name := v_b.name;
    bundle_image := v_b.image_url;
    discount_type := v_b.discount_type;
    discount_value := v_b.discount_value;
    status := v_status;
    eligible_subtotal := v_eligible_subtotal;
    estimated_discount := v_discount;
    considered_items := v_items_json;
    missing_items := v_missing_json;
    reason := v_reason;
    warnings := v_warnings;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_cart_bundles(uuid, jsonb, boolean) TO anon, authenticated;
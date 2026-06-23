-- v1.0.4 — RPC atômica de importação de produtos via planilha
-- Aceita { mode, payload, attrs } e grava produto + atributos como uma unidade.
-- Em falha de qualquer passo, a função RAISE e a linha é totalmente revertida.

CREATE OR REPLACE FUNCTION public.import_product_with_attrs(
  _mode text,
  _payload jsonb,
  _attrs jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
  v_aal text;
  v_product_id uuid;
  v_attr jsonb;
  v_allowed_keys text[] := ARRAY[
    'id','sku','name','slug','description','price','cost_price','stock_qty',
    'category_id','brand','gtin_ean','ncm','cest','cfop_default','active',
    'seo_title','seo_description','tags','weight_kg'
  ];
  v_payload jsonb := '{}'::jsonb;
  v_key text;
BEGIN
  -- 1. Authz: service_role bypass (servidor já validou admin+AAL2).
  --    Caller autenticado direto: exigir admin + AAL2.
  v_role := coalesce(auth.role(), '');
  IF v_role <> 'service_role' THEN
    IF NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Access denied: admin only' USING ERRCODE = '42501';
    END IF;
    v_aal := coalesce(auth.jwt() ->> 'aal', '');
    IF v_aal <> 'aal2' THEN
      RAISE EXCEPTION 'MFA required (AAL2)' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 2. Whitelist do payload: ignora qualquer chave fora da lista.
  IF _payload IS NULL OR jsonb_typeof(_payload) <> 'object' THEN
    RAISE EXCEPTION 'Payload inválido';
  END IF;
  FOR v_key IN SELECT jsonb_object_keys(_payload) LOOP
    IF v_key = ANY(v_allowed_keys) THEN
      v_payload := v_payload || jsonb_build_object(v_key, _payload -> v_key);
    END IF;
  END LOOP;

  -- 3. Mode dispatch
  IF _mode = 'create' THEN
    IF coalesce(trim(v_payload ->> 'sku'), '') = '' THEN
      RAISE EXCEPTION 'SKU obrigatório para criar produto';
    END IF;
    IF coalesce(trim(v_payload ->> 'name'), '') = '' THEN
      RAISE EXCEPTION 'Nome obrigatório para criar produto';
    END IF;
    IF coalesce(trim(v_payload ->> 'slug'), '') = '' THEN
      RAISE EXCEPTION 'Slug obrigatório para criar produto';
    END IF;
    IF coalesce(trim(v_payload ->> 'price'), '') = '' THEN
      RAISE EXCEPTION 'Preço obrigatório para criar produto';
    END IF;

    INSERT INTO public.products (
      sku, name, slug, description, price, cost_price, stock_qty, category_id,
      brand, gtin_ean, ncm, cest, cfop_default, active,
      seo_title, seo_description, tags, weight_kg
    ) VALUES (
      v_payload ->> 'sku',
      v_payload ->> 'name',
      v_payload ->> 'slug',
      NULLIF(v_payload ->> 'description', ''),
      (v_payload ->> 'price')::numeric,
      NULLIF(v_payload ->> 'cost_price', '')::numeric,
      COALESCE((v_payload ->> 'stock_qty')::int, 0),
      NULLIF(v_payload ->> 'category_id', '')::uuid,
      NULLIF(v_payload ->> 'brand', ''),
      NULLIF(v_payload ->> 'gtin_ean', ''),
      NULLIF(v_payload ->> 'ncm', ''),
      NULLIF(v_payload ->> 'cest', ''),
      NULLIF(v_payload ->> 'cfop_default', ''),
      COALESCE((v_payload ->> 'active')::boolean, false),
      NULLIF(v_payload ->> 'seo_title', ''),
      NULLIF(v_payload ->> 'seo_description', ''),
      CASE
        WHEN v_payload ? 'tags' AND jsonb_typeof(v_payload -> 'tags') = 'array'
          THEN ARRAY(SELECT jsonb_array_elements_text(v_payload -> 'tags'))
        ELSE NULL
      END,
      NULLIF(v_payload ->> 'weight_kg', '')::numeric
    )
    RETURNING id INTO v_product_id;

  ELSIF _mode = 'update' THEN
    v_product_id := NULLIF(v_payload ->> 'id', '')::uuid;
    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'ID obrigatório para atualizar produto';
    END IF;

    UPDATE public.products SET
      name            = COALESCE(NULLIF(v_payload ->> 'name', ''), name),
      category_id     = COALESCE(NULLIF(v_payload ->> 'category_id', '')::uuid, category_id),
      price           = COALESCE((NULLIF(v_payload ->> 'price', ''))::numeric, price),
      cost_price      = CASE WHEN v_payload ? 'cost_price' THEN NULLIF(v_payload ->> 'cost_price', '')::numeric ELSE cost_price END,
      description     = CASE WHEN v_payload ? 'description' THEN NULLIF(v_payload ->> 'description', '') ELSE description END,
      brand           = CASE WHEN v_payload ? 'brand' THEN NULLIF(v_payload ->> 'brand', '') ELSE brand END,
      gtin_ean        = CASE WHEN v_payload ? 'gtin_ean' THEN NULLIF(v_payload ->> 'gtin_ean', '') ELSE gtin_ean END,
      ncm             = CASE WHEN v_payload ? 'ncm' THEN NULLIF(v_payload ->> 'ncm', '') ELSE ncm END,
      cest            = CASE WHEN v_payload ? 'cest' THEN NULLIF(v_payload ->> 'cest', '') ELSE cest END,
      cfop_default    = CASE WHEN v_payload ? 'cfop_default' THEN NULLIF(v_payload ->> 'cfop_default', '') ELSE cfop_default END,
      active          = CASE WHEN v_payload ? 'active' THEN (v_payload ->> 'active')::boolean ELSE active END,
      seo_title       = CASE WHEN v_payload ? 'seo_title' THEN NULLIF(v_payload ->> 'seo_title', '') ELSE seo_title END,
      seo_description = CASE WHEN v_payload ? 'seo_description' THEN NULLIF(v_payload ->> 'seo_description', '') ELSE seo_description END,
      tags            = CASE
                          WHEN v_payload ? 'tags' AND jsonb_typeof(v_payload -> 'tags') = 'array'
                            THEN ARRAY(SELECT jsonb_array_elements_text(v_payload -> 'tags'))
                          ELSE tags
                        END,
      weight_kg       = CASE WHEN v_payload ? 'weight_kg' THEN NULLIF(v_payload ->> 'weight_kg', '')::numeric ELSE weight_kg END,
      updated_at      = now()
    WHERE id = v_product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto não encontrado para atualizar';
    END IF;

  ELSE
    RAISE EXCEPTION 'Modo inválido: %', _mode;
  END IF;

  -- 4. Atributos técnicos: upsert por (product_id, lower(attribute_key))
  IF _attrs IS NOT NULL AND jsonb_typeof(_attrs) = 'array' THEN
    FOR v_attr IN SELECT * FROM jsonb_array_elements(_attrs) LOOP
      IF coalesce(trim(v_attr ->> 'attribute_key'), '') = ''
         OR coalesce(trim(v_attr ->> 'attribute_value'), '') = '' THEN
        CONTINUE;
      END IF;

      INSERT INTO public.product_attributes (
        product_id, attribute_key, attribute_label, attribute_value,
        attribute_unit, sort_order, is_visible, is_filterable
      ) VALUES (
        v_product_id,
        substr(trim(v_attr ->> 'attribute_key'), 1, 80),
        substr(coalesce(trim(v_attr ->> 'attribute_label'), trim(v_attr ->> 'attribute_key')), 1, 120),
        substr(trim(v_attr ->> 'attribute_value'), 1, 500),
        NULLIF(substr(coalesce(v_attr ->> 'attribute_unit', ''), 1, 20), ''),
        coalesce((v_attr ->> 'sort_order')::int, 0),
        coalesce((v_attr ->> 'is_visible')::boolean, true),
        coalesce((v_attr ->> 'is_filterable')::boolean, false)
      )
      ON CONFLICT (product_id, lower(attribute_key)) DO UPDATE SET
        attribute_label = EXCLUDED.attribute_label,
        attribute_value = EXCLUDED.attribute_value,
        attribute_unit  = EXCLUDED.attribute_unit,
        sort_order      = EXCLUDED.sort_order,
        is_visible      = EXCLUDED.is_visible,
        is_filterable   = EXCLUDED.is_filterable,
        updated_at      = now();
    END LOOP;
  END IF;

  RETURN jsonb_build_object('product_id', v_product_id, 'mode', _mode);
END;
$$;

-- Restringe execução: ninguém público; só authenticated (com checagem admin+AAL2 dentro)
REVOKE ALL ON FUNCTION public.import_product_with_attrs(text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_product_with_attrs(text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_product_with_attrs(text, jsonb, jsonb) TO service_role;
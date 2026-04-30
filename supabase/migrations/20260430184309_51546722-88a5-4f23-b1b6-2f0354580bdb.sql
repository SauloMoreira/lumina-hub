CREATE OR REPLACE FUNCTION public.get_homepage_showcases_public()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_now timestamptz := now();
  v_result jsonb := '[]'::jsonb;
  v_showcase record;
  v_items jsonb;
  v_limit int;
BEGIN
  IF v_user_id IS NOT NULL THEN
    v_company_id := public.get_user_approved_company_id(v_user_id);
  END IF;

  FOR v_showcase IN
    SELECT * FROM public.homepage_product_showcases
    WHERE is_active = true
    ORDER BY sort_order ASC, created_at ASC
  LOOP
    v_limit := GREATEST(1, LEAST(COALESCE(v_showcase.product_limit, 8), 24));
    v_items := '[]'::jsonb;

    -- ===== MODO MANUAL =====
    IF v_showcase.mode = 'manual' THEN
      -- Produtos manuais
      WITH manual_products AS (
        SELECT i.sort_order, p.*
        FROM public.homepage_showcase_items i
        JOIN public.products p ON p.id = i.product_id
        WHERE i.showcase_id = v_showcase.id
          AND i.is_active = true
          AND i.item_type = 'product'
          AND p.active = true
          AND COALESCE(p.sale_price, p.price) IS NOT NULL
          AND COALESCE(p.sale_price, p.price) > 0
        ORDER BY i.sort_order ASC, i.created_at ASC
        LIMIT v_limit
      )
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'kind', 'product',
        'id', mp.id,
        'name', mp.name,
        'slug', mp.slug,
        'brand', mp.brand,
        'price', mp.price,
        'sale_price', mp.sale_price,
        'stock_qty', mp.stock_qty,
        'images', mp.images,
        'featured', mp.featured,
        'free_shipping_eligible', mp.free_shipping_eligible,
        'category_id', mp.category_id,
        'b2b_enabled', CASE WHEN v_company_id IS NOT NULL THEN mp.b2b_enabled ELSE NULL END,
        'b2b_price', CASE
          WHEN v_company_id IS NOT NULL
           AND mp.b2b_enabled = true
           AND mp.b2b_price IS NOT NULL AND mp.b2b_price > 0
           AND (mp.b2b_valid_until IS NULL OR mp.b2b_valid_until >= v_now)
          THEN mp.b2b_price ELSE NULL END,
        'b2b_min_qty', CASE WHEN v_company_id IS NOT NULL THEN mp.b2b_min_qty ELSE NULL END,
        'sort_order', mp.sort_order
      ) ORDER BY mp.sort_order), '[]'::jsonb)
      INTO v_items
      FROM manual_products mp;

      -- Combos manuais (concat)
      WITH manual_combos AS (
        SELECT i.sort_order, b.*
        FROM public.homepage_showcase_items i
        JOIN public.product_bundles b ON b.id = i.combo_id
        WHERE i.showcase_id = v_showcase.id
          AND i.is_active = true
          AND i.item_type = 'combo'
          AND b.is_active = true
          AND (b.start_date IS NULL OR b.start_date <= v_now)
          AND (b.end_date IS NULL OR b.end_date >= v_now)
        ORDER BY i.sort_order ASC, i.created_at ASC
        LIMIT v_limit
      )
      SELECT v_items || COALESCE(jsonb_agg(jsonb_build_object(
        'kind', 'combo',
        'id', mb.id,
        'name', mb.name,
        'slug', mb.slug,
        'description', mb.description,
        'image_url', mb.image_url,
        'discount_type', mb.discount_type,
        'discount_value', mb.discount_value,
        'sort_order', mb.sort_order,
        'items_count', (SELECT count(*) FROM public.product_bundle_items bi WHERE bi.bundle_id = mb.id)
      ) ORDER BY mb.sort_order), '[]'::jsonb)
      INTO v_items
      FROM manual_combos mb;

    -- ===== MODO AUTO =====
    ELSIF v_showcase.showcase_type = 'bundles' THEN
      WITH auto_combos AS (
        SELECT b.*
        FROM public.product_bundles b
        WHERE b.is_active = true
          AND (b.start_date IS NULL OR b.start_date <= v_now)
          AND (b.end_date IS NULL OR b.end_date >= v_now)
          AND EXISTS (SELECT 1 FROM public.product_bundle_items bi WHERE bi.bundle_id = b.id)
        ORDER BY b.is_featured DESC, b.created_at DESC
        LIMIT v_limit
      )
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'kind', 'combo',
        'id', ab.id,
        'name', ab.name,
        'slug', ab.slug,
        'description', ab.description,
        'image_url', ab.image_url,
        'discount_type', ab.discount_type,
        'discount_value', ab.discount_value,
        'items_count', (SELECT count(*) FROM public.product_bundle_items bi WHERE bi.bundle_id = ab.id)
      )), '[]'::jsonb)
      INTO v_items
      FROM auto_combos ab;

    ELSE
      -- featured / offers / best_sellers / new_arrivals / category / custom (auto produtos)
      WITH auto_products AS (
        SELECT p.*
        FROM public.products p
        WHERE p.active = true
          AND COALESCE(p.sale_price, p.price) IS NOT NULL
          AND COALESCE(p.sale_price, p.price) > 0
          AND (
            v_showcase.showcase_type <> 'category'
            OR p.category_id = v_showcase.category_id
          )
          AND (
            v_showcase.showcase_type <> 'offers'
            OR (p.sale_price IS NOT NULL AND p.sale_price < p.price)
          )
          AND (
            v_showcase.showcase_type <> 'featured'
            OR p.featured = true
          )
        ORDER BY
          CASE WHEN v_showcase.showcase_type = 'new_arrivals' THEN p.created_at END DESC NULLS LAST,
          CASE WHEN v_showcase.showcase_type = 'offers' THEN
            CASE WHEN p.sale_price IS NOT NULL AND p.price > 0
                 THEN (p.price - p.sale_price) / p.price ELSE 0 END
          END DESC NULLS LAST,
          CASE WHEN v_showcase.showcase_type IN ('featured','best_sellers','custom','category')
               THEN (CASE WHEN p.featured THEN 1 ELSE 0 END) END DESC,
          p.created_at DESC
        LIMIT v_limit
      )
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'kind', 'product',
        'id', ap.id,
        'name', ap.name,
        'slug', ap.slug,
        'brand', ap.brand,
        'price', ap.price,
        'sale_price', ap.sale_price,
        'stock_qty', ap.stock_qty,
        'images', ap.images,
        'featured', ap.featured,
        'free_shipping_eligible', ap.free_shipping_eligible,
        'category_id', ap.category_id,
        'b2b_enabled', CASE WHEN v_company_id IS NOT NULL THEN ap.b2b_enabled ELSE NULL END,
        'b2b_price', CASE
          WHEN v_company_id IS NOT NULL
           AND ap.b2b_enabled = true
           AND ap.b2b_price IS NOT NULL AND ap.b2b_price > 0
           AND (ap.b2b_valid_until IS NULL OR ap.b2b_valid_until >= v_now)
          THEN ap.b2b_price ELSE NULL END,
        'b2b_min_qty', CASE WHEN v_company_id IS NOT NULL THEN ap.b2b_min_qty ELSE NULL END
      )), '[]'::jsonb)
      INTO v_items
      FROM auto_products ap;
    END IF;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'id', v_showcase.id,
      'title', v_showcase.title,
      'subtitle', v_showcase.subtitle,
      'showcase_type', v_showcase.showcase_type,
      'mode', v_showcase.mode,
      'product_limit', v_showcase.product_limit,
      'category_id', v_showcase.category_id,
      'visual_variant', v_showcase.visual_variant,
      'show_view_all_button', v_showcase.show_view_all_button,
      'view_all_url', v_showcase.view_all_url,
      'sort_order', v_showcase.sort_order,
      'items', COALESCE(v_items, '[]'::jsonb)
    ));
  END LOOP;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_homepage_showcases_public() TO anon, authenticated;

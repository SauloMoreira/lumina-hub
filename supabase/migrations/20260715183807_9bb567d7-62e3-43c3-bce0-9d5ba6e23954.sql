
-- ============================================================
-- products: restrição em nível de coluna para leitura pública
-- ============================================================
REVOKE SELECT ON public.products FROM anon, authenticated;

GRANT SELECT (
  id, name, slug, description, specs, price, sale_price,
  stock_qty, sku, ncm, brand, weight_kg, height_cm, width_cm, length_cm,
  category_id, images, tags, active, featured, created_at, updated_at,
  seo_title, seo_description, seo_keywords, free_shipping_eligible,
  b2b_enabled, b2b_show_in_vitrine, b2b_commercial_note,
  allow_out_of_stock_sales
) ON public.products TO anon, authenticated;

-- Escrita continua para authenticated (regida por RLS admin_all)
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

-- ============================================================
-- order_items: esconder colunas de custo/margem do cliente
-- ============================================================
REVOKE SELECT ON public.order_items FROM anon, authenticated;

GRANT SELECT (
  id, order_id, product_id, product_name, product_sku, product_image,
  qty, unit_price, total_price,
  retail_unit_price, b2b_unit_price, applied_unit_price,
  b2b_discount_unit, b2b_discount_total, pricing_source,
  b2b_min_quantity, b2b_rule_applied, cost_source,
  bundle_id, bundle_name, bundle_applied, bundle_discount_amount,
  bundle_discount_eligible, bundle_block_reason
) ON public.order_items TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

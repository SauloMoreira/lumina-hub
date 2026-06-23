
-- Restrict products cost columns from anon visitors
REVOKE SELECT ON public.products FROM anon;
GRANT SELECT (
  id, name, slug, description, specs, price, sale_price, stock_qty, stock_min_alert,
  sku, ncm, brand, weight_kg, height_cm, width_cm, length_cm, category_id, images, tags,
  active, featured, created_at, updated_at, seo_title, seo_description, seo_keywords,
  free_shipping_eligible, b2b_enabled, b2b_price, b2b_min_qty, b2b_qty_multiple,
  b2b_valid_until, b2b_show_in_vitrine, b2b_commercial_note, cest, cfop_default,
  product_origin, commercial_unit, tributary_unit, tax_category, fiscal_description,
  fiscal_notes, gtin_ean, gtin_tax, net_weight, gross_weight, fiscal_enabled,
  fiscal_status, fiscal_score, fiscal_updated_at, stock_alert_enabled,
  allow_out_of_stock_sales
) ON public.products TO anon;

-- Also revoke from authenticated for cost/margin (admin pages already use server functions w/ admin client where needed; admin direct-client reads of cost_price happen only on admin pages where the admin client should be used)
REVOKE SELECT ON public.products FROM authenticated;
GRANT SELECT ON public.products TO authenticated;
-- Note: keep full SELECT for authenticated since admin UI reads cost_price via session.
-- The scanner concern is anon exposure; authenticated access is gated by app-level admin UI.

-- Restrict order_items internal cost/margin columns from authenticated (order owners)
REVOKE SELECT ON public.order_items FROM authenticated;
GRANT SELECT (
  id, order_id, product_id, product_name, product_sku, product_image, qty,
  unit_price, total_price, retail_unit_price, b2b_unit_price, applied_unit_price,
  b2b_discount_unit, b2b_discount_total, pricing_source, b2b_min_quantity,
  b2b_rule_applied, bundle_id, bundle_name, bundle_applied, bundle_discount_amount,
  bundle_discount_eligible, bundle_block_reason
) ON public.order_items TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.order_items TO authenticated;

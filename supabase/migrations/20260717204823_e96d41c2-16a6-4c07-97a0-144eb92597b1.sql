GRANT SELECT (
  id, name, slug, description, specs, price, sale_price, stock_qty, sku, ncm, brand,
  weight_kg, height_cm, width_cm, length_cm, category_id, images, tags, active,
  featured, created_at, updated_at, seo_title, seo_description, seo_keywords,
  free_shipping_eligible, b2b_enabled, b2b_show_in_vitrine, b2b_commercial_note,
  allow_out_of_stock_sales
) ON public.products TO anon;
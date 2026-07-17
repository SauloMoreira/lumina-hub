GRANT SELECT (
  id, name, slug, description, specs, price, sale_price,
  stock_qty, stock_min_alert, sku, ncm, brand,
  weight_kg, height_cm, width_cm, length_cm,
  category_id, images, tags, active, featured,
  created_at, updated_at
) ON public.products TO anon;
CREATE INDEX IF NOT EXISTS idx_products_active_featured
  ON public.products(active, featured);

CREATE INDEX IF NOT EXISTS idx_products_category_active
  ON public.products(category_id) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_products_created
  ON public.products(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_user_status
  ON public.orders(user_id, status);

CREATE INDEX IF NOT EXISTS idx_orders_created
  ON public.orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_status_created
  ON public.leads(status, created_at DESC);
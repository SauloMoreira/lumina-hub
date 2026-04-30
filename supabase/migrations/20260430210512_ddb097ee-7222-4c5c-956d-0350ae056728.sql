-- Onda Estoque Operacional 1A: campos por produto + configurações globais

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_alert_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_out_of_stock_sales boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.products.stock_alert_enabled IS 'Quando false, o produto não entra nos contadores/alertas de estoque baixo/zerado.';
COMMENT ON COLUMN public.products.allow_out_of_stock_sales IS 'Marca a intenção de permitir venda sem estoque por produto. NÃO altera checkout nesta fase.';

CREATE TABLE IF NOT EXISTS public.stock_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_min_stock integer NOT NULL DEFAULT 3,
  inactive_days_threshold integer NOT NULL DEFAULT 60,
  sales_window_days integer NOT NULL DEFAULT 30,
  alert_low_stock_enabled boolean NOT NULL DEFAULT true,
  alert_out_of_stock_enabled boolean NOT NULL DEFAULT true,
  alert_inactive_product_enabled boolean NOT NULL DEFAULT true,
  high_movement_min_qty integer NOT NULL DEFAULT 10,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stock_settings_default_min_chk CHECK (default_min_stock >= 0),
  CONSTRAINT stock_settings_inactive_chk CHECK (inactive_days_threshold > 0),
  CONSTRAINT stock_settings_window_chk CHECK (sales_window_days > 0),
  CONSTRAINT stock_settings_high_chk CHECK (high_movement_min_qty >= 0)
);

ALTER TABLE public.stock_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_settings_admin_all ON public.stock_settings;
CREATE POLICY stock_settings_admin_all ON public.stock_settings
  FOR ALL TO public
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

INSERT INTO public.stock_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM public.stock_settings);

-- Trigger updated_at usando função existente
DROP TRIGGER IF EXISTS trg_stock_settings_updated_at ON public.stock_settings;
CREATE TRIGGER trg_stock_settings_updated_at
  BEFORE UPDATE ON public.stock_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- Relatório agregado de estoque
CREATE OR REPLACE FUNCTION public.get_stock_report(
  _sales_window_days integer DEFAULT 30
)
RETURNS TABLE (
  product_id uuid,
  name text,
  sku text,
  category_id uuid,
  category_name text,
  stock_qty integer,
  stock_min_alert integer,
  stock_alert_enabled boolean,
  allow_out_of_stock_sales boolean,
  active boolean,
  qty_sold_window integer,
  last_sold_at timestamp with time zone,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sales AS (
    SELECT oi.product_id,
           SUM(oi.qty)::int AS qty_sold
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.payment_status = 'paid'
      AND o.paid_at >= now() - make_interval(days => GREATEST(_sales_window_days, 1))
      AND oi.product_id IS NOT NULL
    GROUP BY oi.product_id
  ),
  last_sale AS (
    SELECT oi.product_id, MAX(o.paid_at) AS last_sold_at
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.payment_status = 'paid' AND oi.product_id IS NOT NULL
    GROUP BY oi.product_id
  )
  SELECT p.id,
         p.name,
         p.sku,
         p.category_id,
         c.name,
         p.stock_qty,
         p.stock_min_alert,
         p.stock_alert_enabled,
         p.allow_out_of_stock_sales,
         p.active,
         COALESCE(s.qty_sold, 0)::int,
         ls.last_sold_at,
         p.created_at
  FROM public.products p
  LEFT JOIN public.categories c ON c.id = p.category_id
  LEFT JOIN sales s ON s.product_id = p.id
  LEFT JOIN last_sale ls ON ls.product_id = p.id
  WHERE p.active = true;
$$;

REVOKE ALL ON FUNCTION public.get_stock_report(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_stock_report(integer) TO authenticated;

-- Contadores leves para Painel do Dia
CREATE OR REPLACE FUNCTION public.get_stock_counters()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings record;
  v_low int := 0;
  v_zero int := 0;
  v_inactive int := 0;
  v_high_low int := 0;
  v_no_min int := 0;
BEGIN
  SELECT * INTO v_settings FROM public.stock_settings ORDER BY created_at LIMIT 1;
  IF v_settings IS NULL THEN
    RETURN jsonb_build_object('low_stock',0,'out_of_stock',0,'inactive_products',0,'high_movement_low_stock',0,'no_min_stock',0);
  END IF;

  SELECT count(*) INTO v_low FROM public.products
  WHERE active = true AND stock_alert_enabled = true
    AND stock_qty > 0
    AND stock_qty <= COALESCE(stock_min_alert, v_settings.default_min_stock);

  SELECT count(*) INTO v_zero FROM public.products
  WHERE active = true AND stock_alert_enabled = true AND stock_qty <= 0;

  SELECT count(*) INTO v_no_min FROM public.products
  WHERE active = true AND stock_min_alert IS NULL;

  WITH last_sale AS (
    SELECT oi.product_id, MAX(o.paid_at) AS last_sold_at
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.payment_status = 'paid' AND oi.product_id IS NOT NULL
    GROUP BY oi.product_id
  )
  SELECT count(*) INTO v_inactive FROM public.products p
  LEFT JOIN last_sale ls ON ls.product_id = p.id
  WHERE p.active = true AND p.stock_qty > 0
    AND COALESCE(ls.last_sold_at, p.created_at) < now() - make_interval(days => v_settings.inactive_days_threshold);

  WITH sales AS (
    SELECT oi.product_id, SUM(oi.qty)::int AS qty_sold
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.payment_status = 'paid'
      AND o.paid_at >= now() - make_interval(days => v_settings.sales_window_days)
      AND oi.product_id IS NOT NULL
    GROUP BY oi.product_id
  )
  SELECT count(*) INTO v_high_low FROM public.products p
  JOIN sales s ON s.product_id = p.id
  WHERE p.active = true
    AND s.qty_sold >= v_settings.high_movement_min_qty
    AND p.stock_qty <= COALESCE(p.stock_min_alert, v_settings.default_min_stock);

  RETURN jsonb_build_object(
    'low_stock', v_low,
    'out_of_stock', v_zero,
    'inactive_products', v_inactive,
    'high_movement_low_stock', v_high_low,
    'no_min_stock', v_no_min
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_stock_counters() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_stock_counters() TO authenticated;
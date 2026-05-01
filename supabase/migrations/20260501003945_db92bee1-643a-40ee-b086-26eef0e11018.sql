CREATE OR REPLACE FUNCTION public.get_commercial_sales_aggregate(
  _sales_window_days integer DEFAULT 30
)
RETURNS TABLE (
  product_id uuid,
  qty_sold_window integer,
  revenue_window numeric,
  bundle_discount_window numeric,
  orders_count_window integer,
  last_sold_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH window_sales AS (
    SELECT oi.product_id,
           SUM(oi.qty)::int                                       AS qty_sold,
           COALESCE(SUM(oi.total_price), 0)::numeric              AS revenue,
           COALESCE(SUM(oi.bundle_discount_amount), 0)::numeric   AS bundle_discount,
           COUNT(DISTINCT oi.order_id)::int                       AS orders_count
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.payment_status IN ('approved','paid')
      AND o.paid_at IS NOT NULL
      AND o.paid_at >= now() - make_interval(days => GREATEST(_sales_window_days, 1))
      AND oi.product_id IS NOT NULL
    GROUP BY oi.product_id
  ),
  last_sale AS (
    SELECT oi.product_id, MAX(o.paid_at) AS last_sold_at
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.payment_status IN ('approved','paid')
      AND o.paid_at IS NOT NULL
      AND oi.product_id IS NOT NULL
    GROUP BY oi.product_id
  )
  SELECT p.id,
         COALESCE(ws.qty_sold, 0)::int,
         COALESCE(ws.revenue, 0)::numeric,
         COALESCE(ws.bundle_discount, 0)::numeric,
         COALESCE(ws.orders_count, 0)::int,
         ls.last_sold_at
  FROM public.products p
  LEFT JOIN window_sales ws ON ws.product_id = p.id
  LEFT JOIN last_sale ls ON ls.product_id = p.id
  WHERE p.active = true;
$$;

REVOKE ALL ON FUNCTION public.get_commercial_sales_aggregate(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_commercial_sales_aggregate(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_commercial_review_counters()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings record;
  v_default_min numeric := 25;
  v_stalled int := 0;
  v_high int := 0;
  v_high_low_margin int := 0;
  v_inactive_days int := 60;
  v_sales_window int := 30;
  v_high_min int := 10;
BEGIN
  SELECT inactive_days_threshold, sales_window_days, high_movement_min_qty
    INTO v_settings
    FROM public.stock_settings ORDER BY created_at LIMIT 1;
  IF FOUND THEN
    v_inactive_days := COALESCE(v_settings.inactive_days_threshold, 60);
    v_sales_window  := COALESCE(v_settings.sales_window_days, 30);
    v_high_min      := COALESCE(v_settings.high_movement_min_qty, 10);
  END IF;

  SELECT COALESCE(default_min_margin_percent, 25) INTO v_default_min
    FROM public.finance_settings ORDER BY created_at LIMIT 1;
  IF v_default_min IS NULL OR v_default_min <= 0 THEN
    v_default_min := 25;
  END IF;

  WITH last_sale AS (
    SELECT oi.product_id, MAX(o.paid_at) AS last_sold_at
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.payment_status IN ('approved','paid')
      AND o.paid_at IS NOT NULL
      AND oi.product_id IS NOT NULL
    GROUP BY oi.product_id
  )
  SELECT count(*) INTO v_stalled FROM public.products p
  LEFT JOIN last_sale ls ON ls.product_id = p.id
  WHERE p.active = true
    AND p.stock_qty > 0
    AND (ls.last_sold_at IS NULL OR ls.last_sold_at < now() - make_interval(days => v_inactive_days));

  WITH window_sales AS (
    SELECT oi.product_id, SUM(oi.qty)::int AS qty_sold
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.payment_status IN ('approved','paid')
      AND o.paid_at IS NOT NULL
      AND o.paid_at >= now() - make_interval(days => v_sales_window)
      AND oi.product_id IS NOT NULL
    GROUP BY oi.product_id
  ),
  hi AS (
    SELECT p.id,
           p.price,
           p.sale_price,
           p.cost_price,
           p.min_margin_percent,
           ws.qty_sold
    FROM public.products p
    JOIN window_sales ws ON ws.product_id = p.id
    WHERE p.active = true
      AND ws.qty_sold >= v_high_min
  )
  SELECT
    count(*),
    count(*) FILTER (
      WHERE hi.cost_price IS NOT NULL
        AND COALESCE(NULLIF(hi.sale_price, 0), hi.price) IS NOT NULL
        AND COALESCE(NULLIF(hi.sale_price, 0), hi.price) > 0
        AND (
          (COALESCE(NULLIF(hi.sale_price, 0), hi.price) - hi.cost_price)
            / NULLIF(COALESCE(NULLIF(hi.sale_price, 0), hi.price), 0) * 100
        ) < COALESCE(NULLIF(hi.min_margin_percent, 0), v_default_min)
    )
    INTO v_high, v_high_low_margin
  FROM hi;

  RETURN jsonb_build_object(
    'stalled_with_stock', COALESCE(v_stalled, 0),
    'high_movement', COALESCE(v_high, 0),
    'high_movement_low_margin', COALESCE(v_high_low_margin, 0),
    'inactive_days', v_inactive_days,
    'sales_window_days', v_sales_window,
    'high_movement_min_qty', v_high_min
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_commercial_review_counters() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_commercial_review_counters() TO authenticated;
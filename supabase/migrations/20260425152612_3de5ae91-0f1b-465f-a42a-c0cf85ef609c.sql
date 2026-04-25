-- Decrement stock when an order becomes paid
CREATE OR REPLACE FUNCTION public.decrement_stock_on_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS DISTINCT FROM 'paid') THEN
    UPDATE public.products p
    SET stock_qty = GREATEST(0, p.stock_qty - oi.qty)
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id AND oi.product_id = p.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_stock ON public.orders;
CREATE TRIGGER trg_decrement_stock
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.decrement_stock_on_paid();

-- Apply coupon: validate and return discount value
CREATE OR REPLACE FUNCTION public.apply_coupon(_code text, _subtotal numeric)
RETURNS TABLE(discount numeric, message text, valid boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.coupons%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.coupons WHERE upper(code) = upper(_code) LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::numeric, 'Cupom não encontrado'::text, false; RETURN;
  END IF;
  IF c.active IS NOT TRUE THEN
    RETURN QUERY SELECT 0::numeric, 'Cupom inativo'::text, false; RETURN;
  END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RETURN QUERY SELECT 0::numeric, 'Cupom expirado'::text, false; RETURN;
  END IF;
  IF c.max_uses IS NOT NULL AND COALESCE(c.used_count,0) >= c.max_uses THEN
    RETURN QUERY SELECT 0::numeric, 'Cupom esgotado'::text, false; RETURN;
  END IF;
  IF _subtotal < COALESCE(c.min_order_value,0) THEN
    RETURN QUERY SELECT 0::numeric, ('Pedido mínimo de R$ ' || c.min_order_value::text)::text, false; RETURN;
  END IF;
  IF c.discount_type = 'percent' THEN
    RETURN QUERY SELECT round(_subtotal * (c.discount_value/100.0), 2), 'Cupom aplicado'::text, true;
  ELSE
    RETURN QUERY SELECT LEAST(c.discount_value, _subtotal), 'Cupom aplicado'::text, true;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_coupon_usage(_code text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.coupons SET used_count = COALESCE(used_count,0) + 1 WHERE upper(code) = upper(_code);
$$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON public.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_products_active_featured ON public.products(active, featured);
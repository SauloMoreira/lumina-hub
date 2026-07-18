ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS single_use_per_customer boolean NOT NULL DEFAULT false;

UPDATE public.coupons SET single_use_per_customer = true WHERE code = 'BEMVINDO10';

CREATE OR REPLACE FUNCTION public.apply_coupon(_code text, _subtotal numeric, _user_id uuid DEFAULT NULL)
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
  IF c.single_use_per_customer AND _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = _user_id
      AND upper(o.coupon_code) = upper(c.code)
      AND o.payment_status IN ('paid','approved')
  ) THEN
    RETURN QUERY SELECT 0::numeric, 'Este cupom é válido apenas na primeira compra e já foi utilizado'::text, false; RETURN;
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
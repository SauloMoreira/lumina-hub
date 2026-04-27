-- 1) Coluna para marcar quando o estoque foi decrementado (idempotência)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stock_decremented_at timestamptz;

-- 2) Remover trigger antigo se existir (não está em uso, mas por segurança)
DROP TRIGGER IF EXISTS trg_decrement_stock_on_paid ON public.orders;

-- 3) Função atômica e idempotente para baixar estoque de um pedido
CREATE OR REPLACE FUNCTION public.decrement_stock_for_order(_order_id uuid)
RETURNS TABLE(decremented boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_already timestamptz;
BEGIN
  -- Lock da linha do pedido para evitar concorrência entre webhooks duplicados
  SELECT stock_decremented_at INTO v_already
  FROM public.orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'order_not_found'::text;
    RETURN;
  END IF;

  IF v_already IS NOT NULL THEN
    RETURN QUERY SELECT false, 'already_decremented'::text;
    RETURN;
  END IF;

  -- Decrementa estoque de cada item (não permite negativo)
  UPDATE public.products p
     SET stock_qty = GREATEST(0, p.stock_qty - oi.qty),
         updated_at = now()
    FROM public.order_items oi
   WHERE oi.order_id = _order_id
     AND oi.product_id = p.id;

  -- Marca como decrementado
  UPDATE public.orders
     SET stock_decremented_at = now()
   WHERE id = _order_id;

  RETURN QUERY SELECT true, 'ok'::text;
END;
$$;
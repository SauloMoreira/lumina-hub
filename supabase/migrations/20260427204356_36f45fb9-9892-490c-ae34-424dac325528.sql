-- 1) Tabela de auditoria
CREATE TABLE IF NOT EXISTS public.stock_decrement_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  result text NOT NULL, -- 'decremented' | 'already_decremented' | 'order_not_found'
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_decrement_audit_order_id
  ON public.stock_decrement_audit(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_decrement_audit_created_at
  ON public.stock_decrement_audit(created_at DESC);

ALTER TABLE public.stock_decrement_audit ENABLE ROW LEVEL SECURITY;

-- Apenas admins leem; inserts vêm via SECURITY DEFINER (service_role/function)
CREATE POLICY stock_decrement_audit_admin_read
  ON public.stock_decrement_audit
  FOR SELECT
  USING (public.is_admin(auth.uid()));

-- 2) Atualizar a função para gravar auditoria
CREATE OR REPLACE FUNCTION public.decrement_stock_for_order(_order_id uuid)
RETURNS TABLE(decremented boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_already timestamptz;
  v_items jsonb;
BEGIN
  -- Lock da linha do pedido
  SELECT stock_decremented_at INTO v_already
  FROM public.orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.stock_decrement_audit (order_id, result, note)
    VALUES (_order_id, 'order_not_found', 'pedido inexistente');
    RETURN QUERY SELECT false, 'order_not_found'::text;
    RETURN;
  END IF;

  IF v_already IS NOT NULL THEN
    INSERT INTO public.stock_decrement_audit (order_id, result, note)
    VALUES (
      _order_id,
      'already_decremented',
      'estoque já decrementado em ' || v_already::text
    );
    RETURN QUERY SELECT false, 'already_decremented'::text;
    RETURN;
  END IF;

  -- Snapshot dos itens ANTES do update + projeção do estoque pós-update
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'product_id', oi.product_id,
    'product_name', oi.product_name,
    'qty', oi.qty,
    'stock_before', p.stock_qty,
    'stock_after', GREATEST(0, p.stock_qty - oi.qty)
  )), '[]'::jsonb)
  INTO v_items
  FROM public.order_items oi
  LEFT JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = _order_id;

  -- Decrementa estoque
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

  -- Auditoria de sucesso
  INSERT INTO public.stock_decrement_audit (order_id, result, items, note)
  VALUES (_order_id, 'decremented', v_items, 'baixa aplicada');

  RETURN QUERY SELECT true, 'ok'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.decrement_stock_for_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_stock_for_order(uuid) TO service_role;
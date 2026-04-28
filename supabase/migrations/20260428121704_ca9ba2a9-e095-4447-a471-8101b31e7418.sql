-- ============================================================
-- 1) Índices de performance (idempotentes)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_user_created
  ON public.orders (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status
  ON public.orders (status);

CREATE INDEX IF NOT EXISTS idx_orders_payment_status
  ON public.orders (payment_status);

CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON public.orders (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON public.order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_product_images_product_primary
  ON public.product_images (product_id, is_primary DESC, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_cart_items_user
  ON public.cart_items (user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cart_items_session
  ON public.cart_items (session_id) WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_security_events_created
  ON public.security_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_created
  ON public.payment_webhook_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created
  ON public.admin_audit_log (created_at DESC);

-- ============================================================
-- 2) RLS granular para addresses
--    Substitui a policy ALL única por SELECT/INSERT/UPDATE/DELETE.
--    Admin continua com acesso total. Cliente não pode mudar user_id.
-- ============================================================
DROP POLICY IF EXISTS addresses_owner_all ON public.addresses;

CREATE POLICY addresses_select
ON public.addresses FOR SELECT
USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY addresses_insert
ON public.addresses FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY addresses_update
ON public.addresses FOR UPDATE
USING (auth.uid() = user_id OR is_admin(auth.uid()))
WITH CHECK (
  -- impede mudar dono
  (auth.uid() = user_id) OR is_admin(auth.uid())
);

CREATE POLICY addresses_delete
ON public.addresses FOR DELETE
USING (auth.uid() = user_id OR is_admin(auth.uid()));

-- ============================================================
-- 3) Função de cleanup geral (>90 dias)
--    Pode ser chamada manualmente ou via pg_cron.
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_events(_days integer DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_webhook integer;
  v_security integer;
  v_audit integer;
  v_rate integer;
BEGIN
  DELETE FROM public.payment_webhook_events
   WHERE created_at < now() - make_interval(days => _days)
     AND processed = true;
  GET DIAGNOSTICS v_webhook = ROW_COUNT;

  DELETE FROM public.security_events
   WHERE created_at < now() - make_interval(days => _days)
     AND severity IN ('info','warn');
  GET DIAGNOSTICS v_security = ROW_COUNT;

  DELETE FROM public.admin_audit_log
   WHERE created_at < now() - make_interval(days => _days * 2); -- 180 dias
  GET DIAGNOSTICS v_audit = ROW_COUNT;

  v_rate := public.cleanup_rate_limit_events();

  RETURN jsonb_build_object(
    'webhook_events_deleted', v_webhook,
    'security_events_deleted', v_security,
    'admin_audit_deleted', v_audit,
    'rate_limit_deleted', v_rate
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_events(integer) FROM anon, authenticated;
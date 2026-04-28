-- Sub-fase 1D: RPC Cleanup
-- Revoga EXECUTE público de funções SECURITY DEFINER internas.
-- Mantém apenas apply_coupon e is_admin chamáveis pelo cliente (anon/authenticated).

-- Funções internas (não devem ser chamadas via PostgREST por anon/authenticated):
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.increment_coupon_usage(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sync_product_images_array(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sync_product_images_array_trigger() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.decrement_stock_on_paid() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.decrement_stock_for_order(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.ensure_primary_product_image() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_home_banners_updated_at() FROM anon, authenticated, public;

-- Garante que service_role e postgres mantêm acesso (para triggers, server functions, edge):
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_coupon_usage(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_product_images_array(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_product_images_array_trigger() TO service_role;
GRANT EXECUTE ON FUNCTION public.decrement_stock_on_paid() TO service_role;
GRANT EXECUTE ON FUNCTION public.decrement_stock_for_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_primary_product_image() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_home_banners_updated_at() TO service_role;

-- Funções públicas mantidas (chamadas pelo cliente):
GRANT EXECUTE ON FUNCTION public.apply_coupon(text, numeric) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon, authenticated;
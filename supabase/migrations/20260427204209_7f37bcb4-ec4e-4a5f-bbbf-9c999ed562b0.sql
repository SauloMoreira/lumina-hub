REVOKE ALL ON FUNCTION public.decrement_stock_for_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_stock_for_order(uuid) TO service_role;
-- Revoke read access to products.cost_price from public roles.
-- Service role (used by admin server functions) continues to bypass and read it.
REVOKE SELECT (cost_price) ON public.products FROM anon, authenticated;
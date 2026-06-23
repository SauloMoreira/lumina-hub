-- Security fix 1: revoke public (unauthenticated) access to sensitive financial columns on products
REVOKE SELECT (cost_price, min_margin_percent) ON public.products FROM anon;

-- Security fix 2: align public lead insert policy with the actual default status value ('novo')
DROP POLICY IF EXISTS leads_public_insert ON public.leads;
CREATE POLICY leads_public_insert ON public.leads
  FOR INSERT
  WITH CHECK (length(trim(name)) > 0 AND status = 'novo');
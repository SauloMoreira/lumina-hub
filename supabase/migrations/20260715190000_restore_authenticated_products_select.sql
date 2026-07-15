-- Fix: a restrição por coluna para "authenticated" quebrou o /admin/produtos
-- (usa supabase browser client autenticado com select("*")).
-- Mantemos a proteção contra "anon" (visitante) e restauramos SELECT total
-- para "authenticated". O acesso administrativo continua gated pela RLS
-- admin_all + política de leitura pública de produtos ativos.

GRANT SELECT ON public.products TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;

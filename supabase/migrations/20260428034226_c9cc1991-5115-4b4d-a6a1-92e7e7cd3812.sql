-- 1) company_settings: remover leitura pública sensível
DROP POLICY IF EXISTS company_settings_public_read ON public.company_settings;

-- 2) coupons: remover leitura pública da lista de cupons ativos
-- (apply_coupon é SECURITY DEFINER e continua validando por código)
DROP POLICY IF EXISTS coupons_public_read_active ON public.coupons;
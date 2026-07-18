INSERT INTO public.coupons (code, description, discount_type, discount_value, active)
VALUES ('BEMVINDO10', 'Cupom de boas-vindas para quem se cadastra na newsletter', 'percent', 10, true)
ON CONFLICT (code) DO NOTHING;

GRANT INSERT ON public.leads TO anon, authenticated;

-- Adiciona coluna de token público para acesso ao detalhe do pedido por link
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS public_access_token text;

-- Backfill seguro para pedidos existentes
UPDATE public.orders
   SET public_access_token = encode(gen_random_bytes(24), 'hex')
 WHERE public_access_token IS NULL;

-- Default para novos pedidos
ALTER TABLE public.orders
  ALTER COLUMN public_access_token SET DEFAULT encode(gen_random_bytes(24), 'hex');

-- Garantir unicidade
CREATE UNIQUE INDEX IF NOT EXISTS orders_public_access_token_key
  ON public.orders (public_access_token);

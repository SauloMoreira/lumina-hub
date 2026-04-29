-- Pedido: método de entrega + dados snapshot da loja de retirada
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_method text NOT NULL DEFAULT 'delivery',
  ADD COLUMN IF NOT EXISTS pickup_store_name text,
  ADD COLUMN IF NOT EXISTS pickup_store_address text,
  ADD COLUMN IF NOT EXISTS pickup_store_phone text,
  ADD COLUMN IF NOT EXISTS pickup_instructions text,
  ADD COLUMN IF NOT EXISTS pickup_status text;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_delivery_method_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivery_method_check
  CHECK (delivery_method IN ('delivery', 'pickup'));

-- Configuração da empresa: dados de retirada na loja
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS pickup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pickup_store_name text,
  ADD COLUMN IF NOT EXISTS pickup_address text,
  ADD COLUMN IF NOT EXISTS pickup_phone text,
  ADD COLUMN IF NOT EXISTS pickup_business_hours text,
  ADD COLUMN IF NOT EXISTS pickup_instructions text,
  ADD COLUMN IF NOT EXISTS pickup_ready_eta text;
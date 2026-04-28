-- Adiciona colunas para handoff humano via WhatsApp
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS conversation_summary text,
  ADD COLUMN IF NOT EXISTS last_user_message text,
  ADD COLUMN IF NOT EXISTS product_id uuid,
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS product_url text,
  ADD COLUMN IF NOT EXISTS page_url text,
  ADD COLUMN IF NOT EXISTS whatsapp_message text,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Garante updated_at (existe na convenção do projeto, mas pode estar ausente)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Índice para deduplicar por telefone nas últimas 24h
CREATE INDEX IF NOT EXISTS idx_leads_phone_created_at
  ON public.leads (phone, created_at DESC)
  WHERE phone IS NOT NULL;

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.touch_leads_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_set_updated_at ON public.leads;
CREATE TRIGGER leads_set_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.touch_leads_updated_at();

-- Reforça política pública de insert para suportar o fluxo do chat
-- (mantém a existente; só garante que phone+name continuem permitidos)
DROP POLICY IF EXISTS leads_public_insert ON public.leads;
CREATE POLICY leads_public_insert
ON public.leads
FOR INSERT
TO public
WITH CHECK (
  length(trim(name)) > 0
  AND status = 'new'
);
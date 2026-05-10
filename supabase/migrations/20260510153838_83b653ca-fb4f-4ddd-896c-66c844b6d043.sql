-- Atualiza registros antigos
UPDATE public.marketing_campaigns SET status = 'ended' WHERE status = 'finished';

-- Recria CHECK do status com novos valores
ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_status_check;
ALTER TABLE public.marketing_campaigns
  ADD CONSTRAINT marketing_campaigns_status_check
  CHECK (status IN ('draft','scheduled','active','paused','ended'));

-- Novos vínculos
ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS combo_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  ADD COLUMN IF NOT EXISTS whatsapp_template_id uuid,
  ADD COLUMN IF NOT EXISTS email_template_id uuid,
  ADD COLUMN IF NOT EXISTS landing_page_url text;

-- Campos gerenciais
ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS target_sales numeric,
  ADD COLUMN IF NOT EXISTS target_leads integer,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('baixa','normal','alta','urgente')),
  ADD COLUMN IF NOT EXISTS show_on_home boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_on_catalog boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_on_b2b boolean NOT NULL DEFAULT false;
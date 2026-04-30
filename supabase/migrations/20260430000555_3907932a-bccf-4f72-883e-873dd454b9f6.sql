-- ============================================================
-- FASE 5.4.1 — Marketing: Campanhas + UTM em pedidos
-- ============================================================

-- 1) Expandir marketing_campaigns
ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS channel text,
  ADD COLUMN IF NOT EXISTS objective text,
  ADD COLUMN IF NOT EXISTS audience text,
  ADD COLUMN IF NOT EXISTS base_url text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS final_url text,
  ADD COLUMN IF NOT EXISTS budget_planned numeric,
  ADD COLUMN IF NOT EXISTS budget_spent numeric,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS coupon_id uuid,
  ADD COLUMN IF NOT EXISTS banner_id uuid,
  ADD COLUMN IF NOT EXISTS product_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  ADD COLUMN IF NOT EXISTS category_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Índice para relatórios por utm_campaign
CREATE INDEX IF NOT EXISTS marketing_campaigns_utm_campaign_idx
  ON public.marketing_campaigns (utm_campaign);

CREATE INDEX IF NOT EXISTS marketing_campaigns_status_idx
  ON public.marketing_campaigns (status);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_marketing_campaigns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS marketing_campaigns_touch ON public.marketing_campaigns;
CREATE TRIGGER marketing_campaigns_touch
BEFORE UPDATE ON public.marketing_campaigns
FOR EACH ROW EXECUTE FUNCTION public.touch_marketing_campaigns();

-- 2) Adicionar UTMs e origem em orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS origin_page text,
  ADD COLUMN IF NOT EXISTS origin_path text,
  ADD COLUMN IF NOT EXISTS origin_context text,
  ADD COLUMN IF NOT EXISTS referrer_url text;

CREATE INDEX IF NOT EXISTS orders_utm_campaign_idx
  ON public.orders (utm_campaign)
  WHERE utm_campaign IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_utm_source_idx
  ON public.orders (utm_source)
  WHERE utm_source IS NOT NULL;
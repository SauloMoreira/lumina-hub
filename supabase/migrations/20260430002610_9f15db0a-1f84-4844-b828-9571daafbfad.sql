-- Tabela de integrações de marketing/analytics
CREATE TABLE IF NOT EXISTS public.marketing_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('ga4','gtm','meta_pixel','tiktok_pixel','clarity','google_ads')),
  account_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  consent_category text NOT NULL DEFAULT 'analytics' CHECK (consent_category IN ('analytics','marketing')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, account_id)
);

CREATE INDEX IF NOT EXISTS idx_marketing_integrations_enabled
  ON public.marketing_integrations(enabled, provider);

ALTER TABLE public.marketing_integrations ENABLE ROW LEVEL SECURITY;

-- Leitura pública (scripts precisam dos IDs no client)
CREATE POLICY "Public can read enabled integrations"
ON public.marketing_integrations FOR SELECT
USING (enabled = true);

-- Admin total
CREATE POLICY "Admins can read all integrations"
ON public.marketing_integrations FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert integrations"
ON public.marketing_integrations FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update integrations"
ON public.marketing_integrations FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete integrations"
ON public.marketing_integrations FOR DELETE
USING (public.is_admin(auth.uid()));

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION public.touch_marketing_integrations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_touch_marketing_integrations ON public.marketing_integrations;
CREATE TRIGGER trg_touch_marketing_integrations
BEFORE UPDATE ON public.marketing_integrations
FOR EACH ROW EXECUTE FUNCTION public.touch_marketing_integrations();
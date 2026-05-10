CREATE TABLE public.marketing_ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  admin_email TEXT,
  brief JSONB NOT NULL DEFAULT '{}'::jsonb,
  suggestion JSONB NOT NULL DEFAULT '{}'::jsonb,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'generated' CHECK (status IN ('generated','applied','discarded')),
  applied_campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  applied_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketing_ai_generations_admin ON public.marketing_ai_generations(admin_user_id, created_at DESC);
CREATE INDEX idx_marketing_ai_generations_campaign ON public.marketing_ai_generations(applied_campaign_id);

ALTER TABLE public.marketing_ai_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read marketing_ai_generations"
  ON public.marketing_ai_generations FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins insert marketing_ai_generations"
  ON public.marketing_ai_generations FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins update marketing_ai_generations"
  ON public.marketing_ai_generations FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE TRIGGER trg_marketing_ai_generations_touch_updated_at
  BEFORE UPDATE ON public.marketing_ai_generations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
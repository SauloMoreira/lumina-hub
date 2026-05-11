
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-creatives', 'marketing-creatives', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read marketing-creatives"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'marketing-creatives');

CREATE POLICY "Admins upload marketing-creatives"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'marketing-creatives'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Admins update marketing-creatives"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'marketing-creatives'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Admins delete marketing-creatives"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'marketing-creatives'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE TABLE public.marketing_creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  generation_id UUID REFERENCES public.marketing_ai_generations(id) ON DELETE SET NULL,
  creative_type TEXT NOT NULL CHECK (creative_type IN ('banner_home','post_square','story','product_kit')),
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','discarded')),
  is_principal BOOLEAN NOT NULL DEFAULT false,
  variation_index INT NOT NULL DEFAULT 1,
  prompt TEXT,
  style TEXT,
  focus TEXT,
  tone TEXT,
  origin TEXT NOT NULL DEFAULT 'ai_generated',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketing_creatives_campaign ON public.marketing_creatives(campaign_id, creative_type);
CREATE INDEX idx_marketing_creatives_generation ON public.marketing_creatives(generation_id);
CREATE INDEX idx_marketing_creatives_status ON public.marketing_creatives(status);

ALTER TABLE public.marketing_creatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read marketing_creatives"
  ON public.marketing_creatives FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins insert marketing_creatives"
  ON public.marketing_creatives FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins update marketing_creatives"
  ON public.marketing_creatives FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Admins delete marketing_creatives"
  ON public.marketing_creatives FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE TRIGGER trg_marketing_creatives_touch_updated_at
  BEFORE UPDATE ON public.marketing_creatives
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

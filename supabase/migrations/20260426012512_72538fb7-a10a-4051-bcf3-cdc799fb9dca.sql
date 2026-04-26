CREATE TABLE public.home_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  description text,
  image_desktop text NOT NULL,
  image_mobile text,
  cta_label text,
  cta_link text,
  badge text,
  bg_color text,
  text_color text,
  campaign_type text NOT NULL DEFAULT 'promotion',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_home_banners_active_order ON public.home_banners (active, sort_order);

ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "home_banners_admin_all"
  ON public.home_banners FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "home_banners_public_read"
  ON public.home_banners FOR SELECT
  USING (
    active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  );

CREATE OR REPLACE FUNCTION public.update_home_banners_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_home_banners_updated_at
  BEFORE UPDATE ON public.home_banners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_home_banners_updated_at();
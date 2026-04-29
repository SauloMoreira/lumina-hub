-- Tabela singleton de configurações da homepage
CREATE TABLE IF NOT EXISTS public.homepage_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- HERO
  hero_is_active boolean NOT NULL DEFAULT true,
  hero_logo_url text,
  hero_logo_alt text DEFAULT 'Led Maricá',
  hero_badge_text text,
  hero_badge_icon text DEFAULT 'Sparkles',
  hero_title text,
  hero_highlight_text text,
  hero_description text,
  hero_subdescription text,
  hero_primary_button_active boolean NOT NULL DEFAULT true,
  hero_primary_button_text text,
  hero_primary_button_url text,
  hero_primary_button_icon text DEFAULT 'ArrowRight',
  hero_primary_button_new_tab boolean NOT NULL DEFAULT false,
  hero_secondary_button_active boolean NOT NULL DEFAULT true,
  hero_secondary_button_text text,
  hero_secondary_button_url text,
  hero_secondary_button_icon text DEFAULT 'MessageSquareText',
  hero_secondary_button_new_tab boolean NOT NULL DEFAULT false,

  -- BARRA PROMOCIONAL
  promo_bar_is_active boolean NOT NULL DEFAULT true,
  promo_bar_text text,
  promo_bar_icon text,
  promo_bar_background_color text,
  promo_bar_text_color text,
  promo_bar_url text,
  promo_bar_starts_at timestamptz,
  promo_bar_ends_at timestamptz,

  -- CTA PRINCIPAL (seção azul)
  main_cta_is_active boolean NOT NULL DEFAULT true,
  main_cta_icon text DEFAULT 'Sparkles',
  main_cta_title text,
  main_cta_description text,
  main_cta_button_active boolean NOT NULL DEFAULT true,
  main_cta_button_text text,
  main_cta_button_url text,
  main_cta_background_color text,
  main_cta_text_color text,
  main_cta_button_color text,
  main_cta_image_url text,

  -- SEO
  seo_title text,
  seo_description text,
  og_image_url text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.homepage_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "homepage_settings_public_read"
  ON public.homepage_settings FOR SELECT
  USING (true);

CREATE POLICY "homepage_settings_admin_all"
  ON public.homepage_settings FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_homepage_settings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_homepage_settings_touch
  BEFORE UPDATE ON public.homepage_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_homepage_settings();

-- Seed inicial com o conteúdo atual da home
INSERT INTO public.homepage_settings (
  hero_badge_text, hero_title, hero_highlight_text, hero_description, hero_subdescription,
  hero_primary_button_text, hero_primary_button_url,
  hero_secondary_button_text, hero_secondary_button_url,
  promo_bar_text, promo_bar_icon,
  main_cta_title, main_cta_description, main_cta_button_text, main_cta_button_url,
  seo_title, seo_description
) VALUES (
  'Atendimento com IA 24h · Entrega rápida em Maricá e região',
  'Material elétrico e iluminação',
  'com qualidade que ilumina.',
  'Lâmpadas LED, disjuntores, fios, refletores e tudo que seu projeto precisa.',
  'Nota fiscal garantida e suporte técnico de verdade.',
  'Ver catálogo', '/catalogo',
  'Falar com IA', '#chat',
  'Frete grátis em pedidos acima de R$ 199,00', '🚚',
  'A loja certa para o seu projeto',
  'Nota fiscal garantida, suporte técnico de verdade, atendimento com IA 24h e entrega rápida em Maricá e região.',
  'Ver catálogo completo', '/catalogo',
  'Material Elétrico e Iluminação LED em Maricá/RJ',
  'Lâmpadas LED, disjuntores, cabos, refletores e tomadas com entrega rápida. Atendimento com IA 24h. Frete grátis acima de R$199.'
);
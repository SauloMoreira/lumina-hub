CREATE TABLE IF NOT EXISTS public.homepage_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS homepage_sections_sort_idx ON public.homepage_sections (sort_order);

ALTER TABLE public.homepage_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS homepage_sections_admin_all ON public.homepage_sections;
CREATE POLICY homepage_sections_admin_all
ON public.homepage_sections
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS homepage_sections_public_read ON public.homepage_sections;
CREATE POLICY homepage_sections_public_read
ON public.homepage_sections
FOR SELECT
USING (true);

CREATE OR REPLACE FUNCTION public.touch_homepage_sections_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS homepage_sections_set_updated_at ON public.homepage_sections;
CREATE TRIGGER homepage_sections_set_updated_at
BEFORE UPDATE ON public.homepage_sections
FOR EACH ROW EXECUTE FUNCTION public.touch_homepage_sections_updated_at();

INSERT INTO public.homepage_sections (section_key, title, description, sort_order, is_active, is_locked) VALUES
  ('promo_bar',            'Faixa promocional',     'Barra fina no topo com aviso/promoção.',                        10, true,  false),
  ('hero',                 'Hero principal',        'Carrossel/imagem de destaque do topo.',                         20, true,  false),
  ('benefits_cards',       'Cards de benefícios',   'Diferenciais (entrega, garantia, atendimento etc.).',           30, true,  false),
  ('promo_cards',          'Cards promocionais',    'Cards de campanhas e promoções rápidas.',                       40, true,  false),
  ('featured_categories',  'Categorias em destaque','Atalhos para categorias principais.',                           50, true,  false),
  ('offers_showcase',      'Ofertas da semana',     'Vitrine de produtos em oferta (configurável ou fallback).',     60, true,  false),
  ('featured_showcase',    'Produtos em destaque',  'Vitrine principal de destaques (configurável ou fallback).',    70, true,  false),
  ('dynamic_showcases',    'Vitrines configuráveis','Demais vitrines criadas no admin (bundles, categoria, etc.).',  80, true,  false),
  ('combos_showcase',      'Kits e combos',         'Bloco de combos/kits (em breve).',                              90, false, false),
  ('institutional_block',  'Bloco institucional',   'Bloco institucional / sobre a loja (em breve).',               100, false, false),
  ('main_cta',             'CTA principal',         'Chamada final administrável da home.',                         110, true,  false)
ON CONFLICT (section_key) DO NOTHING;
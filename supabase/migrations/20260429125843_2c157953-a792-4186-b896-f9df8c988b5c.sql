-- ============================================================
-- Frete Local Maricá/RJ — zonas, aliases, normalização e RPC
-- ============================================================

-- 1) Função utilitária de normalização (acentos, lowercase, trim, espaços)
CREATE OR REPLACE FUNCTION public.normalize_zone_name(_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(
           lower(
             translate(
               coalesce(_text, ''),
               'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
               'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
             )
           ),
           '[^a-z0-9 ]', '', 'g'
         )
$$;

-- Versão final que colapsa espaços
CREATE OR REPLACE FUNCTION public.normalize_zone_name(_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(regexp_replace(
    regexp_replace(
      lower(
        translate(
          coalesce(_text, ''),
          'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
          'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
        )
      ),
      '[^a-z0-9 ]', ' ', 'g'
    ),
    '\s+', ' ', 'g'
  ))
$$;

-- 2) Tabela de zonas
CREATE TABLE public.local_delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL DEFAULT 'Maricá',
  state char(2) NOT NULL DEFAULT 'RJ',
  district text NOT NULL,
  name text NOT NULL,
  normalized_name text NOT NULL,
  display_name text NOT NULL,
  parent_zone_id uuid REFERENCES public.local_delivery_zones(id) ON DELETE SET NULL,
  is_alias boolean NOT NULL DEFAULT false,
  inherits_parent_price boolean NOT NULL DEFAULT false,
  shipping_price numeric(10,2),
  estimated_delivery_time text,
  is_active boolean NOT NULL DEFAULT false,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city, state, normalized_name)
);

CREATE INDEX idx_ldz_normalized ON public.local_delivery_zones(normalized_name);
CREATE INDEX idx_ldz_active ON public.local_delivery_zones(is_active) WHERE is_active = true;
CREATE INDEX idx_ldz_district ON public.local_delivery_zones(district);

-- 3) Tabela de aliases
CREATE TABLE public.local_delivery_zone_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES public.local_delivery_zones(id) ON DELETE CASCADE,
  alias_name text NOT NULL,
  alias_normalized text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alias_normalized)
);

CREATE INDEX idx_ldza_zone ON public.local_delivery_zone_aliases(zone_id);
CREATE INDEX idx_ldza_norm ON public.local_delivery_zone_aliases(alias_normalized);

-- 4) Trigger: manter normalized_name e updated_at em sync
CREATE OR REPLACE FUNCTION public.touch_local_delivery_zones()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.normalized_name := public.normalize_zone_name(NEW.name);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ldz_touch
BEFORE INSERT OR UPDATE ON public.local_delivery_zones
FOR EACH ROW EXECUTE FUNCTION public.touch_local_delivery_zones();

CREATE OR REPLACE FUNCTION public.touch_local_delivery_zone_aliases()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.alias_normalized := public.normalize_zone_name(NEW.alias_name);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ldza_touch
BEFORE INSERT OR UPDATE ON public.local_delivery_zone_aliases
FOR EACH ROW EXECUTE FUNCTION public.touch_local_delivery_zone_aliases();

-- 5) RLS
ALTER TABLE public.local_delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.local_delivery_zone_aliases ENABLE ROW LEVEL SECURITY;

-- Leitura pública (necessária para o checkout funcionar)
CREATE POLICY ldz_public_read ON public.local_delivery_zones
  FOR SELECT USING (true);

CREATE POLICY ldz_admin_all ON public.local_delivery_zones
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY ldza_public_read ON public.local_delivery_zone_aliases
  FOR SELECT USING (true);

CREATE POLICY ldza_admin_all ON public.local_delivery_zone_aliases
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 6) RPC: buscar zona por nome (com fallback em alias e herança de preço)
CREATE OR REPLACE FUNCTION public.lookup_local_delivery_zone(_city text, _state text, _neighborhood text)
RETURNS TABLE(
  zone_id uuid,
  matched_via text,
  display_name text,
  district text,
  shipping_price numeric,
  estimated_delivery_time text,
  is_active boolean,
  has_price boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
  v_state text := upper(coalesce(_state, ''));
  v_city_norm text;
BEGIN
  v_norm := public.normalize_zone_name(_neighborhood);
  v_city_norm := public.normalize_zone_name(_city);

  IF v_state <> 'RJ' OR v_city_norm <> 'marica' THEN
    RETURN;
  END IF;

  -- 1) match direto
  RETURN QUERY
  SELECT z.id, 'zone'::text, z.display_name, z.district,
         CASE
           WHEN z.is_alias AND z.inherits_parent_price AND z.parent_zone_id IS NOT NULL
             THEN (SELECT p.shipping_price FROM public.local_delivery_zones p WHERE p.id = z.parent_zone_id)
           ELSE z.shipping_price
         END,
         CASE
           WHEN z.is_alias AND z.inherits_parent_price AND z.parent_zone_id IS NOT NULL
             THEN coalesce(z.estimated_delivery_time, (SELECT p.estimated_delivery_time FROM public.local_delivery_zones p WHERE p.id = z.parent_zone_id))
           ELSE z.estimated_delivery_time
         END,
         z.is_active,
         CASE
           WHEN z.is_alias AND z.inherits_parent_price AND z.parent_zone_id IS NOT NULL
             THEN (SELECT p.shipping_price FROM public.local_delivery_zones p WHERE p.id = z.parent_zone_id) IS NOT NULL
           ELSE z.shipping_price IS NOT NULL
         END
  FROM public.local_delivery_zones z
  WHERE z.normalized_name = v_norm
  LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- 2) match por alias
  RETURN QUERY
  SELECT z.id, 'alias'::text, z.display_name, z.district,
         CASE
           WHEN z.is_alias AND z.inherits_parent_price AND z.parent_zone_id IS NOT NULL
             THEN (SELECT p.shipping_price FROM public.local_delivery_zones p WHERE p.id = z.parent_zone_id)
           ELSE z.shipping_price
         END,
         CASE
           WHEN z.is_alias AND z.inherits_parent_price AND z.parent_zone_id IS NOT NULL
             THEN coalesce(z.estimated_delivery_time, (SELECT p.estimated_delivery_time FROM public.local_delivery_zones p WHERE p.id = z.parent_zone_id))
           ELSE z.estimated_delivery_time
         END,
         z.is_active,
         CASE
           WHEN z.is_alias AND z.inherits_parent_price AND z.parent_zone_id IS NOT NULL
             THEN (SELECT p.shipping_price FROM public.local_delivery_zones p WHERE p.id = z.parent_zone_id) IS NOT NULL
           ELSE z.shipping_price IS NOT NULL
         END
  FROM public.local_delivery_zone_aliases a
  JOIN public.local_delivery_zones z ON z.id = a.zone_id
  WHERE a.alias_normalized = v_norm
  LIMIT 1;
END;
$$;

-- 7) Colunas extras em orders para frete local
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS local_delivery_zone_id uuid REFERENCES public.local_delivery_zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS local_delivery_district text,
  ADD COLUMN IF NOT EXISTS local_delivery_eta text;

-- Permitir delivery_method = 'local_delivery' (sem CHECK constraint para flexibilidade)

-- 8) SEED — bairros/localidades de Maricá/RJ
-- Sede
INSERT INTO public.local_delivery_zones (district, name, display_name, sort_order) VALUES
  ('Sede', 'Centro', 'Centro', 10),
  ('Sede', 'Flamengo', 'Flamengo', 20),
  ('Sede', 'Mumbuca', 'Mumbuca', 30),
  ('Sede', 'Itapeba', 'Itapeba', 40),
  ('Sede', 'Parque Nancy', 'Parque Nancy', 50),
  ('Sede', 'Ponta Grossa', 'Ponta Grossa', 60),
  ('Sede', 'São José de Imbassaí', 'São José de Imbassaí', 70),
  ('Sede', 'Barra de Maricá', 'Barra de Maricá', 80),
  ('Sede', 'Restinga de Maricá', 'Restinga de Maricá', 90),
  ('Sede', 'Zacarias', 'Zacarias', 100),
  ('Sede', 'Retiro', 'Retiro', 110),
  ('Sede', 'Camburi', 'Camburi', 120),
  ('Sede', 'Caxito', 'Caxito', 130),
  ('Sede', 'Ubatiba', 'Ubatiba', 140),
  ('Sede', 'Araçatiba', 'Araçatiba', 150),
  ('Sede', 'Jacaroá', 'Jacaroá', 160),
  ('Sede', 'Marquês de Maricá', 'Marquês de Maricá', 170),
  ('Sede', 'Condado de Maricá', 'Condado de Maricá', 180),
  ('Sede', 'Lagarto', 'Lagarto', 190),
  ('Sede', 'Pilar', 'Pilar', 200),
  ('Sede', 'Pindobas', 'Pindobas', 210),
  ('Sede', 'Silvado', 'Silvado', 220);

-- Ponta Negra
INSERT INTO public.local_delivery_zones (district, name, display_name, sort_order) VALUES
  ('Ponta Negra', 'Manoel Ribeiro', 'Manoel Ribeiro - Ponta Negra', 300),
  ('Ponta Negra', 'Pindobal', 'Pindobal - Ponta Negra', 310),
  ('Ponta Negra', 'Jardim Interlagos', 'Jardim Interlagos - Ponta Negra', 320),
  ('Ponta Negra', 'Guaratiba', 'Guaratiba - Ponta Negra', 330),
  ('Ponta Negra', 'Balneário Bambuí', 'Balneário Bambuí - Ponta Negra', 340),
  ('Ponta Negra', 'Cordeirinho', 'Cordeirinho - Ponta Negra', 350),
  ('Ponta Negra', 'Ponta Negra', 'Ponta Negra', 360),
  ('Ponta Negra', 'Bananal', 'Bananal - Ponta Negra', 370),
  ('Ponta Negra', 'Espraiado', 'Espraiado - Ponta Negra', 380),
  ('Ponta Negra', 'Jaconé', 'Jaconé - Ponta Negra', 390),
  ('Ponta Negra', 'Caju', 'Caju - Ponta Negra', 400),
  ('Ponta Negra', 'Vale da Figueira', 'Vale da Figueira - Ponta Negra', 410);

-- Inoã
INSERT INTO public.local_delivery_zones (district, name, display_name, sort_order) VALUES
  ('Inoã', 'Cassorotiba', 'Cassorotiba - Inoã', 500),
  ('Inoã', 'Chácara de Inoã', 'Chácara de Inoã - Inoã', 510),
  ('Inoã', 'Inoã', 'Inoã', 520),
  ('Inoã', 'Calaboca', 'Calaboca - Inoã', 530),
  ('Inoã', 'Santa Paula', 'Santa Paula - Inoã', 540),
  ('Inoã', 'Spar', 'Spar - Inoã', 550);

-- Itaipuaçu
INSERT INTO public.local_delivery_zones (district, name, display_name, sort_order) VALUES
  ('Itaipuaçu', 'Recanto de Itaipuaçu', 'Recanto de Itaipuaçu - Itaipuaçu', 600),
  ('Itaipuaçu', 'Praia de Itaipuaçu', 'Praia de Itaipuaçu - Itaipuaçu', 610),
  ('Itaipuaçu', 'Jardim Atlântico Oeste', 'Jardim Atlântico Oeste - Itaipuaçu', 620),
  ('Itaipuaçu', 'Jardim Atlântico Central', 'Jardim Atlântico Central - Itaipuaçu', 630),
  ('Itaipuaçu', 'Jardim Atlântico Leste', 'Jardim Atlântico Leste - Itaipuaçu', 640),
  ('Itaipuaçu', 'Cajueiros', 'Cajueiros - Itaipuaçu', 650),
  ('Itaipuaçu', 'Barroco', 'Barroco - Itaipuaçu', 660),
  ('Itaipuaçu', 'Rincão Mimoso', 'Rincão Mimoso - Itaipuaçu', 670),
  ('Itaipuaçu', 'Itaocaia Valley', 'Itaocaia Valley - Itaipuaçu', 680),
  ('Itaipuaçu', 'Morada das Águias', 'Morada das Águias - Itaipuaçu', 690);

-- 9) SEED — aliases iniciais
INSERT INTO public.local_delivery_zone_aliases (zone_id, alias_name)
SELECT id, 'Parque Nanci' FROM public.local_delivery_zones WHERE name = 'Parque Nancy' LIMIT 1;
INSERT INTO public.local_delivery_zone_aliases (zone_id, alias_name)
SELECT id, 'Sao Jose de Imbassai' FROM public.local_delivery_zones WHERE name = 'São José de Imbassaí' LIMIT 1;
INSERT INTO public.local_delivery_zone_aliases (zone_id, alias_name)
SELECT id, 'São José' FROM public.local_delivery_zones WHERE name = 'São José de Imbassaí' LIMIT 1;
INSERT INTO public.local_delivery_zone_aliases (zone_id, alias_name)
SELECT id, 'Barra' FROM public.local_delivery_zones WHERE name = 'Barra de Maricá' LIMIT 1;
INSERT INTO public.local_delivery_zone_aliases (zone_id, alias_name)
SELECT id, 'Marques' FROM public.local_delivery_zones WHERE name = 'Marquês de Maricá' LIMIT 1;
INSERT INTO public.local_delivery_zone_aliases (zone_id, alias_name)
SELECT id, 'Itaipuacu' FROM public.local_delivery_zones WHERE name = 'Praia de Itaipuaçu' LIMIT 1;
INSERT INTO public.local_delivery_zone_aliases (zone_id, alias_name)
SELECT id, 'Jardim Atlantico Oeste' FROM public.local_delivery_zones WHERE name = 'Jardim Atlântico Oeste' LIMIT 1;
INSERT INTO public.local_delivery_zone_aliases (zone_id, alias_name)
SELECT id, 'Jardim Atlantico Central' FROM public.local_delivery_zones WHERE name = 'Jardim Atlântico Central' LIMIT 1;
INSERT INTO public.local_delivery_zone_aliases (zone_id, alias_name)
SELECT id, 'Jardim Atlantico Leste' FROM public.local_delivery_zones WHERE name = 'Jardim Atlântico Leste' LIMIT 1;
INSERT INTO public.local_delivery_zone_aliases (zone_id, alias_name)
SELECT id, 'Cajueiro' FROM public.local_delivery_zones WHERE name = 'Cajueiros' LIMIT 1;
INSERT INTO public.local_delivery_zone_aliases (zone_id, alias_name)
SELECT id, 'Itaocaia Valey' FROM public.local_delivery_zones WHERE name = 'Itaocaia Valley' LIMIT 1;
INSERT INTO public.local_delivery_zone_aliases (zone_id, alias_name)
SELECT id, 'Cala Boca' FROM public.local_delivery_zones WHERE name = 'Calaboca' LIMIT 1;
INSERT INTO public.local_delivery_zone_aliases (zone_id, alias_name)
SELECT id, 'Chacara de Inoa' FROM public.local_delivery_zones WHERE name = 'Chácara de Inoã' LIMIT 1;
INSERT INTO public.local_delivery_zone_aliases (zone_id, alias_name)
SELECT id, 'Chacaras de Inoa' FROM public.local_delivery_zones WHERE name = 'Chácara de Inoã' LIMIT 1;
INSERT INTO public.local_delivery_zone_aliases (zone_id, alias_name)
SELECT id, 'Balneario Bambui' FROM public.local_delivery_zones WHERE name = 'Balneário Bambuí' LIMIT 1;
INSERT INTO public.local_delivery_zone_aliases (zone_id, alias_name)
SELECT id, 'Jacone' FROM public.local_delivery_zones WHERE name = 'Jaconé' LIMIT 1;


-- ============================================
-- 1) Configurações B2B (singleton)
-- ============================================
CREATE TABLE public.b2b_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- regras gerais
  require_admin_approval boolean NOT NULL DEFAULT true,
  show_b2b_prices_to_guests boolean NOT NULL DEFAULT false,
  vitrine_is_active boolean NOT NULL DEFAULT true,
  -- vitrine /atacado
  vitrine_slug text NOT NULL DEFAULT 'atacado',
  hero_title text,
  hero_subtitle text,
  hero_description text,
  hero_image_url text,
  hero_primary_button_text text,
  hero_primary_button_url text,
  hero_secondary_button_text text,
  hero_secondary_button_url text,
  -- benefícios (json array livre p/ Fase 2)
  benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- textos institucionais
  institutional_text text,
  whatsapp_cta_text text,
  -- SEO
  seo_title text,
  seo_description text,
  og_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.b2b_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY b2b_settings_public_read ON public.b2b_settings
  FOR SELECT USING (true);
CREATE POLICY b2b_settings_admin_all ON public.b2b_settings
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_b2b_settings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_touch_b2b_settings BEFORE UPDATE ON public.b2b_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_b2b_settings();

-- linha singleton
INSERT INTO public.b2b_settings (
  hero_title, hero_subtitle, hero_description,
  hero_primary_button_text, hero_primary_button_url,
  hero_secondary_button_text, hero_secondary_button_url,
  whatsapp_cta_text, seo_title, seo_description
) VALUES (
  'Compras em atacado para empresas',
  'Preços especiais para CNPJ, instaladores, condomínios, comércios e profissionais.',
  'Veja o preço normal, compare com o preço empresa e compre com condições especiais a partir da quantidade mínima.',
  'Ver produtos em atacado', '/atacado/produtos',
  'Cadastrar empresa', '/cadastro-empresa',
  'Solicitar negociação B2B',
  'Atacado para empresas | Led Maricá',
  'Preços especiais para empresas com CNPJ. Cadastre-se e tenha acesso a condições B2B na Led Maricá.'
);

-- ============================================
-- 2) Empresas (companies)
-- ============================================
CREATE TYPE public.company_status AS ENUM ('pending', 'approved', 'blocked', 'rejected');

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text NOT NULL UNIQUE,
  legal_name text NOT NULL,
  trade_name text,
  state_registration text,
  -- responsável principal
  contact_name text NOT NULL,
  contact_role text,
  contact_email text NOT NULL,
  contact_phone text NOT NULL,
  -- endereço
  address_zipcode text,
  address_street text,
  address_number text,
  address_complement text,
  address_neighborhood text,
  address_city text,
  address_state text,
  -- status
  status public.company_status NOT NULL DEFAULT 'pending',
  rejection_reason text,
  admin_notes text,
  approved_at timestamptz,
  approved_by uuid,
  blocked_at timestamptz,
  blocked_by uuid,
  -- timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_companies_status ON public.companies(status);
CREATE INDEX idx_companies_cnpj ON public.companies(cnpj);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_companies()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_touch_companies BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.touch_companies();

-- ============================================
-- 3) Vínculo usuário <-> empresa
-- ============================================
CREATE TYPE public.company_user_role AS ENUM ('owner', 'member');

CREATE TABLE public.company_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.company_user_role NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

CREATE INDEX idx_company_users_user ON public.company_users(user_id);
CREATE INDEX idx_company_users_company ON public.company_users(company_id);

ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4) Funções auxiliares (security definer p/ evitar recursão RLS)
-- ============================================
CREATE OR REPLACE FUNCTION public.user_belongs_to_company(_user_id uuid, _company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_users
    WHERE user_id = _user_id AND company_id = _company_id
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.company_users
  WHERE user_id = _user_id
  ORDER BY created_at ASC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_user_approved_company_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cu.company_id
  FROM public.company_users cu
  JOIN public.companies c ON c.id = cu.company_id
  WHERE cu.user_id = _user_id AND c.status = 'approved'
  ORDER BY cu.created_at ASC
  LIMIT 1
$$;

-- ============================================
-- 5) RLS companies / company_users
-- ============================================

-- companies
CREATE POLICY companies_self_select ON public.companies
  FOR SELECT USING (
    is_admin(auth.uid())
    OR public.user_belongs_to_company(auth.uid(), id)
  );

CREATE POLICY companies_self_insert ON public.companies
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND status = 'pending'
    AND approved_at IS NULL
    AND blocked_at IS NULL
  );

-- usuário pode atualizar dados de contato/endereço da própria empresa,
-- mas NÃO pode mudar status/aprovação/bloqueio. Admin pode tudo.
CREATE POLICY companies_self_update ON public.companies
  FOR UPDATE USING (
    is_admin(auth.uid())
    OR public.user_belongs_to_company(auth.uid(), id)
  )
  WITH CHECK (
    is_admin(auth.uid())
    OR (
      public.user_belongs_to_company(auth.uid(), id)
      AND status = (SELECT status FROM public.companies WHERE id = companies.id)
      AND COALESCE(approved_at, 'epoch'::timestamptz)
          = COALESCE((SELECT approved_at FROM public.companies WHERE id = companies.id), 'epoch'::timestamptz)
      AND COALESCE(blocked_at, 'epoch'::timestamptz)
          = COALESCE((SELECT blocked_at FROM public.companies WHERE id = companies.id), 'epoch'::timestamptz)
    )
  );

CREATE POLICY companies_admin_delete ON public.companies
  FOR DELETE USING (is_admin(auth.uid()));

-- company_users
CREATE POLICY company_users_self_select ON public.company_users
  FOR SELECT USING (
    is_admin(auth.uid())
    OR user_id = auth.uid()
    OR public.user_belongs_to_company(auth.uid(), company_id)
  );

-- Insert: o próprio usuário vinculando-se à empresa que acabou de criar
-- (chamado logo após o INSERT em companies pelo cadastro CNPJ).
CREATE POLICY company_users_self_insert ON public.company_users
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
  );

CREATE POLICY company_users_admin_all ON public.company_users
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- ============================================
-- 6) Campos B2B nos produtos
-- ============================================
ALTER TABLE public.products
  ADD COLUMN b2b_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN b2b_price numeric,
  ADD COLUMN b2b_min_qty integer,
  ADD COLUMN b2b_qty_multiple integer,
  ADD COLUMN b2b_valid_until timestamptz,
  ADD COLUMN b2b_show_in_vitrine boolean NOT NULL DEFAULT true,
  ADD COLUMN b2b_commercial_note text;

CREATE INDEX idx_products_b2b_enabled ON public.products(b2b_enabled) WHERE b2b_enabled = true;

-- ============================================
-- 7) Negociações B2B
-- ============================================
CREATE TYPE public.b2b_negotiation_status AS ENUM (
  'nova', 'em_atendimento', 'proposta_enviada',
  'aguardando_cliente', 'convertida_em_pedido', 'perdida', 'cancelada'
);

CREATE TABLE public.b2b_negotiations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- partes
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  user_id uuid,
  -- snapshot identidade (caso empresa seja deletada/alterada)
  company_name text,
  cnpj text,
  contact_name text,
  contact_email text,
  contact_phone text,
  -- origem
  source text NOT NULL DEFAULT 'cart', -- cart | product | vitrine | checkout
  product_id uuid,
  -- valores
  subtotal_retail numeric,
  subtotal_b2b numeric,
  discount_amount numeric,
  discount_percentage numeric,
  cart_snapshot jsonb,
  message_sent text,
  -- atendimento
  status public.b2b_negotiation_status NOT NULL DEFAULT 'nova',
  assigned_admin_id uuid,
  admin_notes text,
  converted_order_id uuid,
  -- timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX idx_b2b_negotiations_status ON public.b2b_negotiations(status);
CREATE INDEX idx_b2b_negotiations_company ON public.b2b_negotiations(company_id);
CREATE INDEX idx_b2b_negotiations_created_at ON public.b2b_negotiations(created_at DESC);

ALTER TABLE public.b2b_negotiations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_b2b_negotiations()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_touch_b2b_negotiations BEFORE UPDATE ON public.b2b_negotiations
FOR EACH ROW EXECUTE FUNCTION public.touch_b2b_negotiations();

-- usuário da empresa vê suas negociações; admin vê tudo
CREATE POLICY b2b_negotiations_select ON public.b2b_negotiations
  FOR SELECT USING (
    is_admin(auth.uid())
    OR user_id = auth.uid()
    OR (company_id IS NOT NULL AND public.user_belongs_to_company(auth.uid(), company_id))
  );

-- usuário autenticado pode criar uma negociação para si/sua empresa
CREATE POLICY b2b_negotiations_insert ON public.b2b_negotiations
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (user_id IS NULL OR user_id = auth.uid())
    AND status = 'nova'
    AND (
      company_id IS NULL
      OR public.user_belongs_to_company(auth.uid(), company_id)
    )
  );

CREATE POLICY b2b_negotiations_admin_update ON public.b2b_negotiations
  FOR UPDATE USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY b2b_negotiations_admin_delete ON public.b2b_negotiations
  FOR DELETE USING (is_admin(auth.uid()));

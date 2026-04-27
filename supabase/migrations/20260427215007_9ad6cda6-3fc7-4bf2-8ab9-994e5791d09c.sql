-- =====================================================
-- COMPANY SETTINGS (single-row config)
-- =====================================================
CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text,
  trade_name text,
  cnpj text,
  state_registration text,
  municipal_registration text,
  address_street text,
  address_number text,
  address_complement text,
  address_neighborhood text,
  address_city text,
  address_state text,
  address_zipcode text,
  support_email text,
  support_phone text,
  support_whatsapp text,
  business_hours text,
  instagram_url text,
  facebook_url text,
  tiktok_url text,
  linkedin_url text,
  website_url text,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Public can read (so footer/contact work for anonymous visitors)
CREATE POLICY company_settings_public_read ON public.company_settings
  FOR SELECT USING (true);

CREATE POLICY company_settings_admin_write ON public.company_settings
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_home_banners_updated_at();

-- Seed single empty record
INSERT INTO public.company_settings (id) VALUES (gen_random_uuid());

-- =====================================================
-- INSTITUTIONAL PAGES
-- =====================================================
CREATE TABLE public.institutional_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  content text NOT NULL DEFAULT '',
  excerpt text,
  seo_title text,
  seo_description text,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  sort_order integer NOT NULL DEFAULT 0,
  show_in_footer boolean NOT NULL DEFAULT true,
  show_in_header boolean NOT NULL DEFAULT false,
  is_required boolean NOT NULL DEFAULT false,
  updated_by uuid,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX institutional_pages_status_idx ON public.institutional_pages(status);
CREATE INDEX institutional_pages_footer_idx ON public.institutional_pages(show_in_footer, sort_order) WHERE status = 'published';

ALTER TABLE public.institutional_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY institutional_pages_public_read ON public.institutional_pages
  FOR SELECT USING (status = 'published' OR public.is_admin(auth.uid()));

CREATE POLICY institutional_pages_admin_all ON public.institutional_pages
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER institutional_pages_updated_at
  BEFORE UPDATE ON public.institutional_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_home_banners_updated_at();

-- Seed required pages with starter content
INSERT INTO public.institutional_pages (title, slug, content, excerpt, status, sort_order, show_in_footer, is_required, published_at) VALUES
('Condições de Uso', 'condicoes-de-uso',
'<h2>Condições de Uso</h2><p>Ao acessar e utilizar este site, você concorda com as condições aqui descritas. Estas condições podem ser atualizadas pelo administrador a qualquer momento.</p><h3>Cadastro</h3><p>O usuário é responsável pelas informações fornecidas no cadastro e por manter a confidencialidade de seu acesso.</p><h3>Produtos e Preços</h3><p>As informações dos produtos, incluindo preços e disponibilidade, podem ser alteradas sem aviso prévio. Possíveis erros de cadastro serão corrigidos antes da confirmação do pedido.</p><h3>Pedidos e Pagamentos</h3><p>Os pedidos são processados após a confirmação do pagamento pelo Mercado Pago. Pedidos podem ser cancelados em caso de divergências ou suspeita de fraude.</p><h3>Propriedade Intelectual</h3><p>Todo o conteúdo deste site é protegido por direitos autorais e não pode ser reproduzido sem autorização.</p><h3>Contato</h3><p>Em caso de dúvidas, entre em contato pelos canais informados na página de contato.</p>',
'Termos e condições gerais de uso do site.', 'published', 1, true, true, now()),

('Meios de Pagamento', 'meios-de-pagamento',
'<h2>Meios de Pagamento</h2><p>Todos os pagamentos são processados de forma segura através do <strong>Mercado Pago</strong>.</p><h3>Formas disponíveis</h3><ul><li>Cartão de crédito (parcelamento conforme regras do Mercado Pago)</li><li>Pix</li><li>Boleto bancário</li></ul><h3>Aprovação</h3><p>A aprovação do pagamento está sujeita à análise da operadora ou instituição financeira. O pedido só é liberado para preparação após a confirmação do pagamento.</p><h3>Segurança</h3><p>Não armazenamos dados de cartão. Todo o processamento ocorre no ambiente seguro do Mercado Pago.</p>',
'Conheça as formas de pagamento aceitas pela loja.', 'published', 2, true, true, now()),

('Reembolso', 'reembolso',
'<h2>Política de Reembolso</h2><p>O reembolso pode ocorrer nas seguintes situações:</p><ul><li>Pagamento recusado pela operadora;</li><li>Cancelamento do pedido autorizado pela loja;</li><li>Devolução aprovada após análise.</li></ul><h3>Forma de Restituição</h3><p>O valor é devolvido pelo mesmo meio de pagamento utilizado. O prazo bancário pode variar conforme a operadora ou instituição financeira.</p><h3>Prazo Operacional</h3><p>Após a aprovação interna, a solicitação de estorno é encaminhada em até 5 dias úteis. O crédito efetivo depende dos prazos de cada banco ou meio de pagamento.</p>',
'Como e quando ocorre o reembolso de pedidos.', 'published', 3, true, true, now()),

('Troca', 'troca',
'<h2>Política de Troca</h2><p>A troca pode ser solicitada nos seguintes casos:</p><ul><li>Defeito de fabricação;</li><li>Divergência entre o produto enviado e o pedido.</li></ul><h3>Como solicitar</h3><p>Entre em contato pelos nossos canais de atendimento antes de enviar o produto. Será necessário informar o número do pedido e descrever o problema.</p><h3>Condições</h3><p>O produto deve estar sem sinais de uso indevido, com embalagem original, acessórios e nota fiscal, quando aplicável. Após o recebimento, o produto será analisado pela equipe.</p>',
'Saiba como solicitar a troca de um produto.', 'published', 4, true, true, now()),

('Devolução', 'devolucao',
'<h2>Política de Devolução</h2><p>Conforme o Código de Defesa do Consumidor, você tem o <strong>direito de arrependimento em até 7 dias</strong> a partir do recebimento do produto, em compras realizadas online.</p><h3>Como devolver</h3><ol><li>Abra uma solicitação pelos canais de atendimento;</li><li>Envie o produto preferencialmente com embalagem original, acessórios e nota fiscal;</li><li>Aguarde a análise das condições do produto.</li></ol><h3>Restituição</h3><p>Após o recebimento e a análise, a restituição do valor é processada conforme a política de reembolso.</p>',
'Direito de arrependimento e devolução de produtos.', 'published', 5, true, true, now()),

('Contato', 'contato',
'<h2>Fale Conosco</h2><p>Estamos à disposição para tirar suas dúvidas, receber sugestões e ajudar com seus pedidos. Utilize o formulário ou os canais de atendimento abaixo.</p>',
'Canais de atendimento e formulário de contato.', 'published', 6, true, true, now());

-- =====================================================
-- CONTACT MESSAGES
-- =====================================================
CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  subject text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','answered','archived')),
  source text NOT NULL DEFAULT 'contact_page',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contact_messages_status_idx ON public.contact_messages(status, created_at DESC);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can submit (public contact form)
CREATE POLICY contact_messages_public_insert ON public.contact_messages
  FOR INSERT WITH CHECK (
    length(trim(name)) > 0
    AND length(trim(email)) > 0
    AND length(trim(message)) > 0
    AND length(name) <= 200
    AND length(email) <= 255
    AND length(message) <= 5000
    AND status = 'new'
    AND source = 'contact_page'
  );

CREATE POLICY contact_messages_admin_read ON public.contact_messages
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY contact_messages_admin_update ON public.contact_messages
  FOR UPDATE USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY contact_messages_admin_delete ON public.contact_messages
  FOR DELETE USING (public.is_admin(auth.uid()));

CREATE TRIGGER contact_messages_updated_at
  BEFORE UPDATE ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_home_banners_updated_at();
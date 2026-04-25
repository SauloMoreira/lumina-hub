
-- ============ ENUM-like via CHECK constraints (já no schema) ============

-- ============ FUNÇÃO has_role para evitar recursão de RLS ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role = 'admin')
$$;

CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_admin(auth.uid()));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Trigger: cria profile ao registrar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT,
  description TEXT,
  parent_id UUID REFERENCES public.categories(id),
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT USING (active = true OR public.is_admin(auth.uid()));
CREATE POLICY "categories_admin_all" ON public.categories FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ PRODUCTS ============
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  specs JSONB DEFAULT '{}',
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  sale_price NUMERIC(10,2) CHECK (sale_price >= 0),
  cost_price NUMERIC(10,2),
  stock_qty INT NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  stock_min_alert INT DEFAULT 10,
  sku TEXT UNIQUE,
  ncm TEXT,
  brand TEXT,
  weight_kg NUMERIC(6,3) DEFAULT 0.300,
  height_cm INT DEFAULT 10,
  width_cm INT DEFAULT 10,
  length_cm INT DEFAULT 10,
  category_id UUID REFERENCES public.categories(id),
  images TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_products_slug ON public.products(slug);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_active ON public.products(active);
CREATE INDEX idx_products_featured ON public.products(featured);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
-- View pública NÃO expõe cost_price; cliente nunca deve usar SELECT * sem proteção. Aqui, via RLS:
CREATE POLICY "products_public_read" ON public.products FOR SELECT USING (active = true OR public.is_admin(auth.uid()));
CREATE POLICY "products_admin_all" ON public.products FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ ADDRESSES ============
CREATE TABLE public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label TEXT DEFAULT 'Casa',
  recipient TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  complement TEXT,
  neighborhood TEXT,
  city TEXT NOT NULL,
  state CHAR(2) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "addresses_owner_all" ON public.addresses FOR ALL USING (auth.uid() = user_id OR public.is_admin(auth.uid())) WITH CHECK (auth.uid() = user_id);

-- ============ ORDERS ============
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','awaiting_payment','paid','preparing','shipped','out_for_delivery','delivered','cancelled','refunded')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
  payment_method TEXT,
  payment_id TEXT,
  payment_link TEXT,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  coupon_code TEXT,
  shipping_carrier TEXT,
  shipping_service TEXT,
  tracking_code TEXT,
  estimated_delivery DATE,
  address_id UUID REFERENCES public.addresses(id),
  address_snapshot JSONB,
  invoice_number TEXT,
  invoice_url TEXT,
  notes TEXT,
  admin_notes TEXT,
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_owner_select" ON public.orders FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "orders_owner_insert" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "orders_admin_update" ON public.orders FOR UPDATE USING (public.is_admin(auth.uid()) OR auth.uid() = user_id);

-- ============ ORDER_ITEMS ============
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  product_sku TEXT,
  product_image TEXT,
  qty INT NOT NULL CHECK (qty > 0),
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_via_order" ON public.order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.is_admin(auth.uid())))
);
CREATE POLICY "order_items_insert" ON public.order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
);

-- ============ CART_ITEMS ============
CREATE TABLE public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id TEXT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  qty INT NOT NULL DEFAULT 1 CHECK (qty > 0),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX cart_user_product ON public.cart_items (user_id, product_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX cart_session_product ON public.cart_items (session_id, product_id) WHERE session_id IS NOT NULL;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cart_owner_all" ON public.cart_items FOR ALL USING (
  (user_id IS NOT NULL AND auth.uid() = user_id) OR (session_id IS NOT NULL)
) WITH CHECK (
  (user_id IS NOT NULL AND auth.uid() = user_id) OR (session_id IS NOT NULL AND user_id IS NULL)
);

-- ============ COUPONS ============
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('fixed','percent')),
  discount_value NUMERIC(10,2) NOT NULL,
  min_order_value NUMERIC(10,2) DEFAULT 0,
  max_uses INT,
  used_count INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coupons_public_read_active" ON public.coupons FOR SELECT USING (active = true);
CREATE POLICY "coupons_admin_all" ON public.coupons FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ LEADS ============
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  origin TEXT DEFAULT 'site' CHECK (origin IN ('site','chat','whatsapp','instagram','indicacao','outro')),
  interest TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','proposal','won','lost')),
  estimated_value NUMERIC(10,2),
  lost_reason TEXT,
  notes TEXT,
  converted_order UUID REFERENCES public.orders(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_admin_all" ON public.leads FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (true);
CREATE POLICY "leads_public_insert" ON public.leads FOR INSERT WITH CHECK (true);

-- ============ LEAD_INTERACTIONS ============
CREATE TABLE public.lead_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('note','call','email','whatsapp','chat','meeting')),
  content TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.lead_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead_int_admin" ON public.lead_interactions FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ CHAT_MESSAGES ============
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id),
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_owner_or_session" ON public.chat_messages FOR SELECT USING (
  (user_id IS NOT NULL AND auth.uid() = user_id) OR public.is_admin(auth.uid()) OR session_id IS NOT NULL
);
CREATE POLICY "chat_insert" ON public.chat_messages FOR INSERT WITH CHECK (true);

-- ============ MARKETING_CAMPAIGNS ============
CREATE TABLE public.marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('cart_recovery','post_purchase','reactivation','promotion','newsletter')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','active','paused','finished')),
  subject TEXT,
  content TEXT,
  sent_count INT DEFAULT 0,
  open_count INT DEFAULT 0,
  click_count INT DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaigns_admin_all" ON public.marketing_campaigns FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ SEEDS: CATEGORIES ============
INSERT INTO public.categories (name, slug, icon, description, sort_order) VALUES
  ('Iluminação LED', 'iluminacao-led', 'Lightbulb', 'Lâmpadas, plafons e fitas LED', 1),
  ('Disjuntores', 'disjuntores', 'Zap', 'Proteção e segurança elétrica', 2),
  ('Fios e Cabos', 'fios-e-cabos', 'Cable', 'Condutores elétricos diversos', 3),
  ('Tomadas e Interruptores', 'tomadas-interruptores', 'Plug', 'Linha branca para instalações', 4),
  ('Refletores', 'refletores', 'Sun', 'Iluminação externa e área de serviço', 5),
  ('Quadros Elétricos', 'quadros-eletricos', 'LayoutGrid', 'Distribuição e organização', 6),
  ('Ferramentas', 'ferramentas', 'Wrench', 'Ferramentas para instalações', 7),
  ('Acessórios', 'acessorios', 'Package', 'Conectores, fitas e mais', 8);

-- ============ SEEDS: PRODUCTS ============
INSERT INTO public.products (name, slug, description, price, stock_qty, sku, ncm, brand, weight_kg, category_id, featured, tags) VALUES
  ('Lâmpada LED 9W Bulbo Bivolt E27', 'lampada-led-9w-bulbo-bivolt-e27', 'Lâmpada LED 9W bulbo bivolt 100-240V soquete E27, 6500K branca fria, 850 lúmens.', 8.50, 250, 'LED-9W-E27', '8539.50.00', 'Foxlux', 0.080, (SELECT id FROM public.categories WHERE slug='iluminacao-led'), true, ARRAY['bivolt','LED','economica']),
  ('Lâmpada LED Tubular T8 18W 120cm', 'lampada-led-tubular-t8-18w-120cm', 'Tubular T8 18W 120cm 6500K, ideal para escritórios e comércio.', 12.00, 180, 'LED-T8-18W', '8539.50.00', 'Foxlux', 0.220, (SELECT id FROM public.categories WHERE slug='iluminacao-led'), true, ARRAY['comercial','LED']),
  ('Refletor LED 20W Bivolt Externo IP66', 'refletor-led-20w-bivolt-externo', 'Refletor LED slim 20W bivolt externo à prova d''água IP66, branco frio.', 22.00, 95, 'REF-20W-IP66', '9405.40.00', 'Empalux', 0.450, (SELECT id FROM public.categories WHERE slug='refletores'), true, ARRAY['IP66','externo']),
  ('Refletor LED 50W Bivolt Externo IP66', 'refletor-led-50w-bivolt-externo', 'Refletor LED slim 50W bivolt externo IP66, ótimo para fachadas e quadras.', 38.00, 60, 'REF-50W-IP66', '9405.40.00', 'Empalux', 0.700, (SELECT id FROM public.categories WHERE slug='refletores'), true, ARRAY['IP66','externo']),
  ('Plafon LED 12W Redondo Sobrepor', 'plafon-led-12w-redondo', 'Luminária plafon LED 12W redondo de sobrepor, branco neutro.', 28.00, 110, 'PLF-12W', '9405.10.00', 'Avant', 0.300, (SELECT id FROM public.categories WHERE slug='iluminacao-led'), false, ARRAY['plafon','sobrepor']),
  ('Spot LED 5W Embutir Dicroica', 'spot-led-5w-dicroica', 'Spot LED 5W embutir dicroica MR16, branco quente.', 15.00, 200, 'SPT-5W-MR16', '9405.10.00', 'Avant', 0.080, (SELECT id FROM public.categories WHERE slug='iluminacao-led'), false, ARRAY['spot','embutir']),
  ('Fita LED SMD 5050 RGB 5m + Fonte', 'fita-led-rgb-5m', 'Fita LED RGB 5050 5 metros com controle remoto e fonte bivolt.', 18.00, 75, 'FITA-RGB-5M', '8543.70.99', 'Foxlux', 0.350, (SELECT id FROM public.categories WHERE slug='iluminacao-led'), true, ARRAY['RGB','decorativa']),
  ('Fio Flexível 2,5mm² 100m Preto', 'fio-flex-2-5mm-100m', 'Fio elétrico flexível 2,5mm² 100m antichama, certificado INMETRO.', 120.00, 40, 'FIO-2.5-100', '8544.49.00', 'Sil', 8.500, (SELECT id FROM public.categories WHERE slug='fios-e-cabos'), false, ARRAY['INMETRO','antichama']),
  ('Cabo PP 2x1,5mm² Preto 100m', 'cabo-pp-2x15-100m', 'Cabo PP 2x1,5mm² 100m, ideal para extensões e equipamentos.', 95.00, 30, 'CABO-PP-2x1.5', '8544.42.00', 'Sil', 6.800, (SELECT id FROM public.categories WHERE slug='fios-e-cabos'), false, ARRAY['extensao']),
  ('Disjuntor Monopolar 10A Curva B', 'disjuntor-mono-10a', 'Disjuntor termomagnético monopolar 10A curva B padrão DIN.', 11.50, 220, 'DJ-10A-B', '8536.20.00', 'Steck', 0.150, (SELECT id FROM public.categories WHERE slug='disjuntores'), true, ARRAY['DIN']),
  ('Disjuntor Bipolar 25A Curva C', 'disjuntor-bi-25a', 'Disjuntor termomagnético bipolar 25A curva C padrão DIN.', 27.00, 130, 'DJ-25A-C', '8536.20.00', 'Steck', 0.300, (SELECT id FROM public.categories WHERE slug='disjuntores'), false, ARRAY['DIN','bipolar']),
  ('Tomada 2P+T 20A Padrão NBR 14136', 'tomada-2pt-20a', 'Tomada 2P+T 20A padrão brasileiro NBR 14136, branca.', 6.00, 350, 'TOM-20A', '8536.69.40', 'Pial', 0.080, (SELECT id FROM public.categories WHERE slug='tomadas-interruptores'), false, ARRAY['NBR14136']),
  ('Interruptor Simples 10A', 'interruptor-simples-10a', 'Interruptor simples 1 tecla 10A 250V, branco.', 4.50, 400, 'INT-S-10A', '8536.50.90', 'Pial', 0.060, (SELECT id FROM public.categories WHERE slug='tomadas-interruptores'), false, ARRAY['linha branca']),
  ('Extensão Elétrica 3m 3 Tomadas', 'extensao-3m-3-tomadas', 'Extensão elétrica 3m com 3 tomadas, certificada INMETRO.', 18.00, 90, 'EXT-3M-3T', '8544.42.00', 'DNI', 0.500, (SELECT id FROM public.categories WHERE slug='acessorios'), false, ARRAY['INMETRO']),
  ('Quadro Distribuição 12 Disjuntores', 'quadro-12-disjuntores', 'Quadro de distribuição embutir/sobrepor para 12 disjuntores DIN.', 55.00, 35, 'QD-12', '8537.10.20', 'Cemar', 1.800, (SELECT id FROM public.categories WHERE slug='quadros-eletricos'), false, ARRAY['DIN']);

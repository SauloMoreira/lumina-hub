-- Tabela principal
CREATE TABLE public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text,
  comment text NOT NULL,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, user_id)
);
CREATE INDEX idx_product_reviews_product ON public.product_reviews(product_id) WHERE is_hidden = false;

-- Tabela de mensagens (conversa)
CREATE TABLE public.product_review_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.product_reviews(id) ON DELETE CASCADE,
  author_type text NOT NULL CHECK (author_type IN ('customer','store')),
  author_user_id uuid NOT NULL REFERENCES public.profiles(id),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_review_messages_review ON public.product_review_messages(review_id);

-- Colunas agregadas em products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS avg_rating numeric(2,1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count integer NOT NULL DEFAULT 0;

-- Trigger de atualização das colunas agregadas
CREATE OR REPLACE FUNCTION public.refresh_product_rating_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_product_id uuid := COALESCE(NEW.product_id, OLD.product_id);
BEGIN
  UPDATE public.products p
  SET avg_rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM public.product_reviews WHERE product_id = v_product_id AND is_hidden = false), 0),
      review_count = (SELECT COUNT(*) FROM public.product_reviews WHERE product_id = v_product_id AND is_hidden = false)
  WHERE p.id = v_product_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_refresh_rating_stats
AFTER INSERT OR UPDATE OR DELETE ON public.product_reviews
FOR EACH ROW EXECUTE FUNCTION public.refresh_product_rating_stats();

-- Trigger updated_at
CREATE TRIGGER trg_product_reviews_updated_at
BEFORE UPDATE ON public.product_reviews
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- Checagem de compra (inclui 'approved' do Mercado Pago, conforme memória do projeto)
CREATE OR REPLACE FUNCTION public.user_purchased_product(_user_id uuid, _product_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.user_id = _user_id
      AND oi.product_id = _product_id
      AND o.payment_status IN ('paid','approved')
  );
$$;

-- GRANTs
GRANT SELECT ON public.product_reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_reviews TO authenticated;
GRANT ALL ON public.product_reviews TO service_role;

GRANT SELECT ON public.product_review_messages TO anon, authenticated;
GRANT INSERT ON public.product_review_messages TO authenticated;
GRANT ALL ON public.product_review_messages TO service_role;

GRANT SELECT (avg_rating, review_count) ON public.products TO anon, authenticated;

-- RLS: product_reviews
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Publico ve avaliacoes visiveis"
  ON public.product_reviews FOR SELECT
  USING (is_hidden = false OR auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Cliente avalia produto que comprou"
  ON public.product_reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.user_purchased_product(auth.uid(), product_id));

CREATE POLICY "Cliente edita a propria avaliacao"
  ON public.product_reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Cliente apaga a propria avaliacao"
  ON public.product_reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin gerencia avaliacoes"
  ON public.product_reviews FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- RLS: product_review_messages
ALTER TABLE public.product_review_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Publico ve mensagens de avaliacoes visiveis"
  ON public.product_review_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.product_reviews r
      WHERE r.id = review_id AND (r.is_hidden = false OR r.user_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

CREATE POLICY "Autor da avaliacao responde na propria thread"
  ON public.product_review_messages FOR INSERT TO authenticated
  WITH CHECK (
    author_type = 'customer'
    AND author_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.product_reviews r WHERE r.id = review_id AND r.user_id = auth.uid())
  );

CREATE POLICY "Loja responde qualquer avaliacao"
  ON public.product_review_messages FOR INSERT TO authenticated
  WITH CHECK (
    author_type = 'store'
    AND author_user_id = auth.uid()
    AND public.is_admin(auth.uid())
  );
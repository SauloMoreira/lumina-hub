
-- 1) Campos faltantes na tabela abandoned_carts
ALTER TABLE public.abandoned_carts
  ADD COLUMN IF NOT EXISTS items_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS origin_context text;

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_status ON public.abandoned_carts(status);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_user ON public.abandoned_carts(user_id);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_lead ON public.abandoned_carts(lead_id);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_abandoned_at ON public.abandoned_carts(abandoned_at DESC);

-- 2) Função de detecção de carrinhos abandonados
-- Considera carrinhos cuja última atividade (last_activity em cart_items.created_at)
-- seja anterior a (agora - _minutes) e que ainda não tenham um abandoned_cart "novo"
-- ou pedido vinculado.
CREATE OR REPLACE FUNCTION public.detect_abandoned_carts(_minutes integer DEFAULT 60)
RETURNS TABLE(created_count integer, skipped_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff timestamptz := now() - make_interval(mins => _minutes);
  v_created integer := 0;
  v_skipped integer := 0;
  r RECORD;
  v_subtotal numeric;
  v_count integer;
  v_snapshot jsonb;
  v_existing_id uuid;
  v_lead_id uuid;
  v_company_id uuid;
  v_recent_paid_order uuid;
BEGIN
  -- Agrupa por user_id (logado) ou session_id (anônimo)
  FOR r IN
    SELECT
      ci.user_id,
      ci.session_id,
      max(ci.created_at) AS last_activity,
      count(*) AS items
    FROM public.cart_items ci
    GROUP BY ci.user_id, ci.session_id
    HAVING max(ci.created_at) < v_cutoff
       AND count(*) > 0
  LOOP
    -- Pula se já existir abandoned_cart ativo (novo ou contato_enviado) recente
    SELECT id INTO v_existing_id
    FROM public.abandoned_carts
    WHERE status IN ('novo', 'contato_enviado')
      AND (
        (r.user_id IS NOT NULL AND user_id = r.user_id)
        OR (r.user_id IS NULL AND r.session_id IS NOT NULL
            AND cart_snapshot->>'_session_id' = r.session_id)
      )
      AND abandoned_at > now() - interval '7 days'
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Pula se houver pedido pago/criado recente do user (após o início do carrinho)
    IF r.user_id IS NOT NULL THEN
      SELECT id INTO v_recent_paid_order
      FROM public.orders
      WHERE user_id = r.user_id
        AND created_at > r.last_activity - interval '5 minutes'
      LIMIT 1;
      IF v_recent_paid_order IS NOT NULL THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;
    END IF;

    -- Snapshot dos itens com produto
    SELECT
      coalesce(jsonb_agg(jsonb_build_object(
        'product_id', p.id,
        'product_name', p.name,
        'product_sku', p.sku,
        'product_image', (CASE WHEN array_length(p.images,1) > 0 THEN p.images[1] ELSE null END),
        'qty', ci.qty,
        'unit_price', p.price,
        'subtotal', round(coalesce(p.price,0) * ci.qty, 2)
      )), '[]'::jsonb),
      coalesce(sum(coalesce(p.price,0) * ci.qty), 0),
      coalesce(sum(ci.qty), 0)
    INTO v_snapshot, v_subtotal, v_count
    FROM public.cart_items ci
    LEFT JOIN public.products p ON p.id = ci.product_id
    WHERE (ci.user_id IS NOT DISTINCT FROM r.user_id
           AND ci.session_id IS NOT DISTINCT FROM r.session_id);

    -- Anexa session_id no snapshot para deduplicação posterior
    IF r.user_id IS NULL AND r.session_id IS NOT NULL THEN
      v_snapshot := v_snapshot || jsonb_build_object('_session_id', r.session_id);
    END IF;

    -- Tenta vincular lead pelo user
    v_lead_id := NULL;
    v_company_id := NULL;
    IF r.user_id IS NOT NULL THEN
      SELECT cu.company_id INTO v_company_id
      FROM public.company_users cu
      WHERE cu.user_id = r.user_id
      LIMIT 1;
    END IF;

    INSERT INTO public.abandoned_carts (
      user_id, lead_id, company_id,
      cart_snapshot, subtotal_amount, items_count,
      status, abandoned_at, last_activity_at
    )
    VALUES (
      r.user_id, v_lead_id, v_company_id,
      v_snapshot, v_subtotal, v_count,
      'novo', now(), r.last_activity
    );

    v_created := v_created + 1;
  END LOOP;

  RETURN QUERY SELECT v_created, v_skipped;
END;
$$;

-- 3) Recuperação automática: ao virar pedido pago, marcar carrinhos abandonados
-- recentes do mesmo user como recuperados.
CREATE OR REPLACE FUNCTION public.auto_recover_abandoned_cart()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status = 'paid'
     AND (OLD.payment_status IS DISTINCT FROM 'paid')
     AND NEW.user_id IS NOT NULL THEN
    UPDATE public.abandoned_carts
       SET status = 'recuperado',
           recovered_at = now(),
           converted_order_id = NEW.id,
           updated_at = now()
     WHERE user_id = NEW.user_id
       AND status IN ('novo', 'contato_enviado')
       AND abandoned_at > now() - interval '30 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_recover_abandoned_cart ON public.orders;
CREATE TRIGGER trg_auto_recover_abandoned_cart
AFTER UPDATE OF payment_status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_recover_abandoned_cart();

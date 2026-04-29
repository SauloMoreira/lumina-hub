
-- ============================================================
-- FASE 5.1 + 5.2 — CRM, WhatsApp Templates, Automações
-- ============================================================

-- ----------------------------------------------------------------
-- 1) LEADS — novos campos
-- ----------------------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_temperature text NOT NULL DEFAULT 'frio',
  ADD COLUMN IF NOT EXISTS score_reason text,
  ADD COLUMN IF NOT EXISTS lost_reason text,
  ADD COLUMN IF NOT EXISTS next_action text,
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_admin_id uuid,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS origin_page text,
  ADD COLUMN IF NOT EXISTS origin_path text,
  ADD COLUMN IF NOT EXISTS origin_product_id uuid,
  ADD COLUMN IF NOT EXISTS origin_product_name text,
  ADD COLUMN IF NOT EXISTS origin_category_id uuid,
  ADD COLUMN IF NOT EXISTS origin_context text,
  ADD COLUMN IF NOT EXISTS referrer_url text;

-- Migrar status antigos para novos
UPDATE public.leads SET status = 'novo'              WHERE status = 'new';
UPDATE public.leads SET status = 'primeiro_contato'  WHERE status = 'contacted';
UPDATE public.leads SET status = 'qualificado'       WHERE status = 'qualified';
UPDATE public.leads SET status = 'orcamento_enviado' WHERE status = 'proposal';
UPDATE public.leads SET status = 'ganhou'            WHERE status = 'won';
UPDATE public.leads SET status = 'perdido'           WHERE status = 'lost';

-- Default novo
ALTER TABLE public.leads ALTER COLUMN status SET DEFAULT 'novo';

-- Constraint: status válidos (permite NULL para compatibilidade)
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check
  CHECK (status IS NULL OR status IN (
    'novo','primeiro_contato','em_atendimento','qualificado',
    'orcamento_enviado','negociacao','aguardando_cliente',
    'ganhou','perdido','sem_resposta'
  ));

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_temperature_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_temperature_check
  CHECK (score_temperature IN ('frio','morno','quente'));

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_priority_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_priority_check
  CHECK (priority IN ('baixa','normal','alta','urgente'));

CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_temperature ON public.leads(score_temperature);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_admin ON public.leads(assigned_admin_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_origin_context ON public.leads(origin_context);

-- ----------------------------------------------------------------
-- 2) LEAD STATUS HISTORY
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_lead ON public.lead_status_history(lead_id, created_at DESC);

ALTER TABLE public.lead_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lsh_admin_all ON public.lead_status_history;
CREATE POLICY lsh_admin_all ON public.lead_status_history
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- ----------------------------------------------------------------
-- 3) WHATSAPP TEMPLATES
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'geral',
  body text NOT NULL,
  variables text[] NOT NULL DEFAULT ARRAY[]::text[],
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wpp_templates_active ON public.whatsapp_templates(active, sort_order);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wpp_templates_admin_all ON public.whatsapp_templates;
CREATE POLICY wpp_templates_admin_all ON public.whatsapp_templates
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_whatsapp_templates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_wpp_templates_touch ON public.whatsapp_templates;
CREATE TRIGGER trg_wpp_templates_touch
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_whatsapp_templates();

-- Seed inicial
INSERT INTO public.whatsapp_templates (name, category, body, variables, sort_order) VALUES
('Primeiro contato', 'lead',
 'Olá, {{nome_cliente}}! Aqui é da {{nome_loja}}. Recebemos seu contato e estou à disposição para ajudar. Posso te chamar agora?',
 ARRAY['nome_cliente','nome_loja'], 10),
('Carrinho abandonado', 'carrinho',
 'Olá, {{nome_cliente}}! Vi que você deixou alguns produtos no carrinho da {{nome_loja}}, no valor de R$ {{valor_carrinho}}. Posso te ajudar a finalizar a compra ou tirar alguma dúvida? {{link_carrinho}}',
 ARRAY['nome_cliente','nome_loja','valor_carrinho','link_carrinho'], 20),
('Produto em dúvida', 'produto',
 'Olá, {{nome_cliente}}! Sobre o produto {{produto}}, posso esclarecer dúvidas, formas de pagamento e prazo de entrega. O que você gostaria de saber?',
 ARRAY['nome_cliente','produto'], 30),
('Produto disponível', 'produto',
 'Boa notícia, {{nome_cliente}}! O produto {{produto}} já está disponível na {{nome_loja}}. Quer que eu reserve uma unidade para você?',
 ARRAY['nome_cliente','produto','nome_loja'], 40),
('Orçamento B2B', 'b2b',
 'Olá, {{nome_empresa}}! Aqui é da {{nome_loja}}. Estou preparando seu orçamento de atacado e em breve te envio as condições especiais.',
 ARRAY['nome_empresa','nome_loja'], 50),
('Negociação B2B', 'b2b',
 'Olá, {{nome_empresa}} (CNPJ {{cnpj}})! Recebemos sua solicitação de negociação. Já estou verificando a melhor condição comercial e retorno em breve.',
 ARRAY['nome_empresa','cnpj'], 60),
('Pedido aguardando pagamento', 'pedido',
 'Olá, {{nome_cliente}}! Seu pedido #{{numero_pedido}} ainda está aguardando o pagamento. Posso te ajudar a finalizar?',
 ARRAY['nome_cliente','numero_pedido'], 70),
('Pedido aprovado', 'pedido',
 'Pagamento confirmado, {{nome_cliente}}! Seu pedido #{{numero_pedido}} já está em preparação. Em breve você recebe atualizações.',
 ARRAY['nome_cliente','numero_pedido'], 80),
('Pedido pronto para retirada', 'pedido',
 'Olá, {{nome_cliente}}! Seu pedido #{{numero_pedido}} está pronto para retirada na {{nome_loja}}. Aguardamos sua visita!',
 ARRAY['nome_cliente','numero_pedido','nome_loja'], 90),
('Pedido saiu para entrega', 'pedido',
 'Olá, {{nome_cliente}}! Seu pedido #{{numero_pedido}} saiu para entrega. Em caso de dúvidas, estamos por aqui.',
 ARRAY['nome_cliente','numero_pedido'], 100),
('Pós-venda', 'relacionamento',
 'Olá, {{nome_cliente}}! Aqui é da {{nome_loja}}. Como foi sua experiência com o pedido #{{numero_pedido}}? Seu feedback é muito importante!',
 ARRAY['nome_cliente','nome_loja','numero_pedido'], 110),
('Recompra', 'relacionamento',
 'Olá, {{nome_cliente}}! Já faz um tempinho. Temos novidades na {{nome_loja}} que podem te interessar. Posso te enviar?',
 ARRAY['nome_cliente','nome_loja'], 120)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------
-- 4) AUTOMATION RULES (todas inativas por padrão)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  wait_minutes integer NOT NULL DEFAULT 0,
  template_id uuid,
  active boolean NOT NULL DEFAULT false,
  max_sends_per_entity integer NOT NULL DEFAULT 1,
  respect_consent boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.automation_rules DROP CONSTRAINT IF EXISTS automation_rules_channel_check;
ALTER TABLE public.automation_rules ADD CONSTRAINT automation_rules_channel_check
  CHECK (channel IN ('whatsapp','email','both'));

ALTER TABLE public.automation_rules DROP CONSTRAINT IF EXISTS automation_rules_trigger_check;
ALTER TABLE public.automation_rules ADD CONSTRAINT automation_rules_trigger_check
  CHECK (trigger_type IN (
    'cart_abandoned','lead_no_response','lead_hot','order_pending_payment',
    'order_paid','order_ready_pickup','post_sale','recompra','b2b_negotiation_open',
    'custom'
  ));

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS automation_rules_admin_all ON public.automation_rules;
CREATE POLICY automation_rules_admin_all ON public.automation_rules
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_automation_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_automation_rules_touch ON public.automation_rules;
CREATE TRIGGER trg_automation_rules_touch
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_automation_rules();

-- Seed regras (todas inativas)
INSERT INTO public.automation_rules (name, description, trigger_type, channel, wait_minutes, active) VALUES
('Carrinho abandonado — 1h', 'Lembrete após 60 minutos sem conclusão de compra.', 'cart_abandoned', 'whatsapp', 60, false),
('Lead sem resposta — 24h', 'Aviso ao admin quando lead fica sem retorno por mais de 24 horas.', 'lead_no_response', 'whatsapp', 1440, false),
('Lead quente — alerta interno', 'Notifica admin sobre lead com pontuação alta.', 'lead_hot', 'whatsapp', 0, false),
('Pedido aguardando pagamento — 2h', 'Lembrete amigável de pagamento pendente.', 'order_pending_payment', 'whatsapp', 120, false),
('Pós-venda — 7 dias', 'Mensagem de pós-venda solicitando feedback.', 'post_sale', 'whatsapp', 10080, false)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------
-- 5) AUTOMATION RUNS (histórico)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid,
  entity_type text NOT NULL,
  entity_id uuid,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'preview',
  generated_message text,
  error_message text,
  triggered_by uuid,
  trigger_kind text NOT NULL DEFAULT 'manual_test',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_automation_runs_rule ON public.automation_runs(rule_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_entity ON public.automation_runs(entity_type, entity_id);

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS automation_runs_admin_all ON public.automation_runs;
CREATE POLICY automation_runs_admin_all ON public.automation_runs
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- ----------------------------------------------------------------
-- 6) ABANDONED CARTS (estrutura preparada — captura na 5.3)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.abandoned_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  lead_id uuid,
  customer_name text,
  customer_email text,
  customer_phone text,
  company_id uuid,
  company_name text,
  cart_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'novo',
  origin_page text,
  origin_path text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  last_activity_at timestamptz,
  abandoned_at timestamptz NOT NULL DEFAULT now(),
  recovered_at timestamptz,
  converted_order_id uuid,
  recovery_attempts integer NOT NULL DEFAULT 0,
  last_contacted_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.abandoned_carts DROP CONSTRAINT IF EXISTS abandoned_carts_status_check;
ALTER TABLE public.abandoned_carts ADD CONSTRAINT abandoned_carts_status_check
  CHECK (status IN ('novo','contato_enviado','recuperado','perdido','ignorado'));

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_status ON public.abandoned_carts(status, abandoned_at DESC);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_user ON public.abandoned_carts(user_id);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_lead ON public.abandoned_carts(lead_id);

ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS abandoned_carts_admin_all ON public.abandoned_carts;
CREATE POLICY abandoned_carts_admin_all ON public.abandoned_carts
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_abandoned_carts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_abandoned_carts_touch ON public.abandoned_carts;
CREATE TRIGGER trg_abandoned_carts_touch
  BEFORE UPDATE ON public.abandoned_carts
  FOR EACH ROW EXECUTE FUNCTION public.touch_abandoned_carts();

-- ----------------------------------------------------------------
-- 7) Lead scoring
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalculate_lead_score(_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_score integer := 0;
  v_temp text := 'frio';
  v_reason text := 'Lead recém-criado.';
  v_cart_total numeric := 0;
  v_has_cart boolean := false;
  v_top_reason text;
BEGIN
  SELECT * INTO v_lead FROM public.leads WHERE id = _lead_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Telefone informado
  IF v_lead.phone IS NOT NULL AND length(trim(v_lead.phone)) > 0 THEN
    v_score := v_score + 15;
  END IF;

  -- Origem chat / WhatsApp
  IF v_lead.origin = 'ai_chat' OR v_lead.origin_context = 'chat' THEN
    v_score := v_score + 15;
    v_top_reason := 'chamou no WhatsApp via chat';
  END IF;

  -- Contexto B2B
  IF v_lead.origin_context = 'b2b_showcase' OR v_lead.origin_context = 'b2b_negotiation' THEN
    v_score := v_score + 20;
    v_top_reason := COALESCE(v_top_reason, 'lead B2B');
  END IF;

  -- Checkout iniciado
  IF v_lead.origin_context = 'checkout' THEN
    v_score := v_score + 10;
    v_top_reason := COALESCE(v_top_reason, 'iniciou checkout');
  END IF;

  -- Visitou produto específico
  IF v_lead.origin_product_id IS NOT NULL THEN
    v_score := v_score + 2;
  END IF;

  -- Carrinho abandonado vinculado
  SELECT subtotal_amount INTO v_cart_total
  FROM public.abandoned_carts
  WHERE lead_id = _lead_id
  ORDER BY abandoned_at DESC LIMIT 1;

  IF FOUND THEN
    v_has_cart := true;
    v_score := v_score + 10;
    IF v_cart_total >= 1000 THEN
      v_score := v_score + 25;
      v_top_reason := 'abandonou carrinho de R$ ' || v_cart_total::text;
    ELSIF v_cart_total >= 500 THEN
      v_score := v_score + 15;
      v_top_reason := COALESCE(v_top_reason, 'abandonou carrinho de R$ ' || v_cart_total::text);
    END IF;
  END IF;

  -- Classificação
  IF v_score > 50 THEN
    v_temp := 'quente';
  ELSIF v_score >= 21 THEN
    v_temp := 'morno';
  ELSE
    v_temp := 'frio';
  END IF;

  -- Razão
  IF v_top_reason IS NOT NULL THEN
    v_reason := 'Lead ' || v_temp || ' — ' || v_top_reason || '.';
  ELSIF v_score > 0 THEN
    v_reason := 'Lead ' || v_temp || ' — ' || v_score::text || ' pontos acumulados.';
  END IF;

  UPDATE public.leads
     SET score = v_score,
         score_temperature = v_temp,
         score_reason = v_reason,
         updated_at = now()
   WHERE id = _lead_id;
END;
$$;

-- ----------------------------------------------------------------
-- 8) Trigger: registrar mudança de status + recalcular score
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.leads_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.lead_status_history (lead_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, NULL, NEW.status, auth.uid(), 'Lead criado');
    PERFORM public.recalculate_lead_score(NEW.id);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.lead_status_history (lead_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_after_insert ON public.leads;
CREATE TRIGGER trg_leads_after_insert
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_after_change();

DROP TRIGGER IF EXISTS trg_leads_after_update ON public.leads;
CREATE TRIGGER trg_leads_after_update
  AFTER UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_after_change();

-- Recalcular score dos leads existentes
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.leads LOOP
    PERFORM public.recalculate_lead_score(r.id);
  END LOOP;
END $$;

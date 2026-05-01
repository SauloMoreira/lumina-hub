-- 1. Tornar admin_id nullable + adicionar source
ALTER TABLE public.admin_audit_log
  ALTER COLUMN admin_id DROP NOT NULL;

ALTER TABLE public.admin_audit_log
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'rpc'
    CHECK (source IN ('rpc', 'trigger_user', 'trigger_system'));

-- Índices para a tela de auditoria
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at
  ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action
  ON public.admin_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_resource_type
  ON public.admin_audit_log (resource_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id
  ON public.admin_audit_log (admin_id) WHERE admin_id IS NOT NULL;

-- 2. Atualiza log_admin_action para também aceitar source
CREATE OR REPLACE FUNCTION public.log_admin_action(
  _admin_id uuid,
  _admin_email text,
  _action text,
  _resource_type text,
  _resource_id text,
  _description text,
  _before jsonb,
  _after jsonb,
  _ip text,
  _user_agent text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.admin_audit_log (
    admin_id, admin_email, action, resource_type, resource_id,
    description, before, after, ip, user_agent, source
  ) VALUES (
    _admin_id, _admin_email, _action, _resource_type, _resource_id,
    _description, _before, _after, _ip, _user_agent, 'rpc'
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

-- 3. Função genérica para diff de JSONB (campos alterados)
CREATE OR REPLACE FUNCTION public.audit_jsonb_diff(_before jsonb, _after jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(jsonb_object_agg(key, jsonb_build_object('before', _before -> key, 'after', _after -> key)), '{}'::jsonb)
  FROM (
    SELECT key FROM jsonb_object_keys(COALESCE(_after, '{}'::jsonb)) AS k(key)
    UNION
    SELECT key FROM jsonb_object_keys(COALESCE(_before, '{}'::jsonb)) AS k(key)
  ) keys
  WHERE COALESCE(_before -> key, 'null'::jsonb) IS DISTINCT FROM COALESCE(_after -> key, 'null'::jsonb);
$$;

-- 4. Trigger function genérica
CREATE OR REPLACE FUNCTION public.audit_table_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_action text;
  v_resource_type text := TG_ARGV[0];
  v_resource_id text;
  v_label text;
  v_before jsonb;
  v_after jsonb;
  v_diff jsonb;
  v_summary text;
  v_source text;
BEGIN
  -- Resolve nome amigável (trade name / name / title / code) com fallback
  IF TG_OP = 'DELETE' THEN
    v_resource_id := OLD.id::text;
    v_before := to_jsonb(OLD);
    v_after := NULL;
    v_action := v_resource_type || '_deleted';
  ELSIF TG_OP = 'INSERT' THEN
    v_resource_id := NEW.id::text;
    v_before := NULL;
    v_after := to_jsonb(NEW);
    v_action := v_resource_type || '_created';
  ELSE
    v_resource_id := NEW.id::text;
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
    v_action := v_resource_type || '_updated';
    -- Se nada mudou de fato (UPDATE no-op), não registra
    v_diff := public.audit_jsonb_diff(v_before, v_after);
    -- ignora updated_at puro
    v_diff := v_diff - 'updated_at';
    IF v_diff = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Label amigável
  v_label := COALESCE(
    (v_after ->> 'name'),
    (v_before ->> 'name'),
    (v_after ->> 'title'),
    (v_before ->> 'title'),
    (v_after ->> 'trade_name'),
    (v_before ->> 'trade_name'),
    (v_after ->> 'legal_name'),
    (v_before ->> 'legal_name'),
    (v_after ->> 'code'),
    (v_before ->> 'code'),
    v_resource_id
  );

  v_summary := CASE TG_OP
    WHEN 'INSERT' THEN format('Criou %s "%s"', v_resource_type, v_label)
    WHEN 'UPDATE' THEN format('Editou %s "%s"', v_resource_type, v_label)
    WHEN 'DELETE' THEN format('Removeu %s "%s"', v_resource_type, v_label)
  END;

  -- Origem: se temos auth.uid() é trigger_user; senão trigger_system (worker/admin RPC)
  IF v_uid IS NOT NULL THEN
    v_source := 'trigger_user';
    SELECT email INTO v_email FROM public.profiles WHERE id = v_uid LIMIT 1;
  ELSE
    v_source := 'trigger_system';
    v_email := NULL;
  END IF;

  -- Não loga escritas de não-admins (RLS já bloqueia, mas defesa em profundidade)
  IF v_uid IS NOT NULL AND NOT public.is_admin(v_uid) THEN
    -- não é admin, não audita (pode ser escrita pelo próprio dono em sua tabela)
    RETURN COALESCE(NEW, OLD);
  END IF;

  BEGIN
    INSERT INTO public.admin_audit_log (
      admin_id, admin_email, action, resource_type, resource_id,
      description, before, after, source
    ) VALUES (
      v_uid, v_email, v_action, v_resource_type, v_resource_id,
      v_summary, v_before, v_after, v_source
    );
  EXCEPTION WHEN OTHERS THEN
    -- Auditoria nunca deve quebrar a operação principal
    RAISE WARNING '[audit] failed to log %.% on %: %', TG_TABLE_NAME, TG_OP, v_resource_id, SQLERRM;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 5. Aplica triggers nas tabelas críticas
DROP TRIGGER IF EXISTS audit_products ON public.products;
CREATE TRIGGER audit_products
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes('product');

DROP TRIGGER IF EXISTS audit_home_banners ON public.home_banners;
CREATE TRIGGER audit_home_banners
  AFTER INSERT OR UPDATE OR DELETE ON public.home_banners
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes('home_banner');

DROP TRIGGER IF EXISTS audit_coupons ON public.coupons;
CREATE TRIGGER audit_coupons
  AFTER INSERT OR UPDATE OR DELETE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes('coupon');

DROP TRIGGER IF EXISTS audit_product_bundles ON public.product_bundles;
CREATE TRIGGER audit_product_bundles
  AFTER INSERT OR UPDATE OR DELETE ON public.product_bundles
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes('bundle');

DROP TRIGGER IF EXISTS audit_product_bundle_items ON public.product_bundle_items;
CREATE TRIGGER audit_product_bundle_items
  AFTER INSERT OR UPDATE OR DELETE ON public.product_bundle_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes('bundle_item');

DROP TRIGGER IF EXISTS audit_companies ON public.companies;
CREATE TRIGGER audit_companies
  AFTER INSERT OR UPDATE OR DELETE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes('company');

DROP TRIGGER IF EXISTS audit_homepage_settings ON public.homepage_settings;
CREATE TRIGGER audit_homepage_settings
  AFTER INSERT OR UPDATE OR DELETE ON public.homepage_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes('homepage_settings');

DROP TRIGGER IF EXISTS audit_finance_settings ON public.finance_settings;
CREATE TRIGGER audit_finance_settings
  AFTER INSERT OR UPDATE OR DELETE ON public.finance_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes('finance_settings');
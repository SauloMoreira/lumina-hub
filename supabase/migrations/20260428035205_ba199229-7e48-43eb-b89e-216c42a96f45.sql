-- =====================================================================
-- Sub-fase 1F: Rate Limit + Security Audit infra (Postgres-based)
-- =====================================================================

-- Tabela de eventos de rate limit
CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,         -- ip, user_id, email, sessionId
  action text NOT NULL,             -- 'login', 'contact', 'chat', 'coupon', 'signup', 'password_reset'
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS rate_limit_events_lookup_idx
  ON public.rate_limit_events (action, identifier, created_at DESC);

CREATE INDEX IF NOT EXISTS rate_limit_events_created_at_idx
  ON public.rate_limit_events (created_at);

ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY rate_limit_events_admin_read
  ON public.rate_limit_events FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Sem policy de INSERT/UPDATE/DELETE: apenas service_role escreve.

-- Tabela de eventos de segurança (CSP reports, falhas críticas, etc.)
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,               -- 'csp_violation', 'auth_failure', 'webhook_invalid_signature', 'rate_limit_exceeded', 'admin_action', 'ssrf_blocked'
  severity text NOT NULL DEFAULT 'info', -- 'info' | 'warn' | 'error'
  identifier text,                  -- ip, user_id, etc.
  message text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_events_type_idx ON public.security_events (type, created_at DESC);
CREATE INDEX IF NOT EXISTS security_events_created_at_idx ON public.security_events (created_at DESC);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY security_events_admin_read
  ON public.security_events FOR SELECT
  USING (public.is_admin(auth.uid()));

-- =====================================================================
-- RPC: check_rate_limit
-- Atômico: conta eventos na janela e, se sob o limite, registra o novo.
-- Retorna allowed (boolean), current_count, retry_after_seconds.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _identifier text,
  _action text,
  _max_attempts integer,
  _window_seconds integer
)
RETURNS TABLE(allowed boolean, current_count integer, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_oldest timestamptz;
  v_retry integer;
BEGIN
  IF _identifier IS NULL OR length(trim(_identifier)) = 0 THEN
    RETURN QUERY SELECT false, 0, _window_seconds; RETURN;
  END IF;

  SELECT count(*), min(created_at)
  INTO v_count, v_oldest
  FROM public.rate_limit_events
  WHERE action = _action
    AND identifier = _identifier
    AND created_at > now() - make_interval(secs => _window_seconds);

  IF v_count >= _max_attempts THEN
    v_retry := GREATEST(1, _window_seconds - EXTRACT(EPOCH FROM (now() - v_oldest))::integer);
    RETURN QUERY SELECT false, v_count, v_retry;
    RETURN;
  END IF;

  INSERT INTO public.rate_limit_events (identifier, action)
  VALUES (_identifier, _action);

  RETURN QUERY SELECT true, v_count + 1, 0;
END;
$$;

-- Restringe acesso: apenas service_role pode chamar (server-side)
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) TO service_role;

-- =====================================================================
-- RPC: log_security_event (server-only)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.log_security_event(
  _type text,
  _severity text,
  _identifier text,
  _message text,
  _metadata jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.security_events (type, severity, identifier, message, metadata)
  VALUES (_type, COALESCE(_severity, 'info'), _identifier, _message, _metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_security_event(text, text, text, text, jsonb) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.log_security_event(text, text, text, text, jsonb) TO service_role;

-- =====================================================================
-- Cleanup: auto-expira eventos antigos (>7d) via função utilitária
-- =====================================================================
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.rate_limit_events
  WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limit_events() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limit_events() TO service_role;
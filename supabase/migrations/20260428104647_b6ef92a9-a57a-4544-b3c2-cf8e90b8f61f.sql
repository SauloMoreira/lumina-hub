-- Tabela de auditoria de ações administrativas
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  admin_email text,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  description text,
  before jsonb,
  after jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON public.admin_audit_log (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_resource ON public.admin_audit_log (resource_type, resource_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_audit_log_admin_read
  ON public.admin_audit_log
  FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Sem policies de INSERT/UPDATE/DELETE: somente service_role/security definer.

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
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.admin_audit_log (
    admin_id, admin_email, action, resource_type, resource_id,
    description, before, after, ip, user_agent
  ) VALUES (
    _admin_id, _admin_email, _action, _resource_type, _resource_id,
    _description, _before, _after, _ip, _user_agent
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_admin_action(uuid, text, text, text, text, text, jsonb, jsonb, text, text) FROM PUBLIC, anon, authenticated;
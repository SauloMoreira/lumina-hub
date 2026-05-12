-- A-01: Hardening das RPCs auxiliares B2B.
-- Antes: aceitavam _user_id arbitrário do chamador, mesmo SECURITY DEFINER.
-- Depois: se o chamador NÃO for service_role, o parâmetro é forçado a auth.uid().
-- service_role mantém poder de consultar qualquer user_id (uso admin/server).

CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' THEN
    _user_id := auth.uid();
  END IF;
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN (
    SELECT company_id FROM public.company_users
    WHERE user_id = _user_id
    ORDER BY created_at ASC
    LIMIT 1
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_approved_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' THEN
    _user_id := auth.uid();
  END IF;
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN (
    SELECT cu.company_id
    FROM public.company_users cu
    JOIN public.companies c ON c.id = cu.company_id
    WHERE cu.user_id = _user_id AND c.status = 'approved'
    ORDER BY cu.created_at ASC
    LIMIT 1
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.user_belongs_to_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' THEN
    _user_id := auth.uid();
  END IF;
  IF _user_id IS NULL OR _company_id IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.company_users
    WHERE user_id = _user_id AND company_id = _company_id
  );
END;
$function$;
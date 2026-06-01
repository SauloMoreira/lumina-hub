-- v1.1.0-a: estrutura base para administração de usuários
-- Adiciona campo de status operacional em profiles (active/blocked/archived)
-- Sem alterar RLS, roles ou auth. Reversível com DROP COLUMN.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Validação por trigger (não CHECK constraint, para manter mutabilidade)
CREATE OR REPLACE FUNCTION public.validate_profile_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('active','blocked','archived') THEN
    RAISE EXCEPTION 'profiles.status inválido: %', NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_profile_status ON public.profiles;
CREATE TRIGGER trg_validate_profile_status
  BEFORE INSERT OR UPDATE OF status ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_status();

CREATE INDEX IF NOT EXISTS profiles_status_idx ON public.profiles(status);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);
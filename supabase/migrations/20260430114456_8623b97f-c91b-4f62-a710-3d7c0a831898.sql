-- ============================================================
-- 0) Normalização de valores antigos (se já existirem)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='products' AND column_name='ncm'
  ) THEN
    UPDATE public.products
       SET ncm = NULLIF(regexp_replace(ncm, '\D', '', 'g'), '')
     WHERE ncm IS NOT NULL;
    UPDATE public.products SET ncm = NULL
     WHERE ncm IS NOT NULL AND ncm !~ '^[0-9]{8}$';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='products' AND column_name='cest'
  ) THEN
    UPDATE public.products
       SET cest = NULLIF(regexp_replace(cest, '\D', '', 'g'), '')
     WHERE cest IS NOT NULL;
    UPDATE public.products SET cest = NULL
     WHERE cest IS NOT NULL AND cest !~ '^[0-9]{7}$';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='products' AND column_name='cfop_default'
  ) THEN
    UPDATE public.products
       SET cfop_default = NULLIF(regexp_replace(cfop_default, '\D', '', 'g'), '')
     WHERE cfop_default IS NOT NULL;
    UPDATE public.products SET cfop_default = NULL
     WHERE cfop_default IS NOT NULL AND cfop_default !~ '^[0-9]{4}$';
  END IF;
END $$;

-- ============================================================
-- 1) Campos fiscais em products
-- ============================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ncm text,
  ADD COLUMN IF NOT EXISTS cest text,
  ADD COLUMN IF NOT EXISTS cfop_default text,
  ADD COLUMN IF NOT EXISTS product_origin smallint,
  ADD COLUMN IF NOT EXISTS commercial_unit text,
  ADD COLUMN IF NOT EXISTS tributary_unit text,
  ADD COLUMN IF NOT EXISTS tax_category text,
  ADD COLUMN IF NOT EXISTS fiscal_description text,
  ADD COLUMN IF NOT EXISTS fiscal_notes text,
  ADD COLUMN IF NOT EXISTS gtin_ean text,
  ADD COLUMN IF NOT EXISTS gtin_tax text,
  ADD COLUMN IF NOT EXISTS net_weight numeric,
  ADD COLUMN IF NOT EXISTS gross_weight numeric,
  ADD COLUMN IF NOT EXISTS width_cm numeric,
  ADD COLUMN IF NOT EXISTS height_cm numeric,
  ADD COLUMN IF NOT EXISTS length_cm numeric,
  ADD COLUMN IF NOT EXISTS fiscal_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS fiscal_status text NOT NULL DEFAULT 'incompleto',
  ADD COLUMN IF NOT EXISTS fiscal_score smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fiscal_updated_at timestamptz;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_ncm_format_chk;
ALTER TABLE public.products
  ADD CONSTRAINT products_ncm_format_chk
  CHECK (ncm IS NULL OR ncm ~ '^[0-9]{8}$') NOT VALID;
ALTER TABLE public.products VALIDATE CONSTRAINT products_ncm_format_chk;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_cest_format_chk;
ALTER TABLE public.products
  ADD CONSTRAINT products_cest_format_chk
  CHECK (cest IS NULL OR cest ~ '^[0-9]{7}$') NOT VALID;
ALTER TABLE public.products VALIDATE CONSTRAINT products_cest_format_chk;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_cfop_default_format_chk;
ALTER TABLE public.products
  ADD CONSTRAINT products_cfop_default_format_chk
  CHECK (cfop_default IS NULL OR cfop_default ~ '^[0-9]{4}$') NOT VALID;
ALTER TABLE public.products VALIDATE CONSTRAINT products_cfop_default_format_chk;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_origin_chk;
ALTER TABLE public.products
  ADD CONSTRAINT products_origin_chk
  CHECK (product_origin IS NULL OR (product_origin BETWEEN 0 AND 8));

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_fiscal_status_chk;
ALTER TABLE public.products
  ADD CONSTRAINT products_fiscal_status_chk
  CHECK (fiscal_status IN ('completo','incompleto','revisar','nao_aplicavel'));

CREATE INDEX IF NOT EXISTS idx_products_fiscal_status ON public.products(fiscal_status);
CREATE INDEX IF NOT EXISTS idx_products_ncm ON public.products(ncm);

-- ============================================================
-- 2) Função/trigger: recalcula status fiscal + score
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalculate_product_fiscal_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score smallint := 0;
  v_status text;
  v_has_ncm boolean;
  v_has_unit boolean;
  v_has_origin boolean;
  v_has_weight boolean;
  v_has_dims boolean;
  v_has_ean boolean;
  v_has_desc boolean;
  v_has_cfop boolean;
  v_has_cest boolean;
  v_ncm_valid boolean;
  v_cfop_valid boolean;
BEGIN
  IF NEW.fiscal_status = 'nao_aplicavel' THEN
    NEW.fiscal_score := 0;
    NEW.fiscal_updated_at := now();
    RETURN NEW;
  END IF;

  v_has_ncm := NEW.ncm IS NOT NULL AND length(trim(NEW.ncm)) = 8;
  v_ncm_valid := v_has_ncm AND NEW.ncm ~ '^[0-9]{8}$';
  v_has_unit := NEW.commercial_unit IS NOT NULL AND length(trim(NEW.commercial_unit)) > 0;
  v_has_origin := NEW.product_origin IS NOT NULL;
  v_has_weight := COALESCE(NEW.net_weight, NEW.gross_weight, NEW.weight_kg, 0) > 0;
  v_has_dims := COALESCE(NEW.width_cm,0) > 0 AND COALESCE(NEW.height_cm,0) > 0 AND COALESCE(NEW.length_cm,0) > 0;
  v_has_ean := NEW.gtin_ean IS NOT NULL AND length(trim(NEW.gtin_ean)) > 0;
  v_has_desc := NEW.fiscal_description IS NOT NULL AND length(trim(NEW.fiscal_description)) >= 10;
  v_has_cfop := NEW.cfop_default IS NOT NULL AND NEW.cfop_default ~ '^[0-9]{4}$';
  v_cfop_valid := v_has_cfop;
  v_has_cest := NEW.cest IS NOT NULL AND NEW.cest ~ '^[0-9]{7}$';

  IF v_ncm_valid THEN v_score := v_score + 25; END IF;
  IF v_has_unit THEN v_score := v_score + 15; END IF;
  IF v_has_origin THEN v_score := v_score + 15; END IF;
  IF v_has_desc THEN v_score := v_score + 10; END IF;
  IF v_has_ean THEN v_score := v_score + 10; END IF;
  IF v_has_weight AND v_has_dims THEN v_score := v_score + 10;
  ELSIF v_has_weight OR v_has_dims THEN v_score := v_score + 5;
  END IF;
  IF v_cfop_valid THEN v_score := v_score + 10; END IF;
  IF v_has_cest THEN v_score := v_score + 5; END IF;

  IF v_score > 100 THEN v_score := 100; END IF;

  IF (NEW.ncm IS NOT NULL AND NOT v_ncm_valid)
     OR (NEW.cfop_default IS NOT NULL AND NOT v_cfop_valid) THEN
    v_status := 'revisar';
  ELSIF v_has_ncm AND v_has_unit AND v_has_origin THEN
    v_status := 'completo';
  ELSE
    v_status := 'incompleto';
  END IF;

  NEW.fiscal_status := v_status;
  NEW.fiscal_score := v_score;
  NEW.fiscal_updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_fiscal_recalc ON public.products;
CREATE TRIGGER trg_products_fiscal_recalc
BEFORE INSERT OR UPDATE OF
  ncm, cest, cfop_default, product_origin, commercial_unit, tributary_unit,
  fiscal_description, gtin_ean, gtin_tax, net_weight, gross_weight,
  width_cm, height_cm, length_cm, weight_kg, fiscal_enabled, fiscal_status
ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_product_fiscal_status();

-- Popula status/score nos existentes (no-op update aciona trigger)
UPDATE public.products SET fiscal_enabled = fiscal_enabled WHERE id IS NOT NULL;

-- ============================================================
-- 3) Dados fiscais da empresa em finance_settings
-- ============================================================
ALTER TABLE public.finance_settings
  ADD COLUMN IF NOT EXISTS fiscal_tax_regime text,
  ADD COLUMN IF NOT EXISTS fiscal_main_cnae text,
  ADD COLUMN IF NOT EXISTS fiscal_default_nf_series text,
  ADD COLUMN IF NOT EXISTS fiscal_default_operation_nature text,
  ADD COLUMN IF NOT EXISTS fiscal_default_cfop_internal text,
  ADD COLUMN IF NOT EXISTS fiscal_default_cfop_interstate text,
  ADD COLUMN IF NOT EXISTS fiscal_provider text,
  ADD COLUMN IF NOT EXISTS fiscal_environment text NOT NULL DEFAULT 'homologacao',
  ADD COLUMN IF NOT EXISTS fiscal_observations text,
  ADD COLUMN IF NOT EXISTS fiscal_company_data_completed boolean NOT NULL DEFAULT false;

ALTER TABLE public.finance_settings DROP CONSTRAINT IF EXISTS finance_settings_tax_regime_chk;
ALTER TABLE public.finance_settings
  ADD CONSTRAINT finance_settings_tax_regime_chk
  CHECK (fiscal_tax_regime IS NULL OR fiscal_tax_regime IN
    ('simples_nacional','lucro_presumido','lucro_real','mei','outro'));

ALTER TABLE public.finance_settings DROP CONSTRAINT IF EXISTS finance_settings_environment_chk;
ALTER TABLE public.finance_settings
  ADD CONSTRAINT finance_settings_environment_chk
  CHECK (fiscal_environment IN ('homologacao','producao'));

ALTER TABLE public.finance_settings DROP CONSTRAINT IF EXISTS finance_settings_cfop_internal_chk;
ALTER TABLE public.finance_settings
  ADD CONSTRAINT finance_settings_cfop_internal_chk
  CHECK (fiscal_default_cfop_internal IS NULL OR fiscal_default_cfop_internal ~ '^[0-9]{4}$');

ALTER TABLE public.finance_settings DROP CONSTRAINT IF EXISTS finance_settings_cfop_interstate_chk;
ALTER TABLE public.finance_settings
  ADD CONSTRAINT finance_settings_cfop_interstate_chk
  CHECK (fiscal_default_cfop_interstate IS NULL OR fiscal_default_cfop_interstate ~ '^[0-9]{4}$');
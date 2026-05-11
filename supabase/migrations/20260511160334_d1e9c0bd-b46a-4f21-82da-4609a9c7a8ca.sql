-- Fix S3 v2: usar auth.role() (claim do JWT) ao invés de session_user.

DO $do$
DECLARE
  v_def text;
  v_fname text;
BEGIN
  FOREACH v_fname IN ARRAY ARRAY[
    'validate_b2b_pricing','resolve_codes_bulk','validate_cart_bundles',
    'get_product_relations_public','get_cart_complementary_products'
  ]
  LOOP
    SELECT pg_get_functiondef(p.oid)
      INTO v_def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = v_fname
     LIMIT 1;
    IF v_def IS NULL THEN
      RAISE EXCEPTION '% não encontrada', v_fname;
    END IF;
    v_def := replace(v_def,
      'session_user IN (''anon'',''authenticated'')',
      'COALESCE(auth.role(), ''anon'') <> ''service_role''');
    -- caso a versão antiga ainda esteja com current_user
    v_def := replace(v_def,
      'current_user IN (''anon'',''authenticated'')',
      'COALESCE(auth.role(), ''anon'') <> ''service_role''');
    EXECUTE v_def;
  END LOOP;
END
$do$;

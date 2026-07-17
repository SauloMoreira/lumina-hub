REVOKE SELECT ON public.products FROM authenticated;

GRANT SELECT (
  id, name, slug, description, specs, price, sale_price,
  stock_qty, stock_min_alert, sku, ncm, brand,
  weight_kg, height_cm, width_cm, length_cm,
  category_id, images, tags, active, featured,
  created_at, updated_at
) ON public.products TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_products()
RETURNS SETOF public.products
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem listar produtos completos.';
  END IF;
  RETURN QUERY SELECT * FROM public.products ORDER BY created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_products() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_products() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_product(p_id uuid)
RETURNS public.products
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result public.products;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem visualizar produto completo.';
  END IF;
  SELECT * INTO result FROM public.products WHERE id = p_id;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_product(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_product(uuid) TO authenticated;
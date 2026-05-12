DROP POLICY IF EXISTS companies_self_update ON public.companies;

CREATE POLICY companies_self_update ON public.companies
FOR UPDATE
USING (
  is_admin(auth.uid()) OR user_belongs_to_company(auth.uid(), id)
)
WITH CHECK (
  is_admin(auth.uid())
  OR (
    user_belongs_to_company(auth.uid(), id)
    AND status = (SELECT c2.status FROM public.companies c2 WHERE c2.id = companies.id)
    AND COALESCE(approved_at, '1970-01-01'::timestamptz) =
        COALESCE((SELECT c2.approved_at FROM public.companies c2 WHERE c2.id = companies.id), '1970-01-01'::timestamptz)
    AND COALESCE(blocked_at, '1970-01-01'::timestamptz) =
        COALESCE((SELECT c2.blocked_at FROM public.companies c2 WHERE c2.id = companies.id), '1970-01-01'::timestamptz)
  )
);
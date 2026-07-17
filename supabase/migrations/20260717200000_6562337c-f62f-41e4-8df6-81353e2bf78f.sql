
-- 1) products: revoke fiscal column (ncm) from anon; b2b_* and cost/margin already blocked
REVOKE SELECT (ncm) ON public.products FROM anon;

-- 2) cart_items: remove ability for any visitor to read/write guest carts by session_id alone.
-- Guest carts now require a matching session token supplied via request header
-- (PostgREST exposes headers via current_setting('request.headers')).
DROP POLICY IF EXISTS cart_owner_all ON public.cart_items;

CREATE POLICY cart_owner_all ON public.cart_items
FOR ALL
USING (
  (
    user_id IS NOT NULL
    AND auth.uid() = user_id
  )
  OR (
    user_id IS NULL
    AND session_id IS NOT NULL
    AND session_id = COALESCE(
      current_setting('request.headers', true)::json->>'x-cart-session',
      ''
    )
    AND length(session_id) >= 16
  )
  OR public.is_admin(auth.uid())
)
WITH CHECK (
  (
    user_id IS NOT NULL
    AND auth.uid() = user_id
  )
  OR (
    user_id IS NULL
    AND session_id IS NOT NULL
    AND session_id = COALESCE(
      current_setting('request.headers', true)::json->>'x-cart-session',
      ''
    )
    AND length(session_id) >= 16
  )
);

-- 3) marketing_integrations: restrict public read to only the columns the storefront needs
-- (provider, account_id, enabled, consent_category). Hide 'notes' from anon/authenticated,
-- since it may contain sensitive operational context.
REVOKE SELECT ON public.marketing_integrations FROM anon, authenticated;
GRANT SELECT (id, provider, account_id, enabled, consent_category) ON public.marketing_integrations TO anon, authenticated;


-- 1) PROFILES: bloquear escalação de privilégio
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;

CREATE POLICY profiles_self_update
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  AND email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  AND id = (SELECT id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY profiles_admin_update
ON public.profiles
FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 2) CHAT_MESSAGES: fechar leitura cross-session
DROP POLICY IF EXISTS chat_owner_or_session ON public.chat_messages;

CREATE POLICY chat_owner_or_admin_read
ON public.chat_messages
FOR SELECT
USING (
  (user_id IS NOT NULL AND auth.uid() = user_id)
  OR public.is_admin(auth.uid())
);

-- 3) CART_ITEMS: restringir session_id apenas a carrinhos sem dono
DROP POLICY IF EXISTS cart_owner_all ON public.cart_items;

CREATE POLICY cart_owner_all
ON public.cart_items
FOR ALL
USING (
  (user_id IS NOT NULL AND auth.uid() = user_id)
  OR (user_id IS NULL AND session_id IS NOT NULL)
  OR public.is_admin(auth.uid())
)
WITH CHECK (
  (user_id IS NOT NULL AND auth.uid() = user_id)
  OR (user_id IS NULL AND session_id IS NOT NULL)
);

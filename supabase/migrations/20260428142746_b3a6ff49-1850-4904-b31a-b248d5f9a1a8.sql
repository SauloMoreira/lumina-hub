DROP POLICY IF EXISTS "chat_owner_or_admin_read" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_owner_or_session" ON public.chat_messages;

CREATE POLICY "chat_owner_or_admin_read" ON public.chat_messages
  FOR SELECT USING (
    (user_id IS NOT NULL AND auth.uid() = user_id)
    OR public.is_admin(auth.uid())
  );
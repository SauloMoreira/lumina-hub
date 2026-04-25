
-- Refina lead insert público: garantir nome não vazio
DROP POLICY IF EXISTS "leads_public_insert" ON public.leads;
CREATE POLICY "leads_public_insert" ON public.leads FOR INSERT
WITH CHECK (length(trim(name)) > 0 AND status = 'new');

-- Refina chat insert: visitante só insere role='user', evita injeção de assistant
DROP POLICY IF EXISTS "chat_insert" ON public.chat_messages;
CREATE POLICY "chat_insert" ON public.chat_messages FOR INSERT
WITH CHECK (
  role = 'user' AND length(trim(content)) > 0 AND length(content) < 4000
);

-- leads admin policy: o WITH CHECK true permite admin alterar livremente; ok mas vamos limitar a admins
DROP POLICY IF EXISTS "leads_admin_all" ON public.leads;
CREATE POLICY "leads_admin_select" ON public.leads FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "leads_admin_update" ON public.leads FOR UPDATE USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "leads_admin_delete" ON public.leads FOR DELETE USING (public.is_admin(auth.uid()));

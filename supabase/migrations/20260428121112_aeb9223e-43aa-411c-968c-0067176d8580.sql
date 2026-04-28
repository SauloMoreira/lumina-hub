-- 1) Remove UPDATE do cliente em orders. Apenas admin pode atualizar via RLS.
--    O webhook usa service_role e ignora RLS.
DROP POLICY IF EXISTS orders_admin_update ON public.orders;

CREATE POLICY orders_admin_update
ON public.orders
FOR UPDATE
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- 2) Alinha constraint de status para incluir 'confirmed'
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status = ANY (ARRAY[
    'pending','awaiting_payment','confirmed','paid','preparing',
    'shipped','out_for_delivery','delivered','cancelled','refunded'
  ]));

-- 3) Alinha constraint de payment_status para incluir 'charged_back'
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status = ANY (ARRAY[
    'pending','preference_created','in_process','approved','paid',
    'rejected','failed','cancelled','refunded','charged_back'
  ]));
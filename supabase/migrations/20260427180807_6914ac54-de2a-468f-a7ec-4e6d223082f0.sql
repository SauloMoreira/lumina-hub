ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status = ANY (ARRAY[
    'pending'::text,
    'preference_created'::text,
    'in_process'::text,
    'approved'::text,
    'paid'::text,
    'rejected'::text,
    'failed'::text,
    'cancelled'::text,
    'refunded'::text
  ]));
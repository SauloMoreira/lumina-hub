INSERT INTO public.cart_items (session_id, product_id, qty, created_at)
VALUES ('test-session-validation-001', '74b37c8e-58ee-46c3-9e2c-1c9e4ef800ea', 2, now() - interval '61 minutes');
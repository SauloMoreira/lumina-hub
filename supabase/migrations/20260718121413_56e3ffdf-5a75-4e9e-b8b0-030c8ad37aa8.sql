SELECT cron.schedule(
  'detect-abandoned-carts-hourly',
  '0 * * * *',
  $$ SELECT public.detect_abandoned_carts(60); $$
);
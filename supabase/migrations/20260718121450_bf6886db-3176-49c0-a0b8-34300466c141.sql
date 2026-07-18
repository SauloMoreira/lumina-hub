SELECT public.detect_abandoned_carts(60);
SELECT * FROM cron.job WHERE jobname = 'detect-abandoned-carts-hourly';
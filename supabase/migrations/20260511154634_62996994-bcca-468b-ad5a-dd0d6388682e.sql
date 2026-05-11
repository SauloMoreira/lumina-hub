
-- ============================================================
-- ONDA S2 — Hardening do banco e storage
-- ============================================================

-- 1) Search path seguro nas duas funções sem SET (linter "Function Search Path Mutable")
ALTER FUNCTION public.audit_jsonb_diff(jsonb, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.touch_updated_at() SET search_path = public, pg_temp;

-- 2) Revogar EXECUTE de funções gatilho/admin que jamais devem ser chamadas por anon/authenticated
--    (gatilhos continuam disparando — não dependem de privilégio EXECUTE do invocador)

REVOKE EXECUTE ON FUNCTION public.audit_jsonb_diff(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_table_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_recover_abandoned_cart() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_stock_on_paid() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_primary_product_image() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.leads_after_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_product_fiscal_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_invoice_pending_on_paid() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_product_images_array_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_abandoned_carts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_automation_rules() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_b2b_negotiations() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_b2b_settings() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_companies() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_finance_settings() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_homepage_sections_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_homepage_settings() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_leads_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_local_delivery_zone_aliases() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_local_delivery_zones() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_marketing_campaigns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_marketing_integrations() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_product_attributes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_whatsapp_templates() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_home_banners_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_invoice_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.detect_abandoned_carts(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_lead_score(uuid) FROM PUBLIC, anon, authenticated;

-- 3) Storage: remover SELECT amplo no bucket marketing-creatives (impede listagem)
--    Bucket continua público (acesso direto via /storage/v1/object/public/...)
DROP POLICY IF EXISTS "Public read marketing-creatives" ON storage.objects;

-- Onda 2: ampliar cobertura de auditoria via triggers em mais tabelas.
-- Reaproveita a função public.audit_table_changes(resource_type) criada na Onda 1.
-- Cobre: leads, lead_interactions, lead_status_history, automation_rules,
-- whatsapp_templates, company_settings, local_delivery_zones,
-- local_delivery_zone_aliases, marketing_integrations, b2b_settings,
-- b2b_negotiations, homepage_cards, homepage_featured_categories,
-- homepage_product_showcases, homepage_showcase_items, homepage_sections.

DROP TRIGGER IF EXISTS audit_leads ON public.leads;
CREATE TRIGGER audit_leads
AFTER INSERT OR UPDATE OR DELETE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes('lead');

DROP TRIGGER IF EXISTS audit_lead_interactions ON public.lead_interactions;
CREATE TRIGGER audit_lead_interactions
AFTER INSERT OR UPDATE OR DELETE ON public.lead_interactions
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes('lead_interaction');

DROP TRIGGER IF EXISTS audit_lead_status_history ON public.lead_status_history;
CREATE TRIGGER audit_lead_status_history
AFTER INSERT OR UPDATE OR DELETE ON public.lead_status_history
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes('lead_status_history');

DROP TRIGGER IF EXISTS audit_automation_rules ON public.automation_rules;
CREATE TRIGGER audit_automation_rules
AFTER INSERT OR UPDATE OR DELETE ON public.automation_rules
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes('automation_rule');

DROP TRIGGER IF EXISTS audit_whatsapp_templates ON public.whatsapp_templates;
CREATE TRIGGER audit_whatsapp_templates
AFTER INSERT OR UPDATE OR DELETE ON public.whatsapp_templates
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes('whatsapp_template');

DROP TRIGGER IF EXISTS audit_company_settings ON public.company_settings;
CREATE TRIGGER audit_company_settings
AFTER INSERT OR UPDATE OR DELETE ON public.company_settings
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes('company_settings');

DROP TRIGGER IF EXISTS audit_local_delivery_zones ON public.local_delivery_zones;
CREATE TRIGGER audit_local_delivery_zones
AFTER INSERT OR UPDATE OR DELETE ON public.local_delivery_zones
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes('local_delivery_zone');

DROP TRIGGER IF EXISTS audit_local_delivery_zone_aliases ON public.local_delivery_zone_aliases;
CREATE TRIGGER audit_local_delivery_zone_aliases
AFTER INSERT OR UPDATE OR DELETE ON public.local_delivery_zone_aliases
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes('local_delivery_alias');

DROP TRIGGER IF EXISTS audit_marketing_integrations ON public.marketing_integrations;
CREATE TRIGGER audit_marketing_integrations
AFTER INSERT OR UPDATE OR DELETE ON public.marketing_integrations
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes('marketing_integration');

DROP TRIGGER IF EXISTS audit_b2b_settings ON public.b2b_settings;
CREATE TRIGGER audit_b2b_settings
AFTER INSERT OR UPDATE OR DELETE ON public.b2b_settings
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes('b2b_settings');

DROP TRIGGER IF EXISTS audit_b2b_negotiations ON public.b2b_negotiations;
CREATE TRIGGER audit_b2b_negotiations
AFTER INSERT OR UPDATE OR DELETE ON public.b2b_negotiations
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes('b2b_negotiation');

DROP TRIGGER IF EXISTS audit_homepage_cards ON public.homepage_cards;
CREATE TRIGGER audit_homepage_cards
AFTER INSERT OR UPDATE OR DELETE ON public.homepage_cards
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes('homepage_card');

DROP TRIGGER IF EXISTS audit_homepage_featured_categories ON public.homepage_featured_categories;
CREATE TRIGGER audit_homepage_featured_categories
AFTER INSERT OR UPDATE OR DELETE ON public.homepage_featured_categories
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes('homepage_featured_category');

DROP TRIGGER IF EXISTS audit_homepage_product_showcases ON public.homepage_product_showcases;
CREATE TRIGGER audit_homepage_product_showcases
AFTER INSERT OR UPDATE OR DELETE ON public.homepage_product_showcases
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes('homepage_showcase');

DROP TRIGGER IF EXISTS audit_homepage_showcase_items ON public.homepage_showcase_items;
CREATE TRIGGER audit_homepage_showcase_items
AFTER INSERT OR UPDATE OR DELETE ON public.homepage_showcase_items
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes('homepage_showcase_item');

DROP TRIGGER IF EXISTS audit_homepage_sections ON public.homepage_sections;
CREATE TRIGGER audit_homepage_sections
AFTER INSERT OR UPDATE OR DELETE ON public.homepage_sections
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes('homepage_section');
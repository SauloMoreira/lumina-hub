import { supabase } from '@/integrations/supabase/client';

export type HomepageSettings = {
  id: string;
  hero_is_active: boolean;
  hero_logo_url: string | null;
  hero_logo_alt: string | null;
  hero_badge_text: string | null;
  hero_badge_icon: string | null;
  hero_title: string | null;
  hero_highlight_text: string | null;
  hero_description: string | null;
  hero_subdescription: string | null;
  hero_primary_button_active: boolean;
  hero_primary_button_text: string | null;
  hero_primary_button_url: string | null;
  hero_primary_button_icon: string | null;
  hero_primary_button_new_tab: boolean;
  hero_secondary_button_active: boolean;
  hero_secondary_button_text: string | null;
  hero_secondary_button_url: string | null;
  hero_secondary_button_icon: string | null;
  hero_secondary_button_new_tab: boolean;

  promo_bar_is_active: boolean;
  promo_bar_text: string | null;
  promo_bar_icon: string | null;
  promo_bar_background_color: string | null;
  promo_bar_text_color: string | null;
  promo_bar_url: string | null;
  promo_bar_starts_at: string | null;
  promo_bar_ends_at: string | null;

  main_cta_is_active: boolean;
  main_cta_icon: string | null;
  main_cta_title: string | null;
  main_cta_description: string | null;
  main_cta_button_active: boolean;
  main_cta_button_text: string | null;
  main_cta_button_url: string | null;
  main_cta_background_color: string | null;
  main_cta_text_color: string | null;
  main_cta_button_color: string | null;
  main_cta_image_url: string | null;

  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
};

export async function fetchHomepageSettings(): Promise<HomepageSettings | null> {
  const { data, error } = await (supabase as any)
    .from('homepage_settings')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as HomepageSettings | null) ?? null;
}

export function isPromoBarVisible(s: HomepageSettings | null | undefined): boolean {
  if (!s || !s.promo_bar_is_active || !s.promo_bar_text) return false;
  const now = Date.now();
  if (s.promo_bar_starts_at && new Date(s.promo_bar_starts_at).getTime() > now) return false;
  if (s.promo_bar_ends_at && new Date(s.promo_bar_ends_at).getTime() < now) return false;
  return true;
}

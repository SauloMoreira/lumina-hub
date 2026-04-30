import { supabase } from '@/integrations/supabase/client';

export type HomepageCardType = 'benefit' | 'promo';

export interface HomepageCard {
  id: string;
  card_type: HomepageCardType;
  title: string;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  link_url: string | null;
  link_label: string | null;
  visual_variant: string | null;
  sort_order: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
}

export interface HomepageFeaturedCategory {
  id: string;
  category_id: string;
  custom_title: string | null;
  custom_description: string | null;
  custom_image_url: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  // join
  category?: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    active: boolean;
  } | null;
}

const CARD_COLS =
  'id, card_type, title, description, icon, image_url, link_url, link_label, visual_variant, sort_order, is_active, start_date, end_date';

export async function fetchHomepageCards(type: HomepageCardType): Promise<HomepageCard[]> {
  const { data, error } = await (supabase as any)
    .from('homepage_cards')
    .select(CARD_COLS)
    .eq('card_type', type)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) {
    console.warn('[homepageBlocks] fetchHomepageCards error', error);
    return [];
  }
  const now = Date.now();
  return ((data ?? []) as HomepageCard[]).filter((c) => {
    if (c.start_date && new Date(c.start_date).getTime() > now) return false;
    if (c.end_date && new Date(c.end_date).getTime() < now) return false;
    return true;
  });
}

export async function fetchHomepageFeaturedCategories(): Promise<HomepageFeaturedCategory[]> {
  const { data, error } = await (supabase as any)
    .from('homepage_featured_categories')
    .select(
      'id, category_id, custom_title, custom_description, custom_image_url, icon, sort_order, is_active, category:categories(id, name, slug, icon, active)',
    )
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) {
    console.warn('[homepageBlocks] fetchHomepageFeaturedCategories error', error);
    return [];
  }
  return ((data ?? []) as HomepageFeaturedCategory[]).filter(
    (row) => row.category && row.category.active !== false,
  );
}

// Admin variants (sem filtro de ativo / janela de datas)
export async function adminListHomepageCards(type: HomepageCardType): Promise<HomepageCard[]> {
  const { data, error } = await (supabase as any)
    .from('homepage_cards')
    .select(CARD_COLS)
    .eq('card_type', type)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as HomepageCard[];
}

export async function adminListHomepageFeaturedCategories(): Promise<HomepageFeaturedCategory[]> {
  const { data, error } = await (supabase as any)
    .from('homepage_featured_categories')
    .select(
      'id, category_id, custom_title, custom_description, custom_image_url, icon, sort_order, is_active, category:categories(id, name, slug, icon, active)',
    )
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as HomepageFeaturedCategory[];
}

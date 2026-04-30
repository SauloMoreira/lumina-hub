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

// =====================================================================
// Vitrines de produtos (Onda Homepage D)
// =====================================================================

export type ShowcaseType =
  | 'featured'
  | 'offers'
  | 'best_sellers'
  | 'new_arrivals'
  | 'category'
  | 'bundles'
  | 'custom';
export type ShowcaseMode = 'auto' | 'manual';
export type ShowcaseVisual = 'default' | 'premium' | 'compact' | 'highlighted';
export type ShowcaseItemType = 'product' | 'combo';

export interface HomepageShowcase {
  id: string;
  title: string;
  subtitle: string | null;
  showcase_type: ShowcaseType;
  mode: ShowcaseMode;
  product_limit: number;
  category_id: string | null;
  is_active: boolean;
  sort_order: number;
  visual_variant: ShowcaseVisual;
  show_view_all_button: boolean;
  view_all_url: string | null;
}

export interface HomepageShowcaseItem {
  id: string;
  showcase_id: string;
  item_type: ShowcaseItemType;
  product_id: string | null;
  combo_id: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface ResolvedShowcaseProduct {
  kind: 'product';
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  price: number;
  sale_price: number | null;
  stock_qty: number | null;
  images: string[] | null;
  featured: boolean | null;
  free_shipping_eligible: boolean | null;
  category_id: string | null;
  b2b_enabled?: boolean | null;
  b2b_price?: number | null;
  b2b_min_qty?: number | null;
}
export interface ResolvedShowcaseCombo {
  kind: 'combo';
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  image_url: string | null;
  discount_type: string;
  discount_value: number;
  items_count: number;
}
export type ResolvedShowcaseItem = ResolvedShowcaseProduct | ResolvedShowcaseCombo;

export interface ResolvedShowcase extends HomepageShowcase {
  items: ResolvedShowcaseItem[];
}

const SHOWCASE_COLS =
  'id, title, subtitle, showcase_type, mode, product_limit, category_id, is_active, sort_order, visual_variant, show_view_all_button, view_all_url';

/** Pública: usa RPC que já filtra por ativo, preço e B2B-safe */
export async function fetchHomepageShowcasesPublic(): Promise<ResolvedShowcase[]> {
  const { data, error } = await (supabase as any).rpc('get_homepage_showcases_public');
  if (error) {
    console.warn('[homepageBlocks] fetchHomepageShowcasesPublic error', error);
    return [];
  }
  return (Array.isArray(data) ? data : []) as ResolvedShowcase[];
}

export async function adminListHomepageShowcases(): Promise<HomepageShowcase[]> {
  const { data, error } = await (supabase as any)
    .from('homepage_product_showcases')
    .select(SHOWCASE_COLS)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as HomepageShowcase[];
}

export async function adminCreateHomepageShowcase(
  payload: Partial<HomepageShowcase>,
): Promise<HomepageShowcase> {
  const { data, error } = await (supabase as any)
    .from('homepage_product_showcases')
    .insert(payload)
    .select(SHOWCASE_COLS)
    .single();
  if (error) throw error;
  return data as HomepageShowcase;
}

export async function adminUpdateHomepageShowcase(
  id: string,
  payload: Partial<HomepageShowcase>,
): Promise<void> {
  const { error } = await (supabase as any)
    .from('homepage_product_showcases')
    .update(payload)
    .eq('id', id);
  if (error) throw error;
}

export async function adminDeleteHomepageShowcase(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('homepage_product_showcases')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function adminListShowcaseItems(showcaseId: string): Promise<HomepageShowcaseItem[]> {
  const { data, error } = await (supabase as any)
    .from('homepage_showcase_items')
    .select('id, showcase_id, item_type, product_id, combo_id, sort_order, is_active')
    .eq('showcase_id', showcaseId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as HomepageShowcaseItem[];
}

export async function adminAddShowcaseItem(payload: {
  showcase_id: string;
  item_type: ShowcaseItemType;
  product_id?: string | null;
  combo_id?: string | null;
  sort_order?: number;
}): Promise<void> {
  const { error } = await (supabase as any).from('homepage_showcase_items').insert(payload);
  if (error) throw error;
}

export async function adminUpdateShowcaseItem(
  id: string,
  payload: Partial<HomepageShowcaseItem>,
): Promise<void> {
  const { error } = await (supabase as any)
    .from('homepage_showcase_items')
    .update(payload)
    .eq('id', id);
  if (error) throw error;
}

export async function adminDeleteShowcaseItem(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('homepage_showcase_items')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

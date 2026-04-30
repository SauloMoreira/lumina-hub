import { supabaseAdmin } from '@/integrations/supabase/client.server';

export interface SeoQuickCounts {
  productsNoSeoTitle: number;
  productsNoSeoDescription: number;
  productsNoImage: number;
  productsNoDescription: number;
  categoriesNoDescription: number;
  homepageMissingSeo: boolean;
  b2bMissingSeo: boolean;
}

export async function fetchSeoQuickCounts(): Promise<SeoQuickCounts> {
  const safe = async (run: () => Promise<{ count: number | null }>) => {
    try { return (await run()).count ?? 0; } catch { return 0; }
  };

  const [noTitle, noDesc, noImg, shortDesc, catNoDesc] = await Promise.all([
    safe(() => supabaseAdmin.from('products').select('id', { count: 'exact', head: true }).eq('active', true).is('seo_title', null) as any),
    safe(() => supabaseAdmin.from('products').select('id', { count: 'exact', head: true }).eq('active', true).is('seo_description', null) as any),
    safe(() => supabaseAdmin.from('products').select('id', { count: 'exact', head: true }).eq('active', true).or('images.is.null,images.eq.{}') as any),
    safe(() => supabaseAdmin.from('products').select('id', { count: 'exact', head: true }).eq('active', true).is('description', null) as any),
    safe(() => supabaseAdmin.from('categories').select('id', { count: 'exact', head: true }).eq('active', true).is('description', null) as any),
  ]);

  let homepageMissingSeo = true;
  try {
    const { data } = await supabaseAdmin.from('homepage_settings').select('seo_title, seo_description').limit(1).maybeSingle();
    homepageMissingSeo = !data?.seo_title || !data?.seo_description;
  } catch {}

  let b2bMissingSeo = true;
  try {
    const { data } = await supabaseAdmin.from('b2b_settings').select('seo_title, seo_description').limit(1).maybeSingle();
    b2bMissingSeo = !data?.seo_title || !data?.seo_description;
  } catch {}

  return {
    productsNoSeoTitle: noTitle,
    productsNoSeoDescription: noDesc,
    productsNoImage: noImg,
    productsNoDescription: shortDesc,
    categoriesNoDescription: catNoDesc,
    homepageMissingSeo,
    b2bMissingSeo,
  };
}

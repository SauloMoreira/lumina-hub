import { createServerFn } from '@tanstack/react-start';
import { requireAdmin } from '@/integrations/supabase/admin-middleware';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

export type SeoSeverity = 'ok' | 'warn' | 'danger';

export interface SeoIssue {
  code: string;
  label: string;
  severity: SeoSeverity;
}

export interface SeoProductRow {
  id: string;
  name: string;
  slug: string;
  score: number;
  severity: SeoSeverity;
  issues: SeoIssue[];
  hasImage: boolean;
}

export interface SeoCategoryRow {
  id: string;
  name: string;
  slug: string;
  score: number;
  severity: SeoSeverity;
  issues: SeoIssue[];
}

export interface SeoPageRow {
  id: string;
  title: string;
  slug: string;
  score: number;
  severity: SeoSeverity;
  issues: SeoIssue[];
}

export interface SeoLocalCheck {
  hasMaricaInTitle: boolean;
  hasMaricaInDescription: boolean;
  hasLocalDeliveryZones: boolean;
  hasCompanyAddress: boolean;
  hasGeoStructuredData: boolean;
  notes: string[];
}

export interface SeoSummary {
  productsTotal: number;
  productsWithIssues: number;
  productsCritical: number;
  categoriesTotal: number;
  categoriesWithIssues: number;
  pagesTotal: number;
  pagesWithIssues: number;
  homepageScore: number;
  homepageIssues: SeoIssue[];
  averageProductScore: number;
}

export interface SeoInsights {
  summary: SeoSummary;
  products: SeoProductRow[];
  categories: SeoCategoryRow[];
  pages: SeoPageRow[];
  local: SeoLocalCheck;
  generatedAt: string;
}

// =====================================================================
// Helpers de score
// =====================================================================

function scoreSeverity(issues: SeoIssue[]): { score: number; severity: SeoSeverity } {
  let deduction = 0;
  for (const i of issues) {
    if (i.severity === 'danger') deduction += 25;
    else if (i.severity === 'warn') deduction += 10;
  }
  const score = Math.max(0, 100 - deduction);
  let severity: SeoSeverity = 'ok';
  if (issues.some((i) => i.severity === 'danger')) severity = 'danger';
  else if (issues.some((i) => i.severity === 'warn')) severity = 'warn';
  return { score, severity };
}

function checkProduct(p: {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  images: string[] | null;
  active: boolean;
}): SeoProductRow {
  const issues: SeoIssue[] = [];
  const hasImage = (p.images?.length ?? 0) > 0;

  if (!p.seo_title || p.seo_title.trim().length === 0) {
    issues.push({ code: 'no_seo_title', label: 'Sem título SEO', severity: 'danger' });
  } else if (p.seo_title.length < 30) {
    issues.push({ code: 'short_seo_title', label: 'Título SEO curto (< 30 caracteres)', severity: 'warn' });
  } else if (p.seo_title.length > 65) {
    issues.push({ code: 'long_seo_title', label: 'Título SEO longo (> 65 caracteres)', severity: 'warn' });
  }

  if (!p.seo_description || p.seo_description.trim().length === 0) {
    issues.push({ code: 'no_seo_description', label: 'Sem meta description', severity: 'danger' });
  } else if (p.seo_description.length < 70) {
    issues.push({ code: 'short_seo_description', label: 'Meta description curta (< 70)', severity: 'warn' });
  } else if (p.seo_description.length > 165) {
    issues.push({ code: 'long_seo_description', label: 'Meta description longa (> 165)', severity: 'warn' });
  }

  if (!p.description || p.description.trim().length < 80) {
    issues.push({ code: 'short_description', label: 'Descrição do produto curta', severity: 'warn' });
  }

  if (!hasImage) {
    issues.push({ code: 'no_image', label: 'Produto sem imagem', severity: 'danger' });
  }

  if (!p.slug || p.slug.trim().length === 0) {
    issues.push({ code: 'no_slug', label: 'Sem slug (URL)', severity: 'danger' });
  }

  if (!p.seo_keywords || p.seo_keywords.trim().length === 0) {
    issues.push({ code: 'no_keywords', label: 'Sem palavras-chave', severity: 'warn' });
  }

  const { score, severity } = scoreSeverity(issues);
  return {
    id: p.id,
    name: p.name,
    slug: p.slug ?? '',
    score,
    severity,
    issues,
    hasImage,
  };
}

function checkCategory(c: {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
}): SeoCategoryRow {
  const issues: SeoIssue[] = [];

  if (!c.slug || c.slug.trim().length === 0) {
    issues.push({ code: 'no_slug', label: 'Sem slug (URL)', severity: 'danger' });
  }
  if (!c.description || c.description.trim().length < 50) {
    issues.push({
      code: 'short_description',
      label: 'Descrição curta — ajuda buscadores entenderem a categoria',
      severity: 'warn',
    });
  }
  if (!c.name || c.name.trim().length < 3) {
    issues.push({ code: 'short_name', label: 'Nome muito curto', severity: 'warn' });
  }

  const { score, severity } = scoreSeverity(issues);
  return { id: c.id, name: c.name, slug: c.slug ?? '', score, severity, issues };
}

function checkPage(p: {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  seo_title: string | null;
  seo_description: string | null;
  status: string;
}): SeoPageRow {
  const issues: SeoIssue[] = [];

  if (!p.seo_title || p.seo_title.trim().length === 0) {
    issues.push({ code: 'no_seo_title', label: 'Sem título SEO', severity: 'warn' });
  }
  if (!p.seo_description || p.seo_description.trim().length === 0) {
    issues.push({ code: 'no_seo_description', label: 'Sem meta description', severity: 'warn' });
  } else if (p.seo_description.length > 165) {
    issues.push({ code: 'long_seo_description', label: 'Meta description longa (> 165)', severity: 'warn' });
  }
  if (!p.content || p.content.trim().length < 200) {
    issues.push({ code: 'short_content', label: 'Conteúdo da página curto', severity: 'warn' });
  }
  if (p.status !== 'published') {
    issues.push({ code: 'unpublished', label: 'Página não publicada', severity: 'danger' });
  }

  const { score, severity } = scoreSeverity(issues);
  return { id: p.id, title: p.title, slug: p.slug, score, severity, issues };
}

function checkHomepage(h: {
  hero_title: string | null;
  hero_description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
} | null): { score: number; severity: SeoSeverity; issues: SeoIssue[] } {
  const issues: SeoIssue[] = [];
  if (!h) {
    issues.push({ code: 'no_homepage', label: 'Configurações da homepage não criadas', severity: 'danger' });
    return { score: 0, severity: 'danger', issues };
  }
  if (!h.seo_title) issues.push({ code: 'no_seo_title', label: 'Homepage sem título SEO', severity: 'danger' });
  else if (h.seo_title.length > 65) issues.push({ code: 'long_seo_title', label: 'Título SEO da home longo', severity: 'warn' });

  if (!h.seo_description) issues.push({ code: 'no_seo_description', label: 'Homepage sem meta description', severity: 'danger' });
  else if (h.seo_description.length > 165) issues.push({ code: 'long_seo_description', label: 'Meta description da home longa', severity: 'warn' });

  if (!h.og_image_url) issues.push({ code: 'no_og_image', label: 'Sem imagem de compartilhamento (OG)', severity: 'warn' });
  if (!h.hero_title) issues.push({ code: 'no_hero', label: 'Hero sem título', severity: 'warn' });
  if (!h.hero_description) issues.push({ code: 'no_hero_desc', label: 'Hero sem descrição', severity: 'warn' });

  const scored = scoreSeverity(issues);
  return { score: scored.score, severity: scored.severity, issues };
}

// =====================================================================
// Endpoint principal
// =====================================================================

export const getSeoInsights = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .handler(async (): Promise<SeoInsights> => {
    // Produtos ativos
    const { data: prodData } = await supabaseAdmin
      .from('products')
      .select('id, name, slug, description, seo_title, seo_description, seo_keywords, images, active')
      .eq('active', true)
      .order('updated_at', { ascending: false })
      .limit(500);

    const products = (prodData ?? []).map((p: any) => checkProduct(p));

    // Categorias ativas
    const { data: catData } = await supabaseAdmin
      .from('categories')
      .select('id, name, slug, description, active')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .limit(200);

    const categories = (catData ?? []).map((c: any) => checkCategory(c));

    // Páginas institucionais
    const { data: pagesData } = await supabaseAdmin
      .from('institutional_pages')
      .select('id, title, slug, content, seo_title, seo_description, status')
      .order('sort_order', { ascending: true })
      .limit(100);

    const pages = (pagesData ?? []).map((p: any) => checkPage(p));

    // Homepage
    const { data: homeData } = await supabaseAdmin
      .from('homepage_settings')
      .select('hero_title, hero_description, seo_title, seo_description, og_image_url')
      .limit(1)
      .maybeSingle();

    const home = checkHomepage(homeData as any);

    // SEO local
    const { data: zones } = await supabaseAdmin
      .from('local_delivery_zones')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    const { data: company } = await supabaseAdmin
      .from('company_settings')
      .select('address_street, address_city, address_state')
      .limit(1)
      .maybeSingle();

    const homeTxt = `${homeData?.seo_title ?? ''} ${homeData?.seo_description ?? ''} ${homeData?.hero_title ?? ''} ${homeData?.hero_description ?? ''}`.toLowerCase();
    const local: SeoLocalCheck = {
      hasMaricaInTitle: (homeData?.seo_title ?? '').toLowerCase().includes('maric'),
      hasMaricaInDescription: (homeData?.seo_description ?? '').toLowerCase().includes('maric'),
      hasLocalDeliveryZones: (zones?.length ?? 0) > 0,
      hasCompanyAddress: !!(company?.address_street && company?.address_city),
      hasGeoStructuredData: true, // já incluído no JSON-LD do __root.tsx
      notes: [],
    };

    if (!local.hasMaricaInTitle) local.notes.push('Inclua "Maricá" no título SEO da home.');
    if (!local.hasMaricaInDescription) local.notes.push('Mencione "Maricá" e "RJ" na meta description.');
    if (!local.hasLocalDeliveryZones) local.notes.push('Cadastre bairros/zonas de entrega local.');
    if (!local.hasCompanyAddress) local.notes.push('Preencha o endereço da loja em Configurações da empresa.');
    if (!homeTxt.includes('material elétrico') && !homeTxt.includes('iluminação'))
      local.notes.push('Reforce termos do nicho ("material elétrico", "iluminação LED").');

    const productsWithIssues = products.filter((p) => p.severity !== 'ok').length;
    const productsCritical = products.filter((p) => p.severity === 'danger').length;
    const avgScore = products.length
      ? Math.round(products.reduce((s, p) => s + p.score, 0) / products.length)
      : 100;

    const summary: SeoSummary = {
      productsTotal: products.length,
      productsWithIssues,
      productsCritical,
      categoriesTotal: categories.length,
      categoriesWithIssues: categories.filter((c) => c.severity !== 'ok').length,
      pagesTotal: pages.length,
      pagesWithIssues: pages.filter((p) => p.severity !== 'ok').length,
      homepageScore: home.score,
      homepageIssues: home.issues,
      averageProductScore: avgScore,
    };

    return {
      summary,
      products: products.sort((a, b) => a.score - b.score),
      categories: categories.sort((a, b) => a.score - b.score),
      pages: pages.sort((a, b) => a.score - b.score),
      local,
      generatedAt: new Date().toISOString(),
    };
  });

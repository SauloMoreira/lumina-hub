import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireAdmin } from '@/integrations/supabase/admin-middleware';
import {
  computeCommercialReview,
  type CommercialReviewResult,
  type CommercialStatus,
} from '@/lib/commercialReview';

/**
 * Revisão Comercial — Onda 1.
 *
 * SOMENTE LEITURA. Não altera produtos, preços, B2B, combos, pedidos,
 * checkout, Mercado Pago, frete ou estoque.
 *
 * Análise puramente baseada no cadastro do produto. Não consulta
 * order_items nem históricos de venda — isso fica para a Onda 2
 * (produto parado, alto giro).
 */

export type CommercialFilter =
  | 'all'
  | 'no_cost'
  | 'no_price'
  | 'negative_margin'
  | 'critical_margin'
  | 'attention_margin'
  | 'b2b_critical'
  | 'b2b_incomplete'
  | 'healthy';

export type CommercialReviewRow = {
  id: string;
  name: string;
  sku: string | null;
  slug: string | null;
  active: boolean;
  category_id: string | null;
  category_name: string | null;
  brand: string | null;
  price: number | null;
  sale_price: number | null;
  cost_price: number | null;
  min_margin_percent: number | null;
  b2b_enabled: boolean | null;
  b2b_price: number | null;
  b2b_min_qty: number | null;
} & {
  review: CommercialReviewResult;
};

export type CommercialReviewSummary = {
  totalActive: number;
  noCost: number;
  noPrice: number;
  negativeMargin: number;
  criticalMargin: number;
  attentionMargin: number;
  b2bCritical: number;
  b2bIncomplete: number;
  healthy: number;
  defaultMinMarginPercent: number;
};

export type CommercialReviewReport = {
  summary: CommercialReviewSummary;
  rows: CommercialReviewRow[];
  page: number;
  pageSize: number;
  total: number;
  filter: CommercialFilter;
  generatedAt: string;
};

export type CommercialFilterOptions = {
  categories: Array<{ id: string; name: string }>;
  brands: string[];
};

const inputSchema = z.object({
  filter: z
    .enum([
      'all',
      'no_cost',
      'no_price',
      'negative_margin',
      'critical_margin',
      'attention_margin',
      'b2b_critical',
      'b2b_incomplete',
      'healthy',
    ])
    .default('all'),
  search: z.string().trim().max(200).optional(),
  categoryId: z.string().uuid().optional(),
  brand: z.string().trim().max(100).optional(),
  page: z.number().int().min(1).max(500).default(1),
  pageSize: z.number().int().min(10).max(100).default(25),
});

const FILTER_TO_STATUS: Record<CommercialFilter, CommercialStatus | null> = {
  all: null,
  no_cost: 'no_cost',
  no_price: 'no_price',
  negative_margin: 'negative_margin',
  critical_margin: 'critical_margin',
  attention_margin: 'attention_margin',
  b2b_critical: 'b2b_critical',
  b2b_incomplete: 'b2b_incomplete',
  healthy: 'healthy',
};

async function loadDefaultMinMargin(): Promise<number> {
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data } = await supabaseAdmin
      .from('finance_settings')
      .select('default_min_margin_percent')
      .limit(1)
      .maybeSingle();
    const v = (data as { default_min_margin_percent?: number | string | null } | null)
      ?.default_min_margin_percent;
    const n = v == null ? NaN : Number(v);
    return Number.isFinite(n) && n > 0 ? n : 25;
  } catch {
    return 25;
  }
}

export const getCommercialReviewReport = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .inputValidator((data: unknown) => inputSchema.parse(data ?? {}))
  .handler(async ({ data }): Promise<CommercialReviewReport> => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const defaultMin = await loadDefaultMinMargin();

    let query = supabaseAdmin
      .from('products')
      .select(
        'id, name, sku, active, category_id, brand, price, sale_price, cost_price, min_margin_percent, b2b_enabled, b2b_price, b2b_min_qty, categories:category_id(name)',
      )
      .eq('active', true)
      .limit(2000);

    if (data.search) {
      const term = data.search.replace(/[%_,]/g, ' ').trim();
      if (term.length > 0) {
        query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
      }
    }
    if (data.categoryId) query = query.eq('category_id', data.categoryId);
    if (data.brand) query = query.eq('brand', data.brand);

    const { data: products, error } = await query;
    if (error) {
      throw new Error(`Falha ao carregar produtos: ${error.message}`);
    }

    const summary: CommercialReviewSummary = {
      totalActive: 0,
      noCost: 0,
      noPrice: 0,
      negativeMargin: 0,
      criticalMargin: 0,
      attentionMargin: 0,
      b2bCritical: 0,
      b2bIncomplete: 0,
      healthy: 0,
      defaultMinMarginPercent: defaultMin,
    };

    type Raw = {
      id: string;
      name: string | null;
      sku: string | null;
      active: boolean;
      category_id: string | null;
      brand: string | null;
      price: number | null;
      sale_price: number | null;
      cost_price: number | null;
      min_margin_percent: number | null;
      b2b_enabled: boolean | null;
      b2b_price: number | null;
      b2b_min_qty: number | null;
      categories: { name: string | null } | { name: string | null }[] | null;
    };

    const enriched: CommercialReviewRow[] = [];
    for (const raw of (products ?? []) as Raw[]) {
      summary.totalActive += 1;
      const review = computeCommercialReview(
        {
          id: raw.id,
          name: raw.name,
          sku: raw.sku,
          price: raw.price,
          sale_price: raw.sale_price,
          cost_price: raw.cost_price,
          min_margin_percent: raw.min_margin_percent,
          b2b_enabled: raw.b2b_enabled,
          b2b_price: raw.b2b_price,
          b2b_min_qty: raw.b2b_min_qty,
        },
        defaultMin,
      );
      // contadores: um produto pode somar em vários (ex.: sem custo + B2B incompleto)
      const codes = new Set(review.issues.map((i) => i.code));
      if (codes.has('no_cost')) summary.noCost += 1;
      if (codes.has('no_price')) summary.noPrice += 1;
      if (codes.has('negative_margin')) summary.negativeMargin += 1;
      if (codes.has('critical_margin')) summary.criticalMargin += 1;
      if (codes.has('attention_margin')) summary.attentionMargin += 1;
      if (codes.has('b2b_critical')) summary.b2bCritical += 1;
      if (
        codes.has('b2b_price_without_min_qty') ||
        codes.has('b2b_min_qty_without_price') ||
        codes.has('b2b_inconsistent')
      ) {
        summary.b2bIncomplete += 1;
      }
      if (review.status === 'healthy') summary.healthy += 1;

      const categoryName = Array.isArray(raw.categories)
        ? raw.categories[0]?.name ?? null
        : raw.categories?.name ?? null;

      enriched.push({
        id: raw.id,
        name: raw.name ?? '(sem nome)',
        sku: raw.sku,
        active: raw.active,
        category_id: raw.category_id,
        category_name: categoryName,
        brand: raw.brand,
        price: raw.price,
        sale_price: raw.sale_price,
        cost_price: raw.cost_price,
        min_margin_percent: raw.min_margin_percent,
        b2b_enabled: raw.b2b_enabled,
        b2b_price: raw.b2b_price,
        b2b_min_qty: raw.b2b_min_qty,
        review,
      });
    }

    // Filtro
    const targetStatus = FILTER_TO_STATUS[data.filter];
    let filtered = enriched;
    if (data.filter === 'b2b_incomplete') {
      filtered = enriched.filter((r) =>
        r.review.issues.some(
          (i) =>
            i.code === 'b2b_price_without_min_qty' ||
            i.code === 'b2b_min_qty_without_price' ||
            i.code === 'b2b_inconsistent',
        ),
      );
    } else if (data.filter === 'no_cost') {
      filtered = enriched.filter((r) => r.review.issues.some((i) => i.code === 'no_cost'));
    } else if (data.filter === 'no_price') {
      filtered = enriched.filter((r) => r.review.issues.some((i) => i.code === 'no_price'));
    } else if (data.filter === 'negative_margin') {
      filtered = enriched.filter((r) =>
        r.review.issues.some((i) => i.code === 'negative_margin'),
      );
    } else if (data.filter === 'critical_margin') {
      filtered = enriched.filter((r) =>
        r.review.issues.some((i) => i.code === 'critical_margin'),
      );
    } else if (data.filter === 'attention_margin') {
      filtered = enriched.filter((r) =>
        r.review.issues.some((i) => i.code === 'attention_margin'),
      );
    } else if (data.filter === 'b2b_critical') {
      filtered = enriched.filter((r) => r.review.issues.some((i) => i.code === 'b2b_critical'));
    } else if (targetStatus === 'healthy') {
      filtered = enriched.filter((r) => r.review.status === 'healthy');
    }

    // Ordenação: pior status primeiro, depois nome
    const STATUS_RANK: Record<CommercialStatus, number> = {
      negative_margin: 0,
      critical_margin: 1,
      b2b_critical: 2,
      no_price: 3,
      no_cost: 4,
      b2b_incomplete: 5,
      attention_margin: 6,
      healthy: 7,
    };
    filtered.sort((a, b) => {
      const r = STATUS_RANK[a.review.status] - STATUS_RANK[b.review.status];
      if (r !== 0) return r;
      return a.name.localeCompare(b.name, 'pt-BR');
    });

    const total = filtered.length;
    const start = (data.page - 1) * data.pageSize;
    const rows = filtered.slice(start, start + data.pageSize);

    return {
      summary,
      rows,
      page: data.page,
      pageSize: data.pageSize,
      total,
      filter: data.filter,
      generatedAt: new Date().toISOString(),
    };
  });

export const getCommercialReviewFilterOptions = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .handler(async (): Promise<CommercialFilterOptions> => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const [{ data: cats }, { data: brandsData }] = await Promise.all([
      supabaseAdmin.from('categories').select('id, name').order('name'),
      supabaseAdmin.from('products').select('brand').eq('active', true).not('brand', 'is', null).limit(2000),
    ]);
    const brandSet = new Set<string>();
    for (const b of (brandsData ?? []) as Array<{ brand: string | null }>) {
      const v = (b.brand ?? '').trim();
      if (v) brandSet.add(v);
    }
    return {
      categories: ((cats ?? []) as Array<{ id: string; name: string }>).map((c) => ({
        id: c.id,
        name: c.name,
      })),
      brands: Array.from(brandSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    };
  });

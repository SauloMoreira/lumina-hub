import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { expandSearchTerms, normalizeSearch } from '@/lib/searchNormalize';

// ----------------------------------------------------------------
// searchProducts — usado pela /catalogo (público)
// ----------------------------------------------------------------
const searchInput = z.object({
  q: z.string().max(200).optional(),
  categorySlug: z.string().max(120).optional(),
  brand: z.string().max(120).optional(),
  priceMin: z.number().min(0).max(999999).optional(),
  priceMax: z.number().min(0).max(999999).optional(),
  inStock: z.boolean().optional(),
  onSale: z.boolean().optional(),
  freeShipping: z.boolean().optional(),
  sort: z
    .enum(['relevance', 'featured', 'price_asc', 'price_desc', 'newest', 'best_sellers'])
    .optional(),
  page: z.number().int().min(1).max(500).optional(),
  pageSize: z.number().int().min(1).max(48).optional(),
  source: z.enum(['public_store', 'admin', 'b2b_store']).optional(),
});

export const searchProducts = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => searchInput.parse(input))
  .handler(async ({ data }) => {
    const pageSize = data.pageSize ?? 24;
    const page = data.page ?? 1;
    const offset = (page - 1) * pageSize;

    const terms = data.q ? expandSearchTerms(data.q) : null;

    let categoryId: string | null = null;
    if (data.categorySlug) {
      const { data: cat } = await supabaseAdmin
        .from('categories')
        .select('id')
        .eq('slug', data.categorySlug)
        .maybeSingle();
      categoryId = cat?.id ?? null;
    }

    const { data: rows, error } = await (supabaseAdmin as any).rpc('search_products_public', {
      _terms: terms,
      _category_id: categoryId,
      _brand: data.brand ?? null,
      _price_min: data.priceMin ?? null,
      _price_max: data.priceMax ?? null,
      _in_stock: data.inStock ?? null,
      _on_sale: data.onSale ?? null,
      _free_shipping: data.freeShipping ?? null,
      _sort: data.sort ?? 'relevance',
      _limit: pageSize,
      _offset: offset,
    });

    if (error) {
      console.error('[searchProducts] RPC error', error);
      throw new Error('Falha ao buscar produtos');
    }

    const total = Number((rows?.[0] as any)?.total_count ?? 0);
    const products = (rows ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      price: Number(r.price),
      sale_price: r.sale_price != null ? Number(r.sale_price) : null,
      stock_qty: r.stock_qty,
      brand: r.brand,
      tags: r.tags ?? [],
      images: r.images ?? [],
      featured: !!r.featured,
      free_shipping_eligible: !!r.free_shipping_eligible,
      category_id: r.category_id,
    }));

    // Log de buscas sem resultado (best-effort, não bloqueia)
    if (data.q && data.q.trim().length >= 2 && total === 0) {
      try {
        await supabaseAdmin.from('search_logs').insert({
          search_term: data.q.trim().slice(0, 200),
          normalized_term: normalizeSearch(data.q).slice(0, 200) || data.q.slice(0, 200),
          results_count: 0,
          source: data.source ?? 'public_store',
        });
      } catch (e) {
        console.warn('[searchProducts] failed to log empty search', e);
      }
    }

    return { products, total, page, pageSize };
  });

// ----------------------------------------------------------------
// autocompleteSearch — usado pelo Header (debounce no client)
// ----------------------------------------------------------------
const autocompleteInput = z.object({
  q: z.string().min(2).max(80),
});

export const autocompleteSearch = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => autocompleteInput.parse(input))
  .handler(async ({ data }) => {
    const terms = expandSearchTerms(data.q);
    if (!terms.length) return { suggestions: [] as Array<any> };

    const { data: rows, error } = await (supabaseAdmin as any).rpc('autocomplete_products_public', {
      _terms: terms,
      _limit: 6,
    });

    if (error) {
      console.error('[autocompleteSearch] RPC error', error);
      return { suggestions: [] as Array<any> };
    }

    const suggestions = (rows ?? []).map((r: any) => ({
      kind: r.kind as 'product' | 'category',
      id: r.id,
      name: r.name,
      slug: r.slug,
      brand: r.brand,
      image: r.image,
      price: r.price != null ? Number(r.price) : null,
      sale_price: r.sale_price != null ? Number(r.sale_price) : null,
    }));

    return { suggestions };
  });

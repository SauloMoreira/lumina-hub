import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { z } from 'zod';
import { StoreLayout } from '@/components/layout/StoreLayout';
import { ProductCard } from '@/components/store/ProductCard';
import { ProductCardSkeleton } from '@/components/ui/shimmer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { Product, Category } from '@/lib/domain';
import { FREE_SHIPPING_THRESHOLD, formatBRL } from '@/lib/domain';
import { trackSearch } from '@/lib/tracking';
import { imageUrlsFromProductImages } from '@/lib/productImages';

const PAGE_SIZE = 24;

const searchSchema = z.object({
  cat: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(['featured', 'price_asc', 'price_desc', 'newest', 'best_sellers']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  oferta: z.coerce.boolean().optional(),
  shipping: z.enum(['free']).optional(),
});

import { buildSeo } from '@/lib/seo';

export const Route = createFileRoute('/catalogo')({
  validateSearch: searchSchema,
  head: () => buildSeo({
    title: 'Catálogo de Produtos — Material Elétrico e LED',
    description: 'Explore nosso catálogo completo de material elétrico e iluminação LED. Filtros por categoria, preço e marca. Entrega para todo o Brasil.',
    url: '/catalogo',
  }),
  component: CatalogPage,
});

function CatalogPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [q, setQ] = useState(search.q ?? '');
  const page = search.page ?? 1;

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    staleTime: 1000 * 60 * 60, // 1h
    queryFn: async () => {
      const { data } = await supabase
        .from('categories')
        .select('id, name, slug, icon, sort_order')
        .eq('active', true)
        .order('sort_order');
      return (data ?? []) as Category[];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['products', 'catalog', search.cat, search.sort, page, search.oferta, search.shipping],
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    enabled: !search.cat || !!categories,
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from('products')
        .select('id, name, slug, price, sale_price, images, brand, tags, stock_qty, featured, free_shipping_eligible, category_id, product_images(url_thumb, url_card, original_url, is_primary, sort_order)', { count: 'exact' })
        .eq('active', true);
      if (search.cat) {
        const cat = categories?.find((c) => c.slug === search.cat);
        if (cat) query = query.eq('category_id', cat.id);
      }
      if (search.oferta) {
        query = query.not('sale_price', 'is', null);
      }
      if (search.shipping === 'free') {
        query = query.eq('free_shipping_eligible', true);
      }
      if (search.sort === 'best_sellers') {
        // Sem histórico de vendas: tratamos "destaques" como produtos marcados featured.
        query = query.eq('featured', true);
      }
      if (search.sort === 'price_asc') query = query.order('price', { ascending: true });
      else if (search.sort === 'price_desc') query = query.order('price', { ascending: false });
      else if (search.sort === 'newest') query = query.order('created_at', { ascending: false });
      else if (search.sort === 'best_sellers') query = query.order('updated_at', { ascending: false });
      else query = query.order('featured', { ascending: false }).order('created_at', { ascending: false });

      if (search.oferta) {
        const { data, error } = await query;
        if (error) throw error;
        const offerProducts = (data ?? [])
          .map((p: any) => ({ ...p, images: imageUrlsFromProductImages(p.product_images, p.images) }))
          .filter((p: Product) => p.sale_price != null && Number(p.sale_price) < Number(p.price)) as Product[];
        return { products: offerProducts.slice(from, to + 1), total: offerProducts.length };
      }

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
      const products = (data ?? []).map((p: any) => ({ ...p, images: imageUrlsFromProductImages(p.product_images, p.images) })) as Product[];
      return { products, total: count ?? 0 };
    },
  });

  const products = data?.products ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filtered = useMemo(() => {
    const term = (search.q ?? '').toLowerCase().trim();
    if (!term) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(term) || p.brand?.toLowerCase().includes(term) || p.tags.some((t) => t.toLowerCase().includes(term))
    );
  }, [products, search.q]);

  const goPage = (p: number) => navigate({ search: (s: any) => ({ ...s, page: p }) as any });

  const pageTitle = search.oferta
    ? 'Ofertas da semana'
    : search.shipping === 'free'
    ? 'Produtos elegíveis a frete grátis'
    : search.sort === 'best_sellers'
    ? 'Destaques da loja'
    : search.cat
    ? categories?.find((c) => c.slug === search.cat)?.name ?? 'Produtos'
    : 'Todos os produtos';

  const pageSubtitle = search.oferta
    ? 'Produtos com desconto ativo'
    : search.shipping === 'free'
    ? `Frete grátis para compras acima de ${formatBRL(FREE_SHIPPING_THRESHOLD)} em produtos participantes.`
    : search.sort === 'best_sellers'
    ? 'Os produtos mais procurados pelos nossos clientes.'
    : null;

  const hasActiveFilters = !!(search.cat || search.oferta || search.shipping || search.sort || search.q);

  const clearFilters = () => navigate({ search: {} as any });

  return (
    <StoreLayout>
      <div className="bg-card border-b border-border">
        <div className="container mx-auto px-4 py-8">
          <div className="label-meta mb-2">Catálogo</div>
          <h1 className="font-display font-bold text-3xl tracking-tight mb-2">{pageTitle}</h1>
          {pageSubtitle && <p className="text-sm text-muted-foreground mb-4">{pageSubtitle}</p>}

          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {search.oferta && (
                <button onClick={() => navigate({ search: (s: any) => ({ ...s, oferta: undefined, page: 1 }) as any })} className="inline-flex items-center gap-1.5 text-xs bg-accent/10 text-accent-foreground px-2.5 py-1 rounded-full hover:bg-accent/20">
                  Oferta <X className="w-3 h-3" />
                </button>
              )}
              {search.shipping === 'free' && (
                <button onClick={() => navigate({ search: (s: any) => ({ ...s, shipping: undefined, page: 1 }) as any })} className="inline-flex items-center gap-1.5 text-xs bg-accent/10 text-accent-foreground px-2.5 py-1 rounded-full hover:bg-accent/20">
                  Frete grátis <X className="w-3 h-3" />
                </button>
              )}
              {search.sort === 'best_sellers' && (
                <button onClick={() => navigate({ search: (s: any) => ({ ...s, sort: undefined, page: 1 }) as any })} className="inline-flex items-center gap-1.5 text-xs bg-accent/10 text-accent-foreground px-2.5 py-1 rounded-full hover:bg-accent/20">
                  Destaques <X className="w-3 h-3" />
                </button>
              )}
              {search.cat && (
                <button onClick={() => navigate({ search: (s: any) => ({ ...s, cat: undefined, page: 1 }) as any })} className="inline-flex items-center gap-1.5 text-xs bg-primary-tint text-primary px-2.5 py-1 rounded-full hover:bg-primary/10">
                  {categories?.find((c) => c.slug === search.cat)?.name ?? search.cat} <X className="w-3 h-3" />
                </button>
              )}
              {search.q && (
                <button onClick={() => { setQ(''); navigate({ search: (s: any) => ({ ...s, q: undefined, page: 1 }) as any }); }} className="inline-flex items-center gap-1.5 text-xs bg-surface px-2.5 py-1 rounded-full hover:bg-muted">
                  "{search.q}" <X className="w-3 h-3" />
                </button>
              )}
              <button onClick={clearFilters} className="text-xs text-muted-foreground underline hover:text-foreground ml-1">
                Limpar filtros
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => { e.preventDefault(); if (q) trackSearch(q); navigate({ search: (s: any) => ({ ...s, q: q || undefined, page: 1 }) as any }); }}
            className="max-w-md"
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-faint" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..." className="pl-11 h-11 rounded-pill bg-surface" />
            </div>
          </form>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-64 shrink-0">
            <div className="bg-card border border-border rounded-xl p-5 sticky top-20">
              <div className="flex items-center gap-2 mb-4">
                <SlidersHorizontal className="w-4 h-4 text-primary" />
                <h3 className="font-display font-semibold text-sm">Categorias</h3>
              </div>
              <ul className="space-y-1">
                <li>
                  <button
                    onClick={() => navigate({ search: (s: any) => ({ ...s, cat: undefined, page: 1 }) as any })}
                    className={`w-full text-left text-sm px-3 py-2 rounded-md transition-colors ${!search.cat ? 'bg-primary-tint text-primary font-medium' : 'hover:bg-surface text-muted-foreground'}`}
                  >
                    Todas
                  </button>
                </li>
                {categories?.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => navigate({ search: (s: any) => ({ ...s, cat: c.slug, page: 1 }) as any })}
                      className={`w-full text-left text-sm px-3 py-2 rounded-md transition-colors ${search.cat === c.slug ? 'bg-primary-tint text-primary font-medium' : 'hover:bg-surface text-muted-foreground'}`}
                    >
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <div className="flex-1">
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm text-muted-foreground">
                {isLoading ? 'Carregando...' : `${total} produtos · página ${page} de ${totalPages}`}
              </p>
              <select
                value={search.sort ?? 'featured'}
                onChange={(e) => navigate({ search: (s: any) => ({ ...s, sort: e.target.value as any, page: 1 }) as any })}
                className="text-sm border border-border rounded-md px-3 py-1.5 bg-card focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="featured">Mais relevantes</option>
                <option value="price_asc">Menor preço</option>
                <option value="price_desc">Maior preço</option>
                <option value="newest">Novidades</option>
              </select>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground space-y-3">
                <p>
                  {search.oferta
                    ? 'Nenhuma oferta disponível no momento. Volte em breve!'
                    : search.shipping === 'free'
                    ? 'Nenhum produto elegível a frete grátis no momento.'
                    : search.sort === 'best_sellers'
                    ? 'Nenhum produto em destaque no momento.'
                    : 'Nenhum produto encontrado.'}
                </p>
                {(search.oferta || search.shipping === 'free' || search.sort === 'best_sellers') && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>Ver todo o catálogo</Button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {filtered.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    <Button
                      variant="outline" size="sm"
                      disabled={page <= 1}
                      onClick={() => goPage(page - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" /> Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground px-3">{page} / {totalPages}</span>
                    <Button
                      variant="outline" size="sm"
                      disabled={page >= totalPages}
                      onClick={() => goPage(page + 1)}
                    >
                      Próxima <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}

import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { z } from 'zod';
import { StoreLayout } from '@/components/layout/StoreLayout';
import { ProductCard } from '@/components/store/ProductCard';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import type { Product, Category } from '@/lib/domain';

const searchSchema = z.object({
  cat: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(['featured', 'price_asc', 'price_desc', 'newest']).optional(),
});

export const Route = createFileRoute('/catalogo')({
  validateSearch: searchSchema,
  component: CatalogPage,
});

function CatalogPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [q, setQ] = useState(search.q ?? '');

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('*').eq('active', true).order('sort_order');
      return (data ?? []) as Category[];
    },
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', search.cat, search.sort],
    queryFn: async () => {
      let query = supabase.from('products').select('*, categories(slug)').eq('active', true);
      if (search.cat) {
        const cat = categories?.find((c) => c.slug === search.cat);
        if (cat) query = query.eq('category_id', cat.id);
      }
      if (search.sort === 'price_asc') query = query.order('price', { ascending: true });
      else if (search.sort === 'price_desc') query = query.order('price', { ascending: false });
      else if (search.sort === 'newest') query = query.order('created_at', { ascending: false });
      else query = query.order('featured', { ascending: false }).order('created_at', { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
    enabled: !search.cat || !!categories,
  });

  const filtered = useMemo(() => {
    if (!products) return [];
    const term = (search.q ?? '').toLowerCase().trim();
    if (!term) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(term) || p.brand?.toLowerCase().includes(term) || p.tags.some((t) => t.toLowerCase().includes(term))
    );
  }, [products, search.q]);

  return (
    <StoreLayout>
      {/* Cabeçalho */}
      <div className="bg-card border-b border-border">
        <div className="container mx-auto px-4 py-8">
          <div className="label-meta mb-2">Catálogo completo</div>
          <h1 className="font-display font-bold text-3xl tracking-tight mb-4">
            {search.cat ? categories?.find((c) => c.slug === search.cat)?.name ?? 'Produtos' : 'Todos os produtos'}
          </h1>
          <form
            onSubmit={(e) => { e.preventDefault(); navigate({ search: (s: any) => ({ ...s, q: q || undefined }) as any }); }}
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
          {/* Sidebar */}
          <aside className="lg:w-64 shrink-0">
            <div className="bg-card border border-border rounded-xl p-5 sticky top-20">
              <div className="flex items-center gap-2 mb-4">
                <SlidersHorizontal className="w-4 h-4 text-primary" />
                <h3 className="font-display font-semibold text-sm">Categorias</h3>
              </div>
              <ul className="space-y-1">
                <li>
                  <button
                    onClick={() => navigate({ search: (s: any) => ({ ...s, cat: undefined }) as any })}
                    className={`w-full text-left text-sm px-3 py-2 rounded-md transition-colors ${!search.cat ? 'bg-primary-tint text-primary font-medium' : 'hover:bg-surface text-muted-foreground'}`}
                  >
                    Todas
                  </button>
                </li>
                {categories?.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => navigate({ search: (s: any) => ({ ...s, cat: c.slug }) as any })}
                      className={`w-full text-left text-sm px-3 py-2 rounded-md transition-colors ${search.cat === c.slug ? 'bg-primary-tint text-primary font-medium' : 'hover:bg-surface text-muted-foreground'}`}
                    >
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Grid */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm text-muted-foreground">{isLoading ? 'Carregando...' : `${filtered.length} produtos`}</p>
              <select
                value={search.sort ?? 'featured'}
                onChange={(e) => navigate({ search: (s: any) => ({ ...s, sort: e.target.value as any }) as any })}
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
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="aspect-[3/4] bg-surface rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <p>Nenhum produto encontrado.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {filtered.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}

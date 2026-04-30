import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Package, ChevronRight } from 'lucide-react';
import { listPublicBundlesByProduct } from '@/server/productBundles.functions';
import { formatBRL } from '@/lib/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const MAX_VISIBLE = 4;

function availabilityLabel(a: string): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  switch (a) {
    case 'available':
      return { label: 'Disponível', variant: 'default' };
    case 'partial':
      return { label: 'Parcialmente disponível', variant: 'secondary' };
    case 'unavailable':
      return { label: 'Indisponível', variant: 'destructive' };
    default:
      return { label: 'Em revisão', variant: 'outline' };
  }
}

export function ProductInBundlesBlock({ productId }: { productId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['product-in-bundles', productId, MAX_VISIBLE],
    queryFn: () =>
      listPublicBundlesByProduct({ data: { productId, limit: MAX_VISIBLE } }),
    staleTime: 60_000,
  });

  if (isLoading) return null;
  const bundles = data ?? [];
  if (bundles.length === 0) return null;

  return (
    <section
      aria-labelledby="product-in-bundles-heading"
      className="mt-10 border-t border-border pt-8"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" aria-hidden />
          <h2
            id="product-in-bundles-heading"
            className="text-xl font-semibold text-foreground"
          >
            Faz parte de um kit
          </h2>
        </div>
        {bundles.length >= MAX_VISIBLE ? (
          <Button asChild variant="ghost" size="sm">
            <Link to="/combos">
              Ver todos os kits
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bundles.map((b) => {
          const av = availabilityLabel(b.availability);
          return (
            <article
              key={b.id}
              className="flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-md"
            >
              <Link
                to="/combo/$slug"
                params={{ slug: b.slug ?? '' }}
                className="block aspect-video w-full overflow-hidden bg-muted"
              >
                {b.image_url ? (
                  <img
                    src={b.image_url}
                    alt={b.name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <Package className="h-10 w-10" aria-hidden />
                  </div>
                )}
              </Link>

              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 text-sm font-semibold text-foreground">
                    {b.name}
                  </h3>
                  <Badge variant={av.variant} className="shrink-0 text-[10px]">
                    {av.label}
                  </Badge>
                </div>
                {b.description ? (
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {b.description}
                  </p>
                ) : null}
                <div className="mt-1 text-xs text-muted-foreground">
                  {b.items_count} {b.items_count === 1 ? 'item' : 'itens'}
                </div>
                <div className="text-sm font-medium text-foreground">
                  Subtotal estimado: {formatBRL(b.subtotal)}
                </div>
                <Button asChild size="sm" className="mt-2 w-full">
                  <Link to="/combo/$slug" params={{ slug: b.slug ?? '' }}>
                    Ver kit
                  </Link>
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

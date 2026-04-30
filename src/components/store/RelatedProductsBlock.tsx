import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ShoppingBag, BadgePercent, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { getRelationsForProduct, type RelatedProduct, type RelationType } from '@/server/productRelations.functions';
import { useCart } from '@/stores/cartStore';
import { formatBRL } from '@/lib/domain';
import { trackAddToCart } from '@/lib/tracking';

type Props = {
  productId: string;
  /** Não sugerir esses produtos (ex.: itens já no carrinho ou o próprio produto) */
  excludeProductIds?: string[];
  /** Tipos a exibir; default = todos os tipos com label útil */
  types?: RelationType[];
  /** Limite total a buscar do servidor */
  limit?: number;
};

const SECTION_LABEL: Partial<Record<RelationType, { title: string; subtitle?: string }>> = {
  frequently_bought_together: { title: 'Compre junto', subtitle: 'Combinações populares com este produto' },
  accessory: { title: 'Você também pode precisar', subtitle: 'Acessórios e complementos' },
  cross_sell: { title: 'Você também pode precisar', subtitle: 'Itens complementares' },
  related: { title: 'Produtos relacionados', subtitle: 'Outras opções para você comparar' },
  replacement: { title: 'Produtos relacionados', subtitle: 'Alternativas equivalentes' },
  upsell: { title: 'Produtos relacionados' },
  b2b_recommendation: { title: 'Recomendado para empresas' },
};

const SECTION_ORDER: RelationType[] = [
  'frequently_bought_together',
  'accessory',
  'cross_sell',
  'related',
  'replacement',
  'upsell',
  'b2b_recommendation',
];

function mergeIntoSection(rel: RelationType): RelationType {
  // Agrupa cross_sell+accessory e replacement+related para uma UX mais limpa
  if (rel === 'cross_sell') return 'accessory';
  if (rel === 'replacement') return 'related';
  if (rel === 'upsell') return 'related';
  return rel;
}

export function RelatedProductsBlock({ productId, excludeProductIds = [], types, limit = 16 }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['product-relations', productId, limit],
    queryFn: () => getRelationsForProduct({ data: { productId, limit } }),
    staleTime: 60_000,
  });

  if (isLoading || !data || data.length === 0) return null;

  const exclude = new Set(excludeProductIds);
  const filtered = data.filter((r) => !exclude.has(r.product_id) && r.applied_price > 0);
  if (filtered.length === 0) return null;

  // Agrupa por seção
  const bySection = new Map<RelationType, RelatedProduct[]>();
  for (const r of filtered) {
    if (types && !types.includes(r.relation_type)) continue;
    const key = mergeIntoSection(r.relation_type);
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key)!.push(r);
  }

  if (bySection.size === 0) return null;

  return (
    <div className="space-y-10">
      {SECTION_ORDER.filter((t) => bySection.has(t)).map((sectionType) => {
        const items = bySection.get(sectionType)!.slice(0, 8);
        const label = SECTION_LABEL[sectionType] ?? { title: 'Produtos relacionados' };
        return (
          <RelatedSection
            key={sectionType}
            title={label.title}
            subtitle={label.subtitle}
            items={items}
          />
        );
      })}
    </div>
  );
}

function RelatedSection({ title, subtitle, items }: { title: string; subtitle?: string; items: RelatedProduct[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <div className="mb-3">
        <h2 className="font-display font-bold text-xl">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {items.map((p) => (
          <RelatedCard key={p.relation_id} item={p} />
        ))}
      </div>
    </section>
  );
}

function RelatedCard({ item }: { item: RelatedProduct }) {
  const cart = useCart();
  const isB2b = item.pricing_source === 'b2b';
  const retail = item.sale_price ?? item.retail_price;
  const showStrike = isB2b && retail > item.applied_price;
  const outOfStock = item.stock_qty <= 0;

  const handleAdd = () => {
    if (outOfStock) return;
    cart.addItem({
      productId: item.product_id,
      name: item.name,
      slug: item.slug,
      price: item.applied_price, // server vai recalcular B2B no checkout
      image: item.image,
      stock: item.stock_qty,
      freeShippingEligible: item.free_shipping_eligible,
    });
    trackAddToCart(
      { id: item.product_id, name: item.name, price: item.applied_price, brand: item.brand ?? undefined } as any,
      1,
    );
    toast.success('Adicionado ao carrinho');
  };

  return (
    <div className="group bg-card border border-border rounded-xl overflow-hidden flex flex-col hover:border-primary/40 transition">
      <Link to="/produto/$slug" params={{ slug: item.slug }} className="block aspect-square bg-surface relative">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-faint">
            <ShoppingBag className="w-10 h-10" />
          </div>
        )}
        {isB2b && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-success text-success-foreground text-[10px] font-semibold px-2 py-0.5 shadow-sm">
            <BadgePercent className="w-3 h-3" /> Empresa
          </span>
        )}
      </Link>
      <div className="p-3 flex-1 flex flex-col gap-2">
        {item.brand && <div className="text-[10px] uppercase tracking-wider text-text-faint">{item.brand}</div>}
        <Link
          to="/produto/$slug"
          params={{ slug: item.slug }}
          className="text-sm font-medium leading-tight line-clamp-2 hover:text-primary"
        >
          {item.name}
        </Link>
        <div className="mt-auto">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="font-display font-bold text-primary text-base">{formatBRL(item.applied_price)}</span>
            {showStrike && (
              <span className="text-[11px] text-text-faint line-through">{formatBRL(retail)}</span>
            )}
          </div>
          {isB2b && item.b2b_min_quantity && item.b2b_min_quantity > 1 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">A partir de {item.b2b_min_quantity} un.</p>
          )}
        </div>
        <button
          onClick={handleAdd}
          disabled={outOfStock}
          className="mt-1 h-9 rounded-pill bg-accent text-accent-foreground text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" />
          {outOfStock ? 'Indisponível' : 'Adicionar'}
        </button>
      </div>
    </div>
  );
}

import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Minus, Plus, ShoppingCart, Truck, Shield, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { StoreLayout } from '@/components/layout/StoreLayout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/lib/domain';
import { formatBRL } from '@/lib/domain';
import { useCart } from '@/stores/cartStore';
import { buildSeo, SITE_URL, clamp } from '@/lib/seo';
import { trackViewProduct, trackAddToCart } from '@/lib/tracking';
import { ProductImageCarousel } from '@/components/store/ProductImageCarousel';
import { pickUrl, type ProductImageRow } from '@/lib/productImages';

type FaqItem = { question: string; answer: string };
type ProductWithSeo = Product & {
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
  specs?: Record<string, unknown> | null;
};

function extractFaq(specs: Record<string, unknown> | null | undefined): FaqItem[] {
  const raw = specs && typeof specs === 'object' ? (specs as Record<string, unknown>).seo_faq : null;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is FaqItem => !!x && typeof x === 'object' && typeof (x as FaqItem).question === 'string' && typeof (x as FaqItem).answer === 'string')
    .slice(0, 6);
}

function buildProductJsonLd(p: ProductWithSeo, finalPrice: number, baseDesc: string, allImageUrls: string[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: baseDesc,
    sku: p.sku ?? undefined,
    mpn: p.ncm ?? undefined,
    brand: { '@type': 'Brand', name: p.brand || 'Led Maricá' },
    image: allImageUrls,
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}/produto/${p.slug}`,
      priceCurrency: 'BRL',
      price: finalPrice,
      priceValidUntil: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      availability: p.stock_qty > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Organization', name: 'Led Maricá' },
    },
  };
}

function buildFaqJsonLd(faq: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

const productQueryOptions = (slug: string) => ({
  queryKey: ['product', slug],
  queryFn: async () => {
    const { data, error } = await supabase.from('products').select('*').eq('slug', slug).eq('active', true).maybeSingle();
    if (error) throw error;
    if (!data) throw notFound();
    const { data: imgs } = await supabase
      .from('product_images')
      .select('*')
      .eq('product_id', (data as { id: string }).id)
      .order('is_primary', { ascending: false })
      .order('sort_order', { ascending: true });
    return { ...(data as ProductWithSeo), product_images: (imgs ?? []) as ProductImageRow[] };
  },
});

export const Route = createFileRoute('/produto/$slug')({
  loader: async ({ params, context }) => {
    const product = await context.queryClient.ensureQueryData(productQueryOptions(params.slug));
    return { product };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.product;
    if (!p) return buildSeo({ title: 'Produto', url: '/catalogo' });
    const finalPrice = p.sale_price ?? p.price;
    const baseDesc = p.description?.trim() || `${p.name} — disponível na Led Maricá com entrega rápida em Maricá/RJ. Frete grátis acima de R$199.`;
    const description = clamp(p.seo_description || baseDesc, 160);
    const title = p.seo_title || `${p.name}${p.brand ? ' — ' + p.brand : ''}`;
    const productImages = p.product_images ?? [];
    const allImageUrls = productImages.length
      ? productImages.map((i) => pickUrl(i, 'full') ?? i.original_url).filter((u): u is string => !!u)
      : (p.images ?? []);
    const ogPrimary = productImages.find((i) => i.is_primary) ?? productImages[0];
    const image = ogPrimary ? pickUrl(ogPrimary, 'og') ?? ogPrimary.original_url : allImageUrls[0];

    const seo = buildSeo({
      title,
      description,
      url: `/produto/${p.slug}`,
      image: image ?? undefined,
      type: 'product',
      product: {
        price: finalPrice,
        availability: p.stock_qty > 0 ? 'InStock' : 'OutOfStock',
        sku: p.sku,
        brand: p.brand,
      },
    });

    if (p.seo_keywords) seo.meta.push({ name: 'keywords', content: p.seo_keywords });

    const productJsonLd = JSON.stringify(buildProductJsonLd(p, finalPrice, baseDesc, allImageUrls));

    const faq = extractFaq(p.specs);
    const scripts: Array<{ type: string; children: string }> = [
      { type: 'application/ld+json', children: productJsonLd },
    ];
    if (faq.length > 0) {
      scripts.push({
        type: 'application/ld+json',
        children: JSON.stringify(buildFaqJsonLd(faq)),
      });
    }

    return { meta: seo.meta, links: seo.links, scripts };
  },
  component: ProductPage,
  notFoundComponent: () => (
    <StoreLayout>
      <div className="container mx-auto px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-bold mb-2">Produto não encontrado</h1>
        <Link to="/catalogo" className="text-primary hover:underline">Voltar ao catálogo</Link>
      </div>
    </StoreLayout>
  ),
});

function ProductPage() {
  const { slug } = Route.useParams();
  const cart = useCart();
  const [qty, setQty] = useState(1);

  const { data: product, isLoading } = useQuery(productQueryOptions(slug));

  useEffect(() => {
    if (product) trackViewProduct(product);
  }, [product]);

  if (isLoading) {
    return <StoreLayout><div className="container mx-auto px-4 py-12"><div className="h-96 bg-surface animate-pulse rounded-xl" /></div></StoreLayout>;
  }
  if (!product) return null;

  const finalPrice = product.sale_price ?? product.price;
  const hasDiscount = product.sale_price != null && product.sale_price < product.price;
  const productImages = (product as ProductWithSeo & { product_images?: ProductImageRow[] }).product_images ?? [];
  const cartImage = productImages[0] ? pickUrl(productImages[0], 'thumb') ?? productImages[0].original_url : product.images[0] ?? null;

  const addToCart = () => {
    cart.addItem({
      productId: product.id, name: product.name, slug: product.slug,
      price: finalPrice, image: cartImage, stock: product.stock_qty,
    }, qty);
    trackAddToCart(product, qty);
    toast.success('Adicionado ao carrinho');
  };

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-6">
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
          <Link to="/" className="hover:text-foreground">Início</Link>
          <ChevronRight className="w-3 h-3" />
          <Link to="/catalogo" className="hover:text-foreground">Catálogo</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground">{product.name}</span>
        </nav>

        <div className="grid lg:grid-cols-2 gap-10">
          {/* Galeria de imagens */}
          <ProductImageCarousel
            images={(product as ProductWithSeo & { product_images?: ProductImageRow[] }).product_images ?? []}
            productName={product.name}
          />

          {/* Detalhes */}
          <div>
            {product.brand && <div className="label-meta mb-2">{product.brand}</div>}
            <h1 className="font-display font-bold text-3xl tracking-tight mb-3">{product.name}</h1>

            <div className="flex flex-wrap gap-1.5 mb-5">
              {product.ncm && <span className="badge-tech">NCM {product.ncm}</span>}
              {product.sku && <span className="badge-tech">SKU {product.sku}</span>}
              {product.tags.map((t) => (
                <span key={t} className="text-[10px] uppercase tracking-wider bg-surface text-muted-foreground border border-border px-2 py-1 rounded">{t}</span>
              ))}
            </div>

            <div className="bg-card border border-border rounded-xl p-6 mb-5">
              {hasDiscount && (
                <div className="text-sm text-muted-foreground line-through mb-1">{formatBRL(product.price)}</div>
              )}
              <div className="font-display font-extrabold text-primary text-4xl mb-1">{formatBRL(finalPrice)}</div>
              <div className="text-xs text-muted-foreground mb-5">
                ou até <strong>12x de {formatBRL(finalPrice / 12)}</strong> sem juros
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="inline-flex items-center border border-border rounded-md">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-9 h-9 hover:bg-surface flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button>
                  <span className="w-12 text-center text-sm font-medium">{qty}</span>
                  <button onClick={() => setQty(Math.min(product.stock_qty, qty + 1))} className="w-9 h-9 hover:bg-surface flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>
                </div>
                <span className="text-xs text-muted-foreground">{product.stock_qty} disponíveis</span>
              </div>

              <Button onClick={addToCart} disabled={product.stock_qty === 0} size="lg" className="w-full h-12 text-base">
                <ShoppingCart className="w-5 h-5 mr-2" />
                {product.stock_qty === 0 ? 'Esgotado' : 'Adicionar ao carrinho'}
              </Button>
            </div>

            {/* Garantias */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="flex items-center gap-2.5 text-xs">
                <div className="w-9 h-9 rounded-md bg-primary-tint flex items-center justify-center"><Truck className="w-4 h-4 text-primary" /></div>
                <span className="text-muted-foreground">Frete grátis acima de R$199</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs">
                <div className="w-9 h-9 rounded-md bg-primary-tint flex items-center justify-center"><Shield className="w-4 h-4 text-primary" /></div>
                <span className="text-muted-foreground">NF garantida em todos pedidos</span>
              </div>
            </div>

            {/* Descrição */}
            {product.description && (
              <div>
                <h2 className="font-display font-semibold text-base mb-2">Descrição</h2>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{product.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* FAQ gerado por IA — bom para SEO (FAQPage schema) */}
        {(() => {
          const faq = extractFaq(product.specs);
          if (faq.length === 0) return null;
          return (
            <section className="mt-12 max-w-3xl">
              <h2 className="font-display font-bold text-2xl mb-4">Perguntas frequentes</h2>
              <div className="divide-y divide-border border border-border rounded-xl bg-card">
                {faq.map((f, i) => (
                  <details key={i} className="group p-4">
                    <summary className="flex justify-between items-center cursor-pointer font-medium text-sm list-none">
                      <span>{f.question}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-90" />
                    </summary>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          );
        })()}
      </div>
    </StoreLayout>
  );
}

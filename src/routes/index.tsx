import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Sparkles, Truck, Shield, MessageSquareText, ArrowRight, Lightbulb, Zap, Cable, Plug, Sun, LayoutGrid, Wrench, Package, Tag, Flame, Star } from 'lucide-react';
import { StoreLayout } from '@/components/layout/StoreLayout';
import { ProductCard } from '@/components/store/ProductCard';
import { HeroCarousel, type HeroBanner } from '@/components/store/HeroCarousel';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { Product, Category } from '@/lib/domain';
import { FREE_SHIPPING_THRESHOLD, formatBRL } from '@/lib/domain';
import { imageUrlsFromProductImages } from '@/lib/productImages';
import logoHero from '@/assets/logo-hero.webp';

import { buildSeo } from '@/lib/seo';

export const Route = createFileRoute('/')({
  head: () => buildSeo({
    title: 'Material Elétrico e Iluminação LED em Maricá/RJ',
    description: 'Lâmpadas LED, disjuntores, cabos, refletores e tomadas com entrega rápida. Atendimento com IA 24h. Frete grátis acima de R$199.',
    url: '/',
  }),
  component: HomePage,
});

const ICONS: Record<string, any> = { Lightbulb, Zap, Cable, Plug, Sun, LayoutGrid, Wrench, Package };

const PRODUCT_LIST_COLS = 'id, name, slug, price, sale_price, images, brand, tags, stock_qty, featured, category_id, product_images(url_thumb, url_card, original_url, is_primary, sort_order)';

function normalizeProductImages<T extends { images?: string[] | null; product_images?: any[] }>(product: T) {
  return { ...product, images: imageUrlsFromProductImages(product.product_images, product.images) };
}

function HomePage() {
  const queryClient = useQueryClient();

  const { data: banners } = useQuery({
    queryKey: ['home-banners'],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('home_banners')
        .select('id, title, subtitle, description, image_desktop, image_mobile, cta_label, cta_link, badge, bg_color, text_color')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as HeroBanner[];
    },
  });

  const { data: featured } = useQuery({
    queryKey: ['products', 'featured'],
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_LIST_COLS)
        .eq('active', true).eq('featured', true).limit(8);
      if (error) throw error;
      return (data ?? []).map((p: any) => normalizeProductImages(p)) as Product[];
    },
  });

  const { data: deals } = useQuery({
    queryKey: ['products', 'deals'],
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_LIST_COLS)
        .eq('active', true)
        .gt('stock_qty', 0)
        .not('sale_price', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? [])
        .filter((p: any) => p.sale_price != null && p.sale_price < p.price)
        .map((p: any) => normalizeProductImages(p)) as Product[];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug, icon, sort_order')
        .eq('active', true).order('sort_order');
      if (error) throw error;
      return data as Category[];
    },
  });

  // Prefetch do catálogo (adiado até idle para não competir com LCP)
  useEffect(() => {
    const run = () => {
      queryClient.prefetchQuery({
        queryKey: ['products', 'catalog', undefined, undefined, 1],
        staleTime: 1000 * 60 * 10,
        queryFn: async () => {
          const { data, count } = await supabase
            .from('products')
            .select(PRODUCT_LIST_COLS, { count: 'exact' })
            .eq('active', true)
            .order('featured', { ascending: false })
            .order('created_at', { ascending: false })
            .range(0, 23);
          return { products: (data ?? []).map((p: any) => normalizeProductImages(p)) as Product[], total: count ?? 0 };
        },
      });
    };
    const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, opts?: { timeout: number }) => number);
    const cic = (window as any).cancelIdleCallback as undefined | ((id: number) => void);
    if (ric) {
      const id = ric(run, { timeout: 3000 });
      return () => cic && cic(id);
    }
    const t = window.setTimeout(run, 1500);
    return () => clearTimeout(t);
  }, [queryClient]);

  const PROMO_CARDS = [
    { icon: Flame, title: 'Ofertas da semana', desc: 'Descontos imperdíveis', to: '/catalogo', tone: 'from-orange-500 to-red-500' },
    { icon: Star, title: 'Mais vendidos', desc: 'O que está bombando', to: '/catalogo', tone: 'from-amber-400 to-yellow-500' },
    { icon: Truck, title: 'Frete grátis', desc: `Acima de ${formatBRL(FREE_SHIPPING_THRESHOLD)}`, to: '/catalogo', tone: 'from-emerald-500 to-teal-500' },
    { icon: Sparkles, title: 'Atendimento IA 24h', desc: 'Tire dúvidas técnicas', to: '/catalogo', tone: 'from-violet-500 to-indigo-500' },
  ];

  return (
    <StoreLayout>
      {/* CARROSSEL HERO PRINCIPAL */}
      {banners && banners.length > 0 && <HeroCarousel banners={banners} />}

      {/* CARDS PROMOCIONAIS DE APOIO */}
      <section className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PROMO_CARDS.map((c) => (
            <Link
              key={c.title}
              to={c.to as any}
              className="group relative overflow-hidden rounded-xl bg-card border border-border p-4 hover:shadow-elevated transition-all hover:-translate-y-0.5"
            >
              <div className={`absolute inset-0 opacity-10 group-hover:opacity-20 bg-gradient-to-br ${c.tone} transition-opacity`} />
              <div className="relative">
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${c.tone} flex items-center justify-center mb-3 shadow-md`}>
                  <c.icon className="w-4 h-4 text-white" />
                </div>
                <div className="font-display font-semibold text-sm leading-tight">{c.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{c.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* HERO INSTITUCIONAL (abaixo do carrossel, conforme escolhido) */}
      <section className="relative overflow-hidden bg-card border-y border-border">
        <div className="container mx-auto px-4 py-6 md:py-8 relative">
          <div className="max-w-3xl mx-auto text-center">
            <img src={logoHero} alt="Led Maricá" loading="eager" fetchPriority="high" decoding="async" width={240} height={88} className="w-full max-w-[200px] md:max-w-[240px] h-auto mx-auto mb-3" />
            <div className="inline-flex items-center gap-2 bg-primary-tint text-primary px-3 py-1 rounded-full text-xs font-medium mb-3">
              <Sparkles className="w-3.5 h-3.5" /> Atendimento com IA 24h · Entrega rápida em Maricá e região
            </div>
            <h1 className="font-display font-extrabold text-xl md:text-3xl leading-tight mb-2 tracking-tight text-foreground">
              Material elétrico e iluminação<br />
              <span className="text-primary">com qualidade que ilumina.</span>
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mb-4 max-w-xl mx-auto leading-relaxed">
              Lâmpadas LED, disjuntores, fios, refletores e tudo que seu projeto precisa.
              Nota fiscal garantida e suporte técnico de verdade.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button asChild size="lg" className="h-11 px-6 font-semibold">
                <Link to="/catalogo">Ver catálogo <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 px-6 border-primary/30 text-primary hover:bg-primary-tint hover:text-primary font-semibold">
                <Link to="/catalogo"><MessageSquareText className="w-4 h-4 mr-1.5" /> Falar com IA</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Banner frete grátis */}
        <div className="bg-accent text-accent-foreground py-3 text-center text-sm font-medium">
          🚚 <strong>Frete grátis</strong> em pedidos acima de {formatBRL(FREE_SHIPPING_THRESHOLD)}
        </div>
      </section>

      {/* DIFERENCIAIS */}
      <section className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Sparkles, title: 'IA 24h', desc: 'Atendimento inteligente sempre disponível' },
            { icon: Truck, title: 'Entrega Rápida', desc: 'Logística otimizada via Melhor Envio' },
            { icon: Shield, title: 'NF Garantida', desc: 'Nota fiscal em todos os pedidos' },
          ].map((d) => (
            <div key={d.title} className="bg-card border border-border rounded-xl p-5 flex items-center gap-4 shadow-soft">
              <div className="w-12 h-12 rounded-lg bg-primary-tint flex items-center justify-center shrink-0">
                <d.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-base mb-0.5">{d.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{d.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* OFERTAS DA SEMANA (produtos com sale_price) */}
      {deals && deals.length > 0 && (
        <section className="container mx-auto px-4 py-8">
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 text-accent-foreground mb-2">
                <Tag className="w-3.5 h-3.5 text-accent" />
                <span className="label-meta !text-accent">Promoção</span>
              </div>
              <h2 className="font-display font-bold text-2xl tracking-tight">Ofertas da semana</h2>
              <p className="text-sm text-muted-foreground mt-1">Produtos com desconto direto no preço</p>
            </div>
            <Link to="/catalogo" className="text-sm text-primary hover:underline font-medium hidden sm:inline-flex items-center gap-1">
              Ver todos <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {deals.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        </section>
      )}

      {/* CATEGORIAS */}
      <section className="container mx-auto px-4 py-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="label-meta mb-2">Categorias</div>
            <h2 className="font-display font-bold text-2xl tracking-tight">Encontre por departamento</h2>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {categories?.map((c) => {
            const Icon = ICONS[c.icon ?? 'Package'] ?? Package;
            return (
              <Link
                key={c.id}
                to="/catalogo"
                search={{ cat: c.slug } as any}
                className="group flex flex-col items-center text-center p-5 bg-card border border-border rounded-xl hover:border-primary hover:shadow-elevated transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-primary-tint flex items-center justify-center mb-3 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Icon className="w-5 h-5 text-primary group-hover:text-primary-foreground" />
                </div>
                <div className="text-xs font-medium leading-tight">{c.name}</div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* PRODUTOS DESTAQUE */}
      <section className="container mx-auto px-4 py-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="label-meta mb-2">Mais procurados</div>
            <h2 className="font-display font-bold text-2xl tracking-tight">Produtos em destaque</h2>
          </div>
          <Link to="/catalogo" className="text-sm text-primary hover:underline font-medium hidden sm:inline-flex items-center gap-1">
            Ver tudo <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {featured?.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </div>
      </section>

      {/* MARKETING / CONFIANÇA */}
      <section className="container mx-auto px-4 pb-12">
        <div className="rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground p-8 md:p-12 text-center shadow-elevated">
          <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-90" />
          <h3 className="font-display font-bold text-2xl md:text-3xl mb-3">A loja certa para o seu projeto</h3>
          <p className="text-sm md:text-base opacity-90 max-w-xl mx-auto mb-6 leading-relaxed">
            Nota fiscal garantida, suporte técnico de verdade, atendimento com IA 24h e entrega rápida em Maricá e região.
          </p>
          <Button asChild size="lg" variant="secondary" className="h-12 px-6 font-semibold">
            <Link to="/catalogo">Ver catálogo completo <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
          </Button>
        </div>
      </section>
    </StoreLayout>
  );
}

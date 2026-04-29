import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { Sparkles, Truck, Shield, MessageSquareText, ArrowRight, Lightbulb, Zap, Cable, Plug, Sun, LayoutGrid, Wrench, Package, Tag, Flame, Star } from 'lucide-react';
import { StoreLayout } from '@/components/layout/StoreLayout';
import { ProductCard } from '@/components/store/ProductCard';
import { HeroCarousel, type HeroBanner } from '@/components/store/HeroCarousel';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { Product, Category } from '@/lib/domain';
import { FREE_SHIPPING_THRESHOLD, formatBRL } from '@/lib/domain';
import { imageUrlsFromProductImages } from '@/lib/productImages';
import { fetchHomepageSettings, isPromoBarVisible } from '@/lib/homepageContent';
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

function getLucideIcon(name?: string | null, fallback: any = Sparkles) {
  if (!name) return fallback;
  const Comp = (LucideIcons as any)[name];
  return Comp ?? fallback;
}

function isExternalLink(url?: string | null) {
  if (!url) return false;
  return /^https?:\/\//i.test(url);
}

const PRODUCT_LIST_COLS = 'id, name, slug, price, sale_price, images, brand, tags, stock_qty, featured, category_id, product_images(url_thumb, url_card, original_url, is_primary, sort_order)';

function normalizeProductImages<T extends { images?: string[] | null; product_images?: any[] }>(product: T) {
  return { ...product, images: imageUrlsFromProductImages(product.product_images, product.images) };
}

function HomePage() {
  const queryClient = useQueryClient();

  const { data: homepage } = useQuery({
    queryKey: ['homepage_settings'],
    staleTime: 1000 * 60 * 5,
    queryFn: fetchHomepageSettings,
  });

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

  const PROMO_CARDS: Array<{
    icon: any; title: string; desc: string; tone: string;
    to?: string; searchParams?: Record<string, any>; onClick?: () => void;
  }> = [
    { icon: Flame, title: 'Ofertas da semana', desc: 'Descontos imperdíveis', to: '/catalogo', searchParams: { oferta: true }, tone: 'from-orange-500 to-red-500' },
    { icon: Star, title: 'Destaques da loja', desc: 'O que está bombando', to: '/catalogo', searchParams: { sort: 'best_sellers' }, tone: 'from-amber-400 to-yellow-500' },
    { icon: Truck, title: 'Frete grátis', desc: `Acima de ${formatBRL(FREE_SHIPPING_THRESHOLD)}`, to: '/catalogo', searchParams: { shipping: 'free' }, tone: 'from-emerald-500 to-teal-500' },
    { icon: Sparkles, title: 'Atendimento IA 24h', desc: 'Tire dúvidas técnicas', tone: 'from-violet-500 to-indigo-500', onClick: () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('open-chat')); } },
  ];

  return (
    <StoreLayout>
      {/* CARROSSEL HERO PRINCIPAL */}
      {banners && banners.length > 0 && <HeroCarousel banners={banners} />}

      {/* CARDS PROMOCIONAIS DE APOIO */}
      <section className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PROMO_CARDS.map((c) => {
            const inner = (
              <>
                <div className={`absolute inset-0 opacity-10 group-hover:opacity-20 bg-gradient-to-br ${c.tone} transition-opacity`} />
                <div className="relative">
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${c.tone} flex items-center justify-center mb-3 shadow-md`}>
                    <c.icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="font-display font-semibold text-sm leading-tight">{c.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{c.desc}</div>
                </div>
              </>
            );
            const cls = "group relative overflow-hidden rounded-xl bg-card border border-border p-4 hover:shadow-elevated transition-all hover:-translate-y-0.5 text-left";
            if (c.onClick) {
              return (
                <button key={c.title} type="button" onClick={c.onClick} className={cls}>
                  {inner}
                </button>
              );
            }
            return (
              <Link key={c.title} to={c.to as any} search={(c.searchParams ?? {}) as any} className={cls}>
                {inner}
              </Link>
            );
          })}
        </div>
      </section>

      {/* HERO INSTITUCIONAL (administrável via /admin/conteudo/homepage) */}
      {(homepage?.hero_is_active ?? true) && (() => {
        const HeroBadgeIcon = getLucideIcon(homepage?.hero_badge_icon, Sparkles);
        const PrimaryIcon = getLucideIcon(homepage?.hero_primary_button_icon, ArrowRight);
        const SecondaryIcon = getLucideIcon(homepage?.hero_secondary_button_icon, MessageSquareText);
        const heroTitle = homepage?.hero_title ?? 'Material elétrico e iluminação';
        const heroHighlight = homepage?.hero_highlight_text ?? 'com qualidade que ilumina.';
        const heroDesc = homepage?.hero_description ?? 'Lâmpadas LED, disjuntores, fios, refletores e tudo que seu projeto precisa.';
        const heroSub = homepage?.hero_subdescription ?? 'Nota fiscal garantida e suporte técnico de verdade.';
        const heroBadge = homepage?.hero_badge_text ?? 'Atendimento com IA 24h · Entrega rápida em Maricá e região';
        const logoSrc = homepage?.hero_logo_url || logoHero;
        const logoAlt = homepage?.hero_logo_alt || 'Led Maricá';
        const primaryActive = homepage?.hero_primary_button_active ?? true;
        const secondaryActive = homepage?.hero_secondary_button_active ?? true;
        const primaryUrl = homepage?.hero_primary_button_url ?? '/catalogo';
        const secondaryUrl = homepage?.hero_secondary_button_url ?? '#chat';
        const primaryText = homepage?.hero_primary_button_text ?? 'Ver catálogo';
        const secondaryText = homepage?.hero_secondary_button_text ?? 'Falar com IA';

        const renderPrimary = () => {
          if (!primaryActive) return null;
          if (primaryUrl === '#chat') {
            return (
              <Button
                size="lg"
                className="h-11 px-6 font-semibold"
                onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('open-chat')); }}
              >
                {primaryText} <PrimaryIcon className="w-4 h-4 ml-1.5" />
              </Button>
            );
          }
          if (isExternalLink(primaryUrl)) {
            return (
              <Button asChild size="lg" className="h-11 px-6 font-semibold">
                <a href={primaryUrl} target={homepage?.hero_primary_button_new_tab ? '_blank' : undefined} rel="noreferrer">
                  {primaryText} <PrimaryIcon className="w-4 h-4 ml-1.5" />
                </a>
              </Button>
            );
          }
          return (
            <Button asChild size="lg" className="h-11 px-6 font-semibold">
              <Link to={primaryUrl as any}>{primaryText} <PrimaryIcon className="w-4 h-4 ml-1.5" /></Link>
            </Button>
          );
        };

        const renderSecondary = () => {
          if (!secondaryActive) return null;
          const cls = 'h-11 px-6 border-primary/30 text-primary hover:bg-primary-tint hover:text-primary font-semibold';
          if (secondaryUrl === '#chat') {
            return (
              <Button
                size="lg"
                variant="outline"
                className={cls}
                onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('open-chat')); }}
              >
                <SecondaryIcon className="w-4 h-4 mr-1.5" /> {secondaryText}
              </Button>
            );
          }
          if (isExternalLink(secondaryUrl)) {
            return (
              <Button asChild size="lg" variant="outline" className={cls}>
                <a href={secondaryUrl} target={homepage?.hero_secondary_button_new_tab ? '_blank' : undefined} rel="noreferrer">
                  <SecondaryIcon className="w-4 h-4 mr-1.5" /> {secondaryText}
                </a>
              </Button>
            );
          }
          return (
            <Button asChild size="lg" variant="outline" className={cls}>
              <Link to={secondaryUrl as any}><SecondaryIcon className="w-4 h-4 mr-1.5" /> {secondaryText}</Link>
            </Button>
          );
        };

        return (
          <section className="relative overflow-hidden bg-card border-y border-border">
            <div className="container mx-auto px-4 py-6 md:py-8 relative">
              <div className="max-w-3xl mx-auto text-center">
                <img src={logoSrc} alt={logoAlt} loading="eager" fetchPriority="high" decoding="async" width={240} height={88} className="w-full max-w-[200px] md:max-w-[240px] h-auto mx-auto mb-3" />
                {heroBadge && (
                  <div className="inline-flex items-center gap-2 bg-primary-tint text-primary px-3 py-1 rounded-full text-xs font-medium mb-3">
                    <HeroBadgeIcon className="w-3.5 h-3.5" /> {heroBadge}
                  </div>
                )}
                <h1 className="font-display font-extrabold text-xl md:text-3xl leading-tight mb-2 tracking-tight text-foreground">
                  {heroTitle}{heroHighlight && <><br /><span className="text-primary">{heroHighlight}</span></>}
                </h1>
                {(heroDesc || heroSub) && (
                  <p className="text-sm md:text-base text-muted-foreground mb-4 max-w-xl mx-auto leading-relaxed">
                    {heroDesc}{heroSub ? ` ${heroSub}` : ''}
                  </p>
                )}
                <div className="flex flex-wrap gap-3 justify-center">
                  {renderPrimary()}
                  {renderSecondary()}
                </div>
              </div>
            </div>

            {/* BARRA PROMOCIONAL (administrável) */}
            {isPromoBarVisible(homepage) ? (
              (() => {
                const bg = homepage?.promo_bar_background_color;
                const fg = homepage?.promo_bar_text_color;
                const style: React.CSSProperties = {};
                if (bg) style.background = bg;
                if (fg) style.color = fg;
                const inner = (
                  <>
                    {homepage?.promo_bar_icon && <span className="mr-1">{homepage.promo_bar_icon}</span>}
                    <strong className="font-semibold">{homepage?.promo_bar_text}</strong>
                  </>
                );
                const baseCls = 'py-3 text-center text-sm font-medium';
                const themeCls = bg || fg ? '' : 'bg-accent text-accent-foreground';
                if (homepage?.promo_bar_url) {
                  const ext = isExternalLink(homepage.promo_bar_url);
                  return ext ? (
                    <a href={homepage.promo_bar_url} className={`${baseCls} ${themeCls} block hover:opacity-90`} style={style}>{inner}</a>
                  ) : (
                    <Link to={homepage.promo_bar_url as any} className={`${baseCls} ${themeCls} block hover:opacity-90`} style={style}>{inner}</Link>
                  );
                }
                return <div className={`${baseCls} ${themeCls}`} style={style}>{inner}</div>;
              })()
            ) : null}
          </section>
        );
      })()}


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

      {/* MARKETING / CONFIANÇA (administrável) */}
      {(homepage?.main_cta_is_active ?? true) && (() => {
        const CtaIcon = getLucideIcon(homepage?.main_cta_icon, Sparkles);
        const title = homepage?.main_cta_title ?? 'A loja certa para o seu projeto';
        const desc = homepage?.main_cta_description ?? 'Nota fiscal garantida, suporte técnico de verdade, atendimento com IA 24h e entrega rápida em Maricá e região.';
        const btnActive = homepage?.main_cta_button_active ?? true;
        const btnText = homepage?.main_cta_button_text ?? 'Ver catálogo completo';
        const btnUrl = homepage?.main_cta_button_url ?? '/catalogo';
        const bg = homepage?.main_cta_background_color;
        const fg = homepage?.main_cta_text_color;
        const bgImage = homepage?.main_cta_image_url;
        const containerStyle: React.CSSProperties = {};
        if (bgImage) {
          containerStyle.backgroundImage = `linear-gradient(135deg, rgba(0,0,0,0.55), rgba(0,0,0,0.35)), url(${bgImage})`;
          containerStyle.backgroundSize = 'cover';
          containerStyle.backgroundPosition = 'center';
        } else if (bg) {
          containerStyle.background = bg;
        }
        if (fg) containerStyle.color = fg;
        const baseCls = bg || bgImage
          ? 'rounded-2xl text-primary-foreground p-8 md:p-12 text-center shadow-elevated'
          : 'rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground p-8 md:p-12 text-center shadow-elevated';

        const renderBtn = () => {
          if (!btnActive) return null;
          const btnStyle: React.CSSProperties = {};
          if (homepage?.main_cta_button_color) btnStyle.background = homepage.main_cta_button_color;
          if (isExternalLink(btnUrl)) {
            return (
              <Button asChild size="lg" variant="secondary" className="h-12 px-6 font-semibold" style={btnStyle}>
                <a href={btnUrl} rel="noreferrer">{btnText} <ArrowRight className="w-4 h-4 ml-1.5" /></a>
              </Button>
            );
          }
          return (
            <Button asChild size="lg" variant="secondary" className="h-12 px-6 font-semibold" style={btnStyle}>
              <Link to={btnUrl as any}>{btnText} <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
            </Button>
          );
        };

        return (
          <section className="container mx-auto px-4 pb-12">
            <div className={baseCls} style={containerStyle}>
              <CtaIcon className="w-8 h-8 mx-auto mb-3 opacity-90" />
              <h3 className="font-display font-bold text-2xl md:text-3xl mb-3">{title}</h3>
              {desc && (
                <p className="text-sm md:text-base opacity-90 max-w-xl mx-auto mb-6 leading-relaxed">{desc}</p>
              )}
              {renderBtn()}
            </div>
          </section>
        );
      })()}
    </StoreLayout>
  );
}

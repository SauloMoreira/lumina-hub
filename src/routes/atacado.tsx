import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Building2,
  CheckCircle2,
  Clock,
  MessageSquareText,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Tag,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { buildSeo } from '@/lib/seo';
import { formatCNPJ } from '@/lib/cnpj';
import { ProductCard } from '@/components/store/ProductCard';
import { StoreLayout } from '@/components/layout/StoreLayout';
import { ProductImagePlaceholder } from '@/components/store/ProductImagePlaceholder';
import { formatBRL, STORE_WHATSAPP } from '@/lib/domain';
import { useCart } from '@/stores/cartStore';
import type { Product } from '@/lib/domain';

type B2bSettings = {
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_description: string | null;
  hero_primary_button_text: string | null;
  hero_primary_button_url: string | null;
  hero_secondary_button_text: string | null;
  hero_secondary_button_url: string | null;
  whatsapp_cta_text: string | null;
  show_b2b_prices_to_guests: boolean;
  vitrine_is_active: boolean;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
};

type CompanyStatus = 'guest' | 'pf' | 'pending' | 'approved' | 'blocked' | 'rejected';

type Category = { id: string; name: string; slug: string };

type SortKey = 'relevance' | 'discount' | 'min_qty';

export const Route = createFileRoute('/atacado')({
  head: () =>
    buildSeo({
      title: 'Atacado para empresas | Led Maricá',
      description:
        'Preços especiais para empresas com CNPJ. Cadastre-se e tenha acesso a condições B2B.',
      url: '/atacado',
    }),
  component: AtacadoPage,
});

function AtacadoPage() {
  const [settings, setSettings] = useState<B2bSettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [companyStatus, setCompanyStatus] = useState<CompanyStatus>('guest');
  const [companyName, setCompanyName] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('relevance');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [{ data: s }, { data: prods }, { data: cats }, { data: sess }] = await Promise.all([
        supabase
          .from('b2b_settings')
          .select(
            'hero_title, hero_subtitle, hero_description, hero_primary_button_text, hero_primary_button_url, hero_secondary_button_text, hero_secondary_button_url, whatsapp_cta_text, show_b2b_prices_to_guests, vitrine_is_active, seo_title, seo_description, og_image_url',
          )
          .limit(1)
          .maybeSingle(),
        supabase
          .from('products')
          .select(
            'id, name, slug, description, price, sale_price, stock_qty, sku, ncm, brand, weight_kg, height_cm, width_cm, length_cm, category_id, images, tags, active, featured, free_shipping_eligible, specs, b2b_enabled, b2b_price, b2b_min_qty, b2b_qty_multiple, b2b_show_in_vitrine',
          )
          .eq('active', true)
          .eq('b2b_enabled', true)
          .eq('b2b_show_in_vitrine', true)
          .gt('stock_qty', 0)
          .order('featured', { ascending: false })
          .limit(96),
        supabase
          .from('categories')
          .select('id, name, slug')
          .eq('active', true)
          .order('sort_order', { ascending: true }),
        supabase.auth.getSession(),
      ]);

      if (!mounted) return;
      setSettings(s as B2bSettings | null);
      setProducts((prods ?? []) as unknown as Product[]);
      setCategories((cats ?? []) as Category[]);

      const userId = sess.session?.user?.id;
      if (!userId) {
        setCompanyStatus('guest');
        return;
      }
      const { data: link } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      if (!link) {
        setCompanyStatus('pf');
        return;
      }
      const { data: company } = await supabase
        .from('companies')
        .select('status, legal_name, trade_name')
        .eq('id', link.company_id)
        .maybeSingle();
      if (company) {
        setCompanyStatus(company.status as CompanyStatus);
        setCompanyName(company.trade_name || company.legal_name);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const isApproved = companyStatus === 'approved';

  // Categorias presentes nos produtos B2B (evita opções vazias)
  const usedCategoryIds = useMemo(
    () => new Set(products.map((p) => p.category_id).filter(Boolean) as string[]),
    [products],
  );
  const availableCategories = useMemo(
    () => categories.filter((c) => usedCategoryIds.has(c.id)),
    [categories, usedCategoryIds],
  );

  const visibleProducts = useMemo(() => {
    const list = categoryFilter
      ? products.filter((p) => p.category_id === categoryFilter)
      : products.slice();

    const discount = (p: Product) => {
      if (!p.b2b_price || p.b2b_price <= 0) return 0;
      const ref = p.sale_price ?? p.price;
      if (!ref) return 0;
      return Math.max(0, (ref - p.b2b_price) / ref);
    };

    if (sortKey === 'discount') {
      list.sort((a, b) => discount(b) - discount(a));
    } else if (sortKey === 'min_qty') {
      list.sort((a, b) => (a.b2b_min_qty ?? 1) - (b.b2b_min_qty ?? 1));
    } else {
      // relevance: featured primeiro, depois com b2b_price, depois maior desconto
      list.sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        const aHas = a.b2b_price ? 1 : 0;
        const bHas = b.b2b_price ? 1 : 0;
        if (aHas !== bHas) return bHas - aHas;
        return discount(b) - discount(a);
      });
    }
    return list;
  }, [products, categoryFilter, sortKey]);

  const whatsappLink = useMemo(() => {
    const text = encodeURIComponent(
      `Olá! Quero solicitar uma negociação B2B${companyName ? ` para a empresa ${companyName}` : ''}.`,
    );
    return `https://wa.me/${STORE_WHATSAPP}?text=${text}`;
  }, [companyName]);

  if (settings && !settings.vitrine_is_active) {
    return (
      <StoreLayout>
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold text-foreground">Vitrine de atacado indisponível</h1>
          <p className="text-muted-foreground mt-2">
            A área de atacado está temporariamente desativada.
          </p>
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="bg-background">
        {/* HERO — compacto quando empresa aprovada */}
      {isApproved ? (
        <CompactHero companyName={companyName} whatsappLink={whatsappLink} />
      ) : (
        <FullHero settings={settings} />
      )}

      {/* Card de status (aparece sempre, mas no aprovado fica logo abaixo do hero compacto) */}
      <section className="max-w-6xl mx-auto px-4 mt-6">
        <ClientStatusBanner status={companyStatus} companyName={companyName} />
      </section>

      {/* VITRINE B2B — área nobre */}
      <section id="produtos" className="max-w-6xl mx-auto px-4 pt-8 pb-12">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-5">
          <div>
            <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground">
              Produtos com preço empresa
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Condições especiais para compras em quantidade.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CartButton />
            {isApproved && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center gap-2 h-10 px-4 rounded-md border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted transition"
              >
                <MessageSquareText className="w-4 h-4" /> Solicitar negociação
              </a>
            )}
          </div>
        </div>

        {/* Filtros B2B */}
        <Filters
          categories={availableCategories}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          sortKey={sortKey}
          onSortChange={setSortKey}
          totalCount={visibleProducts.length}
        />

        {visibleProducts.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-10 text-center mt-6">
            <p className="text-muted-foreground">
              Nenhum produto com condição empresa nesta seleção.
            </p>
          </div>
        ) : (
          <div
            className={`mt-6 grid gap-3 sm:gap-5 ${
              isApproved
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
            }`}
          >
            {visibleProducts.map((p, i) =>
              isApproved ? (
                <B2bProductCard key={p.id} product={p} index={i} />
              ) : (
                <div key={p.id} className="relative">
                  <span className="absolute z-10 top-2 left-2 inline-flex items-center gap-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase px-2 py-1 rounded">
                    Preço empresa
                  </span>
                  <ProductCard product={p} index={i} />
                </div>
              ),
            )}
          </div>
        )}

        {!isApproved && (
          <p className="text-xs text-muted-foreground mt-6">
            Os preços de atacado são exibidos após login com empresa aprovada. Para acessar,{' '}
            <Link to={'/cadastro-empresa' as never} className="font-semibold underline">
              cadastre sua empresa com CNPJ
            </Link>
            .
          </p>
        )}
      </section>

      {/* Benefícios */}
      <section className="max-w-6xl mx-auto px-4 py-10 grid sm:grid-cols-3 gap-4">
        <Benefit
          icon={Tag}
          title="Preço empresa"
          desc="Condições especiais para CNPJ a partir da quantidade mínima."
        />
        <Benefit
          icon={ShieldCheck}
          title="Mesmo checkout seguro"
          desc="Compre no atacado com a mesma logística e pagamento da loja."
        />
        <Benefit
          icon={MessageSquareText}
          title="Negociação B2B"
          desc="Precisa de uma condição melhor? Fale com nosso atendimento."
        />
      </section>

      {/* CTA negociação B2B */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary mb-2">
              <Sparkles className="w-4 h-4" /> Negociação personalizada
            </div>
            <h3 className="text-xl md:text-2xl font-display font-bold text-foreground">
              Volume maior? Faça uma cotação.
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Atendimento dedicado para projetos, obras e compras recorrentes.
            </p>
          </div>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-primary text-primary-foreground font-semibold hover:brightness-110 transition shadow-primary"
          >
            <MessageSquareText className="w-4 h-4" /> Solicitar negociação B2B
          </a>
        </div>
      </section>
      </div>
    </StoreLayout>
  );
}

/* ----------------------------- HEROS ----------------------------- */

function FullHero({ settings }: { settings: B2bSettings | null }) {
  return (
    <section className="bg-gradient-to-br from-primary/5 via-background to-background py-12 md:py-16 border-b border-border">
      <div className="max-w-6xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-semibold mb-4">
          <Building2 className="w-4 h-4" /> Área exclusiva para empresas
        </div>
        <h1 className="text-3xl md:text-5xl font-display font-bold text-foreground max-w-3xl">
          {settings?.hero_title ?? 'Compras em atacado para empresas'}
        </h1>
        {settings?.hero_subtitle && (
          <p className="text-lg md:text-xl text-foreground/80 mt-3 max-w-2xl">
            {settings.hero_subtitle}
          </p>
        )}
        {settings?.hero_description && (
          <p className="text-muted-foreground mt-4 max-w-2xl">{settings.hero_description}</p>
        )}
        <div className="flex flex-wrap gap-3 mt-6">
          <Link
            to={'/cadastro-empresa' as never}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-primary text-primary-foreground font-semibold hover:brightness-110 transition shadow-primary"
          >
            Cadastrar empresa
          </Link>
          <a
            href="#produtos"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-md border border-border bg-card text-foreground font-semibold hover:bg-muted transition"
          >
            Ver produtos
          </a>
        </div>
      </div>
    </section>
  );
}

function CompactHero({
  companyName,
  whatsappLink,
}: {
  companyName: string | null;
  whatsappLink: string;
}) {
  return (
    <section className="bg-gradient-to-r from-primary/10 to-background border-b border-border">
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-success/15 text-success px-2.5 py-1 rounded-full text-[11px] font-semibold mb-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> Empresa aprovada
            {companyName ? ` — ${companyName}` : ''}
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
            Compras em atacado para empresas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Você já está vendo os preços empresa nesta vitrine.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="#produtos"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground font-semibold hover:brightness-110 transition shadow-primary text-sm"
          >
            <ShoppingCart className="w-4 h-4" /> Comprar no atacado
          </a>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-border bg-card text-foreground font-semibold hover:bg-muted transition text-sm"
          >
            <MessageSquareText className="w-4 h-4" /> Solicitar negociação B2B
          </a>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- FILTERS ----------------------------- */

function Filters({
  categories,
  categoryFilter,
  onCategoryChange,
  sortKey,
  onSortChange,
  totalCount,
}: {
  categories: Category[];
  categoryFilter: string;
  onCategoryChange: (v: string) => void;
  sortKey: SortKey;
  onSortChange: (v: SortKey) => void;
  totalCount: number;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0 sm:flex-1">
        <button
          onClick={() => onCategoryChange('')}
          className={`shrink-0 h-8 px-3 rounded-full text-xs font-medium border transition ${
            !categoryFilter
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-foreground border-border hover:bg-muted'
          }`}
        >
          Todas as categorias
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => onCategoryChange(c.id)}
            className={`shrink-0 h-8 px-3 rounded-full text-xs font-medium border transition ${
              categoryFilter === c.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-border hover:bg-muted'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 sm:ml-auto">
        <label className="text-xs text-muted-foreground whitespace-nowrap">Ordenar:</label>
        <select
          value={sortKey}
          onChange={(e) => onSortChange(e.target.value as SortKey)}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
        >
          <option value="relevance">Mais relevantes</option>
          <option value="discount">Maior desconto</option>
          <option value="min_qty">Menor mínimo</option>
        </select>
        <span className="hidden sm:inline text-xs text-muted-foreground">
          {totalCount} produto{totalCount === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  );
}

/* ----------------------------- B2B PRODUCT CARD ----------------------------- */

function B2bProductCard({ product, index }: { product: Product; index: number }) {
  const cart = useCart();
  const retail = product.sale_price ?? product.price;
  const b2bPrice = product.b2b_price ?? null;
  const minQty = product.b2b_min_qty ?? 1;
  const hasB2b = b2bPrice != null && b2bPrice > 0;
  const savePct = hasB2b && retail > 0 ? Math.round(((retail - (b2bPrice as number)) / retail) * 100) : 0;
  const finalPrice = hasB2b ? (b2bPrice as number) : retail;

  const router = useRouter();
  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    cart.addItem(
      {
        productId: product.id,
        name: product.name,
        slug: product.slug,
        price: finalPrice,
        image: product.images[0] ?? null,
        stock: product.stock_qty,
        freeShippingEligible: !!product.free_shipping_eligible,
        minQty,
        qtyMultiple: product.b2b_qty_multiple ?? 1,
        source: 'b2b',
      },
      minQty,
      { openDrawer: false }
    );
    toast.success('Produto adicionado ao carrinho', {
      description: `${product.name} · ${minQty} un`,
      duration: 6000,
      position: 'top-center',
      action: {
        label: 'Ir ao carrinho',
        onClick: () => {
          cart.close();
          router.navigate({ to: '/carrinho' });
        },
      },
    });
  };

  const isAboveFold = index < 3;

  return (
    <Link
      to="/produto/$slug"
      params={{ slug: product.slug }}
      preload="intent"
      className="group flex flex-col bg-card rounded-xl border border-border shadow-soft hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
    >
      <div className="aspect-[4/3] bg-surface relative overflow-hidden flex items-center justify-center">
        {product.images[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            width={600}
            height={450}
            loading={isAboveFold ? 'eager' : 'lazy'}
            fetchPriority={isAboveFold ? 'high' : 'auto'}
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <ProductImagePlaceholder iconSize={64} />
        )}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1 max-w-[calc(100%-1rem)]">
          <span className="inline-flex items-center gap-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase px-2 py-1 rounded">
            Preço empresa
          </span>
          {savePct > 0 && (
            <span className="inline-flex items-center bg-success text-success-foreground text-[10px] font-bold px-2 py-1 rounded">
              Economize {savePct}%
            </span>
          )}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        {product.brand && (
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
            {product.brand}
          </div>
        )}
        <h3 className="text-sm sm:text-base font-semibold text-foreground line-clamp-2 leading-snug min-h-[2.5rem]">
          {product.name}
        </h3>

        <div className="flex flex-wrap gap-1.5">
          <Badge>Mín. {minQty} un</Badge>
          {product.b2b_qty_multiple && product.b2b_qty_multiple > 1 && (
            <Badge>Múltiplo de {product.b2b_qty_multiple}</Badge>
          )}
          {product.free_shipping_eligible && <Badge tone="success">Frete grátis</Badge>}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3">
          <div className="min-w-0">
            {hasB2b && (
              <div className="text-xs text-muted-foreground line-through leading-none mb-1 truncate">
                {formatBRL(retail)}
              </div>
            )}
            <div className="font-display font-extrabold text-primary text-xl sm:text-2xl leading-none truncate">
              {formatBRL(finalPrice)}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">por unidade</div>
          </div>
          <button
            onClick={handleAdd}
            disabled={product.stock_qty === 0}
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md bg-primary text-primary-foreground hover:brightness-110 transition shadow-primary text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            aria-label="Comprar no atacado"
          >
            <ShoppingCart className="w-4 h-4" /> Comprar
          </button>
        </div>
      </div>
    </Link>
  );
}

function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'success';
}) {
  const cls =
    tone === 'success'
      ? 'bg-success/10 text-success border-success/30'
      : 'bg-muted text-foreground/80 border-border';
  return (
    <span
      className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded border ${cls}`}
    >
      {children}
    </span>
  );
}

/* ----------------------------- STATUS BANNER ----------------------------- */

function ClientStatusBanner({
  status,
  companyName,
}: {
  status: CompanyStatus;
  companyName: string | null;
}) {
  if (status === 'guest') {
    return (
      <Banner
        tone="info"
        icon={Building2}
        title="Você está navegando como visitante"
        body={
          <>
            Para ver e comprar com preço empresa,{' '}
            <Link to={'/cadastro-empresa' as never} className="font-semibold underline">
              cadastre sua empresa com CNPJ
            </Link>
            . Já tem cadastro?{' '}
            <Link to="/login" className="font-semibold underline">
              Faça login
            </Link>
            .
          </>
        }
      />
    );
  }
  if (status === 'pf') {
    return (
      <Banner
        tone="info"
        icon={Building2}
        title="Sua conta é pessoa física"
        body={
          <>
            Para acessar preços B2B,{' '}
            <Link to={'/cadastro-empresa' as never} className="font-semibold underline">
              cadastre sua empresa
            </Link>{' '}
            informando o CNPJ.
          </>
        }
      />
    );
  }
  if (status === 'pending') {
    return (
      <Banner
        tone="warn"
        icon={Clock}
        title={`Empresa em análise${companyName ? ` — ${companyName}` : ''}`}
        body="Seu cadastro empresarial está em análise. Após aprovação, os preços B2B serão liberados automaticamente."
      />
    );
  }
  if (status === 'blocked' || status === 'rejected') {
    return (
      <Banner
        tone="error"
        icon={Building2}
        title="Acesso B2B indisponível"
        body="Seu acesso B2B está temporariamente indisponível. Entre em contato com a loja."
      />
    );
  }
  // approved — banner discreto pois o hero compacto já destaca o status
  return (
    <Banner
      tone="success"
      icon={CheckCircle2}
      title={`Empresa aprovada${companyName ? ` — ${companyName}` : ''}`}
      body="Os valores B2B aparecem nos cards abaixo. Adicione respeitando a quantidade mínima de cada produto."
    />
  );
}

function Banner({
  tone,
  icon: Icon,
  title,
  body,
}: {
  tone: 'info' | 'warn' | 'error' | 'success';
  icon: typeof Building2;
  title: string;
  body: React.ReactNode;
}) {
  const colors: Record<typeof tone, string> = {
    info: 'bg-primary/5 border-primary/30 text-foreground',
    warn: 'bg-warning/10 border-warning/40 text-foreground',
    error: 'bg-destructive/10 border-destructive/40 text-foreground',
    success: 'bg-success/10 border-success/40 text-foreground',
  };
  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border ${colors[tone]}`}>
      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-muted-foreground mt-0.5">{body}</div>
      </div>
    </div>
  );
}

function Benefit({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Building2;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center mb-3">
        <Icon className="w-5 h-5" />
      </div>
      <div className="font-semibold text-foreground">{title}</div>
      <div className="text-sm text-muted-foreground mt-1">{desc}</div>
    </div>
  );
}

// Garante que formatCNPJ siga incluído (uso futuro nas próximas fases)
void formatCNPJ;

/* ----------------------------- CART BUTTON ----------------------------- */

function CartButton() {
  const cart = useCart();
  const count = cart.count();
  return (
    <button
      type="button"
      onClick={() => cart.open()}
      className="relative inline-flex items-center gap-2 h-10 px-4 rounded-md border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted transition"
      aria-label={`Abrir carrinho (${count} ${count === 1 ? 'item' : 'itens'})`}
    >
      <ShoppingCart className="w-4 h-4" />
      <span className="hidden sm:inline">Carrinho</span>
      {count > 0 && (
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none">
          {count}
        </span>
      )}
    </button>
  );
}
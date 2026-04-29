import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Clock, MessageSquareText, ShieldCheck, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { buildSeo } from '@/lib/seo';
import { formatCNPJ } from '@/lib/cnpj';
import { ProductCard } from '@/components/store/ProductCard';
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
  const [companyStatus, setCompanyStatus] = useState<
    'guest' | 'pf' | 'pending' | 'approved' | 'blocked' | 'rejected'
  >('guest');
  const [companyName, setCompanyName] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [{ data: s }, { data: prods }, { data: sess }] = await Promise.all([
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
            'id, name, slug, description, price, sale_price, stock_qty, sku, ncm, brand, weight_kg, height_cm, width_cm, length_cm, category_id, images, tags, active, featured, free_shipping_eligible, specs, b2b_enabled, b2b_price, b2b_min_qty, b2b_show_in_vitrine',
          )
          .eq('active', true)
          .eq('b2b_enabled', true)
          .eq('b2b_show_in_vitrine', true)
          .order('featured', { ascending: false })
          .limit(48),
        supabase.auth.getSession(),
      ]);

      if (!mounted) return;
      setSettings(s as B2bSettings | null);
      setProducts((prods ?? []) as unknown as Product[]);

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
        setCompanyStatus(company.status as typeof companyStatus);
        setCompanyName(company.trade_name || company.legal_name);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (settings && !settings.vitrine_is_active) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-foreground">Vitrine de atacado indisponível</h1>
        <p className="text-muted-foreground mt-2">
          A área de atacado está temporariamente desativada.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-background">
      {/* Hero */}
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
              className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-primary text-primary-foreground font-semibold hover:brightness-110 transition"
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

      {/* Status do cliente */}
      <section className="max-w-6xl mx-auto px-4 mt-8">
        <ClientStatusBanner status={companyStatus} companyName={companyName} />
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

      {/* Produtos */}
      <section id="produtos" className="max-w-6xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-display font-bold text-foreground mb-6">
          Produtos com condição empresa
        </h2>
        {products.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-10 text-center">
            <p className="text-muted-foreground">
              Em breve novos produtos com condição empresa. Cadastre sua empresa para ser
              avisado.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {products.map((p, i) => (
              <div key={p.id} className="relative">
                <div className="absolute z-10 top-2 left-2 inline-flex items-center gap-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase px-2 py-1 rounded">
                  Preço empresa
                </div>
                <ProductCard product={p} index={i} b2bApproved={companyStatus === 'approved'} />
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-6">
          Os preços de atacado são exibidos após login com empresa aprovada. Para acessar,
          cadastre sua empresa com CNPJ.
        </p>
      </section>
    </div>
  );
}

function ClientStatusBanner({
  status,
  companyName,
}: {
  status: 'guest' | 'pf' | 'pending' | 'approved' | 'blocked' | 'rejected';
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
  return (
    <Banner
      tone="success"
      icon={CheckCircle2}
      title={`Empresa aprovada${companyName ? ` — ${companyName}` : ''}`}
      body="Você já pode comprar com preço empresa. Os valores B2B aparecem ao adicionar a quantidade mínima ao carrinho."
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

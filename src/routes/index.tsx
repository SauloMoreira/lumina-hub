import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Sparkles, Truck, Shield, MessageSquareText, ArrowRight, Lightbulb, Zap, Cable, Plug, Sun, LayoutGrid, Wrench, Package } from 'lucide-react';
import { StoreLayout } from '@/components/layout/StoreLayout';
import { ProductCard } from '@/components/store/ProductCard';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { Product, Category } from '@/lib/domain';
import { FREE_SHIPPING_THRESHOLD, formatBRL } from '@/lib/domain';

export const Route = createFileRoute('/')({ component: HomePage });

const ICONS: Record<string, any> = { Lightbulb, Zap, Cable, Plug, Sun, LayoutGrid, Wrench, Package };

function HomePage() {
  const { data: featured } = useQuery({
    queryKey: ['products', 'featured'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').eq('active', true).eq('featured', true).limit(8);
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').eq('active', true).order('sort_order');
      if (error) throw error;
      return data as Category[];
    },
  });

  return (
    <StoreLayout>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-[oklch(0.42_0.21_268)] text-primary-foreground">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="container mx-auto px-4 py-20 md:py-28 relative">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-primary-foreground/10 backdrop-blur px-3 py-1.5 rounded-full text-xs font-medium mb-6">
              <Sparkles className="w-3.5 h-3.5" /> Atendimento com IA 24h · Entrega rápida em Maricá e região
            </div>
            <h1 className="font-display font-extrabold text-4xl md:text-5xl leading-tight mb-5 tracking-tight">
              Material elétrico e iluminação<br />
              <span className="text-accent-tint">com qualidade que ilumina.</span>
            </h1>
            <p className="text-lg text-primary-foreground/85 mb-8 max-w-xl leading-relaxed">
              Lâmpadas LED, disjuntores, fios, refletores e tudo que seu projeto precisa.
              Nota fiscal garantida e suporte técnico de verdade.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-card text-primary hover:bg-card/90 h-12 px-6 font-semibold">
                <Link to="/catalogo">Ver catálogo <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6 border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground font-semibold">
                <Link to="/catalogo"><MessageSquareText className="w-4 h-4 mr-1.5" /> Falar com IA</Link>
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Banner frete grátis */}
        <div className="bg-accent text-accent-foreground py-3 text-center text-sm font-medium">
          🚚 <strong>Frete grátis</strong> em pedidos acima de {formatBRL(FREE_SHIPPING_THRESHOLD)}
        </div>
      </section>

      {/* DIFERENCIAIS */}
      <section className="container mx-auto px-4 py-12">
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

      {/* CATEGORIAS */}
      <section className="container mx-auto px-4 py-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="label-meta mb-2">Categorias</div>
            <h2 className="font-display font-bold text-2xl tracking-tight">Encontre por departamento</h2>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {categories?.map((c, i) => {
            const Icon = ICONS[c.icon ?? 'Package'] ?? Package;
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Link
                  to="/catalogo"
                  search={{ cat: c.slug } as any}
                  className="group flex flex-col items-center text-center p-5 bg-card border border-border rounded-xl hover:border-primary hover:shadow-elevated transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-primary-tint flex items-center justify-center mb-3 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="w-5 h-5 text-primary group-hover:text-primary-foreground" />
                  </div>
                  <div className="text-xs font-medium leading-tight">{c.name}</div>
                </Link>
              </motion.div>
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
    </StoreLayout>
  );
}

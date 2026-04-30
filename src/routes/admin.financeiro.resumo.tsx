import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Receipt, Info } from 'lucide-react';
import { buildSeo } from '@/lib/seo';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { getFinanceOverview, type FinanceOverview } from '@/server/finance.functions';

export const Route = createFileRoute('/admin/financeiro/resumo')({
  head: () => buildSeo({ title: 'Resumo financeiro', url: '/admin/financeiro/resumo', noindex: true }),
  component: FinanceOverviewPage,
});

type Preset = 'today' | 'yesterday' | 'last_7_days' | 'this_month' | 'last_month';
type OrderType = 'all' | 'b2c' | 'b2b';

function brl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function FinanceOverviewPage() {
  const [preset, setPreset] = useState<Preset>('last_7_days');
  const [orderType, setOrderType] = useState<OrderType>('all');
  const [data, setData] = useState<FinanceOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getFinanceOverview({ data: { preset, orderType } })
      .then((r) => { if (alive) setData(r); })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Erro ao carregar resumo.'))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [preset, orderType]);

  const presets: Array<{ id: Preset; label: string }> = [
    { id: 'today', label: 'Hoje' },
    { id: 'yesterday', label: 'Ontem' },
    { id: 'last_7_days', label: '7 dias' },
    { id: 'this_month', label: 'Este mês' },
    { id: 'last_month', label: 'Mês anterior' },
  ];

  const cards: Array<{ label: string; value: string; hint?: string }> = data
    ? [
        { label: 'Faturamento bruto', value: brl(data.grossRevenue), hint: `${data.ordersPaid} pedido(s) pago(s)` },
        { label: 'Faturamento líquido estimado', value: brl(data.estimatedNetRevenue), hint: 'Após taxa MP estimada' },
        { label: 'Ticket médio', value: brl(data.averageTicket) },
        { label: 'Pedidos pendentes', value: String(data.ordersPending) },
        { label: 'Descontos concedidos', value: brl(data.totalDiscounts) },
        { label: 'Cupons aplicados', value: brl(data.couponDiscounts) },
        { label: 'Desconto B2B', value: brl(data.b2bDiscounts) },
        { label: 'Frete cobrado', value: brl(data.shippingCharged) },
        { label: 'Taxa MP estimada', value: brl(data.estimatedPaymentFees) },
        { label: 'Custo estimado dos produtos', value: brl(data.estimatedCogs), hint: data.itemsWithoutCost > 0 ? `${data.itemsWithoutCost} item(ns) sem custo` : undefined },
        { label: 'Margem bruta estimada', value: brl(data.estimatedGrossMargin), hint: `${data.estimatedMarginPercent.toFixed(1)}%` },
        { label: 'Lucro bruto estimado', value: brl(data.estimatedGrossProfit), hint: 'Margem − taxa MP' },
      ]
    : [];

  return (
    <AdminLayout title="Resumo financeiro">
      <div className="max-w-6xl mx-auto">
        <Link to={'/admin' as never} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar ao painel
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <Receipt className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-display font-bold">Resumo financeiro</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-6">
          {presets.map((p) => (
            <Button key={p.id} size="sm" variant={preset === p.id ? 'default' : 'outline'} onClick={() => setPreset(p.id)}>
              {p.label}
            </Button>
          ))}
          <div className="w-px h-6 bg-border mx-2" />
          {(['all', 'b2c', 'b2b'] as OrderType[]).map((t) => (
            <Button key={t} size="sm" variant={orderType === t ? 'default' : 'outline'} onClick={() => setOrderType(t)}>
              {t === 'all' ? 'Todos' : t.toUpperCase()}
            </Button>
          ))}
        </div>

        <div className="bg-muted/40 border border-border rounded-lg p-3 mb-6 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Os valores de margem e lucro são estimativas baseadas no custo cadastrado dos produtos e nas taxas configuradas em Configurações financeiras.</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Carregando…
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((c) => (
              <div key={c.label} className="bg-card border border-border rounded-xl p-4">
                <div className="text-xs text-muted-foreground">{c.label}</div>
                <div className="text-xl font-semibold mt-1">{c.value}</div>
                {c.hint && <div className="text-xs text-muted-foreground mt-1">{c.hint}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

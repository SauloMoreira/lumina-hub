import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Loader2,
  Download,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Info,
  ExternalLink,
} from 'lucide-react';
import { buildSeo } from '@/lib/seo';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getFinanceReportCards,
  getSalesReport,
  exportSalesReportCsv,
  type FinanceReportCards,
  type SalesReportResult,
  type ReportPreset,
  type OrderTypeFilter,
} from '@/server/financeReports.functions';
import {
  getMarginCards,
  getMarginByOrder,
  getProductsReport,
  exportMarginByOrderCsv,
  exportProductsReportCsv,
  type MarginCards,
  type MarginOrderResult,
  type MarginOrderRow,
  type ProductsReportResult,
  type ProductReportRow,
  type MarginStatus,
  type CalcStatus,
} from '@/server/marginReports.functions';
import {
  getB2bReport,
  getCouponsReport,
  getShippingReport,
  exportB2bCompaniesCsv,
  exportB2bProductsCsv,
  exportCouponsCsv,
  exportDiscountsByOrderCsv,
  exportShippingByOrderCsv,
  exportShippingByDistrictCsv,
  type B2bCards,
  type B2bCompanyRow,
  type B2bProductRow,
  type CouponsCards,
  type CouponPerfRow,
  type DiscountByOrderRow,
  type ShippingCards,
  type ShippingOrderRow,
  type ShippingDistrictRow,
} from '@/server/commercialReports.functions';

export const Route = createFileRoute('/admin/financeiro/relatorios')({
  head: () =>
    buildSeo({
      title: 'Relatórios financeiros',
      url: '/admin/financeiro/relatorios',
      noindex: true,
    }),
  component: ReportsPage,
});

function brl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function pct(n: number) {
  return `${n.toFixed(1).replace('.', ',')}%`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR');
}

const PRESETS: Array<{ id: ReportPreset; label: string }> = [
  { id: 'today', label: 'Hoje' },
  { id: 'yesterday', label: 'Ontem' },
  { id: 'last_7_days', label: '7 dias' },
  { id: 'last_30_days', label: '30 dias' },
  { id: 'this_month', label: 'Este mês' },
  { id: 'last_month', label: 'Mês anterior' },
];
const ORDER_TYPES: Array<{ id: OrderTypeFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'b2c', label: 'B2C' },
  { id: 'b2b', label: 'B2B' },
];
const PAYMENT_STATUSES = [
  { id: '', label: 'Todos' },
  { id: 'approved', label: 'Aprovado' },
  { id: 'paid', label: 'Pago' },
  { id: 'pending', label: 'Pendente' },
  { id: 'in_process', label: 'Em processamento' },
  { id: 'rejected', label: 'Recusado' },
  { id: 'cancelled', label: 'Cancelado' },
];
const PAYMENT_METHODS = [
  { id: '', label: 'Todos' },
  { id: 'pix', label: 'Pix' },
  { id: 'credit_card', label: 'Cartão de crédito' },
  { id: 'debit_card', label: 'Cartão de débito' },
  { id: 'bolbradesco', label: 'Boleto' },
];
const DELIVERY_METHODS = [
  { id: '', label: 'Todos' },
  { id: 'delivery', label: 'Entrega' },
  { id: 'local_delivery', label: 'Entrega local' },
  { id: 'pickup', label: 'Retirada' },
];

function DeltaBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-muted-foreground">—</span>;
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
      }`}
    >
      <Icon className="w-3 h-3" />
      {positive ? '+' : ''}
      {pct(value)}
    </span>
  );
}

type CardDef = {
  label: string;
  value: string;
  hint?: string;
  delta?: number | null;
  tooltip?: string;
  warn?: boolean;
};

function MetricCard({ card }: { card: CardDef }) {
  return (
    <div
      className={`bg-card border rounded-xl p-4 flex flex-col gap-1.5 min-h-[110px] ${
        card.warn ? 'border-amber-500/40' : 'border-border'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate">{card.label}</span>
          {card.tooltip && (
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-3 h-3 opacity-60" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{card.tooltip}</TooltipContent>
            </Tooltip>
          )}
        </div>
        {card.delta !== undefined && <DeltaBadge value={card.delta ?? null} />}
      </div>
      <p className="font-display font-bold text-2xl tracking-tight leading-none">{card.value}</p>
      {card.hint && <p className="text-[11px] text-muted-foreground">{card.hint}</p>}
    </div>
  );
}

function MarginStatusBadge({ status }: { status: MarginStatus }) {
  const map: Record<MarginStatus, { label: string; cls: string }> = {
    good: { label: 'Boa', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
    warning: { label: 'Atenção', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
    critical: { label: 'Crítica', cls: 'bg-destructive/15 text-destructive' },
    incomplete: { label: 'Incompleta', cls: 'bg-muted text-muted-foreground' },
  };
  const m = map[status];
  return (
    <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${m.cls}`}>{m.label}</span>
  );
}

function CalcStatusBadge({ status }: { status: CalcStatus }) {
  const map: Record<CalcStatus, { label: string; cls: string }> = {
    real: { label: 'Real', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
    estimated: { label: 'Estimado', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
    incomplete: { label: 'Incompleto', cls: 'bg-muted text-muted-foreground' },
  };
  const m = map[status];
  return <span className={`text-[10px] px-1.5 py-0.5 rounded ${m.cls}`}>{m.label}</span>;
}

function ReportsPage() {
  // Filtros
  const [preset, setPreset] = useState<ReportPreset>('this_month');
  const [orderType, setOrderType] = useState<OrderTypeFilter>('all');
  const [paymentStatus, setPaymentStatus] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [deliveryMethod, setDeliveryMethod] = useState<string>('');

  // Aba ativa
  const [tab, setTab] = useState<'sales' | 'margin' | 'products'>('sales');

  // Dados
  const [cards, setCards] = useState<FinanceReportCards | null>(null);
  const [sales, setSales] = useState<SalesReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  // Margem
  const [marginCards, setMarginCards] = useState<MarginCards | null>(null);
  const [marginRows, setMarginRows] = useState<MarginOrderResult | null>(null);
  const [marginLoading, setMarginLoading] = useState(false);
  const [marginPage, setMarginPage] = useState(1);
  const [marginStatusFilter, setMarginStatusFilter] = useState<
    'all' | 'good' | 'warning' | 'critical' | 'incomplete'
  >('all');

  // Produtos
  const [products, setProducts] = useState<ProductsReportResult | null>(null);
  const [productsLoading, setProductsLoading] = useState(false);

  const filters = useMemo(
    () => ({
      preset,
      orderType,
      paymentStatus: paymentStatus || null,
      paymentMethod: paymentMethod || null,
      deliveryMethod: deliveryMethod || null,
    }),
    [preset, orderType, paymentStatus, paymentMethod, deliveryMethod],
  );

  // Carrega cards globais + vendas
  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      getFinanceReportCards({ data: filters }),
      getSalesReport({ data: { ...filters, page, pageSize: 50 } }),
    ])
      .then(([c, s]) => {
        if (!alive) return;
        setCards(c);
        setSales(s);
      })
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : 'Erro ao carregar relatórios.'),
      )
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [filters, page]);

  // Carrega Margem (lazy quando aba ativa)
  useEffect(() => {
    if (tab !== 'margin') return;
    let alive = true;
    setMarginLoading(true);
    Promise.all([
      getMarginCards({ data: filters }),
      getMarginByOrder({
        data: { ...filters, page: marginPage, pageSize: 50, marginStatus: marginStatusFilter },
      }),
    ])
      .then(([c, r]) => {
        if (!alive) return;
        setMarginCards(c);
        setMarginRows(r);
      })
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : 'Erro ao carregar margem.'),
      )
      .finally(() => {
        if (alive) setMarginLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [tab, filters, marginPage, marginStatusFilter]);

  // Carrega Produtos (lazy)
  useEffect(() => {
    if (tab !== 'products') return;
    let alive = true;
    setProductsLoading(true);
    getProductsReport({ data: filters })
      .then((p) => alive && setProducts(p))
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : 'Erro ao carregar produtos.'),
      )
      .finally(() => alive && setProductsLoading(false));
    return () => {
      alive = false;
    };
  }, [tab, filters]);

  // Reset página quando filtros mudam
  useEffect(() => {
    setPage(1);
    setMarginPage(1);
  }, [preset, orderType, paymentStatus, paymentMethod, deliveryMethod]);

  const cardDefs: CardDef[] = cards
    ? [
        {
          label: 'Faturamento bruto',
          value: brl(cards.grossRevenue),
          delta: cards.deltaGrossRevenue,
          tooltip: 'Total vendido (pedidos pagos) antes de taxas e custos.',
        },
        {
          label: 'Faturamento líquido estimado',
          value: brl(cards.estimatedNetRevenue),
          tooltip: cards.hasEstimatedFees
            ? 'Considera taxa real do Mercado Pago quando disponível, e taxa estimada caso contrário.'
            : 'Considera taxa real do Mercado Pago.',
          warn: cards.hasEstimatedFees,
          hint: cards.hasEstimatedFees ? 'Inclui taxas estimadas' : undefined,
        },
        { label: 'Pedidos pagos', value: String(cards.ordersPaid), delta: cards.deltaOrdersPaid },
        { label: 'Pedidos pendentes', value: String(cards.ordersPending) },
        { label: 'Ticket médio', value: brl(cards.averageTicket), delta: cards.deltaAverageTicket },
        {
          label: 'Custo dos produtos vendidos',
          value: brl(cards.cogs),
          tooltip:
            'Custo dos produtos com base no snapshot gravado no momento da venda (não recalcula com custo atual).',
          warn: cards.hasItemsWithoutCost,
          hint: cards.hasItemsWithoutCost ? 'Há produtos sem custo cadastrado' : undefined,
        },
        {
          label: 'Lucro bruto estimado',
          value: brl(cards.estimatedGrossProfit),
          delta: cards.deltaGrossProfit,
          tooltip:
            'Líquido estimado − custo dos produtos. É uma estimativa, principalmente quando há taxas estimadas ou produtos sem custo.',
          warn: cards.hasItemsWithoutCost || cards.hasEstimatedFees,
        },
        {
          label: 'Margem bruta estimada',
          value: pct(cards.estimatedMarginPercent),
          tooltip: 'Lucro bruto estimado / faturamento bruto.',
        },
        {
          label: 'Taxa Mercado Pago total',
          value: brl(cards.totalMpFees),
          tooltip:
            'Soma das taxas reais e estimadas do Mercado Pago para os pedidos pagos do período.',
        },
        { label: 'Descontos totais', value: brl(cards.totalDiscounts) },
        { label: 'Desconto B2B', value: brl(cards.b2bDiscounts) },
        { label: 'Desconto de cupons', value: brl(cards.couponDiscounts) },
        { label: 'Frete cobrado', value: brl(cards.shippingCharged) },
        {
          label: 'Notas fiscais pendentes',
          value: String(cards.invoicePending),
          warn: cards.invoicePending > 0,
          tooltip:
            'Pedidos pagos com nota fiscal pendente (visão geral, fora do filtro de período).',
        },
      ]
    : [];

  async function handleExport(
    fn: (args: { data: typeof filters }) => Promise<{ filename: string; content: string }>,
    label: string,
  ) {
    try {
      setExporting(true);
      const { filename, content } = await fn({ data: filters });
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exportação de ${label} concluída.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao exportar.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <AdminLayout title="Relatórios financeiros">
      <TooltipProvider delayDuration={150}>
        <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link
                to="/admin"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-3 h-3" /> Voltar ao admin
              </Link>
              <h1 className="font-display text-2xl md:text-3xl font-bold mt-1">
                Relatórios financeiros
              </h1>
              <p className="text-sm text-muted-foreground">
                Acompanhe vendas, margem, descontos, taxas e resultados da loja.
              </p>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground mr-1">Período:</span>
              {PRESETS.map((p) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant={preset === p.id ? 'default' : 'outline'}
                  onClick={() => setPreset(p.id)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Tipo</label>
                <Select value={orderType} onValueChange={(v) => setOrderType(v as OrderTypeFilter)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_TYPES.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Pagamento</label>
                <Select
                  value={paymentStatus || 'all'}
                  onValueChange={(v) => setPaymentStatus(v === 'all' ? '' : v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {PAYMENT_STATUSES.filter((s) => s.id).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Método</label>
                <Select
                  value={paymentMethod || 'all'}
                  onValueChange={(v) => setPaymentMethod(v === 'all' ? '' : v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {PAYMENT_METHODS.filter((s) => s.id).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Entrega</label>
                <Select
                  value={deliveryMethod || 'all'}
                  onValueChange={(v) => setDeliveryMethod(v === 'all' ? '' : v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {DELIVERY_METHODS.filter((s) => s.id).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {cards && (
              <p className="text-xs text-muted-foreground">
                Período analisado:{' '}
                <strong>
                  {fmtDate(cards.rangeFrom)} → {fmtDate(cards.rangeTo)}
                </strong>{' '}
                · comparado com {fmtDate(cards.prevRangeFrom)} → {fmtDate(cards.prevRangeTo)}
              </p>
            )}
          </div>

          {/* Avisos */}
          {cards && (cards.hasEstimatedFees || cards.hasItemsWithoutCost) && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="space-y-0.5">
                {cards.hasEstimatedFees && (
                  <p>
                    Algumas taxas do Mercado Pago são <strong>estimadas</strong>. O líquido pode
                    mudar quando o pagamento for confirmado.
                  </p>
                )}
                {cards.hasItemsWithoutCost && (
                  <p>
                    Existem itens vendidos <strong>sem custo cadastrado</strong>. O lucro pode
                    estar incompleto.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Cards globais */}
          {loading && !cards ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando…
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {cardDefs.map((c) => (
                <MetricCard key={c.label} card={c} />
              ))}
            </div>
          )}

          {/* Abas */}
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="sales">Vendas</TabsTrigger>
              <TabsTrigger value="margin">Margem e lucro</TabsTrigger>
              <TabsTrigger value="products">Produtos</TabsTrigger>
              <TabsTrigger value="b2b" disabled>
                B2B / Atacado · em breve
              </TabsTrigger>
              <TabsTrigger value="coupons" disabled>
                Cupons · em breve
              </TabsTrigger>
              <TabsTrigger value="shipping" disabled>
                Frete · em breve
              </TabsTrigger>
              <TabsTrigger value="mp" disabled>
                Mercado Pago · em breve
              </TabsTrigger>
              <TabsTrigger value="invoices" disabled>
                Notas fiscais · em breve
              </TabsTrigger>
              <TabsTrigger value="utm" disabled>
                Campanhas / UTM · em breve
              </TabsTrigger>
            </TabsList>

            {/* ABA: VENDAS */}
            <TabsContent value="sales" className="space-y-4 mt-4">
              <div className="flex justify-end">
                <Button
                  onClick={() => handleExport(exportSalesReportCsv, 'vendas')}
                  disabled={exporting || !sales}
                  variant="outline"
                  size="sm"
                >
                  {exporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Exportar CSV
                </Button>
              </div>
              {sales && (
                <SalesSection sales={sales} loading={loading} page={page} setPage={setPage} />
              )}
            </TabsContent>

            {/* ABA: MARGEM */}
            <TabsContent value="margin" className="space-y-4 mt-4">
              <MarginSection
                cards={marginCards}
                rows={marginRows}
                loading={marginLoading}
                page={marginPage}
                setPage={setMarginPage}
                statusFilter={marginStatusFilter}
                setStatusFilter={setMarginStatusFilter}
                onExport={() => handleExport(exportMarginByOrderCsv, 'margem')}
                exporting={exporting}
              />
            </TabsContent>

            {/* ABA: PRODUTOS */}
            <TabsContent value="products" className="space-y-4 mt-4">
              <ProductsSection
                data={products}
                loading={productsLoading}
                onExport={() => handleExport(exportProductsReportCsv, 'produtos')}
                exporting={exporting}
              />
            </TabsContent>
          </Tabs>
        </div>
      </TooltipProvider>
    </AdminLayout>
  );
}

// ============================================================
// SECTION: VENDAS
// ============================================================

function SalesSection({
  sales,
  loading,
  page,
  setPage,
}: {
  sales: SalesReportResult;
  loading: boolean;
  page: number;
  setPage: (fn: (p: number) => number) => void;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold">Vendas</h2>
        <span className="text-xs text-muted-foreground">
          {sales.summary.totalOrders} pedido(s) · página {sales.page}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-2">Por tipo</p>
          <div className="flex justify-between text-sm">
            <span>B2C</span>
            <span className="font-medium">
              {sales.summary.byOrderType.b2c.count} · {brl(sales.summary.byOrderType.b2c.total)}
            </span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span>B2B</span>
            <span className="font-medium">
              {sales.summary.byOrderType.b2b.count} · {brl(sales.summary.byOrderType.b2b.total)}
            </span>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-2">Por método de pagamento</p>
          {sales.summary.byPaymentMethod.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            sales.summary.byPaymentMethod.slice(0, 4).map((m) => (
              <div key={m.key} className="flex justify-between text-sm">
                <span className="truncate">{m.label}</span>
                <span className="font-medium">
                  {m.count} · {brl(m.total)}
                </span>
              </div>
            ))
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-2">Por entrega</p>
          {sales.summary.byDeliveryMethod.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            sales.summary.byDeliveryMethod.map((m) => (
              <div key={m.key} className="flex justify-between text-sm">
                <span className="truncate">{m.label}</span>
                <span className="font-medium">
                  {m.count} · {brl(m.total)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Data</th>
                <th className="text-left px-3 py-2">Pedido</th>
                <th className="text-left px-3 py-2">Cliente</th>
                <th className="text-left px-3 py-2">Tipo</th>
                <th className="text-right px-3 py-2">Bruto</th>
                <th className="text-right px-3 py-2">Desc.</th>
                <th className="text-right px-3 py-2">Frete</th>
                <th className="text-right px-3 py-2">Taxa MP</th>
                <th className="text-right px-3 py-2">Líquido</th>
                <th className="text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {sales.rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-muted-foreground">
                    Nenhum pedido no período com esses filtros.
                  </td>
                </tr>
              ) : (
                sales.rows.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {fmtDateTime(r.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to="/admin/pedidos/$orderId"
                        params={{ orderId: r.id }}
                        className="text-primary hover:underline font-medium"
                      >
                        #{r.order_number}
                      </Link>
                    </td>
                    <td className="px-3 py-2 truncate max-w-[200px]">
                      {r.customer_name}
                      {r.company_name && (
                        <span className="block text-xs text-muted-foreground truncate">
                          {r.company_name}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={r.order_type === 'b2b' ? 'default' : 'secondary'}>
                        {r.order_type.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{brl(r.total)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-muted-foreground">
                      {r.discount > 0 ? `-${brl(r.discount)}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-muted-foreground">
                      {brl(r.shipping_cost)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-muted-foreground">
                      {r.mp_fee_amount != null
                        ? brl(r.mp_fee_amount)
                        : r.estimated_fee_amount != null
                          ? `~${brl(r.estimated_fee_amount)}`
                          : '—'}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap font-medium">
                      {brl(r.net_amount)}
                    </td>
                    <td className="px-3 py-2 text-xs">{r.payment_status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {sales.total > sales.pageSize && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-border text-xs">
            <span className="text-muted-foreground">
              {(sales.page - 1) * sales.pageSize + 1}–
              {Math.min(sales.page * sales.pageSize, sales.total)} de {sales.total}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={sales.page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={sales.page * sales.pageSize >= sales.total || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================
// SECTION: MARGEM
// ============================================================

function MarginSection({
  cards,
  rows,
  loading,
  page,
  setPage,
  statusFilter,
  setStatusFilter,
  onExport,
  exporting,
}: {
  cards: MarginCards | null;
  rows: MarginOrderResult | null;
  loading: boolean;
  page: number;
  setPage: (fn: (p: number) => number) => void;
  statusFilter: 'all' | MarginStatus;
  setStatusFilter: (s: 'all' | MarginStatus) => void;
  onExport: () => void;
  exporting: boolean;
}) {
  if (loading && !cards) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando margem…
      </div>
    );
  }
  if (!cards) return null;

  const cardDefs: CardDef[] = [
    { label: 'Receita (pedidos pagos)', value: brl(cards.revenue) },
    {
      label: 'Custo dos produtos vendidos',
      value: brl(cards.cogs),
      tooltip: 'Soma do custo gravado no momento da venda. Não usa custo atual do cadastro.',
      warn: cards.itemsWithoutCost > 0,
    },
    {
      label: 'Lucro bruto estimado',
      value: brl(cards.estimatedGrossProfit),
      tooltip: 'Receita − taxas Mercado Pago − custo dos produtos.',
      warn: cards.hasEstimatedFees || cards.itemsWithoutCost > 0,
    },
    {
      label: 'Margem média ponderada',
      value: pct(cards.averageMarginPercent),
      tooltip: 'Margem ponderada entre os pedidos com cálculo completo.',
    },
    {
      label: 'Pedidos com margem crítica',
      value: String(cards.ordersCritical),
      warn: cards.ordersCritical > 0,
      tooltip: `Margem abaixo de ${pct(cards.defaultMinMargin)} (mínima padrão).`,
    },
    {
      label: 'Pedidos com cálculo incompleto',
      value: String(cards.ordersIncomplete),
      warn: cards.ordersIncomplete > 0,
      tooltip: 'Pedidos com pelo menos um item sem custo cadastrado.',
    },
    {
      label: 'Itens vendidos sem custo',
      value: String(cards.itemsWithoutCost),
      warn: cards.itemsWithoutCost > 0,
    },
    {
      label: 'Produtos sem custo cadastrado',
      value: String(cards.productsWithoutCost),
      warn: cards.productsWithoutCost > 0,
    },
  ];

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cardDefs.map((c) => (
          <MetricCard key={c.label} card={c} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-xl font-bold">Margem por pedido</h2>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | MarginStatus)}>
            <SelectTrigger className="h-8 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as margens</SelectItem>
              <SelectItem value="good">Boa</SelectItem>
              <SelectItem value="warning">Atenção</SelectItem>
              <SelectItem value="critical">Crítica</SelectItem>
              <SelectItem value="incomplete">Incompleta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="outline" onClick={onExport} disabled={exporting}>
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Exportar CSV
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        O custo usado aqui é o custo salvo no momento da venda — alterar o custo de um produto hoje
        não modifica pedidos antigos.
      </p>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Data</th>
                <th className="text-left px-3 py-2">Pedido</th>
                <th className="text-left px-3 py-2">Cliente</th>
                <th className="text-left px-3 py-2">Tipo</th>
                <th className="text-right px-3 py-2">Receita</th>
                <th className="text-right px-3 py-2">Taxa MP</th>
                <th className="text-right px-3 py-2">Custo</th>
                <th className="text-right px-3 py-2">Lucro</th>
                <th className="text-right px-3 py-2">Margem</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Cálculo</th>
              </tr>
            </thead>
            <tbody>
              {!rows || rows.rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-10 text-muted-foreground">
                    Nenhum pedido no período com esses filtros.
                  </td>
                </tr>
              ) : (
                rows.rows.map((r) => <MarginRow key={r.id} row={r} />)
              )}
            </tbody>
          </table>
        </div>
        {rows && rows.total > rows.pageSize && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-border text-xs">
            <span className="text-muted-foreground">
              {(rows.page - 1) * rows.pageSize + 1}–
              {Math.min(rows.page * rows.pageSize, rows.total)} de {rows.total}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={rows.page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={rows.page * rows.pageSize >= rows.total || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function MarginRow({ row }: { row: MarginOrderRow }) {
  const incomplete = row.calc_status === 'incomplete';
  return (
    <tr className="border-t border-border hover:bg-muted/20">
      <td className="px-3 py-2 text-xs whitespace-nowrap">{fmtDateTime(row.created_at)}</td>
      <td className="px-3 py-2">
        <Link
          to="/admin/pedidos/$orderId"
          params={{ orderId: row.id }}
          className="text-primary hover:underline font-medium"
        >
          #{row.order_number}
        </Link>
      </td>
      <td className="px-3 py-2 truncate max-w-[180px]">
        {row.customer_name}
        {row.company_name && (
          <span className="block text-xs text-muted-foreground truncate">{row.company_name}</span>
        )}
      </td>
      <td className="px-3 py-2">
        <Badge variant={row.order_type === 'b2b' ? 'default' : 'secondary'}>
          {row.order_type.toUpperCase()}
        </Badge>
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">{brl(row.revenue)}</td>
      <td className="px-3 py-2 text-right whitespace-nowrap text-muted-foreground">
        {row.fee > 0 ? brl(row.fee) : '—'}
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap text-muted-foreground">
        {incomplete ? <span className="italic text-xs">incompleto</span> : brl(row.cogs)}
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap font-medium">
        {incomplete ? '—' : brl(row.profit)}
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap font-medium">
        {incomplete ? '—' : pct(row.margin_percent)}
      </td>
      <td className="px-3 py-2">
        <MarginStatusBadge status={row.margin_status} />
      </td>
      <td className="px-3 py-2">
        <CalcStatusBadge status={row.calc_status} />
      </td>
    </tr>
  );
}

// ============================================================
// SECTION: PRODUTOS
// ============================================================

function ProductsSection({
  data,
  loading,
  onExport,
  exporting,
}: {
  data: ProductsReportResult | null;
  loading: boolean;
  onExport: () => void;
  exporting: boolean;
}) {
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando produtos…
      </div>
    );
  }
  if (!data) return null;

  const cardDefs: CardDef[] = [
    { label: 'Produtos vendidos', value: String(data.cards.productsCount) },
    { label: 'Quantidade total', value: String(data.cards.qtyTotal) },
    { label: 'Receita por produtos', value: brl(data.cards.revenue) },
    {
      label: 'Custo total',
      value: brl(data.cards.cogs),
      warn: data.cards.productsWithoutCost > 0,
      hint: data.cards.productsWithoutCost > 0 ? 'Há produtos sem custo' : undefined,
    },
    {
      label: 'Lucro estimado',
      value: brl(data.cards.profit),
      tooltip: 'Soma de receita − custo (apenas produtos com custo cadastrado).',
    },
    {
      label: 'Produtos sem custo',
      value: String(data.cards.productsWithoutCost),
      warn: data.cards.productsWithoutCost > 0,
    },
    {
      label: 'Produtos com margem crítica',
      value: String(data.cards.productsCritical),
      warn: data.cards.productsCritical > 0,
    },
  ];

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cardDefs.map((c) => (
          <MetricCard key={c.label} card={c} />
        ))}
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <RankCard title="Top por faturamento" items={data.topByRevenue} mode="revenue" />
        <RankCard title="Top por lucro estimado" items={data.topByProfit} mode="profit" />
        <RankCard title="Top por quantidade" items={data.topByQty} mode="qty" />
      </div>
      {(data.critical.length > 0 || data.withoutCost.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.critical.length > 0 && (
            <RankCard title="Margem crítica" items={data.critical} mode="margin" />
          )}
          {data.withoutCost.length > 0 && (
            <RankCard title="Sem custo cadastrado" items={data.withoutCost} mode="qty" />
          )}
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="font-display text-xl font-bold">Produtos</h2>
        <Button size="sm" variant="outline" onClick={onExport} disabled={exporting}>
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Exportar CSV
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Produto</th>
                <th className="text-left px-3 py-2">SKU</th>
                <th className="text-left px-3 py-2">Categoria</th>
                <th className="text-right px-3 py-2">Qtd</th>
                <th className="text-right px-3 py-2">Receita</th>
                <th className="text-right px-3 py-2">Custo</th>
                <th className="text-right px-3 py-2">Lucro</th>
                <th className="text-right px-3 py-2">Margem</th>
                <th className="text-right px-3 py-2">Preço médio</th>
                <th className="text-right px-3 py-2">Estoque</th>
                <th className="text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-10 text-muted-foreground">
                    Nenhum produto vendido no período.
                  </td>
                </tr>
              ) : (
                data.rows.slice(0, 200).map((r) => (
                  <tr key={r.product_id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2">
                      {r.product_id.startsWith('unknown-') ? (
                        <span>{r.product_name}</span>
                      ) : (
                        <Link
                          to="/admin/produtos/$id"
                          params={{ id: r.product_id }}
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {r.product_name}
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </Link>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.sku ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.category ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{r.qty_sold}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{brl(r.revenue)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-muted-foreground">
                      {r.has_cost ? brl(r.total_cost) : <span className="italic text-xs">sem</span>}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap font-medium">
                      {r.has_cost ? brl(r.profit) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap font-medium">
                      {r.has_cost ? pct(r.margin_percent) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-muted-foreground">
                      {brl(r.avg_price)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-muted-foreground">
                      {r.stock_qty ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <MarginStatusBadge status={r.margin_status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data.rows.length > 200 && (
          <p className="text-xs text-muted-foreground px-3 py-2 border-t border-border">
            Exibindo 200 de {data.rows.length} produtos. Use a exportação CSV para a lista completa.
          </p>
        )}
      </div>
    </section>
  );
}

function RankCard({
  title,
  items,
  mode,
}: {
  title: string;
  items: ProductReportRow[];
  mode: 'revenue' | 'profit' | 'qty' | 'margin';
}) {
  const valueOf = (r: ProductReportRow) => {
    switch (mode) {
      case 'revenue':
        return brl(r.revenue);
      case 'profit':
        return brl(r.profit);
      case 'qty':
        return `${r.qty_sold} un`;
      case 'margin':
        return r.has_cost ? pct(r.margin_percent) : '—';
    }
  };
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs font-medium text-muted-foreground mb-3">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem dados.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((r, i) => (
            <li key={r.product_id} className="flex items-start justify-between gap-2 text-sm">
              <span className="truncate">
                <span className="text-muted-foreground mr-1">{i + 1}.</span>
                {r.product_name}
              </span>
              <span className="font-medium whitespace-nowrap">{valueOf(r)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

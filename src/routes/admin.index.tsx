import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  ShoppingBag,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  Percent,
  Package,
  RotateCcw,
} from "lucide-react";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { getAdminDashboard } from "@/server/dashboard.functions";
import {
  DateRangeFilter,
  computeRange,
  type DashboardRange,
} from "@/components/admin/dashboard/DateRangeFilter";
import { DashboardMetricCard } from "@/components/admin/dashboard/DashboardMetricCard";
import { SalesChart } from "@/components/admin/dashboard/SalesChart";
import { OrderStatusChart } from "@/components/admin/dashboard/OrderStatusChart";
import { PaymentStatusChart } from "@/components/admin/dashboard/PaymentStatusChart";
import { TopProductsChart } from "@/components/admin/dashboard/TopProductsChart";
import { AverageTicketChart } from "@/components/admin/dashboard/AverageTicketChart";
import { RevenueByCategoryChart } from "@/components/admin/dashboard/RevenueByCategoryChart";
import { EmailEventsCard } from "@/components/admin/dashboard/EmailEventsCard";
import { WebhookHealthCard } from "@/components/admin/dashboard/WebhookHealthCard";
import { fmtBRL, fmtInt, fmtPct } from "@/components/admin/dashboard/format";

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

function AdminDashboard() {
  const [range, setRange] = useState<DashboardRange>(() => computeRange("last7"));

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin-dashboard", range.start, range.end],
    queryFn: () => getAdminDashboard({ data: { start: range.start, end: range.end } }),
    staleTime: 60_000,
  });

  const cards = data?.cards;

  return (
    <AdminLayout
      title="Dashboard"
      action={
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-50"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      }
    >
      <div className="mb-6">
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg border border-destructive/40 bg-destructive/10 text-sm text-destructive">
          Erro ao carregar dados do dashboard. Tente atualizar.
        </div>
      )}

      {/* CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mb-8">
        <DashboardMetricCard
          icon={DollarSign}
          label="Receita bruta"
          accent="primary"
          loading={isLoading}
          value={cards ? fmtBRL(cards.grossRevenue) : "—"}
          hint="Pedidos pagos no período"
        />
        <DashboardMetricCard
          icon={ShoppingBag}
          label="Total de pedidos"
          loading={isLoading}
          value={cards ? fmtInt(cards.totalOrders) : "—"}
        />
        <DashboardMetricCard
          icon={CheckCircle2}
          label="Pedidos pagos"
          accent="success"
          loading={isLoading}
          value={cards ? fmtInt(cards.paidOrders) : "—"}
        />
        <DashboardMetricCard
          icon={Clock}
          label="Pedidos pendentes"
          accent="warn"
          loading={isLoading}
          value={cards ? fmtInt(cards.pendingOrders) : "—"}
        />
        <DashboardMetricCard
          icon={XCircle}
          label="Recusados / Cancelados"
          accent="danger"
          loading={isLoading}
          value={cards ? fmtInt(cards.failedOrders) : "—"}
          hint={
            cards && cards.refundedOrders > 0
              ? `+ ${fmtInt(cards.refundedOrders)} reembolso/chargeback`
              : undefined
          }
        />
        <DashboardMetricCard
          icon={TrendingUp}
          label="Ticket médio"
          loading={isLoading}
          value={cards ? fmtBRL(cards.avgTicket) : "—"}
        />
        <DashboardMetricCard
          icon={Percent}
          label="Taxa de aprovação"
          loading={isLoading}
          value={cards ? fmtPct(cards.paymentApprovalRate) : "—"}
          hint="Aprovados / tentativas (aprovados + recusados)"
        />
        <DashboardMetricCard
          icon={Package}
          label="Produtos vendidos"
          loading={isLoading}
          value={cards ? fmtInt(cards.productsSold) : "—"}
          hint="Unidades em pedidos pagos"
        />
      </div>

      {/* GRÁFICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <ChartCard
          title="Vendas por dia"
          subtitle="Receita aprovada e pedidos pagos"
          className="lg:col-span-2"
          loading={isLoading}
        >
          {data && <SalesChart data={data.salesByDay} />}
        </ChartCard>

        <ChartCard title="Status dos pedidos" loading={isLoading}>
          {data && <OrderStatusChart data={data.orderStatus} />}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Status dos pagamentos" loading={isLoading}>
          {data && <PaymentStatusChart data={data.paymentStatus} />}
        </ChartCard>

        <ChartCard
          title="Evolução do ticket médio"
          subtitle="Ticket médio diário"
          loading={isLoading}
        >
          {data && <AverageTicketChart data={data.avgTicketByDay} />}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <ChartCard
          title="Produtos mais vendidos"
          subtitle="Top 10 em pedidos pagos"
          className="lg:col-span-2"
          loading={isLoading}
        >
          {data && <TopProductsChart data={data.topProducts} />}
        </ChartCard>

        <ChartCard title="Receita por categoria" loading={isLoading}>
          {data && (
            <RevenueByCategoryChart
              data={data.revenueByCategory}
              hasCategories={data.hasCategories}
            />
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="E-mails transacionais" loading={isLoading}>
          {data && <EmailEventsCard stats={data.emailStats} />}
        </ChartCard>

        <ChartCard title="Webhooks Mercado Pago" loading={isLoading}>
          {data && <WebhookHealthCard stats={data.webhookStats} />}
        </ChartCard>
      </div>
    </AdminLayout>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  className,
  loading,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
  loading?: boolean;
}) {
  return (
    <section
      className={[
        "bg-card border border-border rounded-xl p-5 flex flex-col gap-3",
        className ?? "",
      ].join(" ")}
    >
      <header>
        <h2 className="font-display font-semibold text-base">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </header>
      {loading ? <div className="h-64 bg-muted/40 animate-pulse rounded-lg" /> : children}
    </section>
  );
}

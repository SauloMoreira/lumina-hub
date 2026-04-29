import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { RotateCcw, ShoppingBag, CheckCircle2, DollarSign, Users, Briefcase, Package, TrendingUp } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminOperations } from '@/server/operations.functions';
import { OperationsCardItem, AlertItem } from '@/components/admin/operations/OperationsCardItem';
import { DashboardMetricCard } from '@/components/admin/dashboard/DashboardMetricCard';
import { fmtBRL, fmtInt } from '@/components/admin/dashboard/format';

export const Route = createFileRoute('/admin/painel-do-dia')({ component: PainelDoDia });

function PainelDoDia() {
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['admin-operations'],
    queryFn: () => getAdminOperations(),
    staleTime: 60_000,
  });

  return (
    <AdminLayout
      title="Painel do Dia"
      action={
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-50"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      }
    >
      <p className="text-sm text-muted-foreground mb-6 -mt-2">
        Veja as principais pendências e oportunidades que precisam da sua atenção hoje.
      </p>

      {error && (
        <div className="mb-6 p-4 rounded-lg border border-destructive/40 bg-destructive/10 text-sm text-destructive">
          Erro ao carregar os dados operacionais. Tente atualizar.
        </div>
      )}

      {/* CARDS PRINCIPAIS */}
      <section className="mb-8">
        <h2 className="font-display font-semibold text-base mb-3">Resumo operacional</h2>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-40 bg-muted/40 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {data.cards.map((c) => (
              <OperationsCardItem key={c.id} card={c} />
            ))}
          </div>
        ) : null}
      </section>

      {/* AÇÕES RECOMENDADAS */}
      {data && (
        <section className="mb-8">
          <h2 className="font-display font-semibold text-base mb-3">Ações recomendadas</h2>
          <RecommendedActions cards={data.cards} />
        </section>
      )}

      {/* OPERAÇÃO DE HOJE */}
      <section className="mb-8">
        <h2 className="font-display font-semibold text-base mb-3">Operação de hoje</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          <DashboardMetricCard
            icon={ShoppingBag}
            label="Pedidos criados hoje"
            loading={isLoading}
            value={data ? fmtInt(data.daily.ordersCreatedToday) : '—'}
          />
          <DashboardMetricCard
            icon={CheckCircle2}
            label="Pedidos pagos hoje"
            accent="success"
            loading={isLoading}
            value={data ? fmtInt(data.daily.ordersPaidToday) : '—'}
          />
          <DashboardMetricCard
            icon={DollarSign}
            label="Faturamento do dia"
            accent="primary"
            loading={isLoading}
            value={data ? fmtBRL(data.daily.revenueToday) : '—'}
          />
          <DashboardMetricCard
            icon={TrendingUp}
            label="Ticket médio do dia"
            loading={isLoading}
            value={data ? fmtBRL(data.daily.avgTicketToday) : '—'}
            hint={data && data.daily.ordersPaidToday === 0 ? 'Sem pedidos pagos hoje ainda.' : undefined}
          />
          <DashboardMetricCard
            icon={Users}
            label="Leads recebidos hoje"
            loading={isLoading}
            value={data ? fmtInt(data.daily.leadsToday) : '—'}
          />
          <DashboardMetricCard
            icon={Briefcase}
            label="Negociações B2B hoje"
            loading={isLoading}
            value={data ? fmtInt(data.daily.b2bNegotiationsToday) : '—'}
          />
          <DashboardMetricCard
            icon={Package}
            label="Produtos vendidos hoje"
            loading={isLoading}
            value={data ? fmtInt(data.daily.productsSoldToday) : '—'}
          />
        </div>
      </section>

      {/* ALERTAS IMPORTANTES */}
      {data && (
        <section className="mb-4">
          <h2 className="font-display font-semibold text-base mb-3">Alertas importantes</h2>
          {data.alerts.length === 0 ? (
            <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-xl p-6 text-center">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600 dark:text-emerald-400 mb-2" />
              <p className="text-sm font-medium">Nenhum alerta no momento.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Sua operação está em ordem. Continue assim!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.alerts
                .slice()
                .sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity))
                .map((a) => (
                  <AlertItem key={a.id} {...a} />
                ))}
            </div>
          )}
        </section>
      )}
    </AdminLayout>
  );
}

function severityWeight(s: 'high' | 'medium' | 'low') {
  return s === 'high' ? 3 : s === 'medium' ? 2 : 1;
}

function RecommendedActions({ cards }: { cards: import('@/server/operations.functions').OperationsCard[] }) {
  // Pega cards com qty > 0 (excluindo "ok") e ordena por status
  const actionable = cards
    .filter((c) => c.qty > 0)
    .sort((a, b) => statusWeight(b.status) - statusWeight(a.status))
    .slice(0, 8);

  if (actionable.length === 0) {
    return (
      <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-xl p-6 text-center">
        <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600 dark:text-emerald-400 mb-2" />
        <p className="text-sm font-medium">Nenhuma ação pendente.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Você está em dia com a operação. Aproveite para revisar campanhas e cadastros.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {actionable.map((c) => (
        <AlertItem
          key={`rec-${c.id}`}
          title={`${c.qty} • ${c.title}`}
          description={c.description}
          severity={c.status === 'danger' ? 'high' : c.status === 'warn' ? 'medium' : 'low'}
          ctaLabel={c.ctaLabel}
          ctaHref={c.ctaHref}
        />
      ))}
    </div>
  );
}

function statusWeight(s: 'ok' | 'warn' | 'danger' | 'unknown') {
  return s === 'danger' ? 3 : s === 'warn' ? 2 : s === 'unknown' ? 1 : 0;
}

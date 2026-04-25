import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Package, ArrowRight, Loader2, ChevronRight } from 'lucide-react';
import { StoreLayout } from '@/components/layout/StoreLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { formatBRL } from '@/lib/domain';
import { listMyOrders } from '@/server/checkout.functions';
import { orderStatusLabel } from '@/lib/orderStatus';

export const Route = createFileRoute('/conta/pedidos')({ component: MyOrders });

type Row = {
  id: string;
  order_number: number;
  status: string;
  payment_status: string | null;
  total: number;
  created_at: string | null;
};

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-warning/15 text-warning',
  awaiting_payment: 'bg-warning/15 text-warning',
  confirmed: 'bg-primary-tint text-primary',
  paid: 'bg-success/15 text-success',
  preparing: 'bg-primary-tint text-primary',
  shipped: 'bg-primary-tint text-primary',
  out_for_delivery: 'bg-primary-tint text-primary',
  delivered: 'bg-success/15 text-success',
  cancelled: 'bg-destructive/15 text-destructive',
  refunded: 'bg-surface text-muted-foreground',
};

function MyOrders() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Row[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: '/login' });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    listMyOrders().then((r) => { setOrders(r.orders as Row[]); setFetching(false); });
  }, [user]);

  if (loading || fetching) {
    return <StoreLayout><div className="container mx-auto px-4 py-12 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Carregando...</div></StoreLayout>;
  }

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary-tint flex items-center justify-center">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <h1 className="font-display font-bold text-2xl tracking-tight">Meus pedidos</h1>
        </div>

        {orders.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <p className="text-muted-foreground mb-5">Você ainda não fez nenhum pedido.</p>
            <Button asChild><Link to="/catalogo">Explorar catálogo <ArrowRight className="w-4 h-4 ml-1.5" /></Link></Button>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {orders.map((o) => {
              const st = { label: orderStatusLabel(o.status), cls: STATUS_CLS[o.status] ?? 'bg-surface text-muted-foreground' };
              return (
                <Link
                  key={o.id}
                  to="/pedido/$id/confirmacao"
                  params={{ id: o.id }}
                  className="flex items-center justify-between p-5 hover:bg-surface transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-display font-bold">#{o.order_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{o.created_at && new Date(o.created_at).toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-display font-bold text-primary">{formatBRL(o.total)}</span>
                    <ChevronRight className="w-4 h-4 text-text-faint" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </StoreLayout>
  );
}

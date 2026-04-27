import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { CheckCircle2, Package, Truck, Clock, ShoppingBag, ArrowRight, Loader2, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { StoreLayout } from '@/components/layout/StoreLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { formatBRL } from '@/lib/domain';
import { getOrderById } from '@/server/checkout.functions';
import { createMercadoPagoPreference } from '@/server/payment.functions';
import { orderStatusLabel } from '@/lib/orderStatus';
import { closeReservedCheckoutWindow, redirectToExternalCheckout, reserveExternalCheckoutWindow } from '@/lib/externalCheckout';

export const Route = createFileRoute('/pedido/$id/confirmacao')({ component: OrderConfirmation });

type OrderRow = {
  id: string;
  order_number: number;
  status: string;
  payment_status: string | null;
  subtotal: number;
  discount: number;
  shipping_cost: number;
  total: number;
  shipping_carrier: string | null;
  shipping_service: string | null;
  address_snapshot: Record<string, unknown> | null;
  created_at: string | null;
  order_items: Array<{
    id: string;
    product_name: string;
    product_image: string | null;
    qty: number;
    unit_price: number;
    total_price: number;
  }>;
};

function OrderConfirmation() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [fetching, setFetching] = useState(true);
  const [payRedirecting, setPayRedirecting] = useState(false);

  async function startPayment() {
    if (!order) return;
    setPayRedirecting(true);
    const checkoutWindow = reserveExternalCheckoutWindow();
    try {
      const r = await createMercadoPagoPreference({ data: { orderId: order.id } });
      if (r.ok && r.checkoutUrl) {
        redirectToExternalCheckout(r.checkoutUrl, checkoutWindow);
      } else {
        closeReservedCheckoutWindow(checkoutWindow);
        toast.error(r.ok ? 'Não foi possível abrir o pagamento' : r.error);
        setPayRedirecting(false);
      }
    } catch (e) {
      closeReservedCheckoutWindow(checkoutWindow);
      toast.error(e instanceof Error ? e.message : 'Erro ao iniciar pagamento');
      setPayRedirecting(false);
    }
  }

  useEffect(() => {
    if (!loading && !user) navigate({ to: '/login' });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const r = await getOrderById({ data: { id } });
      if (r.ok) setOrder(r.order as unknown as OrderRow);
      setFetching(false);
    })();
  }, [user, id]);

  if (loading || fetching) {
    return <StoreLayout><div className="container mx-auto px-4 py-12 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Carregando pedido...</div></StoreLayout>;
  }

  if (!order) {
    return (
      <StoreLayout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="font-display font-bold text-2xl mb-2">Pedido não encontrado</h1>
          <Button asChild><Link to="/conta/pedidos">Ver meus pedidos</Link></Button>
        </div>
      </StoreLayout>
    );
  }

  const addr = (order.address_snapshot ?? {}) as {
    recipient?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-9 h-9 text-success" />
          </div>
          <h1 className="font-display font-bold text-3xl mb-2">Pedido recebido!</h1>
          <p className="text-muted-foreground">Pedido <strong className="text-foreground">#{order.order_number}</strong> · {order.created_at && new Date(order.created_at).toLocaleString('pt-BR')}</p>
          <p className="mt-2 inline-block text-xs px-2 py-1 rounded-full bg-primary-tint text-primary font-medium">{orderStatusLabel(order.status)}</p>
        </div>

        {/* Status timeline */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h2 className="font-display font-semibold mb-5">Status do pedido</h2>
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: CheckCircle2, label: 'Recebido', active: true },
              { icon: Clock, label: 'Pagamento', active: order.payment_status === 'paid' },
              { icon: Package, label: 'Preparando', active: order.status === 'preparing' || order.status === 'shipped' || order.status === 'delivered' },
              { icon: Truck, label: 'Enviado', active: order.status === 'shipped' || order.status === 'delivered' },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center text-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1.5 ${s.active ? 'bg-primary text-primary-foreground' : 'bg-surface text-text-faint'}`}>
                  <s.icon className="w-4 h-4" />
                </div>
                <span className={`text-xs ${s.active ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{s.label}</span>
              </div>
            ))}
          </div>

          {order.payment_status === 'approved' || order.payment_status === 'paid' ? (
            <div className="mt-5 p-4 bg-success/10 border border-success/30 rounded-lg text-sm">
              <p className="font-medium mb-1 text-success">Pagamento aprovado</p>
              <p className="text-muted-foreground text-xs">Recebemos a confirmação. Vamos preparar seu pedido.</p>
            </div>
          ) : order.payment_status === 'pending' || order.payment_status === 'in_process' ? (
            <div className="mt-5 p-4 bg-warning/10 border border-warning/30 rounded-lg text-sm">
              <p className="font-medium mb-1">Pagamento em análise</p>
              <p className="text-muted-foreground text-xs">Estamos confirmando seu pagamento com o Mercado Pago.</p>
            </div>
          ) : (
            <div className="mt-5 p-4 bg-primary-tint border border-primary/30 rounded-lg">
              <p className="font-medium mb-1 text-sm">Pagamento pendente</p>
              <p className="text-muted-foreground text-xs mb-3">Finalize o pagamento de forma segura via Mercado Pago.</p>
              <Button onClick={startPayment} disabled={payRedirecting} className="w-full sm:w-auto h-10">
                {payRedirecting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Abrindo...</> : <><CreditCard className="w-4 h-4 mr-2" />Pagar com Mercado Pago</>}
              </Button>
            </div>
          )}
        </div>

        {/* Itens */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h2 className="font-display font-semibold mb-4">Itens</h2>
          <div className="divide-y divide-border">
            {order.order_items.map((it) => (
              <div key={it.id} className="py-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded bg-surface overflow-hidden flex items-center justify-center shrink-0">
                  {it.product_image ? <img src={it.product_image} alt={it.product_name} className="w-full h-full object-cover" /> : <ShoppingBag className="w-5 h-5 text-text-faint" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm line-clamp-1">{it.product_name}</p>
                  <p className="text-xs text-muted-foreground">{it.qty}× {formatBRL(it.unit_price)}</p>
                </div>
                <div className="font-medium text-sm">{formatBRL(it.total_price)}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatBRL(order.subtotal)}</span></div>
            {order.discount > 0 && <div className="flex justify-between text-success"><span>Desconto</span><span>−{formatBRL(order.discount)}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Frete ({order.shipping_service})</span><span>{order.shipping_cost === 0 ? 'Grátis' : formatBRL(order.shipping_cost)}</span></div>
            <div className="flex justify-between font-display font-bold text-lg pt-2 border-t border-border"><span>Total</span><span className="text-primary">{formatBRL(order.total)}</span></div>
          </div>
        </div>

        {/* Endereço */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h2 className="font-display font-semibold mb-3">Entrega</h2>
          <p className="text-sm">{addr.recipient}</p>
          <p className="text-sm text-muted-foreground">{addr.street}, {addr.number}{addr.complement ? `, ${addr.complement}` : ''}</p>
          <p className="text-sm text-muted-foreground">{addr.neighborhood} · {addr.city}/{addr.state} · CEP {addr.zipCode}</p>
        </div>

        <div className="flex gap-3">
          <Button asChild variant="outline" className="flex-1"><Link to="/conta/pedidos">Meus pedidos</Link></Button>
          <Button asChild className="flex-1"><Link to="/catalogo">Continuar comprando <ArrowRight className="w-4 h-4 ml-1.5" /></Link></Button>
        </div>
      </div>
    </StoreLayout>
  );
}

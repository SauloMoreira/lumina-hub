import { createFileRoute, Link, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { XCircle, ArrowRight, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';
import { StoreLayout } from '@/components/layout/StoreLayout';
import { Button } from '@/components/ui/button';
import { createMercadoPagoPreference } from '@/server/payment.functions';
import { buildSeo } from '@/lib/seo';
import { closeReservedCheckoutWindow, redirectToExternalCheckout, reserveExternalCheckoutWindow } from '@/lib/externalCheckout';

const searchSchema = z.object({
  order_id: z.string().uuid().optional(),
  payment_id: z.string().optional(),
  status: z.string().optional(),
});

export const Route = createFileRoute('/checkout/failure')({
  head: () => buildSeo({ title: 'Pagamento não aprovado', url: '/checkout/failure', noindex: true }),
  validateSearch: (s) => searchSchema.parse(s),
  component: FailurePage,
});

function FailurePage() {
  const { order_id } = useSearch({ from: '/checkout/failure' });
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    if (!order_id) return;
    setRetrying(true);
    const checkoutWindow = reserveExternalCheckoutWindow();
    try {
      const r = await createMercadoPagoPreference({ data: { orderId: order_id } });
      if (r.ok && r.checkoutUrl) {
        redirectToExternalCheckout(r.checkoutUrl, checkoutWindow);
      } else {
        closeReservedCheckoutWindow(checkoutWindow);
        toast.error(r.ok ? 'Não foi possível obter o link de pagamento' : r.error);
      }
    } catch (e) {
      closeReservedCheckoutWindow(checkoutWindow);
      toast.error(e instanceof Error ? e.message : 'Erro ao recriar pagamento');
    } finally {
      setRetrying(false);
    }
  }

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-12 max-w-xl text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/15 flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-9 h-9 text-destructive" />
        </div>
        <h1 className="font-display font-bold text-3xl mb-2">Pagamento não aprovado</h1>
        <p className="text-muted-foreground mb-6">
          Não conseguimos confirmar seu pagamento. Você pode tentar novamente — seu pedido segue reservado.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          {order_id && (
            <Button onClick={retry} disabled={retrying} className="h-11">
              {retrying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gerando link...</> : <>Tentar pagar novamente <ArrowRight className="w-4 h-4 ml-1.5" /></>}
            </Button>
          )}
          {order_id && (
            <Button asChild variant="outline" className="h-11">
              <Link to="/pedido/$id/confirmacao" params={{ id: order_id }}>Ver pedido</Link>
            </Button>
          )}
          <Button asChild variant="ghost" className="h-11">
            <Link to="/catalogo">Voltar ao catálogo</Link>
          </Button>
        </div>
      </div>
    </StoreLayout>
  );
}

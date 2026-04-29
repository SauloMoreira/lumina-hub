import { createFileRoute, Link } from '@tanstack/react-router';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, AlertCircle } from 'lucide-react';
import { StoreLayout } from '@/components/layout/StoreLayout';
import { Button } from '@/components/ui/button';
import { useCart, validateB2bLine } from '@/stores/cartStore';
import { formatBRL, FREE_SHIPPING_THRESHOLD, calcFreeShippingProgress } from '@/lib/domain';

import { buildSeo } from '@/lib/seo';

export const Route = createFileRoute('/carrinho')({
  head: () => buildSeo({ title: 'Carrinho de compras', url: '/carrinho', noindex: true }),
  component: CartPage,
});

function CartPage() {
  const cart = useCart();
  const subtotal = cart.subtotal();
  const freeShip = calcFreeShippingProgress(
    cart.items.map((i) => ({ price: i.price, qty: i.qty, freeShippingEligible: i.freeShippingEligible }))
  );
  const shipping = freeShip.qualifies ? 0 : 25;
  const total = subtotal + shipping;

  const hasB2b = cart.hasB2bItems();
  const continueLink = hasB2b ? '/atacado' : '/catalogo';
  const continueLabel = hasB2b ? 'Continuar comprando no atacado' : 'Continuar comprando';
  const lineValidations = cart.items.map((i) => ({ id: i.productId, validation: validateB2bLine(i) }));
  const hasB2bIssue = lineValidations.some((r) => !r.validation.ok);

  if (cart.items.length === 0) {
    return (
      <StoreLayout>
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-primary-tint flex items-center justify-center mx-auto mb-5">
            <ShoppingBag className="w-9 h-9 text-primary" />
          </div>
          <h1 className="font-display font-bold text-2xl mb-2">Seu carrinho está vazio</h1>
          <p className="text-muted-foreground mb-6">Adicione produtos para continuar.</p>
          <Button asChild size="lg"><Link to="/catalogo">Explorar catálogo</Link></Button>
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="font-display font-bold text-3xl tracking-tight mb-6">Seu carrinho</h1>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card border border-border rounded-xl divide-y divide-border">
            {cart.items.map((item) => (
              <div key={item.productId} className="p-5 flex gap-4">
                <div className="w-20 h-20 rounded-md bg-surface flex items-center justify-center shrink-0 overflow-hidden">
                  {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <ShoppingBag className="w-7 h-7 text-text-faint" />}
                </div>
                <div className="flex-1">
                  <Link to="/produto/$slug" params={{ slug: item.slug }} className="text-sm font-medium hover:text-primary line-clamp-2">{item.name}</Link>
                  <div className="font-display font-bold text-primary mt-1 mb-3">{formatBRL(item.price)}</div>
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center border border-border rounded-md">
                      <button onClick={() => cart.decrementQty(item.productId)} className="w-8 h-8 hover:bg-surface flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                      <span className="w-10 text-center text-sm font-medium">{item.qty}</span>
                      <button onClick={() => cart.incrementQty(item.productId)} className="w-8 h-8 hover:bg-surface flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                    </div>
                    <button onClick={() => cart.removeItem(item.productId)} className="text-text-faint hover:text-destructive p-1.5">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {(item.source === 'b2b' || (item.qtyMultiple ?? 1) > 1 || (item.minQty ?? 1) > 1) && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {(item.minQty ?? 1) > 1 && <>Mín. {item.minQty} un</>}
                      {(item.minQty ?? 1) > 1 && (item.qtyMultiple ?? 1) > 1 && ' · '}
                      {(item.qtyMultiple ?? 1) > 1 && <>Múltiplo de {item.qtyMultiple}</>}
                    </p>
                  )}
                </div>
                <div className="text-right hidden md:block">
                  <div className="font-display font-bold">{formatBRL(item.price * item.qty)}</div>
                </div>
              </div>
            ))}
          </div>

          <aside className="bg-card border border-border rounded-xl p-6 h-fit sticky top-20">
            <h2 className="font-display font-semibold text-lg mb-4">Resumo</h2>
            <div className="space-y-2.5 text-sm mb-5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatBRL(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frete (estimado)</span>
                <span className="font-medium">{shipping === 0 ? <span className="text-success">Grátis</span> : formatBRL(shipping)}</span>
              </div>
              {!freeShip.qualifies && (
                <p className="text-xs text-muted-foreground">
                  {freeShip.hasEligibleItems
                    ? <>Faltam <strong>{formatBRL(freeShip.remaining)}</strong> em produtos participantes para frete grátis.</>
                    : <>Adicione produtos participantes para aproveitar frete grátis acima de {formatBRL(FREE_SHIPPING_THRESHOLD)}.</>}
                </p>
              )}
              <div className="border-t border-border pt-3 flex justify-between items-end">
                <span className="font-medium">Total</span>
                <span className="font-display font-extrabold text-2xl text-primary">{formatBRL(total)}</span>
              </div>
              <p className="text-xs text-muted-foreground text-right">em até 12x de {formatBRL(total / 12)}</p>
            </div>
            <Button asChild size="lg" className="w-full h-12">
              <Link to="/checkout">Finalizar pedido <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="w-full mt-2">
              <Link to={continueLink}>{continueLabel}</Link>
            </Button>
          </aside>
        </div>
      </div>
    </StoreLayout>
  );
}

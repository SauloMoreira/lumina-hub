import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2, MapPin, Truck, CreditCard, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { StoreLayout } from '@/components/layout/StoreLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/stores/cartStore';
import { formatBRL } from '@/lib/domain';
import { lookupCep, calculateShipping, applyCoupon, createOrder } from '@/server/checkout.functions';
import { createMercadoPagoPreference } from '@/server/payment.functions';
import { buildSeo } from '@/lib/seo';
import { trackPurchase, trackBeginCheckout } from '@/lib/tracking';
import { closeReservedCheckoutWindow, redirectToExternalCheckout, reserveExternalCheckoutWindow } from '@/lib/externalCheckout';

export const Route = createFileRoute('/checkout')({
  head: () => buildSeo({ title: 'Finalizar pedido', url: '/checkout', noindex: true }),
  component: CheckoutPage,
});

type ShippingService = { id: string; name: string; carrier: string; price: number; days: number };

function formatCep(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function CheckoutPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const cart = useCart();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);

  // Endereço
  const [zip, setZip] = useState('');
  const [zipLoading, setZipLoading] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [saveAddress, setSaveAddress] = useState(true);

  // Frete
  const [shippingOptions, setShippingOptions] = useState<ShippingService[]>([]);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [selectedShipping, setSelectedShipping] = useState<ShippingService | null>(null);

  // Cupom
  const [couponInput, setCouponInput] = useState('');
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [couponLoading, setCouponLoading] = useState(false);

  const [notes, setNotes] = useState('');

  const subtotal = cart.subtotal();
  const total = useMemo(
    () => Math.max(0, subtotal - discount + (selectedShipping?.price ?? 0)),
    [subtotal, discount, selectedShipping]
  );

  useEffect(() => {
    if (!loading && !user) navigate({ to: '/login' });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!loading && user && cart.items.length === 0) navigate({ to: '/carrinho' });
  }, [user, loading, cart.items.length, navigate]);

  useEffect(() => {
    if (!loading && user && cart.items.length > 0) {
      trackBeginCheckout(subtotal, cart.items.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  useEffect(() => {
    if (user?.user_metadata?.name) setRecipient(user.user_metadata.name as string);
  }, [user]);

  async function handleZipBlur() {
    const clean = zip.replace(/\D/g, '');
    if (clean.length !== 8) return;
    setZipLoading(true);
    try {
      const r = await lookupCep({ data: { cep: clean } });
      if (r.ok) {
        setStreet(r.street);
        setNeighborhood(r.neighborhood);
        setCity(r.city);
        setState(r.state);
      } else {
        toast.error(r.error);
      }
    } finally {
      setZipLoading(false);
    }
  }

  async function goToShipping() {
    const cleanZip = zip.replace(/\D/g, '');
    if (!recipient || !cleanZip || !street || !number || !city || !state) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (cleanZip.length !== 8) {
      toast.error('CEP deve ter 8 dígitos');
      return;
    }
    setStep(2);
    setShippingLoading(true);
    try {
      const weight = cart.items.reduce((s, i) => s + i.qty * 0.5, 0);
      const r = await calculateShipping({
        data: { zipCode: cleanZip, subtotal, weightKg: Math.max(0.5, weight) },
      });
      if ('error' in r && r.error) {
        toast.error(r.error);
        setShippingOptions([]);
        setSelectedShipping(null);
        setStep(1);
        return;
      }
      setShippingOptions(r.services);
      setSelectedShipping(r.services[0] ?? null);
    } catch {
      toast.error('Erro ao calcular frete');
    } finally {
      setShippingLoading(false);
    }
  }

  async function handleApplyCoupon() {
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    try {
      const r = await applyCoupon({ data: { code: couponInput.trim(), subtotal } });
      if (r.valid) {
        setCouponCode(couponInput.trim());
        setDiscount(r.discount);
        toast.success(r.message);
      } else {
        setCouponCode(null);
        setDiscount(0);
        toast.error(r.message);
      }
    } finally {
      setCouponLoading(false);
    }
  }

  async function handleSubmit() {
    if (!selectedShipping) return;
    setSubmitting(true);
    const checkoutWindow = reserveExternalCheckoutWindow();
    try {
      const r = await createOrder({
        data: {
          items: cart.items.map((i) => ({
            productId: i.productId,
            name: i.name,
            image: i.image ?? null,
            unitPrice: i.price,
            qty: i.qty,
          })),
          shipping: {
            carrier: selectedShipping.carrier,
            service: selectedShipping.name,
            cost: selectedShipping.price,
          },
          address: {
            recipient,
            zipCode: zip.replace(/\D/g, ''),
            street,
            number,
            complement: complement || null,
            neighborhood: neighborhood || null,
            city,
            state,
            saveAddress,
          },
          couponCode,
          notes: notes || null,
        },
      });
      if (r.ok) {
        trackPurchase({ order_number: r.orderId, total: cart.subtotal(), items: cart.items });
        // Criar preference do Mercado Pago e redirecionar
        try {
          const pref = await createMercadoPagoPreference({ data: { orderId: r.orderId } });
          if (pref.ok && pref.checkoutUrl) {
            cart.clear();
            redirectToExternalCheckout(pref.checkoutUrl, checkoutWindow);
            return;
          }
          closeReservedCheckoutWindow(checkoutWindow);
          toast.error(pref.ok ? 'Não foi possível abrir o pagamento' : pref.error);
        } catch (err) {
          closeReservedCheckoutWindow(checkoutWindow);
          toast.error(err instanceof Error ? err.message : 'Erro ao iniciar pagamento');
        }
        // Fallback: leva para a página do pedido onde há botão para retomar
        cart.clear();
        navigate({ to: '/pedido/$id/confirmacao', params: { id: r.orderId } });
      } else {
        closeReservedCheckoutWindow(checkoutWindow);
        toast.error(r.error);
      }
    } catch (e) {
      closeReservedCheckoutWindow(checkoutWindow);
      toast.error(e instanceof Error ? e.message : 'Erro ao finalizar pedido');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return <StoreLayout><div className="container mx-auto px-4 py-12 text-center text-muted-foreground">Carregando...</div></StoreLayout>;
  }

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Link to="/carrinho" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar ao carrinho
        </Link>

        {/* Stepper */}
        <div className="flex items-center justify-center mb-8 gap-2 sm:gap-6">
          {[
            { n: 1, label: 'Endereço', icon: MapPin },
            { n: 2, label: 'Frete', icon: Truck },
            { n: 3, label: 'Pagamento', icon: CreditCard },
          ].map((s, idx) => (
            <div key={s.n} className="flex items-center gap-2">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  step >= s.n ? 'bg-primary text-primary-foreground' : 'bg-surface text-text-faint'
                }`}
              >
                {step > s.n ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
              </div>
              <span className={`text-sm font-medium hidden sm:inline ${step >= s.n ? 'text-foreground' : 'text-muted-foreground'}`}>
                {s.label}
              </span>
              {idx < 2 && <div className="w-6 sm:w-12 h-px bg-border mx-1" />}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
            {step === 1 && (
              <>
                <h2 className="font-display font-bold text-xl mb-5">Endereço de entrega</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Label htmlFor="recipient">Destinatário</Label>
                    <Input id="recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="zip">CEP</Label>
                    <div className="relative mt-1.5">
                      <Input
                        id="zip"
                        value={zip}
                        onChange={(e) => setZip(formatCep(e.target.value))}
                        onBlur={handleZipBlur}
                        placeholder="00000-000"
                        maxLength={9}
                        inputMode="numeric"
                        autoComplete="postal-code"
                      />
                      {zipLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="street">Rua</Label>
                    <Input id="street" value={street} onChange={(e) => setStreet(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="number">Número</Label>
                    <Input id="number" value={number} onChange={(e) => setNumber(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="complement">Complemento</Label>
                    <Input id="complement" value={complement} onChange={(e) => setComplement(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="neighborhood">Bairro</Label>
                    <Input id="neighborhood" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="city">Cidade</Label>
                    <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="state">UF</Label>
                    <Input id="state" value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} className="mt-1.5" />
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 mt-5 text-sm">
                  <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="rounded border-border" />
                  Salvar este endereço na minha conta
                </label>
                <Button onClick={goToShipping} size="lg" className="w-full mt-6 h-12">
                  Continuar para o frete <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="font-display font-bold text-xl mb-5">Escolha o frete</h2>
                {shippingLoading ? (
                  <div className="py-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Calculando opções...</div>
                ) : (
                  <div className="space-y-2.5">
                    {shippingOptions.map((s) => (
                      <label
                        key={s.id}
                        className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedShipping?.id === s.id ? 'border-primary bg-primary-tint' : 'border-border hover:border-primary/40'
                        }`}
                      >
                        <input
                          type="radio"
                          name="shipping"
                          checked={selectedShipping?.id === s.id}
                          onChange={() => setSelectedShipping(s)}
                          className="text-primary"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{s.name} <span className="text-muted-foreground font-normal">· {s.carrier}</span></div>
                          <div className="text-xs text-muted-foreground">Entrega em até {s.days} {s.days === 1 ? 'dia útil' : 'dias úteis'}</div>
                        </div>
                        <div className="font-display font-bold">
                          {s.price === 0 ? <span className="text-success">Grátis</span> : formatBRL(s.price)}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-4">
                  💡 Estimativa baseada em região. Frete real será confirmado após integração com Melhor Envio.
                </p>
                <div className="flex gap-3 mt-6">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Voltar</Button>
                  <Button onClick={() => setStep(3)} disabled={!selectedShipping} className="flex-1 h-11">
                    Revisar pedido <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="font-display font-bold text-xl mb-5">Revisão e pagamento</h2>

                <section className="mb-5 pb-5 border-b border-border">
                  <h3 className="font-semibold text-sm mb-2 text-muted-foreground uppercase tracking-wide">Itens</h3>
                  <div className="space-y-2.5">
                    {cart.items.map((i) => (
                      <div key={i.productId} className="flex justify-between items-center text-sm">
                        <span className="line-clamp-1">{i.qty}× {i.name}</span>
                        <span className="font-medium shrink-0 ml-3">{formatBRL(i.price * i.qty)}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="mb-5 pb-5 border-b border-border">
                  <h3 className="font-semibold text-sm mb-2 text-muted-foreground uppercase tracking-wide">Entrega</h3>
                  <p className="text-sm">{recipient}</p>
                  <p className="text-sm text-muted-foreground">{street}, {number}{complement ? `, ${complement}` : ''} — {neighborhood}</p>
                  <p className="text-sm text-muted-foreground">{city}/{state} · CEP {zip}</p>
                  <p className="text-sm mt-2 font-medium">{selectedShipping?.name} · {selectedShipping?.carrier} ({selectedShipping?.days}d)</p>
                </section>

                <section className="mb-5">
                  <h3 className="font-semibold text-sm mb-2 text-muted-foreground uppercase tracking-wide">Pagamento</h3>
                  <div className="p-4 bg-primary-tint border border-primary/30 rounded-lg text-sm">
                    <p className="font-medium mb-1">Pagamento via Mercado Pago</p>
                    <p className="text-muted-foreground text-xs">
                      Ao confirmar, você será redirecionado para o checkout seguro do Mercado Pago (Pix, cartão ou boleto).
                    </p>
                  </div>
                </section>

                <section className="mb-5">
                  <Label htmlFor="notes">Observações (opcional)</Label>
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="mt-1.5 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="Alguma informação adicional para a entrega?"
                  />
                </section>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Voltar</Button>
                  <Button onClick={handleSubmit} disabled={submitting} className="flex-1 h-12">
                    {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processando...</> : <>Finalizar pedido <ArrowRight className="w-4 h-4 ml-1.5" /></>}
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Resumo */}
          <aside className="bg-card border border-border rounded-xl p-6 h-fit lg:sticky lg:top-20">
            <h2 className="font-display font-semibold text-lg mb-4">Resumo</h2>

            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {cart.items.map((i) => (
                <div key={i.productId} className="flex gap-2 items-center text-xs">
                  <div className="w-10 h-10 rounded bg-surface shrink-0 overflow-hidden flex items-center justify-center">
                    {i.image ? <img src={i.image} alt={i.name} className="w-full h-full object-cover" /> : <ShoppingBag className="w-4 h-4 text-text-faint" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="line-clamp-1 font-medium">{i.name}</p>
                    <p className="text-muted-foreground">{i.qty}× {formatBRL(i.price)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mb-4">
              <Input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="Cupom"
                className="h-9"
              />
              <Button onClick={handleApplyCoupon} disabled={couponLoading} variant="outline" size="sm" className="h-9 shrink-0">
                {couponLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Aplicar'}
              </Button>
            </div>

            <div className="space-y-2 text-sm border-t border-border pt-4">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatBRL(subtotal)}</span></div>
              {discount > 0 && (
                <div className="flex justify-between text-success"><span>Desconto ({couponCode})</span><span>−{formatBRL(discount)}</span></div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frete</span>
                <span>{selectedShipping ? (selectedShipping.price === 0 ? <span className="text-success">Grátis</span> : formatBRL(selectedShipping.price)) : '—'}</span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between items-end">
                <span className="font-medium">Total</span>
                <span className="font-display font-extrabold text-2xl text-primary">{formatBRL(total)}</span>
              </div>
              <p className="text-xs text-muted-foreground text-right">em até 12x de {formatBRL(total / 12)}</p>
            </div>
          </aside>
        </div>
      </div>
    </StoreLayout>
  );
}

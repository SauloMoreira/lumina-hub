import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Package, Info, AlertTriangle } from 'lucide-react';
import { useCart } from '@/stores/cartStore';
import { formatBRL } from '@/lib/domain';
import {
  getCartBundlePreview,
  type CartBundlePreviewRow,
} from '@/server/cartBundlePreview.functions';

const STATUS_LABEL: Record<CartBundlePreviewRow['status'], string> = {
  eligible_preview: 'Combo elegível',
  not_eligible: 'Sem desconto',
  blocked_by_b2b: 'Não acumula com B2B',
  blocked_by_coupon: 'Não acumula com cupom',
  missing_items: 'Faltam itens',
  expired: 'Fora da validade',
  inactive: 'Inativo',
  needs_review: 'Em revisão',
};

const STATUS_TONE: Record<CartBundlePreviewRow['status'], string> = {
  eligible_preview: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  not_eligible: 'bg-muted text-muted-foreground border-border',
  blocked_by_b2b: 'bg-amber-50 text-amber-700 border-amber-200',
  blocked_by_coupon: 'bg-amber-50 text-amber-700 border-amber-200',
  missing_items: 'bg-muted text-muted-foreground border-border',
  expired: 'bg-muted text-muted-foreground border-border',
  inactive: 'bg-muted text-muted-foreground border-border',
  needs_review: 'bg-muted text-muted-foreground border-border',
};

export function CartBundlePreview({ hasCoupon = false }: { hasCoupon?: boolean }) {
  const cart = useCart();
  const items = cart.items.map((i) => ({ product_id: i.productId, qty: i.qty }));

  const { data } = useQuery({
    queryKey: [
      'cart-bundle-preview',
      hasCoupon,
      items.map((i) => `${i.product_id}:${i.qty}`).join('|'),
    ],
    queryFn: () => getCartBundlePreview({ data: { items, hasCoupon } }),
    enabled: items.length > 0,
    staleTime: 15_000,
  });

  const rows = data ?? [];
  if (rows.length === 0) return null;

  // Mostrar apenas combos relevantes ao cliente: elegíveis ou que faltam só itens.
  const visible = rows.filter(
    (r) =>
      r.status === 'eligible_preview' ||
      r.status === 'missing_items' ||
      r.status === 'blocked_by_b2b' ||
      r.status === 'blocked_by_coupon'
  );
  if (visible.length === 0) return null;

  const totalEstimated = visible
    .filter((r) => r.status === 'eligible_preview')
    .reduce((acc, r) => acc + r.estimated_discount, 0);

  return (
    <section
      aria-labelledby="cart-bundle-preview-heading"
      className="mt-6 rounded-xl border border-border bg-card p-4"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" aria-hidden />
          <h2 id="cart-bundle-preview-heading" className="text-sm font-semibold">
            Kits e combos no seu carrinho
          </h2>
        </div>
        {totalEstimated > 0 && (
          <span className="text-xs text-emerald-700 font-medium">
            Economia estimada: {formatBRL(totalEstimated)}
          </span>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground mb-3">
        Esta é uma prévia. O desconto será confirmado pelo backend no checkout.
      </p>

      <ul className="space-y-2">
        {visible.map((r) => (
          <li
            key={r.bundle_id}
            className="rounded-md border border-border bg-surface/40 p-3 text-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {r.bundle_slug ? (
                    <Link
                      to="/combo/$slug"
                      params={{ slug: r.bundle_slug }}
                      className="font-medium text-foreground hover:text-primary truncate"
                    >
                      {r.bundle_name}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground truncate">
                      {r.bundle_name}
                    </span>
                  )}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_TONE[r.status]}`}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                {r.status === 'eligible_preview' && r.estimated_discount > 0 && (
                  <div className="mt-1 text-emerald-700">
                    Desconto estimado: {formatBRL(r.estimated_discount)} sobre{' '}
                    {formatBRL(r.eligible_subtotal)}
                  </div>
                )}
                {r.status === 'missing_items' && r.missing_items.length > 0 && (
                  <div className="mt-1 text-muted-foreground">
                    Faltam:{' '}
                    {r.missing_items
                      .map((m) =>
                        m.reason === 'low_qty'
                          ? `${m.product_name} (${m.cart_qty}/${m.required_qty})`
                          : m.product_name
                      )
                      .join(', ')}
                  </div>
                )}
                {r.reason && r.status !== 'eligible_preview' && (
                  <div className="mt-1 text-muted-foreground">{r.reason}</div>
                )}
                {r.warnings.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {r.warnings.map((w, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-1.5 text-amber-700"
                      >
                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" aria-hidden />
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <Info className="w-3 h-3 mt-0.5 shrink-0" aria-hidden />
        <span>
          O total atual do carrinho ainda não considera este desconto. A aplicação
          definitiva acontecerá em uma próxima etapa.
        </span>
      </div>
    </section>
  );
}

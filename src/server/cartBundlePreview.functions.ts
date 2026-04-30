import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export type CartBundlePreviewStatus =
  | 'eligible_preview'
  | 'not_eligible'
  | 'blocked_by_b2b'
  | 'blocked_by_coupon'
  | 'missing_items'
  | 'expired'
  | 'inactive'
  | 'needs_review';

export type CartBundleConsideredItem = {
  product_id: string;
  product_name: string;
  product_slug: string | null;
  image: string | null;
  required_qty: number;
  cart_qty: number;
  is_required: boolean;
  unit_price: number;
  pricing_source: 'b2b' | 'retail';
};

export type CartBundleMissingItem = {
  product_id: string;
  product_name: string;
  product_slug: string | null;
  required_qty: number;
  cart_qty: number;
  is_required: boolean;
  reason: 'inactive' | 'no_price' | 'missing' | 'low_qty' | 'ok';
};

export type CartBundlePreviewRow = {
  bundle_id: string;
  bundle_slug: string | null;
  bundle_name: string;
  bundle_image: string | null;
  discount_type: 'none' | 'fixed_amount' | 'percentage';
  discount_value: number;
  status: CartBundlePreviewStatus;
  eligible_subtotal: number;
  estimated_discount: number;
  considered_items: CartBundleConsideredItem[];
  missing_items: CartBundleMissingItem[];
  reason: string | null;
  warnings: string[];
};

const Input = z.object({
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        qty: z.number().int().min(1).max(99999),
      })
    )
    .min(0)
    .max(200),
  hasCoupon: z.boolean().optional(),
});

async function getOptionalUserId(): Promise<string | null> {
  try {
    const { getRequestHeader } = await import('@tanstack/react-start/server');
    const auth = getRequestHeader('Authorization') || getRequestHeader('authorization');
    if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null;
    const token = auth.slice(7).trim();
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data } = await supabaseAdmin.auth.getUser(token);
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Server function: prévia (somente leitura) dos descontos de combo aplicáveis
 * ao carrinho. NÃO altera total real, checkout, pedido ou Mercado Pago.
 */
export const getCartBundlePreview = createServerFn({ method: 'POST' })
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data }): Promise<CartBundlePreviewRow[]> => {
    if (!data.items || data.items.length === 0) return [];
    const userId = await getOptionalUserId();
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: rows, error } = await supabaseAdmin.rpc('validate_cart_bundles', {
      _user_id: (userId ?? null) as unknown as string,
      _items: data.items,
      _has_coupon: data.hasCoupon ?? false,
    });
    if (error) {
      console.error('[getCartBundlePreview] rpc error:', error);
      return [];
    }
    const list = (rows ?? []) as Array<Record<string, unknown>>;
    return list.map((r) => ({
      bundle_id: String(r.bundle_id),
      bundle_slug: (r.bundle_slug as string | null) ?? null,
      bundle_name: String(r.bundle_name ?? ''),
      bundle_image: (r.bundle_image as string | null) ?? null,
      discount_type: (r.discount_type as CartBundlePreviewRow['discount_type']) ?? 'none',
      discount_value: Number(r.discount_value ?? 0),
      status: (r.status as CartBundlePreviewStatus) ?? 'not_eligible',
      eligible_subtotal: Number(r.eligible_subtotal ?? 0),
      estimated_discount: Number(r.estimated_discount ?? 0),
      considered_items: Array.isArray(r.considered_items)
        ? (r.considered_items as CartBundleConsideredItem[])
        : [],
      missing_items: Array.isArray(r.missing_items)
        ? (r.missing_items as CartBundleMissingItem[])
        : [],
      reason: (r.reason as string | null) ?? null,
      warnings: Array.isArray(r.warnings) ? (r.warnings as string[]) : [],
    }));
  });

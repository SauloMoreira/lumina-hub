import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

const ItemSchema = z.object({
  code: z.string().trim().min(1).max(120),
  qty: z.number().int().min(1).max(99999),
});

const InputSchema = z.object({
  items: z.array(ItemSchema).min(1).max(100),
});

export type QuickBuyMatchStatus =
  | 'found'
  | 'not_found'
  | 'multiple_matches'
  | 'invalid_quantity'
  | 'inactive_product'
  | 'no_price'
  | 'out_of_stock';

export type QuickBuyMultipleOption = {
  product_id: string;
  name: string;
  slug: string;
  sku: string | null;
  ean: string | null;
  brand: string | null;
  image_url: string | null;
  retail_price: number | null;
};

export type QuickBuyResolvedLine = {
  line_index: number;
  original_code: string;
  normalized_code: string;
  requested_quantity: number;
  match_status: QuickBuyMatchStatus;
  product_id: string | null;
  product_name: string | null;
  product_slug: string | null;
  sku: string | null;
  ean: string | null;
  brand: string | null;
  category_id: string | null;
  image_url: string | null;
  retail_price: number | null;
  sale_price: number | null;
  applied_preview_price: number | null;
  pricing_source_preview: 'retail' | 'b2b' | 'unavailable';
  b2b_enabled: boolean;
  b2b_price: number | null;
  b2b_min_quantity: number | null;
  b2b_qty_multiple: number | null;
  b2b_discount_amount: number | null;
  b2b_discount_percent: number | null;
  has_stock: boolean;
  available_stock: number;
  warnings: string[];
  matched_via: 'sku' | 'ean' | 'name' | 'none';
  multiple_options: QuickBuyMultipleOption[] | null;
};

export type QuickBuyResolveResult = {
  company_approved: boolean;
  lines: QuickBuyResolvedLine[];
  retail_subtotal: number;
  applied_preview_subtotal: number;
  estimated_savings: number;
};

async function getCurrentUserId(): Promise<string | null> {
  try {
    const { getRequestHeader } = await import('@tanstack/react-start/server');
    const auth = getRequestHeader('Authorization') || getRequestHeader('authorization');
    if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null;
    const token = auth.slice(7).trim();
    const { data } = await supabaseAdmin.auth.getUser(token);
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export const resolveQuickBuyCodes = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<QuickBuyResolveResult> => {
    const userId = await getCurrentUserId();

    const { data: rows, error } = await (supabaseAdmin as any).rpc('resolve_codes_bulk', {
      _user_id: userId,
      _items: data.items.map((it) => ({ code: it.code, qty: it.qty })),
    });

    if (error) {
      console.error('[resolveQuickBuyCodes] RPC error', error);
      throw new Error('Falha ao resolver códigos');
    }

    let companyApproved = false;
    if (userId) {
      const { data: cid } = await (supabaseAdmin as any).rpc('get_user_approved_company_id', {
        _user_id: userId,
      });
      companyApproved = !!cid;
    }

    const lines: QuickBuyResolvedLine[] = (rows ?? []).map((r: any) => ({
      line_index: Number(r.line_index ?? 0),
      original_code: r.original_code ?? '',
      normalized_code: r.normalized_code ?? '',
      requested_quantity: Number(r.requested_quantity ?? 0),
      match_status: r.match_status as QuickBuyMatchStatus,
      product_id: r.product_id ?? null,
      product_name: r.product_name ?? null,
      product_slug: r.product_slug ?? null,
      sku: r.sku ?? null,
      ean: r.ean ?? null,
      brand: r.brand ?? null,
      category_id: r.category_id ?? null,
      image_url: r.image_url ?? null,
      retail_price: num(r.retail_price),
      sale_price: num(r.sale_price),
      applied_preview_price: num(r.applied_preview_price),
      pricing_source_preview:
        (r.pricing_source_preview as QuickBuyResolvedLine['pricing_source_preview']) ?? 'unavailable',
      b2b_enabled: r.b2b_enabled === true,
      b2b_price: num(r.b2b_price),
      b2b_min_quantity: r.b2b_min_quantity != null ? Number(r.b2b_min_quantity) : null,
      b2b_qty_multiple: r.b2b_qty_multiple != null ? Number(r.b2b_qty_multiple) : null,
      b2b_discount_amount: num(r.b2b_discount_amount),
      b2b_discount_percent: num(r.b2b_discount_percent),
      has_stock: r.has_stock === true,
      available_stock: Number(r.available_stock ?? 0),
      warnings: Array.isArray(r.warnings) ? r.warnings : [],
      matched_via: (r.matched_via as QuickBuyResolvedLine['matched_via']) ?? 'none',
      multiple_options: Array.isArray(r.multiple_options)
        ? (r.multiple_options as QuickBuyMultipleOption[])
        : null,
    }));

    let retailSubtotal = 0;
    let appliedSubtotal = 0;
    for (const ln of lines) {
      if (ln.match_status === 'found' && ln.applied_preview_price != null) {
        const r = ln.sale_price ?? ln.retail_price ?? ln.applied_preview_price;
        retailSubtotal += r * ln.requested_quantity;
        appliedSubtotal += ln.applied_preview_price * ln.requested_quantity;
      }
    }

    return {
      company_approved: companyApproved,
      lines,
      retail_subtotal: Math.round(retailSubtotal * 100) / 100,
      applied_preview_subtotal: Math.round(appliedSubtotal * 100) / 100,
      estimated_savings: Math.max(0, Math.round((retailSubtotal - appliedSubtotal) * 100) / 100),
    };
  });

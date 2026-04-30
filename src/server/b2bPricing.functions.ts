import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

/**
 * Resultado da validação de precificação para um item.
 * Reflete o JSON devolvido pela função SQL `validate_b2b_pricing`.
 */
export type B2bPricedItem = {
  product_id: string;
  qty: number;
  available: boolean;
  name?: string;
  stock_qty?: number;
  retail_unit_price?: number;
  b2b_unit_price?: number | null;
  applied_unit_price?: number;
  pricing_source?: 'retail' | 'b2b';
  b2b_discount_unit?: number;
  b2b_discount_total?: number;
  b2b_min_quantity?: number;
  b2b_qty_multiple?: number;
  b2b_valid_until?: string | null;
  /**
   * Códigos:
   *  - product_unavailable
   *  - company_not_approved
   *  - b2b_not_enabled
   *  - no_b2b_price
   *  - b2b_expired
   *  - below_min_qty
   *  - invalid_multiple
   *  - b2b_applied
   */
  reason: string;
};

export type B2bPricingResult = {
  company_approved: boolean;
  company: {
    id: string;
    legal_name: string;
    trade_name: string | null;
    cnpj: string;
    contact_name: string;
  } | null;
  items: B2bPricedItem[];
  retail_subtotal: number;
  applied_subtotal: number;
  b2b_discount_total: number;
  has_b2b_items: boolean;
  validated_at: string;
};

/**
 * Mensagens amigáveis por código de motivo.
 * Usadas no carrinho e no checkout para explicar bloqueios.
 */
export function describeB2bReason(reason: string, item?: B2bPricedItem): string | null {
  switch (reason) {
    case 'b2b_applied':
      return null;
    case 'company_not_approved':
      return 'Faça login com uma empresa aprovada para acessar o preço empresa.';
    case 'b2b_not_enabled':
      return 'Este produto não tem condição B2B ativa.';
    case 'no_b2b_price':
      return 'Preço empresa ainda não configurado para este produto.';
    case 'b2b_expired':
      return 'A condição B2B deste produto expirou.';
    case 'below_min_qty':
      return `Para acessar o preço empresa, compre a partir de ${item?.b2b_min_quantity ?? 1} unidades.`;
    case 'invalid_multiple':
      return `Este produto deve ser comprado em múltiplos de ${item?.b2b_qty_multiple ?? 1} unidades a partir de ${item?.b2b_min_quantity ?? 1}.`;
    case 'product_unavailable':
      return 'Produto indisponível no momento.';
    default:
      return null;
  }
}

/**
 * Wrapper isomórfico: chama a função SQL `validate_b2b_pricing` via service role
 * (é puramente de leitura/cálculo, mas usamos admin para evitar RLS interferir).
 */
export async function computeB2bPricing(params: {
  userId: string | null;
  items: Array<{ productId: string; qty: number }>;
}): Promise<B2bPricingResult> {
  const payload = params.items.map((i) => ({
    product_id: i.productId,
    qty: Math.max(1, Math.floor(i.qty || 1)),
  }));
  const { data, error } = await supabaseAdmin.rpc('validate_b2b_pricing' as never, {
    _user_id: params.userId,
    _items: payload,
  } as never);
  if (error) {
    console.error('[computeB2bPricing] rpc err', error);
    throw new Error('Falha ao validar precificação B2B.');
  }
  return data as unknown as B2bPricingResult;
}

const PriceCartInput = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        qty: z.number().int().min(1).max(9999),
      }),
    )
    .min(1)
    .max(200),
});

/**
 * Server function pública usada pelo carrinho/checkout para obter
 * o preço autoritativo de cada item.
 *
 * - Não exige auth (visitante anônimo recebe sempre preço de varejo).
 * - Para usuário logado, identifica empresa aprovada e aplica regras B2B.
 */
export const getCartPricing = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => PriceCartInput.parse(input))
  .handler(async ({ data }) => {
    // Identifica usuário sem exigir auth (cabeçalho Authorization opcional).
    let userId: string | null = null;
    try {
      const { getRequestHeader } = await import('@tanstack/react-start/server');
      const auth = getRequestHeader('Authorization') || getRequestHeader('authorization');
      if (auth && auth.toLowerCase().startsWith('bearer ')) {
        const token = auth.slice(7).trim();
        const { data: userRes } = await supabaseAdmin.auth.getUser(token);
        userId = userRes.user?.id ?? null;
      }
    } catch {
      userId = null;
    }
    return computeB2bPricing({ userId, items: data.items });
  });

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

// Re-exporta tipos e helpers compartilhados (seguros para o cliente).
export {
  describeB2bReason,
  type B2bPricedItem,
  type B2bPricingResult,
} from '@/lib/b2bPricingShared';
import type { B2bPricingResult } from '@/lib/b2bPricingShared';

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

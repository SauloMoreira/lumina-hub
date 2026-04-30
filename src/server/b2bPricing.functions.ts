import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

// Re-exporta tipos e helpers compartilhados (seguros para o cliente).
export {
  describeB2bReason,
  type B2bPricedItem,
  type B2bPricingResult,
} from '@/lib/b2bPricingShared';

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
 */
export const getCartPricing = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => PriceCartInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
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
    const { computeB2bPricing } = await import('./b2bPricing.server');
    return computeB2bPricing({ userId, items: data.items });
  });

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { B2bPricingResult } from "@/lib/b2bPricingShared";

export async function computeB2bPricing(params: {
  userId: string | null;
  items: Array<{ productId: string; qty: number }>;
}): Promise<B2bPricingResult> {
  const payload = params.items.map((i) => ({
    product_id: i.productId,
    qty: Math.max(1, Math.floor(i.qty || 1)),
  }));
  const { data, error } = await supabaseAdmin.rpc(
    "validate_b2b_pricing" as never,
    {
      _user_id: params.userId,
      _items: payload,
    } as never,
  );
  if (error) {
    console.error("[computeB2bPricing] rpc err", error);
    throw new Error("Falha ao validar precificação B2B.");
  }
  return data as unknown as B2bPricingResult;
}

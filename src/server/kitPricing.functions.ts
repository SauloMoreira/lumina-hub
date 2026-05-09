import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { computeKitPricing, type KitPricingResult } from "@/lib/kitPricing";

/**
 * Resolve aprovação B2B do usuário atual (a partir do header Authorization).
 */
async function resolveB2bApproval(): Promise<boolean> {
  try {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const auth = getRequestHeader("Authorization") || getRequestHeader("authorization");
    if (!auth || !auth.toLowerCase().startsWith("bearer ")) return false;
    const token = auth.slice(7).trim();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userRes } = await supabaseAdmin.auth.getUser(token);
    const userId = userRes.user?.id;
    if (!userId) return false;
    const { data: cid } = await (supabaseAdmin as unknown as {
      rpc: (n: string, a: unknown) => Promise<{ data: string | null }>;
    }).rpc("get_user_approved_company_id", { _user_id: userId });
    return !!cid;
  } catch {
    return false;
  }
}

const Input = z.object({
  bundleId: z.string().uuid(),
  kitQuantity: z.number().int().min(1).max(9999).optional(),
});

export type GetKitPricingResult = KitPricingResult & {
  isB2bApproved: boolean;
};

export const getKitPricing = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data }): Promise<GetKitPricingResult | null> => {
    const { loadKitPricingForBundle } = await import("@/server/kitPricing.server");
    const isB2bApproved = await resolveB2bApproval();
    const result = await loadKitPricingForBundle(data.bundleId, isB2bApproved, data.kitQuantity ?? 1);
    if (!result) return null;
    return { ...result, isB2bApproved };
  });

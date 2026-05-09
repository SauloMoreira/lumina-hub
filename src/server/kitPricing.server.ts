/**
 * Helper server-only para carregar a precificação de um kit a partir do banco.
 */
import { computeKitPricing, type KitPricingResult, type KitConfig, type KitItemForPricing } from "@/lib/kitPricing";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function loadKitPricingForBundle(
  bundleId: string,
  isB2bApproved: boolean,
  kitQuantity = 1,
): Promise<KitPricingResult | null> {
  const { data, error } = await supabaseAdmin
    .from("product_bundles")
    .select(
      `id, kit_type, pricing_method, fixed_price, discount_percent, discount_amount,
       available_retail, available_b2b, b2b_pricing_method, b2b_fixed_price,
       b2b_extra_discount_percent, b2b_min_quantity, accepts_coupon, stack_with_b2b,
       items:product_bundle_items (
         quantity,
         product:products (price, sale_price, b2b_enabled, b2b_price, cost_price, active)
       )`,
    )
    .eq("id", bundleId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as Record<string, unknown>;

  const kit: KitConfig = {
    kit_type: (row.kit_type as KitConfig["kit_type"]) ?? "combinado",
    pricing_method: (row.pricing_method as KitConfig["pricing_method"]) ?? "sum",
    fixed_price: row.fixed_price != null ? Number(row.fixed_price) : null,
    discount_percent: row.discount_percent != null ? Number(row.discount_percent) : null,
    discount_amount: row.discount_amount != null ? Number(row.discount_amount) : null,
    available_retail: row.available_retail !== false,
    available_b2b: !!row.available_b2b,
    b2b_pricing_method: (row.b2b_pricing_method as KitConfig["b2b_pricing_method"]) ?? "inherit",
    b2b_fixed_price: row.b2b_fixed_price != null ? Number(row.b2b_fixed_price) : null,
    b2b_extra_discount_percent:
      row.b2b_extra_discount_percent != null ? Number(row.b2b_extra_discount_percent) : null,
    b2b_min_quantity: Number(row.b2b_min_quantity ?? 1),
    accepts_coupon: row.accepts_coupon !== false,
    stack_with_b2b: !!row.stack_with_b2b,
  };

  const itemRows = (row.items as Array<Record<string, unknown>>) ?? [];
  const items: KitItemForPricing[] = itemRows
    .map((it) => {
      const p = it.product as Record<string, unknown> | null;
      if (!p || p.active === false) return null;
      const retail = Number(p.price ?? 0);
      const sale = p.sale_price != null ? Number(p.sale_price) : null;
      const finalPrice = sale != null && sale > 0 ? sale : retail;
      return {
        quantity: Number(it.quantity ?? 1),
        retail_unit_price: finalPrice,
        b2b_unit_price: p.b2b_price != null ? Number(p.b2b_price) : null,
        cost_unit_price: p.cost_price != null ? Number(p.cost_price) : null,
        b2b_enabled: !!p.b2b_enabled,
      } satisfies KitItemForPricing;
    })
    .filter((x): x is KitItemForPricing => x !== null);

  return computeKitPricing({ kit, items, isB2bApproved, kitQuantity });
}

/**
 * Engine pura de precificação de kits/combos.
 * Sem dependência de Supabase — segura no bundle do browser e do servidor.
 */

export type KitType = "combinado" | "promocional" | "b2b" | "estrutural";

export type KitPricingMethod =
  | "sum"
  | "percent_discount"
  | "fixed_discount"
  | "fixed_price";

export type KitB2bPricingMethod = "inherit" | "fixed_price" | "extra_discount";

export type KitConfig = {
  kit_type: KitType;
  pricing_method: KitPricingMethod;
  fixed_price: number | null;
  discount_percent: number | null;
  discount_amount: number | null;
  available_retail: boolean;
  available_b2b: boolean;
  b2b_pricing_method: KitB2bPricingMethod;
  b2b_fixed_price: number | null;
  b2b_extra_discount_percent: number | null;
  b2b_min_quantity: number;
  accepts_coupon: boolean;
  stack_with_b2b: boolean;
};

export type KitItemForPricing = {
  quantity: number;
  retail_unit_price: number; // preço final varejo (com sale aplicado)
  b2b_unit_price: number | null; // preço B2B do produto, se cadastrado
  cost_unit_price: number | null; // custo, para margem (admin only)
  b2b_enabled: boolean;
};

export type KitPricingBlocked =
  | "not_available_retail"
  | "not_available_b2b"
  | "below_min_qty"
  | "no_items";

export type KitPricingResult = {
  source: "retail" | "b2b";
  retailSum: number; // soma de retail_unit * qty (sempre)
  b2bInheritSum: number; // soma de b2b_unit * qty (fallback retail quando produto sem B2B)
  appliedPrice: number; // preço final aplicado ao kit (nunca negativo)
  savings: number; // retailSum - appliedPrice (>= 0)
  unitApprox: number | null; // appliedPrice / total_units, quando faz sentido
  totalUnits: number;
  blocked: KitPricingBlocked | null;
  marginAvailable: boolean; // todos os componentes têm cost_price > 0
  costSum: number | null; // soma de custos quando marginAvailable
  marginAmount: number | null; // appliedPrice - costSum
  marginPercent: number | null; // marginAmount / appliedPrice * 100
  belowCost: boolean; // appliedPrice < costSum
};

export type KitPricingInput = {
  kit: KitConfig;
  items: KitItemForPricing[];
  isB2bApproved: boolean;
  /** Quantidade de kits sendo comprada (para validar b2b_min_quantity). */
  kitQuantity?: number;
};

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

function clampNonNeg(v: number) {
  return v < 0 ? 0 : round2(v);
}

function applyRetailMethod(retailSum: number, kit: KitConfig): number {
  switch (kit.pricing_method) {
    case "sum":
      return round2(retailSum);
    case "percent_discount": {
      const pct = Math.min(100, Math.max(0, Number(kit.discount_percent ?? 0)));
      return clampNonNeg(retailSum - retailSum * (pct / 100));
    }
    case "fixed_discount": {
      const off = Math.max(0, Number(kit.discount_amount ?? 0));
      return clampNonNeg(retailSum - off);
    }
    case "fixed_price": {
      const fp = Math.max(0, Number(kit.fixed_price ?? 0));
      return round2(fp);
    }
  }
}

export function computeKitPricing(input: KitPricingInput): KitPricingResult {
  const { kit, items, isB2bApproved } = input;
  const kitQty = Math.max(1, Math.floor(input.kitQuantity ?? 1));

  const totalUnits = items.reduce((acc, it) => acc + it.quantity, 0);
  const retailSum = round2(
    items.reduce((acc, it) => acc + it.retail_unit_price * it.quantity, 0),
  );
  const b2bInheritSum = round2(
    items.reduce((acc, it) => {
      const unit =
        it.b2b_enabled && it.b2b_unit_price != null && it.b2b_unit_price > 0
          ? it.b2b_unit_price
          : it.retail_unit_price;
      return acc + unit * it.quantity;
    }, 0),
  );

  const allHaveCost = items.length > 0 && items.every((it) => it.cost_unit_price != null && it.cost_unit_price >= 0);
  const costSum = allHaveCost
    ? round2(items.reduce((acc, it) => acc + (it.cost_unit_price ?? 0) * it.quantity, 0))
    : null;

  if (items.length === 0) {
    return {
      source: "retail",
      retailSum: 0,
      b2bInheritSum: 0,
      appliedPrice: 0,
      savings: 0,
      unitApprox: null,
      totalUnits: 0,
      blocked: "no_items",
      marginAvailable: false,
      costSum: null,
      marginAmount: null,
      marginPercent: null,
      belowCost: false,
    };
  }

  // Decide fonte (b2b vs retail)
  const wantsB2b = isB2bApproved && kit.available_b2b;
  let source: "retail" | "b2b" = wantsB2b ? "b2b" : "retail";
  let blocked: KitPricingBlocked | null = null;
  let appliedPrice = 0;

  if (source === "b2b") {
    if (kitQty < (kit.b2b_min_quantity ?? 1)) {
      // tenta cair para varejo
      if (kit.available_retail) {
        source = "retail";
      } else {
        blocked = "below_min_qty";
      }
    }
  }

  if (source === "retail" && !kit.available_retail) {
    if (isB2bApproved && kit.available_b2b) {
      source = "b2b";
    } else {
      blocked = isB2bApproved ? "not_available_b2b" : "not_available_retail";
    }
  }

  const retailPrice = applyRetailMethod(retailSum, kit);

  if (source === "b2b") {
    switch (kit.b2b_pricing_method) {
      case "fixed_price":
        appliedPrice = round2(Math.max(0, Number(kit.b2b_fixed_price ?? 0)));
        break;
      case "extra_discount": {
        const pct = Math.min(100, Math.max(0, Number(kit.b2b_extra_discount_percent ?? 0)));
        appliedPrice = clampNonNeg(retailPrice - retailPrice * (pct / 100));
        break;
      }
      case "inherit":
      default:
        appliedPrice = round2(b2bInheritSum);
        break;
    }
  } else {
    appliedPrice = retailPrice;
  }

  const savings = clampNonNeg(retailSum - appliedPrice);

  // unitApprox: faz sentido se há ≥ 2 unidades totais.
  const unitApprox = totalUnits >= 2 ? round2(appliedPrice / totalUnits) : null;

  const marginAmount =
    costSum != null ? round2(appliedPrice - costSum) : null;
  const marginPercent =
    costSum != null && appliedPrice > 0
      ? round2((marginAmount! / appliedPrice) * 100)
      : null;
  const belowCost = costSum != null && appliedPrice < costSum;

  return {
    source,
    retailSum,
    b2bInheritSum,
    appliedPrice,
    savings,
    unitApprox,
    totalUnits,
    blocked,
    marginAvailable: allHaveCost,
    costSum,
    marginAmount,
    marginPercent,
    belowCost,
  };
}

export const KIT_TYPE_LABELS: Record<KitType, string> = {
  combinado: "Kit combinado",
  promocional: "Kit promocional",
  b2b: "Kit empresa (B2B)",
  estrutural: "Kit estrutural (sem desconto)",
};

export const KIT_TYPE_BADGES: Record<KitType, string> = {
  combinado: "Compre junto",
  promocional: "Kit promocional",
  b2b: "Preço empresa",
  estrutural: "Kit",
};

export const KIT_PRICING_METHOD_LABELS: Record<KitPricingMethod, string> = {
  sum: "Soma dos itens (sem desconto)",
  percent_discount: "Desconto percentual",
  fixed_discount: "Desconto fixo (R$)",
  fixed_price: "Preço fechado do kit",
};

export const KIT_B2B_METHOD_LABELS: Record<KitB2bPricingMethod, string> = {
  inherit: "Herdar preço B2B dos produtos",
  fixed_price: "Preço B2B fechado do kit",
  extra_discount: "Aplicar desconto extra B2B (%)",
};

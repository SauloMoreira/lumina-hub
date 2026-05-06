/**
 * Tipos e helpers de B2B compartilhados entre cliente e servidor.
 * NÃO importa nada de @/integrations/supabase/client.server — é seguro no bundle do browser.
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
  pricing_source?: "retail" | "b2b";
  b2b_discount_unit?: number;
  b2b_discount_total?: number;
  b2b_min_quantity?: number;
  b2b_qty_multiple?: number;
  b2b_valid_until?: string | null;
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

export function describeB2bReason(reason: string, item?: B2bPricedItem): string | null {
  switch (reason) {
    case "b2b_applied":
      return null;
    case "company_not_approved":
      return "Faça login com uma empresa aprovada para acessar o preço empresa.";
    case "b2b_not_enabled":
      return "Este produto não tem condição B2B ativa.";
    case "no_b2b_price":
      return "Preço empresa ainda não configurado para este produto.";
    case "b2b_expired":
      return "A condição B2B deste produto expirou.";
    case "below_min_qty":
      return `Para acessar o preço empresa, compre a partir de ${item?.b2b_min_quantity ?? 1} unidades.`;
    case "invalid_multiple":
      return `Este produto deve ser comprado em múltiplos de ${item?.b2b_qty_multiple ?? 1} unidades a partir de ${item?.b2b_min_quantity ?? 1}.`;
    case "product_unavailable":
      return "Produto indisponível no momento.";
    default:
      return null;
  }
}

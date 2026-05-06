import { useQuery } from "@tanstack/react-query";
import { getCartPricing } from "@/server/b2bPricing.functions";
import type { B2bPricingResult } from "@/lib/b2bPricingShared";
import { useCart } from "@/stores/cartStore";

/**
 * Hook que consulta o backend para obter o preço autoritativo do carrinho.
 * Backend é a fonte da verdade — frontend apenas exibe.
 *
 * - Visitante: recebe sempre preço de varejo.
 * - Usuário sem empresa aprovada: recebe varejo (motivo `company_not_approved`).
 * - Empresa aprovada: recebe preço B2B item a item conforme regras.
 *
 * Atualiza a cada mudança de itens/quantidades no carrinho.
 */
export function useCartPricing(): {
  pricing: B2bPricingResult | null;
  isLoading: boolean;
  refetch: () => void;
} {
  const items = useCart((s) => s.items);
  const payload = items.map((i) => ({ productId: i.productId, qty: i.qty }));

  const query = useQuery({
    queryKey: ["cart-pricing", payload],
    enabled: payload.length > 0,
    queryFn: () => getCartPricing({ data: { items: payload } }),
    staleTime: 15_000,
  });

  return {
    pricing: query.data ?? null,
    isLoading: query.isLoading,
    refetch: () => void query.refetch(),
  };
}

/** CNPJ mascarado (XX.XXX.XXX/XXXX-XX). */
export function maskCnpj(cnpj: string | null | undefined): string {
  if (!cnpj) return "";
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

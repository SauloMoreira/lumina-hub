import { useQuery } from '@tanstack/react-query';
import { getAdminOperations, type OperationsCard, type OperationsAlert } from '@/server/operations.functions';

export type CounterSeverity = 'danger' | 'warn' | 'info';

export type CounterEntry = {
  qty: number;
  severity: CounterSeverity;
};

/**
 * Hook consolidado que alimenta os badges do menu administrativo
 * e o sino de alertas. Reaproveita `getAdminOperations` (cacheado
 * por React Query) para evitar uma query por item de menu.
 */
export function useAdminCounters() {
  const query = useQuery({
    queryKey: ['admin-operations'],
    queryFn: () => getAdminOperations(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const cards = query.data?.cards ?? [];
  const alerts = query.data?.alerts ?? [];

  // Mapa indexado por id do card para os itens da sidebar consultarem.
  const map: Record<string, CounterEntry> = {};
  for (const c of cards) {
    map[c.id] = {
      qty: c.qty,
      severity:
        c.status === 'danger' ? 'danger' : c.status === 'warn' ? 'warn' : 'info',
    };
  }

  // Total de pendências = soma de cards com qty > 0
  const pendingTotal = cards.reduce((s, c) => (c.qty > 0 ? s + 1 : s), 0);

  return {
    isLoading: query.isLoading,
    isError: !!query.error,
    counters: map,
    pendingTotal,
    cards,
    alerts,
  };
}

export type { OperationsCard, OperationsAlert };

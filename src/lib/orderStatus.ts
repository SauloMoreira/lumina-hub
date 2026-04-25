export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Aguardando pagamento',
  awaiting_payment: 'Aguardando pagamento',
  confirmed: 'Confirmado',
  paid: 'Pago',
  preparing: 'Em preparação',
  shipped: 'Enviado',
  out_for_delivery: 'Saiu para entrega',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  failed: 'Falhou',
};

export const ORDER_STATUS_OPTIONS = [
  'pending',
  'confirmed',
  'preparing',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
] as const;

export const PAYMENT_STATUS_OPTIONS = ['pending', 'paid', 'failed', 'refunded'] as const;

export function orderStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  return ORDER_STATUS_LABELS[status] ?? status;
}

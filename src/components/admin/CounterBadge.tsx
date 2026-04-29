import { cn } from '@/lib/utils';
import type { CounterSeverity } from '@/hooks/useAdminCounters';

const STYLES: Record<CounterSeverity, string> = {
  danger: 'bg-destructive text-destructive-foreground',
  warn: 'bg-amber-500 text-white',
  info: 'bg-muted text-muted-foreground border border-border',
};

export function CounterBadge({
  qty,
  severity = 'info',
  className,
}: {
  qty: number;
  severity?: CounterSeverity;
  className?: string;
}) {
  if (!qty || qty <= 0) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full leading-none',
        STYLES[severity],
        className,
      )}
    >
      {qty > 99 ? '99+' : qty}
    </span>
  );
}

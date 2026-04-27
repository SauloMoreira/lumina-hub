import { Webhook, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import type { DashboardData } from '@/server/dashboard.functions';
import { fmtDateTime, fmtInt } from './format';

export function WebhookHealthCard({ stats }: { stats: DashboardData['webhookStats'] }) {
  if (stats.total === 0) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-lg">
        Nenhum webhook recebido no período.
      </div>
    );
  }
  const items = [
    { icon: Webhook, label: 'Recebidos', value: fmtInt(stats.total), tone: 'text-foreground' },
    { icon: CheckCircle2, label: 'Processados', value: fmtInt(stats.processed), tone: 'text-emerald-600 dark:text-emerald-400' },
    { icon: AlertTriangle, label: 'Com erro', value: fmtInt(stats.errors), tone: stats.errors > 0 ? 'text-destructive' : 'text-muted-foreground' },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {items.map((it) => (
          <div key={it.label} className="flex flex-col items-start gap-1 p-3 bg-muted/40 rounded-lg">
            <it.icon className={`w-4 h-4 ${it.tone}`} />
            <p className="text-[11px] text-muted-foreground">{it.label}</p>
            <p className={`text-lg font-semibold tabular-nums ${it.tone}`}>{it.value}</p>
          </div>
        ))}
      </div>
      {stats.lastReceivedAt && (
        <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Último webhook
          </span>
          <span className="font-medium tabular-nums">{fmtDateTime(stats.lastReceivedAt)}</span>
        </div>
      )}
    </div>
  );
}

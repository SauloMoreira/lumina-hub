import { Mail, MailCheck, MailX, Clock } from "lucide-react";
import type { DashboardData } from "@/server/dashboard.functions";
import { fmtInt, fmtPct } from "./format";

export function EmailEventsCard({ stats }: { stats: DashboardData["emailStats"] }) {
  if (stats.total === 0) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-lg">
        Nenhum e-mail transacional no período.
      </div>
    );
  }
  const items = [
    {
      icon: MailCheck,
      label: "Enviados",
      value: fmtInt(stats.sent),
      tone: "text-emerald-600 dark:text-emerald-400",
    },
    {
      icon: Clock,
      label: "Pendentes",
      value: fmtInt(stats.pending),
      tone: "text-amber-600 dark:text-amber-400",
    },
    { icon: MailX, label: "Falharam", value: fmtInt(stats.failed), tone: "text-destructive" },
    { icon: Mail, label: "Total", value: fmtInt(stats.total), tone: "text-foreground" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
            <it.icon className={`w-4 h-4 ${it.tone}`} />
            <div>
              <p className="text-[11px] text-muted-foreground">{it.label}</p>
              <p className={`text-lg font-semibold tabular-nums ${it.tone}`}>{it.value}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Taxa de falha</span>
        <span
          className={[
            "font-semibold tabular-nums",
            stats.failureRate > 0.05
              ? "text-destructive"
              : "text-emerald-600 dark:text-emerald-400",
          ].join(" ")}
        >
          {fmtPct(stats.failureRate)}
        </span>
      </div>
    </div>
  );
}

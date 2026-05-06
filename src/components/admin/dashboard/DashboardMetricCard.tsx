import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  accent?: "primary" | "success" | "warn" | "danger";
  loading?: boolean;
}

const accentClass: Record<NonNullable<Props["accent"]>, string> = {
  primary: "text-primary",
  success: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  danger: "text-destructive",
};

export function DashboardMetricCard({ icon: Icon, label, value, hint, accent, loading }: Props) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2 min-h-[100px]">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <span className="truncate">{label}</span>
      </div>
      {loading ? (
        <div className="h-7 w-24 bg-muted animate-pulse rounded" />
      ) : (
        <p
          className={[
            "font-display font-bold text-2xl tracking-tight leading-none",
            accent ? accentClass[accent] : "",
          ].join(" ")}
        >
          {value}
        </p>
      )}
      {hint && !loading && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

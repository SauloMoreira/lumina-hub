import type { OperationsCard, CardStatus, Severity } from '@/server/operations.functions';
import { Link } from '@tanstack/react-router';
import { ArrowRight, CheckCircle2, AlertTriangle, AlertCircle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<CardStatus, { ring: string; chip: string; icon: typeof CheckCircle2; label: string; iconColor: string }> = {
  ok: {
    ring: 'border-emerald-500/30',
    chip: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    icon: CheckCircle2,
    label: 'Tudo certo',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  warn: {
    ring: 'border-amber-500/40',
    chip: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    icon: AlertTriangle,
    label: 'Atenção',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  danger: {
    ring: 'border-destructive/40',
    chip: 'bg-destructive/10 text-destructive',
    icon: AlertCircle,
    label: 'Ação urgente',
    iconColor: 'text-destructive',
  },
  unknown: {
    ring: 'border-border',
    chip: 'bg-muted text-muted-foreground',
    icon: HelpCircle,
    label: 'Sem dados',
    iconColor: 'text-muted-foreground',
  },
};

export function OperationsCardItem({ card }: { card: OperationsCard }) {
  const style = STATUS_STYLES[card.status];
  const Icon = style.icon;
  const okMessage = card.status === 'ok';
  return (
    <div
      className={cn(
        'bg-card border rounded-xl p-4 flex flex-col gap-3 transition-colors',
        style.ring,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={cn('w-4 h-4 shrink-0', style.iconColor)} />
          <h3 className="font-medium text-sm leading-tight truncate">{card.title}</h3>
        </div>
        <span className={cn('text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold shrink-0', style.chip)}>
          {style.label}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-display font-bold text-3xl tracking-tight leading-none">
          {card.qty}
        </span>
        <span className="text-xs text-muted-foreground">{card.group}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {okMessage ? 'Tudo certo por aqui.' : card.description}
      </p>
      {card.ctaHref ? (
        <Link
          to={card.ctaHref as any}
          className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {card.ctaLabel}
          <ArrowRight className="w-3 h-3" />
        </Link>
      ) : (
        <span className="mt-auto inline-flex items-center gap-1 text-xs text-muted-foreground/70">
          {card.ctaLabel} (em breve)
        </span>
      )}
    </div>
  );
}

const SEVERITY_STYLES: Record<Severity, { ring: string; chip: string; iconColor: string; label: string }> = {
  high: {
    ring: 'border-destructive/40 bg-destructive/5',
    chip: 'bg-destructive text-destructive-foreground',
    iconColor: 'text-destructive',
    label: 'Alta',
  },
  medium: {
    ring: 'border-amber-500/40 bg-amber-500/5',
    chip: 'bg-amber-500 text-white',
    iconColor: 'text-amber-600 dark:text-amber-400',
    label: 'Média',
  },
  low: {
    ring: 'border-border bg-muted/30',
    chip: 'bg-muted text-muted-foreground',
    iconColor: 'text-muted-foreground',
    label: 'Baixa',
  },
};

export function AlertItem({
  title,
  description,
  severity,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  description: string;
  severity: Severity;
  ctaLabel: string;
  ctaHref: string | null;
}) {
  const style = SEVERITY_STYLES[severity];
  return (
    <div className={cn('border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3', style.ring)}>
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <AlertCircle className={cn('w-5 h-5 shrink-0 mt-0.5', style.iconColor)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-sm">{title}</h4>
            <span className={cn('text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold', style.chip)}>
              {style.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
        </div>
      </div>
      {ctaHref && (
        <Link
          to={ctaHref as any}
          className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted inline-flex items-center gap-1"
        >
          {ctaLabel}
          <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

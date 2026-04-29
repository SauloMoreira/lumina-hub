import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Bell, ArrowRight, CheckCircle2, AlertCircle, EyeOff, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminCounters, type OperationsAlert } from '@/hooks/useAdminCounters';

const HIDE_STORAGE_KEY = 'admin.alerts.hidden';

type HideMap = Record<string, number>; // alertId -> expires timestamp

function loadHidden(): HideMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(HIDE_STORAGE_KEY);
    if (!raw) return {};
    const parsed: HideMap = JSON.parse(raw);
    const now = Date.now();
    // Limpa entradas expiradas
    const next: HideMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v > now) next[k] = v;
    }
    return next;
  } catch {
    return {};
  }
}

function saveHidden(map: HideMap) {
  try {
    localStorage.setItem(HIDE_STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

const SEVERITY_DOT: Record<OperationsAlert['severity'], string> = {
  high: 'bg-destructive',
  medium: 'bg-amber-500',
  low: 'bg-muted-foreground/40',
};

const SEVERITY_LABEL: Record<OperationsAlert['severity'], string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export function AdminAlertsBell() {
  const { alerts } = useAdminCounters();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState<HideMap>(() => loadHidden());
  const ref = useRef<HTMLDivElement | null>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const visible = useMemo(() => {
    const now = Date.now();
    return alerts
      .filter((a) => !hidden[a.id] || hidden[a.id] <= now)
      .sort(
        (a, b) =>
          severityWeight(b.severity) - severityWeight(a.severity),
      );
  }, [alerts, hidden]);

  const total = visible.length;
  const highest = visible[0]?.severity ?? 'low';

  const hide = (id: string, days: number) => {
    const next = { ...hidden, [id]: Date.now() + days * 24 * 3600 * 1000 };
    setHidden(next);
    saveHidden(next);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center h-9 w-9 rounded-md border border-border bg-card hover:bg-muted transition-colors"
        aria-label={`Alertas (${total})`}
      >
        <Bell className="w-4 h-4" />
        {total > 0 && (
          <span
            className={cn(
              'absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full leading-none text-white',
              highest === 'high'
                ? 'bg-destructive'
                : highest === 'medium'
                  ? 'bg-amber-500'
                  : 'bg-muted-foreground',
            )}
          >
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-w-[92vw] bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-display font-semibold text-sm">Alertas</h3>
              <p className="text-[11px] text-muted-foreground">
                {total === 0 ? 'Nenhum alerta ativo' : `${total} alerta${total > 1 ? 's' : ''} ativo${total > 1 ? 's' : ''}`}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {visible.length === 0 ? (
              <div className="p-6 text-center">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600 dark:text-emerald-400 mb-2" />
                <p className="text-sm font-medium">Tudo certo por aqui!</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Você está em dia com a operação.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {visible.slice(0, 10).map((a) => (
                  <li key={a.id} className="p-3 hover:bg-muted/40 transition-colors">
                    <div className="flex items-start gap-2.5">
                      <span
                        className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', SEVERITY_DOT[a.severity])}
                        title={SEVERITY_LABEL[a.severity]}
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-semibold leading-tight">{a.title}</h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-3">
                          {a.description}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {a.ctaHref && (
                            <Link
                              to={a.ctaHref as any}
                              onClick={() => setOpen(false)}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                            >
                              {a.ctaLabel}
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          )}
                          {a.severity !== 'high' && (
                            <HideMenu onHide={(days) => hide(a.id, days)} />
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="px-4 py-2 border-t border-border bg-muted/30">
            <Link
              to={'/admin/painel-do-dia' as any}
              onClick={() => setOpen(false)}
              className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
            >
              Ver central completa
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function HideMenu({ onHide }: { onHide: (days: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        title="Ocultar temporariamente"
      >
        <EyeOff className="w-3 h-3" />
        Ocultar
      </button>
      {open && (
        <div className="absolute left-0 mt-1 bg-popover border border-border rounded-md shadow-md z-10 min-w-[120px]">
          {[
            { d: 1, l: 'Por 1 dia' },
            { d: 7, l: 'Por 7 dias' },
            { d: 30, l: 'Por 30 dias' },
          ].map((opt) => (
            <button
              key={opt.d}
              onClick={() => {
                onHide(opt.d);
                setOpen(false);
              }}
              className="block w-full text-left px-3 py-1.5 text-[11px] hover:bg-muted"
            >
              {opt.l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function severityWeight(s: OperationsAlert['severity']) {
  return s === 'high' ? 3 : s === 'medium' ? 2 : 1;
}

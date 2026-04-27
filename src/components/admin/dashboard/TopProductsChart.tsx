import type { DashboardData } from '@/server/dashboard.functions';
import { fmtBRL, fmtInt } from './format';
import { EmptyChart } from './EmptyChart';

export function TopProductsChart({ data }: { data: DashboardData['topProducts'] }) {
  if (data.length === 0) {
    return <EmptyChart message="Ainda não há produtos vendidos neste período." />;
  }
  const max = Math.max(...data.map((d) => d.qty), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground border-b border-border">
            <th className="py-2 px-2 font-medium">#</th>
            <th className="py-2 px-2 font-medium">Produto</th>
            <th className="py-2 px-2 font-medium w-1/3">Unidades vendidas</th>
            <th className="py-2 px-2 font-medium text-right">Receita</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p, i) => (
            <tr key={p.productId ?? p.name} className="border-b border-border/60 hover:bg-muted/40">
              <td className="py-2 px-2 text-muted-foreground tabular-nums">{i + 1}</td>
              <td className="py-2 px-2 font-medium truncate max-w-[260px]">{p.name}</td>
              <td className="py-2 px-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 bg-muted rounded flex-1 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded"
                      style={{ width: `${(p.qty / max) * 100}%` }}
                    />
                  </div>
                  <span className="tabular-nums text-xs text-muted-foreground w-10 text-right">
                    {fmtInt(p.qty)}
                  </span>
                </div>
              </td>
              <td className="py-2 px-2 text-right tabular-nums font-medium">{fmtBRL(p.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { DashboardData } from '@/server/dashboard.functions';
import { fmtBRL, fmtDayShort } from './format';
import { EmptyChart } from './EmptyChart';

export function AverageTicketChart({ data }: { data: DashboardData['avgTicketByDay'] }) {
  const hasAny = data.some((d) => d.avgTicket > 0);
  if (!hasAny) {
    return <EmptyChart message="Ainda não há pagamentos aprovados no período." />;
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="date" tickFormatter={fmtDayShort} stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickFormatter={(v) => `R$ ${Math.round(v)}`}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(l) => `Dia ${fmtDayShort(String(l))}`}
            formatter={(value: number) => [fmtBRL(value), 'Ticket médio']}
          />
          <Line
            type="monotone"
            dataKey="avgTicket"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

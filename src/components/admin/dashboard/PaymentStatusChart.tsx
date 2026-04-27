import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import type { DashboardData } from '@/server/dashboard.functions';
import { CHART_COLORS, paymentStatusPtBR } from './format';
import { EmptyChart } from './EmptyChart';

export function PaymentStatusChart({ data }: { data: DashboardData['paymentStatus'] }) {
  if (data.length === 0) {
    return <EmptyChart message="Nenhum pagamento no período." />;
  }
  const rows = data
    .map((d) => ({
      name: paymentStatusPtBR[d.status] ?? d.status,
      value: d.count,
    }))
    .sort((a, b) => b.value - a.value);
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
          <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={140} />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
            cursor={{ fill: 'hsl(var(--muted))' }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {rows.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

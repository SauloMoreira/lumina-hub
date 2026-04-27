import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import type { DashboardData } from '@/server/dashboard.functions';
import { CHART_COLORS, fmtBRL } from './format';
import { EmptyChart } from './EmptyChart';

export function RevenueByCategoryChart({
  data,
  hasCategories,
}: {
  data: DashboardData['revenueByCategory'];
  hasCategories: boolean;
}) {
  if (!hasCategories) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-lg px-6 text-center">
        Categorias ainda não disponíveis para análise.
      </div>
    );
  }
  if (data.length === 0) {
    return <EmptyChart message="Ainda não há receita por categoria no período." />;
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="revenue"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            innerRadius={45}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => [fmtBRL(value), name]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

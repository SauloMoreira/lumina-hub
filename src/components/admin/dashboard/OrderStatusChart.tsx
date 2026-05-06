import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import type { DashboardData } from "@/server/dashboard.functions";
import { CHART_COLORS, orderStatusPtBR } from "./format";
import { EmptyChart } from "./EmptyChart";

export function OrderStatusChart({ data }: { data: DashboardData["orderStatus"] }) {
  if (data.length === 0) {
    return <EmptyChart message="Nenhum pedido no período." />;
  }
  const rows = data.map((d) => ({
    name: orderStatusPtBR[d.status] ?? d.status,
    value: d.count,
  }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rows}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={90}
            innerRadius={50}
            paddingAngle={2}
          >
            {rows.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
